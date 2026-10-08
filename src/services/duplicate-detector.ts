/**
 * NIRNAY Duplicate Detection Service
 * 
 * Prevents accidental double ingestion and detects overlapping government notices
 * based on official advertisement numbers, source URLs, and authority mappings.
 */

export type DuplicateStatus = 'NO_DUPLICATE' | 'POSSIBLE_DUPLICATE' | 'CONFIRMED_DUPLICATE';

export interface DuplicateMatch {
  matchedRecruitmentId: string;
  matchedTitle: string;
  matchedAdvtNumber: string | null;
  matchedOrganisation: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
}

export interface DuplicateCheckResult {
  status: DuplicateStatus;
  matches: DuplicateMatch[];
  summary: string;
}

export interface RecruitmentCandidate {
  id?: string;
  /** null when the notice states none: the advt rule is skipped and the other identity signals decide. */
  advtNumber: string | null;
  title: string;
  organisationShortName?: string;
  organisationId?: string;
  sourceUrl?: string;
  /** Every official source URL the notice cites (sourceUrl is the first). */
  sourceUrls?: string[];
  postId?: string;
  cycleYear?: number;
  totalVacancies?: number;
  applicationStart?: string;
  applicationEnd?: string;
}

export interface ExistingRecruitmentRecord {
  id: string;
  advtNumber: string | null;
  title: string;
  organisationShortName?: string;
  organisationId?: string;
  sourceUrl?: string;
  sourceUrls?: string[];
  postId?: string;
  cycleYear?: number;
  totalVacancies?: number;
  applicationStart?: string;
  applicationEnd?: string;
}

function normalize(str?: string | null): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const urlSet = (r: { sourceUrl?: string; sourceUrls?: string[] }): Set<string> =>
  new Set([r.sourceUrl, ...(r.sourceUrls ?? [])].map(u => u?.trim().toLowerCase() ?? '').filter(Boolean));

/** Dice coefficient over character bigrams of the normalised strings (0..1). */
export function similarity(a?: string | null, b?: string | null): number {
  const x = normalize(a), y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1); } return m; };
  const gx = grams(x), gy = grams(y);
  let hit = 0;
  for (const [g, n] of gx) hit += Math.min(n, gy.get(g) ?? 0);
  return (2 * hit) / (x.length - 1 + y.length - 1);
}

/** Both windows known (ISO dates compare as strings) and they share at least one day. */
const windowsOverlap = (a: { applicationStart?: string; applicationEnd?: string }, b: { applicationStart?: string; applicationEnd?: string }) =>
  !!(a.applicationStart && a.applicationEnd && b.applicationStart && b.applicationEnd) && a.applicationStart <= b.applicationEnd! && b.applicationStart <= a.applicationEnd!;

/**
 * Check a new recruitment candidate against existing recruitment records.
 */
export function detectDuplicates(
  candidate: RecruitmentCandidate,
  existingList: ExistingRecruitmentRecord[]
): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];

  const candidateNormAdvt = normalize(candidate.advtNumber);
  const candidateNormTitle = normalize(candidate.title);
  const candidateUrls = urlSet(candidate);

  for (const existing of existingList) {
    // Skip self if comparing an update of an existing record
    if (candidate.id && candidate.id === existing.id) continue;

    const reasons: string[] = [];
    let isConfirmed = false;

    // 1. Exact Advertisement Number Match within same organisation or cycle
    const existingNormAdvt = normalize(existing.advtNumber);
    if (candidateNormAdvt && existingNormAdvt && candidateNormAdvt === existingNormAdvt) {
      const sameOrg = (candidate.organisationShortName && existing.organisationShortName && 
                       candidate.organisationShortName.toLowerCase() === existing.organisationShortName.toLowerCase()) ||
                      (candidate.organisationId && existing.organisationId && candidate.organisationId === existing.organisationId);

      if (sameOrg) {
        reasons.push(`Identical Advertisement Number (${candidate.advtNumber}) for same recruiting authority (${existing.organisationShortName || existing.organisationId}).`);
        isConfirmed = true;
      } else {
        reasons.push(`Matching Advertisement Number (${candidate.advtNumber}) across authorities.`);
      }
    }

    // 2. Exact Official Source PDF URL Match. One rulebook can serve several posts, and each canonical post is its own
    //    recruitment record, so a shared URL on its own is only a duplicate signal when the post is the same (or unknown).
    const sharedUrl = [...urlSet(existing)].find(u => candidateUrls.has(u));
    if (sharedUrl) {
      const differentPost = !!(candidate.postId && existing.postId && candidate.postId !== existing.postId);
      if (!differentPost) {
        reasons.push(`Identical official source notification document URL (${[candidate.sourceUrl, ...(candidate.sourceUrls ?? [])].find(u => u?.trim().toLowerCase() === sharedUrl) ?? sharedUrl}).`);
        isConfirmed = true;
      }
    }

    // 3. High Title & Post Similarity
    const existingNormTitle = normalize(existing.title);
    if (candidateNormTitle && existingNormTitle) {
      if (candidateNormTitle === existingNormTitle) {
        reasons.push(`Identical recruitment title: "${existing.title}".`);
        if (candidate.cycleYear === existing.cycleYear) {
          isConfirmed = true;
        }
      } else if (
        candidate.postId && existing.postId && candidate.postId === existing.postId &&
        candidate.cycleYear && existing.cycleYear && candidate.cycleYear === existing.cycleYear
      ) {
        reasons.push(`Same canonical post (${candidate.postId}) in same cycle year (${candidate.cycleYear}).`);
      }
    }

    // 4 + 5. Same organisation, and the same post (when both are known): a near-identical name in an overlapping
    //        apply window, or the same vacancy count and last date, is the same notice re-entered.
    const sameOrgId = !!(candidate.organisationId && existing.organisationId && candidate.organisationId === existing.organisationId);
    const samePostOrUnknown = !(candidate.postId && existing.postId && candidate.postId !== existing.postId);
    if (sameOrgId && samePostOrUnknown) {
      if (similarity(candidate.title, existing.title) >= 0.85 && windowsOverlap(candidate, existing)) {
        reasons.push(`Same organisation, near-identical name ("${existing.title}") and overlapping apply window.`);
        isConfirmed = true;
      }
      if (candidate.totalVacancies && candidate.totalVacancies === existing.totalVacancies && candidate.applicationEnd && candidate.applicationEnd === existing.applicationEnd) {
        reasons.push(`Same organisation, same total vacancies (${existing.totalVacancies}) and same last date (${existing.applicationEnd}).`);
        isConfirmed = true;
      }
    }

    if (reasons.length > 0) {
      matches.push({
        matchedRecruitmentId: existing.id,
        matchedTitle: existing.title,
        matchedAdvtNumber: existing.advtNumber,
        matchedOrganisation: existing.organisationShortName || existing.organisationId || 'Unknown',
        confidence: isConfirmed ? 'HIGH' : 'MEDIUM',
        reasons,
      });
    }
  }

  let status: DuplicateStatus = 'NO_DUPLICATE';
  let summary = 'No potential duplicate recruitments detected.';

  if (matches.some(m => m.confidence === 'HIGH')) {
    status = 'CONFIRMED_DUPLICATE';
    summary = `Found ${matches.length} confirmed duplicate notice(s) (same advertisement number, source URL, or organisation with matching name/dates/vacancies).`;
  } else if (matches.length > 0) {
    status = 'POSSIBLE_DUPLICATE';
    summary = `Found ${matches.length} potential duplicate notice(s) with overlapping metadata.`;
  }

  return {
    status,
    matches,
    summary,
  };
}

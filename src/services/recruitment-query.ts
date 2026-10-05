/**
 * RecruitmentQueryService (READ). Domain-level search over published recruitments.
 *
 *   MCP tool -> searchRecruitments() -> getAllActiveRecruitments() (Drizzle) -> D1
 *
 * Business rules (lifecycle, publication) are NOT re-implemented here: lifecycle comes from
 * resolveRecruitmentLifecycle via the existing query layer, and only PUBLISHED rows are loaded.
 */
import { getAllActiveRecruitments, type RecruitmentWithDetails, type CanonicalLifecycle } from '../db/queries';

/**
 * Who is calling and in which operating mode. PROPOSE implies READ plus the right to queue change
 * proposals (src/services/change-proposals.ts). No mode may write live recruitment data.
 */
export interface Actor {
  id: string;
  mode: 'READ' | 'PROPOSE';
}

export const APPLICATION_STATUSES = ['UPCOMING', 'OPEN', 'CLOSED'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const LIFECYCLES: readonly CanonicalLifecycle[] = [
  'NOT_STARTED',
  'APPLICATION_OPEN',
  'APPLICATION_CLOSING',
  'APPLICATION_CLOSED',
  'EXAM_SCHEDULED',
  'EXAM_COMPLETED',
  'RESULT_DECLARED',
];

export interface RecruitmentSearchFilters {
  /** State code, e.g. 'MP' (case-insensitive). */
  state?: string;
  /** Case-insensitive substring over organisation name / short name / slug. */
  organisation?: string;
  department?: string;
  sector?: string;
  /** Canonical post title or slug (substring). */
  post?: string;
  /** Recruitment title (substring). */
  title?: string;
  cycleYear?: number;
  lifecycle?: CanonicalLifecycle;
  applicationStatus?: ApplicationStatus;
  limit?: number;
  cursor?: string;
}

export interface RecruitmentSummary {
  id: string;
  title: string;
  slug: string;
  advtNumber: string;
  organisation: { name: string; shortName: string; slug: string | null };
  department: { name: string; slug: string | null } | null;
  sector: { name: string; slug: string | null } | null;
  jurisdiction: { stateCode: string | null; stateName: string | null };
  canonicalPost: { title: string; slug: string };
  cycleYear: number;
  lifecycle: CanonicalLifecycle;
  applicationStatus: ApplicationStatus;
  publicationStatus: string;
  totalVacancies: number;
  importantDates: Array<{ eventType: string; date: string; isTentative: boolean; notes: string | null }>;
  vacancies: Array<{ category: string; gender: string | null; count: number; subPostName: string | null }>;
  officialLinks: Array<{ linkType: string; title: string; url: string }>;
  sourceSummary: { count: number; types: string[]; lastVerifiedAt: string | null };
}

export interface RecruitmentSearchResult {
  items: RecruitmentSummary[];
  nextCursor: string | null;
  /** Matches found within the scanned window (see `truncated`). */
  total: number;
  /** True when the underlying query hit its row cap, so `total` may undercount. */
  truncated: boolean;
}

export class InvalidSearchInputError extends Error {}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;
/** Rows pulled from the existing query layer (its own cap is 250). */
export const SCAN_WINDOW = 250;

export interface RecruitmentQueryDeps {
  load: (d1: D1Database, options: { includeUnpublished: boolean; limit: number }) => Promise<RecruitmentWithDetails[]>;
}

const defaultDeps: RecruitmentQueryDeps = {
  load: (d1, options) => getAllActiveRecruitments(d1, options),
};

export function encodeCursor(offset: number): string {
  return btoa(JSON.stringify({ o: offset }));
}

export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(atob(cursor));
    if (Number.isInteger(parsed?.o) && parsed.o >= 0) return parsed.o;
  } catch {
    // fall through
  }
  throw new InvalidSearchInputError('Invalid cursor.');
}

/** Application status is derived from the canonical lifecycle, never recomputed from dates here. */
export function toApplicationStatus(lifecycle: CanonicalLifecycle): ApplicationStatus {
  if (lifecycle === 'NOT_STARTED') return 'UPCOMING';
  if (lifecycle === 'APPLICATION_OPEN' || lifecycle === 'APPLICATION_CLOSING') return 'OPEN';
  return 'CLOSED';
}

function includes(haystack: Array<string | null | undefined>, needle: string | undefined): boolean {
  if (!needle) return true;
  const n = needle.trim().toLowerCase();
  return haystack.some(h => (h ?? '').toLowerCase().includes(n));
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function toSummary(r: RecruitmentWithDetails): RecruitmentSummary {
  const sources = r.sourcesList ?? [];
  const verified = sources.map(s => iso(s.lastVerifiedAt)).filter((v): v is string => !!v).sort();
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    advtNumber: r.advtNumber,
    organisation: { name: r.organisationName, shortName: r.organisationShortName, slug: r.organisationSlug ?? null },
    department: r.departmentName ? { name: r.departmentName, slug: r.departmentSlug ?? null } : null,
    sector: r.sectorName ? { name: r.sectorName, slug: r.sectorSlug ?? null } : null,
    jurisdiction: { stateCode: r.stateCode ?? null, stateName: r.stateName ?? null },
    canonicalPost: { title: r.postTitle, slug: r.postSlug },
    cycleYear: r.cycleYear,
    lifecycle: r.resolvedLifecycle,
    applicationStatus: toApplicationStatus(r.resolvedLifecycle),
    publicationStatus: r.status,
    totalVacancies: r.totalVacancies,
    importantDates: (r.importantDatesList ?? []).map(d => ({
      eventType: d.eventType ?? d.event,
      date: d.date,
      isTentative: !!d.isTentative,
      notes: d.notes ?? null,
    })),
    vacancies: (r.vacanciesList ?? []).map(v => ({
      category: v.category,
      gender: v.gender ?? null,
      count: v.count,
      subPostName: v.subPostName ?? null,
    })),
    officialLinks: (r.officialLinksList ?? [])
      .filter(l => l.isActive)
      .map(l => ({ linkType: l.linkType, title: l.title, url: l.url })),
    sourceSummary: {
      count: sources.length,
      types: [...new Set(sources.map(s => s.sourceType))],
      lastVerifiedAt: verified.length ? verified[verified.length - 1] : null,
    },
  };
}

export function matchesFilters(r: RecruitmentWithDetails, f: RecruitmentSearchFilters): boolean {
  if (f.state && (r.stateCode ?? '').toLowerCase() !== f.state.trim().toLowerCase()) return false;
  if (!includes([r.organisationName, r.organisationShortName, r.organisationSlug], f.organisation)) return false;
  if (!includes([r.departmentName, r.departmentSlug], f.department)) return false;
  if (!includes([r.sectorName, r.sectorSlug], f.sector)) return false;
  if (!includes([r.postTitle, r.postSlug], f.post)) return false;
  if (!includes([r.title, r.slug], f.title)) return false;
  if (f.cycleYear !== undefined && r.cycleYear !== f.cycleYear) return false;
  if (f.lifecycle && r.resolvedLifecycle !== f.lifecycle) return false;
  if (f.applicationStatus && toApplicationStatus(r.resolvedLifecycle) !== f.applicationStatus) return false;
  return true;
}

export async function searchRecruitments(
  d1: D1Database | undefined,
  actor: Actor,
  filters: RecruitmentSearchFilters,
  deps: RecruitmentQueryDeps = defaultDeps,
): Promise<RecruitmentSearchResult> {
  // READ (and PROPOSE, which includes read access) only; reject anything else so a future mode cannot reach this path by accident.
  if (actor.mode !== 'READ' && actor.mode !== 'PROPOSE') throw new Error('Operating mode not permitted for recruitment search.');
  // Explicit D1 only: never fall back to the demo data set that the shared query layer serves in dev.
  if (!d1) throw new Error('D1 binding unavailable.');

  const limit = filters.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new InvalidSearchInputError(`limit must be an integer between 1 and ${MAX_LIMIT}.`);
  }
  const offset = decodeCursor(filters.cursor);

  // includeUnpublished is hard-wired to false: PUBLISHED only.
  const rows = await deps.load(d1, { includeUnpublished: false, limit: SCAN_WINDOW });
  const matched = rows
    .filter(r => r.status === 'PUBLISHED' && matchesFilters(r, filters))
    // Deterministic order so offset cursors are stable: newest cycle first, then id.
    .sort((a, b) => b.cycleYear - a.cycleYear || a.id.localeCompare(b.id));

  const page = matched.slice(offset, offset + limit);
  const next = offset + limit;
  return {
    items: page.map(toSummary),
    nextCursor: next < matched.length ? encodeCursor(next) : null,
    total: matched.length,
    truncated: rows.length >= SCAN_WINDOW,
  };
}

/**
 * Public Listing: which published Recruitments a public list page shows, and in what order.
 *
 *   load national window (required) ─┐
 *   load Home State rows (optional) ─┼─▶ merge (national first, de-dupe by id) ─▶ filter ─▶ sort ─▶ Relevance Tiers
 *   load Central rows   (optional) ─┘
 *
 * The national window is capped (getAllActiveRecruitments defaults to 100 rows across India), so the
 * Home State and Central rows are loaded separately and are never truncated. If an optional load
 * fails, the page still renders and tiers whatever the window holds; the miss is logged.
 *
 * Relevance Tiers: home (Home State) → central (IN) → open (other state, no domicile rule)
 * → locked (other state, domicile required). Page sort applies within a tier, never across tiers.
 * Status classification comes only from the canonical lifecycle (src/services/lifecycle.ts).
 */
import { getAllActiveRecruitments, type RecruitmentWithDetails } from '../db/queries';
import { INDIA_JURISDICTIONS } from '../data/india-jurisdictions';

export const CENTRAL_CODE = 'IN';

export interface PublicListingDeps {
  load: (options: { stateId?: string }) => Promise<RecruitmentWithDetails[]>;
}

const defaultDeps: PublicListingDeps = {
  load: (options) => getAllActiveRecruitments(undefined, options),
};

export type ListingSort = 'closing_asc' | 'vacancies_desc' | 'recent';

export interface ListingQuery {
  q?: string;
  qualification?: string;
  org?: string;
  status?: string;
  /** Filter: only this jurisdiction (explicit user choice, unlike the Home State). */
  state?: string;
  sort?: ListingSort | string;
}

export interface RelevanceTiers {
  home: RecruitmentWithDetails[];
  central: RecruitmentWithDetails[];
  open: RecruitmentWithDetails[];
  locked: RecruitmentWithDetails[];
}

export interface ListingResult {
  homeCode: string | null;
  /** Filtered and sorted rows, flat. */
  items: RecruitmentWithDetails[];
  /** Same rows split into Relevance Tiers; null when there is no Home State. */
  tiers: RelevanceTiers | null;
}

function stateIdFor(code: string): string | undefined {
  return INDIA_JURISDICTIONS.find(item => item.code === code)?.id;
}

/** Loads the national window plus untruncated Home State and Central rows, merged in national order. */
export async function loadPublicRecruitments(
  homeCode: string | null,
  deps: PublicListingDeps = defaultDeps,
): Promise<RecruitmentWithDetails[]> {
  const optional = homeCode
    ? [
        { which: 'home', code: homeCode },
        { which: 'central', code: CENTRAL_CODE },
      ]
        .map(spec => ({ ...spec, stateId: stateIdFor(spec.code) }))
        .filter((spec): spec is { which: string; code: string; stateId: string } => Boolean(spec.stateId))
    : [];

  const [national, extras] = await Promise.all([
    deps.load({}),
    Promise.allSettled(optional.map(spec => deps.load({ stateId: spec.stateId }))),
  ]);

  const merged: RecruitmentWithDetails[] = [];
  const seen = new Set<string>();
  const add = (rows: RecruitmentWithDetails[]) => {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
  };

  add(national);
  extras.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      add(result.value);
    } else {
      console.warn(JSON.stringify({
        event: 'listing_load_degraded',
        which: optional[i].which,
        stateCode: optional[i].code,
        error: String(result.reason),
      }));
    }
  });

  return merged;
}

export function isDomicileLocked(rec: RecruitmentWithDetails, homeCode: string | null): boolean {
  const domicile = rec.criteria.domicileStateCode?.toUpperCase()
    || (rec.criteria.requiresMpDomicile ? rec.stateCode?.toUpperCase() : undefined);
  return Boolean(domicile) && domicile !== homeCode;
}

/** Splits rows into Relevance Tiers, keeping input order within each tier. Null without a Home State. */
export function rankByRelevance(rows: RecruitmentWithDetails[], homeCode: string | null): RelevanceTiers | null {
  if (!homeCode) return null;
  const tiers: RelevanceTiers = { home: [], central: [], open: [], locked: [] };
  for (const rec of rows) {
    const code = rec.stateCode?.toUpperCase();
    if (code === homeCode) tiers.home.push(rec);
    else if (code === CENTRAL_CODE) tiers.central.push(rec);
    else if (isDomicileLocked(rec, homeCode)) tiers.locked.push(rec);
    else tiers.open.push(rec);
  }
  return tiers;
}

/** Tiers flattened in relevance order, or the flat items when there is no Home State. */
export function inRelevanceOrder(result: ListingResult): RecruitmentWithDetails[] {
  const { tiers } = result;
  return tiers ? [...tiers.home, ...tiers.central, ...tiers.open, ...tiers.locked] : result.items;
}

function matchesStatus(rec: RecruitmentWithDetails, status: string): boolean {
  const lifecycle = rec.resolvedLifecycle;
  if (status === 'OPEN') return lifecycle === 'APPLICATION_OPEN' || lifecycle === 'APPLICATION_CLOSING';
  if (status === 'CLOSING_SOON') return lifecycle === 'APPLICATION_CLOSING';
  if (status === 'UPCOMING') return lifecycle === 'NOT_STARTED';
  if (status === 'CLOSED' || status === 'CONCLUDED') {
    return lifecycle !== 'APPLICATION_OPEN' && lifecycle !== 'APPLICATION_CLOSING' && lifecycle !== 'NOT_STARTED';
  }
  return lifecycle === status;
}

function matchesQuery(rec: RecruitmentWithDetails, q: string): boolean {
  const query = q.toLowerCase();
  return [rec.title, rec.postTitle, rec.organisationShortName, rec.organisationName, rec.advtNumber, rec.shortSummary]
    .some(field => field?.toLowerCase().includes(query));
}

function sortRows(rows: RecruitmentWithDetails[], sort: string | undefined): RecruitmentWithDetails[] {
  const sorted = [...rows];
  if (sort === 'vacancies_desc') {
    sorted.sort((a, b) => (b.totalVacancies || 0) - (a.totalVacancies || 0));
  } else if (sort === 'closing_asc') {
    sorted.sort((a, b) => (a.applicationEnd || '9999-12-31').localeCompare(b.applicationEnd || '9999-12-31'));
  } else if (sort === 'recent') {
    sorted.sort((a, b) => b.cycleYear - a.cycleYear);
  }
  return sorted;
}

/** Filters, sorts and tiers already-loaded rows. Pure. */
export function queryListing(
  rows: RecruitmentWithDetails[],
  query: ListingQuery,
  homeCode: string | null,
): ListingResult {
  const q = query.q?.trim();
  const state = query.state?.trim().toUpperCase();
  const filtered = rows.filter(rec => {
    if (q && !matchesQuery(rec, q)) return false;
    if (query.qualification && rec.criteria.minQualificationLevel !== query.qualification) return false;
    if (query.org && rec.organisationShortName !== query.org) return false;
    if (state && rec.stateCode?.toUpperCase() !== state) return false;
    if (query.status && !matchesStatus(rec, query.status)) return false;
    return true;
  });
  const items = sortRows(filtered, query.sort);
  return { homeCode, items, tiers: rankByRelevance(items, homeCode) };
}

/** Loads and queries in one call. `all` is the de-duplicated union before filters (for page metrics). */
export async function listPublicRecruitments(
  query: ListingQuery,
  homeCode: string | null,
  deps: PublicListingDeps = defaultDeps,
): Promise<ListingResult & { all: RecruitmentWithDetails[] }> {
  const all = await loadPublicRecruitments(homeCode, deps);
  return { ...queryListing(all, query, homeCode), all };
}

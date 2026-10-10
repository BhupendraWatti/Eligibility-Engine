/**
 * Who may apply to a recruitment, as one value (docs/designs/domicile-scope.md).
 * The state it refers to is always the recruitment's own state, never stored separately.
 * The legacy columns (domicile_state_code, reservation_state_code, requires_mp_domicile) are derived
 * from it here and nowhere else, so old readers keep working and can never disagree with the scope.
 * Pure: no imports of writers (the MCP bundles this through change-proposals.ts).
 */
import { INDIA_JURISDICTIONS } from '../data/india-jurisdictions';

export const DOMICILE_SCOPES = ['UNKNOWN', 'STATE_ONLY', 'OPEN', 'OPEN_STATE_QUOTA'] as const;
export type DomicileScope = (typeof DOMICILE_SCOPES)[number];
/** What an MCP proposal may send. Leaving the field out means "unchanged" (UNKNOWN on a new recruitment). */
export const PROPOSABLE_DOMICILE_SCOPES: DomicileScope[] = ['STATE_ONLY', 'OPEN', 'OPEN_STATE_QUOTA'];
/** Fields replaced by domicileScope. Proposals that send them are refused as FIELD_RETIRED. */
export const RETIRED_DOMICILE_FIELDS = ['requiresMpDomicile', 'domicileStateCode', 'reservationStateCode'] as const;

export const CENTRAL_CODE = 'IN';

export function isDomicileScope(v: unknown): v is DomicileScope {
  return typeof v === 'string' && (DOMICILE_SCOPES as readonly string[]).includes(v);
}

/** 'st_mp' -> 'MP'. State ids are `st_<code>` (src/data/india-jurisdictions.ts), so no database read is needed. */
export function stateCodeForId(stateId: string): string {
  return INDIA_JURISDICTIONS.find(j => j.id === stateId)?.code ?? stateId.replace(/^st_/, '').toUpperCase();
}

/** The scope a writer stores: Central is always OPEN; anything unrecognised is UNKNOWN. */
export function normaliseScope(scope: unknown, stateCode: string): DomicileScope {
  if (stateCode.toUpperCase() === CENTRAL_CODE) return 'OPEN';
  return isDomicileScope(scope) ? scope : 'UNKNOWN';
}

/**
 * The scope to store on a save. A state change resets it (the old scope described another jurisdiction's
 * notice), then a scope supplied with the same save applies. Undefined `requested` keeps the stored value.
 */
export function nextScope(opts: { stored?: unknown; requested?: unknown; previousStateCode?: string | null; stateCode: string }): DomicileScope {
  const moved = !!opts.previousStateCode && opts.previousStateCode.toUpperCase() !== opts.stateCode.toUpperCase();
  const base = moved ? 'UNKNOWN' : opts.stored;
  return normaliseScope(opts.requested === undefined ? base : opts.requested, opts.stateCode);
}

export interface DomicileColumns {
  domicileStateCode: string | null;
  reservationStateCode: string | null;
  requiresMpDomicile: boolean;
}

/**
 * Legacy columns for a stored scope. UNKNOWN is conservative: category and women relaxations stay with the
 * recruitment's own state, so an outsider never gets them on an unchecked state recruitment.
 */
export function deriveDomicileColumns(scope: DomicileScope, stateCode: string): DomicileColumns {
  const state = stateCode.toUpperCase();
  const effective = normaliseScope(scope, state);
  switch (effective) {
    case 'STATE_ONLY': return { domicileStateCode: state, reservationStateCode: state, requiresMpDomicile: state === 'MP' };
    case 'OPEN_STATE_QUOTA': return { domicileStateCode: null, reservationStateCode: state, requiresMpDomicile: false };
    case 'UNKNOWN': return { domicileStateCode: null, reservationStateCode: state, requiresMpDomicile: false };
    case 'OPEN': return { domicileStateCode: null, reservationStateCode: null, requiresMpDomicile: false };
  }
}

/** Choices for the admin "Who may apply" picker, in the order an editor reads them. */
export const DOMICILE_SCOPE_OPTIONS: Array<{ value: DomicileScope; label: string }> = [
  { value: 'UNKNOWN', label: 'Not checked yet' },
  { value: 'STATE_ONLY', label: "Only domiciles of this recruitment's state" },
  { value: 'OPEN_STATE_QUOTA', label: "Open to all; reservation only for this state's domiciles" },
  { value: 'OPEN', label: 'Open to all Indian citizens' },
];

/** Public wording for a scope (jobs list, recruitment page). */
export function domicileScopeLabel(scope: DomicileScope | null | undefined, stateName: string): string {
  switch (scope) {
    case 'STATE_ONLY': return `${stateName} domiciles only`;
    case 'OPEN_STATE_QUOTA': return `Open to all, quota for ${stateName}`;
    case 'OPEN': return 'Open to all Indian citizens';
    default: return 'Domicile rule not checked, see notice';
  }
}

/**
 * Who may apply to a recruitment, as one value (docs/designs/domicile-scope.md).
 * The state it refers to is the recruitment's own, unless an admin picked another (Delhi Police, UT posts, regional
 * Central posts). That state is stored as reservation_state_code, which every non-OPEN scope carries. MCP proposals
 * never send a state: they are held to the recruitment's own (change-proposals.ts).
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

/** The scope a writer stores: no state (Central) means OPEN; anything unrecognised is UNKNOWN. */
export function normaliseScope(scope: unknown, stateCode: string): DomicileScope {
  if (stateCode.toUpperCase() === CENTRAL_CODE) return 'OPEN';
  return isDomicileScope(scope) ? scope : 'UNKNOWN';
}

/** States an admin may pick as the scope's state (Central is not a domicile). */
export const DOMICILE_STATES = INDIA_JURISDICTIONS.filter(j => j.code !== CENTRAL_CODE);

/**
 * The scope and its state to store on a save. A state change of the recruitment resets both (the old scope described
 * another jurisdiction's notice). Undefined `requested` / `requestedState` keep the stored value; an empty
 * `requestedState` means the recruitment's own state. Without a state (Central, no admin pick) the scope is OPEN.
 */
export function nextScope(opts: {
  stored?: unknown; storedState?: string | null; requested?: unknown; requestedState?: string | null;
  previousStateCode?: string | null; stateCode: string;
}): { scope: DomicileScope; state: string } {
  const own = opts.stateCode.toUpperCase();
  const moved = !!opts.previousStateCode && opts.previousStateCode.toUpperCase() !== own;
  const kept = !moved && opts.storedState ? opts.storedState.toUpperCase() : own;
  let state = own;
  if (opts.requestedState === undefined) state = kept;
  else if (opts.requestedState) {
    state = opts.requestedState.toUpperCase();
    if (!DOMICILE_STATES.some(j => j.code === state)) throw new Error(`Unknown domicile state: ${opts.requestedState}`);
  }
  if (state === CENTRAL_CODE && (opts.requested === 'STATE_ONLY' || opts.requested === 'OPEN_STATE_QUOTA')) {
    throw new Error('Pick the domicile state: a Central recruitment can only be limited to a named state.');
  }
  const scope = normaliseScope(opts.requested === undefined ? (moved ? 'UNKNOWN' : opts.stored) : opts.requested, state);
  return { scope, state };
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
  { value: 'STATE_ONLY', label: 'Only domiciles of the state' },
  { value: 'OPEN_STATE_QUOTA', label: "Open to all; reservation only for the state's domiciles" },
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

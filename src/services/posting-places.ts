// src/services/posting-places.ts: the places a recruitment's notice says selected candidates are posted to
// (a district office, a court, a hospital...). Stored as recruitments.posting_places_json, shown on the public page
// and given to Google as the JobPosting's jobLocation list.
//
// Only places the notice names. A statewide or all-India recruitment with no named place stores none, and the page
// then gives Google only the state and country, so no address is ever invented.

import { DOMICILE_STATES } from './domicile-scope';
import { jurisdictionName } from '../data/india-jurisdictions';

export interface PostingPlace {
  /** City, town or district headquarters, e.g. "Bhopal". */
  locality: string;
  /** The place's own state or UT (always stored, so a central recruitment can name places in any state). */
  stateCode: string;
  /** 6-digit Indian PIN code. */
  postalCode?: string;
  /** Office or street address as printed in the notice. */
  streetAddress?: string;
}

export const MAX_POSTING_PLACES = 50;

export class PostingPlaceError extends Error {}

const PIN = /^[1-9]\d{5}$/;

function text(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new PostingPlaceError(`${label} must be text.`);
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length > max) throw new PostingPlaceError(`${label} must be at most ${max} characters.`);
  return clean || undefined;
}

/**
 * Validate and normalise places for a save. A place without a state is in the recruitment's own state; a central
 * recruitment ('IN' or none) must name each place's state. Blank rows are dropped, repeats kept once.
 * Throws PostingPlaceError with a message an admin or the MCP can act on.
 */
export function cleanPostingPlaces(input: unknown, recruitmentStateCode?: string | null): PostingPlace[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new PostingPlaceError('postingPlaces must be a list of places.');
  const own = recruitmentStateCode?.toUpperCase();
  const ownState = own && own !== 'IN' ? own : undefined;
  const out: PostingPlace[] = [];
  const seen = new Set<string>();
  input.forEach((raw, i) => {
    const label = `Place ${i + 1}`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PostingPlaceError(`${label} must be an object.`);
    const p = raw as Record<string, unknown>;
    const locality = text(p.locality, `${label} city or town`, 100);
    const streetAddress = text(p.streetAddress, `${label} address`, 200);
    const pinText = text(p.postalCode, `${label} PIN code`, 10)?.replace(/\s/g, '');
    const stateText = text(p.stateCode, `${label} state`, 3)?.toUpperCase();
    if (!locality && !streetAddress && !pinText && !stateText) return;
    if (!locality) throw new PostingPlaceError(`${label} needs its city or town.`);
    if (pinText && !PIN.test(pinText)) throw new PostingPlaceError(`${label} PIN code must be 6 digits (e.g. 462001).`);
    const stateCode = stateText || ownState;
    if (!stateCode) throw new PostingPlaceError(`${label} (${locality}) needs its state code (e.g. MP).`);
    if (!DOMICILE_STATES.some(j => j.code === stateCode)) throw new PostingPlaceError(`${label} state "${stateCode}" is not a state or UT code.`);
    const place: PostingPlace = { locality, stateCode, ...(pinText ? { postalCode: pinText } : {}), ...(streetAddress ? { streetAddress } : {}) };
    const key = JSON.stringify(place).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(place);
  });
  if (out.length > MAX_POSTING_PLACES) throw new PostingPlaceError(`At most ${MAX_POSTING_PLACES} places of posting.`);
  return out;
}

/** Column value for a save: null when there are no places. */
export const postingPlacesJson = (places: PostingPlace[]): string | null => (places.length ? JSON.stringify(places) : null);

/** Stored column back to places; a broken value reads as none. */
export function parsePostingPlaces(json?: string | null): PostingPlace[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((p): p is PostingPlace => !!p && typeof p.locality === 'string' && typeof p.stateCode === 'string') : [];
  } catch {
    return [];
  }
}

/** The admin form's rows (placeLocality, placeState, placePostalCode, placeStreet, repeated) as raw places. */
export function postingPlacesFromForm(form: { getAll(name: string): unknown[] }): Array<Record<string, string>> {
  const col = (name: string) => form.getAll(name).map(v => String(v ?? ''));
  const localities = col('placeLocality');
  const states = col('placeState');
  const pins = col('placePostalCode');
  const streets = col('placeStreet');
  return localities.map((locality, i) => ({ locality, stateCode: states[i] ?? '', postalCode: pins[i] ?? '', streetAddress: streets[i] ?? '' }));
}

/** One line for people: "Collectorate, Bhopal, Madhya Pradesh 462001". */
export const postingPlaceLabel = (p: PostingPlace): string =>
  [p.streetAddress, p.locality, [jurisdictionName(p.stateCode), p.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');

/** schema.org Place values for JobPosting.jobLocation (Google takes a list when a job has several places). */
export function postingPlaceJobLocations(places: PostingPlace[]) {
  return places.map(p => ({
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      ...(p.streetAddress ? { streetAddress: p.streetAddress } : {}),
      addressLocality: p.locality,
      addressRegion: jurisdictionName(p.stateCode),
      ...(p.postalCode ? { postalCode: p.postalCode } : {}),
      addressCountry: 'IN',
    },
  }));
}

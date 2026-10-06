/**
 * Viewer State: which jurisdiction the current visitor is treated as belonging to (their Home State).
 *
 *   ?home=XX (this view only) > nirnay_state cookie (saved choice) > Cloudflare geo guess > none
 *
 * The geo guess only reorders listings, it never filters. A URL `?home=` shows a state without
 * saving it, so a shared link cannot overwrite someone's saved choice; only `?home=XX&remember=1`
 * (the StatePicker form) and the eligibility wizard write the cookie. Cookie value `none` means the
 * visitor explicitly chose the all-India view, which also beats the geo guess.
 */
import { resolveRegionAlias } from '../data/india-jurisdictions';

export type ViewerStateSource = 'url' | 'cookie' | 'geo' | 'none';

export interface ViewerState {
  /** Home State code (never 'IN'), or null for the all-India view. */
  code: string | null;
  source: ViewerStateSource;
}

export const VIEWER_STATE_COOKIE = 'nirnay_state';
export const NATIONAL_VIEW = 'none';
export const VIEWER_STATE_MAX_AGE = 60 * 60 * 24 * 365;

/** Minimal slice of Cloudflare's `request.cf` that the resolver reads. */
export interface GeoHint {
  country?: string | null;
  regionCode?: string | null;
}

/**
 * Parses a home-state value from the URL or cookie. Returns a jurisdiction code, NATIONAL_VIEW,
 * or null when the value is missing or invalid. Central ('IN') is never a Home State.
 */
export function parseHomeValue(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value || value.length > 16) return null;
  if (value.toLowerCase() === NATIONAL_VIEW) return NATIONAL_VIEW;
  const code = resolveRegionAlias(value);
  return code && code !== 'IN' ? code : null;
}

function fromValue(value: string, source: ViewerStateSource): ViewerState {
  return { code: value === NATIONAL_VIEW ? null : value, source };
}

export function resolveViewerState(input: {
  home?: string | null;
  cookie?: string | null;
  cf?: GeoHint | null;
}): ViewerState {
  const fromUrl = parseHomeValue(input.home);
  if (fromUrl) return fromValue(fromUrl, 'url');

  const fromCookie = parseHomeValue(input.cookie);
  if (fromCookie) return fromValue(fromCookie, 'cookie');

  if (input.cf?.country?.toUpperCase() === 'IN') {
    const geo = resolveRegionAlias(input.cf.regionCode);
    if (geo && geo !== 'IN') return { code: geo, source: 'geo' };
  }

  return { code: null, source: 'none' };
}

/** The cookie value to save for this request, or null when nothing should be saved. */
export function homeValueToSave(home: string | null | undefined, remember: string | null | undefined): string | null {
  if (remember !== '1') return null;
  return parseHomeValue(home);
}

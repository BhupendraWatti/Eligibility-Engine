// Loads admin-edited state names into the shared jurisdiction list (see setJurisdictionNameOverrides).
// Cached per Worker isolate for a few minutes; a save in /admin/states clears the cache at once.
import { INDIA_JURISDICTIONS, setJurisdictionNameOverrides } from '../data/india-jurisdictions';
import { getAllStates } from '../db/queries';

const TTL_MS = 5 * 60 * 1000;
let loadedAt = 0;
let loading: Promise<void> | null = null;

export function clearJurisdictionNameCache(): void {
  loadedAt = 0;
}

/** Names from the states table that differ from the built-in list, by code. */
export function nameOverridesFrom(rows: Array<{ code: string; name: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const code = row.code?.toUpperCase();
    const base = INDIA_JURISDICTIONS.find(j => j.code === code);
    const name = row.name?.trim();
    if (base && name && name !== base.name) out[code] = name;
  }
  return out;
}

export async function refreshJurisdictionNames(now = Date.now()): Promise<void> {
  if (now - loadedAt < TTL_MS) return;
  loading ??= (async () => {
    try {
      const rows = await getAllStates(undefined, { includeInactive: true });
      setJurisdictionNameOverrides(nameOverridesFrom(rows));
      loadedAt = Date.now();
    } catch {
      // Names fall back to the built-in list; try again on the next request.
    } finally {
      loading = null;
    }
  })();
  await loading;
}

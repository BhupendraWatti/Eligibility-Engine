export interface SectorRouteTarget {
  id: string;
  name: string;
  slug: string;
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Resolve canonical sector slugs plus unambiguous short aliases such as education, health, civil-services, etc. */
export function resolveSectorRoute<T extends SectorRouteTarget>(
  routeParam: string,
  sectors: readonly T[],
): T | undefined {
  if (!routeParam) return undefined;
  let normalizedParam = '';
  try {
    normalizedParam = decodeURIComponent(routeParam).trim().replace(/\/+$/, '').toLowerCase();
  } catch {
    normalizedParam = routeParam.trim().replace(/\/+$/, '').toLowerCase();
  }
  if (!normalizedParam) return undefined;

  const hyphenatedParam = normalizedParam.replace(/_/g, '-');

  // 1. Exact match by slug or id (with underscore/hyphen flexibility)
  const exactMatch = sectors.find(
    (sector) =>
      sector.slug.toLowerCase() === normalizedParam ||
      sector.slug.toLowerCase() === hyphenatedParam ||
      sector.id.toLowerCase() === normalizedParam ||
      sector.id.toLowerCase() === hyphenatedParam,
  );
  if (exactMatch) return exactMatch;

  // 2. Exact match by slugified name
  const nameMatch = sectors.find(
    (sector) => slugify(sector.name) === normalizedParam || slugify(sector.name) === hyphenatedParam,
  );
  if (nameMatch) return nameMatch;

  // 3. Token-based alias matching (supports compound aliases like police-defence, civil-services)
  const paramTokens = hyphenatedParam.split('-').filter(Boolean);
  if (paramTokens.length === 0) return undefined;

  const tokenMatches = sectors.filter((sector) => {
    const slugTokens = sector.slug.toLowerCase().split('-').filter(Boolean);
    const nameTokens = slugify(sector.name).split('-').filter(Boolean);
    const availableTokens = new Set([...slugTokens, ...nameTokens]);
    return paramTokens.every((token) => availableTokens.has(token));
  });

  if (tokenMatches.length === 1) return tokenMatches[0];

  return undefined;
}

export interface SectorRouteTarget {
  id: string;
  name: string;
  slug: string;
}

/** Resolve canonical sector slugs plus unambiguous short aliases such as education and health. */
export function resolveSectorRoute<T extends SectorRouteTarget>(
  routeParam: string,
  sectors: readonly T[],
): T | undefined {
  const normalizedParam = routeParam.trim().toLowerCase();
  const exactMatch = sectors.find(
    (sector) => sector.slug.toLowerCase() === normalizedParam || sector.id.toLowerCase() === normalizedParam,
  );
  if (exactMatch) return exactMatch;

  const aliasMatches = sectors.filter((sector) =>
    sector.slug.toLowerCase().split('-').includes(normalizedParam),
  );
  return aliasMatches.length === 1 ? aliasMatches[0] : undefined;
}

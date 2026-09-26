import { resolveSectorRoute, type SectorRouteTarget } from './sector-routing';

const sectors: SectorRouteTarget[] = [
  { id: 'sec_police', name: 'Police, Defence & Prisons', slug: 'police-defence-prisons' },
  { id: 'sec_teaching', name: 'Teaching & Higher Education', slug: 'teaching-education' },
  { id: 'sec_health', name: 'Public Health & Medical Services', slug: 'public-health-medical' },
  { id: 'sec_civil', name: 'Civil & Administrative Services', slug: 'civil-administrative-services' },
  { id: 'sec_judiciary', name: 'Judiciary & Legal Services', slug: 'judiciary-legal-services' },
];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(resolveSectorRoute('education', sectors)?.id === 'sec_teaching', 'education alias must resolve');
assert(resolveSectorRoute('health', sectors)?.id === 'sec_health', 'health alias must resolve');
assert(resolveSectorRoute('police-defence-prisons', sectors)?.id === 'sec_police', 'canonical slug must resolve');
assert(resolveSectorRoute('police', sectors)?.id === 'sec_police', 'single token alias police must resolve');
assert(resolveSectorRoute('police-defence', sectors)?.id === 'sec_police', 'compound alias police-defence must resolve');
assert(resolveSectorRoute('civil-services', sectors)?.id === 'sec_civil', 'compound alias civil-services must resolve');
assert(resolveSectorRoute('civil', sectors)?.id === 'sec_civil', 'single token alias civil must resolve');
assert(resolveSectorRoute('public-health', sectors)?.id === 'sec_health', 'compound alias public-health must resolve');
assert(resolveSectorRoute('medical', sectors)?.id === 'sec_health', 'single token alias medical must resolve');
assert(resolveSectorRoute('judiciary', sectors)?.id === 'sec_judiciary', 'single token alias judiciary must resolve');
assert(resolveSectorRoute('police-defence-prisons/', sectors)?.id === 'sec_police', 'trailing slash must resolve');
assert(resolveSectorRoute('POLICE', sectors)?.id === 'sec_police', 'case-insensitive alias must resolve');
assert(resolveSectorRoute('sec_police', sectors)?.id === 'sec_police', 'id match must resolve');
assert(resolveSectorRoute('services', sectors) === undefined, 'ambiguous aliases must not select a sector');
assert(resolveSectorRoute('missing', sectors) === undefined, 'unknown sectors must remain not found');

console.log('✅ Sector route aliases resolve only when canonical or unambiguous.');

export interface IndiaJurisdiction {
  id: string;
  code: string;
  name: string;
  slug: string;
  isActive?: number;
}

// Central Government + 28 states + 8 union territories.
export const INDIA_JURISDICTIONS: IndiaJurisdiction[] = [
  ['in', 'IN', 'Central Government', 'central-government'],
  ['ap', 'AP', 'Andhra Pradesh', 'andhra-pradesh'],
  ['ar', 'AR', 'Arunachal Pradesh', 'arunachal-pradesh'],
  ['as', 'AS', 'Assam', 'assam'],
  ['br', 'BR', 'Bihar', 'bihar'],
  ['cg', 'CG', 'Chhattisgarh', 'chhattisgarh'],
  ['ga', 'GA', 'Goa', 'goa'],
  ['gj', 'GJ', 'Gujarat', 'gujarat'],
  ['hr', 'HR', 'Haryana', 'haryana'],
  ['hp', 'HP', 'Himachal Pradesh', 'himachal-pradesh'],
  ['jh', 'JH', 'Jharkhand', 'jharkhand'],
  ['ka', 'KA', 'Karnataka', 'karnataka'],
  ['kl', 'KL', 'Kerala', 'kerala'],
  ['mp', 'MP', 'Madhya Pradesh', 'madhya-pradesh'],
  ['mh', 'MH', 'Maharashtra', 'maharashtra'],
  ['mn', 'MN', 'Manipur', 'manipur'],
  ['ml', 'ML', 'Meghalaya', 'meghalaya'],
  ['mz', 'MZ', 'Mizoram', 'mizoram'],
  ['nl', 'NL', 'Nagaland', 'nagaland'],
  ['od', 'OD', 'Odisha', 'odisha'],
  ['pb', 'PB', 'Punjab', 'punjab'],
  ['rj', 'RJ', 'Rajasthan', 'rajasthan'],
  ['sk', 'SK', 'Sikkim', 'sikkim'],
  ['tn', 'TN', 'Tamil Nadu', 'tamil-nadu'],
  ['tg', 'TG', 'Telangana', 'telangana'],
  ['tr', 'TR', 'Tripura', 'tripura'],
  ['up', 'UP', 'Uttar Pradesh', 'uttar-pradesh'],
  ['uk', 'UK', 'Uttarakhand', 'uttarakhand'],
  ['wb', 'WB', 'West Bengal', 'west-bengal'],
  ['an', 'AN', 'Andaman and Nicobar Islands', 'andaman-nicobar-islands'],
  ['ch', 'CH', 'Chandigarh', 'chandigarh'],
  ['dn', 'DN', 'Dadra and Nagar Haveli and Daman and Diu', 'dadra-nagar-haveli-daman-diu'],
  ['dl', 'DL', 'Delhi', 'delhi'],
  ['jk', 'JK', 'Jammu and Kashmir', 'jammu-kashmir'],
  ['la', 'LA', 'Ladakh', 'ladakh'],
  ['ld', 'LD', 'Lakshadweep', 'lakshadweep'],
  ['py', 'PY', 'Puducherry', 'puducherry'],
].map(([key, code, name, slug]) => ({ id: `st_${key}`, code, name, slug }));

// ISO 3166-2:IN codes that differ from ours. Geo databases may return either the old or the
// current ISO code (the 2023-11-23 and 2020-11-11 revisions), so both map to our code.
const REGION_ALIASES: Record<string, string> = {
  TS: 'TG', // Telangana (ISO since 2023)
  DH: 'DN', // Dadra and Nagar Haveli and Daman and Diu (ISO since 2020)
  DD: 'DN',
  OR: 'OD', // Odisha (pre-2023 ISO)
  CT: 'CG', // Chhattisgarh (pre-2023 ISO)
  UT: 'UK', // Uttarakhand (pre-2023 ISO)
  UL: 'UK',
};

/** Maps an ISO/geo region code (any case) to a NIRNAY jurisdiction code, or null if unknown. */
export function resolveRegionAlias(code?: string | null): string | null {
  const upper = code?.trim().toUpperCase();
  if (!upper) return null;
  const mapped = REGION_ALIASES[upper] ?? upper;
  return INDIA_JURISDICTIONS.some(item => item.code === mapped) ? mapped : null;
}

export function jurisdictionName(code?: string | null): string {
  return INDIA_JURISDICTIONS.find(item => item.code === code?.toUpperCase())?.name || code || 'the required jurisdiction';
}

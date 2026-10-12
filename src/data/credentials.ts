/**
 * Certificates and degree subjects that eligibility rules refer to, with the spellings notices and candidates use.
 *
 * A recruitment's `additionalSkills` is a list of requirements; each requirement is one code, or several codes joined
 * by "|" when any one of them is enough ("DELED|BELED" = D.El.Ed or B.El.Ed). The engine compares codes, so
 * "BTC", "D.El.Ed" and "Basic Teaching Certificate" are the same thing. Free text that is not in the list still
 * works (exact, case-insensitive), so older records keep their meaning.
 */

export interface Credential {
  code: string;
  label: string;
  /** Other spellings, compared after folding case, dots, spaces and hyphens. */
  aliases: string[];
  /** Shown as a group in the candidate form. */
  group: 'Teaching' | 'Teacher eligibility test' | 'Driving licence' | 'Computer and typing' | 'Recruitment test' | 'Sports and NCC';
}

export const CERTIFICATES: readonly Credential[] = [
  { code: 'DELED', label: 'D.El.Ed / BTC (2-year elementary teacher diploma)', group: 'Teaching', aliases: ['D.El.Ed', 'DElEd', 'BTC', 'B.T.C.', 'Basic Teaching Certificate', 'JBT', 'Diploma in Elementary Education', 'BTC Urdu', 'Special BTC'] },
  { code: 'BELED', label: 'B.El.Ed (4-year)', group: 'Teaching', aliases: ['B.El.Ed', 'Bachelor of Elementary Education'] },
  { code: 'DED_SPECIAL_EDUCATION', label: 'Diploma in Special Education (RCI)', group: 'Teaching', aliases: ['D.Ed Special Education', 'D.Ed. (Special Education)', 'RCI Diploma'] },
  { code: 'BED', label: 'B.Ed', group: 'Teaching', aliases: ['B.Ed', 'B.Ed.', 'Bachelor of Education'] },
  { code: 'LT_TRAINING', label: 'L.T. training diploma', group: 'Teaching', aliases: ['LT', 'L.T.', 'L.T. Diploma', 'Licentiate in Teaching'] },
  { code: 'CTET_PAPER_1', label: 'CTET Paper I (classes 1-5)', group: 'Teacher eligibility test', aliases: ['CTET Paper 1', 'CTET Primary', 'CTET-I'] },
  { code: 'CTET_PAPER_2', label: 'CTET Paper II (classes 6-8)', group: 'Teacher eligibility test', aliases: ['CTET Paper 2', 'CTET Upper Primary', 'CTET-II'] },
  { code: 'UPTET_PRIMARY', label: 'UPTET primary level (classes 1-5)', group: 'Teacher eligibility test', aliases: ['UPTET Primary', 'UPTET Paper 1', 'UP TET Primary'] },
  { code: 'UPTET_UPPER_PRIMARY', label: 'UPTET upper primary level (classes 6-8)', group: 'Teacher eligibility test', aliases: ['UPTET Upper Primary', 'UPTET Paper 2', 'UP TET Upper Primary'] },
  { code: 'DRIVING_LICENCE_HMV', label: 'Heavy motor vehicle driving licence', group: 'Driving licence', aliases: ['HMV', 'HMV Licence', 'HMV License', 'Heavy Vehicle Driving Licence', 'Heavy Motor Vehicle Licence', 'HTV', 'Transport Vehicle Licence'] },
  { code: 'DRIVING_LICENCE_LMV', label: 'Light motor vehicle (car) driving licence', group: 'Driving licence', aliases: ['LMV', 'LMV Licence', 'LMV License', 'Car Driving Licence', 'Four Wheeler Licence'] },
  { code: 'DRIVING_LICENCE_MCWG', label: 'Two-wheeler (motorcycle with gear) licence', group: 'Driving licence', aliases: ['MCWG', 'Two Wheeler Licence', 'Motorcycle Licence'] },
  { code: 'CPCT', label: 'CPCT scorecard', group: 'Computer and typing', aliases: ['CPCT Scorecard', 'CPCT Certificate'] },
  { code: 'CCC', label: 'NIELIT CCC', group: 'Computer and typing', aliases: ['CCC Certificate', 'Course on Computer Concepts', 'DOEACC CCC', 'NIELIT CCC'] },
  { code: 'O_LEVEL', label: 'NIELIT O Level', group: 'Computer and typing', aliases: ['O Level', 'DOEACC O Level', 'NIELIT O Level'] },
  { code: 'HINDI_TYPING', label: 'Hindi typing', group: 'Computer and typing', aliases: ['Hindi Typing Certificate'] },
  { code: 'ENGLISH_TYPING', label: 'English typing', group: 'Computer and typing', aliases: ['English Typing Certificate'] },
  { code: 'UPSSSC_PET_2025', label: 'UPSSSC PET-2025 scorecard', group: 'Recruitment test', aliases: ['PET 2025', 'PET-2025', 'UPSSSC PET 2025', 'Preliminary Eligibility Test 2025'] },
  { code: 'NIS_COACHING_DIPLOMA', label: 'Coaching diploma (NIS Patiala or equivalent)', group: 'Sports and NCC', aliases: ['NIS Diploma', 'NSNIS Diploma', 'Diploma in Sports Coaching', 'NIS Coaching Diploma'] },
  { code: 'NCC_B', label: 'NCC B certificate', group: 'Sports and NCC', aliases: ['NCC B', 'NCC B Certificate'] },
  { code: 'NCC_C', label: 'NCC C certificate', group: 'Sports and NCC', aliases: ['NCC C', 'NCC C Certificate'] },
];

/** Degree subjects with spellings that do not contain each other ("LLB" never contains "law"). */
export const STREAM_ALIASES: Record<string, string[]> = {
  LAW: ['law', 'llb', 'l.l.b', 'bachelor of laws', 'b.l', 'legal studies'],
  EDUCATION: ['education', 'pedagogy', 'shiksha shastra'],
  PHYSICAL_EDUCATION: ['physical education', 'b.p.ed', 'm.p.ed', 'bped', 'mped'],
  COMMERCE: ['commerce', 'b.com', 'm.com', 'accounts', 'accountancy'],
  COMPUTER_SCIENCE: ['computer science', 'computer application', 'information technology', 'bca', 'mca', 'it'],
  BIOLOGY: ['biology', 'zoology', 'botany', 'life science'],
  FINE_ARTS: ['fine arts', 'drawing', 'painting', 'drawing and painting', 'bfa', 'mfa'],
  HOME_SCIENCE: ['home science', 'family and community science'],
  MILITARY_SCIENCE: ['military science', 'defence studies', 'defence and strategic studies'],
  CIVICS: ['civics', 'political science'],
  MUSIC: ['music', 'music vocal', 'music instrumental'],
};

/** Fold "B.Ed.", "b ed" and "BEd" to "bed". */
const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

const CERT_INDEX = new Map<string, string>(
  CERTIFICATES.flatMap(c => [c.code, c.label, ...c.aliases].map(a => [fold(a), c.code] as [string, string])),
);
const STREAM_INDEX = new Map<string, string>(
  Object.entries(STREAM_ALIASES).flatMap(([code, names]) => [code, ...names].map(n => [fold(n), code] as [string, string])),
);

export const CERTIFICATE_CODES: readonly string[] = CERTIFICATES.map(c => c.code);

/** The catalogue code for a certificate name or code, or null when it is not in the list. */
export function certificateCode(name: string): string | null {
  return CERT_INDEX.get(fold(name)) ?? null;
}

/** What a certificate name is compared by: its catalogue code, or its folded text when it is not in the list. */
export function credentialKey(name: string): string {
  return certificateCode(name) ?? `text:${fold(name)}`;
}

/** A requirement entry ("DELED|BELED") as the set of acceptable keys (any one is enough). */
export function requirementOptions(entry: string): string[] {
  return entry.split('|').map(part => part.trim()).filter(Boolean).map(credentialKey);
}

/** Readable form of a requirement entry: "D.El.Ed / BTC or B.El.Ed (4-year)". */
export function requirementLabel(entry: string): string {
  return entry.split('|').map(part => part.trim()).filter(Boolean)
    .map(part => CERTIFICATES.find(c => c.code === certificateCode(part))?.label ?? part).join(' or ');
}

/** The parts of a requirement entry that are not catalogue codes (empty when every part is a known code). */
export function unknownRequirementParts(entry: string): string[] {
  return entry.split('|').map(part => part.trim()).filter(part => !CERTIFICATE_CODES.includes(part));
}

/** The canonical subject for a stream name, or null when the name has no known alias. */
export function streamCode(name: string): string | null {
  return STREAM_INDEX.get(fold(name)) ?? null;
}

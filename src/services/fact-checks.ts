/**
 * Mechanical checks of a proposal's values against the quotes that back them. No model judgement and no self-rated
 * confidence: a number or date either appears in its quote or it does not. Fields a machine cannot compare (summaries,
 * enums, yes/no, links) are reported as needing a human read, never as passed.
 *
 * Admin-only: the result is shown in /admin/pending-changes. It is never shown publicly.
 * Pure functions, no imports of writers (the MCP bundles this through change-proposals.ts).
 */
import { INDIA_JURISDICTIONS } from '../data/india-jurisdictions';

export type FieldCheckStatus = 'MATCHES_QUOTE' | 'NOT_IN_QUOTE' | 'NO_QUOTE' | 'NEEDS_READING';

export interface FieldCheck {
  field: string;
  status: FieldCheckStatus;
  /** Plain-language reason for the reviewer. */
  detail: string;
  /** Read from a scanned image (method VISION / OCR), so the quote itself may be misread. */
  fromImage: boolean;
  /** The proposer marked the value as handwritten on the notice. */
  handwritten: boolean;
}

export interface FactCheckSummary {
  fields: FieldCheck[];
  /** Fields whose value was found in its quote. */
  matched: number;
  /** Every fact field (SEO copy and master ids excluded). */
  total: number;
  notInQuote: string[];
  needsReading: string[];
  fromImage: string[];
  handwritten: string[];
}

/** Evidence as stored on a proposal (only the parts the checks read). */
export interface CheckEvidence { field: string; snippet?: string; method?: string; handwritten?: boolean }

/** Not facts from the notice: editorial SEO copy and master ids. */
const NOT_FACTS = new Set(['seoTitle', 'seoDescription', 'postId', 'organisationId']);
const NUMBER_FIELDS = new Set([
  'totalVacancies', 'cycleYear', 'minAge', 'maxAgeGeneral', 'ageRelaxationScSt', 'ageRelaxationObc', 'ageRelaxationFemale', 'ageRelaxationEws',
  'minHeightMaleCm', 'minHeightFemaleCm', 'minChestMaleCm', 'minPercentageRequired',
]);
const RELAXATION_FIELDS = new Set(['ageRelaxationScSt', 'ageRelaxationObc', 'ageRelaxationFemale', 'ageRelaxationEws']);
/** "पूर्ण न की हो", "पूरी न की हो", "not have completed", "not attained": the limit itself is excluded. */
const NOT_COMPLETED = /(पूर्ण|पूरी)\s*(न|नहीं)(?=[\s,।.]|$)|not\s+(have\s+)?(completed|attained)/i;
const DATE_FIELDS = new Set(['applicationStart', 'applicationEnd', 'examDate', 'ageCutoffDate']);
const EXACT_TEXT_FIELDS = new Set(['advtNumber']);

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** Hindi month names after folding nukta and "म्ब" -> "ंब" (सितम्बर = सितंबर). */
const HI_MONTHS: Record<string, number> = {
  'जनवरी': 1, 'फरवरी': 2, 'मार्च': 3, 'अप्रैल': 4, 'अप्रेल': 4, 'मई': 5, 'जून': 6, 'जुलाई': 7, 'अगस्त': 8,
  'सितंबर': 9, 'अक्टूबर': 10, 'अक्तूबर': 10, 'नवंबर': 11, 'दिसंबर': 12,
};
const monthOf = (w: string) =>
  /^[a-z]/.test(w) ? MONTHS.indexOf(w.slice(0, 3)) + 1 : HI_MONTHS[w.replace(/़/g, '').replace(/म्ब/g, 'ंब')] ?? 0;

/** Devanagari and other Indic digits to ASCII, so "०१/२०२६" compares like "01/2026". */
export function asciiDigits(s: string): string {
  return s.replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x0966)) // Devanagari
    .replace(/[০-৯]/g, d => String(d.charCodeAt(0) - 0x09e6)) // Bengali
    .replace(/[૦-૯]/g, d => String(d.charCodeAt(0) - 0x0ae6)) // Gujarati
    .replace(/[੦-੯]/g, d => String(d.charCodeAt(0) - 0x0a66)); // Gurmukhi
}

/** Every number written in the text: digit runs ("06" -> 6, "26.10.26" -> 26, 10, 26), grouped ("7,500"), decimals ("79.5") and words. */
export function numbersIn(text: string): number[] {
  const t = asciiDigits(text);
  const runs = [...t.matchAll(/\d+/g)].map(m => Number(m[0]));
  const grouped = [...t.matchAll(/\d{1,3}(?:,\d{2,3})+/g)].map(m => Number(m[0].replace(/,/g, '')));
  const decimals = [...t.matchAll(/\d+\.\d+/g)].map(m => Number(m[0]));
  return [...runs, ...grouped, ...decimals, ...wordNumbers(t)];
}

// Notices often spell numbers out ("not more than sixty years", "पैंतीस वर्ष"). Only whole words count, and an unknown
// spelling simply fails the check (the value is refused), so a gap here can never let a wrong value through.
const EN_UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const EN_TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const HI_1_TO_100 = [
  'एक', 'दो', 'तीन', 'चार', 'पांच', 'छह', 'सात', 'आठ', 'नौ', 'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस', 'बीस',
  'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस', 'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अडतीस', 'उनतालीस', 'चालीस',
  'इकतालीस', 'बयालीस', 'तैंतालीस', 'चौवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अडतालीस', 'उनचास', 'पचास', 'इक्यावन', 'बावन', 'तिरपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ', 'साठ',
  'इकसठ', 'बासठ', 'तिरसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सडसठ', 'अडसठ', 'उनहत्तर', 'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उन्यासी', 'अस्सी',
  'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी', 'नब्बे', 'इक्यानबे', 'बानबे', 'तिरानबे', 'चौरानबे', 'पंचानबे', 'छियानबे', 'सत्तानबे', 'अट्ठानबे', 'निन्यानबे', 'सौ',
];
/** Fold common spelling variants: nukta (ड़ -> ड), chandrabindu (ँ -> ं), half-n (न्द -> ंद), visarga form of six. */
const hiFold = (w: string) => w.replace(/़/g, '').replace(/ँ/g, 'ं').replace(/न्(?=[दतथधट])/g, 'ं').replace(/^छः$|^छे$/, 'छह');
const HI_WORDS: Record<string, number> = Object.fromEntries(HI_1_TO_100.map((w, i) => [hiFold(w), i + 1]));
const HUNDRED = new Set(['hundred', 'सौ']);
const THOUSAND = new Set(['thousand', hiFold('हज़ार'), 'हजार']);

/** Numbers spelt out in English or Hindi, combining "thirty five", "thirty-five", "one hundred", "पाँच सौ", "दो हजार". */
export function wordNumbers(text: string): number[] {
  const out: number[] = [];
  let total = 0, current = 0, active = false;
  const flush = () => { if (active) out.push(total + current); total = 0; current = 0; active = false; };
  for (const raw of text.toLowerCase().match(/[a-z]+|[ऀ-ॣ०-ॿ]+/g) ?? []) {
    const w = /[a-z]/.test(raw) ? raw : hiFold(raw);
    const unit = EN_UNITS[w] ?? (w !== hiFold('सौ') ? HI_WORDS[w] : undefined);
    const tens = EN_TENS[w];
    if (unit !== undefined) {
      if (active && current % 100 !== 0 && (unit >= 10 || current % 10 !== 0)) flush(); // "five six" is two numbers; "एक सौ पच्चीस" is 125
      current += unit; active = true;
    } else if (tens !== undefined) {
      if (active && current % 100 !== 0) flush();
      current += tens; active = true;
    } else if (HUNDRED.has(w)) {
      current = (current || 1) * 100; active = true;
    } else if (THOUSAND.has(w)) {
      total += (current || 1) * 1000; current = 0; active = true;
    } else if (w === 'and' && active) {
      continue;
    } else flush();
  }
  flush();
  return out;
}

const iso = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y < 100 ? 2000 + y : y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null);

/**
 * Every date written in the text, as ISO: 10.10.2026, 10/10/26, 2026-10-10, 10 October 2026, October 10, 2026,
 * 01 जुलाई, 2026, and day lists sharing a month ("15 and 16 December 2026", "03 व 04 दिसम्बर, 2026" give both days).
 */
export function datesIn(text: string): string[] {
  const t = asciiDigits(text).toLowerCase();
  const out: Array<string | null> = [];
  for (const m of t.matchAll(/\b(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/g)) out.push(iso(+m[1], +m[2], +m[3]));
  for (const m of t.matchAll(/\b(\d{1,2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{4}|\d{2})\b/g)) out.push(iso(+m[3], +m[2], +m[1]));
  const dayList = /(?<!\d)(\d{1,2}(?:(?:st|nd|rd|th)?\s*(?:,|and|&|व|एवं|और|तथा)\s*\d{1,2})*)(?:st|nd|rd|th)?\s+([a-z]{3,9}|[ऀ-ॿ]+)\.?,?\s+(\d{4})\b/g;
  for (const m of t.matchAll(dayList)) {
    const month = monthOf(m[2]);
    if (month) for (const d of m[1].match(/\d{1,2}/g) ?? []) out.push(iso(+m[3], month, +d));
  }
  for (const m of t.matchAll(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/g)) if (monthOf(m[1])) out.push(iso(+m[3], monthOf(m[1]), +m[2]));
  return out.filter((d): d is string => !!d);
}

const squash = (s: string) => asciiDigits(s).toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '');

function checkValue(field: string, value: unknown, quotes: string[], payload: Record<string, unknown>, matched: Set<string>): { status: FieldCheckStatus; detail: string } {
  const all = quotes.join(' \n ');
  if (NUMBER_FIELDS.has(field) && typeof value === 'number') {
    if (numbersIn(all).includes(value)) return { status: 'MATCHES_QUOTE', detail: `${value} appears in the quote.` };
    // "must not have completed 40 years" allows 39 completed years, the value the engine compares.
    if (field === 'maxAgeGeneral' && NOT_COMPLETED.test(all) && numbersIn(all).includes(value + 1)) {
      return { status: 'MATCHES_QUOTE', detail: `The quote says the candidate must not have completed ${value + 1} years, so at most ${value} completed years.` };
    }
    // A relaxation is often printed as the relaxed limit ("SC/ST: 38 years" against a general 33).
    const base = payload.maxAgeGeneral;
    if (RELAXATION_FIELDS.has(field) && typeof base === 'number' && value > 0 && numbersIn(all).includes(base + value)) {
      return { status: 'MATCHES_QUOTE', detail: `The quote gives the relaxed limit ${base + value}, which is ${value} years above the general ${base}.` };
    }
    // A total is often printed only per category or area: accept it when it is exactly the sum of checked rows.
    if (field === 'totalVacancies' && matched.has('vacanciesBreakdown')) {
      const sum = (payload.vacanciesBreakdown as Array<{ count: number }>).reduce((a, v) => a + v.count, 0);
      if (sum === value) return { status: 'MATCHES_QUOTE', detail: `${value} is the sum of the vacancy rows, each found in its quote.` };
    }
    return { status: 'NOT_IN_QUOTE', detail: `${value} does not appear in the quote (numbers there: ${[...new Set(numbersIn(all))].slice(0, 12).join(', ') || 'none'}).` };
  }
  if (DATE_FIELDS.has(field) && typeof value === 'string') {
    const found = datesIn(all);
    return found.includes(value)
      ? { status: 'MATCHES_QUOTE', detail: `${value} appears in the quote.` }
      : { status: 'NOT_IN_QUOTE', detail: `${value} does not appear in the quote (dates there: ${[...new Set(found)].slice(0, 8).join(', ') || 'none'}).` };
  }
  if (EXACT_TEXT_FIELDS.has(field) && typeof value === 'string') {
    return squash(all).includes(squash(value))
      ? { status: 'MATCHES_QUOTE', detail: `"${value}" appears in the quote.` }
      : { status: 'NOT_IN_QUOTE', detail: `"${value}" does not appear in the quote.` };
  }
  if (field === 'vacanciesBreakdown' && Array.isArray(value)) {
    const nums = numbersIn(all);
    const missing = (value as Array<{ category?: string; count: number }>).filter(v => !nums.includes(v.count));
    return missing.length
      ? { status: 'NOT_IN_QUOTE', detail: `Count(s) not in the quotes: ${missing.map(v => `${v.category ?? '?'} ${v.count}`).join(', ')}.` }
      : { status: 'MATCHES_QUOTE', detail: 'Every count appears in the quotes. Check that each is under the right category.' };
  }
  if (field === 'importantDates' && Array.isArray(value)) {
    const found = datesIn(all);
    const missing = (value as Array<{ eventType: string; eventDate: string }>).filter(d => !found.includes(d.eventDate));
    return missing.length
      ? { status: 'NOT_IN_QUOTE', detail: `Date(s) not in the quotes: ${missing.map(d => `${d.eventType} ${d.eventDate}`).join(', ')}.` }
      : { status: 'MATCHES_QUOTE', detail: 'Every date appears in the quotes. Check that each is the right event.' };
  }
  if (field === 'postingPlaces' && Array.isArray(value)) {
    // PIN codes are compared; town names are not, since a Hindi or other-language quote prints them in its own script.
    const pins = (value as Array<{ postalCode?: string }>).map(p => p.postalCode).filter((p): p is string => !!p);
    const printed = new Set([...asciiDigits(all).matchAll(/(?<!\d)(\d{3})[\s-]?(\d{3})(?!\d)/g)].map(m => m[1] + m[2]));
    const missing = pins.filter(p => !printed.has(p));
    if (missing.length) return { status: 'NOT_IN_QUOTE', detail: `PIN code(s) not in the quotes: ${missing.join(', ')}.` };
    if (pins.length) return { status: 'MATCHES_QUOTE', detail: 'Every PIN code appears in the quotes. Read the town and address of each place against them.' };
  }
  return { status: 'NEEDS_READING', detail: 'Cannot be compared mechanically (summary, category, yes/no or link). Read it against the quote.' };
}

/** Check every fact field of a proposal against its quotes. */
export function checkFacts(payload: Record<string, unknown>, evidence: CheckEvidence[] | undefined): FactCheckSummary {
  const ev = evidence ?? [];
  const fields: FieldCheck[] = [];
  const matched = new Set<string>();
  // vacanciesBreakdown before totalVacancies, so a total can be accepted as the sum of checked rows.
  const order = Object.keys(payload).filter(f => !NOT_FACTS.has(f)).sort((a, b) => (a === 'vacanciesBreakdown' ? -1 : b === 'vacanciesBreakdown' ? 1 : 0));
  for (const field of order) {
    const items = ev.filter(e => e.field === field);
    const quotes = items.map(e => e.snippet ?? '').filter(Boolean);
    const fromImage = items.some(e => e.method === 'VISION' || e.method === 'OCR');
    const handwritten = items.some(e => e.handwritten === true);
    const base = { field, fromImage, handwritten };
    if (!quotes.length) { fields.push({ ...base, status: 'NO_QUOTE', detail: 'No quote from the official source.' }); continue; }
    const r = checkValue(field, payload[field], quotes, payload, matched);
    if (r.status === 'MATCHES_QUOTE') matched.add(field);
    fields.push({ ...base, ...r });
  }
  const pick = (f: (c: FieldCheck) => boolean) => fields.filter(f).map(c => c.field);
  return {
    fields,
    matched: matched.size,
    total: fields.length,
    notInQuote: pick(c => c.status === 'NOT_IN_QUOTE' || c.status === 'NO_QUOTE'),
    needsReading: pick(c => c.status === 'NEEDS_READING'),
    fromImage: pick(c => c.fromImage),
    handwritten: pick(c => c.handwritten),
  };
}

// --- Domicile clause (docs/designs/domicile-scope.md) -------------------------------------------------------------
// The word "domicile" in a notice usually means "bring a certificate to claim your quota", and the citizenship line
// is in every notice, locked or not. So a quote is classified by what its sentences say about candidates from other
// states, never by a keyword. Anything unclear is refused upstream: the row stays "Not checked yet".

export type DomicileClauseClass = 'STATE_ONLY' | 'OPEN_STATE_QUOTA' | 'OPEN' | 'UNCLEAR';

/** Shared with tests and the MCP docs. Latin and Devanagari only; other scripts classify as UNCLEAR. */
export const DOMICILE_PHRASES = {
  outsider: /candidates?\s+(?:of|from|belonging\s+to)\s+(?:any\s+)?other\s+states?|outside\s+the\s+state|other\s+than\s+(?:the\s+)?domiciles?|not\s+(?:a\s+)?(?:domiciles?|natives?|bona\s*fide\s+residents?)\s+of|अन्य\s*राज्य|अन्य\s*प्रदेश|(?:राज्य|प्रदेश)\s*के\s*बाहर|(?:मूल\s*निवासी|अधिवासी)\s*(?:\([^)]*\)\s*)?नहीं/i,
  // "Reserved posts are only for natives" limits a benefit, it does not bar outsiders. अनारक्षित (unreserved) is not आरक्षित.
  benefit: /reservation|relaxation|benefit\s+of|(?<!un)reserved\s+posts?|आरक्षण|(?<!अन)आरक्षित|छूट/i,
  // Outsiders allowed against unreserved posts only: they still apply, so this is a quota, not a lock.
  unreserved: /unreserved|अनारक्षित/i,
  bar: /\bonly\b|\bnot\s+eligible\b|shall\s+not\s+be\s+eligible|केवल|पात्र\s*नहीं/i,
  obligation: /\b(?:must|should|shall)\s+be\b|होना\s+(?:चाहिए|अनिवार्य)|होने\s+चाहिए/i,
  outsiderBar: /\bnot\s+eligible\b|shall\s+not\s+be\s+eligible|cannot\s+apply|can\s*not\s+apply|पात्र\s*नहीं/i,
  residence: /domicile|\bresidents?\b|bona\s*fide|\bnatives?\b|मूल\s*निवासी|निवासी|अधिवासी/i,
  exclusion: /certificate|प्रमाण\s*पत्र|(?:native|local|regional)\s+language|mother\s+tongue|स्थानीय\s+भाषा/i,
  genericState: /\b(?:the|this)\s+state\b|राज्य|प्रदेश/i,
  open: /(?:all|any)\s+indian\s+citizens?|any\s+citizen\s+of\s+india|all\s+citizens\s+of\s+india|सभी\s+भारतीय\s+नागरिक|candidates?\s+(?:of|from)\s+any\s+state|candidates?\s+(?:of|from)\s+other\s+states?\s+(?:may|can)\s+(?:also\s+)?apply|domicile\s+is\s+not\s+(?:required|necessary|mandatory)|(?:on\s+an?\s+)?all[\s-]india\s+basis|सभी\s+राज्यों\s+के\s+अभ्यर्थी/i,
};

/**
 * Sentences split on . ? । and line breaks, never on ; or , (a quota clause often joins its halves with ;). The dot of a
 * single capital initial ("M.P.", "U. P.") is not a sentence end.
 */
export function clauseSentences(text: string): string[] {
  return text.split(/(?:(?<!(?:^|[^A-Za-z])[A-Z])\.|[?।\n])+/).map(s => s.trim()).filter(Boolean);
}

/** How notices write a state besides its English name: old spellings and the Hindi name. Codes and "M.P." are derived. */
const STATE_ALIASES: Record<string, string[]> = {
  AP: ['आंध्र प्रदेश', 'आन्ध्र प्रदेश'], AR: ['अरुणाचल प्रदेश'], AS: ['असम'], BR: ['बिहार'],
  CG: ['Chattisgarh', 'Chhatisgarh', 'छत्तीसगढ़', 'छत्तीसगढ'], GA: ['गोवा'], GJ: ['गुजरात'], HR: ['हरियाणा'],
  HP: ['हिमाचल प्रदेश'], JH: ['झारखंड', 'झारखण्ड'], KA: ['कर्नाटक'], KL: ['केरल'], MP: ['मध्य प्रदेश', 'मध्यप्रदेश'],
  MH: ['महाराष्ट्र'], MN: ['मणिपुर'], ML: ['मेघालय'], MZ: ['मिजोरम', 'मिज़ोरम'], NL: ['नागालैंड', 'नगालैंड'],
  OD: ['Orissa', 'ओडिशा', 'उड़ीसा'], PB: ['पंजाब'], RJ: ['राजस्थान'], SK: ['सिक्किम'], TN: ['तमिलनाडु', 'तमिल नाडु'],
  TG: ['TS', 'तेलंगाना'], TR: ['त्रिपुरा'], UP: ['उत्तर प्रदेश', 'उत्तरप्रदेश'], UK: ['UA', 'Uttaranchal', 'उत्तराखंड', 'उत्तराखण्ड'],
  WB: ['पश्चिम बंगाल'], AN: ['अंडमान'], CH: ['चंडीगढ़'], DN: ['दादरा', 'दमण', 'दमन'], DL: ['NCT of Delhi', 'दिल्ली'],
  JK: ['J&K', 'J & K', 'जम्मू'], LA: ['लद्दाख'], LD: ['लक्षद्वीप'], PY: ['Pondicherry', 'पुडुचेरी'],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether a sentence names the state however a notice writes it: "Madhya Pradesh", "MP", "M.P.", "M. P.", "मध्य प्रदेश".
 * The two-letter code must be in capitals and stand alone, so "up to" or "mp3" never count. Null for Central or an unknown code.
 */
export function stateNameMatcher(stateCode?: string | null): ((s: string) => boolean) | null {
  const j = INDIA_JURISDICTIONS.find(x => x.code === stateCode?.toUpperCase());
  if (!j || j.code === 'IN') return null;
  const aliases = STATE_ALIASES[j.code] ?? [];
  // Whole words only, so Assam (असम) is not found inside असमर्थ.
  const names = new RegExp(`(?<![\\p{L}\\p{M}])(?:${[j.name, ...aliases].map(n => escapeRe(n).replace(/\s+/g, '\\s*')).join('|')})(?![\\p{L}\\p{M}])`, 'iu');
  const codes = [j.code, ...aliases.filter(a => /^[A-Z]{2}$/.test(a))].map(c => `${c[0]}\\.?\\s?${c[1]}\\.?`);
  const abbrev = new RegExp(`(?<![A-Za-z])(?:${codes.join('|')})(?![A-Za-z])`); // case-sensitive on purpose
  return s => names.test(s) || abbrev.test(s);
}

export interface DomicileClauseResult {
  classification: DomicileClauseClass;
  signals: string[];
  /** The lock sentence names the state itself (any spelling), not only "the State". */
  namesState: boolean;
}

/** What a quoted eligibility clause says about candidates from other states. */
export function classifyDomicileClause(snippet: string, stateCode?: string | null): DomicileClauseResult {
  const P = DOMICILE_PHRASES;
  const sentences = clauseSentences(snippet);
  const signals: string[] = [];
  const names = stateNameMatcher(stateCode) ?? (() => false);
  const refersToState = (s: string) => names(s) || P.genericState.test(s);

  let lock = false, quota = false, open = false, namesState = false;
  for (const s of sentences) {
    const outsider = P.outsider.test(s);
    const benefit = P.benefit.test(s);
    if (outsider && (benefit || P.unreserved.test(s))) { quota = true; signals.push('benefit limited, outsiders still apply'); continue; }
    if (P.exclusion.test(s)) { signals.push('certificate or language wording (never a lock)'); continue; }
    if (benefit) continue; // a bar on a benefit is not a bar on applying
    // "Must be a native of M.P." bars outsiders too, but only when it names the state: "must be a resident of the State" stays unclear.
    const bar = P.bar.test(s) || (P.obligation.test(s) && names(s));
    // "Candidates of other states may only apply for unreserved posts" is not a bar: outsiders need an explicit "not eligible".
    if ((bar && P.residence.test(s) && refersToState(s)) || (outsider && P.outsiderBar.test(s))) { lock = true; namesState ||= names(s); signals.push('outsiders barred'); continue; }
    if (P.open.test(s)) { open = true; signals.push('other-state candidates may apply'); }
  }
  if (!sentences.length) signals.push('empty quote');
  const classification: DomicileClauseClass =
    lock && !quota ? 'STATE_ONLY'
      : quota && !lock ? 'OPEN_STATE_QUOTA'
        : open && !lock && !quota ? 'OPEN'
          : 'UNCLEAR';
  if (classification === 'UNCLEAR' && !signals.length) signals.push('no sentence about candidates from other states');
  if (lock && quota) signals.push('both a bar and a quota sentence');
  return { classification, signals, namesState };
}

/** One sentence per scope that passes, for refusal messages. */
export const DOMICILE_CLAUSE_EXAMPLES: Record<Exclude<DomicileClauseClass, 'UNCLEAR'>, string> = {
  STATE_ONLY: 'Only bona fide residents of the State are eligible to apply.',
  OPEN_STATE_QUOTA: 'Candidates of other states may apply but will not get the benefit of reservation.',
  OPEN: 'Candidates from other states may also apply.',
};

/**
 * Mechanical checks of a proposal's values against the quotes that back them. No model judgement and no self-rated
 * confidence: a number or date either appears in its quote or it does not. Fields a machine cannot compare (summaries,
 * enums, yes/no, links) are reported as needing a human read, never as passed.
 *
 * Admin-only: the result is shown in /admin/pending-changes and gates pipeline auto-publish. It is never shown publicly.
 * Pure functions, no imports of writers (the MCP bundles this through change-proposals.ts).
 */

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
  /** The quote was found in the document text by the pipeline (HTML pages only). */
  quoteInDocument: boolean;
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
const DATE_FIELDS = new Set(['applicationStart', 'applicationEnd', 'examDate', 'ageCutoffDate']);
const EXACT_TEXT_FIELDS = new Set(['advtNumber']);

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Devanagari and other Indic digits to ASCII, so "०१/२०२६" compares like "01/2026". */
export function asciiDigits(s: string): string {
  return s.replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x0966)) // Devanagari
    .replace(/[০-৯]/g, d => String(d.charCodeAt(0) - 0x09e6)) // Bengali
    .replace(/[૦-૯]/g, d => String(d.charCodeAt(0) - 0x0ae6)) // Gujarati
    .replace(/[੦-੯]/g, d => String(d.charCodeAt(0) - 0x0a66)); // Gurmukhi
}

/** Every number written in the text: digit runs ("06" -> 6, "26.10.26" -> 26, 10, 26), grouped ("7,500") and decimals ("79.5"). */
export function numbersIn(text: string): number[] {
  const t = asciiDigits(text);
  const runs = [...t.matchAll(/\d+/g)].map(m => Number(m[0]));
  const grouped = [...t.matchAll(/\d{1,3}(?:,\d{2,3})+/g)].map(m => Number(m[0].replace(/,/g, '')));
  const decimals = [...t.matchAll(/\d+\.\d+/g)].map(m => Number(m[0]));
  return [...runs, ...grouped, ...decimals];
}

const iso = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y < 100 ? 2000 + y : y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null);

/** Every date written in the text, as ISO: 10.10.2026, 10/10/26, 2026-10-10, 10 October 2026, October 10, 2026. */
export function datesIn(text: string): string[] {
  const t = asciiDigits(text).toLowerCase();
  const out: Array<string | null> = [];
  for (const m of t.matchAll(/\b(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/g)) out.push(iso(+m[1], +m[2], +m[3]));
  for (const m of t.matchAll(/\b(\d{1,2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{4}|\d{2})\b/g)) out.push(iso(+m[3], +m[2], +m[1]));
  const month = (w: string) => MONTHS.indexOf(w.slice(0, 3)) + 1;
  for (const m of t.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+(\d{4})\b/g)) if (month(m[2])) out.push(iso(+m[3], month(m[2]), +m[1]));
  for (const m of t.matchAll(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/g)) if (month(m[1])) out.push(iso(+m[3], month(m[1]), +m[2]));
  return out.filter((d): d is string => !!d);
}

const squash = (s: string) => asciiDigits(s).toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '');

function checkValue(field: string, value: unknown, quotes: string[], payload: Record<string, unknown>, matched: Set<string>): { status: FieldCheckStatus; detail: string } {
  const all = quotes.join(' \n ');
  if (NUMBER_FIELDS.has(field) && typeof value === 'number') {
    if (numbersIn(all).includes(value)) return { status: 'MATCHES_QUOTE', detail: `${value} appears in the quote.` };
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
  return { status: 'NEEDS_READING', detail: 'Cannot be compared mechanically (summary, category, yes/no or link). Read it against the quote.' };
}

/**
 * Check every fact field of a proposal. `quoteInDocument` lists fields whose quote a trusted caller (the pipeline, HTML only)
 * found in the document text; the MCP cannot set it.
 */
export function checkFacts(payload: Record<string, unknown>, evidence: CheckEvidence[] | undefined, quoteInDocument: string[] = []): FactCheckSummary {
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
    const base = { field, fromImage, handwritten, quoteInDocument: quoteInDocument.includes(field) };
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

/** True only when every fact was found in its quote and every quote was found in the document text (pipeline auto-publish gate). */
export const fullyMachineChecked = (s: FactCheckSummary) =>
  s.total > 0 && s.fields.every(c => c.status === 'MATCHES_QUOTE' && c.quoteInDocument && !c.fromImage && !c.handwritten);

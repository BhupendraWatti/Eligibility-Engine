// src/services/seo.ts: search titles, descriptions and keywords for public pages, and for the
// seoTitle / seoDescription the MCP fills on a proposal. One place, so the site and the MCP
// choose keywords the same way.
//
// How keywords are picked: a state recruitment leads with that state ("Assam govt jobs",
// "Assam govt job vacancy") so it reaches people searching for jobs in that state, then adds the
// national terms ("government jobs 2026", "latest govt jobs") so it also shows up for
// all-India searches. A central recruitment leads with "central government jobs".
// The qualification adds "government jobs after 12th" and similar. Nothing is added that the
// record does not support.

import { jurisdictionName } from '../data/india-jurisdictions';

export const SITE_NAME = 'GovtRecruitments';
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** Current year in India (IST), for "government jobs 2026" style keywords. */
export function currentYear(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(now));
}

/** Cut at a word boundary so a title or description never ends mid-word. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

const isCentral = (stateCode?: string | null) => !stateCode || stateCode.toUpperCase() === 'IN';

/** Plain name of a state for keywords; null for central or unknown codes. */
export function stateKeywordName(stateCode?: string | null): string | null {
  if (isCentral(stateCode)) return null;
  const name = jurisdictionName(stateCode!.toUpperCase());
  return name && name !== stateCode ? name : null;
}

const QUALIFICATION_KEYWORD: Record<string, string> = {
  '7TH': 'government jobs after 8th',
  '8TH': 'government jobs after 8th',
  '10TH': 'government jobs after 10th',
  '12TH': 'government jobs after 12th',
  ITI: 'government jobs for ITI',
  DIPLOMA: 'government jobs for diploma holders',
  GRADUATION: 'government jobs for graduates',
  POST_GRADUATION: 'government jobs for post graduates',
};

const QUALIFICATION_SHORT: Record<string, string> = {
  '7TH': '7th pass', '8TH': '8th pass', '10TH': '10th pass', '12TH': '12th pass', ITI: 'ITI',
  DIPLOMA: 'diploma', GRADUATION: 'graduate', POST_GRADUATION: 'post graduate',
};

export interface RecruitmentSeoInput {
  title: string;
  postTitle?: string | null;
  organisationShortName?: string | null;
  stateCode?: string | null;
  totalVacancies?: number | null;
  minQualificationLevel?: string | null;
  cycleYear?: number | null;
  applicationEnd?: string | null;
}

export interface SeoMeta {
  title: string;
  description: string;
  keywords: string[];
}

function formatDay(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/** The year a recruitment belongs to: its cycle year, else its last date, else this year. */
function recruitmentYear(input: RecruitmentSeoInput): number {
  if (input.cycleYear && input.cycleYear > 2000) return input.cycleYear;
  const end = input.applicationEnd ? new Date(input.applicationEnd) : null;
  return end && !isNaN(end.getTime()) ? end.getUTCFullYear() : currentYear();
}

/** Title, description and keywords for one recruitment page. */
export function recruitmentSeo(input: RecruitmentSeoInput): SeoMeta {
  const state = stateKeywordName(input.stateCode);
  const year = recruitmentYear(input);
  const title = input.title.trim();
  const hasYear = title.includes(String(year));
  const qualification = input.minQualificationLevel ? QUALIFICATION_KEYWORD[input.minQualificationLevel] : undefined;
  const qualificationShort = input.minQualificationLevel ? QUALIFICATION_SHORT[input.minQualificationLevel] : undefined;
  const posts = input.totalVacancies && input.totalVacancies > 0 ? `${input.totalVacancies.toLocaleString('en-IN')} posts` : null;
  const lastDate = formatDay(input.applicationEnd);

  // Title: the notice's own name first (that is what people type), then the location keyword.
  // When that is too long, the location and year go first so they are never the part cut off.
  const tail = state ? `${state} Govt Job` : 'Central Govt Job';
  const short = `${title} – ${tail}${hasYear ? '' : ` ${year}`}`;
  const seoTitle = short.length <= TITLE_MAX + 5
    ? short
    : clip(`${tail} ${year}: ${title.replace(String(year), ' ').replace(/\s+/g, ' ').trim()}`, TITLE_MAX + 18);

  // Description: the location phrase first, then plain facts a searcher wants.
  const where = state ? `${state} govt job vacancy ${year}` : `Central government job vacancy ${year}`;
  const facts = [posts, qualificationShort].filter(Boolean).join(', ');
  const parts = [
    `${where}: ${clip(title, 70)}${facts ? ` (${facts})` : ''}.`,
    lastDate ? `Last date ${lastDate}.` : '',
    'Check eligibility and the official link.',
  ].filter(Boolean);
  // Drop the closing sentence before cutting anything mid-sentence.
  const full = parts.join(' ');
  const description = full.length <= DESCRIPTION_MAX ? full : clip(parts.slice(0, -1).join(' '), DESCRIPTION_MAX);

  const keywords = [
    ...(state
      ? [`${state} govt jobs`, `${state} govt job vacancy`, `${state} government jobs ${year}`]
      : ['central government jobs', `central govt jobs ${year}`]),
    input.postTitle ? `${input.postTitle} recruitment ${year}` : null,
    input.organisationShortName ? `${input.organisationShortName} recruitment ${year}` : null,
    qualification ?? null,
    `government jobs ${year}`,
    'govt jobs',
    'latest govt jobs',
  ].filter((k): k is string => Boolean(k));

  return { title: seoTitle, description, keywords: [...new Set(keywords.map(k => k.toLowerCase()))] };
}

/** /jobs filtered to one state (or to central): "{State} Govt Jobs {year}". */
export function stateListingSeo(stateCode: string, year: number = currentYear()): SeoMeta {
  const state = stateKeywordName(stateCode);
  if (!state) {
    return {
      title: `Central Government Jobs ${year} – All India Govt Jobs`,
      description: `Latest central government jobs ${year}: SSC, UPSC, railway, bank, defence and other all India govt job vacancy. Check eligibility, last date and the official apply link.`,
      keywords: ['central government jobs', `central govt jobs ${year}`, 'all india govt jobs', `government jobs ${year}`, 'govt job vacancy'],
    };
  }
  return {
    title: clip(`${state} Govt Jobs ${year} – Latest ${state} Govt Job Vacancy`, TITLE_MAX + 10),
    description: clip(`${state} govt jobs ${year}: every current ${state} government job vacancy, with eligibility, last date and the official apply link.`, DESCRIPTION_MAX),
    keywords: [`${state} govt jobs`, `${state} govt job vacancy`, `${state} government jobs ${year}`, `${state} sarkari naukri`, `government jobs ${year}`, 'govt jobs'].map(k => k.toLowerCase()),
  };
}

/** The home page. */
export function homeSeo(year: number = currentYear()): SeoMeta {
  return {
    title: `Government Jobs ${year} – Central & All State Govt Jobs`,
    description: `Latest government jobs ${year} from central and all state govt jobs in India. See every govt job vacancy, check your eligibility for free and apply on the official site.`,
    keywords: [
      'government jobs', `government jobs ${year}`, 'govt jobs', 'central government jobs', 'all government jobs',
      'all state government jobs', 'govt jobs recruitment', 'govt job vacancy', 'government jobs after 12th',
      'high package government jobs', 'latest govt jobs',
    ],
  };
}

/**
 * JobPosting `baseSalary` from the notice's own pay text ("Rs 35,400 - 1,12,400 (Level 6)").
 * Indian pay scales are monthly, so the unit is MONTH. Several ranges ("Level 5 / Level 6") become
 * one range from the lowest to the highest. Null when the text gives no rupee amount, or names another
 * period or unit (annum, year, day, hour, lakh, LPA, crore), so nothing is guessed.
 */
export function noticeBaseSalary(payText?: string | null) {
  const text = payText?.trim();
  if (!text || /annum|annual|year|\bp\.\s?a\b|\bday|daily|hour|week|lakh|lac\b|lpa|crore/i.test(text)) return null;
  const rupee = String.raw`(?:\b(?:rs\.?|inr)|₹)\s*`;
  const amount = (s: string) => Number(s.replace(/,/g, ''));
  const values: number[] = [];
  for (const m of text.matchAll(new RegExp(String.raw`${rupee}(\d[\d,]*)(?:\s*(?:-|–|—|to)\s*(?:${rupee})?(\d[\d,]*))?`, 'gi'))) {
    values.push(amount(m[1]));
    if (m[2]) values.push(amount(m[2]));
  }
  if (!values.length || values.some(v => !Number.isFinite(v) || v <= 0)) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    '@type': 'MonetaryAmount',
    currency: 'INR',
    value: min === max
      ? { '@type': 'QuantitativeValue', value: min, unitText: 'MONTH' }
      : { '@type': 'QuantitativeValue', minValue: min, maxValue: max, unitText: 'MONTH' },
  };
}

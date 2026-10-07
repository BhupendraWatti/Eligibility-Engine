/**
 * Cadre Guide: the public page for one master post (`/posts/[slug]`).
 *
 * Every fact on the guide comes from a PUBLISHED recruitment for that post and names the notice and
 * official document it came from. Because recruitments only change through admin edits or approved
 * MCP proposals, the guide updates itself whenever they do.
 *
 * Never shown: master-post defaults (pay, age, qualification), which nobody verified against a notice,
 * and the eligibility table's defaulted numbers (min age 18, relaxations 5/3/5), which cannot be told
 * apart from values the notice actually stated. Relaxations are shown only as the notice's own text.
 * When no notice exists the guide says so instead of guessing.
 */
import type { RecruitmentWithDetails } from '../db/queries';
import { jurisdictionName } from '../data/india-jurisdictions';
import { getLifecyclePresentation, isActiveDrive, isUpcomingDrive, resolveRecruitmentLifecycle } from './lifecycle';

export interface GuideLink {
  label: string;
  url: string;
}

export interface GuideNotice {
  id: string;
  title: string;
  slug: string;
  cycleYear: number;
  totalVacancies: number;
  organisationShortName: string;
  stateName: string | null;
  statusLabel: string;
  statusBadgeClass: string;
  applicationStart: string | null;
  applicationEnd: string | null;
  examDate: string | null;
  isLive: boolean;
  isUpcoming: boolean;
}

export interface GuideSource {
  title: string;
  url: string;
  publishedOn: string | null;
}

/** What the newest published notice for this post required, with its provenance. */
export interface GuideFacts {
  notice: GuideNotice;
  sources: GuideSource[];
  lastVerifiedAt: Date | null;
  qualificationLevel: string;
  qualificationDetails: string | null;
  qualificationByCategory: string | null;
  maxAgeGeneral: number;
  ageCutoffDate: string | null;
  relaxationNotes: string | null;
  pay: string | null;
  requirements: string[];
  specialConditions: string | null;
  selectionStages: Array<{ name: string; desc: string; isQualifying?: boolean }>;
  syllabusLinks: GuideLink[];
  applyLink: GuideLink | null;
}

export interface PrepStep {
  id: 'apply' | 'opens' | 'qualification' | 'requirements' | 'stages' | 'read-notice' | 'watch' | 'eligibility' | 'come-back';
  title: string;
  body: string;
  links: GuideLink[];
}

export interface CadreGuide {
  live: GuideNotice[];
  upcoming: GuideNotice[];
  past: GuideNotice[];
  facts: GuideFacts | null;
  steps: PrepStep[];
}

export interface HiringBody {
  name: string;
  shortName: string;
  websiteUrl: string | null;
}

const QUALIFICATION_LABELS: Record<string, string> = {
  '7TH': 'Class 7 pass',
  '8TH': 'Class 8 pass',
  '10TH': 'Class 10 pass',
  '12TH': 'Class 12 pass',
  DIPLOMA: 'Diploma',
  GRADUATION: 'Graduation',
  POST_GRADUATION: 'Post-graduation',
};

export const qualificationLabel = (level: string): string => QUALIFICATION_LABELS[level] ?? level.replace(/_/g, ' ');

/** '2026-10-06' -> '6 Oct 2026'. Anything unparseable is returned as given, never invented. */
export function formatGuideDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function toNotice(r: RecruitmentWithDetails, referenceDate?: Date | string): GuideNotice {
  const presentation = getLifecyclePresentation(resolveRecruitmentLifecycle(r, referenceDate));
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    cycleYear: r.cycleYear,
    totalVacancies: r.totalVacancies,
    organisationShortName: r.organisationShortName,
    stateName: r.stateName ?? null,
    statusLabel: presentation.label,
    statusBadgeClass: presentation.badgeClass,
    applicationStart: r.applicationStart ?? null,
    applicationEnd: r.applicationEnd ?? null,
    examDate: r.examDate ?? null,
    isLive: isActiveDrive(r, referenceDate),
    isUpcoming: isUpcomingDrive(r, referenceDate),
  };
}

/** Newest first: cycle year, then application start. Input order (newest created first) breaks ties. */
function newestFirst(a: RecruitmentWithDetails, b: RecruitmentWithDetails): number {
  if (a.cycleYear !== b.cycleYear) return b.cycleYear - a.cycleYear;
  return (b.applicationStart ?? '').localeCompare(a.applicationStart ?? '');
}

function requirementsOf(r: RecruitmentWithDetails): string[] {
  const c = r.criteria;
  const out: string[] = [];
  if (c.domicileStateCode || c.requiresMpDomicile) {
    // Mirrors the engine: the legacy MP flag means MP when no state code is stored.
    out.push(`Domicile certificate of ${jurisdictionName(c.domicileStateCode || 'MP')}`);
  }
  if (c.requiresMpEmploymentReg) out.push('Live employment office registration');
  if (c.requiresCpct) out.push('CPCT certificate');
  if (c.genderAllowed === 'MALE') out.push('Open to men only');
  if (c.genderAllowed === 'FEMALE') out.push('Open to women only');
  if (c.minHeightMaleCm) out.push(`Minimum height (men): ${c.minHeightMaleCm} cm`);
  if (c.minHeightFemaleCm) out.push(`Minimum height (women): ${c.minHeightFemaleCm} cm`);
  if (c.minChestMaleCm) out.push(`Minimum chest (men): ${c.minChestMaleCm} cm`);
  if (c.minPercentageRequired) out.push(`At least ${c.minPercentageRequired}% in the qualifying exam`);
  if (c.experienceMonths && c.experienceMonths > 0) out.push(`${c.experienceMonths} months of experience`);
  for (const skill of c.additionalSkills ?? []) out.push(skill);
  return out;
}

const isSyllabusLink = (type: string) => /SYLLABUS/i.test(type);
const isApplyLink = (type: string) => /APPLY/i.test(type);

/** The page where candidates fill the form, never a notice or rulebook PDF; null when the notice gives none. */
export function findApplyLink<L extends { linkType: string; url: string; isActive?: number | null }>(links: L[] | null | undefined): L | null {
  return (links ?? []).find(l => l.isActive !== 0 && isApplyLink(l.linkType) && !/\.pdf([?#]|$)/i.test(l.url)) ?? null;
}

function factsOf(r: RecruitmentWithDetails, referenceDate?: Date | string): GuideFacts {
  const sources = (r.sourcesList ?? []).map(s => ({ title: s.sourceTitle, url: s.sourceUrl, publishedOn: s.publicationDate ?? null }));
  const verifiedTimes = (r.sourcesList ?? [])
    .map(s => (s.lastVerifiedAt ? new Date(s.lastVerifiedAt).getTime() : 0))
    .filter(t => t > 0);
  const links = (r.officialLinksList ?? []).filter(l => l.isActive !== 0);
  const apply = findApplyLink(links);
  const byCategory = Object.entries(r.criteria.qualificationByCategory ?? {})
    .map(([category, level]) => `${category}: ${qualificationLabel(level)}`)
    .join(', ');

  return {
    notice: toNotice(r, referenceDate),
    sources,
    lastVerifiedAt: verifiedTimes.length ? new Date(Math.max(...verifiedTimes)) : null,
    qualificationLevel: qualificationLabel(r.criteria.minQualificationLevel),
    qualificationDetails: r.criteria.qualificationDetailsMarkdown?.trim() || null,
    qualificationByCategory: byCategory || null,
    maxAgeGeneral: r.criteria.maxAgeGeneral,
    ageCutoffDate: r.criteria.ageCutoffDate || null,
    relaxationNotes: r.criteria.relaxationNotesMarkdown?.trim() || null,
    // Only the notice's own pay. The mapper's payScale falls back to the unverified master default.
    pay: r.payScaleOverride?.trim() || null,
    requirements: requirementsOf(r),
    specialConditions: r.criteria.specialConditionsNotes?.trim() || null,
    selectionStages: (r.selectionStages ?? []).filter(s => s?.name),
    syllabusLinks: links.filter(l => isSyllabusLink(l.linkType)).map(l => ({ label: l.title, url: l.url })),
    applyLink: apply ? { label: apply.title, url: apply.url } : null,
  };
}

function stepsOf(facts: GuideFacts | null, live: GuideNotice[], upcoming: GuideNotice[], hiringBody: HiringBody | null | undefined): PrepStep[] {
  const steps: PrepStep[] = [];
  const site: GuideLink[] = hiringBody?.websiteUrl ? [{ label: `${hiringBody.shortName || hiringBody.name} official website`, url: hiringBody.websiteUrl }] : [];

  if (!facts) {
    if (site.length) {
      steps.push({
        id: 'watch',
        title: 'Watch the official website',
        body: `Notices for this post are published by ${hiringBody!.name}.`,
        links: site,
      });
    }
    steps.push({
      id: 'come-back',
      title: 'Come back when a notice is verified',
      body: 'Once an official notice for this post is checked, its qualification, age limit, pay and exam stages appear on this page.',
      links: [],
    });
    return steps;
  }

  const year = facts.notice.cycleYear;
  const now = live[0];
  if (now) {
    steps.push({
      id: 'apply',
      title: now.applicationEnd ? `Apply by ${formatGuideDate(now.applicationEnd)}` : 'Applications are open',
      body: `${now.title} is taking applications now.`,
      links: [
        ...(facts.notice.id === now.id && facts.applyLink ? [facts.applyLink] : []),
        { label: 'View the full notice', url: `/recruitments/${now.slug}` },
      ],
    });
  } else if (upcoming[0]) {
    const next = upcoming[0];
    steps.push({
      id: 'opens',
      title: next.applicationStart ? `Applications open on ${formatGuideDate(next.applicationStart)}` : 'A notice is out',
      body: `${next.title} has been notified but is not taking applications yet.`,
      links: [{ label: 'View the full notice', url: `/recruitments/${next.slug}` }],
    });
  }

  steps.push({
    id: 'qualification',
    title: 'Check your qualification',
    body: `The ${year} notice asked for at least: ${facts.qualificationLevel}.${facts.qualificationDetails ? ' The full wording is in the notice summary above.' : ''}`,
    links: [],
  });

  if (facts.requirements.length) {
    steps.push({
      id: 'requirements',
      title: 'Get these ready early',
      body: `The ${year} notice required: ${facts.requirements.join('; ')}.`,
      links: [],
    });
  }

  if (facts.selectionStages.length) {
    const names = facts.selectionStages.map(s => s.name).join(', then ');
    steps.push({
      id: 'stages',
      title: 'Prepare for each stage',
      body: `The ${year} notice had ${facts.selectionStages.length} stage${facts.selectionStages.length === 1 ? '' : 's'}: ${names}.`,
      links: [],
    });
  }

  if (facts.sources.length || facts.syllabusLinks.length) {
    steps.push({
      id: 'read-notice',
      title: 'Read the official document',
      body: 'It is the final word on every rule, fee and date. This page only summarises it.',
      links: [...facts.syllabusLinks, ...facts.sources.map(s => ({ label: s.title, url: s.url }))],
    });
  }

  if (!now) {
    const window = facts.notice.applicationStart && facts.notice.applicationEnd
      ? ` The ${year} notice took applications from ${formatGuideDate(facts.notice.applicationStart)} to ${formatGuideDate(facts.notice.applicationEnd)}.`
      : '';
    steps.push({
      id: 'watch',
      title: 'Watch for the next notice',
      body: `New notices are published by ${hiringBody?.name ?? facts.notice.organisationShortName}.${window}`,
      links: site,
    });
  }

  if (now || upcoming[0]) {
    steps.push({
      id: 'eligibility',
      title: 'Check your eligibility',
      body: 'Answer a few questions to see if you meet this notice\'s age, qualification and domicile rules.',
      links: [{ label: 'Open the eligibility checker', url: '/eligibility-checker' }],
    });
  }

  return steps;
}

export function buildCadreGuide(input: {
  recruitments: RecruitmentWithDetails[];
  hiringBody?: HiringBody | null;
  referenceDate?: Date | string;
}): CadreGuide {
  const published = input.recruitments.filter(r => r.status === 'PUBLISHED').sort(newestFirst);
  const notices = published.map(r => toNotice(r, input.referenceDate));
  const live = notices.filter(n => n.isLive);
  const upcoming = notices.filter(n => n.isUpcoming);
  const past = notices.filter(n => !n.isLive && !n.isUpcoming);
  const facts = published[0] ? factsOf(published[0], input.referenceDate) : null;
  return { live, upcoming, past, facts, steps: stepsOf(facts, live, upcoming, input.hiringBody) };
}

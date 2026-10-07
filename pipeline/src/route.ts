/**
 * Turn one validated extraction into a decision. The pipeline NEVER writes live data: it queues proposals through the same
 * service the MCP uses (conflict guard, duplicate guard, evidence, stale guard), and an admin approves in /admin/pending-changes.
 * The single exception is the owner-controlled auto-publish setting (OFF by default): NEW recruitments only, and only when every
 * fact was found in its quote and every quote in the page text (fact-checks.ts). A model's own confidence never decides it.
 */
import { getAllActiveRecruitments, type RecruitmentWithDetails } from '../../src/db/queries';
import { approveProposal } from '../../src/services/change-proposal-decision';
import {
  createProposal, currentFieldValue, InvalidProposalError, previewProposal, ProposalBlockedError,
  type EvidenceItem, type ProposalInput,
} from '../../src/services/change-proposals';
import { detectDuplicates, type DuplicateCheckResult } from '../../src/services/duplicate-detector';
import { checkFacts, fullyMachineChecked } from '../../src/services/fact-checks';
import { resolveEntity } from '../../src/services/reference-data';
import type { Actor } from '../../src/services/recruitment-query';
import { newDraftsToday, type PipelineSettings, type SourceRow } from '../../src/services/pipeline-store';
import type { DocType, Extracted } from './extract';
import type { Validation } from './validate';

export const ACTOR: Actor = { id: 'pipeline', mode: 'PROPOSE' };

export interface RouteContext {
  d1: D1Database;
  runId: string;
  dryRun: boolean;
  settings: PipelineSettings;
  model: string;
  existing?: RecruitmentWithDetails[];
}

export interface Routed {
  status: 'PROPOSED' | 'AUTO_CREATED' | 'UNCHANGED' | 'INVALID' | 'INCOMPLETE' | 'AMBIGUOUS' | 'UNMATCHED' | 'UNSUPPORTED' | 'DEFERRED' | 'DRY_RUN';
  reason: string;
  proposalId?: string;
  preview?: unknown;
}

const LINK_TYPE: Partial<Record<DocType, string>> = { RECRUITMENT_NOTIFICATION: 'NOTIFICATION_PDF', CORRIGENDUM: 'NOTIFICATION_PDF', ADMIT_CARD: 'ADMIT_CARD', EXAM_CITY_SLIP: 'ADMIT_CARD', RESULT: 'RESULT', ANSWER_KEY: 'ANSWER_KEY', EXAM_SCHEDULE: 'NOTIFICATION_PDF' };
const SOURCE_TYPE: Partial<Record<DocType, string>> = { RECRUITMENT_NOTIFICATION: 'OFFICIAL_NOTIFICATION_PDF', CORRIGENDUM: 'CORRECTION_NOTICE', ADMIT_CARD: 'ADMIT_CARD', EXAM_CITY_SLIP: 'ADMIT_CARD', RESULT: 'RESULT', ANSWER_KEY: 'ANSWER_KEY', EXAM_SCHEDULE: 'OFFICIAL_NOTIFICATION_PDF' };
const SUPPORTED: DocType[] = ['RECRUITMENT_NOTIFICATION', 'CORRIGENDUM', 'ADMIT_CARD', 'EXAM_CITY_SLIP', 'RESULT', 'ANSWER_KEY', 'EXAM_SCHEDULE'];
const CAN_CREATE: DocType[] = ['RECRUITMENT_NOTIFICATION'];

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function loadExisting(ctx: RouteContext) {
  ctx.existing ??= await getAllActiveRecruitments(ctx.d1, { includeUnpublished: true, limit: 250 });
  return ctx.existing;
}

/** Which existing recruitments could this document belong to? Union of URL, duplicate-rule, title and post+year matches. */
export function findCandidates(existing: RecruitmentWithDetails[], ex: Extracted, docUrl: string, orgId: string | null, postId: string | null): { ids: string[]; duplicate: DuplicateCheckResult } {
  const hit = new Set<string>();
  for (const r of existing) {
    if (r.sourcesList?.some(s => s.sourceUrl === docUrl) || r.officialLinksList?.some(l => l.url === docUrl)) hit.add(r.id);
  }
  const duplicate = detectDuplicates(
    { title: ex.title ?? '', advtNumber: ex.advertisementNumber, organisationId: orgId ?? undefined, sourceUrl: docUrl, postId: postId ?? undefined, cycleYear: ex.cycleYear ?? undefined },
    existing.map(r => ({ id: r.id, title: r.title, advtNumber: r.advtNumber, organisationId: r.organisationId, organisationShortName: r.organisationShortName, sourceUrl: r.sourcesList?.[0]?.sourceUrl, postId: r.postId, cycleYear: r.cycleYear })),
  );
  for (const m of duplicate.matches) if (m.confidence === 'HIGH') hit.add(m.matchedRecruitmentId);
  const t = norm(ex.title);
  for (const r of existing) {
    if (orgId && r.organisationId && r.organisationId !== orgId) continue;
    const rt = norm(r.title);
    if (rt.length >= 12 && t.length >= 12 && (t.includes(rt) || rt.includes(t))) hit.add(r.id);
    if (ex.postTitle && ex.cycleYear && norm(r.postTitle) === norm(ex.postTitle) && r.cycleYear === ex.cycleYear && (!orgId || r.organisationId === orgId)) hit.add(r.id);
  }
  return { ids: [...hit], duplicate };
}

function mergeBy<T>(existing: T[], added: T[], key: (x: T) => string): T[] {
  const seen = new Set(existing.map(key));
  return [...existing, ...added.filter(x => !seen.has(key(x)))];
}

interface Built { changes: Record<string, unknown>; evidence: EvidenceItem[] }

function evidenceFor(ex: Extracted, field: string, exField: string, docUrl: string, isPdf: boolean): EvidenceItem[] {
  return ex.evidence.filter(e => e.field === exField).slice(0, 3).map(e => ({
    field, sourceUrl: docUrl, page: e.page ?? undefined, snippet: e.quote.slice(0, 500), method: isPdf ? 'VISION' : 'NATIVE',
  }));
}

/** Proposal fields whose quotes the validator found in the page text (extracted names differ for the advertisement number). */
const quoteInDocument = (v: Validation, changes: Record<string, unknown>) =>
  Object.keys(changes).filter(f => v.verifiedFields.includes(f === 'advtNumber' ? 'advertisementNumber' : f));

/** Fields shared by NEW and UPDATE proposals, taken from the document verbatim. */
function documentFields(ex: Extracted, docType: DocType, docUrl: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== null && v !== undefined) out[k] = v; };
  set('totalVacancies', ex.totalVacancies); set('minAge', ex.minAge); set('maxAgeGeneral', ex.maxAgeGeneral); set('ageCutoffDate', ex.ageCutoffDate);
  set('minQualificationLevel', ex.minQualificationLevel); set('applicationStart', ex.applicationStart); set('applicationEnd', ex.applicationEnd); set('examDate', ex.examDate);
  if (docType === 'RESULT') out.resultStatus = 'DECLARED';
  return out;
}

export function buildCreate(ex: Extracted, docType: DocType, docUrl: string, orgId: string, postId: string, isPdf: boolean): Built {
  const changes: Record<string, unknown> = { title: ex.title, postId, organisationId: orgId, ...documentFields(ex, docType, docUrl) };
  if (ex.advertisementNumber) changes.advtNumber = ex.advertisementNumber;
  if (ex.cycleYear) changes.cycleYear = ex.cycleYear;
  if (ex.vacanciesBreakdown?.length) changes.vacanciesBreakdown = ex.vacanciesBreakdown.map(v => ({ category: v.category, count: v.count, ...(v.gender ? { gender: v.gender } : {}), ...(v.subPostName ? { subPostName: v.subPostName } : {}) }));
  if (ex.importantDates?.length) changes.importantDates = ex.importantDates.map(d => ({ eventType: d.eventType, eventDate: d.eventDate, ...(d.notes ? { notes: d.notes } : {}) }));
  changes.sources = [{ sourceType: SOURCE_TYPE[docType] ?? 'OFFICIAL_NOTIFICATION_PDF', sourceTitle: (ex.title ?? 'Official document').slice(0, 300), sourceUrl: docUrl, ...(ex.publicationDate ? { publicationDate: ex.publicationDate } : {}) }];
  changes.officialLinks = [{ linkType: LINK_TYPE[docType] ?? 'NOTIFICATION_PDF', title: 'Official document', url: docUrl }, ...(ex.officialLinks ?? []).filter(l => l.url !== docUrl).map(l => ({ linkType: l.linkType, title: l.title, url: l.url }))].slice(0, 30);
  const evidence: EvidenceItem[] = [];
  for (const f of Object.keys(changes)) evidence.push(...evidenceFor(ex, f, f === 'advtNumber' ? 'advertisementNumber' : f === 'vacanciesBreakdown' ? 'vacanciesBreakdown' : f, docUrl, isPdf));
  return { changes, evidence };
}

/** Only fields whose value actually differs from the live record; array fields are sent as the full merged list. */
export function buildUpdate(r: RecruitmentWithDetails, ex: Extracted, docType: DocType, docUrl: string, isPdf: boolean): Built {
  const changes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(documentFields(ex, docType, docUrl))) {
    if (!same(currentFieldValue(r, k), v)) changes[k] = v;
  }
  if (ex.advertisementNumber && !r.advtNumber) changes.advtNumber = ex.advertisementNumber;

  const dates = (currentFieldValue(r, 'importantDates') as Array<{ eventType: string; eventDate: string; isTentative?: number; notes?: string }>) ?? [];
  const newDates = (ex.importantDates ?? []).map(d => ({ eventType: d.eventType, eventDate: d.eventDate, isTentative: 0, ...(d.notes ? { notes: d.notes } : {}) }));
  const mergedDates = mergeBy(dates, newDates, d => `${d.eventType}|${d.eventDate}`);
  if (mergedDates.length !== dates.length) changes.importantDates = mergedDates;

  const links = (currentFieldValue(r, 'officialLinks') as Array<{ linkType: string; title: string; url: string }>) ?? [];
  const newLinks = [{ linkType: LINK_TYPE[docType] ?? 'NOTIFICATION_PDF', title: (ex.title ?? 'Official document').slice(0, 200), url: docUrl }, ...(ex.officialLinks ?? []).map(l => ({ linkType: l.linkType, title: l.title, url: l.url }))];
  const mergedLinks = mergeBy(links, newLinks, l => l.url).slice(0, 30);
  if (mergedLinks.length !== links.length) changes.officialLinks = mergedLinks;

  const sources = (currentFieldValue(r, 'sources') as Array<{ sourceType: string; sourceTitle: string; sourceUrl: string; publicationDate?: string }>) ?? [];
  if (!sources.some(s => s.sourceUrl === docUrl)) {
    changes.sources = [...sources, { sourceType: SOURCE_TYPE[docType] ?? 'OFFICIAL_NOTIFICATION_PDF', sourceTitle: (ex.title ?? 'Official document').slice(0, 300), sourceUrl: docUrl, ...(ex.publicationDate ? { publicationDate: ex.publicationDate } : {}) }].slice(0, 20);
  }

  const evidence: EvidenceItem[] = [];
  for (const f of Object.keys(changes)) {
    const own = evidenceFor(ex, f === 'advtNumber' ? 'advtNumber' : f, f === 'advtNumber' ? 'advertisementNumber' : f, docUrl, isPdf);
    evidence.push(...(own.length ? own : [{ field: f, sourceUrl: docUrl, snippet: `From official document: ${(ex.title ?? docUrl).slice(0, 300)}`, method: isPdf ? 'VISION' : 'NATIVE' } as EvidenceItem]));
  }
  return { changes, evidence };
}

/** A NEW recruitment for the same title or document may already be waiting for review (it is not in the live data yet). */
async function pendingCreateMatch(d1: D1Database, title: string | null, docUrl: string): Promise<string | null> {
  const { results } = await d1.prepare("SELECT id, payload FROM change_proposals WHERE kind = 'CREATE_RECRUITMENT' AND status IN ('PENDING', 'APPLYING') ORDER BY created_at DESC LIMIT 200").all<{ id: string; payload: string }>();
  for (const r of results ?? []) {
    try {
      const p = JSON.parse(r.payload) as { title?: string; sources?: Array<{ sourceUrl?: string }> };
      if ((title && norm(p.title) === norm(title)) || p.sources?.some(x => x.sourceUrl === docUrl)) return r.id;
    } catch { /* unreadable payload: ignore */ }
  }
  return null;
}

const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return u; } };

export async function routeExtraction(ctx: RouteContext, source: SourceRow, ex: Extracted, v: Validation, docUrl: string, isPdf: boolean): Promise<Routed> {
  if (!SUPPORTED.includes(ex.documentType)) return { status: 'UNSUPPORTED', reason: `Document type ${ex.documentType} has no place in the data model yet (recorded, not published).` };
  if (!v.ok) return { status: 'INVALID', reason: v.errors.join(' ') };

  const orgRes = ex.organisationName ? await resolveEntity(ctx.d1, 'organisation', ex.organisationName).catch(() => null) : null;
  const orgId = source.organisationId ?? (orgRes?.status === 'MATCH' ? String(orgRes.entity.id) : null);
  const postRes = ex.postTitle ? await resolveEntity(ctx.d1, 'post', ex.postTitle).catch(() => null) : null;
  const postId = postRes?.status === 'MATCH' ? String(postRes.entity.id) : null;

  const existing = await loadExisting(ctx);
  const { ids, duplicate } = findCandidates(existing, ex, docUrl, orgId, postId);
  if (ids.length > 1) return { status: 'AMBIGUOUS', reason: `Could belong to ${ids.length} existing recruitments (${ids.slice(0, 3).join(', ')}). A person must choose.` };

  const provenance = { pipeline: { runId: ctx.runId, sourceId: source.id, documentUrl: docUrl, documentType: ex.documentType, model: ctx.model, warnings: v.warnings.slice(0, 10) } };
  const label = `${ex.title ?? 'Official notice'} (${ex.documentType.toLowerCase().replace(/_/g, ' ')}) from ${hostOf(docUrl)}`.slice(0, 290);
  const submit = async (input: ProposalInput) => {
    if (ctx.dryRun) return { preview: await previewProposal(ctx.d1, ACTOR, input) };
    return { created: await createProposal(ctx.d1, ACTOR, input) };
  };

  try {
    if (ids.length === 1) {
      const target = existing.find(r => r.id === ids[0])!;
      const { changes, evidence } = buildUpdate(target, ex, ex.documentType, docUrl, isPdf);
      if (!Object.keys(changes).length) return { status: 'UNCHANGED', reason: `Already matches ${target.title}.` };
      const out = await submit({ kind: 'UPDATE_RECRUITMENT', recruitmentId: target.id, summary: `Update: ${label}`, changes, evidence, meta: { ...provenance, quoteInDocument: quoteInDocument(v, changes) } });
      return out.created ? { status: 'PROPOSED', reason: `Update to ${target.title}: ${Object.keys(changes).join(', ')}.`, proposalId: out.created.id } : { status: 'DRY_RUN', reason: `Would propose an update to ${target.title}: ${Object.keys(changes).join(', ')}.`, preview: out.preview };
    }

    // No existing recruitment: only a recruitment notification may create one, and only with complete master data.
    if (!CAN_CREATE.includes(ex.documentType)) return { status: 'UNMATCHED', reason: `No existing recruitment found for this ${ex.documentType.toLowerCase().replace(/_/g, ' ')}. Create the recruitment first, then it will attach.` };
    const missing = [!orgId && `organisation "${ex.organisationName}" is not in the master data`, !postId && `post "${ex.postTitle ?? '(not stated)'}" is not in the master data`, ex.totalVacancies === null && 'the document states no vacancy total'].filter(Boolean);
    if (missing.length) return { status: 'INCOMPLETE', reason: `Cannot create a recruitment: ${missing.join('; ')}.` };
    const pending = await pendingCreateMatch(ctx.d1, ex.title, docUrl);
    if (pending) return { status: 'DEFERRED', reason: `A proposal for this recruitment is already waiting for review (${pending}).` };
    if (!ctx.dryRun) {
      const used = await newDraftsToday(ctx.d1);
      if (used >= ctx.settings.dailyNewDraftCap) return { status: 'DEFERRED', reason: `Daily limit of ${ctx.settings.dailyNewDraftCap} new recruitments reached.` };
    }
    const { changes, evidence } = buildCreate(ex, ex.documentType, docUrl, orgId!, postId!, isPdf);
    const inDocument = quoteInDocument(v, changes);
    const out = await submit({ kind: 'CREATE_RECRUITMENT', summary: `New: ${label}`, changes, evidence, meta: { ...provenance, quoteInDocument: inDocument } });
    if (!out.created) return { status: 'DRY_RUN', reason: 'Would propose a new recruitment.', preview: out.preview };

    const clean = !out.created.duplicateWarning && duplicate.status === 'NO_DUPLICATE' && v.warnings.length === 0;
    // Only a record whose every fact was found in its quote, and every quote in the page text, may skip review. Never a scanned PDF.
    const checks = checkFacts(changes, evidence, inDocument);
    if (ctx.settings.autoPublishHighConfidence && clean && fullyMachineChecked(checks)) {
      const res = await approveProposal(ctx.d1, out.created.id, 'pipeline@auto-publish', { publish: true });
      if (res.ok) return { status: 'AUTO_CREATED', reason: `Auto-published: all ${checks.total} facts matched their quote in the page text.`, proposalId: out.created.id };
      return { status: 'PROPOSED', reason: `Queued; auto-publish failed: ${res.message}`, proposalId: out.created.id };
    }
    return { status: 'PROPOSED', reason: 'New recruitment queued for review.', proposalId: out.created.id };
  } catch (e) {
    if (e instanceof ProposalBlockedError) return { status: e.code === 'PENDING_CHANGE_CONFLICT' ? 'DEFERRED' : e.code === 'CONFIRMED_DUPLICATE' ? 'AMBIGUOUS' : 'INCOMPLETE', reason: e.message };
    if (e instanceof InvalidProposalError) return { status: 'INVALID', reason: e.message };
    throw e;
  }
}

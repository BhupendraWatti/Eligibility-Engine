/**
 * Admin-only: approve or reject a change proposal. This is the ONLY place a proposal becomes live data,
 * and it runs inside the website (Cloudflare Access identity), never inside the MCP Worker.
 *
 * Approval re-uses the existing atomic writers so publication validation, duplicate detection, lifecycle
 * enrichment and audit logging behave exactly as for a hand edit.
 */
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import {
  createRecruitmentAtomic,
  updateRecruitmentAtomic,
  getRecruitmentById,
  type CreateRecruitmentInput,
  type RecruitmentWithDetails,
} from '../db/queries';
import { currentFieldValue, InvalidProposalError, sanitizeChanges, snapshotFields, staleFields, toProposalRow, type ProposalRow } from './change-proposals';

export interface DecisionOptions {
  /** CREATE only: publish immediately (the validator may still block it). Default is DRAFT. */
  publish?: boolean;
  /** Apply even though the live record changed since the proposal was made. */
  confirmStale?: boolean;
}

export type DecisionResult =
  | { ok: true; status: 'APPROVED' | 'REJECTED' | 'EDITED'; recruitmentId?: string; message: string }
  | { ok: false; code: 'NOT_FOUND' | 'NOT_PENDING' | 'STALE' | 'FAILED'; message: string; staleFields?: string[]; errors?: string[] };

interface AuditEntry { adminEmail: string; entityId: string; action: string; field: string; newValue: string | null; reason: string; source: string }

export interface DecisionDeps {
  get: (d1: D1Database, id: string) => Promise<ProposalRow | undefined>;
  /** PENDING -> APPLYING. False when someone else already claimed or decided it. */
  claim: (d1: D1Database, id: string) => Promise<boolean>;
  release: (d1: D1Database, id: string) => Promise<void>;
  finalize: (d1: D1Database, id: string, from: 'APPLYING' | 'PENDING', fields: { status: 'APPROVED' | 'REJECTED' | 'FAILED'; decidedBy: string; note: string | null }, audit: AuditEntry) => Promise<boolean>;
  loadRecruitment: (d1: D1Database, id: string) => Promise<RecruitmentWithDetails | undefined>;
  create: (input: CreateRecruitmentInput, d1: D1Database) => ReturnType<typeof createRecruitmentAtomic>;
  update: (id: string, input: CreateRecruitmentInput, d1: D1Database) => ReturnType<typeof updateRecruitmentAtomic>;
}

export const defaultDecisionDeps: DecisionDeps = {
  get: async (d1, id) => {
    const [row] = await getDb(d1).select().from(schema.changeProposals).where(eq(schema.changeProposals.id, id)).limit(1);
    return row ? toProposalRow(row) : undefined;
  },
  claim: async (d1, id) => {
    const t = schema.changeProposals;
    const res = await getDb(d1).update(t).set({ status: 'APPLYING' }).where(and(eq(t.id, id), eq(t.status, 'PENDING'))).run();
    return (res.meta?.changes ?? 0) === 1;
  },
  release: async (d1, id) => {
    const t = schema.changeProposals;
    await getDb(d1).update(t).set({ status: 'PENDING' }).where(and(eq(t.id, id), eq(t.status, 'APPLYING'))).run();
  },
  finalize: async (d1, id, from, fields, audit) => {
    const db = getDb(d1);
    const t = schema.changeProposals;
    const [res] = await (db as any).batch([
      db.update(t)
        .set({ status: fields.status, decidedBy: fields.decidedBy, decidedAt: new Date(), decisionNote: fields.note })
        .where(and(eq(t.id, id), eq(t.status, from))),
      db.insert(schema.auditLogs).values({
        id: `audit_${crypto.randomUUID()}`,
        adminEmail: audit.adminEmail,
        entity: 'PROPOSAL',
        entityId: audit.entityId,
        action: audit.action,
        field: audit.field,
        oldValue: null,
        newValue: audit.newValue,
        reason: audit.reason,
        source: audit.source,
      }),
    ]);
    return (res?.meta?.changes ?? 0) === 1;
  },
  loadRecruitment: (d1, id) => getRecruitmentById(id, d1),
  create: (input, d1) => createRecruitmentAtomic(input, d1),
  update: (id, input, d1) => updateRecruitmentAtomic(id, input, d1),
};

const DATE_FIELD_EVENTS = { applicationStart: 'APPLICATION_START', applicationEnd: 'APPLICATION_END', examDate: 'EXAM_DATE' } as const;

/**
 * updateRecruitmentAtomic is a full overwrite, so rebuild the complete input from the live record and
 * overlay the proposal. Child arrays are only sent when the proposal changes them (undefined = untouched).
 */
export function mergeUpdateInput(existing: RecruitmentWithDetails, payload: Record<string, unknown>, adminEmail: string): CreateRecruitmentInput {
  if (!existing.postId) throw new Error('Recruitment has no canonical post; it cannot be updated automatically.');
  const c = existing.criteria;
  const base: CreateRecruitmentInput = {
    title: existing.title,
    postId: existing.postId,
    stateId: existing.stateId,
    organisationShortName: existing.organisationShortName,
    advtNumber: existing.advtNumber,
    totalVacancies: existing.totalVacancies,
    shortSummary: existing.shortSummary,
    overviewMarkdown: existing.overviewMarkdown ?? undefined,
    lifecycleStatus: existing.lifecycleStatus,
    status: existing.status, // the proposer can never change publication status
    cycleYear: existing.cycleYear,
    payScaleOverride: existing.payScaleOverride ?? undefined,
    salaryDetailsMarkdown: existing.salaryDetailsMarkdown ?? undefined,
    cadreClassification: existing.cadreClassification ?? undefined,
    minAge: c.minAge,
    maxAgeGeneral: c.maxAgeGeneral,
    ageCutoffDate: c.ageCutoffDate,
    ageRelaxationScSt: c.ageRelaxationScSt,
    ageRelaxationObc: c.ageRelaxationObc,
    ageRelaxationFemale: c.ageRelaxationFemale,
    ageRelaxationEws: c.ageRelaxationEws,
    minQualificationLevel: c.minQualificationLevel,
    qualificationDetailsMarkdown: c.qualificationDetailsMarkdown ?? undefined,
    relaxationNotesMarkdown: c.relaxationNotesMarkdown ?? undefined,
    specialConditionsNotes: c.specialConditionsNotes ?? undefined,
    experienceMonths: c.experienceMonths,
    allowedStreams: c.allowedStreams ?? undefined,
    requiresMpDomicile: c.requiresMpDomicile,
    domicileStateCode: c.domicileStateCode ?? null,
    requiresMpEmploymentReg: c.requiresMpEmploymentReg,
    employmentRegistrationLabel: c.employmentRegistrationLabel ?? null,
    requiresCpct: c.requiresCpct,
    genderAllowed: c.genderAllowed,
    minHeightMaleCm: c.minHeightMaleCm ?? null,
    minHeightFemaleCm: c.minHeightFemaleCm ?? null,
    minChestMaleCm: c.minChestMaleCm ?? null,
    minPercentageRequired: c.minPercentageRequired ?? null,
    additionalSkills: c.additionalSkills ?? undefined,
    applicationStart: existing.applicationStart,
    applicationEnd: existing.applicationEnd,
    examDate: existing.examDate,
    selectionStages: existing.selectionStages,
    seoTitle: existing.seoTitle ?? undefined,
    seoDescription: existing.seoDescription ?? undefined,
    robotsIndex: existing.robotsIndex,
    examStatus: existing.examStatus,
    resultStatus: existing.resultStatus,
    isFeatured: existing.isFeatured,
    adminEmail,
  };
  const merged = { ...base, ...payload } as CreateRecruitmentInput;

  // The three headline dates live as important_dates rows; keep the rows in step when only the dates were proposed.
  const touched = (Object.keys(DATE_FIELD_EVENTS) as Array<keyof typeof DATE_FIELD_EVENTS>).filter(k => payload[k] !== undefined);
  if (payload.importantDates === undefined && touched.length) {
    let rows = (currentFieldValue(existing, 'importantDates') as NonNullable<CreateRecruitmentInput['importantDates']>);
    for (const key of touched) {
      rows = rows.filter(r => r.eventType !== DATE_FIELD_EVENTS[key]);
      rows.push({ eventType: DATE_FIELD_EVENTS[key], eventDate: payload[key] as string, isTentative: 0 });
    }
    merged.importantDates = rows;
  }
  merged.adminEmail = adminEmail;
  merged.status = existing.status;
  return merged;
}

function summarizeErrors(errors?: string[], message?: string): string {
  const text = (errors && errors.length ? errors.join('; ') : message) || 'The change could not be applied.';
  return text.slice(0, 1000);
}

export async function approveProposal(
  d1: D1Database | undefined,
  id: string,
  adminEmail: string,
  options: DecisionOptions = {},
  deps: DecisionDeps = defaultDecisionDeps,
): Promise<DecisionResult> {
  if (!adminEmail) throw new Error('Admin identity is required to decide a proposal.');
  if (!d1) throw new Error('D1 binding unavailable.');

  const proposal = await deps.get(d1, id);
  if (!proposal) return { ok: false, code: 'NOT_FOUND', message: 'Proposal not found.' };
  if (proposal.status !== 'PENDING') return { ok: false, code: 'NOT_PENDING', message: `Proposal is already ${proposal.status}.` };
  if (!(await deps.claim(d1, id))) return { ok: false, code: 'NOT_PENDING', message: 'Proposal was just decided by someone else.' };

  const audit = (action: string, newValue: string | null, reason: string): AuditEntry => ({
    adminEmail, entityId: id, action, field: proposal.kind, newValue, reason: reason.slice(0, 500), source: `mcp:${proposal.proposedBy}`,
  });
  const fail = async (message: string, errors?: string[]): Promise<DecisionResult> => {
    await deps.finalize(d1, id, 'APPLYING', { status: 'FAILED', decidedBy: adminEmail, note: message }, audit('APPLY_FAILED', null, message));
    return { ok: false, code: 'FAILED', message, errors };
  };

  try {
    let result: Awaited<ReturnType<DecisionDeps['create']>>;
    let recruitmentId: string | undefined;

    if (proposal.kind === 'CREATE_RECRUITMENT') {
      const input = { ...proposal.payload, status: options.publish ? 'PUBLISHED' : 'DRAFT', adminEmail } as unknown as CreateRecruitmentInput;
      result = await deps.create(input, d1);
      recruitmentId = result.id;
    } else {
      recruitmentId = proposal.recruitmentId ?? undefined;
      const current = recruitmentId ? await deps.loadRecruitment(d1, recruitmentId) : undefined;
      if (!recruitmentId || !current) return await fail('The target recruitment no longer exists.');
      const stale = staleFields(proposal.baseSnapshot, current);
      if (stale.length && !options.confirmStale) {
        await deps.release(d1, id);
        return { ok: false, code: 'STALE', staleFields: stale, message: `The live record changed since this was proposed (${stale.join(', ')}). Review the diff and confirm to apply anyway.` };
      }
      result = await deps.update(recruitmentId, mergeUpdateInput(current, proposal.payload, adminEmail), d1);
    }

    if (!result.success) return await fail(summarizeErrors(result.errors, result.message), result.errors);

    const note = proposal.kind === 'CREATE_RECRUITMENT' ? `Created ${recruitmentId} as ${options.publish ? 'PUBLISHED' : 'DRAFT'}.` : `Applied to ${recruitmentId}.`;
    await deps.finalize(d1, id, 'APPLYING', { status: 'APPROVED', decidedBy: adminEmail, note }, audit('APPROVE', recruitmentId ?? null, proposal.summary));
    return { ok: true, status: 'APPROVED', recruitmentId, message: note };
  } catch (error) {
    console.error('[proposals] approve failed', error);
    return await fail('Unexpected error while applying the change. No changes were confirmed.');
  }
}

export async function rejectProposal(
  d1: D1Database | undefined,
  id: string,
  adminEmail: string,
  note?: string,
  deps: DecisionDeps = defaultDecisionDeps,
): Promise<DecisionResult> {
  if (!adminEmail) throw new Error('Admin identity is required to decide a proposal.');
  if (!d1) throw new Error('D1 binding unavailable.');
  const proposal = await deps.get(d1, id);
  if (!proposal) return { ok: false, code: 'NOT_FOUND', message: 'Proposal not found.' };
  if (proposal.status !== 'PENDING') return { ok: false, code: 'NOT_PENDING', message: `Proposal is already ${proposal.status}.` };
  const reason = (note ?? '').trim().slice(0, 500) || null;
  const done = await deps.finalize(d1, id, 'PENDING', { status: 'REJECTED', decidedBy: adminEmail, note: reason }, {
    adminEmail, entityId: id, action: 'REJECT', field: proposal.kind, newValue: null, reason: reason ?? proposal.summary.slice(0, 500), source: `mcp:${proposal.proposedBy}`,
  });
  if (!done) return { ok: false, code: 'NOT_PENDING', message: 'Proposal was just decided by someone else.' };
  return { ok: true, status: 'REJECTED', message: 'Proposal rejected. Nothing was changed.' };
}

/**
 * The reviewer corrects a PENDING proposal before approving it. The new values go through the same validation as any proposal,
 * the stale-guard snapshot is re-taken from the live record, and evidence for fields that were removed is dropped.
 */
export async function editProposal(
  d1: D1Database | undefined,
  id: string,
  adminEmail: string,
  rawChanges: unknown,
  deps: DecisionDeps = defaultDecisionDeps,
): Promise<DecisionResult> {
  if (!adminEmail) throw new Error('Admin identity is required to edit a proposal.');
  if (!d1) throw new Error('D1 binding unavailable.');
  const proposal = await deps.get(d1, id);
  if (!proposal) return { ok: false, code: 'NOT_FOUND', message: 'Proposal not found.' };
  if (proposal.status !== 'PENDING') return { ok: false, code: 'NOT_PENDING', message: `Proposal is already ${proposal.status}.` };
  let payload: Record<string, unknown>;
  try { payload = sanitizeChanges(proposal.kind, rawChanges); }
  catch (e) { if (e instanceof InvalidProposalError) return { ok: false, code: 'FAILED', message: e.message }; throw e; }

  let baseSnapshot = proposal.baseSnapshot;
  if (proposal.kind === 'UPDATE_RECRUITMENT' && proposal.recruitmentId) {
    const current = await deps.loadRecruitment(d1, proposal.recruitmentId);
    if (!current) return { ok: false, code: 'FAILED', message: 'The target recruitment no longer exists.' };
    baseSnapshot = snapshotFields(current, Object.keys(payload));
  }
  const meta = { ...(proposal.meta ?? {}), edited: { by: adminEmail, at: new Date().toISOString() } } as Record<string, unknown>;
  if (Array.isArray(meta.evidence)) meta.evidence = (meta.evidence as Array<{ field: string }>).filter(e => e.field in payload);

  const [res] = await d1.batch([
    d1.prepare("UPDATE change_proposals SET payload = ?, base_snapshot = ?, meta = ? WHERE id = ? AND status = 'PENDING'")
      .bind(JSON.stringify(payload), baseSnapshot ? JSON.stringify(baseSnapshot) : null, JSON.stringify(meta), id),
    d1.prepare("INSERT INTO audit_logs (id, admin_email, entity, entity_id, action, field, new_value, reason, source) SELECT ?, ?, 'PROPOSAL', ?, 'EDIT', ?, ?, 'Reviewer edited the proposal before deciding', ? WHERE EXISTS (SELECT 1 FROM change_proposals WHERE id = ? AND status = 'PENDING')")
      .bind(`audit_${crypto.randomUUID()}`, adminEmail, id, proposal.kind, Object.keys(payload).join(',').slice(0, 200), `mcp:${proposal.proposedBy}`, id),
  ]);
  if ((res.meta?.changes ?? 0) !== 1) return { ok: false, code: 'NOT_PENDING', message: 'Proposal was just decided by someone else.' };
  return { ok: true, status: 'EDITED', message: 'Proposal updated. Review the diff, then approve.' };
}

/**
 * Shared data access for the automated data pipeline (migration 0015). Used by the pipeline Worker AND the admin pages,
 * so both read the same settings, run log and usage numbers. Plain SQL: these tables are not part of the site's domain model.
 */

export const REGISTRY_CATEGORIES = ['JOBS', 'ADMIT_CARDS', 'RESULTS', 'ANSWER_KEYS', 'ADMISSIONS', 'SCHOLARSHIPS', 'SYLLABUS', 'BOOKS', 'KNOWLEDGE'] as const;
export const SOURCE_TYPES = ['NOTICE_PAGE', 'RSS', 'PDF_LIST'] as const;
export const SOURCE_STATUSES = ['NEEDS_VERIFICATION', 'ACTIVE', 'PAUSED', 'FAILING'] as const;
/** Categories checked on the 3-hourly run; the rest run on the daily one. */
export const NOTICE_CATEGORIES = ['JOBS', 'ADMIT_CARDS', 'RESULTS', 'ANSWER_KEYS', 'ADMISSIONS', 'SCHOLARSHIPS'];
export const DAILY_CATEGORIES = ['SYLLABUS', 'BOOKS', 'KNOWLEDGE'];

export interface PipelineSettings {
  automationPaused: boolean;
  autoPublishHighConfidence: boolean;
  autoPublishThreshold: number;
  dailyLlmCapUsd: number;
  dailyNewDraftCap: number;
  extractionModel: string;
  alertEmail: string;
}

export interface SourceRow {
  id: string; name: string; url: string; sourceType: string; category: string; organisationId: string | null;
  stateCode: string | null; department: string | null; frequencyHours: number; lastCheckedAt: number | null;
  lastContentHash: string | null; lastError: string | null; consecutiveFailures: number; status: string;
}

export interface RunRow {
  id: string; kind: string; triggerBy: string; dryRun: number; status: string; startedAt: number; finishedAt: number | null;
  sourcesChecked: number; sourcesChanged: number; itemsFound: number; proposalsCreated: number; errors: number; llmCostUsd: number; detail: string | null;
}

export interface ItemRow {
  id: string; runId: string; sourceId: string; docUrl: string; status: string; docType: string | null; title: string | null;
  confidence: number | null; reason: string | null; extractedJson: string | null; validationJson: string | null; proposalId: string | null;
  dryRun: number; dismissed: number; createdAt: number;
}

export const KNOWN_MODELS = ['claude-haiku-4-5', 'claude-sonnet-5-5', 'claude-opus-5-5'] as const;
export const SETTING_KEYS = ['automation_paused', 'auto_publish_high_confidence', 'auto_publish_threshold', 'daily_llm_cap_usd', 'daily_new_draft_cap', 'extraction_model', 'alert_email'] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

const IST_OFFSET = 19_800;
/** Start of the current day in India (the owner's day), as unix seconds. */
export const dayStart = (now = Math.floor(Date.now() / 1000)) => Math.floor((now + IST_OFFSET) / 86_400) * 86_400 - IST_OFFSET;
const monthStart = (now = Math.floor(Date.now() / 1000)) => {
  const d = new Date((now + IST_OFFSET) * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000) - IST_OFFSET;
};

const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) && String(v ?? '') !== '' ? Number(v) : fallback);

export async function getSettings(d1: D1Database): Promise<PipelineSettings> {
  const { results } = await d1.prepare('SELECT key, value FROM pipeline_settings').all<{ key: string; value: string }>();
  const m = Object.fromEntries((results ?? []).map(r => [r.key, r.value]));
  return {
    automationPaused: m.automation_paused === '1',
    autoPublishHighConfidence: m.auto_publish_high_confidence === '1',
    autoPublishThreshold: num(m.auto_publish_threshold, 0.95),
    dailyLlmCapUsd: num(m.daily_llm_cap_usd, 2),
    dailyNewDraftCap: num(m.daily_new_draft_cap, 20),
    extractionModel: m.extraction_model || 'claude-haiku-4-5',
    alertEmail: m.alert_email ?? '',
  };
}

export async function setSetting(d1: D1Database, key: SettingKey, value: string, by: string): Promise<void> {
  if (!SETTING_KEYS.includes(key)) throw new Error('Unknown setting.');
  await d1.prepare('INSERT INTO pipeline_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = unixepoch()')
    .bind(key, value, by).run();
}

const one = async <T>(d1: D1Database, sql: string, ...params: unknown[]): Promise<T | null> => d1.prepare(sql).bind(...params).first<T>();

export async function llmCostSince(d1: D1Database, since: number): Promise<number> {
  return Number((await one<{ c: number }>(d1, 'SELECT COALESCE(SUM(cost_usd), 0) AS c FROM llm_usage WHERE created_at >= ?', since))?.c ?? 0);
}
export const llmCostToday = (d1: D1Database) => llmCostSince(d1, dayStart());
export const llmCostThisMonth = (d1: D1Database) => llmCostSince(d1, monthStart());

/** Proposals the pipeline queued for NEW recruitments today: the flood guard. */
export async function newDraftsToday(d1: D1Database): Promise<number> {
  return Number((await one<{ n: number }>(d1, "SELECT COUNT(*) AS n FROM change_proposals WHERE proposed_by = 'pipeline' AND kind = 'CREATE_RECRUITMENT' AND created_at >= ?", dayStart()))?.n ?? 0);
}

export async function logUsage(d1: D1Database, u: { runId?: string; sourceId?: string; model: string; inputTokens: number; outputTokens: number; costUsd: number }): Promise<void> {
  await d1.prepare('INSERT INTO llm_usage (id, run_id, source_id, model, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(`use_${crypto.randomUUID()}`, u.runId ?? null, u.sourceId ?? null, u.model, u.inputTokens, u.outputTokens, u.costUsd).run();
}

// ── Runs and items ─────────────────────────────────────────────────────────────────────────────────────

export async function startRun(d1: D1Database, kind: string, trigger: string, dryRun: boolean): Promise<string> {
  const id = `run_${crypto.randomUUID()}`;
  await d1.prepare('INSERT INTO pipeline_runs (id, kind, trigger_by, dry_run) VALUES (?, ?, ?, ?)').bind(id, kind, trigger, dryRun ? 1 : 0).run();
  return id;
}

export async function finishRun(d1: D1Database, id: string, r: { status: string; sourcesChecked: number; sourcesChanged: number; itemsFound: number; proposalsCreated: number; errors: number; detail: unknown }): Promise<void> {
  const cost = await one<{ c: number }>(d1, 'SELECT COALESCE(SUM(cost_usd), 0) AS c FROM llm_usage WHERE run_id = ?', id);
  await d1.prepare('UPDATE pipeline_runs SET status = ?, finished_at = unixepoch(), sources_checked = ?, sources_changed = ?, items_found = ?, proposals_created = ?, errors = ?, llm_cost_usd = ?, detail = ? WHERE id = ?')
    .bind(r.status, r.sourcesChecked, r.sourcesChanged, r.itemsFound, r.proposalsCreated, r.errors, Number(cost?.c ?? 0), JSON.stringify(r.detail).slice(0, 60_000), id).run();
}

export async function hasProcessed(d1: D1Database, docUrl: string, docHash: string): Promise<boolean> {
  return !!(await one(d1, 'SELECT 1 AS x FROM pipeline_items WHERE doc_url = ? AND doc_hash = ? AND dry_run = 0 LIMIT 1', docUrl, docHash));
}
export async function hasSeenUrl(d1: D1Database, docUrl: string): Promise<boolean> {
  return !!(await one(d1, 'SELECT 1 AS x FROM pipeline_items WHERE doc_url = ? AND dry_run = 0 AND status != \'ERROR\' LIMIT 1', docUrl));
}

export async function insertItem(d1: D1Database, i: { runId: string; sourceId: string; docUrl: string; docHash?: string | null; dryRun: boolean; status: string; docType?: string | null; title?: string | null; confidence?: number | null; reason?: string | null; extracted?: unknown; validation?: unknown; proposalId?: string | null }): Promise<string> {
  const id = `item_${crypto.randomUUID()}`;
  await d1.prepare('INSERT INTO pipeline_items (id, run_id, source_id, doc_url, doc_hash, dry_run, status, doc_type, title, confidence, reason, extracted_json, validation_json, proposal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, i.runId, i.sourceId, i.docUrl, i.docHash ?? null, i.dryRun ? 1 : 0, i.status, i.docType ?? null, i.title ?? null, i.confidence ?? null, (i.reason ?? '').slice(0, 1000) || null,
      i.extracted === undefined ? null : JSON.stringify(i.extracted).slice(0, 60_000), i.validation === undefined ? null : JSON.stringify(i.validation).slice(0, 10_000), i.proposalId ?? null).run();
  return id;
}

// ── Source registry ────────────────────────────────────────────────────────────────────────────────────

const sourceCols = 'id, name, url, source_type AS sourceType, category, organisation_id AS organisationId, state_code AS stateCode, department, frequency_hours AS frequencyHours, last_checked_at AS lastCheckedAt, last_content_hash AS lastContentHash, last_error AS lastError, consecutive_failures AS consecutiveFailures, status';

export async function listSources(d1: D1Database): Promise<SourceRow[]> {
  return ((await d1.prepare(`SELECT ${sourceCols} FROM source_registry ORDER BY category, name`).all<SourceRow>()).results ?? []);
}

/** Sources that are due: not paused, and last checked more than `frequency_hours` ago. */
export async function dueSources(d1: D1Database, categories: string[], limit: number): Promise<SourceRow[]> {
  const marks = categories.map(() => '?').join(',');
  return ((await d1.prepare(`SELECT ${sourceCols} FROM source_registry WHERE status != 'PAUSED' AND category IN (${marks}) AND (last_checked_at IS NULL OR unixepoch() - last_checked_at >= frequency_hours * 3600 - 60) ORDER BY COALESCE(last_checked_at, 0) LIMIT ?`)
    .bind(...categories, limit).all<SourceRow>()).results ?? []);
}

export async function getSource(d1: D1Database, id: string): Promise<SourceRow | null> {
  return one<SourceRow>(d1, `SELECT ${sourceCols} FROM source_registry WHERE id = ?`, id);
}

export async function markSourceChecked(d1: D1Database, id: string, r: { hash?: string | null; error?: string | null; verified?: boolean }): Promise<void> {
  if (r.error) {
    await d1.prepare("UPDATE source_registry SET last_checked_at = unixepoch(), last_error = ?, consecutive_failures = consecutive_failures + 1, status = CASE WHEN status = 'PAUSED' THEN status WHEN consecutive_failures + 1 >= 3 THEN 'FAILING' ELSE status END, updated_at = unixepoch() WHERE id = ?")
      .bind(r.error.slice(0, 300), id).run();
    return;
  }
  await d1.prepare("UPDATE source_registry SET last_checked_at = unixepoch(), last_content_hash = COALESCE(?, last_content_hash), last_error = NULL, consecutive_failures = 0, status = CASE WHEN status IN ('NEEDS_VERIFICATION', 'FAILING') THEN 'ACTIVE' ELSE status END, updated_at = unixepoch() WHERE id = ?")
    .bind(r.hash ?? null, id).run();
}

// ── Reads for the admin console ────────────────────────────────────────────────────────────────────────

export async function listRuns(d1: D1Database, limit = 30): Promise<RunRow[]> {
  return ((await d1.prepare('SELECT id, kind, trigger_by AS triggerBy, dry_run AS dryRun, status, started_at AS startedAt, finished_at AS finishedAt, sources_checked AS sourcesChecked, sources_changed AS sourcesChanged, items_found AS itemsFound, proposals_created AS proposalsCreated, errors, llm_cost_usd AS llmCostUsd, detail FROM pipeline_runs ORDER BY started_at DESC LIMIT ?').bind(limit).all<RunRow>()).results ?? []);
}

/** Items that need a person but cannot become a proposal (unmatched, ambiguous, incomplete, invalid, unsupported). */
export async function listAttentionItems(d1: D1Database, limit = 50): Promise<ItemRow[]> {
  return ((await d1.prepare("SELECT id, run_id AS runId, source_id AS sourceId, doc_url AS docUrl, status, doc_type AS docType, title, confidence, reason, extracted_json AS extractedJson, validation_json AS validationJson, proposal_id AS proposalId, dry_run AS dryRun, dismissed, created_at AS createdAt FROM pipeline_items WHERE dry_run = 0 AND dismissed = 0 AND status IN ('UNMATCHED', 'AMBIGUOUS', 'INCOMPLETE', 'INVALID', 'UNSUPPORTED', 'DEFERRED', 'ERROR') ORDER BY created_at DESC LIMIT ?").bind(limit).all<ItemRow>()).results ?? []);
}

export async function dismissItem(d1: D1Database, id: string): Promise<void> {
  await d1.prepare('UPDATE pipeline_items SET dismissed = 1 WHERE id = ?').bind(id).run();
}

export async function listRunItems(d1: D1Database, runId: string): Promise<ItemRow[]> {
  return ((await d1.prepare('SELECT id, run_id AS runId, source_id AS sourceId, doc_url AS docUrl, status, doc_type AS docType, title, confidence, reason, extracted_json AS extractedJson, validation_json AS validationJson, proposal_id AS proposalId, dry_run AS dryRun, dismissed, created_at AS createdAt FROM pipeline_items WHERE run_id = ? ORDER BY created_at').bind(runId).all<ItemRow>()).results ?? []);
}

export async function listBrokenLinks(d1: D1Database, limit = 50) {
  return ((await d1.prepare("SELECT l.id, l.recruitment_id AS recruitmentId, r.title AS recruitmentTitle, l.link_type AS linkType, l.title, l.url, l.link_failures AS failures, l.link_checked_at AS checkedAt FROM official_links l JOIN recruitments r ON r.id = l.recruitment_id WHERE l.link_status = 'BROKEN' ORDER BY l.link_checked_at DESC LIMIT ?").bind(limit).all<{ id: string; recruitmentId: string; recruitmentTitle: string; linkType: string; title: string; url: string; failures: number; checkedAt: number }>()).results ?? []);
}

// ── Source registry admin writes ───────────────────────────────────────────────────────────────────────

export interface SourceInput { name: string; url: string; sourceType: string; category: string; stateCode?: string | null; department?: string | null; organisationId?: string | null; frequencyHours: number }

export function validateSourceInput(i: SourceInput): string | null {
  if (!i.name.trim()) return 'Name is required.';
  let u: URL;
  try { u = new URL(i.url); } catch { return 'URL is not valid.'; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'URL must be http(s).';
  if (!(SOURCE_TYPES as readonly string[]).includes(i.sourceType)) return 'Unknown source type.';
  if (!(REGISTRY_CATEGORIES as readonly string[]).includes(i.category)) return 'Unknown category.';
  if (!Number.isInteger(i.frequencyHours) || i.frequencyHours < 1 || i.frequencyHours > 168) return 'Frequency must be 1 to 168 hours.';
  return null;
}

export async function saveSource(d1: D1Database, i: SourceInput, id?: string): Promise<string> {
  const err = validateSourceInput(i);
  if (err) throw new Error(err);
  const sid = id ?? `src_${crypto.randomUUID()}`;
  if (id) {
    await d1.prepare('UPDATE source_registry SET name = ?, url = ?, source_type = ?, category = ?, state_code = ?, department = ?, organisation_id = ?, frequency_hours = ?, updated_at = unixepoch() WHERE id = ?')
      .bind(i.name.trim(), i.url.trim(), i.sourceType, i.category, i.stateCode || null, i.department || null, i.organisationId || null, i.frequencyHours, id).run();
  } else {
    await d1.prepare('INSERT INTO source_registry (id, name, url, source_type, category, state_code, department, organisation_id, frequency_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(sid, i.name.trim(), i.url.trim(), i.sourceType, i.category, i.stateCode || null, i.department || null, i.organisationId || null, i.frequencyHours).run();
  }
  return sid;
}

export async function setSourceStatus(d1: D1Database, id: string, status: (typeof SOURCE_STATUSES)[number]): Promise<void> {
  await d1.prepare('UPDATE source_registry SET status = ?, consecutive_failures = CASE WHEN ? = \'PAUSED\' THEN consecutive_failures ELSE 0 END, updated_at = unixepoch() WHERE id = ?').bind(status, status, id).run();
}

export async function deleteSource(d1: D1Database, id: string): Promise<void> {
  await d1.prepare('DELETE FROM source_registry WHERE id = ?').bind(id).run();
}

export async function recordSettingAudit(d1: D1Database, adminEmail: string, key: string, newValue: string, reason: string): Promise<void> {
  await d1.prepare("INSERT INTO audit_logs (id, admin_email, entity, entity_id, action, field, new_value, reason, source) VALUES (?, ?, 'PIPELINE', ?, 'SETTING', ?, ?, ?, 'ADMIN')")
    .bind(`audit_${crypto.randomUUID()}`, adminEmail, key, key, newValue.slice(0, 200), reason.slice(0, 300)).run();
}

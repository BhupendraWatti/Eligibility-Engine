/**
 * Version history for recruitments (migration 0015). Every change stores the record as it was BEFORE the change;
 * restoring one writes that state back through the normal atomic writer, which itself snapshots the state it replaces,
 * so a restore can be undone too.
 */
import { getRecruitmentById, updateRecruitmentAtomic, type RecruitmentWithDetails } from '../db/queries';
import { mergeUpdateInput } from './change-proposal-decision';
import { currentFieldValue } from './change-proposals';

export interface VersionRow { id: string; version: number; changedBy: string | null; createdAt: number; title: string; status: string }

export async function listVersions(d1: D1Database, recruitmentId: string): Promise<VersionRow[]> {
  const { results } = await d1.prepare('SELECT id, version, changed_by AS changedBy, created_at AS createdAt, snapshot FROM record_versions WHERE recruitment_id = ? ORDER BY version DESC LIMIT 100').bind(recruitmentId).all<{ id: string; version: number; changedBy: string | null; createdAt: number; snapshot: string }>();
  return (results ?? []).map(r => {
    let snap: Partial<RecruitmentWithDetails> = {};
    try { snap = JSON.parse(r.snapshot); } catch { /* shown with blanks */ }
    return { id: r.id, version: r.version, changedBy: r.changedBy, createdAt: r.createdAt, title: snap.title ?? '(unreadable)', status: snap.status ?? '' };
  });
}

export async function restoreVersion(d1: D1Database, recruitmentId: string, version: number, adminEmail: string): Promise<{ ok: boolean; message: string }> {
  const row = await d1.prepare('SELECT snapshot FROM record_versions WHERE recruitment_id = ? AND version = ?').bind(recruitmentId, version).first<{ snapshot: string }>();
  if (!row) return { ok: false, message: 'Version not found.' };
  const live = await getRecruitmentById(recruitmentId, d1);
  if (!live) return { ok: false, message: 'The recruitment no longer exists.' };
  let snap: RecruitmentWithDetails;
  try { snap = JSON.parse(row.snapshot); } catch { return { ok: false, message: 'This version is unreadable.' }; }
  if (!snap.postId) return { ok: false, message: 'This version has no canonical post and cannot be restored automatically.' };

  const children = Object.fromEntries(['vacanciesBreakdown', 'importantDates', 'sources', 'officialLinks'].map(f => [f, currentFieldValue(snap, f)]));
  const input = mergeUpdateInput(snap, children, adminEmail);
  input.status = live.status; // restoring content never changes whether the record is public
  const res = await updateRecruitmentAtomic(recruitmentId, input, d1);
  return res.success ? { ok: true, message: `Restored version ${version}. The state before the restore was saved as a new version.` } : { ok: false, message: res.errors?.join(' ') || res.message || 'The restore failed.' };
}

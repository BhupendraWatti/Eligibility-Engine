/** One pipeline run: fetch due sources, find new documents, extract, validate, route. Every outcome is logged. */
import Anthropic from '@anthropic-ai/sdk';
import {
  DAILY_CATEGORIES, NOTICE_CATEGORIES, dueSources, finishRun, getSettings, getSource, hasProcessed, hasSeenUrl, insertItem,
  llmCostToday, logUsage, markSourceChecked, startRun, type SourceRow,
} from '../../src/services/pipeline-store';
import { sendAlert, type AlertEnv } from './alert';
import { candidatesHash, extractLinks, htmlToText, looksLikePdf, type Candidate } from './discover';
import { costUsd, extractDocument, type DocInput, type Extracted } from './extract';
import { fetchPolite, sha256 } from './http';
import { runLinkCheck } from './linkcheck';
import { routeExtraction, type Routed } from './route';
import { validateExtraction, type Validation } from './validate';

export interface Env extends AlertEnv { DB: D1Database; ANTHROPIC_API_KEY?: string; PIPELINE_TOKEN?: string }

export interface RunOptions {
  kind: 'NOTICES' | 'DAILY' | 'LINKS';
  trigger: 'cron' | 'manual';
  dryRun?: boolean;
  sourceIds?: string[];
  /** Fetch and discover only; make no LLM calls (used to check sources before spending money). */
  noLlm?: boolean;
  maxDocs?: number;
}

export interface ItemReport { source: string; url: string; linkText: string; status: string; reason: string; confidence: number | null; extracted?: Extracted; validation?: Validation; preview?: unknown }
export interface RunSummary { runId: string; status: string; sourcesChecked: number; sourcesChanged: number; itemsFound: number; proposalsCreated: number; errors: number; costUsd: number; items: ItemReport[]; sourceNotes: string[] }

const MAX_SOURCES_PER_RUN = 12;
const MAX_DOCS_PER_SOURCE = 3;
const MAX_DOCS_PER_RUN = 10;
const MAX_DOC_BYTES = 6_000_000;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function runPipeline(env: Env, opts: RunOptions): Promise<RunSummary> {
  const d1 = env.DB;
  const dryRun = !!opts.dryRun;
  const settings = await getSettings(d1);
  const empty = (status: string): RunSummary => ({ runId: '', status, sourcesChecked: 0, sourcesChanged: 0, itemsFound: 0, proposalsCreated: 0, errors: 0, costUsd: 0, items: [], sourceNotes: [] });
  if (settings.automationPaused && !dryRun) {
    console.info('[pipeline] automation is paused (kill switch); nothing to do');
    return empty('PAUSED');
  }

  const runId = await startRun(d1, opts.kind, opts.trigger, dryRun);
  const summary: RunSummary = { ...empty('OK'), runId };
  const errors: string[] = [];

  if (opts.kind === 'LINKS') {
    const r = await runLinkCheck(d1);
    summary.sourcesChecked = r.checked;
    summary.sourceNotes.push(`links checked ${r.checked}, ok ${r.ok}, failing ${r.failing}, newly broken ${r.newlyBroken.length}, sources re-verified ${r.sourcesVerified}`);
    await finishRun(d1, runId, { status: 'OK', sourcesChecked: r.checked, sourcesChanged: r.newlyBroken.length, itemsFound: 0, proposalsCreated: 0, errors: 0, detail: r });
    if (r.newlyBroken.length) await sendAlert(env, settings.alertEmail, `${r.newlyBroken.length} official link(s) now broken`, r.newlyBroken.slice(0, 40));
    return summary;
  }

  const categories = opts.kind === 'DAILY' ? DAILY_CATEGORIES : NOTICE_CATEGORIES;
  const sources: SourceRow[] = opts.sourceIds?.length
    ? (await Promise.all(opts.sourceIds.map(id => getSource(d1, id)))).filter((s): s is SourceRow => !!s)
    : await dueSources(d1, categories, MAX_SOURCES_PER_RUN);

  const model = settings.extractionModel;
  const routeCtx = { d1, runId, dryRun, settings, model } as Parameters<typeof routeExtraction>[0];
  let docBudget = opts.maxDocs ?? MAX_DOCS_PER_RUN;
  let capReached = false;
  const llmReady = !opts.noLlm && !!env.ANTHROPIC_API_KEY;
  if (!opts.noLlm && !env.ANTHROPIC_API_KEY) errors.push('ANTHROPIC_API_KEY is not set; documents were discovered but not extracted.');

  for (const source of sources) {
    if (capReached || docBudget <= 0) break;
    summary.sourcesChecked++;
    try {
      const page = await fetchPolite(source.url, { maxBytes: 2_000_000 });
      if (!page.ok) {
        const msg = `${source.name}: ${page.error}`;
        errors.push(msg); summary.sourceNotes.push(msg);
        if (!dryRun) {
          await markSourceChecked(d1, source.id, { error: page.error ?? 'fetch failed' });
          const after = await getSource(d1, source.id);
          if (after?.status === 'FAILING' && after.consecutiveFailures === 3) await sendAlert(env, settings.alertEmail, `Source failing: ${source.name}`, [`${source.url}`, `3 consecutive failures. Last error: ${page.error}`]);
        }
        continue;
      }
      const text = new TextDecoder().decode(page.body);
      const kind = source.sourceType === 'RSS' || /xml|rss|atom/i.test(page.contentType) ? 'RSS' : 'HTML';
      const candidates: Candidate[] = extractLinks(text, page.url, kind);
      const hash = await candidatesHash(candidates);
      if (!dryRun && hash === source.lastContentHash) {
        await markSourceChecked(d1, source.id, { hash });
        summary.sourceNotes.push(`${source.name}: unchanged (${candidates.length} links)`);
        continue;
      }
      summary.sourcesChanged++;

      const unseen: Candidate[] = [];
      for (const c of candidates) if (dryRun || !(await hasSeenUrl(d1, c.url))) unseen.push(c);
      const batch = unseen.slice(0, Math.min(MAX_DOCS_PER_SOURCE, docBudget));
      summary.sourceNotes.push(`${source.name}: ${candidates.length} links, ${unseen.length} new, processing ${batch.length}`);
      let hadError = false;

      for (const c of batch) {
        if (capReached) break;
        docBudget--;
        const report: ItemReport = { source: source.name, url: c.url, linkText: c.text, status: 'ERROR', reason: '', confidence: null };
        summary.items.push(report);
        const record = (status: string, reason: string, extra: { extracted?: Extracted; validation?: unknown; confidence?: number | null; hash?: string | null; docType?: string | null; title?: string | null; proposalId?: string } = {}) => {
          report.status = status; report.reason = reason; report.confidence = extra.confidence ?? null;
          summary.itemsFound++;
          return insertItem(d1, { runId, sourceId: source.id, docUrl: c.url, docHash: extra.hash, dryRun, status, docType: extra.docType ?? extra.extracted?.documentType, title: extra.title ?? extra.extracted?.title ?? c.text, confidence: extra.confidence, reason, extracted: extra.extracted, validation: extra.validation, proposalId: extra.proposalId });
        };
        try {
          const doc = await fetchPolite(c.url, { maxBytes: MAX_DOC_BYTES });
          if (!doc.ok) { hadError = true; errors.push(`${c.url}: ${doc.error}`); await record('ERROR', doc.error ?? 'fetch failed'); continue; }
          const docHash = await sha256(doc.body);
          if (!dryRun && (await hasProcessed(d1, c.url, docHash))) continue;
          if (DAILY_CATEGORIES.includes(source.category)) {
            await record('UNSUPPORTED', `New or changed ${source.category.toLowerCase()} document recorded; the data model has no structure for it yet.`, { hash: docHash });
            continue;
          }
          if (!llmReady) { await record('DRY_RUN', opts.noLlm ? 'Fetched and discovered only (LLM skipped).' : 'ANTHROPIC_API_KEY not set.', { hash: docHash }); continue; }

          const isPdf = looksLikePdf(doc.contentType, doc.body, doc.url);
          const input: DocInput = isPdf ? { kind: 'pdf', base64: toBase64(doc.body) } : { kind: 'text', text: htmlToText(new TextDecoder().decode(doc.body)) };
          if (input.kind === 'text' && input.text.length < 200) { await record('INVALID', 'The page has no readable text (it may need JavaScript or be an image).', { hash: docHash }); continue; }

          if ((await llmCostToday(d1)) >= settings.dailyLlmCapUsd) { capReached = true; docBudget++; summary.items.pop(); break; }
          let extraction;
          try {
            extraction = await extractDocument(env.ANTHROPIC_API_KEY!, model, input, { url: c.url, linkText: c.text, organisationHint: source.department });
          } catch (e) {
            if (e instanceof Anthropic.BadRequestError) { await record('INVALID', `The model could not read this document: ${e.message.slice(0, 200)}`, { hash: docHash }); continue; }
            throw e;
          }
          const cost = costUsd(extraction.model, extraction.inputTokens, extraction.outputTokens);
          await logUsage(d1, { runId, sourceId: source.id, model: extraction.model, inputTokens: extraction.inputTokens, outputTokens: extraction.outputTokens, costUsd: cost });

          const ex = extraction.extracted;
          const validation = validateExtraction(ex, doc.url, input.kind === 'text' ? input.text : null);
          let routed: Routed;
          try { routed = await routeExtraction(routeCtx, source, ex, validation, doc.url, isPdf); }
          catch (e) { hadError = true; errors.push(`${c.url}: routing failed: ${e instanceof Error ? e.message : e}`); await record('ERROR', 'Routing failed.', { extracted: ex, validation, hash: docHash }); continue; }
          if (routed.status === 'PROPOSED' || routed.status === 'AUTO_CREATED') summary.proposalsCreated++;
          report.extracted = ex; report.validation = validation; report.preview = routed.preview;
          await record(routed.status, routed.reason, { extracted: ex, validation: { ...validation, preview: routed.preview }, confidence: validation.confidence, hash: docHash, proposalId: routed.proposalId });
        } catch (e) {
          hadError = true;
          const msg = `${c.url}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
          errors.push(msg);
          await record('ERROR', msg).catch(() => undefined);
        }
      }

      // Store the new page hash only when every new link was dealt with, so unprocessed or failed ones are retried next run.
      if (!dryRun) await markSourceChecked(d1, source.id, { hash: !hadError && unseen.length <= batch.length && !capReached ? hash : null });
    } catch (e) {
      const msg = `${source.name}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
      errors.push(msg); summary.sourceNotes.push(msg);
      if (!dryRun) await markSourceChecked(d1, source.id, { error: msg }).catch(() => undefined);
    }
  }

  summary.errors = errors.length;
  summary.status = capReached ? 'CAP_REACHED' : errors.length ? (summary.sourcesChecked > errors.length ? 'PARTIAL' : 'FAILED') : 'OK';
  await finishRun(d1, runId, { status: summary.status, sourcesChecked: summary.sourcesChecked, sourcesChanged: summary.sourcesChanged, itemsFound: summary.itemsFound, proposalsCreated: summary.proposalsCreated, errors: errors.length, detail: { notes: summary.sourceNotes, errors: errors.slice(0, 50) } });
  summary.costUsd = Number((await d1.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS c FROM llm_usage WHERE run_id = ?').bind(runId).first<{ c: number }>())?.c ?? 0);

  if (!dryRun && (capReached || summary.status === 'FAILED' || (summary.status === 'PARTIAL' && errors.length >= 3))) {
    await sendAlert(env, settings.alertEmail, capReached ? 'Daily LLM cost cap reached' : `Pipeline run ${summary.status.toLowerCase()}`, [`Run ${runId} (${opts.kind})`, `Sources checked: ${summary.sourcesChecked}, items: ${summary.itemsFound}, errors: ${errors.length}`, ...errors.slice(0, 20)]);
  }
  return summary;
}

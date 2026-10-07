# NIRNAY data workflow runbook (MCP operator)

The official source is the authority. The MCP proposes, an admin approves. Nothing here publishes anything.

## Per-record loop

1. **Find the official source.** Recruiting body site, official PDF, government portal. Aggregators are leads only; never copy from them.
2. **`check_links`** on every URL you will cite. A dead link is not cited.
3. **Read the document** and extract only what it states. Note the page and section for each value.
4. **Resolve masters** with `resolve_entity` (organisation, post, state). `AMBIGUOUS` means stop and ask an admin; never guess an id.
   `NOT_FOUND`: queue the missing master with `propose_master` in the same run (organisation, then department, then post), passing each
   returned proposal id (`prop_...`) as the child's `organisationId` / `departmentId` / `postId`. The admin approves parents first; one MCP run is enough.
5. **Check NIRNAY first**: `search_recruitments` by `advtNumber`, `sourceUrl`, `title`/`organisation`, with `includeUnpublished: true`; then `list_my_proposals status=PENDING`.
   - Found and same notice: UPDATE (or nothing to do). Found with a different notice (corrigendum, admit card, result): UPDATE the same recruitment. Not found: NEW. Unsure: AMBIGUOUS, report it.
6. **`preview_proposal`** with the full input and evidence. Read `action`, the before/after rows, `duplicateWarning`, `evidenceMissing`.
   - `CONFIRMED_DUPLICATE`, `PENDING_CHANGE_CONFLICT`, `UNKNOWN_POST`, `UNKNOWN_ORGANISATION`: do not propose; report.
   - `evidenceMissing` not empty: add evidence or drop that field.
7. **`propose_new_recruitment` / `propose_recruitment_update`** with the same input. Use `supersedes` to correct your own pending proposal.
8. An admin approves or rejects in `/admin/pending-changes`. Status shown on the site comes from the lifecycle resolver; never propose a status.

## Rules for values

- Not stated in the official source: leave the field out. Do not infer, and do not copy from an aggregator.
- **Advertisement number:** omit `advtNumber` (or send `null`) when the notice has none. It is stored as NULL and shown as "Not stated". Never put a letter, memo or reference number there.
- Dates are ISO `YYYY-MM-DD`. Vacancies, age, qualification and dates need evidence: `{field, sourceUrl, page, section, snippet, method, confidence}`.
- Admit card, exam city slip, answer key and result belong to the same recruitment: add `importantDates` / `officialLinks` to it (array fields replace the whole list, so send the full list).
- Syllabus: keep the official link (`SYLLABUS_PDF`). Do not invent topics.

## Batches

About 20 candidates per batch. Process only verified ones; exclude and report the rest. Do not fill gaps to reach 20.
Per batch: discover, verify, extract, map, compare, preview, propose. Then spot-check a few records against the original document.
The pending queue holds 50 proposals; ask an admin to review before queuing more.

## Batch report (use exactly this)

```
Added:                  (approved creates, from admin)
Updated:
Proposed:               (queued, awaiting approval)
Skipped:                (reason each)
Could not verify:       (reason each)
Duplicates:
Conflicts:
Dead links:
Missing schema fields:
Human decisions required:
```

## Needs a human (do not work around)

Ambiguous or missing master data, eligibility or vacancy conflicts, duplicate merges, canonical changes, publication, any legal or statutory interpretation.

## Production migration 0014 (nullable advt_number): run by the owner

0014 rebuilds `recruitments` (copies its five child tables aside, swaps, restores, verifies row counts, and aborts the whole migration if any check fails). It is backward compatible with the current code, so apply it first, then deploy the app and MCP.

```
# 1. Backup (keep the file)
npx wrangler d1 export EligibilityEngine-db --remote --output backup-before-0014.sql
# Optional second safety net: note the current Time Travel bookmark
npx wrangler d1 time-travel info EligibilityEngine-db

# 2. Row counts to compare afterwards
npx wrangler d1 execute EligibilityEngine-db --remote --command "SELECT (SELECT COUNT(*) FROM recruitments) r,(SELECT COUNT(*) FROM recruitment_eligibility) e,(SELECT COUNT(*) FROM important_dates) d,(SELECT COUNT(*) FROM vacancies) v,(SELECT COUNT(*) FROM sources) s,(SELECT COUNT(*) FROM official_links) l"

# 3. Apply
npx wrangler d1 migrations apply EligibilityEngine-db --remote

# 4. Verify: same counts as step 2, no leftovers, no dangling keys
npx wrangler d1 execute EligibilityEngine-db --remote --command "SELECT (SELECT COUNT(*) FROM recruitments) r,(SELECT COUNT(*) FROM recruitment_eligibility) e,(SELECT COUNT(*) FROM important_dates) d,(SELECT COUNT(*) FROM vacancies) v,(SELECT COUNT(*) FROM sources) s,(SELECT COUNT(*) FROM official_links) l"
npx wrangler d1 execute EligibilityEngine-db --remote --command "SELECT name FROM sqlite_master WHERE name LIKE '\_mig0014%' ESCAPE '\' OR name='recruitments_new'"
npx wrangler d1 execute EligibilityEngine-db --remote --command "PRAGMA foreign_key_check"
```

Step 4 must show equal counts, no rows from the second query, and none from `foreign_key_check`.
If anything differs, stop and restore from the step 1 export (or Time Travel) before changing anything else.
Then deploy the app (`npm run deploy`) and the MCP (see `mcp/README.md`).

## Automated pipeline (`pipeline/` Worker, migration 0015)

Cron: every 3 h (notices), daily 02:30 UTC (syllabus/books/knowledge), Mondays 03:30 UTC (dead-link check). It only PROPOSES; approve in `/admin/pending-changes`.
Controls live in `/admin/pipeline` (kill switch, auto-publish [OFF], LLM cap, new-draft cap, model, alert email, run log) and `/admin/source-registry`.

Deploy (owner), in this order:
```
# 1. migration 0015 (adds tables; changes nothing existing). Back up first, as for 0014.
npx wrangler d1 migrations apply EligibilityEngine-db --remote
# 2. website (admin pages, version history, footer)
npm run deploy
# 3. pipeline Worker (needs the Workers Paid plan: long runs, 120 s CPU limit)
cd pipeline && npm install
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put PIPELINE_TOKEN        # 24+ random characters
npx wrangler secret put RESEND_API_KEY        # optional: failure emails (set the address in /admin/pipeline)
npx wrangler deploy
```
Dry run (no writes except the run log; makes real LLM calls, so it costs money):
```
curl -X POST https://<worker>.workers.dev/run -H "authorization: Bearer $PIPELINE_TOKEN" -H "content-type: application/json" \
  -d '{"kind":"NOTICES","dryRun":true,"sourceIds":["src_uppsc","src_rpsc"],"maxDocs":6}'
# add "noLlm":true to only test fetching/discovery. Manual runs are dry runs unless "dryRun":false is sent.
```
Results appear in `/admin/pipeline` (open a run to see each document, its extracted record and quoted evidence).
A source turns ACTIVE only after its first successful fetch; 3 failures in a row mark it FAILING and send an alert.
Undo any change: `/admin/recruitments/<id>/versions` -> Restore.

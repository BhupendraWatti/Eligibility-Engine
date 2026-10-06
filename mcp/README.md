# NIRNAY MCP (private AI control plane)

Standalone Cloudflare Worker, separate from the website. It can read and PROPOSE, never apply.

**Scope: all of India.** NIRNAY covers central bodies and every state/UT. Give the MCP any official state or central
recruitment link; nothing in it is tied to one state. Use `resolve_entity` / `list_entities` to find the state
(`stateId`) and organisation, and `propose_master` for any authority that is missing.

| Tool | What it does |
|---|---|
| `search_recruitments` | READ recruitments (filters only, no SQL). Drafts and pending-verification records are included by default for the authenticated MCP; `includeUnpublished=false` limits it to published. The public site only ever queries published rows. |
| `propose_recruitment_update` | Queue a field-level change to an existing recruitment. |
| `propose_new_recruitment` | Queue a brand-new recruitment. |
| `list_my_proposals` | Check the status of proposals this MCP queued (`status=PENDING` is the open queue). |
| `get_proposal` | Full detail of one of its own proposals (payload, evidence, duplicate warning, decision). |
| `withdraw_proposal` | Take back its own PENDING proposal (status becomes WITHDRAWN; nothing is edited or removed). |
| `propose_master` | Resolve a missing organisation, department or post against existing masters (MATCH / POSSIBLE_MATCH / NOT_FOUND); only NOT_FOUND queues a `CREATE_ORGANISATION` / `CREATE_DEPARTMENT` / `CREATE_POST` proposal for admin approval. `dryRun` resolves only. |
| `resolve_entity` | Exact lookup of a state, organisation, department, sector or post: MATCH, AMBIGUOUS or NOT_FOUND. Never guesses. |
| `list_entities` | List active masters of one type, optionally filtered. |
| `get_domain_schema` | Allowed fields, formats, enums and the evidence format, generated from the validators. |

The propose tools also take optional `evidence[]` (field, sourceUrl, page, snippet, method NATIVE/OCR/VISION, confidence;
shown to the reviewer as an unverified claim) and `supersedes` (the id of its own PENDING proposal to replace atomically).
They refuse with a stable error code instead of queueing: `PENDING_CHANGE_CONFLICT` (an open proposal already changes
the same fields of that recruitment), `CONFIRMED_DUPLICATE`, and `UNKNOWN_POST` (the post is not in the master data:
queue it with `propose_master`; the MCP can never create masters, an admin approves them). A possible duplicate is queued with a warning for the reviewer.
The conflict and duplicate checks are best-effort (D1 has no cross-statement transaction); the admin stale-record guard is the backstop.

**Known limits.** Every authenticated client is the same actor (`mcp-client`), so any MCP client can see and withdraw
any MCP proposal, and the pending cap (50) is shared. Add per-client tokens before running a second agent. Tool
deferral/loading in the AI client is client-side and cannot be changed from this server. A notice with no
advertisement number is proposed by omitting `advtNumber` (stored as NULL after migration 0014, shown as "Not stated");
never put an unrelated letter number there.

```
AI client -> mcp/ (bearer auth) -> search:   ../src/services/recruitment-query.ts   -> D1 (read)
                                -> propose:  ../src/services/change-proposals.ts    -> change_proposals (PENDING)
Owner -> /admin/pending-changes -> Approve -> existing atomic writers -> live tables + audit_logs
```

Nothing is live until the owner approves it in `/admin/pending-changes` (before/after diff, stale-record
warning, approve/reject). Proposals cannot set publication status, ids or slugs, and a new recruitment is
saved as a DRAFT unless the owner ticks "Publish now". The MCP never calls the recruitment writers (a test
enforces this). Apply migrations `0010_change_proposals.sql` and `0013_proposal_lifecycle.sql` (`npx wrangler d1 migrations apply EligibilityEngine-db --remote`)
before using the proposal tools (0013 adds WITHDRAWN support, `supersedes_id` and `meta`).

This folder has its own `package.json`, `node_modules` and `wrangler.jsonc`. It only imports the website's
code (`../src/...`); it never edits it, and the website's Cloudflare build ignores this folder.
Both use the same D1 database. It exposes no SQL and no generic CRUD.

## Run locally
1. `cd mcp && npm install`
2. `cp .dev.vars.example .dev.vars` and set `MCP_API_TOKEN` (24+ chars).
3. `npm run dev` (serves `http://127.0.0.1:8787/mcp`, shares the website's local D1 state in `../.wrangler/state`).
4. `npm test` and `npm run typecheck`.

## Deploy
```
cd mcp
npx wrangler secret put MCP_API_TOKEN --config wrangler.jsonc
npm run deploy        # -> https://nirnay-mcp.<your-subdomain>.workers.dev/mcp
```

## Connect Claude Desktop (no Claude API key, uses your Claude subscription)
Claude Desktop's custom connectors cannot send a static bearer header, so use the `mcp-remote` bridge
(runs on your PC, needs Node). Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nirnay": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://nirnay-mcp.<your-subdomain>.workers.dev/mcp",
               "--header", "Authorization:${NIRNAY_AUTH}"],
      "env": { "NIRNAY_AUTH": "Bearer <MCP_API_TOKEN>" }
    }
  }
}
```
For local testing use `http://127.0.0.1:8787/mcp` and add `"--allow-http"` to `args`. Restart Claude Desktop.

## Connect Claude Code
`claude mcp add --transport http nirnay https://nirnay-mcp.<your-subdomain>.workers.dev/mcp --header "Authorization: Bearer <MCP_API_TOKEN>"`

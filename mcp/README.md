# NIRNAY MCP (private AI control plane)

Standalone Cloudflare Worker, separate from the website. READ-only for now: one tool, `search_recruitments`.

```
AI client -> mcp/ (bearer auth) -> ../src/services/recruitment-query.ts -> Drizzle -> D1
```

This folder has its own `package.json`, `node_modules` and `wrangler.jsonc`. It only READS the website's
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

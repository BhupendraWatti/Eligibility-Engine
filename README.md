# NIRNAY Eligibility Engine

NIRNAY is an Astro SSR application for managing Indian public-recruitment master data, publishing recruitment drives, and evaluating candidate eligibility. It runs on Cloudflare Workers with D1 and uses in-memory data only for local unit tests that do not provide a D1 binding.

## Prerequisites

- Node.js 22.12 or newer
- npm
- A Cloudflare account only when testing remote D1 or deploying

## Local setup

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars
npx wrangler d1 migrations apply EligibilityEngine-db --local
npx astro dev --background
```

The site is available at `http://localhost:4321`. Localhost receives the seeded development administrator identity. Production requests require Cloudflare Access, `ADMIN_EMAILS`, and an active `admin_users` record.

Manage the background server with:

```powershell
npx astro dev status
npx astro dev logs
npx astro dev stop
```

## Validation

Run the complete local quality gate:

```powershell
npm run check
```

This runs the tests, TypeScript checking, and production build. Development and build use separate Vite caches, so validation does not invalidate a running development server.

Focused commands:

```powershell
npm test
npm run typecheck
npm run build
```

## Database migrations

Always prove migrations locally before applying them remotely:

```powershell
npx wrangler d1 migrations apply EligibilityEngine-db --local
npx wrangler d1 migrations list EligibilityEngine-db --local
```

Only after local validation and release approval should production be changed:

```powershell
npx wrangler d1 migrations apply EligibilityEngine-db --remote
```

## Admin API testing

Deployed automated tests may use `x-admin-bypass` only when its value exactly matches the server-side `ADMIN_TEST_BYPASS_TOKEN` secret:

```powershell
npx wrangler secret put ADMIN_TEST_BYPASS_TOKEN
```

Caller-controlled host headers, query parameters, user agents, and the literal value `true` do not bypass authentication.

## Architecture

- [CONTEXT.md](./CONTEXT.md): platform architecture, schema, security, and operating rules.
- [Recruitment lifecycle domain](./docs/RECRUITMENT_LIFECYCLE_DOMAIN.md): canonical publication and lifecycle behavior.
- [DESIGN.md](./DESIGN.md): admin-console visual system.

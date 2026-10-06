## Scope

NIRNAY covers **all of India** (central bodies and every state/UT), not a single state. Never add logic or copy that assumes Madhya Pradesh only. Domicile rules are per-recruitment (`domicileStateCode`); fields named `...Mp...` are legacy names kept for database/API compatibility.

## Project Architecture & Context Memory

Before making architectural decisions, editing database queries, altering lifecycle states, or modifying eligibility calculation logic, always consult the comprehensive project architecture guide:

- [CONTEXT.md](file:///d:/Personal%20Projects/Eligibility%20Engine/markdown/CONTEXT.md) — Complete Platform Memory, Relational Schema, Deterministic Engine Rules, and Operational Playbook.
- [RECRUITMENT_LIFECYCLE_DOMAIN.md](file:///d:/Personal%20Projects/Eligibility%20Engine/docs/RECRUITMENT_LIFECYCLE_DOMAIN.md) — Canonical Recruitment Lifecycle & Metric Standards.


## Development

When starting the dev server, use background mode:

```
astro dev --background
```

The private MCP server lives in `mcp/` (own packages and deploy, see `mcp/README.md`). It only reads this app's code (`src/services/recruitment-query.ts`, `src/db/queries.ts`) and must never change website behaviour. It may READ (`search_recruitments`) and PROPOSE changes (`src/services/change-proposals.ts` inserts into `change_proposals`); it must never call the recruitment writers. Only an admin approving in `/admin/pending-changes` (`src/services/change-proposal-decision.ts`) can make a proposal live.

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)


## Design System
Always read [DESIGN.md](file:///d:/Personal%20Projects/Eligibility%20Engine/DESIGN.md) before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.




# TODOS

## Viewer state & relevance (follow-ups to docs/designs/viewer-state-relevance.md)

- **Shared recruitment predicates module.** Move text match and state match out of `src/services/recruitment-query.ts` into a module imported by both the Public Listing and the MCP. Deferred from v1 by /plan-ceo-review (HOLD-01, 2026-10-07) so v1 does not touch the MCP's file. Do it with the next page migration; re-run MCP tests. Status classification stays in `src/services/lifecycle.ts`.
- **Migrate remaining public list pages to the Public Listing:** `search.astro`, `sectors/[sector].astro`, `results/index.astro`, `admit-cards/index.astro`, `calendar.astro`. Each still calls `getAllActiveRecruitments()` with the 100-row default and re-implements filters inline.
- **One sector membership rule.** `sectors/[sector].astro:26-30` matches by first word of the sector name in the title; `calculateSectorActiveDrives` (`src/db/queries.ts:1610`) uses `postId → sectorId`. Card counts and page lists can disagree.
- **Restore domain docs.** CLAUDE.md points to `markdown/CONTEXT.md` (now a partial glossary, gitignored) and `docs/RECRUITMENT_LIFECYCLE_DOMAIN.md` (deleted in 085ec63; recover with `git show 085ec63^:docs/RECRUITMENT_LIFECYCLE_DOMAIN.md`).
- **Eligibility checker evaluates only 100 recruitments.** `src/pages/eligibility-checker.astro` calls `getAllActiveRecruitments()` with the default 100-row cap, so at India-wide scale some recruitments are never evaluated. Load through `loadPublicRecruitments` (or raise/paginate) when migrating the other pages.

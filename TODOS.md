# TODOS

## Viewer state & relevance (follow-ups to docs/designs/viewer-state-relevance.md)

- **Shared recruitment predicates module.** Move text match and state match out of `src/services/recruitment-query.ts` into a module imported by both the Public Listing and the MCP. Deferred from v1 by /plan-ceo-review (HOLD-01, 2026-10-07) so v1 does not touch the MCP's file. Do it with the next page migration; re-run MCP tests. Status classification stays in `src/services/lifecycle.ts`.
- **Migrate remaining public list pages to the Public Listing:** `search.astro`, `sectors/[sector].astro`, `results/index.astro`, `admit-cards/index.astro`, `calendar.astro`. Each still calls `getAllActiveRecruitments()` with the 100-row default and re-implements filters inline.
- **One sector membership rule.** `sectors/[sector].astro:26-30` matches by first word of the sector name in the title; `calculateSectorActiveDrives` (`src/db/queries.ts:1610`) uses `postId → sectorId`. Card counts and page lists can disagree.
- **Restore domain docs.** CLAUDE.md points to `markdown/CONTEXT.md` (now a partial glossary, gitignored) and `docs/RECRUITMENT_LIFECYCLE_DOMAIN.md` (deleted in 085ec63; recover with `git show 085ec63^:docs/RECRUITMENT_LIFECYCLE_DOMAIN.md`).
- **Eligibility checker evaluates only 100 recruitments.** `src/pages/eligibility-checker.astro` calls `getAllActiveRecruitments()` with the default 100-row cap, so at India-wide scale some recruitments are never evaluated. Load through `loadPublicRecruitments` (or raise/paginate) when migrating the other pages.

## Recruitment detail page (from /qa on claude/lucid-banach-4b4f29, 2026-10-07)

- **Low, Content: two different empty-state lines for dates.** With no date events, the Important Dates tab says "Schedule dates will be listed once {org} publishes them in the official notification" while the side rail says "No dates published in the official notice yet". Repro: delete a recruitment's `important_dates` rows in local D1 and open `/recruitments/<slug>`. Use one sentence in both (`src/pages/recruitments/[slug].astro`).
- **Admin edit invents an age cutoff.** `src/pages/admin/recruitments/[id]/edit.astro:57` saves `'2026-01-01'` when the cutoff field is blank; the public page then shows it as the notice's cutoff. Make the field required instead of defaulting.

## Tooling

- **`npm run deploy` is broken.** `package.json` `deploy` (and `deploy:vinext`, `build:vinext`, `preview:vinext`) call `vinext-cloudflare` against an Astro build. Working sequence today: `npm run build`, check `npx wrangler d1 migrations list EligibilityEngine-db --remote`, then `npx wrangler deploy --config dist/server/wrangler.json`. Make one script do that (migrations check first) and drop the vinext scripts. Independent of worktree setup. (From /plan-devex-review, 2026-10-07.)

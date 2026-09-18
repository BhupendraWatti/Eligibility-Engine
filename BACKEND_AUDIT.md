# NIRNAY Backend Business Logic & Data-Flow Audit

**Audit date:** 2026-09-18  
**Scope:** Backend business logic, persistence, admin-to-public data flow, eligibility, lifecycle artifacts, performance, and multi-state readiness.  
**Constraint observed:** No application code was changed. This file is the audit deliverable.

## Executive verdict

**The current backend is not safe for importing authoritative government data yet.** The relational model is a useful foundation and the pure eligibility/lifecycle functions have meaningful passing tests, but the production integration has several data-integrity failures:

1. Database read failures and empty tables silently fall back to demo records.
2. Recruitment create/update can return success after a D1 batch fails.
3. The configured migration directory, Drizzle migration directory, declared schema, and local D1 schema have diverged.
4. `*.workers.dev` bypasses admin authentication.
5. Draft/pending recruitment details are retrievable publicly by known slug.
6. Save Draft/Publish, duplicate detection, and several eligibility fields are not connected end to end.
7. Admit cards and answer keys have UI states that the canonical lifecycle resolver cannot produce.

This does **not** require a rebuild. Keep Astro, D1, Drizzle, the existing normalized recruitment tables, the detail query, and the pure eligibility evaluator. Fix the integrity boundary, migration baseline, admin security, lifecycle predicates, and eligibility input wiring before the real-data import.

## Audit method and evidence

The audit traced the declared schema, both migration trees, local D1 state, read/write services, middleware, admin POST handlers, public routes, and eligibility components. It also ran the available logic tests through the installed `tsx` runner.

- Eligibility: 17/17 test groups passed.
- Batch eligibility: 7/7 passed.
- Regression/data guards: 15/15 passed.
- Notification extraction: 18/18 passed.
- Lifecycle/metrics: 15/15 passed.
- `npx tsc --noEmit`: failed, including Drizzle relation typing, an incomplete mapped recruitment object, a React `class` attribute, and test/type-union errors.
- Native Node test discovery cannot resolve the extensionless TypeScript imports. There is no `test` script in `package.json`; tests currently require an undocumented direct `tsx` invocation.

The remote D1 database was not queried. “Actual database” below therefore distinguishes the repository contract from the local D1 instance; the remote schema must be verified before import.

---

## 1. Business logic map

```text
Cloudflare Access / middleware
          │
          ▼
Admin Astro forms ──POST──► src/db/queries.ts service functions
                                  │
                                  ├──► Drizzle/D1 batch writes
                                  ├──► in-memory fallback mutation
                                  └──► audit-log insert/fallback
                                               │
                                               ▼
Public Astro SSR routes ◄── query helpers ◄── D1
          │                       │
          │                       └── on error/empty: demo fallback data
          ▼
Rendered pages / serialized eligibility dataset
          │
          ▼
User browser; eligibility is evaluated client-side and its report is kept in sessionStorage
```

The intended flow is sensible, but the fallback branch is part of the normal production query path. “Database unavailable,” “table empty,” and sometimes “record absent” can become “serve demo government information,” instead of an observable error or empty state.

| Feature | Admin/source of truth | Backend and persistence | Public/user flow | Current reality |
|---|---|---|---|---|
| Jobs / recruitments | Recruitment new/edit forms | Atomic-named create/update functions; recruitment plus child tables | Jobs, sector, organisation, post, search and detail pages | Partly persisted; writes can falsely report success and reads can substitute demo data. |
| Exams | Recruitment fields and dates | `exam_status`; `EXAM_DATE` milestone | Search/calendar/detail | No Exam entity; one effective status/date per recruitment. |
| Results | Recruitment fields | `result_status`; generic result date/link | Results page | No result record, cutoff, merit list or version model. |
| Admit cards | No functional artifact workflow | Intended lifecycle/date/link convention | Admit-card page | No entity; release state is erased by canonical lifecycle resolution. |
| Answer keys | No functional artifact workflow | Intended lifecycle/link convention | Answer-key page | No entity; active state is unreachable. |
| Guides/editorial posts | No real editor | None | Generic post pages | Content is hardcoded/derived. The `posts` table is job taxonomy, not editorial content. |
| Eligibility | Recruitment criteria and fallback fixtures | Pure evaluator; optional batch wrapper | Dataset serialized to React wizard; report in `sessionStorage` | Core works in isolation; real criteria and user inputs are incompletely mapped. |
| Organisations | Hardcoded admin screen | Table and read queries | Organisation pages/cards | Table exists; admin save is alert-only. |
| Departments | Admin screen | Table and read queries | Canonical post relationship | Reads exist; save is alert-only. |
| Sectors | Read-only master screen | Table | Sector pages | Persisted read model; no functional CRUD. |
| Canonical posts | Functional master-data admin | `posts` table | Post pages and recruitment join | CRUD exists but shares fallback state. |
| Important dates/statuses | Recruitment form | Milestone children plus status columns | Page labels/lifecycle resolver | Persisted, but status vocabularies disagree. |
| Official sources/links | Recruitment form; mock verification screen | Source/link children | Detail pages; other pages use organisation URL | Persisted in detail; omitted from list mapping and verification is alert-only. |

The organisations, departments, source verification, eligibility-rule, documents, SEO, settings/staff, and audit-log screens contain hardcoded data and/or alert-only actions. The dashboard also substitutes demo KPI values when real counts are zero. They must not be treated as operational controls during import.

---

## 2. Database and relationships

### Declared entities

| Entity | Purpose and relationships | Readiness note |
|---|---|---|
| `states` | State master; parent of organisations and recruitments | Real table; create path hardcodes MP. |
| `organisations` | FK `state_id → states`; parent of departments/recruitments | Indexed by state; admin CRUD missing. |
| `departments` | FK `organisation_id → organisations` | Unique `(organisation_id, slug)`; admin save missing. |
| `sectors` | Sector master; parent of canonical posts | Real read model. |
| `posts` | FK to department/sector; parent of recruitments | Canonical job taxonomy, not articles. |
| `recruitments` | FK to post/organisation/state; aggregate root | Holds publication, lifecycle, exam and result statuses. |
| `recruitment_eligibility` | Unique FK to recruitment, cascade delete | One-to-one criteria; no rule version/provenance. |
| `vacancies` | Many rows per recruitment, cascade delete | Category/gender breakdown. |
| `important_dates` | Many typed milestones per recruitment, cascade delete | Generic lifecycle milestones. |
| `sources` | Many source documents/URLs, cascade delete | Missing `recruitment_id` index. |
| `official_links` | Many typed URLs, cascade delete | Missing `recruitment_id` index. |
| `admin_users` | Intended account/role state | Middleware does not consult it. |
| `audit_logs` | Change history with logical IDs | Viewer/KPI uses fallback; actor attribution defaults incorrectly. |
| `records` | Generic key/value/status record | No demonstrated production consumer. |

The principal domain FKs and cascade relationships are a sound base. Material gaps are operational: missing source/link child indexes, no database uniqueness for the business identity of an advertisement, and migration drift.

### Repository schema versus local D1

There are two migration histories:

- `wrangler.jsonc` points D1 at `migrations/` (`0001`–`0003`).
- `drizzle.config.ts` writes to `drizzle/` (`0000`–`0001`).

They are not equivalent. The populated local D1 records only `0000_sour_jamie_braddock.sql`; it lacks the declared `audit_logs` and `records` tables and later recruitment content, validation, exam, and result columns. The TypeScript schema defaults lifecycle to `NOT_STARTED`, while the initial SQL migration uses `UPCOMING`.

Local query plans show recruitment slug and important-date lookups use indexes, while source and official-link lookups by recruitment scan their tables.

**Conclusion:** the TypeScript schema is not proof of the deployed schema. Establish one migration directory, baseline deliberately, test on disposable D1, and compare the result to `src/db/schema.ts`. Repeat a read-only comparison against remote D1 before any import.

| Capability | Persistence status |
|---|---|
| Recruitment core, criteria, vacancies, milestones, sources, links | Persisted by schema; integration incomplete. |
| Lifecycle presentation | Derived from dates/statuses and overwritten by canonical resolver. |
| Exam/result | Fields and milestones on Recruitment, not independent records. |
| Admit card/answer key | UI filters/labels; no complete persisted model. |
| Editorial guides | Hardcoded/derived. |
| Organisation/department admin editing | Mock despite tables existing. |
| Eligibility report/profile | Browser session only. |

---

## 3. Backend feature readiness

| Feature | Rating | Reason |
|---|---:|---|
| Jobs / recruitments | 🟡 | Normalized storage exists; write acknowledgement, duplicate enforcement, draft/publish behavior, fallback reads, and field persistence are unsafe. |
| Exams | 🟡 | A single status/date can be represented; multi-stage exams cannot. |
| Results | 🔴 | UI exists, but results are conventions rather than a result backend. |
| Admit cards | 🔴 | Release state is not representable after canonical resolution and artifact links are not consumed. |
| Answer keys | 🔴 | `ANSWER_KEY_OUT` is outside the canonical lifecycle and no artifact workflow exists. |
| Guides/editorial posts | 🔴 | No editorial entity or publishing workflow. |
| Eligibility engine | 🟡 | Pure evaluator is useful; database mapping, questionnaire inputs, unsupported rules, and reporting are incomplete. |
| Organisations/departments/sectors | 🟡 | Tables/read paths exist; required admin operations are incomplete or mock. |
| Canonical posts | 🟡 | CRUD exists, but participates in the fallback dual-source design. |
| Important dates/statuses | 🟡 | Generic dates are usable; lifecycle vocabulary and page filters disagree. |
| Official sources/links | 🟡 | Persisted in detail; verification, indexing and list-page use are incomplete. |
| Admin authentication/authorization | 🔴 | `workers.dev` bypasses auth; database role/active status is not enforced. |
| Audit trail | 🔴 | Schema, writer attribution, viewer and KPI are not reliably connected. |

No requested feature is production-ready end to end today. Several building blocks are already sufficient and should be repaired rather than replaced.

---

## 4. Eligibility engine

`evaluateEligibility(profile, criteria)` produces a tri-state result: a definitive failed rule gives `NOT_ELIGIBLE`; missing required input without a failure gives `NEEDS_VERIFICATION`; all matches give `ELIGIBLE`. It evaluates gender, domicile, age at cutoff, relaxations, qualification rank, stream text, percentage, MP employment registration, CPCT, height/chest, and skill strings. `getEligibleJobs` applies it across jobs and builds follow-up questions.

Rules are hybrid, not purely database-driven:

- detail reads map persisted `recruitment_eligibility` data;
- list reads map only a subset;
- failures/empty data inject fallback criteria;
- qualification hierarchy, relaxation combination, MP checks, labels and string matching are hardcoded;
- the wizard calls the single evaluator itself rather than the tested batch orchestration.

### Live-flow correctness gaps

1. The wizard asks completed age and invents a January 1 DOB, causing up to roughly a year of cutoff error.
2. Stream, percentage, passing year, experience, height, chest, and actual skill lists are not fully collected/sent.
3. One “CPCT / ITI / Hindi Typing” answer maps only to `hasCpct`; those credentials are not interchangeable.
4. `experience_months` is stored but never evaluated.
5. The list mapper drops richer criteria, so the browser can evaluate an incomplete rule set.
6. Missing eligibility rows can become permissive defaults rather than unpublishable/unknown.
7. A generic qualification rank is unsafe for trade-, subject-, registration-, or degree-specific requirements.
8. Female/category relaxations use `max(...)`, not a per-notification stacking policy.
9. The saved report uses `hasRojgarPanjiyan`, while the renderer reads `hasMpRojgarPanjiyan`; CPCT is omitted from saved profile data.
10. Report opportunity strings are inserted with `innerHTML`; database-originated text should be escaped/rendered as text.

The evaluator’s CPU cost is linear in jobs × rules and fine for a small catalogue. The scale problem is sending every published recruitment/criteria set to the client with no SQL state/status bound or pagination.

### Multi-state suitability

The pure tri-state aggregation can be retained, but arbitrary states are not supported without input-model changes. MP is embedded in names (`isMpDomicile`, `hasMpRojgarPanjiyan`), labels, admin defaults, fixtures and UI copy. Replace those with a small typed list of per-notification requirements; do not rewrite the core result aggregation.

---

## 5. Jobs → Exam → Admit Card → Answer Key → Result

```text
Recruitment
 ├─ exam_status (single field)
 ├─ result_status (single field)
 ├─ lifecycle_status (single field, then canonically resolved)
 ├─ important_dates[] (generic typed milestones)
 └─ official_links[] (generic typed URLs)
```

- **Job/recruitment:** the real aggregate root.
- **Exam:** status plus generic dates; multiple stages are descriptive JSON/text, not addressable events.
- **Admit card:** no entity/child lifecycle. Its page checks `ADMIT_CARD_RELEASED`, but the resolver converts that input to `EXAM_SCHEDULED`.
- **Answer key:** no entity. Its page checks `ANSWER_KEY_OUT`, which the canonical lifecycle never produces.
- **Result:** a status can yield “declared,” but there is no result version, cutoff, merit list or structured record.

List pages do not load official links and commonly use the organisation URL. These pages are recruitment filters, not a verified artifact chain.

### Minimum correction

Do not create five new aggregates immediately. For single-stage notices, existing dates/links are enough if the backend:

1. enforces typed milestones/link types for exam, admit card, answer key, objections and result;
2. derives availability from those persisted child records, not impossible lifecycle strings;
3. loads the relevant official link on each page;
4. validates chronology before publication.

Add independent exam-stage/artifact entities only when multi-stage exams, key versions, objection windows, or result revisions become real requirements.

---

## 6. Performance and Cloudflare/D1 constraints

| Finding | Impact | Priority |
|---|---|---:|
| `getAllActiveRecruitments` reads all published records; pages filter/sort in JS | Unbounded database and memory work | High before growth |
| Organisation detail loads all organisations, recruitments and departments; post detail loads all posts/recruitments | Whole-catalogue joins in application code | High |
| Search loads full recruitment/post/sector catalogues | Not database search | High |
| Eligibility serializes all criteria | Excess HTML/client CPU | Medium now; high at scale |
| Source/link FKs lack indexes | Confirmed full scans locally | Medium/High |
| List mapping loads some relations but omits required sources/links/rich criteria | Incorrect defaults plus wasted work | High correctness |
| Status logic is duplicated/incompatible | Unreachable and inconsistent states | High correctness |

No conclusive classic one-query-per-row N+1 loop was found in page code. The demonstrated issue is overfetching and in-memory joining/filtering. Production query telemetry should confirm Drizzle’s actual relation query count before calling it N+1.

Relevant platform constraints:

- D1 executes queries against one database one at a time; long scans reduce throughput.
- Current D1 limits include 30-second query duration and 100 bound parameters; database size is 500 MB Free and 10 GB Paid.
- Workers have 128 MB memory per isolate. CPU is 10 ms Free and defaults to 30 seconds Paid; the current limits page does not impose a response-body limit.
- `D1Database.batch()` is transactional and rolls back on failure. The defect is swallowing that failure and returning success.
- D1 enforces foreign keys by default; migration correctness still matters.

References: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/), [D1 foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/).

---

## 7. Multi-state readiness

### Genuine blockers

1. Creation hardcodes `stateId: 'st_mp'`.
2. Creation resolves posts/organisations from MP-oriented fallback arrays, not database masters.
3. Eligibility encodes MP domicile and Rojgar Panjiyan directly.
4. List/search queries do not require or efficiently apply state scope.
5. Admin organisation data and search filters are hardcoded.
6. The rule vocabulary cannot express arbitrary state registrations, language tests, reservations, certificates, or relaxation policies without adding fields/code.
7. Routes/content taxonomy do not consistently carry state context.

### Can safely wait

- Separate D1 databases or subdomains per state.
- Automated state/department scraping.
- A general workflow/rules DSL.
- Separate exam/result aggregates.
- User accounts, history, localization and a guide CMS.

The minimum expansion is: make state mandatory in admin input and SQL, load masters from D1, and use typed per-notification requirements while preserving the evaluator.

---

## 8. Essential backend upgrade plan

### MUST FIX NOW

1. **Make D1 authoritative:** remove production demo fallback; errors must be observable and empty data must remain empty. Keep fixtures only in test/dev.
2. **Make writes truthful:** return success only after commit; propagate a stable error; never mutate fallback state first.
3. **Unify migrations:** one lineage matching `schema.ts`; test on disposable D1; read-only compare remote before import; add source/link FK indexes.
4. **Secure admin:** remove the `workers.dev` bypass or disable that host; enforce real active admin/role and audit actor; add/verify CSRF protection.
5. **Block unpublished detail access:** public query requires `PUBLISHED`; admin preview uses an authorized query.
6. **Repair publishing:** distinguish Draft/Publish, enforce validation/duplicate results, add a suitable DB business-identity uniqueness rule, and never invent vacancy/source facts.
7. **Persist advertised fields:** state/post/org/cycle/featured, all relaxations, percentage, streams, skills and experience; upsert missing eligibility; permit intentional child deletion.
8. **Fix live eligibility:** collect DOB and real requirements, pass full criteria, evaluate/mark experience, fix report property names, and render text safely.
9. **Make artifact pages truthful:** use persisted typed dates/links/statuses and actual official URLs; remove unreachable lifecycle checks.
10. **Use bounded SQL:** pagination/limits and state/status/sector/org/search predicates; stop whole-catalogue detail/search queries.
11. **Create a release gate:** expose the passing `tsx` suites through package/CI, fix full typecheck, and add D1 integration tests for read failure, write rollback, draft leakage, duplicates and artifact visibility.
12. **Make required master admin real:** organisations, departments, source/link verification and state selection must persist; hide/label remaining mock controls.

### CAN WAIT

- Dedicated Exam/AdmitCard/AnswerKey/Result tables until stages/versions require them.
- Server-side eligibility API while the bounded catalogue is small.
- Guide CMS, SEO settings, document library, accounts, notifications, analytics, scraping and R2.
- A sophisticated rules DSL; typed requirements suffice initially.
- Advanced audit export, separate state databases/subdomains and localization.

### ALREADY SUFFICIENT

- Astro SSR on Workers with D1/Drizzle.
- Recruitment as the first-release aggregate root.
- Existing master/child relational shape and cascades.
- D1 batch transactions as the atomic mechanism.
- The scoped recruitment detail-query pattern.
- Pure tri-state eligibility evaluation and current unit cases.
- Basic application-window lifecycle/metrics helpers.
- Notification extraction as an assisted draft tool with mandatory human verification.

---

## 9. Root causes and final risk

### Critical

- **Fail-open demo data:** production repository functions and fixtures are one implementation, turning outages/schema errors into plausible fake records.
- **False write success:** D1 exceptions are caught and ignored after in-memory/audit mutation.
- **Migration split brain:** two migration directories differ from schema and local D1, triggering read/write failures and then fallback behavior.
- **Public/admin boundary:** hostname is treated as authorization and the public detail query omits publication status.

### High

- Duplicate detection is computed but unused; Draft/Publish converge; `forcePublish` is ignored; synthetic vacancy splits can be stored as facts.
- Page lifecycle values conflict with the canonical resolver.
- Engine capabilities exceed both the list mapper and wizard input set.
- Master-data screens are not the creation service’s source of truth.

### Medium

- Whole-catalogue queries and two missing indexes will be the first scale bottleneck; no new cache/database is needed yet.
- Audit actor/schema/viewer are not trustworthy enough for government-data changes.
- Direct tests pass, but no standard test/CI command exists and full typecheck fails.

---

## 10. Backend-only simplicity audit (Ponytail)

1. `<delete: ~900–1,200 LOC, 0 deps> Remove the production fallback catalogue from src/db/queries.ts; retain minimal fixtures in test/dev modules.`
2. `<shrink: ~100–180 LOC, 0 deps> Use one recruitment row-to-domain mapper instead of list/detail mappings and repeated JSON parsing.`
3. `<delete-or-use: ~120–180 LOC, 0 deps> Batch eligibility is tested but unused by the wizard; make it the one UI path or remove the duplicate orchestration.`
4. `<native: ~10 LOC, 0 deps> Replace timestamp-plus-Math.random IDs with crypto.randomUUID().`
5. `<yagni: ~15–30 LOC, 0 deps> Remove the unused generic records table unless a named production workflow owns it.`
6. `<shrink: ~20–40 LOC, 0 deps> Remove unused detail-query parsing and wrappers with no distinct contract.`

Estimated simplification opportunity: **~1,100–1,600 backend lines, zero dependencies**, dominated by removing demo data from the production repository. This should accompany the integrity fixes, not trigger a rewrite.

## Final verdict

**Do not import real government data into the current backend.** The immediate danger is silent corruption of truth: demo data on failed reads, success on failed writes, divergent schemas, open preview-host admin access, and public draft retrieval.

Fix those boundaries, then repair publication/eligibility wiring and add bounded SQL queries. Once the MUST FIX items pass on disposable D1 and the remote schema is verified, the existing stack is suitable for an initial real-data release. Dedicated artifact entities, a generic rules DSL, extra infrastructure, and a broad redesign can wait for real requirements.

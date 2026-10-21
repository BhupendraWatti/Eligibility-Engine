# Design: eligibility tests and entrance exams (no vacancies)

Written 2026-10-21 in the structure of /office-hours, /plan-ceo-review and /plan-eng-review (those skills are not installed in
this environment, so the three passes were done by hand and recorded below).
Branch: claude/nice-bell-kuufqn
Repo: BhupendraWatti/Eligibility-Engine
Status: IMPLEMENTED

## Problem Statement

The MCP could only add **job recruitments**. Running it on UGC NET hit three walls:

1. **"Vacancy count is required."** `totalVacancies` was required on every new recruitment. An eligibility test has no
   vacancies: everyone who meets the conditions may sit, and everyone who clears the cutoff qualifies (if 100 sit and 20 clear
   the cutoff, those 20 have qualified; there is no fixed number of seats).
2. **"The organisation and post don't exist yet."** No master existed for the National Testing Agency, and nothing told the
   MCP how a national test maps onto organisation -> department -> post -> sector.
3. **"It's built for jobs, not eligibility tests."** Even if forced in, the site would have shown "0 posts", an invented upper age
   limit (default 33), "Central Govt Job" SEO and `JobPosting` markup.

## Facts the design relies on (checked)

- The **National Testing Agency (NTA)** is an autonomous body set up by the Ministry of Education. It conducts UGC NET on behalf of
  the University Grants Commission (since December 2018), CSIR-UGC NET, JEE Main, NEET UG and CUET (nta.ac.in).
  So for UGC NET: UGC is the body the test is for, NTA is the body that conducts it. NET (National Eligibility Test) is the exam,
  not an organisation.
- CTET is conducted by CBSE; state TETs and SETs by state boards or state-designated universities. GATE is conducted by IISc and the IITs.
- Many of these exams state **no upper age limit** (UGC NET for Assistant Professor; NEET UG has had no upper age limit since 2022),
  while some parts do have one (UGC NET JRF: not more than 30 years).
- Entrance exams (JEE Main, NEET UG, CUET) rank candidates (percentile / All India Rank) for admission; eligibility tests certify
  candidates (qualifying marks / percentile). Neither has vacancies.

## Premises (agreed)

1. A qualifying exam is a first-class listing type, not a job with 0 vacancies. Showing "0 posts" is wrong information.
2. A vacancy count on a qualifying exam is refused, so nobody can invent one. A job still needs its quoted count.
3. A central test is open to every Indian citizen: the existing Central rule (domicile forced OPEN) already covers it.
   State TETs keep the normal per-state domicile rules (all-India scope, CLAUDE.md).
4. "No upper age limit" must be stored as such. Leaving `maxAgeGeneral` out would silently default to 33 and wrongly
   exclude older candidates: the wrong answer must not be the easy one (same principle as docs/designs/domicile-scope.md).

## Approaches Considered (CEO review: scope)

- **A: Accept `totalVacancies: 0` and change nothing else.** Rejected: the site shows "0 posts", JobPosting markup, "govt job" SEO,
  and the age default stays wrong.
- **B (chosen): `recruitments.exam_kind` + `recruitment_eligibility.no_upper_age_limit`.** One enum (RECRUITMENT default |
  ELIGIBILITY_TEST | ENTRANCE_EXAM) read through one helper module; every existing row stays a job.
- **C: Separate `exams` table and pages.** Rejected for now: duplicates the lifecycle, dates, links, sources, proposal and approval
  machinery that already fits an exam exactly.
- **Not in scope:** storing cutoffs or the number of candidates who qualified (results stay as RESULT / SCORECARD links and
  `resultStatus`); a separate "entrance exams" section in navigation.

## Implementation (eng review)

### Data — `migrations/0019_qualifying_exams.sql`
- `recruitments.exam_kind TEXT NOT NULL DEFAULT 'RECRUITMENT'`
- `recruitment_eligibility.no_upper_age_limit INTEGER NOT NULL DEFAULT 0`
- Seeds sector `sec_national_tests` ("National Eligibility & Entrance Tests") and organisation `org_nta`
  (National Testing Agency, Central Government, https://nta.ac.in). `INSERT OR IGNORE`, so re-running is safe.

### One helper — `src/services/exam-kind.ts`
`EXAM_KINDS`, `isQualifyingExam`, `vacancyLabel`, `vacancyPhrase`, `ageRangeLabel`. Every page reads vacancy and age text through it.

### Writers — `src/db/queries.ts`
- Create: a qualifying exam always stores `total_vacancies = 0`; default short summary says "qualifying exam … no fixed vacancies".
- Update: `examKind` / `noUpperAgeLimit` undefined keep the stored value (admin forms that do not send them change nothing).
- `change-proposal-decision.ts#mergeUpdateInput` carries both, so an approved MCP update keeps them.

### MCP surface — `src/services/change-proposals.ts`, `reference-data.ts`, `mcp/src/server.ts`
- New proposable fields: `examKind` (enum), `noUpperAgeLimit` (bool). Both need a quote like every fact.
- `CREATE_REQUIRED` is now title, postId, organisationId; `totalVacancies` is required only for a job → `VACANCIES_REQUIRED`.
- A qualifying exam (sent, or already stored on update) with `totalVacancies` or `vacanciesBreakdown` → `VACANCIES_NOT_APPLICABLE`.
- `noUpperAgeLimit: true` together with `maxAgeGeneral` is refused (UGC NET JRF/AP difference goes in `postSpecificRules`).
- Fact check: a quote saying "no upper age limit" (English or Hindi) is machine-matched; anything else is flagged for reading.
- Server instructions, `get_domain_schema` (enums, `eligibilityNotes`, `createRequiredForJobs`), tool descriptions and
  `search_recruitments` output (`examKind`) describe the rule and the master mapping.

### Engine and pages
- `src/engine/eligibility.ts`: with `noUpperAgeLimit`, only `minAge` is checked.
- `publication-validator.ts`: the 18-65 max-age range is skipped when there is no upper limit.
- Recruitment page: "Exam type" instead of "Vacancies", "How candidates qualify" panel, "no upper age limit", and **no JobPosting
  JSON-LD** for a qualifying exam. Jobs, search, sector, organisation, post-guide, home and wizard use the helper.
- `seo.ts`: "{title} – Eligibility Test / Entrance Exam" and exam keywords instead of "govt job".
- Admin editor: listing-type select and a "No upper age limit" checkbox.

## Master mapping for qualifying exams

| Master | UGC NET example |
|---|---|
| Organisation (conducting body) | National Testing Agency (`org_nta`, Central Government) |
| Department (body the test is for, as the notice names it) | University Grants Commission |
| Post (the test itself) | UGC NET |
| Sector | `sec_national_tests` |

## Test coverage
- `mcp/src/regression.test.ts` §16: UGC NET with no vacancies queues; job without count → VACANCIES_REQUIRED; count or breakdown on
  a test/entrance exam → VACANCIES_NOT_APPLICABLE (create and update); contradictory age fields refused; unknown kind refused;
  exam SEO; approved update keeps kind and age flag.
- `src/engine/eligibility.test.ts`: no-upper-age pass/fail.
- `src/services/seo.test.ts`, `src/services/exam-kind.test.ts`: labels and SEO wording.
- Manual: local D1 record rendered on /recruitments, /jobs and the new sector page (no "0 Posts", no JobPosting).

## Open Questions
- Should qualifying exams get their own navigation entry and filter on /jobs? (The new sector card covers discovery for now.)
- Should cutoffs / qualified counts be stored as data once results are published?

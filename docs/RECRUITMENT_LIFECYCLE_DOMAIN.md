# NIRNAY Recruitment Lifecycle & Vacancy Metrics Domain Specification

**Status**: Canonical Standard (Approved & Implemented)  
**Applies To**: NIRNAY Platform (Astro 5 SSR, Cloudflare D1 SQLite, React 19 Engine)  
**Authority Module**: [`src/services/lifecycle.ts`](file:///d:/Personal%20Projects/Eligibility%20Engine/src/services/lifecycle.ts)

---

## 1. Executive Summary

Historically, recruitment status and vacancy numbers across NIRNAY were calculated ad-hoc across 8+ different components and pages. This caused severe domain distortions:
- Result-declared recruitments (e.g. Forest Guard, 2,112 posts) and scheduled exams (e.g. Patwari, 3,550 posts) were treated as "open" or "active" vacancies.
- Sector headers presented misleading counters like *"Civil: 1 Active Drive · 850 Total Vacancies"* or *"Police: 1 Active Drive · 8,350 Total Vacancies"*, confusing candidates who could only apply for 850 posts today while 7,500 were upcoming.
- Unverified records were ambiguously marked with a synthetic `'HOLD'` status that blurred publication vetting with lifecycle states.

This specification normalizes the system into **two orthogonal dimensions** and provides a single canonical source of truth.

---

## 2. Orthogonal Domain Dimensions

### Dimension A: Publication Status (`recruitments.status`)
Controls **editorial and statutory vetting** (can the public see this record?):

| Status | Public Visibility | Active Countable | Meaning |
|---|---|---|---|
| `PUBLISHED` | ✅ Visible | ✅ Eligible | Formally gazetted and verified against official PDF. |
| `PENDING_VERIFICATION` | ❌ Hidden (Public) / Visible (Admin) | ❌ Never | Ingested via OCR or web scrape, awaiting human proofreading. |
| `DRAFT` | ❌ Admin Only | ❌ Never | Incomplete record being drafted. |
| `ARCHIVED` | ❌ Admin Only | ❌ Never | Superseded or cancelled historical drive. |

### Dimension B: Canonical Lifecycle (`recruitments.lifecycle_status` / `resolvedLifecycle`)
Computed dynamically relative to a reference date (or persisted as derived baseline):

| Canonical State | Inferred Condition | Public Badge Label | Tone / Badge Class |
|---|---|---|---|
| `NOT_STARTED` | `now < applicationStart` | Upcoming | `bg-blue-50 text-blue-700 border-blue-200` |
| `APPLICATION_OPEN` | `applicationStart <= now <= (applicationEnd - 7d)` | Applications Open | `bg-emerald-50 text-emerald-700 border-emerald-200` |
| `APPLICATION_CLOSING` | `(applicationEnd - 7d) < now <= applicationEnd` | Closing Soon | `bg-amber-50 text-amber-700 border-amber-200` |
| `APPLICATION_CLOSED` | `now > applicationEnd` (no exam milestone) | Applications Closed | `bg-muted text-muted-foreground border-border` |
| `EXAM_SCHEDULED` | `examStatus === 'SCHEDULED'` or `examDate` announced | Exam Scheduled | `bg-purple-50 text-purple-700 border-purple-200` |
| `EXAM_COMPLETED` | `examStatus === 'COMPLETED'` | Exam Concluded | `bg-indigo-50 text-indigo-700 border-indigo-200` |
| `RESULT_DECLARED` | `resultStatus === 'DECLARED'` | Result Declared | `bg-teal-50 text-teal-700 border-teal-200` |

### Dimension C: Factual Milestones (Authoritative Overrides)
Dates alone cannot accurately track government exam cancellations, paper leaks, postponement orders, or result declarations. Two factual columns override pure date inference:
- `recruitments.exam_status`: `'NOT_SCHEDULED'` | `'SCHEDULED'` | `'POSTPONED'` | `'CANCELLED'` | `'COMPLETED'`
- `recruitments.result_status`: `'NOT_DECLARED'` | `'DECLARED'`

---

## 3. Metrics Calculation & Formulas

All public and administrative counters are calculated via `calculateRecruitmentMetrics(list)` in `src/services/lifecycle.ts`:

```typescript
const metrics = calculateRecruitmentMetrics(recruitments);
```

### Core Formulas:
1. **Active Drives (`activeDriveCount`)**:
   Count of records where `status === 'PUBLISHED'` AND `resolvedLifecycle` is `APPLICATION_OPEN` or `APPLICATION_CLOSING`.
2. **Active Vacancies (`activeVacancyCount`)**:
   Sum of `totalVacancies` for Active Drives only. Does NOT include upcoming notifications or past examinations.
3. **Upcoming Drives (`upcomingDriveCount`)**:
   Count of records where `status === 'PUBLISHED'` AND `resolvedLifecycle === 'NOT_STARTED'`.
4. **Upcoming Vacancies (`upcomingVacancyCount`)**:
   Sum of `totalVacancies` for Upcoming Drives.
5. **Total Announced Pipeline (`totalAnnouncedVacancies`)**:
   Sum of `totalVacancies` across all `PUBLISHED` drives in the scope.

### Sector Header Format
To ensure candidate trust and zero ambiguity, sector hubs display:
> `X Active Drive(s) · Y Total Vacancies (Z Open Now)`

**Example (Police Sector)**:
- MP Police Sub-Inspector: 850 vacancies (Active, closing in 5 days).
- MP Police Constable: 7,500 vacancies (Upcoming, starts in 4 days).
- **Sector Header**: `1 Active Drive · 8,350 Total Vacancies (850 Open Now)`

**Example (Forest Sector)**:
- MP Forest Guard: 2,112 vacancies (Exam held, result declared).
- **Sector Header**: `0 Active Drives · 2,112 Total Vacancies (0 Open Now)`

---

## 4. Architecture: Single Point of Enrichment

To prevent drift between Cloudflare D1 production queries and local/test fallback datasets:
1. `src/db/queries.ts` defines `enrichRecruitmentWithLifecycle(rec)`.
2. Every database query (`getAllActiveRecruitments`, `getRecruitmentWithRelations`, `mapDbRecruitmentToDetails`) and `FALLBACK_RECRUITMENTS` passes through `enrichRecruitmentWithLifecycle`.
3. Callers automatically receive:
   - `rec.resolvedLifecycle`: Canonical enum
   - `rec.presentation`: `{ label, badgeClass, isLiveApplication, isUrgent }`
   - `rec.examStatus`: Canonical string
   - `rec.resultStatus`: Canonical string

---

## 5. Verification Suite & Guardrails

The lifecycle architecture is continuously protected by automated test suites:
- `src/services/lifecycle.test.ts`: 11 targeted unit tests verifying all 7 transitions, edge cases (zero vacancy TET, relative dates, strict publication gates).
- `src/engine/regression.test.ts`: 15 integration regression guards preventing data corruption, premature result declaration, and unverified publication leaks.
- `src/engine/batch-eligibility.test.ts`: 7 batch evaluation and candidate sorting tests.

# NIRNAY — Admin Data Entry Rulebook

> How data entered in `/admin` flows to the public website. Derived from the code on 2026-10-05
> (`src/pages/admin/*`, `src/db/queries.ts`, `src/services/publication-validator.ts`).
> Where this file and the code disagree, the code wins — fix this file.

---

## 0. What is "State / Territory Jurisdiction" in *Add Organisation*?

It is the **jurisdiction that owns the organisation** — which of *Central Government*, a *State*, or a *Union Territory* the recruiting body belongs to.
Example: MPESB → Madhya Pradesh; SSC → Central Government.

**Master data exists.** It is the `states` table (the name is historical; it holds Centre + 28 states + 8 UTs = 37 rows):

| Where | File |
|---|---|
| Seed constant (37 rows, code/name/slug) | `src/data/india-jurisdictions.ts` |
| D1 seed migration (`INSERT OR IGNORE`) | `migrations/0007_nationwide_admin.sql` |
| Table definition | `src/db/schema.ts` (`states`) |
| Admin screen to view/add/edit/deactivate | `/admin/states` → `src/pages/admin/states.astro` (sidebar: *States & Jurisdictions*, under **Master records**) |
| Loader used by dropdowns | `getAllStates()` in `src/db/queries.ts` |

The *Add Organisation* dropdown is filled from `getAllStates()`. If it looks empty, the D1 migration `0007` was not applied to that database (`npx wrangler d1 migrations apply EligibilityEngine-db --local|--remote`).
The seed list is **fixed to the 37 official jurisdictions** — add a row on `/admin/states` only if a genuinely new jurisdiction is needed.

Where the same jurisdiction idea appears:

| Concept | Field | Meaning |
|---|---|---|
| Organisation's owner | `organisations.state_id` | Who runs the body (e.g. MPESB → `st_mp`) |
| Recruitment's jurisdiction | `recruitments.state_id` | **Always copied from the organisation.** A mismatch is rejected: *"Recruitment state must match the recruiting organisation."* |
| Domicile rule | `recruitment_eligibility.domicile_state_code` | Which state's domicile a candidate must hold (optional; blank = open all-India) |
| Candidate's domicile | Eligibility wizard "State" select | Compared with the rule above |

---

## 1. Fill order (dependencies go top → bottom)

```
1. States & Jurisdictions   (pre-seeded, normally nothing to do)
        │
2. Organisation   (needs: state)            /admin/organisations
        │
3. Department     (needs: organisation)     /admin/departments
        │
4. Sector         (independent)             /admin/sectors-posts
        │
5. Canonical Post (needs: sector + dept)    /admin/sectors-posts
        │
6. Recruitment    (needs: org + post)       /admin/recruitments/new
        │ + eligibility, vacancies, dates, sources, links
7. Verify sources → Publish                 /admin/sources, recruitment editor
```

You cannot skip a level: each form resolves its parent via `resolveRequiredReference()` and throws if the parent ID is unknown.

---

## 2. Per-screen field rules

### 2.1 Organisation — `/admin/organisations`
| Field | Required | Rule |
|---|---|---|
| Name | ✔ | Free text |
| Short name | auto | If blank: name if ≤ 15 chars, else initials |
| Slug | auto | If blank: lower-case hyphenated name |
| **State / Territory Jurisdiction** | ✔ | Must exist in `states` |
| Official website URL | ✔ | `https://` is prepended if missing; must parse as a URL |
| Active | – | Inactive orgs are hidden from public pages (`getAllOrganisations` filters `isActive`) |

### 2.2 Department — `/admin/departments`
Name ✔, Slug ✔ (auto), **Organisation ✔**, Description (optional), Active.

### 2.3 Sector — `/admin/sectors-posts`
Name ✔, Slug (auto), Description, Icon (default `briefcase`), Theme (default `blue`), Display order (default = last), Active. Sectors can be toggled active/inactive.

### 2.4 Canonical Post — `/admin/sectors-posts`
Title ✔, **Sector ✔**, **Department ✔**, Pay scale, Default min age (18), Default max age (33), Default qualification (10TH), Summary.
A **Post is evergreen** (e.g. *Police Constable (GD)*). It is **not** a recruitment. A new drive must attach to an existing post.
Post defaults are only *fallbacks* — the recruitment's own criteria override them.

### 2.5 Recruitment — `/admin/recruitments/new` and `/[id]/edit`
The editor has these sections (CONTEXT.md calls it the "7-section editor"; the edit page has six headed panels):

1. Basic information & publication status — title, **organisation**, Advt No., **canonical post**, cycle year, total vacancies, status
2. Vacancy breakdown & cadre — category/gender quotas
3. Statutory eligibility criteria — min/max age, cutoff date, relaxations, qualification, domicile jurisdiction, employment registration, CPCT, gender, height/chest
4. Important dates — application start/end, exam date, etc. (ISO `YYYY-MM-DD` only)
5. Official gazette provenance & application URLs — sources + links
6. SEO — title, description, robotsIndex

Writes are **atomic** (`createRecruitmentAtomic` / `updateRecruitmentAtomic`): recruitment + eligibility + vacancies + dates + sources + links + audit log commit together or not at all.

---

## 3. Gates a recruitment must pass

### 3.1 Duplicate check (`services/duplicate-detector.ts`)
A `CONFIRMED_DUPLICATE` (same advt/org/post/cycle/source) blocks creation.

### 3.2 Publication validator — `validateRecruitmentForPublication()`
Six stages. Any blocking error ⇒ cannot be `PUBLISHED`; it can still be saved as `DRAFT` / `PENDING_VERIFICATION`.

| # | Stage | Blocks publication when… |
|---|---|---|
| 1 | Recruitment | title < 5 chars; slug < 3; no Advt No.; cycle year ∉ 2020–2035; negative vacancies; start date after end date |
| 2 | Canonical mapping | no `postId`; MPPSC mapped to Police Constable |
| 3 | Source | no source; no `http` URL; all sources `EXPIRED`/`INVALID` |
| 4 | Eligibility | no criteria; min age ∉ 14–45; max age ∉ 18–65; min > max; cutoff not `YYYY-MM-DD`; invalid qualification; negative relaxation; male height ∉ 140–220 cm |
| 5 | Organisation | no organisation; MPPSC source pointing to `esb.mp.gov.in` |
| 6 | Content | MPPSC summary mentions Police Constable |

Warnings only (do not block): exam date before application end; category vacancies ≠ total vacancies; expired source.

> ⚠ Stages 2, 5 and 6 contain **MP-specific hard-coded checks** (MPPSC/MPESB). Nationwide organisations get only the generic checks.

### 3.3 Status ladder (editorial — separate from lifecycle)
`DRAFT → PENDING_VERIFICATION → PUBLISHED → ARCHIVED`. Only `PUBLISHED` is public.
Lifecycle (Upcoming / Open / Closing soon / Closed / Exam scheduled / Exam concluded / Result declared) is **computed** from dates and exam/result flags by `services/lifecycle.ts` — never typed by hand. Full spec: `docs/RECRUITMENT_LIFECYCLE_DOMAIN.md`.

### 3.4 Always true
- Every mutation needs `Astro.locals.adminEmail` and writes an `audit_logs` row.
- Dates are ISO strings; free text goes in notes only.
- Never invent category quotas — if the gazette hasn't published them, leave blank (UI then says "awaiting gazetting").

---

## 4. What the public sees (admin field → public surface)

| Admin entry | Public surface | Condition |
|---|---|---|
| Recruitment (`PUBLISHED`) | `/` home (live jobs, closing soon), `/jobs`, `/recruitments/[slug]`, `/calendar`, `/search`, `/admit-cards`, `/answer-keys`, `/results`, `/eligibility-checker` | `status === 'PUBLISHED'` (`getAllActiveRecruitments`) |
| Recruitment dates/exam/result flags | Lifecycle badge, "Closing Soon", calendar, results/admit-card/answer-key trackers | Computed by `lifecycle.ts` |
| Recruitment eligibility | `/eligibility-checker` wizard → deterministic result, `/eligibility/report` | Rules from that recruitment only |
| Domicile jurisdiction | Card text "`XX` Domicile" vs "Open All-India"; wizard domicile check | `requires_mp_domicile` + `domicile_state_code` |
| Organisation | `/organisations/[slug]` authority page; org filter on `/jobs`; `/search` | Org active; page 404s if slug unknown |
| Sector | `/sectors/[sector]` hub + homepage sector grid + active-drive counts | Sector active |
| Canonical Post | `/posts/[slug]` career guide; linked from recruitment | Post active |
| Department | Metadata of a post (post → department → organisation chain); no standalone public page | Dept active |
| Sources / links | "Apply online", "Notification PDF", provenance on detail page | Link active |
| SEO fields | `<title>`, meta description, robots index | `robots_index = 1` |
| **State / Jurisdiction (master)** | Only indirectly: org → state name; `stateCode` on cards; wizard "your state" dropdown | See gap below |

Metric rule: **Active Drives** = `PUBLISHED` + lifecycle `APPLICATION_OPEN|APPLICATION_CLOSING`. **Active Vacancies** = sum of those only.

### Known gaps found while writing this (not fixed — for your decision)
1. **No public state filter.** `/jobs` filters by search, qualification, sector, org and lifecycle status, but **not by state/jurisdiction**, although the page copy promises "all 28 states, 8 union territories". `getAllActiveRecruitments()` already accepts a `stateId` option, so this is cheap to add.
2. Organisation **cards show no state** in the public org page (only "State Authority Verified").
3. Domicile flag columns are still named `requires_mp_*` (legacy); the real jurisdiction is `domicile_state_code`. Keep both in sync when editing.
4. Publication validator has MP-only checks (see 3.2).
5. `admin/organisations.astro` shows `activeRecruitments: '—'` (not computed).

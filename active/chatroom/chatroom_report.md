# Agent Chatroom Report

**Problem**: NIRNAY — Normalize Recruitment Status & Sector Metrics across Public & Admin Surfaces  
**Agents**: 3 (Architect, Pragmatist, Critic) | **Rounds**: 2 (Early Convergence)  
**Date**: 2026-09-18  

## Participants
| Agent | Role | Final Confidence |
|---|---|---|
| Architect | Software Architect | 9/10 |
| Pragmatist | Senior Engineer (Ponytail mindset) | 10/10 |
| Critic | QA & Reliability Lead | 10/10 |

## Consensus
All agents reached unanimous agreement on the following foundational architecture:
1. **Separation of Concerns**: Editorial publication status (`DRAFT`, `PENDING_VERIFICATION`, `PUBLISHED`, `ARCHIVED`) is completely decoupled from recruitment lifecycle status.
2. **Canonical Lifecycle States**:
   - `NOT_STARTED`: Prior to application opening date.
   - `APPLICATION_OPEN`: Application portal actively open (> 7 days remaining).
   - `APPLICATION_CLOSING`: Application portal actively open (<= 7 days remaining).
   - `APPLICATION_CLOSED`: Application window closed, awaiting exam milestone.
   - `EXAM_SCHEDULED`: Exam date scheduled/announced.
   - `EXAM_COMPLETED`: Exam conducted, awaiting answer keys / result.
   - `RESULT_DECLARED`: Formal merit list/result declared.
3. **Active Drive Definition**: A published recruitment where candidates can currently apply (`APPLICATION_OPEN` or `APPLICATION_CLOSING`).
4. **Current Recruitment Definition**: A published recruitment in any post-announcement, active, exam, or recent result stage that is actively tracked on the portal (excluding `ARCHIVED` and `DRAFT`).
5. **Authoritative Facts Over Blind Inferences**: Lifecycle resolver inspects explicit factual overrides (`resultStatus === 'DECLARED'`, `examStatus === 'COMPLETED'`, etc.) rather than guessing completion purely because an old exam date has passed.
6. **Centralized Metrics Service**: Replaces isolated `.reduce((acc, r) => acc + r.totalVacancies, 0)` calls across `index.astro`, `sectors/[sector].astro`, `jobs/index.astro`, `admin/index.astro` with unified metrics calculations.

## Recommended Action
1. Create `src/services/lifecycle.ts` embodying the lifecycle resolver, presentation mapper, and metrics calculator.
2. Add comprehensive automated tests in `src/services/lifecycle.test.ts`.
3. Integrate the resolver directly into `queries.ts` so all callers receive normalized `resolvedLifecycle` and presentation properties.
4. Update public pages (`/`, `/jobs`, `/sectors/[sector]`, `/recruitments/[slug]`, `/organisations/[slug]`, `/calendar`, `/admit-cards`, `/results`, `/answer-keys`) and admin console (`/admin`, `/admin/recruitments`).
5. Update `src/engine/regression.test.ts` to enforce the new invariants.

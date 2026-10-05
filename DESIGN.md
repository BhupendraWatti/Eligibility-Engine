# Design System — NIRNAY OPS

## Product Context
- **What this is:** Mission-critical administrative operations console & deterministic eligibility engine for India's public recruitment drives across Central and 36 State/UT jurisdictions.
- **Who it's for:** Super Admins, Government Data Curators, and Verification Officers.
- **Space/industry:** GovTech / Civic Tech / Public Administration Operations.
- **Project type:** Internal Tool & High-Density Administrative Console (Astro SSR + React 19 + Tailwind v4 + Cloudflare D1).

## Aesthetic Direction
- **Direction:** Industrial / Utilitarian Command Center
- **Decoration level:** Intentional - precision hairline borders (`slate-200`), micro-elevations, light sidebar, zero gratuitous gradients.
- **Mood:** Authoritative, high-density, rock-solid, focused on rapid data scanning and error-free governance.

## Typography
- **Display/Hero:** Plus Jakarta Sans — authoritative, geometric, modern executive presence.
- **Body & UI:** Inter — crisp legibility at compact sizes (11px–14px).
- **Data/Tables/Slugs:** JetBrains Mono & tabular monospace — aligned numbers, codes, and URLs.
- **Code:** ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace.
- **Loading:** Google Fonts CDN with preconnect.
- **Scale:**
  - 3xs: 9px (micro badges, tags)
  - 2xs: 10px (section headers, statuses)
  - xs: 11px–12px (table cells, inputs, navigation links)
  - sm: 13px–14px (card titles, primary buttons)
  - base: 16px (page titles on mobile, subheadings)
  - lg: 20px–24px (h1 page titles)

## Color
- **Approach:** Restrained & Authoritative GovTech
- **Primary:** `#1e40af` (Gov Blue / Cobalt) — authority, clarity, focus rings.
- **Secondary:** `#0f172a` (Slate Navy) - text and high-contrast neutrals only. No black surfaces.
- **Neutrals:**
  - Dark surfaces: `#09090b` (canvas), `#18181b` (surface), `#27272a` (borders), `#a1a1aa` (muted text)
  - Light workspace: `#f8fafc` (canvas), `#ffffff` (cards/tables), `#e2e8f0` (borders), `#090d16` (text)
- **Semantic:**
  - Success: `#059669` (text), `#ecfdf5` (bg), `#a7f3d0` (border) — Live/Active status
  - Warning: `#d97706` (text), `#fffbeb` (bg), `#fde68a` (border) — Inactive/Pending/Corrigenda
  - Error: `#dc2626` (text), `#fef2f2` (bg), `#fecaca` (border) — Revoked/Validation errors
  - Info: `#0284c7` (text), `#f0f9ff` (bg), `#bae6fd` (border) — Guidance notes

## Spacing & Density
- **Base unit:** 4px
- **Density:** Compact Data Density
- **Scale:**
  - 2xs: 2px
  - xs: 4px
  - sm: 8px
  - md: 12px–16px
  - lg: 20px–24px
  - xl: 32px

## Layout & Responsiveness
- **Desktop (≥1024px):** 240px fixed dark sidebar, fluid main workspace with max-w-7xl, multi-column data tables with inline quick filters.
- **Tablet / Split View (768px–1023px):** Collapsible / Rail sidebar mode with 64px compact icon rail or toggled drawer, giving tables 180px+ extra width to eliminate horizontal overflow.
- **Mobile (<768px):** Sticky top bar with brand & hamburger + off-canvas slide drawer + fixed ergonomic thumb bottom dock (Overview, Drives, Sources, Rules, Menu) + adaptive table-to-card view.
- **Scrollbar Architecture:** Custom thin scrollbar (`scrollbar-width: thin; scrollbar-color: #3f3f46 transparent`) eliminates Windows 17px default gray bars.

## Motion
- **Approach:** Minimal-functional
- **Easing:** ease-out for entering drawers and modals, ease-in-out for sidebar width transitions.
- **Duration:** 150ms micro-actions, 250ms drawer slide transitions.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-04 | Initial NIRNAY OPS Design System | Created via /design-consultation to resolve Windows scrollbar layout clipping, tablet squishing, and mobile responsiveness. |
| 2026-10-04 | Hybrid Collapsible Sidebar Rail | Preserves 700px+ table breathing room on split-screen / tablet viewports. |
| 2026-10-04 | Dual Desktop/Mobile Table Architecture | Multi-column tables on desktop; structured high-density cards on phones. |
| 2026-10-05 | White-blue theme lock | User request: removed black sidebar/CTA blocks and gold chrome accents. Primary actions use Gov Blue; amber kept only for Warning semantics. |
| 2026-10-05 | Public-site dark mode (light/dark toggle) | User request. Class-driven `.dark` on `<html>`; header toggle persists to `localStorage('nirnay-theme')`, defaults to OS preference. Dark neutrals from the palette above; Gov Blue lifted to `#2563eb` (fills) / `#60a5fa` (text). Admin console stays light. |

# Teacher + School Admin UX remediation handover — 2026-08-18

## Scope
Teacher and school-admin product surfaces were audited as operational workspaces, not isolated pages. The review covers information hierarchy, navigation, loading/failure states, mobile ergonomics, consistency, accessibility, data authority, and pilot readiness.

## Product direction
VibeSchool should not become a collection of disconnected ERP pages. The operating model is:

- Teacher: Today → Teach → Evidence → Assess → Follow-up.
- School Admin: Briefing → Decide → Act → Verify.

The differentiation is lower decision burden, faster next action and explicit evidence/status—not more top-level modules.

## Findings

### P0 — failure-state UX
The repository had route surfaces that could feel broken when authority, data or rendering failed. Teacher layout also contains an internal auth-resolution state that historically rendered an empty surface. Admin had local skeletons but no common route-level recovery boundary.

### P0 — visual-system fragmentation
Teacher screens mix shared `components/teacher/ui.tsx` primitives with page-local Card/Label/Pressable implementations and extensive inline styling. Admin duplicates its own palette and navigation primitives. This creates inconsistent radius, spacing, shadows, typography, interaction states and accessibility semantics.

### P1 — navigation density
Teacher bottom navigation is appropriately task-oriented (Today, Teach, Classes, Assess, Me), but secondary tools are hidden behind trays and the floating Twin competes with navigation near the bottom safe area. Admin desktop navigation exposes a broad ERP taxonomy while mobile reduces to five destinations. Navigation must preserve parity without exposing every module at once.

### P1 — dashboard hierarchy
Teacher Pulse and Admin School Hub already point in the correct direction: urgent signals and next actions first, deeper analytics second. Remaining module pages should converge on that hierarchy rather than opening with configuration or dense tables.

### P1 — accessibility and mobile
Older surfaces contain interactive divs and hover-led affordances. WCAG 2.2 requires visible focus, focus that is not obscured and minimum pointer target sizing. VibeSchool's contract is stronger for primary controls: 44px targets where layout permits, visible focus, semantic buttons/links, descriptive accessible names and reduced-motion support.

## Production Supabase authority investigation
No parallel UX-state database was introduced.

Observed production baseline:
- `teacher_profiles`: 33 rows; 16 have no `school_id`.
- `teacher_classes`: 28 rows; all have `school_id`.
- Schoolless teacher profiles with classes: 0.
- Teacher profile references to missing schools: 0.
- `admin_visitors`: 2 rows and both school-scoped.
- `admin_profiles`, `admin_meetings`, `admin_projects`: currently no production rows.

Interpretation: the 16 schoolless teacher profiles are not currently carrying school-class activity. They can represent onboarding or independent-teacher states. Do not mutate them merely to make dashboard UI appear complete; the UX must explicitly support “no school yet” and onboarding states.

## Implemented
- Shared branded route-level loading state for Teacher and School Admin.
- Shared recoverable route error state with Retry, workspace-home and sign-in actions.
- Global visible `:focus-visible` interaction ring.
- Global `prefers-reduced-motion` protection.
- Teacher primary `Btn` target raised to 44px; compact controls remain 36px only when explicitly requested.
- Native disabled-button semantics.
- Clickable Teacher `Avatar` converted from a div to a semantic button with an accessible label.
- Teacher modal now declares `role=dialog`, `aria-modal=true`, accessible title and a 44×44 close target.
- Decorative Twin dots are hidden from assistive technology.
- Dedicated `scripts/test-portal-ux-contract.mjs` regression contract.
- Dedicated `.github/workflows/portal-ux-contract.yml` CI gate.
- No schema mutation and no new database authority.

## Design contract
1. One primary job per screen and one dominant CTA.
2. Put urgent/next work before analytics and configuration.
3. Use shared portal primitives; no new page-local design systems.
4. Mobile first: generous touch targets, safe-area padding and no horizontal overflow.
5. Never show an unexplained blank screen; loading, empty, permission, offline and error states are explicit.
6. Use plain Kenyan school language: class, lesson, homework, assessment, attendance, fees and parent communication.
7. Preserve Teacher OS flow: Today → Teach → Evidence → Assess → Follow-up.
8. Preserve Admin flow: Briefing → Decide → Act → Verify.
9. Database authority remains canonical; UI caches never become truth.
10. Schoolless teachers must be routed to a legitimate independent/onboarding experience, never fake school data.
11. Every interactive control must be keyboard reachable and visibly focused.
12. Vercel promotion is only after exact-head certification and merge.

## Current certification gates
- Portal UX contract.
- TypeScript + production build on exact head.
- Existing auth/onboarding hardening suite where applicable.
- Teacher/Admin route loading and recovery boundary presence.
- Accessibility primitive contract.
- Production Supabase school-scope sanity checks.

## Remaining before merge
- Resolve any exact-head TypeScript/build failures.
- Reconcile the branch against current `main` if main moves during remediation.
- Inspect exact changed-file diff for accidental product or authority regressions.
- Merge only after all available required checks are green.

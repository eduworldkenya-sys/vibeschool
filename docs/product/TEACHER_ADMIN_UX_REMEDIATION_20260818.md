# Teacher + School Admin UX remediation handover — 2026-08-18

## Scope
Teacher and school-admin product surfaces were audited as operational workspaces, not isolated pages. The review covered information hierarchy, navigation, loading/failure states, mobile ergonomics, consistency, accessibility, data authority, and pilot readiness.

## Findings

### P0 — failure-state UX
Teacher layout can render a blank full-screen surface while authority/profile resolution is pending. The admin dashboard has local skeletons but no route-level recovery boundary. A network, render, or route failure can therefore feel like a broken product rather than a recoverable state.

### P0 — visual-system fragmentation
Teacher screens mix shared `components/teacher/ui.tsx` primitives with page-local Card/Label/Pressable implementations and extensive inline styling. Admin duplicates its own palette and icon/navigation primitives. This creates inconsistent radius, spacing, shadows, typography, interaction states and accessibility semantics.

### P1 — navigation density
Teacher bottom navigation is appropriately task-oriented (Today, Teach, Classes, Assess, Me), but secondary tools are hidden behind trays and the floating Twin competes with navigation near the bottom safe area. Admin desktop navigation exposes a broad ERP taxonomy while mobile reduces to five destinations; parity and discoverability need continuous contract tests.

### P1 — dashboard hierarchy
The strongest product model is “what needs attention now → next action → evidence/status → deeper modules.” Teacher Pulse already trends in this direction. Admin School Hub also has briefings and vital signs. Remaining module pages should converge on the same hierarchy instead of opening with configuration or dense tables.

### P1 — accessibility and mobile
Interactive divs and inline hover-only affordances remain in older surfaces. Every actionable element should be a semantic button/link, have a 44px minimum touch target, visible keyboard focus, descriptive accessible name, reduced-motion behavior, and safe-area spacing.

### Data authority
Production Supabase already contains the operational domains required by these portals: teacher profiles/classes/content, schools/membership, admin announcements/notices/meetings/projects/staff attendance/visitors, and related learning systems. UX remediation should reuse these authorities rather than introduce parallel UI-only state tables.

## Implemented in this slice
- Shared branded route-level loading state for Teacher and School Admin.
- Shared recoverable route error state with Retry, workspace-home, and sign-in actions.
- Reduced-motion support for the loading animation.
- Error references remain visible when Next.js provides a digest.
- No schema mutation and no new database authority.

## Design contract for follow-on pages
1. One primary job per screen; one dominant CTA.
2. Put urgent/next work before analytics and configuration.
3. Use shared portal primitives; no new page-local design systems.
4. Mobile first: 44px targets, safe-area padding, no horizontal overflow.
5. Never show an unexplained blank screen; loading, empty, permission, offline and error states are explicit.
6. Use plain Kenyan school language: class, lesson, homework, assessment, attendance, fees, parent communication.
7. Preserve Teacher OS flow: Today → Teach → Evidence → Assess → Follow-up.
8. Preserve Admin flow: Briefing → Decide → Act → Verify.
9. Database authority remains canonical; UI caches never become truth.
10. Vercel promotion is only after exact-head certification and merge.

## Competitive/product research signal
Current school platforms consistently center teacher workflows on classes, timetable, attendance, assignments/assessment and communication, while admin hubs center people, operations, finance, analytics and settings. VibeSchool should differentiate by reducing navigation and decision burden, not by adding more top-level modules.

## Next certification
- TypeScript + production build on exact head.
- Existing auth/onboarding hardening suite.
- Mobile viewport smoke tests for Teacher Pulse, Teach Today, Class Hub, Assessment, Admin Hub, Students, Finance and Academics.
- Keyboard/focus and semantic-control audit.
- Merge only when exact head is green.

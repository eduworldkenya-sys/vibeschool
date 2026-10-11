# Teacher OS controlled redesign extension

## Mission relationship

This is an extension of `CYBORG-20261010174629-ef0af1`, on the same repair branch. It is not a parallel redesign and must not create alternative data authorities, disconnected demo routes, or a second component system.

The production blocker closure remains the first gate. Visual work cannot conceal an unresolved persistence, authorization, migration, or runtime failure.

## Shared system

- Presentation tokens: `components/teacher/studio-tokens.ts` and `components/teacher/studio.css`.
- Shared controls and states: `components/teacher/ui.tsx` plus narrowly reusable Teacher components.
- Canonical operating context, database RPCs, RLS, and persisted records remain authoritative.
- Prefer one clear page action and progressive disclosure over repeated oversized cards.
- Copy must sound operational and human; decorative or synthetic “AI-generated” language is prohibited.

## Page order and journey gates

| Order | Journey | Primary outcome | Exit evidence |
| --- | --- | --- | --- |
| 1 | Dashboard / Pulse | Teacher understands today and can start the next real action | New-teacher walkthrough, desktop/mobile captures, links preserve context |
| 2 | Learners / Class Hub | Teacher finds a learner or class and sees truthful current evidence | Empty/error/permission cases and canonical roster proof |
| 3 | Curriculum | Teacher locates the approved curriculum position | Canonical taxonomy lineage and responsive hierarchy |
| 4 | Scheme | Teacher commits and revisits persisted term/week work | Database write/read-back and denial-path proof |
| 5 | Lesson Plan | Teacher prepares a grounded lesson without losing work | Draft/persist/reopen and source-lineage proof |
| 6 | Teach Today | Teacher enters the right occurrence and completes its workflow | Occurrence identity, offline/retry and completion proof |
| 7 | Attendance | Teacher deliberately marks every learner and saves once | No implicit present values; write/read-back and permission proof |
| 8 | Homework | Teacher assigns recoverable work with a valid due date | Draft survival, write/read-back, targeting and permission proof |
| 9 | Assessment / Marking | Teacher creates, releases, marks and safely corrects evidence | Support migration, audit history and denial-path proof |
| 10 | Analytics | Teacher interprets released evidence without invented certainty | Source labels, unknown-state semantics and responsive proof |
| 11 | Timetable / School Hub | Teacher acts on a real schedule and active-school context | Conflict-free lease, production data, role and tenant proof |

Every row must pass before promotion to the next row:

1. State the page's primary purpose, primary action, canonical source, and permission boundary.
2. Capture before evidence at desktop and Android-sized mobile viewports.
3. Remove redundant copy and ambiguous labels; improve hierarchy, density, spacing, focus order, and touch targets.
4. Implement loading, empty, error, offline, success, and retry behavior appropriate to the journey.
5. Preserve or repair the connected functional path; never substitute mock data for production authority.
6. Verify persistence by writing through the canonical interface and reading the same record back.
7. Test unauthorized, wrong-school, stale-data, duplicate-submit, and interrupted-network paths as applicable.
8. Capture after evidence and record remaining blockers, exact revision, environment, and test identity.

## Merge and rollout gate

Do not merge merely because pages render. Merge requires exact-head CI, desktop and Android journey evidence, persistence and permission verification, no unresolved P0/P1 blockers, independent assurance, and an explicit record of remaining lower-severity risks. Production migration or deployment still requires the repository's owner/security capability gate.

## Current concurrency constraints

Timetable and the Assessment overview remain protected by pre-existing active leases. Work may inspect them, but must not edit those owned paths until ownership is reconciled. This mission can progress through unblocked journeys and shared-system evidence without violating those leases.

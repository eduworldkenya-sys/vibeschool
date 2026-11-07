# Canonical teaching and learning contexts (approved 2026-11-07)

## Product rule
**One system. Shared tools. Separate contexts.** Private tuition is a context within VibeSchool, not a second teaching or learning platform.

## Teacher OS
- **Teach → My Tutoring** is an overview of connected private learners, tuition requests and upcoming tuition activity. It is not a duplicate workspace.
- **My Students** lists accepted private tuition connections and links to the existing lessons, timetable, messaging, progress and resources tools, scoped to the selected learner.
- The canonical timetable supports **All / School / Tuition** views. Tuition lessons appear in the main timetable with a visible Tuition label; school lessons retain their School context.
- Lessons, messaging, resources, assessments and progress should reuse existing canonical components, APIs and records wherever compatible, rather than introduce parallel feature implementations.
- A tuition overview may offer contextual shortcuts into those shared tools, but should not maintain separate copies of the underlying activity.

## Student experience
- **Learn → My Tuition** is a tuition-specific overview; school learning and private tuition open the same learner tools with an explicit context.
- Tuition lessons should appear in the learner's main timetable/activity feed with clear ownership labels.
- Teacher and student views must resolve the same tuition lesson and connection identities, including status and cancellation.

## Data and authorisation invariants
- Every record must have a resolvable ownership/context boundary (school versus private tuition); preserve existing canonical IDs and links.
- School-owned records are never implicitly disclosed to a private tutor. A tuition connection does not grant school-class access.
- Private tuition conversations and learner progress remain visible only to appropriately authorised participants; honour required guardian approval for minors.
- Do not merge school and tuition records merely to render a combined UI. Aggregate authorised views over existing sources.
- Preserve existing data, routes and functionality during migration; avoid parallel sources of truth.

## Implementation alignment checklist
1. Inventory existing teacher and student timetable, lesson, message, resources, assessment and progress implementations and their tables/RPCs.
2. Identify duplicate tuition-only implementations and route their UI through shared tools only where semantics and permissions match.
3. Add explicit context labels and filters to shared views; retain direct tuition deep links.
4. Align teacher/student lesson state and counts; exclude cancelled/past lessons from upcoming totals.
5. Verify RLS and guardian access across school and tuition contexts.
6. Test an accepted tutor–student connection end to end: schedule, display on both sides, message, join video, cancel, and mobile layouts.
7. Merge implementation only after CI, migration checks and production verification.

## Scope
This document records the approved direction. It **does not** certify that all shared-tool integration, security checks or end-to-end flows are already implemented.

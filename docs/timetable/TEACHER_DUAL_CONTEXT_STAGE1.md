# Teacher dual-context identity — Stage 1 (2026-11-12)

**Target:** `integration/intelligent-timetable`. This is identity foundation only. It does **not** activate independent scheduling or switch the actual timetable.

## Canonical identity and authority

- One authenticated teacher identity: `auth.users.id` / `profiles.id`. Neither an independent account nor a new teacher profile is created.
- School memberships and school-active preference remain the existing server-side `school_members`, `teacher_active_school_preferences`, `get_my_teacher_school_context`, and `teacher_set_active_school` authorities.
- The teacher shell resolves available teaching contexts from the existing membership-filtered RPC, using the current authenticated user ID.
- For linked teachers, **the server-authorised active school is the default context**, followed by other authorised school choices. Independent Teaching is always available as a personal context alongside school membership.
- For teachers with no linked school, the only offered context is **Independent Teaching**. This must never require creating a fictional school ID.
- A stale active-school ID, malformed RPC response, unverified school, or invalid teacher identity cannot be silently trusted.
- `useTeachingIdentity()` provides read-only shell identity metadata for the Stage 2 timetable routing work. `selectTeacherTeachingScope()` validates a requested context against the verified options but does not grant any underlying permissions.

## Invariants

- School assignment, class access, teaching records, attendance and student data remain governed by existing server-side RLS/RPCs; a UI context selection never grants membership.
- Do **not** treat independent teaching as `school_id = auth.uid()`, a generic null-school school timetable, or a second user account.
- `school_id`, `teacher_id` and existing historical course/lesson IDs are not changed.
- No schema migration, permission expansion, production write, membership update or timetable change in this stage.
- Do not show a working context-switcher until Stage 2 actually routes timetable reads/writes to the selected authorised context. Labels alone must not disguise school-scoped operations.

## Acceptance and handoff

Run `node scripts/test-teacher-dual-context-identity.mjs`, `npm run test:timetable`, typecheck and governance checks against the feature PR head. Test linked school and no-school states; confirm unauthorised schools fail closed.

**Next stage:** 2 — reuse the existing timetable engine with explicit selected School / Independent contexts. School timetable records must stay school-owned; independent lessons must be teacher-owned and never leak into the school's shared timetable. Use existing tuition context and teaching identity machinery, not a second timetable engine.

**Production:** Do not claim rollout or user acceptance until the staged integration branch, CI, relevant database migrations and authenticated teacher journeys are verified.

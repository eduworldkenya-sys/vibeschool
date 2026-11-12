# Teacher-owned resources — VibeSchool canonical authoring contract

## Purpose
The Teaching Library has one teacher-facing workspace for both certified VibeSchool learning resources and teacher-authored supplementary materials. It has **15 optional instructional component types**, grouped into five categories. The Teaching Library itself is not a new content engine and never converts a teacher draft into certified VibeSchool Originals.

## Authorities
- `learning_resources` and `learning_resource_versions` remain the canonical certified VibeSchool learning-content store. They are not mutated by this feature.
- `public.resources` remains the existing class-scoped teacher supplementary resource store, extended with `component_type`, `publication_status`, `subject_id` and optional `scheme_lesson_id`.
- `resources.type` remains a legacy compatibility transport field; it is constrained by the existing database to notes, assignment, video, link and quiz. This is **not** the Teaching Library category: `component_type` is the exact 15-slot taxonomy.
- Quiz, test, exam, assignment and homework *support material* remains a resource, not a runnable/marked assessment. The existing Assessment Builder owns actual learner attempts, grading and exam lifecycle.

## Lifecycle and privacy
1. The teacher chooses any of the 15 components, class and subject, optionally a Scheme lesson, and may save an empty-content draft.
2. **Save private draft** is the only editor action. The default and every edit result is `publication_status='draft'`. No link, timetable or compulsory component checklist is required.
3. An explicit, separate **Share with class** action checks for actual readable text or a valid HTTP(S) link, confirms the audience and sets `publication_status='shared'`.
4. **Unshare** revokes learner access. Editing a shared resource returns it to draft until another explicit share.
5. Learners read only through the `student_accessible_resources` security-invoker view. Both its SQL predicate and the underlying `resources_student_view` RLS policy require `publication_status='shared'` and current class/school authorization.
6. Anon API grants on the class resource table are revoked. No server-only key is exposed. The student reader does not persist resources in a local device cache; it refreshes on focus.

Existing legacy teacher resources are **safely drafted during migration**, rather than automatically exposed. Their source rows and content are preserved.

## Curriculum and class linkage
- A teacher can assign a class and subject only from their actual `teacher_classes` memberships.
- `scheme_lesson_id` is optional. A database trigger validates the Scheme belongs to the same teacher, class, school and subject to reject cross-tenant or mismatched linking even through direct REST mutation.
- The Scheme row preserves its canonical curriculum/outcome connection; this supplementary link does not create a parallel outcome record.
- None of the 15 component slots is required to open a Scheme, create a lesson plan or Teach Mode.

## Interaction
- Unified teacher screen with compact categories and resource links; all 15 slots have an Add action.
- Authoring modal has one component selector (five grouped categories), assigned class and subject, optional Scheme link, title, description, content and external link.
- Its save action remains visible in a fixed footer, including smaller desktop screens.
- Saved material cards show private/shared state, inline content, edit/share/unshare/delete and class/topic context.
- Learner Study Room presents the exact component label when available and only resources shared by an authorized teacher.

## Quality gates
- `npm run test:resource-authoring` validates all 15 slot mappings, DB's legal legacy storage types, draft and share behavior, RLS and security-invoker view invariants, Scheme integrity checks, student no-cache rules and completeness guards.
- Existing `teacher-resource-os-contract` and `test:teaching-library` remain active.
- Full production build, zero-to-current DB migration reconstruction and Supabase security advisor are required before production rollout.
- A successful GitHub merge/CI is not a replacement for actual database migration or a signed-in teacher/learner smoke test.

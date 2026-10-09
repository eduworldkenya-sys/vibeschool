# Teacher workflow repair and interface refinement

Scope: class creation and learner save recovery; Homework register; Class Workspace sections; Class Sheets grid order; lesson priorities and context links. Existing storage, RPC authority and permissions are retained. No database migration is included.

## Changes

- Persist a school selection before offering the class form; verify the active school belongs to the returned membership list.
- Recover class-form busy state after rejected saves and expose authority-load retry. Subject teachers finish in My Classes; class teachers can continue to learner onboarding.
- Learner onboarding validates the class-teacher operating context, requires a confirmed learner ID, retains request IDs for retries, and protects confirmed rows during a partial batch. The mobile form has accessible names and fits narrow screens.
- Homework uses searchable assignment rows and class/date filters. Counts deduplicate handed-in learner IDs and exclude drafts. Remove roster percentages because targeted groups and historical enrolments make whole-class denominators misleading. Read failures show an error rather than an empty register.
- Class Workspace has Learners, Classroom tools and Activity sections. Selection survives section changes. Comparisons, practice suggestions and learner corrections are disclosures; the roster keeps learner names beside a narrow selection column.
- Class Sheets places the grid ahead of export, draft history, configuration and import controls. Filters and evidence questions are disclosures. All existing editing, imports, exports, save recovery and unsaved-change protections remain.
- Next-action rules consume authoritative occurrence actions. Without occurrence authority, completed attendance opens the lesson instead of recommending homework. Countdown uses Nairobi time. Tomorrow preparation preserves timetable slot and occurrence date.
- Assessment exercise entry opens the selected class; quiz/CAT entry preserves class and subject in lesson preparation. Homework-only workflow steps are labelled as homework rather than promising every work type.
- The project sheet explains that it is a private tracker, not a project assignment or published grade.

## Verification and limits

Actual component DOM tests cover save rejection, authority retry, null-ID rejection, stable idempotency requests, handed-in counts and read failures. Existing workbook/classroom interaction tests cover editing, selection, seating, exports and stale-save recovery. Rule tests cover authoritative teaching actions and exact occurrence links. Isolated Chromium layouts at 320, 390 and 1440 px cover Homework, learner onboarding, Class Workspace and Class Sheets with axe scans. These use synthetic data and do not prove connected database writes.

The wider audit remains open: a composed marking inbox across legacy and canonical assessment stores, broader learner work history, curriculum reconciliation and full connected teacher journeys. No claim is made that all Teacher OS routes or all eighteen audit findings are complete. Connected write tests still require a verified recoverable backup. Existing unrelated lint warnings remain.

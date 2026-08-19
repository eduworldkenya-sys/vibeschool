# VibeSchool Task 23 — Teacher UX Final Pilot Certification Handover

Status: **IN PROGRESS / SHARED-FOUNDATION HOLD**

## Starting state

- Baseline `main`: `77051a4011d7712a275f76af41efed382f017398`
- Isolated branch: `ux/task-23-teacher-final-pilot-20260819`
- Production mutation: none
- Production migration/RLS/grant changes: none
- Vercel deployment intentionally triggered: none
- Merge: prohibited while shared foundations remain open

Task 23 is downstream of the Teacher core journey and shared auth/identity/security foundations. At audit time Task 4 is open as draft PR #286 on `task4/teacher-pilot-certification-20260819`; Task 1, Task 2, Task 3 and Task 8 are also still open foundation work. Exact-current-main certification must therefore wait.

## Teacher mental model

The pilot-facing mental model should be small even though the repository contains many Teacher routes.

1. **Today** — daily command centre: now, next, attention, continue.
2. **Plan & Teach** — timetable, scheme, lesson plan, active lesson, teaching resources, progress/reflection.
3. **Classes** — class context, learners, attendance, homework and class communication.
4. **Assess** — assessment entry, marking/results and academic evidence.
5. **Me** — profile, notifications/help/support and secondary account tools.

Existing primary bottom navigation already approximates this as `Today / Teach / Classes / Assess / Me`; Task 23 should strengthen this structure rather than invent another navigation system.

### Surface map

| Teacher job | Canonical surface / family |
| --- | --- |
| Home / Today | `/teacher/pulse` |
| Plan & Teach | `/teacher/teach-today` |
| Timetable | `/teacher/timetable` |
| Scheme of Work | `/teacher/scheme` |
| Lesson planning / teaching workspace | `/teacher/lessonplan` + `LessonFlowCard` |
| Attendance | `/teacher/attendance` |
| Homework overview | `/teacher/homework` |
| Class homework | `/teacher/classhub/[id]/homework` |
| Assessment | `/teacher/assessment` and existing lesson assessment studio under `/teacher/assessment/new` |
| Results / academics | Assessment/academics route family |
| Classes / learner list | `/teacher/classhub`, `/teacher/students` |
| Learner progress | class learner detail + `/teacher/progress` |
| Notifications | `/teacher/notifications` |
| Profile | `/teacher/profile` |
| Help / problem report | `/teacher/help`, `/teacher/help/report` |

Repository routes such as `academics`, `content-*`, `credits`, `tpad`, `resources`, `vibelearn`, `schoolhub` and related tools are secondary destinations and should not compete with the five primary Teacher jobs.

## UX findings and disposition

### P1 — Teacher root did not match the primary navigation mental model

- Screen: `/teacher`
- Evidence: baseline redirected to `/teacher/week` while bottom navigation names Today/Pulse as the primary Teacher home.
- Impact: post-login and deep-return behavior can feel inconsistent; teachers can land in a weekly module instead of the daily command centre.
- Resolution on Task 23 branch: redirect `/teacher` to `/teacher/pulse`; show `PortalLoading` rather than a blank redirect frame.
- Dependency: Task 4 independently changes this same file and must win/reconcile as the shared Teacher foundation.

### P1 — Today notification affordance was visibly dead

- Screen: Teacher Today header.
- Evidence: baseline notification action displayed `Notifications — coming soon` despite an existing notifications data model.
- Impact: obvious fake control in a pilot-critical command centre.
- Resolution on branch: real Teacher notifications destination, unread-count semantics, action/information/system grouping, loading, retry and empty-state recovery.
- Dependency: Task 4 independently implements scoped Teacher notifications and changes the same files. During final reconciliation, keep Task 4 authority/RLS contract and preserve Task 23 usability semantics rather than maintaining two notification implementations.

### P1 — Teacher context switch was not resilient across Today interactions

- Screen: Today class/subject selector.
- Impact: multi-class/multi-subject teachers can lose their working context and repeat selection.
- Resolution on branch: session-scoped last valid class/subject selection, only restored when it still exists in legitimate assignments; 44–46px controls and explicit labels.
- Dependency: Task 4 introduces deterministic multi-school operating context. Final solution must derive legitimacy from Task 4 context authority, not session storage alone. Session storage remains convenience state, never authority.

### P1 — Help contained visible dead controls

- Screen: `/teacher/help`
- Evidence: quick-guide rows had pointer styling but no actions; Live Chat and Email Support buttons had no handlers.
- Impact: teacher discovers fake support controls during an error or classroom interruption.
- Resolution: removed the misleading pseudo-navigation, replaced it with task-focused FAQ disclosure controls and functional Report a Problem / general contact routes.

### P1 — No Teacher-native problem reporting flow

- Screen: Help/support.
- Existing foundation: public account support already uses authenticated `submit_contact_request`.
- Resolution: `/teacher/help/report` reuses that existing support contract and automatically attaches safe role/screen/timestamp/reference/network context. It explicitly warns against passwords, PINs, OTPs or payment credentials, preserves typed text on send failure, prevents duplicate submission while sending, and returns a support reference after confirmed backend success.
- Database change: none.

### P1 — Teach desk linked to a non-existent curriculum route

- Screen: `/teacher/teach-today`.
- Evidence: baseline teaching documents linked `Curriculum` to `/teacher/curriculum`; repository audit found no canonical Teacher page at that route. The real consolidated Teacher academics surface exists at `/teacher/academics`.
- Resolution: changed visible destination to `Academics`, linking to `/teacher/academics`; improved descriptive copy and phone touch sizes.

### P2 — Teach desk controls were smaller/less informative than the mobile standard

- Screen: `/teacher/teach-today`.
- Resolution: Retry/Refresh at least 44px, tool cards at least 72px, more readable 11px secondary text, accessible busy/error semantics and a simple loading skeleton instead of only one loading sentence.

### Verified strong existing behavior — Timetable

- Mobile-first slot-list structure rather than a dense desktop calendar.
- Current and next lessons have distinct states.
- Slot cards are keyboard operable and whole-card tappable.
- Start-lesson failures are mapped to human-facing explanations.
- No Task 23 rewrite is justified before Task 4 reconciliation.

### Verified strong existing behavior — Attendance foundation

Baseline already contains exact lesson/class/date handoff, canonical occurrence checking, default-present exception marking, batch save, explicit saved/error state and return to the exact lesson after an authoritative lesson-mode save. Task 4 is actively replacing this with a stronger deterministic operating-context and local-draft model. Task 23 must validate and tune the Task 4 version after merge rather than competing with it now.

### P1/P2 pending reconciliation — Assessment mobile controls

The current assessment screen clearly exposes class, subject and term context, loading states, student rows and bulk entry. Several chips/tabs and icon actions are visually below a 44px mobile target. Because assessment authority and Task 4 context work are still moving, final touch-target and wrong-context protections are deferred to exact-candidate reconciliation rather than copied across competing branches.

### P1 pending reconciliation — Homework overview

Baseline aggregate Homework has clear Active/Overdue status and submission progress but its empty state tells the teacher to go into a class without a direct CTA, and several controls are smaller than the phone target. Task 4 changes both aggregate and class homework files, so the final Task 23 patch must be applied after Task 4 lands.

### P2 pending reconciliation — Scheme touch density

Scheme already has meaningful loading/empty states, week coverage, status semantics and curriculum-linked context, but the seven-column week grid and chips need final 360px/384px Android verification. Do not redesign until measured against the reconciled candidate.

## Changes implemented on isolated branch

- canonical Teacher root → Today/Pulse with visible transition state;
- real Teacher notification route and Today notification affordance;
- session convenience persistence/restoration for a still-authorized class/subject context;
- explicit 44px+ Today header controls and labelled selectors;
- Teacher-native Report a Problem flow using existing authenticated support RPC;
- Help page dead-control removal;
- Teach desk dead `/teacher/curriculum` destination removed in favor of canonical Academics;
- Teach desk touch/loading/error copy hardening;
- permanent Task 23 static UX contract at `scripts/test-teacher-ux-task23.mjs`;
- isolated GitHub Action definition for UX contract + TypeScript + production build.

## Regression contract

`npm run test:teacher-ux` currently asserts:

- Teacher root lands on Today/Pulse;
- redirect shows nonblank loading state;
- Today notifications are a real destination;
- important Today controls meet mobile sizing cues;
- last class/subject context is stored and restored only through the Teacher context selector;
- context selector is labelled;
- notifications expose action grouping, accessible error and recovery/empty actions;
- Teacher Help exposes Report a Problem;
- FAQ disclosure state is accessible;
- Report a Problem reuses `submit_contact_request`, adds safe investigation context, warns against secrets and disables duplicate send while busy.

## Validation state

### Completed repository-level validation

- Teacher IA audit against current `main` baseline.
- Timetable source walk.
- Attendance source walk.
- Homework overview and class-homework source walk.
- Assessment source walk.
- Scheme source walk.
- Teach workflow / `LessonFlowCard` source walk.
- Help/contact source walk.
- Task 4 changed-file and dependency audit.

### Not yet valid to certify

- Task 23 TypeScript/build result has not yet been observed as a completed CI run in this connector session.
- Browser/mobile validation against this branch is unavailable from the current execution environment (no local repository/browser runtime).
- Production authenticated Teacher smoke cannot be truthfully completed without a usable Teacher session and without the intended candidate being deployed.
- Exact-current-main certification is blocked because Task 4 and other shared foundations remain open.

## Required reconciliation after foundations merge

1. Fetch exact current `main`.
2. Reconcile Task 4 Teacher operating context, notifications, attendance, homework, learner/profile/progress changes first.
3. Reconcile Task 1 auth/onboarding loading/recovery semantics.
4. Reconcile Task 3 learner identity and Task 8 authorization/privacy constraints.
5. Drop any Task 23 provisional implementation superseded by stronger shared-foundation code; preserve UX requirements, not duplicate architecture.
6. Re-run route/dead-control sweep.
7. Re-run 360x800, 384x832 and 412x915 portrait scenarios: Today, timetable, scheme, lesson plan, active teach, attendance, homework, assessment, learner progress, notifications, profile, help.
8. Verify keyboard-open forms on Android-sized viewport and no critical CTA hidden beneath bottom navigation/keyboard.
9. Verify touch targets, focus/labels, contrast and errors.
10. Run Task 4 contract + Task 23 contract + auth/identity/security gates affected by the reconciliation.
11. Run TypeScript and production build against the exact candidate.
12. Only after shared hold is released: merge through intended release path, deploy once, then run the authenticated production mobile smoke on `vibeschool.co.ke`.

## Production certification checklist status

Current verdict: **NOT CERTIFIED — correctly hold-gated.**

Task 23 may not be marked complete while Task 4 is unmerged and the exact-candidate mobile/build/production gates have not run. No production or merge action should be taken merely to advance this document.

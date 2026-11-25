# Teacher redesign shared components

This is the frontend-only implementation of the relevant design decisions in [REDESIGN.md](https://github.com/eduworldkenya-sys/vibeschool/blob/c7e6d4730749b6a8699a555555bbac9c1555f134/REDESIGN.md), particularly sections 4–5, 24–29, 31–36, 39–42, 47–48. That document remains the broader design source of truth.

## Reuse contract

- Import existing primitives from `ui.tsx` and composed controls from `controls.tsx` and workspace patterns from `workspace-controls.tsx`; do not copy their JSX or CSS into individual redesigned workspaces. Configure labels, actions, variants, data, icons and states through props. Extend the common component for a genuinely reusable new variant.
- Shared styles and semantic appearance tokens are in `redesign.module.css`; deterministic search/filter/reorder/calendar logic lives in `component-logic.ts`. The canonical teacher navigation registry remains `components/teacher/navigation.ts`.
- The Design Lab uses the same imports as the redesigned app. Open Me → Design Lab, or visit `/teacher/redesign?tab=me&panel=lab`. All lab data and actions are synthetic and local.
- Preserve existing product functionality and permissions. Do not introduce a parallel production service, duplicate established UI infrastructure, or bind sample actions to production writes. Reconcile legacy shared components during adoption; this library is canonical for the redesigned Teacher App, not yet a migration of every VibeSchool surface.

## Review matrix

| Family | Implemented representative controls | Remaining evidence or coverage |
| --- | --- | --- |
| Buttons | ActionButton: primary, outline, ghost, destructive, icon, three sizes, pending/disabled | Browser focus and action-state verification |
| Search | SmartSearch: universal, expandable, filtered, recents, clear, local ranked matches | Authorized backend search, typo tolerance, asynchronous cancellation |
| Filters | FilterChips, RecordFilters: inline, advanced draft, multi-subject, sorting/reset, counts | Date ranges where applicable; real server filtering and pagination |
| Forms | TextField, SelectField, CheckField, RadioField, SwitchField, RangeField, inline validation | Upload and rich editor adoption, real draft persistence and validation |
| Navigation | Existing responsive app shell, ContextTabs, ActionMenu, Accordion, deep links | Device/browser back and keyboard verification |
| Overlays | AdaptiveOverlay, centered confirmation, adaptive sheet/drawer; contextual popover sample | Consolidate remaining existing shell overlay internals; focus and device checks |
| Data display | DataTable, Pagination, Calendar, Progress, MetricBars, Timeline | Real records, specialized charts and schedule behavior |
| Feedback | StateView, StatusPill, Notice, Skeleton, retry/undo samples | Real authoritative async outcomes, notification delivery and sync |
| Interactions | ReorderList drag and explicit move controls, keyboard tabs, shell swipe, reduced-motion styles | Touch gesture/browser checks; advanced canvas interactions only where needed |
| Verification | Regression contracts and lab checklist for 320–1440px, themes, text scaling, keyboard | Actual CI, device/browser, assistive technology and production checks |

This matrix records implementation scope, not certification. The broader inventory in REDESIGN.md remains applicable to future real workspaces. No extra product features are implied by illustrative samples.

## Advanced workspace reuse guidance

| Component | Use when | Avoid |
| --- | --- | --- |
| SplitWorkspace | Teachers must consult two related sources or edit alongside a preview; control width and collapse through props. Mobile switches panes without discarding draft content. | Forcing two columns into narrow devices or duplicating standalone routes. |
| ContextToolbar | Actions belong to a selected item or working canvas. | Repeating global navigation or hiding essential actions on hover. |
| CommandPalette | A large authorized tool/action catalogue benefits from quick discovery; retain a visible button as the touch alternative. | Adding multiple global keyboard listeners for the same shortcut in one workspace. |
| BulkSelection | The user explicitly selects several displayed records for a supported operation; count is limited to the current collection. | Claiming the whole server-side dataset is selected or recording mock completion as real. |
| ExpandableWorkspace | Focused content preview or working canvas requires more space. | Implying browser fullscreen or real Live connection; retain a clear exit. |
| ContextPopover | Brief contextual details and secondary actions. | Long forms or destructive confirmations; use AdaptiveOverlay instead. |
| FileField | Select and remove local attachments before an existing authorized upload flow. | Reporting selected files as uploaded or bypassing file validation and storage permissions. |
| ReorderList | User-managed shortcuts, resources and ordered collections. | Drag-only interaction; retain accessible move controls and scope persistence correctly. |

The appearance panel supports theme, accent, compact/comfortable/detailed density, default/large/extra-large text, default/system font and system/reduced motion. Preview preferences and shortcut order are session-only; existing account-scoped storage must be integrated later.

## Browser verification

`scripts/test-teacher-redesign-browser.cjs` mounts the real Design Lab using an isolated local fixture, not a customer-facing route or an authentication bypass. The CI browser job exercises six viewport widths, both themes, horizontal overflow, button pending state, keyboard and dialog focus, search, filters, validation, reorder, split resizing, multi-selection and command palette. These tests must actually pass before the scope can be described as verified. Signed-in navigation, production data, screen-reader evaluation, device-specific touch, and real service integration require separate evidence.

## Stage 2.1 — Today and shared preview state

Implementation contract: issue #2127. The redesigned Today uses `preview-state.ts` as its single local synthetic-record authority. Future workspaces must use these same record IDs and state transitions (extend the model with real existing domain shapes as the workspaces are inventoried), not independent counters. The synthetic clock is fixed at 25 November 2026, 13:50 Nairobi; records are not a school timetable. No service calls or storage writes are introduced.

| Current product source / action | Preview implementation | Coverage limitation |
| --- | --- | --- |
| TeacherTodayV09 / pulse scope, lesson selection | School/independent scope, class and subject, dated occurrence, current/tomorrow/empty | Current authenticated school selector and existing PulseSnapshot adapter are deferred to integration. |
| Lesson readiness / occurrence links | Five preparation indicators with done/pending/unknown; exact occurrence deep links; draft notes, preparation status, linked fixture resources/slides | Scheme, plan, notes, resource and slide editors are not complete; simple sample readiness controls only. |
| Pulse rules / attendance and homework queues | Record-derived counts, distinct homework vs classroom assessment marking destinations, scoped task list, local read notifications | Full registers, homework marks, assessment workflows, urgency rules and attendance evidence remain subsequent workspaces. |
| Live command / existing audience selection | One simulated active/paused session, end history, class/invited/public audience, linked occurrence only for matching class; optional prep | No actual session, audio, providers, participant synchronization, learner UI or real messaging; full Live workspace later. |
| Teacher navigation / shortcuts | Existing registry, shared search, add/remove/reorder/reset, route history and Design Lab | Other registered workspaces still explicitly pending. |
| Pulse loading, empty, offline, error | Explicit synthetic states and retry, local reset | No real fetch/offline caching, slow/partial/session-expired handling yet. |
| Day / weekly insight | Today count, sample timetable, tomorrow fallback | Week planning, actual activity feed, performance/assessment insights, broader actions and nested route inventory remain outstanding. |

The shared browser gate now mounts Today in addition to the Design Lab. The local test server serves only the fixture bundle and logo files; its image adapter stands in for Next Image, not application auth. Tests cover six widths and two system themes, scoped preparation, retained drafts, counts, mock Live lifecycle, retry/reset and deep links. The new tests must actually pass on the candidate SHA. Stage 2.1 is an implementation increment, not completed coverage of all Today or Teacher OS workflows. Signed-in production verification and the required Cyborg completion/lease evidence are not established by these fixtures.

### Navigation visual rule — owner feedback, 25 November 2026

Avoid the generic selected navigation treatment shown in the owner's screenshot: rounded pale-blue fill, thick colored side stripe, and small colored label. Use flat rows, aligned conventional icons, normal readable labels and stronger typography for the current destination; reserve the selected accent for its icon. No persistent selected pill or stripe on desktop or mobile. Hover may use a restrained neutral surface. Preserve accessible current-page semantics, keyboard focus, 44px minimum touch targets and collapsed navigation. This rule applies to the shared redesign navigation; other navigation and component styles require their own appropriate treatment, not automatic removal of all semantic colors.

## Stage 2.2 — Teach batch 1: Subjects, Curriculum and Scheme

The three original routes remain unchanged. The preview now routes registered Subjects, Curriculum map and Scheme of work destinations to dedicated shared workspaces rather than placeholder panels. The source audit identified `app/teacher/subjecthub/page.tsx`, shared `app/teacher/scheme/AuthoritySchemePage.jsx` (used by both routes), the canonical scheme commit/generate routes and the existing dated occurrence contract.

| Existing capability | Synthetic implementation | Remaining scope |
| --- | --- | --- |
| Subject/class selection, subject addition | Searchable grouped assignments, add/remove synthetic pairs with duplicate and dependent-record protection | Actual subject discovery, custom subject creation, independent teacher setup, class onboarding, teammates and subject growth details |
| Curriculum selection | Class/subject-scoped illustrative strands, sub-strands, selected outcomes, term/week handoff and linked scheme | Full official curriculum catalogue, grade-specific reference readers, actual eligible outcome/source records, resources and authoritative allocations |
| Scheme authority and planning | Saved versus suggested records, term/week and query filters, expandable weeks, selected outcome commit, custom lessons, reflection, confirmed unscheduled status, browser print | Actual generation/commit services, specialized grade workflows, authoritative calendar, weekly allocations, and print/export parity |
| Lesson preparation | Existing dated occurrence link opens exact current plan preview; unscheduled draft saves text on the scheme item only | Full lesson editor and unscheduled-to-dated attachment in subsequent phases |
| Teaching state | Shared reducer updates dated scheme status from occurrence start/end; a scheme-readiness checkbox cannot unlink actual sample records | Real delivery, persistence and authorization verified only during backend phase |

The illustrative term/week and outcomes do not represent official KICD source data. New saved scheme items never fabricate a dated timetable occurrence. Subject assignment removal is deliberately non-destructive in the preview. The flat document layout uses existing tokens, buttons, search, fields, overlays and accordion. Explicit selected class/subject/unit links are validated; term/week and query choices are session-local. Saved draft/reflection data survive navigation in memory; unsaved field edits may not. Existing feature-specific components and backend adapters remain unchanged. No production service calls or migrations.

Unit and real Chromium preview tests are added for route round-trip, subject isolation, outcome selection, duplicate protection, unscheduled draft and linked dated plan. Exact-head CI, print/accessibility evidence, signed-in preview deployment, and Cyborg completion evidence remain outstanding; this increment is not full Stage 2.2 completion.

## Stage 2.2 — Teach batch 2: Lesson Plans and Lesson Notes

Source inspection: existing `app/teacher/lessonplan/page.tsx`, `app/teacher/lessonplan/prepare/page.tsx`, `app/teacher/lesson-notes/page.tsx`, `components/teacher/CanonicalLessonNotesPanel.tsx`, `components/teacher/LessonNotesLibrary.tsx`, and canonical `lib/teaching/lessonPlanCodec.ts` / `lessonReadiness.ts`.

| Existing workflow | Preview implementation | Remaining parity |
| --- | --- | --- |
| Dated lesson plan list | Week navigation, class/subject/search and ready/review/no-plan filters, exact occurrence editor | Authoritative school calendar, real plan history and permissions |
| Plan creation/editing | Eight canonical sections, linked synthetic curriculum, draft retention, save/discard, canonical format and readiness validation, Today readiness follows saved plan | Actual content generation and certified source retrieval, production persistence, complete plan history |
| Prepare ahead | Existing unscheduled scheme draft retained locally without inventing a dated slot | Full structured unscheduled editor, attach/archive/restore and timing workflow |
| Lesson notes | Browse/my notes/prepared views over sample records, editable personal notes, canonical saved plan reference, exact linked resources, Teach and Live Studio entry | Certified catalogue, canonical released notes reader, external resources, teaching kit, reflection/evidence and completion workflows |
| Dated linkage | Plan ID, scheme ID and occurrence ID preserved; validation cannot infer delivery or make a missing plan ready from a checkbox | Backend integration and authorized end-to-end verification |

This preview reuses the existing canonical codec and readiness evaluator. Synthetic example text is not a KICD source, approved teaching content or a publication. The sample readiness checks only validate the stored sample plan format/structure, not pedagogical quality. Plan editor changes remain separate until saved; preparation and delivery are distinct. Plan lists and notes use flat shared document rows and existing controls. In-memory draft changes survive navigation within the preview, not a reload. No production writes, new service, migrations or existing route changes. Exact-head CI and signed-in verification are required; full Stage 2.2 parity and Cyborg runtime completion remain outstanding.

### Shared workspace and record-list rule — owner feedback, 25 November 2026

The owner rejected the homework queue screenshot: a padded rounded workspace within a grey shell, a separate rounded card per learner, repeated assignment/class headings, and full-width outline buttons. The shared workspace now uses a continuous flat surface with an aligned heading and back control, without an enclosing card. Collections use the shared `RecordList` in `ui.tsx`: group identical contextual data once, display the record identity and relevant metadata in a compact row, and keep contextual actions on the trailing edge at intrinsic width. Separate rows with subtle dividers rather than multiple nested cards. Preserve 44px interactive targets, accessible labels, keyboard focus, search, empty-state behavior and adaptive layouts.

Apply this pattern to record collections in future Classes, Learners, Homework, Attendance, Marking, Results and similar workspaces. Document editors retain their readable content structure; immersive classrooms retain their own justified layout. Do not blanket-remove meaningful controls, labels, or semantic states. The current increment converts homework, attendance, past sessions and notification queues. It does not implement the full marking or attendance editors, and it is not a completed visual audit of every future workspace. Existing mock operations remain unchanged. Regression checks verify grouping, compact geometry and search.

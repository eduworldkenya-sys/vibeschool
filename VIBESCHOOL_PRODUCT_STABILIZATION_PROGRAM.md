# VibeSchool Product Stabilization and Redesign Program

**Status:** Proposed product operating standard, 25 November 2026. This is a scope and implementation plan, not an audit result or certification.
**Mission:** Make the existing VibeSchool work as intended, with a consistent premium interface. Repair and refine rather than expand.

## 1. Scope and owner direction
- Prioritize existing customer-facing products, journeys and shared foundations. Do not introduce new customer-facing products or unrelated features.
- Exclude HQ and internal worker-management product redesign from this program. Do not route this program through HQ or make HQ a dependency.
- Do not add publishing approvals, eligibility checks, moderation workflows, release restrictions, account restrictions, role restrictions, payment restrictions, or additional user-facing gates as part of this program. Preserve existing intended and authorized behavior. Diagnose and repair unintended blockers, including publishing failures; do not make ordinary users obtain new approvals.
- This document does not change existing security, privacy, tenant isolation, publishing authority, business rules, activation state, or repository governance. If an existing policy causes a verified product defect, document the exact cause and distinguish a bug fix from an actual policy change. Do not invent requirements.
- Reuse existing architecture, code, database, components, integrations and routes wherever possible. Preserve data and legitimate concurrent work.
- Follow AGENTS.md and the existing Cyborg execution framework; the preview is a presentation of evidence, not a second authority, approval or certification system.

## 1A. Solo-founder operating model — owner-approved direction
VibeSchool is operated by a solo founder. Automate quality control, not bureaucracy. Do not assume an enterprise staffing model, a second human approver, an HQ operator, or a review committee exists.

- Treat an explicit instruction from the authenticated, authorized owner as the product decision for its stated scope. Do not request the same authorization again merely because a new chat, agent, or workflow stage begins. Preserve the provenance and scope of the decision.
- Ordinary authorized publishing, editing, teaching, account management and other existing product actions should complete directly, without invented approval queues, artificial waiting periods or unnecessary manual handoffs. Do not conflate manual owner publishing with commissioning autonomous publishing.
- Prefer automated checks, validation, reproducible tests and auditable evidence to redundant human sign-offs wherever the existing governing requirements allow. Where independent assurance is genuinely required, use a separately governed evaluator or reviewer that can actually reject a failure, not a fictional second employee or self-certification.
- Keep actual security, privacy, child protection, authorization, tenant isolation, data integrity, payment safeguards and recovery controls. Apply checks proportionately to risk and distinguish internal engineering verification from customer-facing access restrictions.
- Audit existing approval and permission friction as an explicit stabilization workstream. Trace each blocking condition to its exact UI, API/RPC, schema, policy, feature flag, workflow or governance source. Record purpose, affected roles, risk, whether it is a real technical safeguard or redundant organizational procedure, and a minimal repair or simplification with test evidence.
- Prioritize publishing end to end: authorized creator/owner action, existing validation, persistence, publication visibility, error feedback, and recovery. Fix accidental or duplicate approval requirements without broadening access to unauthorized content or accounts.
- Remove redundant gates only through an explicit, scoped change to their actual governing source where necessary; this program itself does not silently override AGENTS.md, branch protection, applicable independent assurance, existing activation authority or security policy. Report any genuine remaining blocker precisely rather than inventing new requirements.
- Do not create a new approval engine, governance layer, HQ dependency, or separate business workflow for this work.

## 2. Master Preview
Target URL: https://www.vibeschool.co.ke/preview (proposed; confirm canonical domain and routing first). A permanent owner/developer workspace, not an additional customer product. Reuse existing authorized access controls; no new restrictions on ordinary product use. Protect test data, secrets and private records.
Modes:
1. Current: actual existing application screens, associated routes and deployed revision.
2. Redesign: code-backed versions of the same screens using shared components and existing contracts.
3. Audit: functionality, usability, consistency, accessibility, performance and evidence.
4. Compare: before/after with matching device, theme, role and state.
5. Live test: executable journeys against an isolated, authorized test environment; never substitute mocks for production evidence.
6. Repair tracking: defects, root causes, issues, PRs, migrations, test runs and releases.
7. Design system: shared component examples, variants and behavior.
8. Release tracking: deployed version, current evidence, stale evidence and regressions.

Controls: searchable inventory; product, screen, feature, role, device, theme, priority, functional status, design status and deployment filters; direct links to corresponding screens and evidence. Mobile/tablet/desktop and light/dark/system views. Preview routes or embeds must not break navigation, auth or normal app behavior. Clearly identify simulated versus real data. Reuse actual application components rather than maintain an imitation.

## 3. Inventory
Discover from current code and runtime, including static and dynamic routes, navigation, menus, roles, feature flags, component usage, forms, API/RPC contracts, database dependencies, integrations, tests and deployments. Reconcile source discovery with runtime observation; orphan routes and unreachable controls must be recorded. Assign stable identifiers; record intended behavior from authoritative contracts. Inventory is not a feature-creation checklist.
Candidate surfaces to reconcile (not claims that every surface exists):
- Main website, homepage, Explore/discovery and public navigation.
- Teacher OS: classes, timetable, scheme, lesson preparation, notes, resources, assessment, marking, attendance, reporting and tutoring.
- Student OS: Learn, reader, practice, exams, revision, mistakes, progress, tasks and assignments.
- Parent experience, child profiles and learning oversight.
- Live Classroom, VibeMesh, Live Studio, slides, whiteboard, interactive tools and live links.
- VibeTutor and Mini Lessons: create, edit, preview, slides, images, audio, publish, discovery, profiles and interactions.
- VibeChat: search, conversations, messaging, notifications.
- School directory and school management.
- Marketplace and job listings.
- Career Pathways and related discovery.
- Curriculum, content delivery and associated learning resources.
- Authentication, account identities, onboarding, profile, settings, payments and subscriptions.
- Existing customer-facing school administration and cross-product navigation.
Exclude HQ and worker-management redesign. Discover any additional existing customer-facing surfaces from repository truth.

## 4. Universal design system
Audit existing shared components and tokens before introducing replacements. Consolidate duplicate implementations only after mapping consumers. Adopt a single coherent system across roles and products; support intended contextual differences.
- Theme: light, dark, system; semantic color tokens, brand color, text/background/borders, contrast and statuses.
- Typography: consistent font family, scale, weights, line height and hierarchy; avoid arbitrary text styles.
- Layout: spacing scale, padding, margins, gaps, alignment, grid, breakpoints, safe areas, max widths, borders, radius, elevation, dividers.
- Icons: one family, consistent sizes, meaning, labels and placement.
- Motion: purposeful transitions, reduced-motion support, no gratuitous animation.
- Accessibility: keyboard navigation, focus states, semantic labels, contrast, touch targets, screen reader support and text scaling.
- Responsive behavior: compact mobile-first layout, adaptive tablet/desktop, no unnecessary scroll or overflow; allow scrolling where essential to content and accessibility.

## 5. Components and interactions to standardize
| Area | Inventory and behavior |
| --- | --- |
| Navigation | Back, close, home, header, sidebar, bottom navigation, tabs/subtabs, breadcrumb, more/ellipsis menu, dropdown, swipe, history, deep links, return position, external links |
| Search | Global/module/user/school/content search, input, suggestions, recents, history where existing, matching, results, clear, empty/no results, loading/error, relevance and speed |
| Filters/sorting | Filter panel, chips, categories, single/multi-select, date range, sort, apply/reset/clear, active indicators, persistence where intended, pagination and infinite scroll where suitable |
| Onboarding/auth | Welcome, sign in/up, Google/email, verification, recovery, role selection/switching, multiple identities, first-time and returning users, skip, session expiration, logout and account deletion where supported |
| Profile/settings | Avatar, username, display information, edit, public/private views, privacy, notifications, theme, language where supported, linked accounts, subscription, parent/learner, school linking and account security |
| Buttons | Primary, secondary, text, icon, floating actions where needed, toggles, checkbox, radio, slider, disabled/loading/pressed/focus states; save, cancel, edit, delete, publish, unpublish, share, download, retry, undo and confirm |
| Forms | Text, number, password, textarea, rich text, date/time, selection, uploads, images/audio, validation, required/optional, keyboard, autofill, autosave, drafts, unsaved changes, submit/recovery |
| Presentation | Cards, lists, grids, tables, accordions, carousels, media players, document viewer, slides, diagrams, charts, graphs, progress, preview, fullscreen, expand/collapse, read more/less |
| Feedback | Loading, skeleton, success, error, warning, toast, empty, offline, slow connection, recovery, permissions, session expiry, maintenance, dialogs, progress, real-time/sync states |
| Communication | Notifications, unread indicators, mentions, messages, conversation search, delivery states, links, copy, invites, announcements and activity where existing |

Use the actual product inventory to determine applicability. Do not implement a missing component merely because it appears in this reference list.

## 6. Action lifecycle and product language
Every existing action should be understandable, reachable and functional, with actual state feedback. Example: Prepare -> Preparing -> Prepared; Save -> Saving -> Saved; Publish -> Publishing -> Published; Join live -> Connecting -> Connected; Submit -> Submitting -> Submitted; Mark -> Marking -> Marked. On failure provide a meaningful error and recovery, retain input where appropriate and prevent unintended duplicates. Success must correspond to confirmed operation, not a cosmetic toast.
Prioritize the next useful action, especially live teaching and upcoming lesson preparation where applicable. Expose frequently used tools, progress and remaining steps in compact layouts. Preserve instant workflows.
Remove AI-sounding copy, long introductions, marketing language inside workspaces, redundant headings, repetitive instructions, excessive badges, decorative gradients, oversized cards, wasted space and generic labels. Prefer direct action verbs and precise state labels. Provide contextual help only when useful; do not remove essential accessibility, safety or error information. Do not add unnecessary confirmations or onboarding hurdles. Keep interactions familiar and predictable.

## 7. Functional and engineering audit
For each existing feature, inspect the actual entrypoint, UI handler, navigation, server/API/RPC, schema, migration compatibility, data persistence, permission boundary, integrations, failure/retry and intended end-to-end outcome.
Audit architecture, dependencies, duplicate/obsolete code, unused routes/components, contracts, configuration, environment references, errors/logging, authentication, authorization, RLS/grants, integrity, and deployment alignment. Do not expose secrets or private user records in the preview. Reconcile database migrations through existing mechanisms; do not perform destructive or unrelated database operations.
Performance: initial load, navigation, search, queries, API latency, images, bundle size, cache, network requests, memory, mobile/low-bandwidth, offline behavior where supported, real-time performance and stability. Measure on representative environments, record baselines and compare improvements; no arbitrary new business gates.

## 8. Journey tests
Verify current supported flows and roles, using isolated test accounts/data and authorized environments:
- Guest: discover -> explore -> register.
- Learner: register -> select level -> learn -> practice -> exams -> progress.
- Teacher: sign in -> class -> prepare -> teach -> assess/mark -> record.
- Live teacher: prepare (optional) -> preview/rehearse -> go live -> teach -> end; also instant live and participant reconnect.
- Parent: register -> add/manage child -> monitor learning, with existing subscription behavior.
- Creator: create -> edit -> preview -> publish -> discover/read; exercise ordinary publishing without introducing new approvals.
- Chat user: find account -> send -> receive reply.
- School administrator: manage existing school, teachers and classes.
- Customer: subscription -> payment -> access, using authorized test/sandbox transactions.
- Job seeker: search -> filter -> view -> apply where supported.
- Career explorer: discover -> compare -> select pathway where supported.
Include reload, back, deep-link, role boundaries, slow/failing network, empty data, invalid input, retry, duplicate prevention and cross-device states as applicable. Unavailable or unsupported behavior is not automatically a defect; compare with the intended existing contract.

## 9. Evidence and statuses
Maintain independent fields; never collapse design quality and working status:
- Functionality: WORKING, PARTIAL, BROKEN, UNTESTED, NOT_APPLICABLE (reason required).
- Design: CONSISTENT, NEEDS_REDESIGN, IN_REVIEW, APPROVED, UNASSESSED.
- Inventory: ACTIVE, REDUNDANT_CANDIDATE, DEPRECATED, UNKNOWN.
- Test: PASS, FAIL, NOT_RUN, STALE (per scenario and environment).
- Repair: OPEN, IN_PROGRESS, IN_REVIEW, MERGED, VERIFIED, TRACKED.
- Deployment: PREVIEW, PRODUCTION, NOT_DEPLOYED, UNKNOWN.
- Production verification: VERIFIED, FAILED, UNVERIFIED, STALE.
Working means the applicable intended outcome was actually tested, with evidence; render-only, static inspection, a merged PR or passing unrelated CI cannot prove it. Evidence must state scope, version/SHA, environment, timestamp, producer, test scenario and result. Maintain links to evidence and distinguish test/production. Invalidate affected evidence after changes. No fabricated metrics, statuses, screenshots or test outcomes. Keep engineering certification in the existing canonical system.
Per-record fields: stable ID, product, route, role, intended behavior/source, actual behavior, component/API/data dependency links, status fields, reproducible steps, expected/actual results, device/theme/network, severity, root cause, evidence, exact revision, related issue/PR/migration/release, next repair action and updated timestamp. Avoid duplicating authoritative records; link to them.

## 10. Defect priorities
P0: critical sign-in/access, data loss, security or essential service outage.
P1: core journey failure (teach, learn, publish, join live, submit/assess).
P2: other functional defects (navigation, search, filters, partial workflow).
P3: design consistency, accessibility or usability issues not already higher impact.
P4: minor refinements.
Classify by actual impact; elevate accessibility, privacy and data risks as needed. Repair shared root causes first; do not hide failures by disabling features, adding approval steps, weakening tests or replacing real functionality with placeholders.

## 11. Workspace structure
Proposed logical sections (not a requirement to create thirteen independent pages):
/preview, /preview/products, /preview/screens, /preview/features, /preview/components, /preview/design-system, /preview/journeys, /preview/audit, /preview/defects, /preview/redesigns, /preview/tests, /preview/database, /preview/performance, /preview/releases.
Prefer a small coherent workspace with tabs or nested routes using existing architecture. Database section exposes safe metadata/evidence only. Link to actual GitHub issues and PRs rather than replicate an issue tracker. Keep preview read-only with respect to live customer data; testing uses separate authorized environment.

## 12. Tooling and team responsibilities
Reuse GitHub, Supabase, Vercel and current CI/tests. Evaluate existing component catalog/Storybook, browser automation/Playwright, unit/integration tests (Vitest or existing equivalent), visual regression, accessibility and performance tools (Lighthouse or existing equivalent). Use Figma only where it helps. Do not install duplicate tooling without demonstrated need.
Product: inventory and intended behavior. Design/UX: shared system, copy and usability. Frontend/backend/database: canonical repairs and migration compatibility. QA: reproducible test evidence and regression tests. Security: preserve boundaries. Operations: deployment verification, performance and monitoring. Owner: product direction and review of significant design decisions. These are responsibilities, not new approval roles or user-facing restrictions.

## 13. Execution phases
A. Discover existing implementation, pending changes, test infrastructure and reusable internal preview capabilities; catalogue routes, features, components and journeys. Record gaps as unknown, not broken without evidence.
B. Establish current baseline and reproduce high-impact failures; identify shared root causes. Build a minimal code-backed preview index using real inventory and evidence.
C. Standardize shared tokens, navigation and controls. Compare current versus redesigned screens with representative users/devices; avoid speculative wholesale replacement.
D. Repair P0/P1 and shared foundations; then other functional and design issues. Preserve normal publishing and access behavior; diagnose any existing unintended barriers.
E. Execute relevant unit, integration, browser, accessibility, negative-path and regression tests. Reconcile migrations, review/merge/deploy via existing engineering workflow and verify actual production behavior.
F. Keep inventory and evidence current; re-audit affected dependencies, record regressions and continue through remaining existing surfaces.
Loop: discover -> audit -> prioritize -> standardize/redesign -> repair -> test -> reverify -> merge/deploy under existing repository process -> verify production -> update evidence -> repeat.
No new approval mechanism, new business restrictions or HQ dependency is authorized by this plan.

## 14. Definition of done
For each applicable existing feature: intended functionality preserved and demonstrated; consistent shared design; concise product language; buttons and navigation work; search/filters work when present; representative devices and themes checked; accessibility and performance reviewed; data persists correctly and permissions are preserved; loading/error/recovery handled; relevant tests and complete journey pass; migrations compatible; exact revision and deployment evidence recorded. Production verified status requires actual production evidence.
For the preview: actual routes and features catalogued with traceable coverage, current and redesigned views clearly distinguished, real evidence and honest unknowns, searchable/filterable inventory, safe isolated tests and links to existing repair records. No assertion of whole-product completion while scope remains unvisited.
These are engineering acceptance criteria, not additional customer restrictions or publishing approvals.

## 15. First implementation assignment
Inspect repository truth and existing reusable architecture; map routes, products, shared components and tests; discover preview candidates and current deployment domain; produce a real route/feature inventory with honest UNTESTED defaults; identify the highest-impact reproducible defects; propose a minimal implementation using existing components. Then repair and refine iteratively. Do not claim the preview is live until deployment is verified.

## 16. Detailed interaction and visual refinement
Audit existing modals, bottom sheets, tooltips, context menus, active/selected/pressed/focus states, status indicators, sticky headers, floating controls, keyboard insets, portrait and landscape layouts, fullscreen entry/exit, gestures (tap, swipe, drag, zoom, long press where supported), scroll restoration, visual density, logo, favicon and installed app icon. Keep important actions visible without obscuring content; use consistent dismissal and back behavior. Check touch targets and accessible keyboard alternatives to gestures. Keep explanations contextual and concise. Use shared components and tokens rather than per-screen exceptions. Do not add an interaction solely because it appears in this audit list.

## 17. Application continuity and device behavior
- Verify refresh, navigation history, browser back/forward, scroll position, autosave, draft recovery, resume, preferences and appropriate state persistence across sessions and devices.
- Verify synchronization across screens and roles, real-time event delivery, reconnect and recovery from interruption; prevent unintended duplicate actions and conflicting writes.
- Verify date/time formatting and timezone handling (including Africa/Nairobi for Kenyan use cases), device orientation, virtual keyboard, and existing camera/microphone/file permissions and denial/recovery paths.
- Test existing file upload, preview, replace, delete, file size/type handling, sharing, link destinations and link previews. Preserve legitimate drafts when errors occur.
- Inspect existing PWA installation, service worker, cache invalidation, application updates, offline behavior and subscription-aware access. Do not require users to clear caches to recover from an ordinary release. Respect existing intended offline and access policies.

## 18. Product-specific functional audit extensions
Reconcile these candidate capabilities against the existing application; a listed item is not proof of implementation and does not authorize a new feature.
| Product | Additional verification |
| --- | --- |
| Teacher OS | Prepared and archived lessons, dated timetable-to-scheme-to-outcome linking, resources, notes, marking, attendance, record persistence |
| Student OS | Reader position and resume, practice feedback, mastery, mistakes/retry, revision, offline learning, progress persistence |
| Live Classroom / VibeMesh | Real audio between participants, mic and speaking controls, joining via existing links, participant state, slides/whiteboard synchronization, reconnect, session end, existing fallback behavior |
| Live Studio | Optional preparation, resource linking, rehearsal, preview, instant live and transition to the same classroom |
| Interactive tools | Individual tool correctness, meaningful interactivity, touch/mouse/keyboard behavior, responsive layout, teaching and learner views where applicable |
| Mini Lessons | Images, slides, audio record/import, drafts, edit, preview, publish, discovery, visibility, sharing and deletion |
| VibeTutor | Teacher discovery, profiles, existing bookings, tutoring workflows and linked classroom tools |
| VibeChat | User search, sending/receiving, delivery state, unread counts, conversation search and synchronization |
| Accounts | One email with separate authorized identities, role switching, onboarding, profile, school and parent/learner linking without identity leakage |
| Payments | M-PESA sandbox or authorized test flows, reconciliation, duplicate protection, subscription expiry, restoration and intended access |
| Curriculum | Existing published content completeness, curriculum/scheme links, resource references, correct level, answer/feedback integrity and learner visibility |
| PWA | Installation, version updates, cache coherence, offline reading and supported tools, recovery on reconnect |
Do not add HQ or internal worker-management dependencies. Use the source-defined intended behavior and existing product decisions; investigate contradictions before changing behavior.

## 19. Individual action inventory and test contract
Catalogue each existing meaningful interactive action, not merely each page: buttons, icon actions, links, menus, filters, inputs, toggles, gestures and relevant keyboard shortcuts. Use stable action IDs tied to parent screen, role and state; reusable components may share tests but each material usage/context must be accounted for. Discover from source and rendered interfaces, including conditional, responsive and role-specific actions.
Each action record includes visible label/accessibility name, route and component, trigger, intended behavior/source, applicable preconditions, handler and destination or API/RPC, expected state transitions, data side effects, success/error/retry behavior, observed result, evidence link, exact revision/environment, status, last-tested date, defect/PR reference and next repair action. If an action is legitimately unavailable in a given state, record why rather than assume it is broken. Test actual user interaction and observable outcome, including persistence when relevant; visual appearance alone is insufficient.
In the preview, a screen inspection shows its individual actions and their statuses, with drill-down to evidence and repair references. Example Mini Lesson actions to reconcile: Add image, Add slides, Record audio, Import audio, Save draft, Preview, Publish, Edit, Delete and Share. Do not create missing actions solely to satisfy the example.

## 20. Master Preview usability and measurable coverage
Make the preview usable by the solo founder without reading source code or operating several dashboards. Provide direct links to verified existing production routes and code-backed redesigned screens; compare matching role/device/theme/state. Where available, retain sanitized before/after screenshots, test recordings, failure traces and regression history linked to the relevant revision. Keep artifacts in existing suitable storage; redact private data and secrets. Expose last-tested dates, actionable defect summaries, next repair actions and links to the existing GitHub issue/PR and deployment evidence. No new approval engine, manual sign-off workflow or HQ dependency.
Track distinct inventory totals for products, screens/routes, features, individual actions, shared components, user journeys and applicable test scenarios. For each entity type show discovered, applicable, not applicable (reason), untested, tested, passed/working, failed/broken, partial where meaningful, stale, needs redesign and production verified. Keep independent status dimensions separate so overlapping design and functional counts are not summed as if mutually exclusive.
Coverage formula: current tested applicable entities / discovered applicable entities, with numerator, denominator and environment displayed. A tested entity has current applicable evidence, whether passing or failing; report pass and production-verification coverage separately. Exclude justified not-applicable entities from the denominator and show exclusions; do not silently exclude unknown, failed or stale items. Label an incomplete inventory as provisional, never claim full-product coverage based on discovered items alone. Show missing inventory areas, last discovery run, evidence freshness and change since previous comparable baseline; do not fabricate counts or percentages. Invalidate only evidence affected by code, configuration, schema or deployment changes. Avoid introducing a parallel certification ledger.
Prioritize a compact searchable dashboard with drill-down filters for broken, partial, untested, stale and redesign-needed items. Show useful counts and clear next actions, not decorative charts or lengthy explanations. Preserve user navigation and ordinary application performance; the preview is an internal evidence workspace, not another customer product.

## 21. Expanded test matrix and regression evidence
Reuse available test infrastructure. Cover representative supported browsers (Chrome, Safari, Firefox, Edge), Android/iOS physical devices where available, desktop/tablet/mobile viewports, light/dark/system themes and relevant authenticated roles. Distinguish emulated from physical devices and record unavailable environments honestly. Test:
- Individual action and link destinations, accessibility names, focus, keyboard and touch.
- Visual regression and responsive layout, including overlays, overflow, keyboard, rotation and fullscreen.
- Unit/integration and end-to-end tests against actual intended contracts, including persistence after reload and reauthentication.
- Multi-user and concurrent scenarios (teacher/learner, messaging, shared records, permissions), real-time events, retry, interrupted networks and safe duplicate protection.
- Regressions for reproduced defects and positive/negative paths, deployment smoke tests and production verification using authorized non-destructive operations.
- Practical usability tasks with representative users or a clearly labeled test evaluator; do not substitute synthetic evidence for physical-user evidence.
Record failures, missing environments and test scope without inventing a new release gate or requiring the solo founder to arrange extra organizational approvals. Existing mandatory governance remains applicable.

## 22. Kenya-first usability and performance
Test the existing application on representative affordable Android phones, small screens, constrained memory and slow/intermittent mobile data; include connection loss and recovery. Measure bandwidth, loading responsiveness, unnecessary requests, media size, and live-class data/battery impact where practicable. Use real or clearly labeled simulated network/device conditions and compare against baseline, not arbitrary thresholds. Verify Kenyan terminology, date/time and KSh display and existing M-PESA journeys. Make labels understandable to teachers, learners and parents with limited technical experience. Preserve accessibility and intended user freedom. Do not add new account, publishing, or access restrictions in the name of localization or optimization.

## 23. Additional acceptance evidence
A stabilization record is actionable when it identifies the existing screen/action, intended outcome, current observed behavior, reproducible evidence, design inconsistency if any, root cause or investigation needed, and next repair. A repaired record links regression proof and exact release evidence. Inventory coverage and the preview's before/after comparison must be maintained as work proceeds, not filled in retrospectively with assumptions. These sections extend the audit checklist only; they do not impose new customer-facing features, approval stages, restrictions or HQ involvement.

## 24. Universal action feedback, submission and recovery standard
Every existing operation must communicate what is happening, whether the intended outcome occurred, and what the user can do next. Use one coherent feedback pattern across products; extend existing shared primitives rather than invent parallel systems. No extra approval, user restriction or mandatory confirmation is introduced by this standard.

### 24.1 Action state lifecycle
- Ready: clear action-specific label; actionable when the existing preconditions are met. Explain a genuinely unavailable action near the control, not through a silent disabled button.
- Editing/dirty: distinguish unsaved changes from saved state when relevant. Preserve entered data, attachments and selection.
- Validation: use concise inline field messages, preserve valid inputs, focus or identify the first invalid field, and avoid reporting success. Validate again at the authoritative boundary.
- In progress: show prompt local feedback such as Saving…, Sending… or Submitting…, progress for long uploads where measurable, and prevent accidental duplicate execution of the same action without unnecessarily disabling unrelated controls. Allow cancellation only where it is actually supported.
- Success: confirm the authoritative result; update the affected view, list, counts and related state. Use brief inline status, a non-blocking toast/snackbar, or the actual resulting screen as appropriate. Do not interrupt routine actions with congratulatory dialogs or require users to dismiss redundant feedback.
- Failure: retain work, restore usable controls, communicate the actual problem in plain language, and offer a safe next action (retry, edit, reconnect, or return) where applicable. Do not swallow errors or expose secrets, SQL, stack traces or raw internal errors to customers.
- Unknown/pending: a timeout, interrupted connection or ambiguous response does not establish failure or success. Reconcile with authoritative operation status before replaying consequential actions, distinguish queued/pending from completed, and never duplicate an already committed write.
- Partial success: identify completed and incomplete parts truthfully; allow safe retry of the unfinished parts where supported. Do not represent a partial batch as entirely successful.
- Recovery: preserve drafts/input and context where appropriate, use existing idempotency or duplicate-prevention mechanisms, and verify the result after retry, reconnect or reload. Announce successful recovery without repetitive messages.

### 24.2 Existing operation examples
| Operation | In progress | Confirmed outcome | Failure or unresolved state |
| --- | --- | --- | --- |
| Save / autosave | Saving… | Saved / last saved time if useful | Not saved — Retry; retain edits |
| Submit assignment/exam | Submitting… | Submitted; show actual receipt or results when appropriate | Not submitted — Retry if known failed; checking status if uncertain; retain answers |
| Send message | Sending… | Sent; Delivered/Read only when corresponding evidence exists | Not sent — Retry; preserve message and avoid duplicates |
| Publish | Publishing… | Published; reflect actual visibility, provide view link where relevant | Couldn't publish — Retry or fix the actual error; preserve draft |
| Upload / import | Uploading… / Importing… | Uploaded / Imported; update preview | Upload failed — Retry; preserve other successful uploads |
| Edit / update profile | Saving… | Changes saved; update displayed profile | Changes not saved — Retry |
| Delete / remove | Deleting… / Removing… | Deleted / Removed; update list; Undo only if real recovery is supported | Couldn't delete — Retry; keep authoritative item visible |
| Mark / record attendance | Saving… | Marks saved / Attendance recorded | Couldn't save — Retry; retain entries |
| Join / start / end live | Connecting… / Starting… / Ending… | Connected / Live / Ended, based on actual session state | Connection failed or reconnecting; offer valid recovery |
| Payment / subscription | Processing… | Payment confirmed and access updated when both are verified | Payment pending, failed, or access update pending; reconcile before retrying payment |
| Download / export / share | Preparing… | Actual file ready, link copied or share result confirmed where observable | Couldn't prepare/copy — Retry; do not claim that a share recipient received content without evidence |
| Search / filter | Searching… if noticeable | Actual results or clear no-results state | Couldn't load results — Retry; retain query/filters |

### 24.3 Feedback placement and interaction design
- Use the control itself for immediate progress, inline messages for field-specific errors, brief toast/snackbar for non-blocking outcomes, persistent inline/banner feedback for unresolved problems or actions requiring attention, and dialogs only when a genuine decision or destructive confirmation is appropriate under existing product behavior.
- Use consistent typography, semantic colors, icons and placement in light/dark/system themes; do not rely on color alone. Ensure screen-reader announcements, focus management, touch accessibility and non-obstructive placement above mobile navigation/keyboard as applicable.
- Avoid stacking identical toasts, repetitive explanations, artificial delays, unnecessary redirects and success popups that block the next task. Provide a clear next action only when useful. Keep copy concise and precise: Saved, Sent, Submitted, Published, Not saved, Retry.
- Do not use generic “Something went wrong” when a safe specific explanation is available. Keep technical diagnostics in existing logs with relevant operation correlation identifiers, and make customer messages actionable without exposing private information.
- Optimistic UI is appropriate only for suitable reversible operations and must reconcile or visibly roll back on failure. Never claim completed publishing, payments, exam submissions, delivery or other consequential outcomes from optimistic state alone.
- Respect the existing destination and workflow: stay on the screen after routine saves unless the intended action navigates elsewhere; preserve back/scroll context and reflect completed changes on return. Warn about unsaved work only when loss is a real risk, not after a successful save.

### 24.4 Action feedback verification
For each applicable action in the inventory, exercise ready, pending, success, actual failure, retry/recovery, slow network, interruption/timeout, rapid double-tap, and reload/reopen paths; add partial completion, offline queue, cancellation and cross-user delivery checks when supported. Verify authoritative data and downstream visibility, not merely the displayed toast. Verify that success indicators never appear on failed operations, errors do not erase legitimate input, and a retry does not duplicate writes or messages. Record evidence and defects using the existing preview inventory and engineering records. These are refinements and tests of existing operations, not a mandate to build new features or add approvals.

## 25. Interaction effects, meaningful rewards and workflow completion
Extend the universal action feedback standard in section 24 to the complete user experience. Audit and refine existing interactions rather than invent new products, reward systems, approvals or restrictions. Effects must serve an actual user outcome.

### 25.1 Microinteractions and perceived responsiveness
- Provide immediate, visible pressed/focus feedback on buttons; distinguish active selections, tabs, toggles, drag targets and disabled states. Make clickable elements discoverable without excessive labels.
- Use consistent, brief and purposeful transitions for menus, dropdowns, sheets, tabs, dialogs, list changes, loading, progress and navigation. Maintain stable layouts and input focus. Do not introduce artificial delays or animations that delay the next action.
- Use a subtle checkmark or state change for ordinary confirmed success; visibly update actual progress when a step completes. Reserve optional celebratory effects for meaningful accomplishments. Make failure and recovery clear without alarming, repetitive or distracting effects.
- Existing draggable/interactive teaching objects must follow pointer or touch reliably, with appropriate selection and movement feedback, keyboard alternatives where applicable and consistent response across supported devices.
- Respect reduced-motion settings, device capability, accessibility, low memory, mobile bandwidth and battery usage. Effects must not obscure content, block controls or replace text/semantic feedback.
- Audit existing sound, timer alerts, message sounds, correct/incorrect answer feedback, classroom connection alerts, milestone sounds and haptics where supported. Keep them proportionate and respect available sound preferences, silent mode and browser/device capabilities. Do not introduce a new sound/haptic subsystem merely to satisfy the audit.

### 25.2 Meaningful rewards and accomplishment
Reward users primarily by showing real progress, completed work, useful outcomes and the next meaningful action. Do not invent scores, mastery, certificates, approvals, badges, earnings, bookings or achievements. Do not create points, streaks, leaderboards or a new reward engine under this program. Avoid manipulative engagement patterns and distracting celebrations, particularly for learners.
Examples to reconcile against existing functionality: a completed lesson preparation shows actual completed steps and readiness; an assessed practice activity shows the actual score, remaining mistakes and available review; a published Mini Lesson shows confirmed publication and its existing view/share action. Marking, attendance, progress and curriculum completion must reflect authoritative records. Completion and readiness are distinct from permission or approval: a preparation progress indicator must not block instant teaching when that is already supported.

### 25.3 Completion and next useful action
Audit every existing workflow for a useful conclusion rather than a dead end. Preserve user choice; do not force a redirect, extra step or another approval when a direct continuation is intended.
| Confirmed outcome | Existing next action to verify where applicable |
| --- | --- |
| Account created / profile updated | Enter or return to the intended workspace |
| Lesson prepared | Preview or teach; preserve optional instant teaching |
| Live preparation finished | Go live using the existing classroom |
| Live class ended | View available lesson summary or return to teaching |
| Assessment submitted | View actual submission/results when available |
| Practice completed | Review mistakes or continue |
| Topic mastery achieved | Continue learning according to the existing mastery contract |
| Mini Lesson published | View or share the actual publication |
| Payment confirmed and entitlement updated | Access the purchased service |
| Attendance recorded | Continue teaching |
| Marking completed | View available class performance or return to records |
Do not implement an absent summary or next action solely because it is listed; reconcile against intended existing functionality first.

### 25.4 Acknowledgements, confirmations and approvals are different
A success acknowledgement reports a verified outcome and does not require permission. Ordinary authorized saves, submissions, message sends, profile edits, follows and publishing should execute directly with meaningful feedback. Use undo for reversible operations only when actual restoration exists. Retain proportionate existing confirmations for destructive irreversible actions, actual transaction authorization and essential security requirements. Do not add confirmation dialogs to routine actions or require the solo founder to approve work twice.
Where an existing approval process genuinely applies, show its actual pending/approved/rejected status, reason where appropriate, and available next action. Diagnose redundant approval gates under section 1A, distinguish them from essential authorization and existing independent assurance, and repair the governing source through the existing engineering process. Never invent an approver, approval state, waiting period, HQ dependency or additional publishing restriction. Do not mislabel a successful save as an approval or a pending process as completed.

### 25.5 Context continuity and intelligent convenience
Verify that existing workflows remember relevant user context: reader position, prepared lesson drafts, next lesson priority, correct role workspace on account switch, relevant search filters, preferences, first-time instructions, and theme. Reconnect supported interrupted operations; reflect successful profile updates and learning progress across relevant screens. Preserve role and account isolation. Avoid repeating onboarding or explanations after they are no longer useful. Do not introduce unrelated personalization or automation features.

### 25.6 Complete interaction inspection and quality dimensions
For each meaningful existing action inspect discoverability -> understanding -> immediate interaction feedback -> processing -> confirmed completion or failure -> meaningful progress/outcome -> optional next action -> recovery when required. Failure/recovery is an alternative branch, not a required step after success. Record observable behavior and evidence in the action inventory.
Assess functionality, visual design, design consistency, interaction quality, performance, contextual convenience, user satisfaction/usability, accessibility, reliability and workflow simplicity. Include affordance, discoverability, feedback timing, progress visibility, cognitive load, error prevention, recovery, consistent terminology, perceived speed, trust in displayed results and cross-product continuity. Use actual evidence rather than invented satisfaction or quality scores. Inspect reduced motion, accessibility, representative low-end devices and relevant failure paths in addition to the normal success path.
These are design and engineering refinement standards for existing functionality. They do not authorize new customer-facing features, a reward or approval engine, or new release restrictions.

## 26. Loading, system states and perceived performance
### 26.1 Universal loading patterns
Use existing shared primitives to standardize loading. Prefer instant display and local, non-blocking indicators. Select a pattern according to the operation rather than applying a full-screen spinner everywhere:
- Skeleton placeholders matching the actual content layout for initial profiles, feeds, dashboards and lesson loading; optional restrained shimmer respecting reduced motion.
- Indeterminate progress indicators for unknown-duration operations; determinate progress for real measurable transfers or work. Never fabricate percentages or time remaining.
- Button-level pending feedback for saving, sending, submitting and publishing; keep unrelated controls usable.
- Progressive rendering and component-level loading for independent content; retain usable content during refresh and background revalidation, identifying stale or offline data when relevant.
- Existing pull-to-refresh, pagination/infinite-list loading, media buffering, lazy loading and cache reuse where suitable. Avoid duplicate requests, flicker, layout jumps, artificial delays, blank screens and endless spinners.
- Prefetch judiciously; avoid unnecessary mobile data consumption or fetching unauthorized/private data into shared caches.
### 26.2 Complete system-state matrix
Catalogue applicable states for every existing screen and action. Distinguish initial launch, session restoration, initial/partial/progressive/background loading, refreshing, available/empty/stale/unavailable content, search input/results/no results, editing/validation/submitting, unsaved/saving/saved/not saved, online/offline/unstable/reconnecting, queued/syncing/synced/conflict, sending/sent/delivered/read/failed, signing in/authenticated/session expired, payment processing/pending/confirmed/failed, draft/publishing/published/failed, live connecting/connected/reconnecting/ended, media buffering/playing/paused/completed, update/interruption/recovery. Do not create unsupported states or features just to fill the matrix.
Use a concise and meaningful empty state with an existing relevant action; distinguish genuinely empty data from request failures and denied access. Errors provide a valid retry or recovery route. Preserve context and permitted unsaved work after interruption or session recovery, without leaking data across identities. Partial success displays the available content and the unresolved part. Resolve timeouts and ambiguous writes against authoritative state before retrying consequential operations, as required in section 24.
### 26.3 Response and performance reference targets
Use Nielsen Norman Group's approximate 0.1 s / 1 s / 10 s response-time heuristics to guide immediate visual acknowledgement, short waits and longer operations with useful progress or recovery. These are UX heuristics, not artificial delays, network deadlines, business restrictions or new release gates.
Use Google's good Core Web Vitals thresholds as optimization references: LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1, evaluated at the 75th percentile of real visits where sufficient data exists, separately for mobile and desktop. Distinguish field measurements from laboratory tests and missing data. Record baselines and comparable measurements by route, device, network and revision; prioritize meaningful improvements, particularly low-end Kenyan Android devices and mobile connections. Never claim targets met without evidence.
### 26.4 Engineering optimization and resilience
Inspect current architecture and tooling before applying optimizations: streaming, appropriate code splitting, component-level loading and error boundaries, request deduplication, search debouncing and cancellation of stale requests, secure cache partitioning and invalidation, background revalidation, suitable reversible optimistic updates with rollback, image/media optimization, virtualized lists where useful, bounded retries and backoff for safe operations, database query optimization and state restoration. Use installed framework capabilities compatible with the actual version. Preserve intended permissions and authoritative write semantics; avoid stale results overwriting newer results, endless retries, repeated payments, duplicate submissions and accidental data loss.
Recover from poor connectivity, save/message failure, interrupted exam submission, delayed payment response, live disconnection, expired sessions, interrupted uploads where resumable, rapid double taps, localized rendering failures, updates and search errors using existing intended workflows. Keep logs diagnostic and safe, never expose private data or raw internal errors in UI.
### 26.5 State Inspector within Master Preview
Extend the existing proposed preview inventory rather than building a separate customer-facing application. Inspect each actual screen in its applicable states, with selectors for role, device, theme, network and state; compare current versus redesigned components with matching conditions. Include normal, loading, empty, offline, error, saving, saved, session expired and other relevant states from 26.2. Use isolated test data and controlled test fixtures for deterministic visual inspection; explicitly label simulated states. Link real browser/functional evidence separately, including screenshots/traces, backend outcomes, revision and test environment. A fixture rendering correctly is not proof that the live state works. Track state coverage, missing evidence and regressions in the existing inventory. Never trigger real payments, publication, messages or other production side effects merely to preview a state.
### 26.6 Product experience disciplines and reference sources
Apply visual, interaction, motion, sound and haptic design; concise UX writing; information architecture and navigation; feedback and meaningful accomplishment; responsive/adaptive and inclusive design; state management, resilience, performance, usability, QA, design engineering and cross-product continuity. Ensure accessible status announcements without unnecessarily moving focus, meaningful non-color cues, reduced motion and appropriate interruption levels.
Reference guidance (adapt to VibeSchool's current architecture and scope, not additional customer-facing restrictions):
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/loading and https://developer.apple.com/design/human-interface-guidelines/progress-indicators
- Android app quality: https://developer.android.com/docs/quality-guidelines/core-app-quality and offline-first architecture: https://developer.android.com/topic/architecture/data-layer/offline-first
- IBM Carbon Design System: https://carbondesignsystem.com/
- Nielsen Norman Group usability and response times: https://www.nngroup.com/articles/ten-usability-heuristics/ and https://www.nngroup.com/articles/response-times-3-important-limits/
- Google Web Vitals: https://web.dev/articles/vitals
- GOV.UK Design System: https://design-system.service.gov.uk/
- WCAG 2.2 and status messages: https://www.w3.org/TR/WCAG22/ and https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- Next.js loading, navigation and optimization: https://nextjs.org/docs/app/api-reference/file-conventions/loading and https://nextjs.org/docs/app/getting-started/linking-and-navigating
No HQ dependency, new approval system, unnecessary restrictions, new customer-facing products or invented performance certification. This section extends the stabilization and audit standard, not proof of implementation.

## 27. Multidisciplinary product team operating model
Deliver the quality of a coordinated senior product organization while remaining a solo-founder business. The following are specialist responsibilities and perspectives, not new employees, agents with independent authority, mandatory human approvers, separate dashboards or departments to create. The founder retains product direction. Existing Cyborg governance, engineering tools, repository records and Master Preview provide the common execution context. Exclude HQ and do not establish a parallel orchestration, approval or certification mechanism.

### 27.1 Twelve specialist disciplines and expected contributions
| Discipline | Responsibilities during stabilization | Practical deliverables |
| --- | --- | --- |
| Product management and business analysis | Discover existing products, intended outcomes, audiences, requirements, defects, scope, user journeys and competing priorities; resolve contradictions with actual source and existing product decisions; prioritize by impact and dependencies; avoid feature expansion | Feature inventory, intended behavior, prioritized repair backlog, acceptance examples and clear product decisions |
| UI/UX design and research | Inspect information architecture, task flow, search, onboarding, profiles, filters, navigation, forms, accessibility, cognitive load, visual hierarchy, content density and device needs; compare existing vs redesigned screens; test whether representative users can complete tasks | Annotated current/redesigned screens, interaction flows, usability observations and shared layout guidance |
| Design engineering and interaction design | Consolidate theme, typography, spacing, tokens, iconography, shared buttons, headers, menus, dropdowns, dialogs, sheets, feedback and state primitives; design subtle motion, touch effects and meaningful completion feedback; maintain variants and reduced-motion alternatives | Actual reusable components and tokens, component previews, state/variant examples, visual regression evidence |
| Frontend engineering | Implement responsive screens with existing business logic; connect actions, forms, search, filtering, navigation, media, teaching tools and state; handle errors, loading, retry, accessibility, stale requests and optimistic updates appropriately; remove dead controls and redundant UI safely | Code-backed current/redesigned previews, functional components, frontend tests and reproducible interaction evidence |
| Backend engineering and integration | Trace real API/RPC/service contracts, auth boundaries, validation, side effects, retries, idempotency, notifications, synchronization, publishing, payments and live session behavior; eliminate silent failures and duplicate services | Canonical root-cause repairs, interface contracts, integration tests, safe error and recovery behavior |
| Database engineering | Inspect schema, types, indexes, queries, relationships, constraints, RLS/grants, migration history, persistence and consistency; plan compatible forward migrations and recovery; verify reconstruction and isolation; reconcile schema drift using existing processes | Schema findings, necessary migrations, data integrity and performance tests, migration/recovery evidence |
| Quality assurance and test engineering | Derive scenarios from intended behavior, map screens/actions/states/journeys, reproduce defects, test success/failure/negative paths and concurrency, verify browser/device and visual behavior, test fixes and prevent regressions; distinguish simulated, integration and live evidence | Traceable test inventory, reproducible findings, screenshots/traces, regression tests and accurate coverage/status records |
| Security and privacy engineering | Review existing authentication, role and tenant isolation, authorization, sensitive data, child protection, secrets, storage/media access, payment integrity and abuse exposure; test trusted boundaries and failure modes; distinguish real safeguards from redundant bureaucracy | Scoped security findings, necessary fixes and negative-path evidence; no invented approval workflow |
| Performance and resilience engineering | Measure real and laboratory loading/interaction/layout stability, bundle and query costs, network behavior, low-end mobile, caching, streaming, live bandwidth and recovery; optimize observed bottlenecks and prevent wasted data/battery | Baseline and comparison measurements, profiles, targeted repairs, resilience tests and reference-target reporting |
| DevOps, release and reliability engineering | Inspect GitHub CI, Supabase compatibility, Vercel previews and deployed revision, environment configuration, monitoring, error logs, rollback and release recovery; reconcile code/schema/runtime truth; fix CI failures rather than ignore them | Traceable preview/release links, exact-head evidence, deployment and production smoke-test results, rollback/recovery notes |
| Education, curriculum and pedagogy | Verify existing curriculum identity and alignment, accurate explanations, answers, feedback, lesson preparation, teacher resources, assessment, mastery, revision, diagrams and teaching tool correctness; check learner age/level fit, Kenyan terminology and teacher usefulness | Curriculum/content findings, necessary corrections and verified teaching/learning journey evidence under existing content rules |
| Customer experience, UX writing and support | Audit onboarding friction, support issues, concise natural labels, helpful error/recovery text, notifications, profile/settings, payments and subscription communication, low-literacy usability and cross-product consistency; test user-facing outcomes without inventing new support features | Usability findings, corrected copy, clear recovery steps and customer journey observations |
Architecture, accessibility, technical writing, analytics, content design, interaction/motion, test automation and integration expertise are cross-cutting responsibilities, not optional omissions. The architecture perspective maps shared foundations, contracts, dependencies and blast radius before change; accessibility is checked by design, engineering and QA; analytics uses existing privacy-safe evidence rather than inventing tracking or metrics; technical writing maintains concise product language, reproducible handoffs and durable documentation.

### 27.2 Six practical workstreams for a solo founder
1. Product & UX: product management, business analysis, user research, customer experience, UX writing and accessibility intent.
2. Design engineering: shared visual system, interaction/state design, responsive layouts, motion and code-backed previews.
3. Full-stack engineering: architecture, frontend, backend, database, integration, migration and functional repairs.
4. Quality assurance: reproducibility, behavior and negative-path testing, visual/device testing, coverage, regression and evidence review.
5. Reliability & security: security/privacy, performance, observability, CI, release/deployment, recovery and production verification.
6. Education: curriculum, pedagogy, teaching/learning correctness and education-specific usability.
These workstreams may be performed by the same AI-assisted host or multiple available workers through the existing execution framework, with separate evaluators only where existing independent assurance requires them. Do not claim that twelve teams, independent reviewers or background workers actually exist or have completed work unless evidence establishes that. No mandatory new staffing, approval or handoff queues.

### 27.3 Integrated senior-team workflow
Use a single shared record per defect or improvement; avoid passing the founder between teams. Apply the relevant disciplines to each bounded change rather than require all twelve to perform ceremonial reviews on every small edit.
1. Discover: product, architecture and QA reconcile current repository/runtime truth; establish inventory, role, route, intended outcome, affected dependencies and exact baseline.
2. Reproduce and prioritize: QA demonstrates observed behavior; product assesses user impact; engineering identifies the likely canonical root cause; security, education and performance contribute when relevant.
3. Design: UX and design engineering specify the smallest coherent improvement, including current/redesigned appearance, actions, navigation, variants, loading, empty, success/failure, recovery, accessibility and device behavior. For a straightforward defect, a concise behavior contract is sufficient; no compulsory design ceremony.
4. Technical plan: architecture and full-stack map consumers, contracts, data, permissions, migration compatibility, failure paths, rollback and concurrent work. Prefer shared fixes; retain existing functionality.
5. Implement a complete vertical slice: actual frontend + backend + data + feedback + recovery + relevant tests where affected, on an isolated branch using existing governance. Do not hand off a decorative mockup as a completed feature; reuse the real product components.
6. Verify: QA reproduces the original defect and proves the repair; design checks rendered consistency, accessibility and interaction; applicable security, performance and education checks validate their domains. Record actual evidence, including missing test environments. Repair failures and reverify affected dependencies.
7. Integrate and release: use existing preflight, exact-head CI, review/assurance where required, merge and deployment mechanisms; reconcile authorized migrations and configuration; preserve rollback/recovery. Do not invent new approvers or wait for non-existent team members.
8. Verify production: operations and QA inspect the actual deployed revision and non-destructive supported journeys; verify UI, authoritative outcomes and data consistency where relevant. A merged PR or visual preview is not production proof.
9. Close the loop: update the Master Preview and canonical issue/evidence records; capture regression protection, next repair, remaining unknowns and affected evidence. Continue to the next prioritized existing problem.
Allow parallel read-only discovery, design analysis and test preparation when useful. Parallel edits require existing scope coordination and dependency reconciliation; sequence shared foundations before dependent changes. Avoid duplicate implementations, competing PRs and speculative redesigns. Use one bounded feature or related defect group per change where practical, not an enormous unreviewable rewrite.

### 27.4 Shared handoff and evidence contract
A work item links existing inventory, issue, PR, tests and release records rather than duplicate them. Record: product/route/action, role and intended behavior; current observed failure or design problem; baseline revision/environment; impact and priority; root cause/dependencies; before/after design and relevant states; affected API/data/permissions; implementation and migration/rollback notes where applicable; reproducible success/failure tests and evidence; owner product decision if relevant; current functional/design/test/deployment/production statuses; next action or real blocker.
Each perspective contributes a concrete finding, change, test or justified not-applicable result proportionate to scope. Do not mark a discipline as passed because an AI adopted its persona. Verification depends on executable, rendered, runtime or independently assessed evidence as appropriate. Use existing governance for assurance and certification; no second sign-off system. The founder should see a clear plain-language outcome and direct preview links, not twelve repetitive reports.

### 27.5 Example: integrated Mini Lesson publishing repair
Illustrative workflow, not a claim about a current defect: Product establishes intended direct authorized publishing; UX inspects the create/preview/publish flow and unnecessary steps; design engineering standardizes the Publish button and pending/success/error feedback; frontend traces the click and preserves the draft; backend traces validation and the actual write; database verifies persistence and visibility policy; security distinguishes authorization from redundant approval; QA tests publish, failure/retry, duplicate click and actual reader visibility; performance measures responsiveness; education checks applicable content behavior; customer experience verifies concise wording and next actions; operations verifies the exact release and resulting production behavior. Repair the verified root cause rather than introduce another approval. Track one coherent item through the Master Preview.

### 27.6 Delivery cadence and definition of team-quality work
Start with current baseline and the highest-impact customer-facing defects; use small reviewable batches and shared-component fixes with affected-consumer regression tests. An ordinary repair does not require a full design exercise. A significant redesign uses before/after preview and representative flows. Maintain a prioritized backlog and explicit current next action; periodically re-audit completed surfaces and shared dependencies using existing tools, without commissioning a new scheduler or requiring a meeting.
A change meets multidisciplinary quality when relevant product intent, usability, visual consistency, actual functionality, data integrity, security, accessibility, performance, content correctness, failure recovery, regression evidence and deployment truth are addressed at the appropriate scope. Unknowns remain visible. Do not invent a universal numeric quality score or additional business restrictions. The Master Preview presents one coherent product experience and traceable evidence, not an organizational chart or role-play output.

## 28. Visual component review catalogue and responsive geometry
Review individual existing UI components using real visual samples, not only text requirements. Present current usage and two or more meaningful design alternatives where a choice matters; demonstrate appearance, placement, size, hierarchy, interaction, state, accessibility and device behavior. Recommend the simplest coherent variant. Record the owner's design preference when explicitly selected; do not require individual approval for every routine application of a selected pattern. A selected visual sample is a design decision, not functional verification. Use shared components and actual VibeSchool theme tokens; visual concepts inspired by other design tools are not claims those tools produced or approved the work.

### 28.1 Component review inventory
| Family | Individual visual samples and behavior to inspect |
| --- | --- |
| Page navigation | Back arrow, back with text, circular/outlined alternatives, chevron, integrated page header, close, home, next, previous, step navigation, breadcrumbs, deep links, browser back/forward, swipe |
| App navigation | Top bar, bottom tabs, active tab indicator, sidebar, collapsible navigation rail, drawers, nested tabs, segmented controls, sticky navigation, overflow navigation |
| Menus and selectors | Dropdown, searchable select, multi-select, more/ellipsis menu, context menu, menu items, selected checkmark, cascading menus where existing, filter chips, sort, reset/clear |
| Popups and overlays | Anchored popover, tooltip, modal/dialog, alert dialog, bottom sheet, action sheet, drawer, fullscreen overlay, backdrop, lightbox/media viewer, contextual help, confirmation and existing approval status |
| Buttons and input controls | Primary/secondary/tertiary, text/icon buttons, floating action, toggles, checkboxes, radios, selection cards, sliders, text fields, editors, date/time, search bar/suggestions/results, file upload |
| Content and information | Cards, lists, tables, headers, headings, avatars, images, badges, dividers, read more/less, expansion panels, pagination, carousel, charts, progress and content previews |
| Feedback and effects | Skeleton, spinner, progress, toast, snackbar, inline success/error, persistent banner, notifications, retry, undo, loading/empty/offline states, completion effects, motion, supported sound/haptics |
| Layout primitives | Spacing scale, padding, margins, gaps, alignment, widths, grids, typography, icons, borders, radius, shadows, contrast, density, safe area, scrolling, truncation and responsive reflow |
Use existing feature inventory to determine applicability. Do not introduce missing features solely to complete this catalogue.

### 28.2 Geometry and responsive reference defaults
Reconcile these proposed values with the actual existing design system before adoption; use semantic tokens instead of hardcoding individual screens. A 4-point reference spacing scale (4, 8, 12, 16, 20, 24, 32, 40, 48 CSS px) supports alignment. Mobile page margins 12–16 px; wider screens 24–32 px with suitable max widths; card padding 12–16 px; related gaps 4–8 px, separate groups 12–16 px and sections 16–24 px; avoid double padding and unnecessary nested cards. Prefer consistent 1 px borders and a small radius scale such as 4/8/12 px where suited to brand and context. Standard interface typography reference: page title 24–28 px, section 18–20 px, card heading 16 px, body/control 14–16 px, supporting text 12–14 px; respect user text scaling and separate readable textbook typography. Prefer 44–48 CSS px controls and at least 44 × 44 px touch targets where practical; a 16/20/24 px visible icon can have a larger interactive area. Use accessible focus and contrast. Example header height 56 px, icon/text gap 8 px. These are starting points, not fixed restrictions on every layout.
Inspect representative viewport widths 320, 360, 390, 768, 1024 and 1440 CSS px, portrait/landscape, zoom/text scaling and keyboard/notch safe areas. Reflow intelligently: compact single-column/mobile tabs, tablet adaptive grids/rail, desktop sidebar or multiple useful panels. Avoid unintended horizontal overflow, overlapping controls, clipped text and wasted space. Allow natural scrolling for textbooks, feeds, chats and long content. Compact workspaces should prioritize important actions without sacrificing readability or touch accessibility. Design consistency does not require identical layouts for teaching, reading, live classroom, chat and discovery.

### 28.3 Navigation behavior and visual direction
Preferred concept to validate: integrated compact page header with a minimal left arrow and page title, contextual actions at right; top-level screens need no artificial back button. Back exits the current screen to its intended previous destination, with a safe route fallback for direct entry; Previous and Next move between steps/items within a process. Close dismisses an overlay rather than navigating pages. Preserve appropriate scroll position, filters, form state and browser history; only warn about genuine unsaved loss. Step navigation must expose actual position and remaining steps; do not fabricate completion or restrict optional workflows. Primary next action may be prominent, previous secondary, with arrow direction and label clear. At the final step show the actual intended action, not an inert Next. Choose accessible keyboard and touch behavior and handle boundaries.
Keep frequently used tools visible; place secondary actions in a consistent more menu. Prefer tabs/segmented controls for a few frequently switched options, dropdowns for suitable selection sets, searchable selection for long lists, checkboxes for multi-selection, switches for on/off and bottom sheets for appropriate mobile selection. Dropdowns must clearly show label, value, placeholder, selected state, loading/empty/error when relevant, scrolling, keyboard navigation, escape/outside dismissal where appropriate, focus restoration and screen-edge placement. A menu invokes actions; a select chooses values. Preserve existing intended behavior.

### 28.4 Popup, dialog and overlay behavior
Compare anchored popover, dropdown/menu, tooltip, centered dialog, mobile bottom sheet and fullscreen/side drawer for the actual task. Use the least disruptive surface: tooltip for short contextual help, popover/menu for lightweight secondary choices, bottom sheet for suitable mobile actions, modal only when focused interaction or a genuine decision is necessary. Do not introduce routine confirmations or approvals. Keep overlay title concise, controls reachable, backdrop and close affordance consistent, focus management and keyboard/Escape handling appropriate, restore focus on dismissal, prevent unintended background interactions for modal surfaces, and keep scroll/keyboard behavior stable. Fit safe areas and available viewport; handle long content by scrolling inside the appropriate region. Distinguish dismissible from consequential in-flight operations; never pretend to cancel an irreversible request. Avoid stacked popups, unsolicited interruptions, obstructive notifications, hidden primary actions and repeated explanations. Ensure accessible names, screen-reader semantics, non-color cues and reduced motion.

### 28.5 Product language and design selection record
Show visual alternatives with realistic content and no invented functionality. Compare ordinary, selected, focus/pressed, disabled, loading, empty, error and success states where applicable. Include mobile/tablet/desktop and light/dark/system previews. Record component ID, existing consumers, candidate visual samples, recommendation, selected/default variant and rationale, token and behavior specifications, responsive and accessibility considerations, affected routes and actual test evidence. Link the record to existing design inventory in the Master Preview rather than create a separate approval system. Use the same component across products with justified contextual variants.
Remove AI-sounding interface paragraphs, repeated introductions and promotional descriptions: use short labels such as Learn, Profile, Prepare, Go live, Saved and Retry; preserve useful educational explanations and necessary instructions, accessibility and safety information. Put optional explanations in context-sensitive help. Every pixel and word should serve the user. No HQ dependency, new approval gates or unrelated new features.

## 29. Modern, intelligent, interactive and time-saving component direction
Owner preference: a modern look and feel with smart, interactive components that save time, remove friction and respond intelligently to context. Apply this to existing functionality; intelligence means useful deterministic context and behavior where sufficient, not a requirement for AI calls, new features, or additional automation authorities.

### 29.1 Practical component behavior
| Existing component | Preferred refinement |
| --- | --- |
| Search | Fast relevant results, clear input, useful existing suggestions, preserve query on return, cancel obsolete requests; no extra submit step where immediate search is appropriate |
| Select/dropdown | Clear current value, relevant existing options, search long lists, remember appropriate selection, avoid repeatedly asking for known context; direct selection when few options |
| Filters/sorting | Visible active filters, useful counts when real data supports them, fast updates, simple reset, preserve relevant choices; compact sheet on mobile where suitable |
| Navigation/tabs | Restore appropriate workspace and scroll context, predictable back/next, keep most-used actions accessible, avoid unnecessary intermediate pages |
| Forms/editors | Use known authorized context and safe defaults, retain input, appropriate autosave/drafts, inline validation, minimal necessary fields, one meaningful completion action |
| Action buttons | Action-specific wording, immediate press/pending feedback, actual confirmed outcome, safe retry and appropriate next action; no redundant popup or approval |
| Lesson preparation | Show actual upcoming lesson and remaining preparation steps, resume relevant saved work, keep optional instant live available; no invented readiness gate |
| Learning/progress | Resume actual reading/activity position and show real progress, feedback and next relevant existing learning action |
| Profile/settings | Show correct active identity, preserve preferences within appropriate scope, immediately reflect confirmed edits across relevant views |
| Messaging/media | Show truthful send/delivery/upload state, retain failed input, recover where supported, avoid reloading unrelated content |
| Popups/menus | Relevant contextual actions, lightweight dismissal and sensible mobile placement, no stack of dialogs for routine actions |
| Tables/lists/cards | Compact useful data, clear selection, direct access to existing frequent actions, existing batch operations where supported, secondary actions in more menu |
### 29.2 Time-saving and intelligence principles
Use progressive disclosure, context-sensitive defaults derived from authoritative state, clear editable selections, appropriate persistence, fast local feedback, useful recovery and predictable next actions. Reduce repeat entry, redundant screens, taps and waiting without removing meaningful user choice, accessibility, or essential safeguards. A recommendation or default must be transparent, correctable and scoped to the active authorized identity. Never fabricate progress, infer permission from convenience, silently submit/publish/pay, or add AI dependencies just to make a component seem intelligent.
Favor restrained modern visual treatment: compact but accessible layouts, consistent typography and spacing, purposeful icons, clear hierarchy, subtle motion, theme-aware components and high-value visible actions. Interactive components must do actual work, not merely animate. Test on affordable mobile devices and slow connections; keep controls responsive and stable.
### 29.3 Evidence of friction reduction
For representative existing tasks, compare current and redesigned versions using measured required taps/clicks, screens, repeated fields, completion time where reproducible, errors/recovery, accessibility and actual successful outcome. Record role, device, network, scenario and revision. Do not assume fewer clicks always means better usability; preserve important information and genuine confirmations. Record the baseline and observed improvement or remaining defect in the existing Master Preview inventory. Targets are design/optimization guidance, not new customer restrictions or mandatory approval gates.

## 30. Layout stability, mobile keyboard and viewport continuity
Owner-reported experience: tapping controls or opening the phone keyboard can resize the application unexpectedly, disorient the user and move the controls. Treat this as a cross-product audit target; the exact affected routes and root causes remain to be reproduced. The goal is a predictable interface, not a rigid fixed-height screen.

### 30.1 Stable interaction geometry
- Preserve page shell, header, navigation, relevant scroll position and focused control when selecting tabs, filters, menu items, revealing content, loading, saving, receiving feedback or changing button labels. Do not remount the whole page for a local state change.
- Reserve appropriate space for loading indicators, media dimensions, validation messages and status labels; use compatible skeleton sizes, stable keys, consistent control dimensions and local updates. A Save button becoming Saving or Saved must not cause adjacent actions to jump or become accidental tap targets.
- Avoid unintended width changes when a scrollbar appears, font loads, a menu opens or content is refreshed. Do not auto-scroll to the top or steal focus unless the actual user action requires it. Anchor dropdowns/popovers to their control and keep overlays within the viewport.
- Support intentional reflow, content expansion, orientation changes and accessible zoom; distinguish these from involuntary layout shifts. Avoid fixed-height clipping or locking all scrolling to fake stability. Use natural scrolling for long content.

### 30.2 Keyboard-aware mobile behavior
- When a search, input, editor, chat composer or form receives focus, allow the software keyboard to occupy its required space without shrinking or scaling the whole app. Keep the active input, caret and essential related actions visible; allow only the needed scrolling or local reflow.
- Respect the actual visible viewport, safe-area insets and browser chrome; inspect existing viewport CSS and platform behavior. Use supported dynamic viewport units, flex/grid layout and visual viewport information selectively with compatible fallbacks where needed. Do not assume 100vh or one keyboard resize model works on every browser or PWA. Do not disable pinch zoom or accessibility text scaling to hide resize bugs.
- Prevent double scroll containers, competing keyboard offsets, blank space below the keyboard, overlapping fixed bars and unintended scroll jumps. In messaging, keep the composer above the keyboard and preserve the user's conversation position; only follow the latest messages when appropriate. In teaching, preserve canvas state and tool access while editing a local field.
- On keyboard dismissal, restore the intended viewport and relevant scroll position without losing input, focus context, selection or draft. Handle keyboard next/done/search actions and rotation while editing. Bottom sheets/dialogs must adapt to the visible area and permit access to the relevant controls without covering the active field.
- Verify consistent behavior on Android Chrome, installed Android PWA, iOS Safari and installed iOS PWA where available; distinguish emulation from real-device evidence. Test ordinary and large keyboards, small screens, portrait/landscape, browser toolbar changes, text scaling and repeated open/close cycles. Preserve existing keyboard and accessibility conventions.

### 30.3 Evidence and regression coverage
For each affected screen, reproduce tapping, tab switching, dropdowns, validation, loading/saving, dynamic content and keyboard opening/closing. Record viewport dimensions, device/browser, focused field, scroll position, expected/actual control placement and screenshots or traces as appropriate. Check that controls remain reachable, no unintended horizontal overflow or layout jump occurs, typing remains uninterrupted and the screen returns to its expected state. Measure unexpected shifts where suitable, including CLS as a reference, but do not rely on CLS alone to detect user-triggered movement or keyboard bugs. Add focused regression tests for the actual root cause and record physical-device gaps honestly. No new features, restrictions or approvals.

## 31. Selected filter component patterns
Owner selected all four filter designs for context-appropriate use. Standardize and reuse the existing filter components or consolidate compatible implementations rather than create competing systems. Apply only where existing products need filtering, and preserve their authoritative data and permissions.

| Selected pattern | Appropriate use | Behavior |
| --- | --- | --- |
| Horizontal filter chips | Explore, Minis, learning content and suitable VibeTutor discovery categories | One-tap selection, visibly active state, immediate relevant results, optional horizontal chip-strip scrolling without page overflow; keep the selected chip visible |
| Compact inline filter toolbar | Teacher OS, timetable, lesson preparation, exams and other professional lists | Labeled class/subject/status selectors where relevant, real result count, one-tap reset, stable header/control geometry, responsive wrap or compact overflow |
| Advanced filter sheet/panel | Tutor discovery, schools, marketplace and other genuinely multi-criteria searches | Filter icon with actual active count, removable active chips, multi-selection and appropriate range controls, reset, actual matching count and clear Show results action; mobile bottom sheet, wider-screen panel/popover as appropriate |
| Segmented filter | Small mutually exclusive sets, such as upcoming/live/ended lessons | All choices visible where practical, one-tap switching, clear selected state, stable list region and predictable keyboard navigation |

### 31.1 Shared filter interaction contract
- Make active choices, count semantics and reset scope explicit. Keep filters editable and individually removable where applicable. Use clear human labels rather than internal enum values.
- Update simple results immediately where practical; advanced filters may use a local draft and a single Show results action when that is clearer or less costly. Define whether dismiss discards draft or preserves applied selections, and implement that behavior consistently. Avoid repeated unnecessary Apply clicks.
- Use authoritative result counts and correct server-side filtering/pagination where the result set is not fully loaded. Do not confuse visible-page counts with full matching totals. Combine filters correctly, reset pagination on relevant changes, maintain stable ordering and prevent stale requests from replacing newer results.
- Preserve relevant selections and search/scroll context on back navigation, scoped to the active authorized account and product; do not retain another user's data. Offer sensible correctable defaults without hiding relevant choices or unfairly narrowing discovery.
- Keep responsive geometry stable during filtering, loading, empty states and keyboard interaction. Provide local pending feedback, appropriate retry and clear no-results recovery. Avoid whole-page reloads and unsupported filter values. Support focus, keyboard navigation, accessible selected states and reduced motion.
- Use a consistent shared filter icon, chip/select/segmented tokens and theme-aware appearance. Do not force every product into the same arrangement, duplicate the same selection in multiple controls, or add advanced filters simply for decoration.
- Verify representative one-tap chip/segment switching, combined filters, range boundaries, multi-select, reset, empty/error/loading, rapid changes, pagination, back restoration, small screen and keyboard behavior, light/dark/system appearance, and permission-safe results. Populate Master Preview with real component examples and test evidence; sample tutor profiles and prices used in the conversation were illustrative only.

## 32. Selected intelligent search component patterns
Owner selected all three demonstrated search patterns. Consolidate and reuse compatible existing components and search services; do not duplicate product search infrastructure or introduce an AI dependency merely for search.

| Selected pattern | Intended context | Interaction |
| --- | --- | --- |
| Universal search | Authorized discovery across relevant VibeSchool products and learning content | Prominent search field, relevant recent searches and suggestions, categorized results with meaningful labels and direct authorized destinations |
| Compact expandable search | Teacher workspaces, class lists, timetables, messaging and other compact lists | Expand a search icon into a focused field within a stable header; clear or dismiss predictably; search the current collection |
| Search with filters | Explore, VibeTutor, Schools, Marketplace and learning resource collections | Shared search input alongside relevant filter controls, accurate result counts, combined query/filter state, clear search and reset filters separately where useful |

### 32.1 Shared search behavior
- Support fast results as the user types where practical, relevant autocomplete and suggestions, normalization of case and whitespace, appropriate typo tolerance and matching synonyms where supported by actual content. Prioritize exact matches and relevant authorized grade, subject and workspace context without unfairly excluding other eligible results. Never fabricate matches.
- Differentiate global from local scope, preserve query and filter state on return, support direct result navigation and retain the correct scroll location where appropriate. Display useful category, grade, subject or content labels and highlight matched text safely.
- Recent searches and contextual suggestions must be meaningful, scoped to the active account and product, privacy-aware, clearable and not shared across identities or devices without appropriate authorization. Do not retain sensitive query information unnecessarily. Avoid automatically changing a user's query without a clear indication.
- Use existing indexed search and pagination where available. Debounce expensive requests, cancel or ignore stale responses, preserve stable ordering and distinguish true total results from loaded results. Compose search and filters correctly; reset pagination when appropriate. Never expose unauthorized results, snippets, counts or autocomplete suggestions.
- Keep the field, clear affordance and related controls stable during typing, loading, errors, keyboard opening and dismissal. No full-page refresh or unexpected header resize. Show useful local loading, empty, error and retry states. A no-match response can offer relevant alternatives or reset; do not imply unavailable content exists.
- Provide accessible labels, visible focus, keyboard navigation, sensible search/submit actions and screen-reader result announcements. Ensure touch targets, responsive layouts, light/dark/system themes, and appropriate reduced-motion behavior. Reference dimensions: 44–48 CSS px field height, 12–16 px horizontal padding, 20 px icon, 8 px icon/text gap, 8–12 px corner radius; reconcile with shared design tokens.
- Test exact/partial/misspelled queries, empty input, relevant suggestions, clearing, combined filters, stale response races, result navigation, back restoration, permissions and identity changes, pagination, slow/offline/error states, accessibility and real mobile keyboard behavior. Record actual latency, successful task completion and remaining defects in Master Preview. Demonstration data was illustrative, not production verification.

## 33. Touch, hover, pointer responsiveness and interaction effects
Treat interaction quality as part of each existing component's design and functional contract. Distinguish input modality, visible local feedback, real application outcome and optional decorative motion. The interface must feel immediate, stable, modern and intentional without requiring a specific input device.

### 33.1 Universal interaction state matrix
| State or interaction | Expected behavior |
| --- | --- |
| Rest/default | Clear affordance, readable label, consistent size and accessible name |
| Hover (fine pointer) | Subtle surface, border, icon or text emphasis without moving controls; optional contextual help |
| Press/touch down | Immediate restrained visual feedback such as tint or overlay; no unintentional layout change |
| Release/click/tap | Perform the intended action once when valid; distinguish navigation, selection and committed mutation |
| Keyboard focus | Visible contrasting focus indicator, logical tab order; focus-visible styling without suppressing necessary focus |
| Selected/active | Persistent, understandable state with non-color cue where needed; distinguish from transient press and hover |
| Long press | Optional existing contextual menu or suitable tool behavior; expose an accessible explicit alternative |
| Drag/swipe | Clear handle or affordance, continuous feedback, appropriate threshold, cancellation and accessible non-drag alternative |
| Pending | Immediate localized acknowledgement and accurate ongoing state; avoid duplicate submissions |
| Confirmed success/failure | Honest server-backed outcome where applicable; stable geometry, useful feedback and recovery |
| Disabled/unavailable | Clear distinction, accessible reason when useful; do not disable unrelated controls |
| Reduced motion | Preserve functional state changes and feedback with minimal or no nonessential motion |

### 33.2 Touch and pointer engineering
- Prefer accessible native button/link semantics, ordinary click activation and pointer events where specialized gestures require them. Handle cancellation, pointer capture, movement thresholds, scroll conflicts and release outside a target. Avoid duplicate mouse/touch handlers, double submissions, accidental activations while scrolling, sticky hover on touch and unnecessary tap delays. Do not commit destructive or consequential actions on touch-down. Do not globally disable browser scrolling, pinch zoom or native gestures.
- Use hover-capability and pointer-precision media queries where appropriate, not just screen width or assumed device type; accommodate hybrid touch/mouse devices, keyboard and stylus. Hover-only functions must have equivalent reachable touch and keyboard actions. Use clear hit areas, adequate separation and a preferred 44 x 44 CSS px target where practical; a small visible icon may sit inside a larger hit area.
- Preserve header and control geometry during focus, hover, press, selection and pending states; use reserved border space or non-layout-changing focus/overlay treatment. Do not unexpectedly shift the tapped target, expand unrelated content, scroll to top, or cover essential controls. Maintain user context and caret during keyboard appearance.
- Teach tools such as rulers, counters, whiteboard and diagrams need precise continuous pointer feedback, safe cancellation, sensible boundaries, appropriate multi-touch behavior where already supported, and a non-gesture alternative when practical. Keep live and local editing actions appropriately scoped.

### 33.3 Effects and motion reference
Reference timing ranges are proposed tuning defaults, not new performance gates: immediate press acknowledgement (aim around 100 ms or faster where feasible); hover/press color and opacity transitions around 80–150 ms; selection, chip and tab indicator transitions around 120–200 ms; small menus and popovers around 120–220 ms; sheets/dialogs around 180–300 ms. Tune by context and existing design tokens. Use restrained easing, avoid artificial delays, and keep exit animation short. Prefer transform/opacity for suitable motion; visual effects must not cause layout shifts or obscure content, and may be removed when expensive on low-end devices. Avoid universal bounce, ripple or scale effects that distort targets; use a subtle tint/overlay by default and only optional appropriate micro-motion.
- Use meaningful state changes: tab indicator moves to selected tab; toggle changes position and state; checkbox/checkmark confirms selection; pressed card shows feedback; saving progress becomes real success or actionable error; navigation transitions preserve spatial context. Do not equate animation with real success.
- Respect prefers-reduced-motion, high contrast, accessibility and system theme. No flashing or unnecessary continuous motion. Optional sound/haptic feedback only where supported and appropriate, respecting platform/user settings; never require it, imitate a confirmed outcome before confirmation or introduce unnecessary distractions. Do not promise browser haptics on unsupported devices.
- Avoid long blocking transitions, hover-induced layout changes, animations restarting on unrelated renders and duplicate feedback. Keep interaction response independent of slow network requests; local feedback should not wait for remote confirmation.

### 33.4 Responsive verification and component preview
Record actual component states in Master Preview, compare touch and fine-pointer behavior, and demonstrate effects with clearly labeled simulated state fixtures separately from real outcome evidence. Test phone/tablet/desktop, portrait/landscape, touchscreen, hybrid laptop, mouse, keyboard and stylus where available; check repeated taps, fast switching, scroll-vs-tap, pointer cancel, drag release, focus order, reduced motion, overlays, slow network, save/retry and layout stability. Record device/browser, input type, observed response, unintended movement, actual resulting state and accessibility evidence. Use INP and task-specific response measurements where available without inventing results. Prioritize affordable Android and real physical-device evidence, documenting emulation limits. Reuse shared components and state/motion tokens; no new HQ, approval gates or unrelated features.

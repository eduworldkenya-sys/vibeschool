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

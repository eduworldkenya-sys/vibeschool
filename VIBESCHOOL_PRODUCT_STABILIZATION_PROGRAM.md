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

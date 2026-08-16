# VibeSchool Pathways — Acquisition Execution Handoff

**Purpose:** Operational continuation document for engineers, product operators and future ChatGPT sessions.  
**Companion strategy:** `docs/strategy/pathways-customer-acquisition.md`  
**Branch at creation:** `agent/pathways-customer-acquisition-strategy`

## 1. Mission Lock

The mission is to make Pathways a free, trusted customer-acquisition front door for VibeSchool.

The required product loop is:

**Discover → Experience free value → Sign in free at the value moment → Preserve pathway context → Activate → Return → Refer → Optional paid assistance later**

Do not reinterpret this mission as “put Pathways behind authentication” or “monetize pathway access.”

## 2. Current Strategic Decisions

Locked unless intentionally revised with evidence:

- Core pathway discovery is free.
- Payment is not required to discover a pathway.
- Authentication is a continuation/personalization mechanism.
- Users should experience meaningful value before the main sign-in trigger where legally and technically appropriate.
- Anonymous pathway work should survive sign-in/sign-up where safe.
- After authentication, users return to the pathway context that caused registration.
- Success is measured by activated and retained users, not account creation alone.
- Teacher assistance may later be paid, but remains optional.
- School participation must not bias pathway recommendations.
- Learner privacy and safeguarding override growth optimization.

## 3. Workstream Priority Board

### P0 — Acquisition foundation

Status at document creation: **NOT YET IMPLEMENTED/CERTIFIED BY THIS DOCUMENTATION BRANCH**.

Tasks:

- [ ] Audit all current Pathways routes, pages, components, hooks, RPCs, tables and auth dependencies.
- [ ] Document current anonymous-user capabilities.
- [ ] Document current sign-in/sign-up trigger(s).
- [ ] Identify state that would be lost when authentication begins.
- [ ] Define canonical pathway session/state model.
- [ ] Define exact free-core boundary.
- [ ] Define exact sign-in value moment.
- [ ] Implement anonymous-session persistence/transfer where appropriate.
- [ ] Implement exact return-to-pathway continuation after authentication.
- [ ] Implement pathway save/adopt behavior.
- [ ] Define and implement first meaningful post-auth next action.
- [ ] Instrument funnel events.
- [ ] Test privacy/safeguarding boundaries.
- [ ] Certify end-to-end anonymous → authenticated → activated journey.

### P1 — Discovery distribution

Begin only after P0 journey is reliable.

- [ ] Search-intent landing page architecture.
- [ ] Search metadata/indexability review.
- [ ] Teacher QR/share flow.
- [ ] Parent/learner safe sharing flow.
- [ ] WhatsApp-friendly sharing path.
- [ ] Social campaign landing routes.
- [ ] School/career-guidance distribution kit.
- [ ] Source/campaign attribution.
- [ ] Verify referrals never leak private pathway data.

### P2 — Retention

- [ ] Persistent pathway profile.
- [ ] Actionable next-step plan.
- [ ] Relevant subject/learning links.
- [ ] Progress/evidence connection.
- [ ] Parent/learner connection model where appropriate.
- [ ] Return-use triggers.
- [ ] Pathway re-evaluation contract when learner evidence changes.
- [ ] 7-day and 30-day retention measurement.

### P3 — Optional teacher assistance

Do not activate simply because payment infrastructure exists.

- [ ] Define assistance service types.
- [ ] Define teacher eligibility/verification.
- [ ] Define response SLA and completion evidence.
- [ ] Define safeguarding rules.
- [ ] Define pricing experiments.
- [ ] Define platform fee/revenue share.
- [ ] Define M-Pesa/payment contract.
- [ ] Define teacher payout/reconciliation.
- [ ] Define refund/dispute/escalation behavior.
- [ ] Define quality measurement.
- [ ] Pilot with constrained users/teachers.

### P4 — School ecosystem

- [ ] Verify school programme/pathway data model.
- [ ] Connect verified school programme information.
- [ ] Define school guidance workflows.
- [ ] Define privacy-safe learner-interest signals.
- [ ] Define commercial boundaries and disclosures.
- [ ] Prevent paid school relationships from altering learner-first recommendation ranking.

## 4. First Engineering Mission

The next implementation mission is **P0 — Acquisition Foundation Audit + Canonical Journey**.

A future chat should not start coding the sign-in prompt immediately. It should first inspect the real application and answer:

1. Where does a public user currently enter Pathways?
2. Can an unauthenticated user currently use any of it?
3. Which component or route generates results?
4. What data is currently stored client-side, server-side or in Supabase?
5. Which state is tied to `auth.uid()`?
6. What happens today when an anonymous user hits sign in/sign up?
7. Where does auth redirect after completion?
8. Can that redirect safely preserve/restore pathway state?
9. Which learner/parent roles can own a pathway?
10. Are there existing pathway tables/RPCs that should remain canonical?
11. Are there duplicated pathway engines or legacy flows?
12. What analytics already exist?
13. What privacy/safeguarding constraints affect anonymous learner input?
14. What is the smallest end-to-end change that creates the intended acquisition loop without redesigning unrelated systems?

## 5. Canonical Journey Acceptance Contract

P0 cannot be called complete until all of the following are demonstrated on the actual product:

### Anonymous value

- Visitor can reach Pathways from a public entry point.
- Visitor is not asked to pay.
- Visitor receives meaningful value before the main acquisition sign-in prompt, unless a documented safeguarding/legal constraint prevents this.

### Sign-in trigger

- Prompt clearly explains why an account is useful.
- “Free” is represented accurately.
- Sign-in/sign-up does not masquerade as a payment action.

### State continuity

- User's relevant pathway answers/result context survives authentication where permitted.
- No unexpected restart.
- No unrelated dashboard detour.
- Authentication failure/cancel does not silently destroy the session.

### Activation

- Authenticated user reaches the full/saved pathway.
- User can perform a meaningful next action.
- The activation event can be measured.

### Safety

- No private learner result is exposed in share URLs.
- No commercial ranking bias is introduced.
- No RLS/auth boundary is weakened to make anonymous usage work.
- Child/learner data handling remains consistent with VibeSchool's safety and privacy contracts.

### Quality gates

Where applicable to changed code:

- TypeScript passes.
- ESLint passes.
- Production build passes.
- Relevant unit/integration/regression tests pass.
- Supabase migration/security gates pass if database changes occur.
- End-to-end Pathways acceptance scenario passes on the exact implementation head.

## 6. Funnel Event Contract

Names may be adapted to existing analytics conventions, but the semantic events must exist:

1. `pathways_landing_viewed`
2. `pathways_started`
3. `pathways_meaningful_progress`
4. `pathways_preliminary_result_viewed`
5. `pathways_auth_prompt_viewed`
6. `pathways_auth_started`
7. `pathways_auth_completed`
8. `pathways_state_restored`
9. `pathways_full_result_viewed`
10. `pathways_saved_or_adopted`
11. `pathways_next_action_completed`
12. `pathways_shared`
13. `pathways_returned`
14. `pathways_assistance_viewed` — future
15. `pathways_assistance_requested` — future
16. `pathways_assistance_paid` — future

Each event should use the minimum data necessary. Do not add sensitive learner answers to marketing analytics payloads.

## 7. Measurement Dashboard

Minimum reporting should answer:

- How many people land on Pathways?
- Where did they come from?
- How many start?
- How many reach meaningful value/result?
- How many see the sign-in prompt?
- How many start authentication?
- How many finish authentication?
- How many successfully recover their pathway state?
- How many activate?
- How many return in 7/30 days?
- How many share/refer?
- Which acquisition source produces the highest activation and retention, not merely traffic?

Primary business metric: **Activated Pathway Users**.

## 8. Discovery Execution Sequence

After P0 certification, expand discovery in this order:

### D1 — Teacher distribution

Reason: teachers are trusted and already interact with learners/parents around transition decisions.

Deliver:

- share link;
- printable/simple QR;
- classroom/career guidance use route;
- teacher referral attribution without exposing student identity.

### D2 — WhatsApp / parent referral

Reason: low-friction family sharing.

Deliver:

- privacy-safe result summary;
- “Explore Pathways” deep link;
- parent/learner invite where appropriate;
- share preview that reveals no sensitive result data.

### D3 — Search

Reason: captures high-intent users already asking pathway/career/subject questions.

Deliver:

- high-quality public information pages;
- structured internal links into Pathways;
- clear titles/descriptions;
- useful content rather than thin SEO pages.

### D4 — Social content

Reason: creates awareness among families not actively searching.

Deliver problem-led content and use Pathways as the call to action.

### D5 — School distribution

Reason: schools can create concentrated acquisition during transition/career guidance moments.

Deliver school-safe materials and institutional workflows without commercial recommendation bias.

## 9. Experiment Rules

Experiments are allowed after baseline measurement exists.

Good experiments:

- sign-in prompt copy;
- exact trigger timing;
- preview depth before sign-in;
- pathway result presentation;
- teacher referral CTA;
- share copy;
- landing page framing.

Forbidden/unsafe growth experiments:

- hiding that the service is free;
- false urgency/scarcity;
- deliberately losing anonymous work to force registration;
- pay-to-rank schools/pathways without explicit policy and disclosure;
- collecting unnecessary learner-sensitive data for ad targeting;
- weakening authentication/RLS/privacy controls for conversion.

## 10. Handoff Protocol for Another Chat/Agent

When another chat is told “continue Pathways acquisition,” it should:

1. Read `docs/strategy/pathways-customer-acquisition.md`.
2. Read this file.
3. Inspect the current `main` head and determine whether this documentation branch has been merged.
4. Search current open PRs/branches for Pathways acquisition work.
5. Never assume checklist status from this file if repository evidence contradicts it.
6. Select the highest-priority unchecked item whose prerequisites are satisfied.
7. Branch from the correct current parent branch according to repository policy.
8. Inspect before implementing.
9. Implement the smallest coherent end-to-end slice.
10. Test against the acceptance contract.
11. Record exact head, tests and remaining work.
12. Only mark an item complete when repository/test evidence supports it.

## 11. “Do Not Drift” Rules

Future work must not silently drift into:

- charging for the core pathway discovery;
- a generic marketing campaign without product activation;
- rebuilding authentication unnecessarily;
- creating a duplicate pathway engine if a canonical one exists;
- merging unrelated Worker Engine work into this product branch;
- prematurely building the teacher marketplace before acquisition/retention works;
- treating visits or sign-ups as the north-star metric;
- sacrificing learner trust for conversion.

## 12. Recommended Work Unit Structure

For each implementation unit:

**Inspect → State invariant → Identify root gap → Design smallest coherent change → Implement → Adversarial test → Run repo gates → Certify exact head → Update handoff**

Suggested branch naming:

- `agent/pathways-p0-acquisition-audit`
- `agent/pathways-p0-auth-continuation`
- `agent/pathways-p0-funnel-instrumentation`
- `agent/pathways-p1-teacher-referral`
- `agent/pathways-p1-sharing`
- `agent/pathways-p1-search-discovery`

Names may change to match repository conventions.

## 13. Immediate Next Action

**Do not start P1 marketing/distribution implementation yet.**

The immediate next action is to audit the actual Pathways implementation from the current certified/main product state and produce a P0 gap map covering:

- entry routes;
- result generation;
- auth boundaries;
- state persistence;
- role ownership;
- analytics;
- safety/privacy constraints;
- existing canonical data/RPCs;
- exact files and tables requiring modification.

Then implement the P0 acquisition loop in small certified slices.

## 14. Completion Definition for the Acquisition Programme

This programme reaches initial operational maturity when:

- the P0 acquisition loop is certified;
- at least three discovery channels are measurable through activation;
- Pathways has a persistent retention loop;
- VibeSchool can compare channel quality by activated/retained users;
- optional assistance has either been validated safely or consciously deferred based on evidence;
- recommendation neutrality, privacy and safeguarding remain intact.

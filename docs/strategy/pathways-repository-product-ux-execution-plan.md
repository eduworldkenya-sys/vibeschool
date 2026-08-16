# VibeSchool Pathways — Repository-Aware Product, UX and Execution Plan

**Status:** Working implementation plan based on current repository inspection; live Supabase reconciliation is required before schema/authority decisions.
**Mission branch:** `agent/pathways-customer-acquisition-strategy`
**Promotion:** no merge to `main` until the complete Pathways mission is implemented and certified.

## Executive decision
Do not build Pathways as a separate microsite, disconnected quiz, generic chatbot or replacement student app. The repository already has reusable public learning, learner identity, Student Home/Profile/Tasks/Twin, assessment, national school identity/search, SEO, PWA, parent/teacher and auth foundations. Pathways should be a cross-surface decision layer over those systems.

Target: **Public Discovery + Public Knowledge + Decision Engine + School/Career Graph + Free Auth Continuity + Pathway Passport + Existing Learner/Parent/Teacher Projections.**

## Repository reality
- Existing public learning: `app/learn/page.tsx`, `app/learn/[courseSlug]/page.tsx`, `app/learn/careers/page.tsx`, `components/learn/LearnBottomNav.tsx`. Audit/reuse; avoid a second public education portal.
- Existing learner OS: `app/student/page.tsx`, `app/student/profile/page.tsx`, `app/student/tasks/page.tsx` plus personalized-path/Home OS infrastructure. Do not create a second Pathways dashboard.
- `docs/LEARNER_PROFILE_ARCHITECTURE.md` establishes canonical learner identity. Pathway Passport must reference it.
- Existing Twin: `docs/STUDENT_TWIN_ARCHITECTURE.md`, `app/student/twin/page.tsx`, `lib/twin/brain.ts`, Twin components/runtime. Twin may explain governed Pathways state; it must not become a second pathway truth engine.
- Existing assessment primitives: `lib/assessment/engine.ts`, `lib/assessment/discovery.ts`, `lib/assessment/questionBank.ts`, `lib/assessment/results.ts`, Student Assessment. Audit before Quick Check; reuse only when semantics fit.
- Existing national school identity/discovery: canonical identity, directory, reconciliation, normalized search, strict-level matching and abuse controls. Pathways attaches offering facts to canonical school IDs; no second school directory.
- Existing SEO foundation: `app/sitemap.ts`, `app/robots.ts`. Extend, do not duplicate.
- Existing auth/onboarding authority must own Pathways continuation routing.
- Non-main deployment controls mean this mission remains isolated until promotion.

## Information architecture
Proposed, subject to route-collision audit: `/pathways`, `/pathways/check`, `/pathways/[pathway]`, `/pathways/subjects/...`, `/pathways/careers/...`, `/pathways/schools/...`. Reconcile `/learn/careers` before introducing a second indexable career taxonomy.

Authenticated Pathways primarily projects into existing Student Home/Profile/Tasks/Twin. Parent gets a support projection; teacher gets referral/guidance context; school/HQ verification reuses national school identity governance.

## Canonical domain
Reuse learner, school, curriculum/subject, assessment/result, auth/onboarding and analytics identities where suitable. Add only proven-missing concepts after live Supabase archaeology: pathway/version, track, official combination, pathway↔subject, career↔pathway/subject, school↔offering observations, provenance, discovery sessions/answers, recommendation evidence/version, adopted pathway/history, Passport state, anonymous continuation/adoption and correction/conflict/freshness.

## One truth engine
**Authoritative evidence → normalized graph → explicit recommendation rules/model → versioned recommendation evidence/result → audience projection.** Public pages, Quick Check, Ask VibeSchool, learner/parent/teacher/Twin, SEO and AI-readable content consume this same truth.

## UX placement
Public entry exposes Pathways as free value without replacing role entry. `/pathways` begins with “What do you want help with?”: Find my pathway; I know my career; I know my subjects; Find a school; Compare pathways; I'm helping my child; I'm helping a learner; Ask VibeSchool.

Quick Check is one decision at a time, action-first, supports `Not sure`, persists recoverably, and requires no account to begin. Result hierarchy: direction/honest ambiguity → short why → actions → deeper explanation → evidence/sources → **Save my pathway and continue**. Auth preserves state through canonical onboarding. Returning learners see current pathway + next action in Student Home and deeper Passport in Profile.

## Delivery gates
### P0.0 Baseline freeze/collision audit
Read-only inspect current main, mission branch and live Supabase: routes/navigation; `/learn/careers`; assessment discovery; Student Home/Profile/Tasks/Twin; parent/teacher projections; auth continuation; school identity/search; curriculum/subject identity; existing career/pathway DB objects; analytics; sitemap/robots/metadata; RLS/grants; production coverage. Exit: topology + REUSE/EXTEND/SEPARATE/RETIRE decisions and no unresolved P0 ownership question.

### P0.1 Canonical Pathways contract
Define cohort/policy → pathway → track → combination → subject → school offering → career/progression, provenance, dates, conflicts, evidence and eligibility/suitability/aspiration separation. No duplicate identities.

### P0.2 Anonymous session + auth continuation
Privacy-safe recoverable state, no sensitive URL state, replay/idempotency, shared-device boundaries, canonical onboarding and explicit adoption. Exit: E2E anonymous start → result → auth → same context restored without duplication.

### P0.3 Quick Check v1
Small deterministic evidence flow; honest uncertainty; no fake precision; reuse assessment primitives only where valid.

### P0.4 Result/action hub
Quick → Action → Understand → Verify. Action without long reading; evidence depth available.

### P0.5 Pathway Passport + Student integration
Persistent current/adopted state and history projected into Student Home/Profile.

### P0.6 Parent/Teacher projections
Minimum safe support/referral projections under existing relationship/class authority.

### P1.0 Authoritative senior-school cohort
Coordinate with national school identity work. Attach official pathway/combination observations to canonical schools with provenance/idempotency.

### P1.1 Public pathway pages
Canonical crawlable, useful, provenance-backed pages.

### P1.2 Career decision pages
Reconcile `/learn/careers`; one canonical indexable career decision taxonomy.

### P1.3 School/combination finder
Canonical school search + verified offering facts; direct useful search results; no invented counts.

### P1.4 Ask VibeSchool v1
Bounded retrieval-grounded intents first: pathway explanation; career→pathway; subject/combination→options; school→offerings; location→options; help-me-choose→Quick Check. Fail honestly outside evidence.

### P2 SEO + AI authority
Extend existing sitemap/robots/metadata, structured data, internal links and benchmark query measurement. External #1 ranking only measured after indexation.

### P3 Voice/listen + Kiswahili
After canonical answer quality. Voice is presentation/input, never a separate truth engine.

### P4 Human teacher assistance
Separate commercial activation after free core proves demand/trust; requires verification, safeguarding, scope, payments/payouts/refunds/disputes and commercial neutrality.

## First coherent release
**Public `/pathways` → quick check → preliminary value → free sign-in continuation → Pathway Passport → one next action → authoritative pathway pages → bounded senior-school finder.** Initially exclude open-ended AI chat, marketplace, school ads, full voice, exhaustive career graph, massive programmatic SEO and automatic high-stakes recommendation changes.

## Metrics
Measure discovery, time-to-first-value, check completion/abandonment, uncertainty, evidence/source opens, auth continuation/restoration, pathway save, first meaningful action, Passport return, coverage/freshness, and post-deployment SEO/AI authority. Never optimize registration over free value, truth, privacy or safeguarding.

## UX research
Test varied learners, parents and teachers across patience, literacy, digital confidence, decision certainty and shared-device use. Measure comprehension/task success rather than aesthetic preference.

## Engineering rules
1. No second learner identity.
2. No second school identity.
3. No second recommendation brain.
4. No second auth/onboarding router.
5. No second sitemap/robots authority.
6. No public/private SEO mixing.
7. No direct school rewrite of authoritative facts.
8. No LLM as truth source.
9. No pay-to-rank educational recommendations.
10. No merge to main before complete mission certification.
11. No schema invention before live Supabase archaeology.
12. Consequential recommendations must become reconstructable from evidence + knowledge + rule/model versions.

## Regimentation
For each gate: **Inspect → state invariant → identify reuse → design smallest coherent change → implement → adversarially challenge → targeted tests → inherited gates → update evidence → continue.** Maintain a mission ledger: gate, objective, dependencies, files/schema, invariants, tests, evidence commit, residual risks, status.

## Immediate next action
**P0.0 Baseline Freeze and Collision Audit. No feature implementation before this audit.** It must determine reuse/extension/separation/retirement, canonical IDs, anonymous-state placement, auth continuation, authoritative school/curriculum/assessment facts, genuinely absent pathway/career concepts, and the exact first safe migration/API/UI slice.

## Senior product conclusion
VibeSchool is not starting Pathways from zero. The repository already contains much of the infrastructure. The main risk is duplication and fragmentation. Connect public acquisition, assessment primitives, learner identity, Student Home/Profile, school identity/search, curriculum evidence, Twin explanation and SEO under one canonical Pathways decision contract.
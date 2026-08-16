# VibeSchool Pathways — Mission Documentation Index

**Branch:** `agent/pathways-customer-acquisition-strategy`  
**Draft PR:** #168  
**Purpose:** Prevent future engineers/agents from reading only one Pathways strategy file and missing governing requirements.  
**Promotion rule:** This branch remains isolated until the complete mission is implemented and exact-head certified.

## Required Reading Order

Anyone continuing the Pathways acquisition mission must read **all** of the following before changing implementation:

1. `docs/strategy/pathways-customer-acquisition.md` — mission, vision, acquisition thesis, free-core model, funnel, roadmap and business boundaries.
2. `docs/strategy/pathways-experience-specification.md` — placement, canonical journey, auth continuity, mobile/accessibility, sharing, trust and UX gates.
3. `docs/strategy/pathways-action-first-trust-and-guidance.md` — action-first/depth-on-demand UX, quick guidance, progressive evidence, uncertainty, Pathway Passport, literacy/language and human guidance.
4. `docs/strategy/pathways-national-authority-and-discoverability.md` — national knowledge graph, provenance, #1 SEO objective, AI discoverability, benchmark portfolio, public knowledge and authority operations.
5. `docs/strategy/pathways-seven-constitutions-and-human-system-architecture.md` — learner/parent/teacher/school profiles, decision psychology, trust/patience/capability states, truth, recommendation, safety/privacy, discovery, commercial and operations constitutions.
6. `docs/strategy/pathways-ask-understand-act-product-model.md` — Ask → Understand → Verify → Personalize → Act → Human Help → Remember; multiple entry doors, Ask VibeSchool, search pages as tools, voice/listen and channel continuity.
7. `docs/strategy/pathways-repository-product-ux-execution-plan.md` — repository-aware product/CTO/UX integration plan, reuse/extend boundaries, route placement, one-truth-engine rules and dependency gates.
8. `docs/strategy/pathways-p0-baseline-audit-ledger.md` — **live implementation/ownership ledger**: GitHub + Supabase findings, implemented artifacts, unresolved dependencies and certification state.
9. `docs/strategy/pathways-acquisition-execution-handoff.md` — **current operational work board** and continuation protocol.

**Reading one file is insufficient. A future chat must read this index and all nine documents before changing implementation or redefining the mission.**

## Current Status Rule

For strategy and constitutional intent, read all nine files. For **what is actually implemented right now**, the precedence is:

1. current GitHub branch/PR evidence;
2. live Supabase evidence;
3. `pathways-p0-baseline-audit-ledger.md`;
4. `pathways-acquisition-execution-handoff.md`;
5. older planning text.

Never use an older unchecked roadmap item to contradict newer repository evidence.

## Governing Product Model

> **A free, trusted acquisition front door and education decision/navigation system that converts authoritative Kenyan education evidence into understandable, action-first guidance; lets users enter from a question, themselves, a career, subject, school, pathway or location; earns sign-in through continuity; builds a persistent learner journey; becomes a #1 discoverable independent Pathways authority; and later supports optional governed human/commercial services without allowing money to influence educational truth.**

Canonical user-facing logic:

> **ASK → UNDERSTAND → VERIFY → PERSONALIZE → ACT → GET HELP WHEN NEEDED → REMEMBER/CONTINUE.**

Do not simplify Pathways into “a quiz,” “a chatbot,” “SEO pages,” “a school directory,” or “a teacher marketplace.” Those are possible surfaces/capabilities inside one decision system.

## Repository Integration Decision

Pathways is not a greenfield product beside VibeSchool. Current foundations include public `/learn`, Student Home/Profile/Tasks/Twin, canonical learner identity, formal assessment infrastructure, national school identity/search, sitemap/robots, PWA/offline foundations, parent/teacher projections and canonical auth/onboarding.

Architectural default: **reuse/extend canonical systems, never duplicate them without proof that the existing system cannot satisfy the invariant.**

Non-negotiable examples:
- no second learner identity;
- no second school identity/directory;
- no second Pathways truth/recommendation brain;
- no second auth/onboarding router;
- no second sitemap/robots authority;
- no use of formal classroom assessments as anonymous Pathways sessions;
- no use of mastery/task recommendations as career/pathway recommendations.

## Current Implementation Anchor

Implementation is active on draft PR #168 and currently includes:
- canonical public `/pathways`;
- deterministic anonymous `/pathways/check`;
- device-local pre-consent state;
- `/pathways/continue` consent/save bridge;
- safe `next` behavior integrated with canonical onboarding;
- additive provenance-backed Pathways graph migration;
- learner Pathway Passport persistence and Student Profile projection;
- safe public canonical school finder foundation;
- Pathways sitemap/robots metadata integration.

**This paragraph is not a completion claim.** Read the live P0 ledger and execution handoff, then inspect the current PR head/live Supabase before acting.

## Cross-Document Invariants

- Core discovery remains free.
- Value precedes primary sign-in.
- Authentication is for continuity/persistence/personalization, not basic answer access.
- Current anonymous Quick Check answers remain on-device until explicit Save.
- Canonical onboarding always dominates continuation.
- Existing school-linked learner signup safeguarding is not weakened for conversion.
- Parent/teacher support cannot overwrite learner-owned Pathway Passport state.
- Public pathway/school facts require provenance and publish/verification state.
- Absence of verified school-offering evidence means “not yet verified,” not “does not exist.”
- Official fact, learner evidence and VibeSchool guidance remain visibly distinguishable.
- Eligibility, suitability and aspiration remain distinct.
- Recommendations expose uncertainty and never fabricate precision.
- Twin may explain canonical Pathways state but cannot invent official eligibility/offering truth.
- Commercial relationships cannot alter educational truth/ranking.
- Public SEO/AI surfaces never expose private learner data.
- #1 organic discoverability is a measured objective, never a fabricated guarantee.
- Consequential recommendation outcomes must become reconstructable from evidence + knowledge + rule/model versions.
- Documentation is not implementation; implementation is not certification.
- No merge to `main` and no production application of branch migrations until full mission promotion requirements are satisfied.

## Account/Safeguarding Warning

The current canonical learner signup is teacher-code + guardian-first. A future agent must not remove those safeguards merely to improve Pathways conversion and must not invent a parallel `pathway_users` learner identity. A standalone family/independent-learner acquisition identity is a separate safeguarding/identity design gate.

## Mission Certification Layers

Before promotion, prove at least:

1. Product/UX behavior.
2. Anonymous→authenticated consent/state continuity.
3. Canonical educational data/provenance.
4. Recommendation correctness, uncertainty and fairness.
5. Learner privacy/safeguarding/consent.
6. Shared-device/assisted-use isolation.
7. Mobile/accessibility/low-bandwidth behavior.
8. Search crawlability/technical SEO/public-private boundaries.
9. Ask/answer/action grounding and canonical-truth consistency.
10. Channel-to-product context continuity.
11. Analytics/observability/reconstruction.
12. Freshness/correction/policy-change operations.
13. Commercial neutrality.
14. Parent/teacher relationship-based projection authority.
15. Supabase migration security.
16. Clean database rebuild/repository extraction where applicable.
17. TypeScript/ESLint/Next.js production build.
18. Pathways-specific adversarial acceptance.
19. End-to-end exact-head mission acceptance.

External Google/AI ranking outcomes can only be measured after public deployment/indexation; branch certification must prove prerequisites rather than fabricate ranking results.

## Handoff Sentence

> **Continue the VibeSchool Pathways mission on `agent/pathways-customer-acquisition-strategy`, draft PR #168. First read this index and all nine required documents in order, especially the live P0 baseline ledger and execution handoff. Treat repository documents as governing mission memory. Inspect current GitHub and live Supabase reality before changing code. Continue the highest-priority unfinished gate, preserve canonical learner/school/auth/Twin/safeguarding boundaries, and do not merge to main or production-apply branch migrations until the full mission is implemented and exact-head certified.**

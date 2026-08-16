# VibeSchool Pathways — Mission Documentation Index

**Branch:** `agent/pathways-customer-acquisition-strategy`  
**Purpose:** Prevent future engineers/agents from reading only one Pathways strategy file and missing governing requirements.  
**Promotion rule:** This branch remains isolated until the complete mission is implemented and certified.

## Required Reading Order

Anyone continuing the Pathways acquisition mission must read **all** of the following before changing implementation:

1. `docs/strategy/pathways-customer-acquisition.md` — mission, vision, acquisition thesis, free-core model, funnel, roadmap and business boundaries.
2. `docs/strategy/pathways-experience-specification.md` — placement, canonical journey, auth continuity, mobile/accessibility, sharing, trust and UX gates.
3. `docs/strategy/pathways-action-first-trust-and-guidance.md` — action-first/depth-on-demand UX, quick guidance, progressive evidence, uncertainty, Pathway Passport, literacy/language and human guidance.
4. `docs/strategy/pathways-national-authority-and-discoverability.md` — national knowledge graph, provenance, #1 SEO objective, AI discoverability, benchmark portfolio, public knowledge and authority operations.
5. `docs/strategy/pathways-seven-constitutions-and-human-system-architecture.md` — learner/parent/teacher/school profiles, decision psychology, trust/patience/capability states, truth, recommendation, safety/privacy, discovery, commercial and operations constitutions.
6. `docs/strategy/pathways-ask-understand-act-product-model.md` — why short-form/social/AI experiences reduce synthesis effort and VibeSchool's response: Ask → Understand → Verify → Personalize → Act → Human Help → Remember; multiple entry doors, Ask VibeSchool, search pages as tools, voice/listen and channel continuity.
7. `docs/strategy/pathways-repository-product-ux-execution-plan.md` — repository-aware product/CTO/UX integration plan: existing systems to reuse, route placement, one-truth-engine rules, P0.0→P4 dependency gates, first coherent release slice, metrics, research, engineering rules and work regimentation.
8. `docs/strategy/pathways-acquisition-execution-handoff.md` — operational work board, P0→P4 sequence, engineering acceptance contract, analytics and continuation protocol.

**Reading one file is insufficient. A future chat must read this index and all eight documents before changing implementation or redefining the mission.**

## Governing Product Model

> **A free, trusted acquisition front door and education decision/navigation system that converts authoritative Kenyan education evidence into understandable, action-first guidance; lets users enter from a question, themselves, a career, subject, school, pathway or location; earns sign-in through continuity; builds a persistent learner journey; becomes a #1 discoverable independent Pathways authority; and later supports optional governed human/commercial services without allowing money to influence educational truth.**

Canonical user-facing logic:

> **ASK → UNDERSTAND → VERIFY → PERSONALIZE → ACT → GET HELP WHEN NEEDED → REMEMBER/CONTINUE.**

Do not simplify Pathways into “a quiz,” “a chatbot,” “SEO pages,” “a school directory,” or “a teacher marketplace.” Those are possible surfaces/capabilities inside one decision system.

## Repository Integration Decision

Pathways is not a greenfield product beside VibeSchool. Current repository foundations include public `/learn` and careers, Student Home/Profile/Tasks/Twin, canonical learner identity, assessment infrastructure, national school identity/search, sitemap/robots, PWA/offline foundations, parent/teacher projections and canonical auth/onboarding work.

Therefore the architectural default is **reuse/extend canonical systems, not duplicate them**. In particular:

- no second learner identity;
- no second school identity/directory;
- no second recommendation brain beside Pathways/Twin;
- no second auth/onboarding router;
- no second sitemap/robots authority;
- no separate career taxonomy without reconciling `/learn/careers`;
- no Pathways implementation schema before live Supabase archaeology.

The next engineering gate is explicitly **P0.0 Baseline Freeze and Collision Audit**, not feature coding.

## Why Ask → Understand → Act Matters

Many users prefer short-form/social/AI experiences because they reduce the effort required to turn information into understanding and action. Traditional search can provide authoritative documents but often leaves synthesis to the user; social explanations can provide fast synthesis but may lack authoritative evidence.

VibeSchool's intended combination is:

> **short-form simplicity + search discoverability + authoritative Kenyan education evidence + teacher-like explanation + personalization + immediate action.**

Learn from low-friction comprehension without adopting misinformation, sensationalism, engagement bait or popularity-as-truth.

## Multiple Entry Doors, One Canonical System

Users may begin from:

- **Me:** help me find my pathway;
- **Career:** I want to become X;
- **Subjects:** where can these subjects take me?;
- **School:** what does this school offer?;
- **Pathway:** help me understand/explore it;
- **Location:** what relevant options exist here?;
- **Question:** Ask VibeSchool;
- **Unknown:** guide me.

All entry doors converge on the same canonical knowledge/evidence/recommendation system.

## Non-Negotiable Cross-Document Invariants

- Core Pathways discovery remains free.
- Value precedes the primary sign-in trigger.
- Sign-in is for persistence/continuity, not ransom for a result.
- Anonymous pathway state should survive authentication where safe.
- Action first; detail/evidence on demand.
- Important answers lead to a legitimate educational next action where one exists.
- Ask VibeSchool is evidence-grounded, never an unconstrained LLM truth source.
- Search-intent pages answer the query directly and behave like useful tools where appropriate, not thin SEO articles.
- Channel referrals deep-link to relevant answer/tool context where safe.
- Audio/voice is presentation/input over canonical truth, not another factual engine.
- Official fact, learner evidence and VibeSchool guidance remain distinguishable.
- Eligibility, suitability and aspiration remain distinguishable.
- Recommendations expose uncertainty and never fabricate precision.
- Learner agency, privacy and safeguarding outrank conversion.
- Commercial relationships cannot alter educational truth or recommendation ranking.
- National public knowledge is provenance-backed, versioned and freshness-governed.
- #1 organic discoverability is an explicit measured objective, never a fabricated guarantee.
- Public SEO/AI surfaces never expose private learner data.
- Shared-device/assisted-use boundaries prevent learner-state leakage.
- Consequential recommendation results should become reconstructable by evidence/knowledge/rule/model version.
- Policy/source changes and corrections propagate through affected surfaces under governance.
- Documentation is not implementation; completion requires repository/test evidence.
- No merge to `main` until the full mission is complete and certified.

## Continuation Rule

A future agent must not implement one document in isolation. First reconcile current repository and live Supabase reality against the complete mission contract, then decompose the highest-priority unmet requirements into dependency-aware gates.

The default next action is **P0.0 Baseline Freeze and Collision Audit** from `pathways-repository-product-ux-execution-plan.md`.

Before coding, establish how current implementation handles or fails to handle: public/question/search entry; `/learn/careers`; pathway/school/subject/career data; assessment primitives; anonymous discovery; answer/action presentation; auth continuation; persistent pathway state; learner profile authority; Twin authority; official provenance; recommendation uncertainty; mobile/low-literacy behavior; indexability; analytics; privacy/safeguarding/shared devices; school identity/offering coverage; and existing AI/chat/search surfaces that could become a second truth engine.

## Mission Certification Layers

Before promotion, certification covers at least:

1. Product/UX behavior.
2. Anonymous→authenticated state continuity.
3. Canonical educational data/provenance.
4. Recommendation correctness, uncertainty and fairness.
5. Learner privacy/safeguarding/consent.
6. Shared-device/assisted-use isolation.
7. Mobile/accessibility/low-bandwidth behavior.
8. Search crawlability/technical SEO/public-private boundaries.
9. Ask/answer/action grounding and canonical-truth consistency.
10. Channel-to-product deep-link/context continuity.
11. Existing-system integration/no duplicate authority.
12. Analytics/observability and reconstruction.
13. Freshness/correction/policy-change operations.
14. Commercial neutrality.
15. Repository TypeScript/lint/build/tests/migration-security gates as applicable.
16. End-to-end exact-head mission acceptance.

External Google/AI ranking outcomes can only be measured after public deployment/indexation. Branch-level work must certify the technical/data/content prerequisites for the #1 objective, not fabricate ranking success.

## Handoff Sentence for a New Chat

> **Continue the VibeSchool Pathways mission on `agent/pathways-customer-acquisition-strategy`. First read `docs/strategy/pathways-mission-documentation-index.md` and all eight required documents in order. Treat them as governing mission memory. Then perform/continue P0.0 by inspecting current GitHub and live Supabase read-only, reconcile existing systems before inventing anything, and continue the highest-priority unmet gate. Do not merge to main until the full mission is implemented and certified. Do not reinterpret Pathways as only a quiz, chatbot, SEO project, directory or marketplace.**

The index exists so a future chat can reconstruct product intent and implementation discipline without depending on the original conversation.
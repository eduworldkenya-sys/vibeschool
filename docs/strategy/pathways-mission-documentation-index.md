# VibeSchool Pathways — Mission Documentation Index

**Branch:** `agent/pathways-customer-acquisition-strategy`  
**Purpose:** Prevent future engineers/agents from reading only one Pathways strategy file and missing governing requirements.  
**Promotion rule:** This branch remains isolated until the complete mission is implemented and certified.

## Required Reading Order

Anyone continuing the Pathways acquisition mission must read **all** of the following before changing implementation:

1. `docs/strategy/pathways-customer-acquisition.md`
   - Mission, vision, acquisition thesis, free-core model, funnel, roadmap and business boundaries.

2. `docs/strategy/pathways-experience-specification.md`
   - Placement, canonical screen journey, auth continuity, mobile/accessibility, sharing, trust and UX acceptance gates.

3. `docs/strategy/pathways-action-first-trust-and-guidance.md`
   - Action-first/depth-on-demand UX, quick guidance, progressive evidence, uncertainty, Pathway Passport, literacy/language and human guidance.

4. `docs/strategy/pathways-national-authority-and-discoverability.md`
   - National knowledge graph, provenance, #1 SEO objective, AI discoverability, benchmark portfolio, public knowledge surfaces and authority operations.

5. `docs/strategy/pathways-seven-constitutions-and-human-system-architecture.md`
   - Learner/parent/teacher/school profiles, decision psychology, trust/patience/capability states, truth, recommendation, safety/privacy, discovery, commercial and operations constitutions.

6. `docs/strategy/pathways-ask-understand-act-product-model.md`
   - Explains why users increasingly prefer short-form/social/AI answers over traditional search for practical decisions and defines VibeSchool's response: Ask → Understand → Verify → Personalize → Act → Human Help → Remember. It also governs multiple entry doors, Ask VibeSchool, search pages as tools, voice/listen direction, channel-to-product continuity and the education decision/navigation product model.

7. `docs/strategy/pathways-acquisition-execution-handoff.md`
   - Operational work board, P0→P4 sequence, engineering acceptance contract, analytics and continuation protocol.

**Reading one file is insufficient.** A future chat must read this index and all seven documents before changing the Pathways implementation or redefining the mission.

## Governing Product Model

The documents collectively define Pathways as:

> **A free, trusted acquisition front door and education decision/navigation system that converts authoritative Kenyan education evidence into understandable, action-first guidance; lets users enter from a question, themselves, a career, subject, school, pathway or location; earns sign-in through continuity; builds a persistent learner journey; becomes a #1 discoverable independent Pathways authority; and later supports optional governed human/commercial services without allowing money to influence educational truth.**

The canonical user-facing logic is:

> **ASK → UNDERSTAND → VERIFY → PERSONALIZE → ACT → GET HELP WHEN NEEDED → REMEMBER/CONTINUE.**

This must not be simplified by future agents into “build a quiz,” “build a chatbot,” “build SEO pages,” or “build a teacher marketplace.” Those are possible surfaces/capabilities inside a larger canonical decision system.

## Why the Ask → Understand → Act Model Matters

The product is responding to a real behavior: many users prefer short-form/social/AI experiences because they reduce the effort required to turn information into understanding and action. Traditional search can provide authoritative documents but often leaves synthesis to the user; social explanations can provide fast synthesis but may lack authoritative evidence.

VibeSchool's intended combination is:

> **short-form simplicity + search discoverability + authoritative Kenyan education evidence + teacher-like explanation + personalization + immediate action.**

VibeSchool should learn from the low-friction comprehension of short-form experiences without adopting misinformation, sensationalism, engagement bait or popularity-as-truth.

## Multiple Entry Doors, One Canonical System

Users must not be forced to begin from one assessment. They may begin from:

- **Me:** help me find my pathway;
- **Career:** I want to become X;
- **Subjects:** where can these subjects take me?;
- **School:** what does this school offer?;
- **Pathway:** help me understand/explore it;
- **Location:** what relevant options exist here?;
- **Question:** Ask VibeSchool;
- **Unknown:** guide me.

All entry doors must converge on the same canonical knowledge/evidence/recommendation system rather than creating separate contradictory engines.

## Non-Negotiable Cross-Document Invariants

- Core Pathways discovery remains free under this mission.
- Value precedes the primary sign-in trigger.
- Sign-in is for persistence/continuity, not ransom for a result.
- Anonymous pathway state should survive authentication where safe.
- Action first; detail and evidence on demand.
- Important answers should lead to an educationally useful next action where one legitimately exists.
- Ask VibeSchool must be evidence-grounded and must not become an unconstrained LLM source of educational truth.
- Search-intent pages should answer the query directly and behave like useful tools where structured interaction is appropriate, not thin SEO articles.
- Channel referrals should deep-link to the relevant answer/tool where safe rather than unnecessarily dropping users on a generic homepage.
- Audio/voice is a presentation/input layer over canonical truth, not a separate factual engine.
- Official fact, learner-supplied evidence and VibeSchool guidance remain distinguishable.
- Eligibility, suitability and aspiration remain distinguishable.
- Recommendations expose uncertainty and never fabricate precision.
- Learner agency, privacy and safeguarding outrank conversion.
- Commercial relationships cannot alter educational truth or recommendation ranking.
- National public knowledge must be provenance-backed, versioned and freshness-governed.
- #1 organic discoverability is an explicit measured objective, never a fabricated guarantee.
- Public SEO/AI surfaces never expose private learner data.
- Shared-device and assisted-use boundaries must prevent learner-state leakage.
- Consequential recommendation results should eventually be reconstructable by evidence/knowledge/rule/model version.
- Policy/source changes and corrections must propagate through affected knowledge/public/recommendation surfaces under governance.
- Documentation is not implementation; checklist items require repository/test evidence.
- No merge to `main` until the full mission is complete and certified.

## Continuation Rule

A future agent must not select a document and implement it in isolation. First reconcile the current repository/Supabase implementation against the complete mission contract, then decompose the highest-priority unmet requirements into coherent, dependency-aware implementation gates.

The default next engineering action remains **P0 Acquisition Foundation Audit + Canonical Journey**, expanded to include the constitutions, authority requirements and Ask → Understand → Act product model that affect P0.

Before coding, the next agent must explicitly establish how the current implementation handles or fails to handle:

- public/question/search entry points;
- canonical pathway/school/subject/career data;
- anonymous discovery;
- answer/action presentation;
- auth continuation;
- persistent pathway state;
- official-source provenance;
- recommendation logic and uncertainty;
- mobile/low-literacy behavior;
- public indexability;
- analytics/observability;
- privacy/safeguarding/shared devices;
- current school identity and offering coverage;
- and any existing AI/chat/search surfaces that could accidentally create a second truth engine.

## Mission Certification Layers

Before promotion is considered, certification should cover at least:

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
11. Analytics/observability and reconstruction.
12. Freshness/correction/policy-change operations.
13. Commercial neutrality.
14. Repository TypeScript/lint/build/tests/migration-security gates as applicable.
15. End-to-end exact-head mission acceptance.

External Google/AI ranking outcomes can only be measured after public deployment/indexation and therefore cannot be fabricated as a branch-level pass. The branch must, however, contain and pass the technical/data/content prerequisites required to pursue the #1 objective.

## Handoff Sentence for a New Chat

If the user opens a new chat, the minimum safe instruction is:

> **Continue the VibeSchool Pathways mission on `agent/pathways-customer-acquisition-strategy`. First read `docs/strategy/pathways-mission-documentation-index.md` and every required document in its reading order. Treat the repository documents as the governing mission memory. Inspect current GitHub and Supabase reality before implementation, reconcile it against the complete mission, and continue the highest-priority unmet gate. Do not merge to main until the full mission is implemented and certified. Do not reinterpret Pathways as only a quiz, chatbot, SEO project or marketplace.**

The index exists specifically so future chats do not need the original conversation to reconstruct the product intent.
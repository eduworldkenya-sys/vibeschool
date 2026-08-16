# VibeSchool Pathways — Experience Architecture Specification

**Status:** Mission design contract; implementation must be validated against the real application before promotion.  
**Branch:** `agent/pathways-customer-acquisition-strategy`  
**Companions:** `pathways-customer-acquisition.md`, `pathways-acquisition-execution-handoff.md`

## 1. Experience Mission

Pathways must turn educational uncertainty into confident action with the least possible friction.

The experience contract is:

**Arrive with a question → understand the value immediately → explore without payment → receive meaningful personalized value → sign in only when continuity becomes valuable → resume without losing work → take a useful next action → return as the journey develops.**

Pathways is not a registration form disguised as a product. Authentication is a bridge from anonymous value to persistent value.

## 2. Experience Principles

1. **Value before extraction.** Do not ask for payment or unnecessary personal information before demonstrating value.
2. **One obvious next action.** Every major screen has one primary CTA.
3. **Mobile first.** The default design target is an ordinary Android phone and variable connectivity.
4. **Progressive disclosure.** Show what is useful now; reveal complexity as the user needs it.
5. **No lost work.** Authentication, refresh, back navigation and recoverable failures must not unnecessarily destroy pathway progress.
6. **Explain recommendations.** Users must be able to understand why a pathway is suggested and that recommendations are guidance, not guarantees.
7. **Learner first.** Commercial relationships, schools and future paid services cannot distort pathway ranking.
8. **Safe by design.** Child privacy, sharing and parent/teacher interactions are product constraints, not later additions.
9. **Low-bandwidth tolerant.** Core discovery should avoid unnecessary large media, heavy animation or AI dependencies.
10. **Accessible language.** Prefer understandable educational language over policy jargon; define unfamiliar terms.

## 3. Placement Architecture

### Public VibeSchool

Pathways should be discoverable as a first-class public service rather than hidden behind a dashboard.

Expected surfaces, subject to implementation audit:

- public navigation or prominent education-guidance entry;
- search-intent landing pages;
- campaign/referral landing pages;
- safe shared pathway links;
- teacher/school QR entry points.

Primary public CTA: **Discover my pathway — free**.

### Learner product

After authentication/adoption, Pathways becomes part of the learner's persistent journey. It should be reachable from the learner experience without requiring the assessment to be repeated.

Relevant learner surfaces can include home/next-action context, profile/goals and learning recommendations. Exact placement must follow the existing navigation architecture discovered during P0 audit.

### Parent experience

Parents need an understandable view oriented around supporting the learner, not a copy of the learner dashboard. Parent access must respect relationship verification, consent and safeguarding rules.

### Teacher experience

Teachers should initially act as trusted distribution/support participants, not gatekeepers. Teacher-facing placement should support safe referral and, later, governed assistance workflows.

### School experience

School information belongs downstream of learner guidance. School commercial participation must never silently change learner-first recommendation order.

## 4. Canonical Screen Journey

### Screen 1 — Discovery landing

Goal: communicate the problem solved within seconds.

Must answer:
- What will this help me understand?
- Is it free?
- How long/complex is it likely to be?
- What will I get at the end?

Primary CTA: **Discover my pathway**.
Secondary content may explain how it works and who it is for. Do not lead with account creation.

### Screen 2 — Orientation

Set expectations and explain that answers improve guidance. Ask only information necessary for the discovery stage. Do not collect marketing data merely because the user is available.

### Screens 3..N — Guided discovery

Behavior:
- one coherent decision/question group at a time;
- visible progress without deceptive precision;
- back/edit where logically safe;
- selections visibly confirmed;
- autosave locally/session-side where safe;
- recover gracefully from transient network failures;
- avoid requiring network round-trips for every trivial interaction where architecture permits;
- do not use manipulative answer wording.

### Result transition

Use a lightweight progress state only when computation genuinely takes time. Never fake long processing to make recommendations appear sophisticated.

### Preliminary result — value moment

The anonymous user receives enough genuine information to know the service worked.

The result should prioritize:
1. suggested direction/pathway;
2. short plain-language explanation;
3. strongest reasons/evidence signals;
4. important caveat/alternative where relevant;
5. clear next action.

This is the preferred location for the main acquisition trigger.

### Sign-in continuation card

The CTA must sell continuity, not access to something falsely described as paid/premium.

Preferred intent: **Save my pathway and continue**.

Supporting benefits can include saving results, receiving next steps, tracking progress and continuing inside VibeSchool.

The user should understand that account creation is free.

### Authentication

Requirements:
- preserve a safe continuation token/state;
- support existing-user sign-in and appropriate new-user registration;
- avoid unnecessary role confusion;
- cancellation/back should not intentionally erase anonymous results;
- authentication failure should return a recoverable state;
- do not put sensitive pathway answers into insecure URL parameters.

### Post-auth restoration

This is a hard acceptance invariant:

> Successful authentication returns the user to the pathway journey with the relevant pre-auth state restored or safely adopted.

Do not dump a newly registered user onto an unrelated generic dashboard.

### Full pathway / adoption

The authenticated user should be able to save/adopt the pathway and understand:
- recommended direction;
- why;
- alternatives where relevant;
- subjects/competencies or prerequisites where supported by authoritative data;
- concrete next steps;
- what can change the recommendation later.

### First meaningful action

Registration is not activation. The journey must offer an immediate action, such as adopting the pathway, reviewing an appropriate next-step plan or beginning a relevant learning action. The exact action must be selected after auditing current VibeSchool capabilities.

## 5. Returning User Behavior

A returning user should see the persistent pathway state, not an acquisition funnel intended for anonymous visitors.

The system should distinguish:
- no pathway yet;
- pathway in progress;
- result ready but not adopted;
- adopted/current pathway;
- pathway needing review because meaningful evidence changed;
- historical/superseded recommendation where history is retained.

Do not silently overwrite a learner's adopted direction because one new data point appears.

## 6. Sharing and Referral UX

Sharing is a growth mechanism but must be privacy-safe.

Potential surfaces:
- generic “Try VibeSchool Pathways” referral;
- teacher QR/link;
- school guidance campaign link;
- WhatsApp-friendly public landing link;
- explicit result sharing only when policy/consent permits.

Default referrals should share the service, not private learner results.

Never encode sensitive answers, learner identity or private recommendations in publicly guessable URLs.

## 7. Future Teacher Assistance Placement

Paid teacher assistance is downstream and optional.

It may appear when the user has a genuine interpretation/action problem, for example:
- “I need help understanding this recommendation”;
- “Help us plan the next step”;
- “Talk through subject choices.”

It must not:
- obscure the free result;
- imply payment is necessary for a valid pathway;
- create false urgency;
- allow teachers to buy recommendation influence.

The marketplace UX is a later mission and requires verification, safeguarding, SLA, payment, refund and dispute contracts before activation.

## 8. School Placement Rules

School discovery should follow pathway understanding rather than lead it.

Where schools are shown:
- distinguish verified factual fit from advertising/commercial placement;
- disclose sponsored placement if ever introduced;
- never change pathway recommendation because a school paid VibeSchool;
- give users understandable filtering/context rather than unexplained ranking.

## 9. Error, Empty and Recovery States

The implementation must explicitly design:
- no connectivity;
- slow connectivity;
- partial state available;
- expired anonymous session;
- authentication cancelled;
- authentication failed;
- state-transfer failure;
- recommendation unavailable;
- insufficient evidence for a confident recommendation;
- returning user with no saved pathway;
- stale/superseded pathway;
- unavailable downstream school/teacher data.

Fail honestly. Prefer “we need more information” to fabricating certainty.

## 10. Mobile and Accessibility Contract

- phone is the primary viewport;
- primary CTA reachable and visually dominant without clutter;
- touch targets must be comfortably usable;
- forms/questions should not require precision tapping;
- support keyboard/screen-reader semantics in implementation;
- do not communicate state using color alone;
- keep text readable and concise;
- avoid horizontal scrolling for core tasks;
- tolerate browser refresh/reopen where feasible;
- minimize asset and JavaScript cost on acquisition-critical screens.

## 11. Trust Design

The result experience should communicate:
- what inputs influenced the recommendation;
- why the direction fits;
- uncertainty where present;
- that interests/performance/goals can evolve;
- the difference between guidance and official eligibility/admission rules;
- source/provenance where authoritative curriculum or school claims are displayed.

Do not use fake precision such as unsupported “97% perfect match” scores.

## 12. Analytics Behavior

Events must correspond to meaningful state transitions, not arbitrary clicks.

Core events:
- landing viewed;
- discovery started;
- discovery milestone reached;
- preliminary result reached;
- sign-in continuation shown;
- auth started;
- auth completed;
- pathway state restored;
- full result viewed;
- pathway adopted/saved;
- first meaningful action completed;
- return session;
- referral initiated;
- assistance viewed/requested later.

Every event needs a documented trigger, allowed properties, privacy classification and deduplication behavior before production instrumentation.

## 13. UX Acceptance Gates

The acquisition journey is not complete until evidence shows:

- [ ] Public visitor can find and start Pathways without payment.
- [ ] Visitor receives meaningful value before the primary authentication trigger.
- [ ] Main CTA hierarchy is unambiguous on mobile.
- [ ] Anonymous progress survives normal navigation/recoverable interruption as designed.
- [ ] Authentication does not unnecessarily discard pathway work.
- [ ] Successful auth restores the intended pathway context.
- [ ] User can adopt/save the pathway.
- [ ] User receives a meaningful next action after adoption.
- [ ] Returning users see persistent pathway state.
- [ ] Sharing defaults are privacy-safe.
- [ ] Failure/uncertainty states do not fabricate recommendations.
- [ ] Analytics accurately reconstruct the acquisition journey without excessive personal data.
- [ ] Accessibility/mobile/low-bandwidth behavior has been tested.
- [ ] Learner safeguarding/privacy review passes.

## 14. What Is Deliberately Not Frozen Yet

This specification freezes behavior and product principles, not unsupported implementation details.

Do not invent before P0 audit:
- exact existing route names;
- exact database schema;
- exact component names;
- exact recommendation algorithm;
- exact parent-minor consent implementation;
- exact paid-assistance pricing;
- exact school-ranking model;
- exact visual tokens where the existing design system should govern them.

The real repository and Supabase architecture must determine those details.

## 15. Promotion Rule

This mission branch is **not to be merged into `main` while the Pathways acquisition mission is incomplete**.

Documentation alone does not qualify the mission for merge. Promotion requires the agreed implementation scope, UX behavior, analytics, privacy/safeguarding review, tests and end-to-end certification to be complete on the mission branch.

Until then:

**branch remains isolated → inspect → design → implement → adversarially test → certify → only then consider promotion.**

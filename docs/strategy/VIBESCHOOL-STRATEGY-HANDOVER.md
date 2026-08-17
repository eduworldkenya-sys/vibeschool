# VibeSchool Strategy Handover

Date: 2026-08-17  
Branch purpose: preserve competitive, product, membership and sponsorship reasoning before implementation.

## Handover objective

A senior engineer, product leader or future worker should be able to enter this branch and understand **what is decided, what is hypothesized, why the strategy exists, what must be proven, and what must not be implemented prematurely** without needing the originating conversation.

## Current strategic conclusion

VibeSchool should become a learner-centred education operating system, not a feature clone of Kenyan CBC/CBE apps or generic school ERPs.

North-star product loop:

**KNOW → PLAN → TEACH → LEARN → PROVE → ADAPT → REPORT → PROGRESS**

The defensible asset is the longitudinal learner educational state connecting curriculum, teaching, evidence, mastery, intervention and progression.

## Competitive landscape reviewed

Discovery included CBC App, Kusoma, EduVantage, XULE, CBCTrack, Celebra, DiraSchool, ZARODA, AssessKe, CBC Edu Kenya, SmartGrade and ElimuStar.

Observed market categories:

1. teacher productivity — schemes, lesson plans, assessment, TPAD;
2. school ERP — fees, M-Pesa, attendance, communication, reporting, payroll;
3. learning/content — notes, revision, quizzes, library, tutoring;
4. CBE evidence/assessment — rubrics, competencies, portfolios, analytics and reports.

VibeSchool should classify future competitive discoveries as PARITY / BEAT / IGNORE / OWN rather than blindly copying them.

## Product reality

VibeSchool already has broad implementation architecture. The principal risk is not lack of feature ideas; it is incomplete integration, authorization, certification, operational proof and public proof.

Therefore no engineer should interpret this initiative as permission to create a large competitor-feature backlog and immediately implement it.

## Flagship certification journey

The target end-to-end journey is:

**teacher joins → valid school/class authority → learners join → curriculum → scheme → lesson → teaching occurrence → attendance/evidence/homework → learner submission/activity → assessment → mastery → intervention/next action → learner adaptation → parent understanding → school visibility.**

This journey should become excellent and pilot-proven.

## Membership hypotheses

Candidate learner pricing under discussion:

- Day: KSh20 (range previously discussed KSh10–20)
- Week: KSh69 (range previously discussed KSh49–70)
- Month: KSh199
- Term: KSh499
- Year: KSh1,299

Candidate institution pricing: **KSh50 per learner per term**.

Candidate teacher sponsorship threshold: **25 qualifying active learners**.

Candidate institutional sponsorship threshold: **300 qualifying active learners**.

None of these values are final production policy.

## Sponsorship principle

Do not market the mechanism as free school software. Working concept: **VibeSchool Network Sponsorship**.

Sponsorship must reward sustained genuine educational participation. Simple account creation, app opening or coordinated login campaigns must not qualify.

## Qualifying Active Learner is unresolved

The QAL definition is a prerequisite to sponsorship implementation. It must cover meaningful event types, legitimate relationships, rolling windows, distinct active days, idempotency/replay resistance, abuse detection, auditability, grace, revocation and review.

Because QAL affects money, it is both a product metric and a financial authorization boundary.

## Parent principle

Parent access should accompany the learner relationship for relevant communication, progress and support. Multi-child/family economics remain open.

## Institutional payer principle

Support the possibility that a school centrally funds learner memberships. The learner experience should eventually support individual, family, institution and sponsor-funded payer routes without fragmenting educational identity.

## Premium-brand principle

The intended positioning is premium quality, not artificial exclusivity and not low-price branding. VibeSchool may deliberately target ambitious/private/international institutions for early adoption, but product quality—not socioeconomic exclusion—must create prestige.

## Content principle

Do not promise to eliminate books. Promise access to the VibeSchool Learning Library and ensure content rights are legitimate.

## Hard gates before commercial implementation

1. Authorization chain certified.
2. Flagship learning journey reliable.
3. Meaningful activity instrumentation available.
4. Pilot usage data available.
5. Unit economics modeled.
6. QAL contract approved.

Only then should final pricing and automated sponsorship policy be encoded.

## Current authorization dependency

Maintain the sequence:

**Auth/roles → claim & identity → classroom activity → submission/result → Supabase authorization certification → instrumentation → pilot.**

Do not weaken this chain for growth or billing convenience.

## Decision register

### LOCKED STRATEGIC DIRECTION

- learner educational state is the core product asset;
- product should connect curriculum, teaching, learning, evidence and progression;
- avoid feature-count competition;
- parents participate in the learner relationship;
- schools and teachers may earn sponsored membership through genuine learner adoption;
- premium positioning must come from execution and trust;
- public claims require evidence.

### HYPOTHESES TO TEST

- KSh20 day / KSh69 week / KSh199 month / KSh499 term / KSh1,299 year;
- KSh50 per learner per term institution price;
- 25 QAL teacher threshold;
- 300 QAL institution threshold;
- parent access included with learner relationship;
- network sponsorship as a growth flywheel.

### OPEN

- exact QAL formula;
- payer/billing denominator;
- family plan;
- teacher standard price;
- institution-funded learner bundle;
- scholarship model;
- AI and messaging limits;
- M-Pesa/payment implementation and economics;
- VAT/tax/refund/reversal treatment;
- grace periods;
- SLA/support commitments;
- content licensing boundaries.

## Implementation prohibition

This documentation commit is deliberately strategy-only. It does **not** authorize production migrations, pricing publication, billing activation, sponsorship activation, Worker Engine activation, or production Supabase mutation.

## Next engineering package

After the current authorization/pilot prerequisite is certified, produce a separate implementation specification covering:

- entitlement ledger and state machine;
- payer vs beneficiary separation;
- payment lifecycle;
- QAL event contract;
- qualification snapshots;
- sponsorship state machine;
- anti-abuse threat model;
- grace/revocation/recovery;
- observability and audit;
- unit-economics acceptance thresholds;
- pilot experiment design.

## Source of truth

Read `docs/strategy/VIBESCHOOL-MEMBERSHIP-AND-COMPETITIVE-STRATEGY.md` for the full strategic baseline. This handover is the concise operational index.

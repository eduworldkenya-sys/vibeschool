# VibeSchool Membership & Competitive Strategy

Status: Strategy baseline / handover document  
Date: 2026-08-17  
Implementation status: **NOT AUTHORIZED BY THIS DOCUMENT**. Pricing values and sponsorship thresholds below are hypotheses until explicitly certified.

## 1. Executive decision

VibeSchool must not become another Kenyan CBC app, generic school ERP, AI lesson-plan generator, or cheap revision platform.

Working positioning:

> **VibeSchool — the learning operating system for ambitious schools, teachers, learners and families.**
>
> **Every learner known. Every lesson connected. Every outcome visible.**

The product loop is:

**KNOW → PLAN → TEACH → LEARN → PROVE → ADAPT → REPORT → PROGRESS**

Every consequential feature should strengthen this loop.

## 2. Competitive thesis

The Kenyan education software market contains products specializing in teacher productivity, school ERP, learning/content, assessment/evidence, reporting, and learner revision. Competitors reviewed during strategy discovery include CBC App, Kusoma, EduVantage, XULE, CBCTrack, Celebra, DiraSchool, ZARODA, AssessKe, CBC Edu Kenya, SmartGrade and ElimuStar.

The strategic response is **not** to copy every competitor feature. Competitive discoveries must be classified as:

- **PARITY** — necessary table stakes.
- **BEAT** — strategically important capability VibeSchool should outperform.
- **IGNORE** — complexity that does not strengthen the thesis.
- **OWN** — a defensible capability VibeSchool can uniquely dominate.

Candidate OWN territory includes continuous learner educational state, curriculum-to-evidence continuity, intervention-effect tracking, learner Twin grounded in real learning history, parent understanding rather than raw reporting, longitudinal Pathways/Passport intelligence, and activity-driven network sponsorship.

## 3. Core moat: learner educational state

VibeSchool should continuously know:

1. what curriculum outcome should be learned;
2. what was planned;
3. what was actually taught;
4. what the learner experienced;
5. what evidence the learner produced;
6. what assessment demonstrated;
7. what the learner mastered;
8. what the learner misunderstood;
9. what intervention occurred;
10. whether that intervention worked;
11. what the learner should do next;
12. what the teacher should do next;
13. what the parent should understand; and
14. what the school should improve.

The durable asset is the longitudinal **learning graph / learner educational state**, not generated PDFs or isolated administrative records.

## 4. Product architecture principle

VibeSchool already has broad architecture across curriculum, schemes, lessons, teaching occurrences, evidence, homework, assessment, reporting, parents, TPAD, Pathways, finance, content and learner intelligence.

The strategic risk is excessive breadth without end-to-end reliability. Do not respond to competitors by creating more disconnected tables or surfaces.

The flagship journey to certify is:

**teacher joins → school/class relationship → learners join → curriculum attached → scheme → lesson preparation → teaching occurrence → attendance → evidence/homework → learner work → assessment → mastery update → intervention/next action → Twin adaptation → parent understanding → school-level educational visibility.**

## 5. Commercial model

All participants are VibeSchool users. Teacher, learner, parent and school administrator are roles/relationships around the educational network, but payment responsibility and entitlements differ.

### 5.1 Learner membership — pricing hypothesis

| Duration | Candidate price |
| --- | ---: |
| Day | KSh 20 |
| Week | KSh 69 |
| Month | KSh 199 |
| Term | KSh 499 |
| Year | KSh 1,299 |

These are **hypotheses, not approved public prices**. Earlier exploration included KSh10–20/day and KSh49–70/week. Pilot and unit-economics evidence must determine final values.

Potential learner entitlement includes curriculum learning, VibeSchool Learning Library, revision, assessments, practice, learning resources, Pathways, progress intelligence, personalised recommendations, and appropriately bounded Twin/AI use.

### 5.2 Parent membership

Working principle: parent access accompanies the learner relationship. Parents should not require a second subscription merely to see relevant progress, reports, attendance, interventions, communication, notices, Pathways support, or permitted financial information.

Family/multi-child pricing remains open.

### 5.3 Teacher membership and sponsorship

Teachers may normally have a paid or institution-provided entitlement.

Working sponsorship hypothesis:

> **25 qualifying active learners → teacher membership sponsored.**

A login is not qualifying activity. The exact Qualifying Active Learner specification must be defined before implementation.

### 5.4 Institution membership

Working hypothesis:

> **KSh 50 per learner per term.**

Illustrative economics only:

| Learners | Per term | Approx. 3 terms |
| ---: | ---: | ---: |
| 100 | KSh 5,000 | KSh 15,000 |
| 300 | KSh 15,000 | KSh 45,000 |
| 500 | KSh 25,000 | KSh 75,000 |
| 1,000 | KSh 50,000 | KSh 150,000 |

This is not final pricing. Whether the billable denominator is enrolled, licensed, or active learners remains open.

### 5.5 VibeSchool Network Sponsorship

Working institutional sponsorship hypothesis:

> **300 qualifying active learners → institutional membership sponsored by the VibeSchool network.**

Do not position this as “free school software.” The intended concept is **VibeSchool Network Sponsorship**: sustained genuine learner participation can qualify an institution for sponsored membership.

## 6. Qualifying Active Learner (QAL)

This is an economic and security boundary because activity can affect payment.

A QAL must eventually require a legitimate learner relationship and meaningful educational activity across a defined rolling period. Candidate qualifying events include lesson completion, assessment, homework, revision, meaningful resource interaction, or Twin-guided learning.

Opening the application or generating synthetic logins must not qualify.

Before implementation define:

- qualifying event taxonomy;
- distinct active-day requirement;
- rolling measurement window;
- teacher/class/school relationship validity;
- duplicate/replay/idempotency controls;
- bot and coordinated abuse detection;
- qualification snapshots and audit trail;
- grace periods;
- sponsorship activation, suspension and revocation;
- appeals/manual review.

## 7. Commercial flywheel

**learner joins → learner receives continuing educational value → parent sees value → learner remains active → teacher reaches qualifying participation → teacher membership sponsored → deeper classroom integration → more learners participate → institution reaches qualifying participation → institutional membership sponsored → institution promotes adoption → more learning evidence → better educational intelligence → greater learner/teacher/parent value.**

Pricing should reinforce genuine educational participation rather than raw account creation.

## 8. Premium positioning

VibeSchool should pursue **premium quality without artificial exclusivity**.

Do not position the product as cheap software or explicitly restrict the brand to “elite schools.” Early acquisition can target ambitious private, international, and high-performing institutions while preserving a product architecture that can serve a broader population.

Premium perception must come from reliability, speed, curriculum accuracy, excellent mobile UX, excellent onboarding, beautiful and useful reporting, security/privacy, support quality, provenance/evidence, operational professionalism, and absence of broken journeys.

## 9. Learning library promise

Do not promise that parents will never need books. That creates pedagogical and licensing risk.

Preferred claim:

> **Every eligible learner membership includes access to the VibeSchool Learning Library.**

Content must be owned, licensed, open, or otherwise legitimately usable.

## 10. Multiple payer routes

The learner experience should not depend on who pays. Future entitlement architecture should be capable of supporting:

- individual-funded membership;
- family-funded membership;
- institution-funded learner membership;
- scholarship/sponsor-funded membership.

Premium institutions may prefer to purchase learner access centrally rather than asking families to subscribe individually.

## 11. Unit economics gate

No candidate price becomes final until the model includes at least:

- M-Pesa/payment processing costs;
- payment failures, reversals and refunds;
- AI inference costs and fair-use limits;
- database, hosting, storage and bandwidth;
- content production/licensing;
- SMS/communication marginal cost;
- onboarding and support;
- taxes/VAT treatment;
- customer acquisition;
- fraud/abuse cost;
- institutional service/SLA obligations.

Low-priced access must never imply economically unbounded AI or messaging.

## 12. Public-market proof gap

VibeSchool's competitive weakness is not simply missing architecture. Established competitors currently have stronger public proof in areas such as customer history, testimonials/case studies, pricing transparency, product demonstrations and concise feature communication.

Future public claims must be backed by production capability and pilot evidence. Never manufacture testimonials, usage evidence or outcomes.

## 13. Engineering prerequisite

Commercial work must not bypass the production-hardening chain:

**Auth/roles → claim & identity → classroom activity → submission/result → Supabase authorization certification → instrumentation → pilot.**

Membership, billing, sponsorship and growth mechanics must preserve those authorization boundaries.

## 14. Recommended implementation sequence

1. Finish authorization certification.
2. Complete and certify the flagship teacher→learner→parent journey.
3. Instrument meaningful educational activity.
4. Pilot with real users.
5. Establish baseline activity, retention and cost data.
6. Finalize the QAL specification.
7. Model unit economics.
8. Implement membership/entitlement ledger.
9. Implement payment lifecycle.
10. Implement teacher sponsorship.
11. Implement institutional sponsorship.
12. Pilot pricing.
13. Publish evidence-backed pricing/product pages.
14. Expand competitive parity only where evidence justifies it.

## 15. Open decisions — do not silently encode

The following remain explicitly OPEN:

- KSh10 vs KSh20 daily;
- KSh49 vs KSh69/70 weekly;
- final monthly, term and annual learner prices;
- KSh50/learner/term validation;
- enrolled vs licensed vs active institutional billing denominator;
- teacher normal price;
- exact 25-learner sponsorship semantics;
- exact 300-learner sponsorship semantics;
- QAL definition and measurement window;
- sponsorship grace period;
- family/multi-child pricing;
- school-funded learner pricing;
- scholarships/sponsorship funding;
- AI usage limits;
- communication/SMS allowances;
- M-Pesa economics;
- VAT/tax treatment;
- refund/reversal handling;
- institutional contracts and SLA;
- content licensing boundaries.

## 16. North-star rule

> **VibeSchool does not optimize for feature count.**
>
> Every consequential feature must strengthen the continuous relationship between curriculum, teaching, learning, evidence and progression.
>
> Administrative capabilities exist to support that learning relationship. AI exists to improve it. Pricing exists to expand it. Network sponsorship exists to reward genuine adoption. The learner's educational state is the core asset.
>
> Never sacrifice authorization, evidence integrity, learner trust, or truthful product claims for growth.

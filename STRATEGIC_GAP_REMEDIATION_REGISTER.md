# VibeSchool Strategic Gap Remediation Register

Status date: 2026-08-14

This register converts the external 14-gap consultant audit into an evidence-based execution contract. It distinguishes product/code remediation from external approvals that VibeSchool cannot truthfully manufacture in software.

| Gap | Repository finding | Remediation state | Remaining external/operational gate |
|---|---|---|---|
| G-01 ODPC / child privacy | Privacy/runtime mismatch and learner guardian gate were remediated in PR #143. | Product controls strengthened. | Confirm controller/processor registration obligations, DPO requirement, DSAR process, retention operations and any required ODPC registration with qualified Kenyan privacy counsel/ODPC. |
| G-02 KICD / curriculum alignment | Content Engine already has normalized learning outcomes, verification states and chapter/block outcome links. Publication-level provenance was missing. | This branch adds `publication_curriculum_provenance`; authors cannot self-certify verified alignment or external approval. | Actual KICD submission/review/approval remains an external process and must be evidenced by a real reference before VibeSchool displays an approval claim. |
| G-03 GTM wedge | Product supports teacher, learner, parent and school roles. | Do not hard-code an unvalidated school-only acquisition strategy into product architecture. | Run teacher-led and school-led acquisition pilots and compare activation, cycle time, retention and cost. |
| G-04 value proposition | Public welcome positioning remediated in PR #143. | Implemented. | Measure conversion rather than inventing uplift claims. |
| G-05 monetization | Publication pricing primitives exist, but a validated platform pricing model does not. | No invented KES price added. | Validate willingness-to-pay and entitlement boundaries before billing UI. |
| G-06 M-Pesa | No production payment contract is certified. | Not faked. | Requires merchant/business configuration, Daraja credentials, callback/reconciliation design and commercial pricing decision before safe implementation. |
| G-07 low bandwidth/PWA | VibeSchool already has PWA contract and browser/offline gates. | Existing implementation certified in PR #143 exact-head CI. | Add field performance/bundle telemetry on representative Kenyan low-end Android/3G conditions. |
| G-08 teacher onboarding | Recent canonical onboarding resolver and auth journey work already exists. | Preserve; do not rebuild from stale audit assumptions. | Measure completion, time-to-first-value and abandonment by step. |
| G-09 AI governance | Worker Engine has authority, certification and shadow-operation architecture. | Existing governance is materially stronger than the audit described. | Continue WE-R1.3 shadow certification; separately govern learner/assessment AI high-stakes outputs. |
| G-10 moat | Learner profile, curriculum outcome graph, Content Engine and Twin architecture exist. | Direction established. | Grow lawful longitudinal evidence and measure workflow retention; never frame personal learner data itself as owned property. |
| G-11 CAC/LTV | No trustworthy mature unit economics can exist before stable pricing/cohorts. | Do not manufacture 3:1 metrics. | Instrument acquisition source, activation, retention, revenue, gross margin and churn once commercial pilots begin. |
| G-12 exit positioning | Not a present product defect. | Deferred deliberately. | Maintain clean IP, contracts, compliance and financial records; revisit after repeatable product-market evidence. |
| G-13 organization | Worker Engine changes the conventional headcount assumption. | Use human authority + specialist advisors + governed digital workforce. | Humans remain required where law, pedagogy, institutional accountability and relationship ownership demand them. |
| G-14 partnerships | Partnerships are distribution/legitimacy work, not a code checkbox. | Product remains partner-ready rather than claiming nonexistent partnerships. | Pursue KICD, schools, telcos, publishers and teacher institutions after measurable pilot evidence. |

## Non-negotiable truth rule

VibeSchool must never display or encode `KICD approved`, `ODPC certified`, a partnership, a payment capability, a conversion uplift, or a commercial metric unless there is current evidence supporting that exact claim.

## UX rule

Compliance controls should protect learners without turning onboarding into legal paperwork. Prefer progressive disclosure, existing parent/school relationships, clear recovery paths and server-side enforcement over long forms and browser-only checks.

## Promotion rule

Every remediation slice branches from `main`, remains isolated until its exact head passes relevant contracts plus TypeScript/ESLint/production build, and merges only when the resulting behavior and claims are evidence-backed.

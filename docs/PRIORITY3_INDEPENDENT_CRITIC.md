# Priority 3 — Independent Critic / Senior Editorial Worker

## A. Existing editorial truth

Priority 1 is the author-side professionalization layer and remains intact. It supplies the existing source-grounded author worker with versioned professional/subject/quality profiles, governed context and planning, deterministic Teacher Guide preflight, bounded author self-review, failure semantics and worker traceability.

Priority 2 is now merged on main as the independent Quality Intelligence examination layer. Its sealed V1 Teacher Guide rubric is `teacher-guide-independent-quality:v1`, threshold 85/100, with eleven dimensions, per-dimension minima and seven non-averagable hard blockers. Its eight-case sealed gold suite, frozen authoring baseline and append-only evaluation evidence remain independent of the author.

Existing R2.1 Research Worker, R2.2 Semantic Verifier, R2.3 source-grounded authoring, quality snapshots, publication release checks/approvals, human HQ release review and remediation infrastructure are not replaced.

Before Priority 3, the missing capability was a separate senior editorial reasoning function that could independently challenge semantic correctness, pedagogical sufficiency, classroom usability and assessment coherence beyond author self-review and deterministic measurement.

## B. Reuse decisions

| Capability | Decision | Priority 3 use |
|---|---|---|
| R2.1 Research Worker | REUSE | Authorized evidence acquisition; Critic does not secretly browse. |
| R2.2 Semantic Verifier | REUSE | Source/claim verification evidence; not the editorial verdict. |
| R2.3 + Priority 1 Content Worker | REUSE | Author trace, preflight and self-review evidence only. |
| Priority 2 Quality Intelligence | REUSE | Canonical rubric, dimensions, hard blockers and examination identity. |
| content quality snapshots / publication quality | RECONCILE | Supporting measurement evidence, never sufficient editorial authority. |
| human publication review / two-key release gate | REUSE | Final release authority remains human/governed. |
| remediation infrastructure | REUSE LATER | Priority 4 may consume findings; P3 cannot mutate content. |
| independent senior editorial judgment | IMPLEMENT | New P3 responsibility. |

## C. Critic machine CV

Worker identity: `content-critic-chemistry-v1`.

Professional profile: `independent-senior-educational-editor:v1`.

Professional equivalent: Senior Educational Subject Editor / Independent Content Critic; Chemistry certification specialization: Senior Chemistry Educational Editor.

Success function: **correct defect discrimination**. Approval rate, rejection rate, score, agreement with the author and finding count are not optimization targets.

The profile covers curriculum fidelity, Chemistry correctness and reasoning, conceptual depth, pedagogical sequence, prerequisites, misconceptions, teacher explanation, activity design, classroom feasibility, practical work, safety, questioning, differentiation/inclusion, assessment and marking validity, evidence/provenance, teacher usability and internal consistency.

## D. Independence

P3 has a different worker key, professional profile, mission, success function, runtime prompt, execution identity and output contract from P1. The Content Worker prompt is not reused. P1 author self-review is deliberately **withheld from the primary Critic model judgment** to reduce anchoring. It is attached only after the independent judgment for explicit disagreement comparison.

The Critic cannot repair content, publish, approve publication, alter the quality standard, clear a P2 hard blocker or grant itself authority. Existing P2 blockers are preserved even if the Critic would otherwise pass the artifact.

## E. Inputs

The canonical review packet carries:

- immutable artifact ID, type, version, content and optional content hash;
- canonical curriculum identity, mapped outcomes and curriculum evidence;
- author worker/version, professional profile, subject profile and artifact-contract trace;
- provenance, instructional coverage plan and relevant planning outputs;
- P1 deterministic preflight and unresolved uncertainty;
- P1 author self-review, withheld until after primary P3 judgment;
- exact P2 rubric key/version/SHA, dimension results, hard blockers and evaluation evidence.

The runtime rejects a P2 identity mismatch. It does not read the sealed P2 gold suite during normal review.

## F. Review planning

The inspectable V1 plan is:

`identity verification → curriculum obligations → scientific claims → instructional coverage → activities → assessment → practical/safety → teacher usability → evidence/provenance → cross-section consistency → findings synthesis → critic self-check`.

The reasoning is decomposed into bounded curriculum/pedagogy, scientific/subject, assessment, practical/safety and coherence/classroom-usability passes inside one governed Critic execution. Deterministic P1/P2 work is consumed rather than recomputed with expensive reasoning.

## G. Findings contract

Every substantive finding carries critic execution ID, artifact ID/version, quality-contract identity, critic and subject profile versions, category, canonical P2 dimension, optional canonical P2 hard-blocker code, severity, affected section/outcome, explicit claim, evidence, reasoning summary, required remediation, release-blocking flag, confidence, uncertainty and timestamp.

The runtime validates categories, P2 dimensions, hard-blocker codes, severities, evidence presence, confidence, duplicate findings and fail-closed severity/blocking consistency. A future Repair Worker receives only precise finding/handoff data, not editorial authority.

## H. Decision contract

- `PASS`: no blocking editorial finding and no P2 blocker.
- `PASS_WITH_NOTES`: only non-blocking findings.
- `REPAIR_REQUIRED`: one or more remediable blocking findings or an existing P2 blocker.
- `HUMAN_EDITOR_REQUIRED`: qualified human judgment is needed.
- `EVIDENCE_REQUIRED`: material uncertainty/evidence conflict prevents responsible judgment.
- `SAFETY_BLOCK`: unresolved material safety defect.

`UNRESOLVED` is allowed. Critical uncertainty fails closed. A P3 PASS means eligibility for the next governed stage, never publication.

## I. Chemistry examination

The P3 examination suite covers recurring Chemistry Teacher Guide weaknesses: summary-vs-teaching, outcome keywords without teachability, shallow scientific explanation, weak learner activities, missing expected observations, weak laboratory orientation, safety omissions, weak teacher questioning, untreated misconceptions, generic differentiation, assessment/marking mismatch and weak closure.

The suite is test-only. Expected labels are not injected into normal Critic runtime context.

## J. Adversarial examination

The controlled suite also includes polished scientific falsehood, high activity volume with no learning, correct answer attached to the wrong question, assessment of material not taught, plausible fabricated provenance, contradictory authoritative evidence, an overly harsh style-only trap, proportional simple valid material and a repaired artifact where stale findings must disappear.

## K. Calibration

Certification CI requires 100% controlled-case blocking discrimination, zero false positives, zero false negatives and 100% expected-severity accuracy for the deterministic examination harness. It separately requires P3 to demonstrate unique reasoning cases not expected to be caught by either P1 or P2 alone.

These numbers certify the **baseline examination contract**, not universal real-world model accuracy. Operational human-overturn and production false-positive/false-negative rates remain future telemetry once controlled runtime commissioning begins.

## L. P1 vs P2 vs P3

P1 is author-side prevention and self-detection. It is strongest at evidence discipline, structural requirements, instructional-chain preflight, known scientific/safety blockers and bounded author uncertainty.

P2 is independent deterministic measurement. It supplies the stable 11-dimensional exam, hard blockers, threshold/minima, sealed gold cases, regression comparison and immutable evidence identity.

P3 is independent editorial reasoning. The examination requires unique value on cases such as busy but meaningless activities, question/answer semantic mismatch, assessment of reasoning not taught, weak diagnostic questioning, untreated misconceptions, generic differentiation and weak closure. These require contextual instructional judgment rather than mere presence/score checks.

## M. Remaining weaknesses

This Priority 3 baseline deliberately does not activate the worker in production, deploy the Edge Function, write Critic rows into production, automate Repair, or change publication authority. The current model runtime is bounded but still probabilistic; controlled production commissioning must measure human overturn, real false positives/negatives, latency and cost before wider autonomy. Subject profiles beyond Chemistry require separate governed qualification.

## N. Priority 4 handoff

Priority 4 receives: artifact version, finding ID, affected section/outcome, supporting evidence, required remediation and constraints. Repair produces a **new artifact version**. It cannot mark its own finding resolved. Resolution requires a fresh P3 execution against the new version and continued P2 hard-blocker rules.

## O. GitHub

Priority 3 is implemented on a focused current-main branch and must pass the dedicated Independent Critic Evaluation plus repository protection checks. Exact-current-main freshness and exact-head merge are mandatory. Any main advance requires reconciliation and rerun.

## P. Supabase

Production was inspected read-only. Priority 1 professionalization tables and migrations are already present. Production also contains the existing content quality, publication quality, release approval/check and revision infrastructure. Priority 3 adds a service-only Edge runtime in repository code but deliberately adds **no database migration and performs no production deployment/activation** in this baseline, so it cannot weaken RLS/grants or publication authority.

The runtime itself requires the service-role bearer credential, contains no publication/content mutation path, preserves P2 blockers, does not expose sealed evaluation answers and returns a traceable execution/finding packet for governed persistence/commissioning later.

## Q. Certification rule

Certification is permitted only after the dedicated P3 examination, exact P2 binding, runtime type-check, authority/anti-anchoring checks, repository required checks, current-main reconciliation and exact-head merge all pass. Green CI alone is not sufficient if those semantics fail.

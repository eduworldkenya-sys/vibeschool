# VibeSchool Evidence Engine

**Status:** V1 publication and pilot-measurement contract  
**Owner:** Evidence / Product / School Success  
**Public surface:** `/evidence`

## Objective

VibeSchool must be able to move from a real school problem to a defensible public case study without turning database activity, demo data, testimonials or correlations into stronger claims than the evidence supports.

The engine is therefore a governance and measurement loop:

**Question → baseline → bounded pilot → implementation evidence → outcome evidence → verification → publication permission → public claim → ongoing review / withdrawal**

The default public state is **withhold**.

## Why this exists

Production already contains useful educational evidence domains such as lesson plans, lesson evidence, homework, submissions, assessments and learner-outcome state. Those records can support measurement, but their existence or row counts do not by themselves prove adoption, value or impact.

VibeSchool should be stricter than normal SaaS marketing: product capability, observed use, measured change and causal impact are different evidence classes.

## Claim-strength ladder

1. **Capability** — the product can perform a workflow and the workflow is certified technically.
2. **Observed implementation** — real users used the intended workflow under a defined pilot.
3. **Measured association** — a metric changed from a pre-specified baseline during or after implementation.
4. **Comparative evidence** — the change is compared with a credible counterfactual or comparison group.
5. **Causal claim** — reserved for a design that can reasonably support causal inference.

A public case study must label the actual level. A simple before/after pilot must not be described as proving that VibeSchool caused a learning gain.

## Pilot contract

Before a school pilot starts, record:

- school / deployment scope and authorised owner;
- one primary workflow and one primary decision problem;
- active ingredients that must remain stable during the pilot;
- baseline definition and baseline measurement window;
- pilot start and end window;
- primary and secondary metrics;
- inclusion / exclusion rules;
- device and connectivity conditions that matter;
- support and implementation responsibilities;
- success, stop and escalation thresholds;
- privacy basis and data minimisation plan;
- publication permissions separately from operational/pilot participation permission.

The public 30-day pilot can be a useful default implementation shape, but exact measurement windows must be declared before use rather than retrofitted to produce a favourable result.

## Metric families

### Implementation

- eligible users who successfully complete the intended workflow;
- repeat use across the pilot window;
- implementation fidelity to the agreed workflow;
- training/support events and unresolved blockers.

### Reliability and access

- successful vs failed requests for the pilot workflow;
- Android/browser/device coverage;
- low-bandwidth completion;
- offline recovery where the workflow claims offline resilience;
- time-to-useful-information and task completion latency.

### Teacher workload

- minutes required for the defined task before vs during VibeSchool;
- number of duplicate records or systems touched;
- time from lesson/evidence to next instructional action;
- rework caused by errors, missing data or system failure.

### Educational evidence quality

- proportion of intended curriculum/lesson activity with usable evidence;
- proportion of evidence that can be traced to the relevant teaching/assessment context;
- time from evidence capture to teacher interpretation/action;
- intervention follow-through and subsequent evidence.

### Family / leadership usefulness

- whether the intended question can be answered without chasing another person or spreadsheet;
- comprehension/usability measures with pre-specified questions;
- timeliness and authorised visibility.

### Learner outcomes

Use only when the pilot design and data quality justify an outcome claim. Learning-outcome metrics require an explicit measurement model and must state limitations and confounders.

## Verification gate

A metric is not public until a verifier checks:

- exact metric definition and calculation;
- source lineage and evidence reference;
- measurement window and population;
- missing-data and exclusion treatment;
- baseline comparability;
- whether the strength of language matches the evaluation design;
- known limitations;
- absence of learner/private raw data in the public claim;
- permission scope for any school name, logo, quote or identifiable story.

## Permission model

These permissions are distinct and should never be collapsed:

1. participate in a pilot;
2. process the minimum data required for the pilot;
3. publish aggregate/anonymised results;
4. name the school;
5. use the school logo;
6. attribute a staff quote;
7. use any learner story or identifiable learner material.

A school may grant one and refuse another.

## Public manifest

`config/public-evidence.json` is the public release boundary. CI fails closed. A claim with `status: published` must include:

- metric definition;
- value;
- population;
- measurement window;
- method;
- verification identity, date and evidence reference;
- explicit publication permission and scope;
- limitations;
- source reference.

Raw learner/student/parent/teacher identifiers, email, phone, raw data, credentials or tokens are forbidden in the public manifest.

## Privacy and Kenyan context

The Evidence Engine follows purpose limitation, data minimisation, transparency, data-subject rights and stronger safeguards for minors. Public proof should normally be aggregate and should not require exposing children.

Current reference points reviewed for this contract:

- Kenya Office of the Data Protection Commissioner — data-subject rights and data-protection principles: https://www.odpc.go.ke/rights-of-a-data-subject/
- ODPC guidelines, including education-sector, children's-data, consent, research-purpose and DPIA guidance: https://www.odpc.go.ke/guidelines-2/
- Education Endowment Foundation, A School's Guide to Implementation (Explore → Prepare → Deliver → Sustain): https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/implementation
- UNESCO monitoring/evaluation guidance: https://www.iiep.unesco.org/en/impact/how-we-measure-impact

## Commercial rule

Sales may use only published evidence at the strength stated in the evidence manifest. Internal production activity, unverified pilot observations and private school feedback cannot be converted into public ROI or learning-impact claims.

## Current state

VibeSchool has architectural and operational learning evidence, but production usage is still too sparse and uneven to justify publishing a real-school outcome claim from current row counts alone. The correct next action is to instrument the first bounded school pilot against this contract, not to manufacture a case study.

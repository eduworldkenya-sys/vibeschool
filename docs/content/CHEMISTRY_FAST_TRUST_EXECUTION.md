# Chemistry Fast-Trust Execution Doctrine

Status: proposed Cyborg content-factory execution doctrine for Grade 10 Chemistry

## Purpose

VibeSchool must make content production both faster and more trustworthy. Speed without completeness creates silent omissions. Governance without efficient research/generation creates unacceptable latency. This doctrine requires both.

## Core operating principle

**Parallelize discovery. Generate cheaply. Reuse evidence. Verify independently. Detect omissions explicitly. Never certify what cannot be proven complete.**

The preferred economics are:

`FAST DISCOVERY -> SHARED EVIDENCE PACK -> FAST AUTHORING -> DETERMINISTIC COVERAGE GATES -> INDEPENDENT CRITIC -> TARGETED REPAIR -> FRESH RE-VERIFICATION -> HUMAN RELEASE`

The first draft is disposable. Verification is not.

## Authority hierarchy

External AI/search systems are suppliers, not publishing authorities.

1. Kenyan curriculum / official learning outcomes and approved curriculum sources
2. Approved authoritative scientific and educational references
3. VibeSchool canonical structured source/evidence pack
4. Author candidate
5. Independent quality/critic evidence
6. Human release authority

Perplexity, Google research/search, Gemini, Claude, OpenAI and other models may accelerate discovery, synthesis and drafting, but their outputs are evidence inputs until reconciled against approved authority.

## Separate correctness from completeness

Every publishable Chemistry artifact must expose at least these independent states:

- correctness
- completeness
- source coverage
- pedagogical depth
- assessment coverage
- experiment/safety coverage where applicable
- unresolved contradiction count

A single green badge may not hide an incomplete dimension.

A chapter can be scientifically correct and still fail because required curriculum outcomes, experiments, misconceptions, assessment, teacher prompts or learner activities are missing.

## Explicit incomplete states

Content missions must support non-success states such as:

- `INCOMPLETE_EVIDENCE`
- `SOURCE_CONFLICT`
- `COVERAGE_UNKNOWN`
- `OMISSION_DETECTED`

These are preferable to unsupported completion.

## Canonical Chemistry research pack

Each chapter should converge on one immutable/versioned shared research pack instead of forcing Author, Quality, Critic and Repair to repeatedly rediscover the same subject matter.

Minimum pack sections:

- exact curriculum outcomes
- prerequisite concepts
- key terminology and definitions
- core scientific concepts and explanations
- approved source references and provenance
- common learner misconceptions
- required/valuable experiments and activities
- safety requirements
- expected observations and explanations
- worked examples
- Kenyan/local applications where educationally appropriate
- diagrams/visual requirements
- assessment blueprint
- marking guidance expectations
- differentiation/inclusion considerations
- source conflicts/uncertainties
- pack version, created_at, source hashes and freshness

All downstream workers read the same immutable pack version. A worker may independently challenge the pack and produce a contradiction/omission finding, but must not silently substitute untracked research truth.

## Parallel research

Research should be decomposed into concurrent bounded probes where possible, for example:

- curriculum-outcome probe
- scientific-concept probe
- experiment/safety probe
- misconception probe
- Kenyan-context probe
- assessment probe
- visual/diagram probe

Their results are reconciled into the canonical pack once, with source provenance and conflicts retained.

This avoids sequential research latency and repeated token/API spend across workers.

## Fast authoring

The Author should receive:

- the curriculum contract
- the canonical research pack
- the required chapter structure
- the quality rubric
- exact output schema

The Author should not spend its expensive reasoning budget re-performing broad discovery unless the pack explicitly records a gap.

Use the cheapest sufficiently capable model for drafting. Escalate model cost only when deterministic checks, critic findings or source conflicts justify it.

## Deterministic completeness gate

Before expensive independent review, execute a coverage matrix against the chapter contract.

At minimum check:

- every curriculum outcome is taught, not merely mentioned
- every required concept has instructional treatment
- prerequisites are addressed
- required activities/experiments are present
- expected observations/results are present
- relevant safety is present
- misconceptions are addressed
- teacher questioning/prompts are present
- worked examples/practice are present
- differentiation/inclusion requirements are present
- assessment coverage exists for all outcomes
- marking/answer guidance is present or linked to canonical moderated items
- visual/diagram requirements are satisfied or explicitly tracked
- source-required claims have traceable provenance

Missing mandatory rows block progression and trigger targeted repair rather than a full rewrite.

## Omission-search critic

Independent Critic must answer two distinct questions:

1. Is anything present wrong, misleading, weak or unsafe?
2. What required or expected material is absent?

The second question is mandatory. Critic completion that evaluates only present text is insufficient.

Adversarial prompts/checks should deliberately search for:

- outcomes only named but not taught
- hidden prerequisite gaps
- missing observations/explanations
- missing safety
- shallow learner activities
- missing misconception treatment
- assessment holes
- weak closure/retrieval practice
- missing visual support
- unsupported Kenyan examples
- content that is technically correct but not classroom-ready

## Targeted repair

Repair should receive a machine-readable defect list and patch the smallest affected sections. It should not regenerate the entire chapter unless defect scope proves the structure unsalvageable.

After repair, Quality and Critic evidence affected by the patch becomes stale and must be refreshed.

## Regression learning from omissions

Every verified omission that should have been caught earlier must be considered for a permanent guard:

- validator rule
- checklist row
- sentinel fixture
- adversarial case
- research-pack requirement
- CI/content certification gate

The recent discovery that real entities such as Kianjata Primary and Chemurin Primary can be absent from a supposedly useful school universe is treated as a general completeness lesson: correctness over present records is not evidence that the universe is complete. Content and registry missions must therefore test for absence explicitly rather than infer completeness from successful processing.

## Chemistry execution sequence

Current Grade 10 Chemistry remains the proof vertical. Do not pause Chemistry to build a generalized multi-subject platform.

For each of the seven chapters:

1. establish exact curriculum contract
2. build/reuse immutable research pack
3. run deterministic pack completeness check
4. draft quickly
5. run deterministic chapter coverage matrix
6. Quality review
7. independent omission-search Critic
8. targeted Repair if needed
9. fresh Quality + fresh Critic
10. human release review
11. publish only under existing release authority

## Metrics HQ should expose

Per chapter and mission:

- research time
- research source count
- research-pack cache/reuse rate
- model calls by stage
- input/output tokens
- cost
- deterministic hits
- cache hits
- first-draft latency
- number of missing mandatory coverage rows
- number of critic omissions found
- number of correctness defects
- repair cycles
- total time to release-ready
- correctness state
- completeness state
- source coverage state
- pedagogical depth state

Primary optimization target: reduce repeated discovery and full-regeneration loops without weakening completeness or independent assurance.

## AI-writing quality

The objective is not to disguise AI authorship or defeat detectors. The objective is to eliminate low-quality machine-like output through structure, specificity, evidence and professional editing.

Prefer outcome-specific explanations, worked examples, classroom prompts, experiments, observations, misconceptions and differentiated practice over generic prose. The final artifact should be judged by educational usefulness and provenance rather than whether a detector labels the prose AI-generated.

## Release rule

No chapter may be called complete solely because Author, Quality or Critic returned PASS. Release requires evidence that correctness and completeness have both been tested against the exact curriculum/content contract with no unresolved mandatory omissions or contradictions.

## Immediate implementation recommendation

Do not rebuild the current Chemistry orchestration from scratch. Extend the existing Chemistry mission with these capabilities in this order:

1. canonical versioned research-pack contract
2. deterministic coverage matrix
3. omission-search critic requirement
4. targeted repair semantics
5. research/evidence reuse telemetry
6. HQ visibility for correctness vs completeness
7. later, external research-provider adapters behind the existing vendor-neutral Cyborg gateway

This preserves the current Author -> Quality -> Critic -> Repair -> fresh verification chain while making it faster, cheaper and more skeptical.
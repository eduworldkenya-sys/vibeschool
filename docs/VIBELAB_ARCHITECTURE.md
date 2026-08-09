# VibeLab — Interactive Simulation Layer

Status: architecture baseline for the Form 4 living-edition programme.

## Product definition

VibeLab is the executable-learning layer of Vibeschool. A textbook explains a concept; VibeLab lets a learner manipulate variables, run a safe simulation, collect observations, interpret results and return evidence to the learning flow.

It is not limited to Chemistry and is not a decorative animation library.

## Core learning loop

Concept -> Predict -> Configure -> Run -> Observe -> Measure -> Record -> Explain -> Assess -> Twin evidence

Every lab must declare:
- subject, curriculum framework, grade/form and syllabus concept
- learning outcomes
- simulation model/version
- controllable variables and valid ranges
- observable/measurable outputs
- safety classification
- guided procedure and optional open-investigation mode
- evidence/assessment contract
- accessibility/fallback representation

## Lab families

### Chemistry
- acid/base titration and indicator/pH curves
- reaction rate: concentration, temperature, surface area, catalyst
- solubility/crystallisation curves
- electrolysis/electrochemical cells
- gas preparation/properties where safely simulated
- qualitative analysis decision investigations
- organic reaction/property investigations
- energetics

Chemistry VibeLab must distinguish simulation from a real practical. Dangerous procedures must never be presented as instructions for unsupervised real-world experimentation.

### Physics
- circuits and electrical measurements
- motion/graphs
- moments/equilibrium
- waves/optics
- electromagnetism
- radioactivity/half-life simulations

### Agriculture
- soil-property investigations
- germination/growth experiments
- farm economics/yield scenarios
- livestock/feed decision simulations

### Business Studies
- cash-flow and working-capital scenarios
- pricing/profit/break-even simulations
- national-income/inflation/trade scenarios
- financing decisions

### History & Government
History should use evidence labs rather than fake physical simulation: source comparison, chronology reconstruction, cause/consequence maps, competing interpretations and policy/government decision scenarios.

### Mathematics
Mathematics remains a dedicated Smart Math Engine: symbolic manipulation, graphing, geometry, coordinate construction, transformations, probability/statistics simulations, parameterised questions and step-level checking. It may share the VibeLab shell/evidence contract but not a generic science simulator.

## Architecture

1. `LabDefinition` — immutable authored/curriculum metadata.
2. `LabModel` — deterministic domain model accepting validated inputs and producing outputs.
3. `LabRenderer` — responsive interactive UI; model logic must not live only in presentation components.
4. `LabSession` — learner run, inputs, observations and timestamps.
5. `LabEvidence` — prediction, measurements, interpretation, answers and completion/score signals.
6. `LabAssessment` — deterministic checks where possible; rubric/AI only where judgement is genuinely required.
7. `Twin bridge` — evidence can update learner mastery/misconception state through the existing learning evidence boundary, never directly from UI animation.

## Textbook integration

`interactive` publication blocks should reference a stable VibeLab definition/version rather than duplicating simulator logic inside each chapter. The same lab can therefore be launched from a textbook, lesson, assignment, Twin tutoring session or standalone VibeLab catalogue.

Recommended block contract:

```ts
interface VibeLabBlock {
  type: 'interactive'
  interactiveType: 'vibelab'
  labId: string
  labVersion: string
  mode?: 'guided' | 'investigation' | 'assessment'
  context?: Record<string, unknown>
}
```

Existing interactive presets should be migrated/adapted behind this contract rather than discarded.

## Safety and integrity

- simulation first for hazardous chemistry/physics
- explicit distinction between simulated and measured/real data
- no fabricated claim that a simulation proves a real experimental result
- bounded inputs and deterministic models where scientifically appropriate
- version every model so assessment evidence remains reproducible
- teacher-visible learning purpose, not merely visual engagement
- keyboard/touch accessibility and low-bandwidth fallback

## Delivery order

1. Stabilise canonical `interactive` content-block mapping.
2. Define shared LabDefinition/LabSession/LabEvidence types.
3. Adapt existing titration, reaction-rate, solubility, circuit, motion, moments, soil and germination interactives as VibeLab v1 labs.
4. Add textbook launcher and standalone `/student/vibelab` catalogue.
5. Persist lab sessions/evidence with RLS.
6. Feed completed evidence into Twin mastery state.
7. Add teacher assignment/lesson launch surfaces.
8. Expand subject-specific simulator libraries.
9. Build Smart Math Engine separately on the shared evidence shell.

## Definition of done for a lab

A lab is not complete because it animates. It is complete only when curriculum identity, model correctness, learner controls, observable output, evidence capture, assessment, accessibility, safety and Twin/teacher hand-off have all been verified.

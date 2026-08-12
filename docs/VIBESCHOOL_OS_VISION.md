# VibeSchool OS — Product and Architecture Vision

**Authoritative vision:** See `docs/VIBESCHOOL_MISSION_VISION.md` for the canonical company-level mission and vision.

This document translates that mission and vision into the long-term product and architecture direction of VibeSchool.

## Core product statement

**VibeSchool is the Education Operating System that turns curriculum into coordinated teaching, teaching into evidence, evidence into understanding, and understanding into better decisions for every learner.**

The system exists to connect the work around learning without creating competing versions of educational truth.

## Product architecture

VibeSchool is a connected platform composed of distinct experiences and domain systems that share authoritative educational objects and evidence.

The long-term product surface includes:

- Learner OS
- Teacher OS
- Parent OS
- School OS
- Publisher capabilities
- VibeLearn
- VibeTextbook
- Teaching Objects and Teaching Workspaces
- Derived Learning Assets
- VibeTwin

These are product surfaces within one Education Operating System, not independent products with independent definitions of the learner or curriculum.

## VibeTwin

VibeTwin is the context-aware intelligence layer embedded throughout VibeSchool. It interprets trusted educational evidence, supports adaptation and recommends responsible next actions for learners, teachers, parents and schools.

VibeTwin does not become the authority merely because it is intelligent. Curriculum authority, teacher judgement, school policy, assessment authority and privacy boundaries remain explicit system constraints.

## North-star learning loop

`Authorized learning source → learner context → teaching/learning action → validated evidence → understanding → responsible next decision → improved learning` 

The loop must be explainable and traceable. AI may assist individual stages, but it must not silently invent educational facts or bypass authoritative system state.

## Permanent implementation principles

1. **Design systems, not isolated pages.** A feature is complete only when its domain, data, security, UI and operational consequences are coherent.
2. **One authoritative object per concept.** Do not create parallel representations of curriculum, learners, classes, assignments, evidence or other core educational objects without an explicit authority contract.
3. **Teaching occurrences represent exact dated lessons.** Planned curriculum and actual teaching events must remain distinguishable.
4. **UI components consume shared domain authority.** Presentation must not become an alternative source of truth.
5. **AI supports people but does not fabricate educational reality.** Generated output must remain bounded by authorized context and evidence.
6. **Every learner insight must be traceable to evidence.** The system should distinguish observation, inference, recommendation and verified result.
7. **Curriculum alignment is mandatory.** Personalization can change representation, support, pacing and intervention without silently changing curriculum expectations.
8. **Android, low-bandwidth, offline and printable workflows are first-class.** Real educational conditions are product requirements.
9. **Do not create parallel architectures.** Existing authority must be reused, reconciled or explicitly retired; new systems require a documented architectural reason.
10. **Investigate, produce evidence, implement, verify and document every fix.** A change is not complete because code was written; it is complete when its intended behaviour has been verified.
11. **Security is part of product architecture.** Authentication, authorization, RLS, privacy boundaries and data provenance must be designed with the feature rather than added afterward.
12. **Production is a release boundary.** Development and forensic work should be accumulated and verified before a consolidated release is published.

## Definition of architectural success

VibeSchool succeeds when the platform can answer, reliably and with appropriate evidence:

- What should this learner be learning?
- What was actually taught?
- What has the learner demonstrated?
- What does the evidence support us saying?
- Who is responsible for the next decision?
- What should happen next?
- Why did the system recommend it?
- What authority prevents the system from overstepping?

The architecture exists to make those answers trustworthy, useful and operational.

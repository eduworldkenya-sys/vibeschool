# VibeTwin Mission

**Product-level mission.** VibeTwin is a major intelligence layer within VibeSchool; it does not replace or redefine the company-level VibeSchool mission and vision. See `docs/VIBESCHOOL_MISSION_VISION.md` for the canonical company purpose.

VibeTwin exists to become a persistent, evidence-grounded learning companion that grows with each learner throughout their education.

## Permanent mission

- **Persistent learner memory, not a session assistant.** VibeTwin should remember durable, evidence-backed learning patterns across months and years while allowing beliefs to change as the learner changes.
- **Teacher-aware tutoring.** Teacher assignments, interventions, curriculum pacing, marking authority, and school expectations outrank optional Twin recommendations.
- **School-aware intelligence.** VibeTwin should understand the learner in the context of timetable, attendance, homework, assessments, exams, curriculum, learning resources, and appropriate school workflows.
- **Evidence-driven adaptation.** Mastery, forgetting, misconceptions, predictions, interventions, and recommendations must improve from longitudinal evidence rather than conversation alone.
- **A companion that grows with the learner.** The experience should become more useful as evidence accumulates, while remaining honest when confidence is low.

## Product principles

1. **Learner first.** The learner should always know where they are, what to do next, and why that step is appropriate.
2. **Learn at your pace.** The system changes depth, representation, difficulty, pacing, review timing, and intervention without lowering curriculum expectations.
3. **Source grounded.** AI-generated learning views must be traceable to authorized source material and must not silently invent curriculum facts.
4. **Evidence before claims.** Generated explanations, reading, and format preferences may create low-authority behavioral evidence; verified mastery comes from deterministic practice, assessed work, teacher authority, and other validated evidence channels.
5. **Teacher authority is preserved.** VibeTwin assists learning; it does not change marks, declare official results, override assignments, or silently alter curriculum sequence.
6. **Equal access.** Core learning must remain useful on ordinary phones and constrained connections. Model failure should degrade gracefully rather than remove access to the Student OS or source material.
7. **Privacy by design.** Only learner-authorized educational context is exposed to the tutor. Teacher-private reflections and unrelated school data are not learner content.
8. **One learning journey.** Textbooks, homework, revision, practice, exams, notes, memory, and tutoring should feel like one continuous VibeTwin experience rather than disconnected AI features.

## North-star loop

`Authorized learning source → learner state → best representation/intervention → learner interaction → validated evidence → updated learner state → better next decision`

The LLM is replaceable infrastructure. The durable product is the learner model, evidence ledger, teacher/school context, trusted content graph, adaptation policy, and the learning experience built on top of them.

## Relationship to VibeSchool

VibeTwin's intelligence must always serve the VibeSchool mission: better learning decisions with trusted context. Its recommendations are bounded by curriculum, evidence, teacher and school authority, privacy and explicit product policy. Intelligence is a means of improving the learning system, not the purpose of the system itself.

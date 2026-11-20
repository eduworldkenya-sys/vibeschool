# Universal lesson delivery — owner-approved direction

Issue #1821 is the acceptance ledger; this document is the foundation increment, not a certification of the whole mission.

## Invariants

One curriculum/outcome authority, one lesson-plan authority, one versioned content library, one assessment engine, and canonical teaching occurrences. A lesson plan describes learning intent; the delivery mode determines how the authorized content is presented. No parallel plan database or question bank, no implied access to teacher notes, no inferred mastery from attendance or teaching coverage. Quick Live remains independent; Guided Live is deferred.

## Foundation projection (v1)

`projectLessonDelivery` in `lib/teaching/lessonPlanCodec.ts` returns ordered, stable semantic phase keys scoped to a plan revision, known positive duration or null, teacher text and null learner content. The existing eight tagged sections remain the persisted source. The five instructional phases are projected without changing existing order; resources, homework and differentiation keep their established workflows. Legacy prose is teacher-only, never automatically published. This projection cannot admit a learner or authorize a resource, assessment or occurrence. Teach Mode consumes it while keeping existing lifecycle and storage behavior.

## Required subsequent increments

- Versioned structured steps with stable IDs across edits, explicit curriculum outcome links, actual resource/version pins, admitted learner-facing content references, eligible assessment item IDs, timing, activity and tool recommendations. No IDs fabricated from titles or prose. A teacher edits structure and sequencing without silently rewriting historical versions. One migration/read compatibility policy; do not duplicate persisted authority.
- Preparation for legitimate school, tuition and homeschool contexts. School assignments and exact Scheme authority are preserved. Other contexts must resolve authorized user, learner/group and curriculum identity; no dummy schools, bypassed RLS or fabricated timetable.
- Server-authoritative resumable execution, pinned revision, evidence and occurrence completion; maintain device cache isolation and offline recovery. Explicit attendance, formative response, teaching coverage, formal assessment and mastery distinctions.
- Use existing authorized resource readers and assessment services, never expose raw teacher answers. Add role-specific negative-path tests, transfer/reconnect/idempotency tests, and real signed-in journeys for each supported delivery context.
- Later: Guided Live consumes the same admitted package and occurrence, with independent host controls and explicit learner sharing. No mandatory camera/video; preserve Quick Live.

## Release boundary

The projection increment has no database schema, feature flag, learner-facing or Live changes. No existing records are migrated. Revert the increment if it regresses Teach Mode. Required CI, exact-head freshness, governance checks and signed-in verification precede production claims. Do not close #1821 until the remaining acceptance requirements are verified.

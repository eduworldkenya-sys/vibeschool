# VibeSchool Market Evidence & Positioning Basis — 2026-08-17

Status: internal product / commercial evidence note  
Constitution: `docs/strategy/VIBESCHOOL-MISSION-VISION-LOCK.md`

## Purpose

Record the evidence behind the current public positioning so future marketing work does not drift into imitation, unsupported claims, feature-count competition or stale production assumptions.

This is not a public competitor-comparison page.

## Current market signals

### XULE

Public pages reviewed on 2026-08-17 position XULE primarily as a Kenyan school information-management system and compete strongly on:

- all-module / broad school-management framing;
- highly visible low per-learner pricing;
- guided onboarding and import;
- mobile / Android availability;
- administration, academics, finance and parent access in one system.

Public evidence reviewed:
- https://xule.co.ke/
- https://gaterogirls.xule.cc/pricing

The pricing pages observed during this review included very low per-learner public price anchors. These are competitor claims and should not be copied into VibeSchool public material as comparative claims without a fresh verification.

### Celebra

Public pricing reviewed on 2026-08-17 presents tiered school packages with CBC tools, parent access, senior-school features, analytics and AI-related capabilities.

Evidence reviewed:
- https://www.celebra.school/pricing

### Ministry / KEMIS Senior School selection

The official Grade 10 Selection & Placement system confirms that Pathways, subject combinations and Senior School choice are now consequential public user needs under Kenya's Competency-Based Education transition.

Evidence reviewed:
- https://selection-placement.kemis.go.ke/

## Strategic conclusion

VibeSchool should **not** try to beat established school systems by publishing a longer module list or merely undercutting price.

Those are relatively easy positions for a competitor to match and do not express the VibeSchool mission.

The stronger product territory is:

> **Preserve the educational signal from curriculum intent to the learner's next action.**

That means the differentiating public story is:

**Curriculum → Scheme → Lesson → Teaching → Evidence → Assessment → Understanding → Next action**

with role-appropriate experiences around that same learning state.

## Current production truth snapshot

Read-only production Supabase query performed on 2026-08-17 against project `yauqsxggtuxuykcbrtzf`.

These counts are **engineering state**, not adoption metrics, customer counts or market proof.

| Object | Rows observed |
|---|---:|
| curriculum_learning_outcomes | 402 |
| scheme_of_work | 45 |
| lesson_plans | 9 |
| lesson_evidence | 1 |
| assessment_definitions | 21 |
| assessment_attempts | 0 |
| student_outcome_mastery | 4 |
| parent_learning_summaries | 0 |
| pathways | 3 |
| pathway_tracks | 7 |
| pathway_subject_combinations | 14 |
| pathway_careers | 14 |
| pathway_school_offerings | 1 |

## What this production snapshot means

The platform has real structures and some real state across the connected education chain, but downstream usage is still sparse.

Therefore:

- do not publish row counts as adoption proof;
- do not imply school-scale maturity from schema presence;
- do not claim the evidence → mastery → family-summary loop is already broadly proven;
- do not claim national Pathways/school coverage from the current production snapshot;
- do not treat a working route as equivalent to live-school certification.

## Public claim vocabulary

### Available

An implemented public or product experience exists and is appropriate to inspect now.

### Validation

The capability exists or is integrated, but stronger operational, pilot, coverage or end-to-end proof is still required.

### Planned

Strategic direction only. It must not be sold as a current capability.

## Current public positioning decisions

### Own

- curriculum-to-evidence continuity;
- continuing learner educational state;
- evidence-grounded next action;
- role-appropriate views around one learning journey;
- Pathways connected to learner progression;
- truthful capability-status communication.

### Match where necessary

- mobile usability;
- clear school onboarding path;
- trust/privacy explanations;
- understandable institutional conversion;
- reliable school operations where they support the mission.

### Do not lead with

- feature count;
- lowest-price claims;
- AI volume;
- generic ERP language;
- unsupported customer/adoption numbers;
- invented uptime/support commitments.

## Sales principle

A school conversation should begin with a consequential workflow and an observable problem, not a module catalogue.

Recommended framing:

1. What educational story is currently fragmented?
2. Who needs to act on that story?
3. What evidence is currently lost or manually reconstructed?
4. What authority boundaries apply?
5. What single workflow can VibeSchool prove first?
6. What result would justify expansion?

## Product psychology

A serious school buyer must feel three things before conversion:

1. **Recognition** — “this describes a problem we actually have.”
2. **Control** — “we can start bounded; we are not being forced into a risky replacement.”
3. **Trust** — “the vendor distinguishes what exists from what is still being proven.”

This is why the public website now uses a readiness assessment, role journeys, connected-education explorer, capability status and explicit objections instead of only static claims.

## Revalidation rule

Competitor price, product and adoption claims are time-sensitive. Re-check them before any future commercial decision that materially relies on them.

Production counts are also time-sensitive. Re-query Supabase before using them for internal readiness decisions.

# VibeSchool Canonical Authority Model

## Purpose

This document resolves the P0 authority questions for the current production architecture. It does not create new runtime authority; it names the existing authoritative layers and their boundaries.

## 1. Company mission and vision

**Authority:** `docs/VIBESCHOOL_MISSION_VISION.md`

This is the canonical company-level Mission and Vision. Product, architecture and subsystem documents derive from it.

## 2. Education Operating System architecture

**Authority:** `docs/VIBESCHOOL_OS_VISION.md`

This document translates the canonical Mission and Vision into product and architecture direction. It does not redefine the company purpose.

## 3. VibeTwin architecture

**Authority:** `docs/STUDENT_TWIN_ARCHITECTURE.md`, subordinate to the company Mission/Vision and OS architecture.

VibeTwin is an intelligence/decision subsystem. It may operate autonomously only within explicit autonomy tiers and evidence/authorization gates. It never becomes the system of record merely because it is intelligent.

## 4. Repository authority

**Authority:** Git repository source and its migration history.

The repository is the durable source for application code, migration files, tests, configuration contracts and release evidence. Vercel is a deployment target, not a source of truth. Supabase runtime state must be reconciled against repository migrations before final certification.

The `mission-243-execution` branch is the controlled certification branch for the current mission. It must not be merged to the production branch until the release gates pass.

## 5. Database authority

**Authority:** Supabase production database schema, constraints, RLS policies, grants and RPC implementations, with repository migrations as the reproducible source of intended database state.

Client code may request operations but must not define authorization, publication state, learner identity, durable evidence or financial truth.

Where a table uses `profiles.id` versus `students.id`, the table's FK contract is authoritative. These IDs must not be collapsed merely for conceptual simplicity.

## 6. Publication authority

**Authority:** database publication lifecycle and its prerequisites.

Public content eligibility is determined by the authoritative publication state and parent-child integrity, not by sitemap membership, robots rules, UI visibility, or AI metadata.

Sitemap and AI discovery are downstream projections of publication authority.

## 7. Public discovery authority

**Authority chain:**

`Database publication authority → public reader → canonical URLs → sitemap/robots/llms.txt`

SEO and AI discovery cannot make private or unpublished data public. They can only describe already-authorized public knowledge.

## 8. Learner evidence authority

Authoritative learner evidence remains in the database workflows that create validated learning events, assessment results, progress and other durable evidence. VibeTwin consumes trusted evidence and produces bounded decisions/recommendations; it does not silently rewrite the underlying evidence.

## 9. Conflict resolution rule

When two artifacts disagree:

1. identify the domain owner;
2. inspect the actual production schema/runtime contract;
3. preserve intentional existing authority;
4. repair the lowest layer that owns the truth;
5. update dependent clients/documentation;
6. execute tests;
7. record evidence.

No UI or AI layer may be promoted to authority merely because it is easier to change.

## 10. Release boundary

Development, forensic fixes and evidence accumulation happen on the certification branch. Production deployment is a final boundary: one consolidated release only after P0–P8 certification.

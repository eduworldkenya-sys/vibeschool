---
name: vibeschool-curriculum-content
description: Protect VibeSchool curriculum authority, content provenance, exact mapping, quality and publishing boundaries.
---
# Curriculum and Content
Use exact canonical curriculum identity and source authority. Never promote fuzzy/title/embedding similarity into an authoritative mapping. Track provenance, source version, verification state, outcome/topic binding, resource version and publication lifecycle. Creator-claimed content is not official authority. Require independent quality/review evidence where risk warrants it, invalidate stale derived artifacts when source/version changes, and keep publishing explicitly governed. Teacher/student derivatives must trace back to the same canonical learning asset rather than diverging copies.

## Mandatory pre-generation KICD reconciliation

**Before writing any VibeSchool learner or teacher content, the chat must inspect both** the latest applicable official KICD design and the current VibeSchool canonical curriculum (repository and persisted records where accessible). Compare the requested grade/subject/scope **outcome by outcome**, including strands, sub-strands, learning requirements, progression, inquiry/activities, competencies, values, relevant PCIs, assessment expectations and allocations. Record each KICD source locator and its matching VibeSchool stable curriculum ID.

**If they do not match, repair VibeSchool's canonical curriculum first** through the authorized existing source of truth, then recheck source coverage and Scheme/outcome links. Preserve source identity, teacher-owned data and VibeSchool-original text rather than copying KICD wholesale. **Do not proceed to writing notes, examples, exercises, questions or guides until the reconciled scope passes**; when a source is inaccessible or a mismatch remains, report `BLOCKED_CURRICULUM_RECONCILIATION` instead of inventing a match, skipping the step or asserting a completed subject. A reconciled curriculum is **not** the same as published content.

The required procedure and evidence ledger are in [Content Operating Model Step 2A](../../../docs/curriculum/CONTENT_OPERATING_MODEL.md#step-2a--mandatory-kicd--vibeschool-curriculum-reconciliation-gate-before-authoring) and [Content Package Template §1A](../../../docs/curriculum/CONTENT_PACKAGE_TEMPLATE.md#1a-required-kicd--vibeschool-reconciliation-gate--before-any-new-content).

## Mandatory runtime identity gate (P0)

For platform-authored packages, a manuscript alias is **not** a curriculum ID. Resolve every alias to one or more existing active `curriculum_learning_outcomes.id` UUIDs in its exact `cbc_strands.id` scope, while recording the official document URL, edition, printed section/page and requirement code. Existing UUIDs and teacher scheme references are immutable identities; add a new outcome only when the verified source contains a genuinely missing requirement. Do not declare an AI comparison to be an independent KICD approval.

The machine-enforced record is `vs_curriculum_package_scopes` → `vs_curriculum_source_requirements` → `vs_curriculum_manuscript_aliases` → `vs_curriculum_alias_outcomes`, with per-lesson links in `vs_curriculum_resource_aliases`. Every new promoted platform-authored resource version needs `provenance.package_id` and `payload.curriculum_outcome_aliases` exactly matching its canonical resource aliases. The database promotion trigger rejects missing, stale, cross-scope or unresolved data; readers of a controlled package also fail closed. Never bypass the gate by rewriting certified versions or by changing their owner/source classification.

Grade 4 Mathematics 2.6 Time is the first migrated package. Run `npm run test:curriculum-identity` and query `vs_curriculum_package_gate(package_id)` as a privileged database operator before promoting new resources. Other unreconciled packages must remain blocked from **new** canonical promotion until their source requirements and stable IDs have been populated.

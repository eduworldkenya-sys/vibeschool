# P0 — Outcome Package Assembly Contract (v1)

**Authority:** Existing `learning_resources` roots, immutable `learning_resource_versions` payloads, `curriculum_learning_outcomes`, `content_block_outcome_links`, and `assessment_questions`. This is **not** a parallel library, content renderer, approval lane, or question bank.

## Identity and storage

- One stable `learning_resources` root per canonical outcome/package identity, with `asset_kind='outcome_package'`, `owner_type='platform'`, `source_type='platform_authored' | 'platform_generated'`, and non-null `curriculum_outcome_id` FK.
- Generate its existing `canonical_key` via `buildCanonicalLearningAssetIdentity`: use the actual curriculum, subject, grade and stable outcome ID, `assetKind:'outcome_package'`, `purpose:'reference'`. Never use KICD heading text or a manuscript alias as an ID.
- Each `learning_resource_versions.payload` is a **complete immutable manifest snapshot**. Use the existing candidate → verified → certified authority and SHA-256/version lineage. Do not edit a certified manifest in place; retire/supersede it under existing governance.
- Every asset entry pins **both** its `learning_resources.id` and exact `learning_resource_versions.id`. No display names, mutable latest-version pointers or generated placeholder UUIDs.
- The *only* additive column is `learning_resources.curriculum_outcome_id` (nullable for legacy roots, mandatory for package roots). The existing asset-kind check gains `outcome_package`. No new content, resource-link, question, or release table is introduced.

## Canonical JSON payload

```json
{
  "schema": "vibeschool.outcome-package.v1",
  "outcome_id": "<existing curriculum_learning_outcomes.id>",
  "requirements": {
    "teacher_guidance": false,
    "visual_assets": false
  },
  "assets": {
    "core": [{ "resource_id": "<id>", "resource_version_id": "<id>" }],
    "activities": [],
    "revision": [],
    "teacher_guidance": [],
    "visual_assets": []
  },
  "question_ids": {
    "activities": [],
    "revision": []
  },
  "release": {
    "core": "draft",
    "activities": "draft",
    "revision": "draft"
  }
}
```

The `<> ` placeholders above are examples only and **must never be submitted to the database**. Use the typed `buildOutcomePackageManifest()` assembler in `lib/content/outcomePackageManifest.ts`. Every array key must be present, even when empty.

**Educational applicability:** Teacher guidance and visual assets are *optional unless needed for this outcome*. Set the corresponding requirement flag `true` when needed; missing mandatory assets block release. Activity and revision arrays may be empty during drafting. An activity or revision experience may rely on approved canonical question IDs rather than separate resource versions. An empty experience stays `incomplete` and `draft`, never silently fabricated.

## Independent experiences

| Experience | Complete when | Release states |
| --- | --- | --- |
| Core | Exactly one accessible, certified core unit is pinned; required shared guidance/visuals are present and certified | `draft → ready → released` |
| Activities | At least one certified practice asset **or** approved, confirmed, outcome-linked question is present; required shared assets pass | `draft → ready → released` |
| Revision | At least one certified revision asset **or** approved, confirmed, outcome-linked question is present; required shared assets pass | `draft → ready → released` |

The manifest tracks the **release state independently per experience**. The database `cla_audit_outcome_package(resource_id,manifest)` computes **completeness independently** from real referenced rows. It does not trust a manually supplied `complete` flag.

The audit checks:
1. Bound stable outcome ID and reconciled source authority (`status='verified'`, verification timestamp, source import ID and official source locator).
2. Correct shape, typed UUIDs, role-specific asset kinds, exact version→root pairing, absence of duplicate pins, and provable outcome linkage via `curriculum_outcome_id` or the existing `content_block_outcome_links` relation.
3. Assets are `certified`, `active`, `public`, platform-owned when an experience claims ready/released. Drafts may pin candidates but stay incomplete.
4. Every question ID exists in the **existing** `assessment_questions` bank, is platform-scoped, matches this exact learning outcome, and is `status='confirmed'` with `review_status='approved'` before it counts as complete.
5. Independent release gates for Core, Activities, Revision. `ready` or `released` is rejected unless that experience is complete **and** the curriculum authority is reconciled.

**Note:** `release='released'` is a package-level declaration that can be relied upon **only after the package version itself is certified**, its root is active/visible, and an authorized consumer checks that specific experience's audit. The manifest is not a shortcut around existing asset visibility or RLS. Consumers must never infer learner-visible publication from the raw JSON flag, a `candidate` version, or an incomplete audit.

## Workflow for content-production chats

1. Complete the earlier **P0 source-to-database curriculum reconciliation**. Resolve aliases to actual `curriculum_learning_outcomes.id`. Do not start content release on an unresolved outcome.
2. Create/reuse canonical component roots and exact versions, using the existing library and links. Add direct `curriculum_outcome_id` on new component roots where available, or use verified existing content-block outcome links. Do not duplicate questions.
3. Assemble one manifest using `buildOutcomePackageManifest`. Start all three experiences as drafts. Declare genuine required guidance and visual aids rather than assuming they exist.
4. Invoke `cla_audit_outcome_package` using a trusted service role in the production pipeline, review all issues and per-experience completeness. The version-write trigger also rejects malformed manifests and false release claims even if the caller omits preflight.
5. Promote versions through the **existing** verification/certification authorities. Track which experience is ready/released; use a new version for subsequent changes to immutable release intent. Preserve historical delivery pins and certification evidence.
6. Before showing content to teachers or learners, confirm the certified package version, user access, `audit.valid`, and `experiences[requested].release='released'`. Resolve only that experience's assets/question IDs through their existing authorized readers and question-bank paths.
7. Report content completeness, certification, and actual teacher/learner visibility as **three distinct evidence states**. A migrated schema or certified manifest does not prove app integration or a working student session.

## Verification / rollout

- `scripts/sql/outcome_package_manifest_verify.sql`: rollback-only fixture proving independent Core release, draft Activities/Revision, missing-version rejection, wrong-kind/duplicate rejection, required-visual blocking, unapproved-question blocking, approved-question readiness and trigger enforcement. It also verifies browser roles cannot call the raw audit function.
- `npm run test:outcome-packages`: typed builder, optional sections, UUID/duplicate checks, and canonical identity regression.
- The migration is additive, non-activating and leaves existing records unchanged. Apply through the normal, controlled Supabase migration pipeline **after merge**; verify deployment and the consumer route separately. Do not claim a live package because the migration exists.

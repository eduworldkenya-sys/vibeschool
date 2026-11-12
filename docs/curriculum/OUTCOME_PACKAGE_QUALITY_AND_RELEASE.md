# P1 — Outcome-package quality and certification gate

**Scope:** Only new canonical `learning_resources.asset_kind='outcome_package'` versions. No new publishing engine, content authority, human-review table, certification status, automatic approval, student attempt or teacher assignment.

## Authority and state transitions

The existing `learning_resource_versions` lifecycle remains **candidate → verified → certified → retired**. The service verification RPC (`cla_verify_learning_resource_candidate`) records QA evidence without approving anything. The authenticated platform owner alone invokes the existing `cla_certify_learning_resource_version` RPC. The `cla_require_outcome_package_quality` trigger blocks a failing transition to `certified`, even if a privileged database operator attempts a direct lifecycle update. No package may skip `verified`. No package is certified by this migration.

The P0 manifest (`vibeschool.outcome-package.v1`) and the P0 KICD reconciliation ledgers remain the curriculum and package identity authorities. Each Core, Activities and Revision state remains independently `draft`, `ready` or `released`; **a declaration is not publication** until the exact package version is certified and the existing authorized reader verifies the requested experience.

## Gate matrix

| Gate | Deterministic database proof | Additional recorded evidence |
| --- | --- | --- |
| Curriculum match | Exact outcome FK, source-to-database reconciliation `PASS`, exact alias crosswalk, official source locator and canonical scope; no fabricated legacy `verified` metadata | Source comparison, evidence reference and method |
| Mathematical correctness | Identifies Mathematics packages; ensures a pinned core has structured worked steps when seeking release | Explicit arithmetic/model checking method and evidence reference; **database cannot prove mathematical truth from prose** |
| Worked steps | At least two actual ordered steps in structured `worked.steps`, `worked_steps` or `worked_examples[].steps` of a certified core | Worked-step QA method and evidence reference; non-Maths omission requires a genuine outcome-specific explanation |
| Answer keys | Each included bank question is outcome-bound, platform-scoped, confirmed/approved, has recorded reviewer identity/time, an answer or rubric, and an explanation or rubric | Answer audit method and evidence reference |
| Teacher usefulness | Manifest requires teacher guidance when applicable; all linked versions must be certified | Teaching feasibility, misconception support, feedback and adaptation review reference; no compulsory timetable or class |
| Rights | Package and every pinned version must be cleared/not applicable; immutable versions remain intact | Originality/licensing basis reference |
| Accessibility | Each pinned visual requires visual-library schema, meaningful alt text/caption, typed labels/placements, canonical storage path | Text, language, contrast/reading support and nonvisual alternative check reference |
| Cross-surface | Same reconciled outcome and exact canonical version pins; no fabricated reader linkage | `learner_reader`, `teacher_tools`, and (when Activities/Revision seek release) `practice` reproducible test references, all explicitly passing |

**Evidence is a gate, not a magical validator.** A string saying “pass” cannot prove a mathematical explanation is correct, that a licence is lawful, or that a browser actually works. The operator must conduct the applicable checks, retain independently reproducible references, and refuse certification where evidence is absent or inconclusive. The database independently enforces linkage, rights, structural worked steps, answer material, metadata, content SHA-256 and release completeness. The remaining educational judgements are *attested quality checks*, not assertions of machine-verifiable fact.

## Verification evidence (exact package version)

Supply the following in the **existing** `learning_resource_versions.verification_evidence` when the service-only verification RPC moves a candidate to `verified`. The `content_sha256` must equal the database version's actual SHA-256. This example is a **shape only**, not a certification or real review.

```json
{
  "package_quality_v1": {
    "policy": "outcome-package-quality-v1",
    "content_sha256": "<exact computed package payload SHA-256>",
    "source_package_id": "<actual reconciled P0 curriculum package ID>",
    "reviewer_kind": "ai_assisted_operator",
    "independent_human_review": false,
    "checks": {
      "curriculum_match": {"status": "pass", "method": "<how compared>", "evidence_ref": "<actual source/result reference>"},
      "mathematical_correctness": {"status": "pass", "method": "<how calculations were checked>", "evidence_ref": "<checked calculations>"},
      "worked_steps": {"status": "pass", "method": "<how steps and explanations were checked>", "evidence_ref": "<checked example IDs>"},
      "answer_keys": {"status": "pass", "method": "<how answer keys were checked>", "evidence_ref": "<question/result IDs>"},
      "teacher_usefulness": {"status": "pass", "method": "<how teaching support was tested>", "evidence_ref": "<teacher evidence>"},
      "rights": {"status": "pass", "method": "<how rights were checked>", "evidence_ref": "<rights evidence>"},
      "accessibility": {"status": "pass", "method": "<how accessibility was checked>", "evidence_ref": "<accessibility results>"},
      "cross_surface_links": {"status": "pass", "method": "<how exact links were checked>", "evidence_ref": "<integration results>"}
    },
    "delivery_tests": {
      "learner_reader": {"status": "pass", "evidence_ref": "<actual test run>"},
      "teacher_tools": {"status": "pass", "evidence_ref": "<actual test run>"},
      "practice": {"status": "pass", "evidence_ref": "<actual test run, only when Activities or Revision release>"}
    }
  }
}
```

For non-mathematical outcomes only, `mathematical_correctness` and `worked_steps` may use `{"status":"not_applicable","reason":"<outcome-specific rationale of at least twelve characters>"}`. Every other check must be passed with a meaningful method and evidence reference. **Do not invent a human name, reviewer timestamp, KICD sign-off, test run or student learning result.** The package-quality record always sets `independent_human_review=false`; true is rejected in certification evidence. The existing platform-owner certification lane is a separate explicit action, not a claim of independent human validation.

## Release and integration rules

1. Start the package with all three experiences as drafts. Verify the KICD ↔ canonical curriculum mapping and attach real versions/questions, not placeholder IDs.
2. Reuse the canonical asset intake, visual library and question-bank review; record correct answer/rubric and short explanation for every linked released question.
3. Collect documented content QA and actual cross-surface test evidence for each intended ready/released experience. Use the learner reader independently of class assignment; use Teacher Curriculum Map → Scheme → Lesson Notes / Guide / Exercise without requiring a timetable.
4. Verify the candidate through `cla_verify_learning_resource_candidate` with *accurately attributed* quality evidence. A second qualified reviewer can be sought separately, but this pipeline must not backfill that person's approval without their action.
5. Run `cla_outcome_package_quality_gate(root_id,manifest,sha,rights_status,verification_evidence)` from a trusted service session. Check `state=PASS` and inspect `blockers`. The trigger repeats the same check during the existing certification transition.
6. Only the owner may request certification through the existing RPC. Never set `lifecycle_status='certified'` as a substitute for owner authorization. Consumers still resolve the exact certified version and check each experience's independent release flag and normal RLS.
7. If one experience is incomplete, leave it in `draft`; certify only when at least one genuine ready/released experience passes every applicable check. Build a new immutable version to change release intentions.

## Verification and deployment

- Source-readiness compatibility migration: `supabase/migrations/20261112114500_align_outcome_manifest_source_gate.sql`. Grade 4 Time has nine stable `active` outcome IDs mapped to seven official requirements, but those records do not have the unrelated legacy `verified_at` / `source_import_id` fields. The original P0 manifest audit required those fields and could not recognize Time's otherwise passing source crosswalk. This migration **replaces the same canonical audit function in place**, requiring `vs_curriculum_package_gate(...).state='PASS'` for the exact stable outcome instead. It does not modify outcome status, fabricate a reviewer, or alter a source ledger.
- P1 quality gate migration: `supabase/migrations/20261112115000_outcome_package_quality_gate.sql`.
- Rollback-only SQL: `scripts/sql/outcome_package_quality_verify.sql`, run after both migrations on a database with an outcome tied to a P0 `PASS` reconciliation. This test deliberately rolls back all changes. It covers valid Core readiness plus missing/stale quality evidence, misaligned source IDs/aliases, inaccessible diagrams, missing cross-surface tests, skipped verification and fake human-review claims.
- Static contract: `npm run test:package-quality` (also part of `test:outcome-packages`).
- Before actual production commissioning: run the full migration chain, SQL adversarial fixture and production security/access audit, validate real reading/teaching/practice routes with usable accounts, ensure every evidence reference actually exists, and obtain an explicit owner certification. Merging this code does **not** apply a migration, release a package or validate a production browser session.

**Compatibility:** Legacy/non-package resources and historically certified versions stay unchanged. An active canonical root alone remains insufficient for learner delivery. No new question engine, teacher timetable dependency, duplicate publishing approval or implicit human-review approval is introduced.

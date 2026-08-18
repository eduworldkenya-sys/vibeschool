# Content Factory handover

## Objective

Make VibeSchool's existing Content Engine operate as a publishing factory: detect release blockers, perform safe deterministic preparation/structural repair, send only genuine editorial/release decisions to humans, recertify, and repeat. Content quality gates remain authoritative; this work must not weaken release standards to increase throughput.

## Branch

`agent/content-factory-orchestration`

Base: `main` at `39cd68f23fbd92da9c3241791948b4f2ba385e24`.

Vercel rule: do not intentionally trigger intermediate deployments. Keep implementation off the branch ref until the coherent patch is ready, then update the branch once for CI/PR certification.

Supabase production: `yauqsxggtuxuykcbrtzf`. Production investigation for this wave was read-only. Do not apply the migration until repository/disposable-database verification is complete.

## Production findings

- 704 Content Engine orchestration runs inspected: 688 blocked, 16 completed.
- Dominant blocker is `release_gate_failed`; the engine detects quality failures far more often than it closes them.
- Release certification is doing useful work and must remain strict. Major current failure classes include teacher guides, assessments, assessable blocks, chapter depth, canonical resources, interactivity, and some curriculum/research gaps.
- Publishing HQ already has review queues and approval RPCs. The missing layer is safe preparation/remediation throughput, not another CMS.
- The workforce bus often converts content work directly into `decision_required`; its safe queue is principally `internal_review_only`, so it does not execute domain-specific publishing preparation.

## P0 defects found

1. `ce_prepare_release_repair_drafts` exists in production but is not connected to the governed publication-intelligence loop.
2. Its existing depth brief contains the cross-subject phrase `worked biological reasoning`; this is inappropriate outside Biology.
3. `hq_apply_approved_chapter_revision` references non-existent `content_blocks.metadata`.
4. The same RPC writes directly to `content_blocks`, although `vibe_chapters.blocks` is canonical and an existing trigger rebuilds `content_blocks` whenever chapter blocks change. A later reconcile could therefore erase direct-only block writes.
5. The release gate has blocker classes without a complete remediation/work path, causing repeated blocked orchestration rather than a closure loop.

## Patch contract

Migration: `20260818114500_content_factory_throughput_closure.sql`

The patch introduces or replaces:

- `ce_release_remediation_policy` — deterministic mapping from release checks to work lanes and authority mode.
- `ce_plan_release_remediation` — turns unresolved release failures into idempotent HQ remediation work.
- `ce_repair_release_structure` — safely reconciles canonical chapter blocks, chapter learning resources, and block resources.
- `ce_prepare_source_grounded_teacher_guides` — creates reviewable teacher-guide drafts from existing chapter content/outcomes without inventing new factual claims.
- `ce_prepare_release_repair_drafts` — subject-neutral repair preparation connected to release checks.
- `hq_apply_approved_chapter_revision` — applies approved revisions to canonical `vibe_chapters.blocks`, captures a revision snapshot, lets existing triggers rebuild `content_blocks`, resyncs resources, and recertifies.
- `run_governed_publication_intelligence` — now calls the repair/preparation layer and HQ sync before declaring a run blocked/completed.

Human authority remains required for factual/editorial approval, rights exceptions, VibeLab functional release, assessment moderation, and publication release. Structural reconciliation and preparation may be deterministic and automatic.

## Verification

`content_factory_throughput_verify.sql` asserts the critical contracts after migration, including canonical chapter authority, removal of the invalid metadata-column dependency, absence of biology-specific cross-subject repair wording, orchestration connectivity, and restricted internal RPC execution.

The local environment did not have Supabase CLI or a PostgreSQL parser available. An attempted parser installation failed because the runtime has no external package-network access. Therefore parser/disposable-database execution remains a mandatory CI/branch gate before production application.

## Next action

Run the migration and verification script against disposable/local Supabase in CI. If clean, inspect the diff/security grants, open a draft PR, and only then consider controlled production migration followed by read-only throughput comparison. Do not weaken release checks to make blocked counts fall.

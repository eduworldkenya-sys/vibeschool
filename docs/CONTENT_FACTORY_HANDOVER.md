# Content Factory handover

## Objective

Make VibeSchool's existing Content Engine operate as a publishing factory: detect release blockers, perform safe deterministic preparation/structural repair, send only genuine editorial/release decisions to humans, recertify, and repeat. Content quality gates remain authoritative; this work must not weaken release standards to increase throughput.

## Branch

`agent/content-factory-orchestration`

Original base: `39cd68f23fbd92da9c3241791948b4f2ba385e24`. Reconciled base: current `main` at `143c62cb78594c56fb8620144ee7c2f374b003b8` after Worker Engine R1.4 production-promotion work merged.

Vercel rule: avoid intentional intermediate deployments. Branch updates are reserved for coherent certification points.

Supabase production: `yauqsxggtuxuykcbrtzf`. Production investigation for this wave is read-only until repository/disposable-database verification and merge authority are complete.

## Production findings

- 704 Content Engine orchestration runs inspected: 688 blocked, 16 completed.
- Dominant blocker is `release_gate_failed`; the engine detects quality failures far more often than it closes them.
- Release certification is doing useful work and must remain strict. Major failure classes include teacher guides, assessments, assessable blocks, chapter depth, canonical resources, interactivity, and curriculum/research gaps.
- Publishing HQ already has review queues and approval RPCs. The missing layer is safe preparation/remediation throughput, not another CMS.
- The workforce bus often converts content work directly into `decision_required`; it does not execute enough domain-specific publishing preparation.

## P0 defects found

1. Repair preparation was not connected to the governed publication-intelligence loop.
2. Existing depth repair contained the cross-subject phrase `worked biological reasoning`.
3. `hq_apply_approved_chapter_revision` referenced non-existent `content_blocks.metadata`.
4. The same RPC wrote directly to derived `content_blocks`, although `vibe_chapters.blocks` is canonical and existing triggers rebuild structured blocks.
5. Release blocker classes lacked a complete remediation/work path, causing repeated blocked orchestration rather than closure.

## Patch contract

Migration: `20260818114500_content_factory_throughput_closure.sql`

- `ce_release_remediation_policy` maps release checks to work lanes and authority mode.
- `ce_plan_release_remediation` creates idempotent HQ remediation work.
- `ce_repair_release_structure` reconciles canonical chapter blocks and learning resources.
- `ce_prepare_source_grounded_teacher_guides` creates reviewable teacher-guide drafts from existing chapter content/outcomes without new factual claims.
- `ce_prepare_release_repair_drafts` provides subject-neutral repair preparation.
- `hq_apply_approved_chapter_revision` applies approved revisions to canonical `vibe_chapters.blocks`, snapshots revisions, lets existing triggers rebuild `content_blocks`, resyncs resources, and recertifies.
- `run_governed_publication_intelligence` invokes preparation and HQ sync before deciding blocked/completed.

Human authority remains required for factual/editorial approval, rights exceptions, VibeLab functional release, assessment moderation, and publication release. Structural reconciliation and source-grounded preparation may be deterministic and automatic.

## Certification

The exact pre-reconciliation Content Factory head `84220b323cc0ce1bd9f2e0041b9013aea27090f1` passed all observed PR checks, including Content Factory Throughput Contract, TBL-011 isolated clean rebuild, Supabase Migration Security Contract, TypeScript/Production Build, CI Production Build, Auth & Onboarding Hardening, and TBL-012.

Because `main` subsequently advanced through Worker Engine R1.4, this branch was rebuilt on current main with only the four Content Factory files. The reconciled exact head must pass the same checks before merge.

Production Supabase remains unmodified by this Content Factory wave. After merge, promote only the certified migration through a controlled ledger-aligned production path, then compare orchestration throughput read-only. Do not weaken release checks to reduce blocked counts.

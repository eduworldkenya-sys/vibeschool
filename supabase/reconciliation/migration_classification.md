# Migration Classification — TBL-002

Machine-readable source of truth: `supabase/reconciliation/migration_classification.json`.
Validated by: `scripts/validate-migration-classification.py`.

This document and its JSON counterpart are read-only reconciliation artifacts. 
They do not modify Supabase, do not repair the migration ledger, and do not contain or apply SQL.

## Sources

- Repository: `eduworldkenya-sys/vibeschool` (current GitHub main, as provided in uploaded repository snapshot)
- Local migrations: scanned directly from `supabase/migrations/*.sql`
- Live ledger: Supabase project `yauqsxggtuxuykcbrtzf`, read via `Supabase:list_migrations`, snapshot captured this session (2026-07-20T00:00:00Z)

## Method

Local migrations were scanned directly from supabase/migrations/. Live migrations were read via Supabase:list_migrations against project yauqsxggtuxuykcbrtzf and embedded as a snapshot (see live_ledger_snapshot below) so the validator can check classification completeness without further Supabase access. Matching between local and live is by version key (and, informationally, by name). No live migration SQL body was fetched, diffed, executed, or repaired. No Supabase writes were made.

## Counts

| Metric | Count |
|---|---|
| Local migrations on disk | 60 |
| Live ledger versions (snapshot) | 72 |
| Matched (same version, local + live) | 58 |
| Local-only (repo file, no live version) | 2 |
| Live-only (live version, no repo file) | 14 |
| Documented-only (referenced in docs, exist nowhere) | 2 |
| Historical pseudo-entry (non-version, undocumented removal) | 1 |
| **Total classification entries** | **77** |

## Allowed classification values

- `PARITY_APPLIED`
- `SYNTHETIC_BASELINE`
- `PENDING_DEPLOYMENT`
- `HISTORICAL_PLACEHOLDER`
- `MISSING_REPO_SOURCE`
- `STALE_REPO_ONLY`
- `UNEXPECTED_LIVE_ONLY`
- `NAME_MISMATCH`
- `DUPLICATE_LOCAL_VERSION`

## Classification breakdown

| Classification | Count |
|---|---|
| `PARITY_APPLIED` | 56 |
| `SYNTHETIC_BASELINE` | 1 |
| `PENDING_DEPLOYMENT` | 0 |
| `HISTORICAL_PLACEHOLDER` | 4 |
| `MISSING_REPO_SOURCE` | 13 |
| `STALE_REPO_ONLY` | 1 |
| `UNEXPECTED_LIVE_ONLY` | 0 |
| `NAME_MISMATCH` | 2 |
| `DUPLICATE_LOCAL_VERSION` | 0 |

## Required known entries

Per HANDOVER.md TBL-002 scope, the classification must explicitly account for each of the following. Each is present in `required_known_entries` in the JSON and validated to reference real entries below.

- **live-only-14** — All 14 live ledger versions with no same-version repository migration file (corrected 2026-07-20 count, per HANDOVER.md).
  - Versions: `20260520000000`, `20260717220005`, `20260718062000`, `20260718082408`, `20260718141521`, `20260718184230`, `20260719132810`, `20260720142114`, `20260720143830`, `20260720143840`, `20260720143847`, `20260720143903`, `20260720143912`, `20260720200607`
- **stale-repo-only-20260711150000** — Repository-only version 20260711150000.
  - Versions: `20260711150000`
- **historical-assessments-removal** — Historical, undocumented removal of assessments and assessment_scores.
  - Versions: `HISTORICAL:assessments_and_assessment_scores_removal`
- **fix18e-historical-placeholders** — Historical fix18e placeholder migrations superseded by later versions.
  - Versions: `20260719045935`, `20260719083738`
- **synthetic-baseline** — Synthetic baseline migration(s).
  - Versions: `20260520000000`
- **core-link-constraints-20260719160000** — Documented-only version 20260719160000_core_link_constraints.sql.
  - Versions: `20260719160000`
- **qualify-scheme-id-20260720120000** — Documented-only intended version 20260720120000_fix18e_d_qualify_scheme_id.sql.
  - Versions: `20260720120000`

## Full entry table

| Version | Kind | Local file | Live name | Classification | Follow-up required? |
|---|---|---|---|---|---|
| `20260520000000` | live_only | — | timetable_foundation_baseline | `SYNTHETIC_BASELINE` | Yes |
| `20260521083057` | matched | 20260521083057_report_schedules.sql | report_schedules | `PARITY_APPLIED` | No |
| `20260521083115` | matched | 20260521083115_report_comparisons.sql | report_comparisons | `PARITY_APPLIED` | No |
| `20260521204108` | matched | 20260521204108_funhub_schema.sql | funhub_schema | `PARITY_APPLIED` | No |
| `20260523` | matched | 20260523_class_groups.sql | class_groups | `PARITY_APPLIED` | No |
| `20260523000001` | matched | 20260523000001_funhub_questions_seed.sql | funhub_questions_seed | `PARITY_APPLIED` | No |
| `20260525210349` | matched | 20260525210349_add_timetable_slot_id_to_lesson_plans.sql | add_timetable_slot_id_to_lesson_plans | `PARITY_APPLIED` | No |
| `20260531` | matched | 20260531_claim_codes_role.sql | claim_codes_role | `PARITY_APPLIED` | No |
| `20260531120000` | matched | 20260531120000_twin_schema.sql | twin_schema | `PARITY_APPLIED` | No |
| `20260619` | matched | 20260619_vibeexam.sql | vibeexam | `PARITY_APPLIED` | No |
| `20260619000001` | matched | 20260619000001_learn_schema.sql | learn_schema | `PARITY_APPLIED` | No |
| `20260624` | matched | 20260624_tpad_standards_5_8.sql | tpad_standards_5_8 | `PARITY_APPLIED` | No |
| `20260626100000` | matched | 20260626100000_fix_teacher_onboarding_trigger.sql | fix_teacher_onboarding_trigger | `PARITY_APPLIED` | No |
| `20260626110000` | matched | 20260626110000_onboard_teacher_class_rpc.sql | onboard_teacher_class_rpc | `PARITY_APPLIED` | No |
| `20260626120000` | matched | 20260626120000_academic_terms_unique_constraint.sql | academic_terms_unique_constraint | `PARITY_APPLIED` | No |
| `20260630` | matched | 20260630_get_unread_thread_count.sql | get_unread_thread_count | `PARITY_APPLIED` | No |
| `20260701130000` | matched | 20260701130000_lesson_evidence_homework_sync.sql | lesson_evidence_homework_sync | `PARITY_APPLIED` | No |
| `20260701140000` | matched | 20260701140000_lesson_evidence_bucket.sql | lesson_evidence_bucket | `PARITY_APPLIED` | No |
| `20260705150000` | matched | 20260705150000_term_weeks.sql | term_weeks | `PARITY_APPLIED` | No |
| `20260705160000` | matched | 20260705160000_teacher_os_graph_fixes.sql | teacher_os_graph_fixes | `PARITY_APPLIED` | No |
| `20260705180000` | matched | 20260705180000_teacher_active_weeks.sql | teacher_active_weeks | `PARITY_APPLIED` | No |
| `20260707120000` | matched | 20260707120000_dedup_lesson_plan_autorows.sql | dedup_lesson_plan_autorows | `PARITY_APPLIED` | No |
| `20260708120000` | matched | 20260708120000_merge_assessment_concepts.sql | merge_assessment_concepts | `PARITY_APPLIED` | No |
| `20260708130000` | matched | 20260708130000_exercise_submissions.sql | exercise_submissions | `PARITY_APPLIED` | No |
| `20260708140000` | matched | 20260708140000_deprecate_lesson_notes.sql | deprecate_lesson_notes | `PARITY_APPLIED` | No |
| `20260709060000` | matched | 20260709060000_deprecate_scheme_of_work.sql | deprecate_scheme_of_work | `PARITY_APPLIED` | No |
| `20260709070000` | matched | 20260709070000_reflection_and_lesson_loop.sql | reflection_and_lesson_loop | `PARITY_APPLIED` | No |
| `20260709080000` | matched | 20260709080000_vibe_publications_baseline.sql | vibe_publications_baseline | `PARITY_APPLIED` | No |
| `20260711090000` | matched | 20260711090000_scheme_of_work_seamless_flow.sql | scheme_of_work_seamless_flow | `PARITY_APPLIED` | No |
| `20260711120000` | matched | 20260711120000_scheme_tsc_override_columns.sql | scheme_tsc_override_columns | `PARITY_APPLIED` | No |
| `20260711150000` | local_only | 20260711150000_scheme_curriculum_content_lesson_index.sql | — | `STALE_REPO_ONLY` | Yes |
| `20260713120000` | matched | 20260713120000_retire_kicd_source_type.sql | retire_kicd_source_type | `PARITY_APPLIED` | No |
| `20260715090000` | matched | 20260715090000_cbc_strands_kicd_depth.sql | cbc_strands_kicd_depth | `PARITY_APPLIED` | No |
| `20260715110000` | matched | 20260715110000_sub_strand_id_fk_stage2.sql | sub_strand_id_fk_stage2 | `PARITY_APPLIED` | No |
| `20260715130000` | matched | 20260715130000_sub_strand_id_backfill.sql | sub_strand_id_backfill | `PARITY_APPLIED` | No |
| `20260716180000` | matched | 20260716180000_fix_subjects_global_read_rls.sql | fix_subjects_global_read_rls | `PARITY_APPLIED` | No |
| `20260717090000` | matched | 20260717090000_seed_subject_weekly_allocations.sql | seed_subject_weekly_allocations | `PARITY_APPLIED` | No |
| `20260717162232` | matched | 20260717162232_add_timetable_overlap_exclusion_constraints.sql | add_timetable_overlap_exclusion_constraints | `PARITY_APPLIED` | No |
| `20260717162241` | matched | 20260717162241_fix_timetable_admin_rls_assignment_check.sql | fix_timetable_admin_rls_assignment_check | `PARITY_APPLIED` | No |
| `20260717214543` | matched | 20260717214543_make_teacher_classes_class_id_not_null.sql | make_teacher_classes_class_id_not_null | `PARITY_APPLIED` | No |
| `20260717215951` | matched | 20260717215951_upgrade_overlap_constraints_to_date_aware.sql | upgrade_overlap_constraints_to_date_aware | `PARITY_APPLIED` | No |
| `20260717220005` | live_only | — | create_timetable_slot_rpc | `MISSING_REPO_SOURCE` | Yes |
| `20260718054252` | matched | 20260718054252_timetable_room_conflict_fix12.sql | timetable_room_conflict_fix12 | `PARITY_APPLIED` | No |
| `20260718054908` | matched | 20260718054908_fix13_teacher_weekly_timetable_load.sql | fix13_teacher_weekly_timetable_load | `PARITY_APPLIED` | No |
| `20260718062000` | live_only | — | fix14a_lesson_plans_occurrence_identity | `MISSING_REPO_SOURCE` | Yes |
| `20260718072516` | matched | 20260718072516_fix15_retire_legacy_lesson_plan_uq.sql | fix15_retire_legacy_lesson_plan_uq | `PARITY_APPLIED` | No |
| `20260718082408` | live_only | — | retire_uq_lesson_plan_constraint | `MISSING_REPO_SOURCE` | Yes |
| `20260718084257` | matched | 20260718084257_fix17b_repair_lesson_reflections_identity.sql | fix17b_repair_lesson_reflections_identity | `PARITY_APPLIED` | No |
| `20260718141521` | live_only | — | fix17e_lock_down_attendance_rpc_grants | `MISSING_REPO_SOURCE` | Yes |
| `20260718151116` | matched | 20260718151116_18a_teaching_occurrences.sql | 18a_teaching_occurrences | `PARITY_APPLIED` | No |
| `20260718184018` | matched | 20260718184018_fix18c_start_teaching_occurrence.sql | fix18c_start_teaching_occurrence | `PARITY_APPLIED` | No |
| `20260718184230` | live_only | — | fix18c_revoke_anon_execute | `MISSING_REPO_SOURCE` | Yes |
| `20260719040346` | matched | 20260719040346_fix18d_complete_teaching_occurrence.sql | fix18d_complete_teaching_occurrence | `PARITY_APPLIED` | No |
| `20260719045935` | matched | 20260719045935_fix18e_c_start_occurrence_advances_scheme.sql | fix18e_c_start_occurrence_advances_scheme | `HISTORICAL_PLACEHOLDER` | Yes |
| `20260719071344` | matched | 20260719071344_fix18e_c_start_occurrence_advances_scheme_v2.sql | fix18e_c_start_occurrence_advances_scheme_v2 | `PARITY_APPLIED` | No |
| `20260719083738` | matched | 20260719083738_fix18e_d_mark_scheme_item_covered.sql | fix18e_d_mark_scheme_item_covered | `HISTORICAL_PLACEHOLDER` | Yes |
| `20260719091655` | matched | 20260719091655_fix18e_d_mark_scheme_item_covered_minimal_return.sql | fix18e_d_mark_scheme_item_covered_minimal_return | `PARITY_APPLIED` | No |
| `20260719104505` | matched | 20260719104505_fix20_timetable_slot_editing_rpcs.sql | fix20_timetable_slot_editing_rpcs | `PARITY_APPLIED` | No |
| `20260719104519` | matched | 20260719104519_fix21_school_periods.sql | fix21_school_periods | `PARITY_APPLIED` | No |
| `20260719104530` | matched | 20260719104530_fix22_generate_daily_occurrences.sql | fix22_generate_daily_occurrences | `PARITY_APPLIED` | No |
| `20260719104547` | matched | 20260719104547_fix23_suggest_recovery_slots.sql | fix23_suggest_recovery_slots | `PARITY_APPLIED` | No |
| `20260719104600` | matched | 20260719104600_fix24_scheme_pacing_status.sql | fix24_scheme_pacing_status | `PARITY_APPLIED` | No |
| `20260719104615` | matched | 20260719104615_fix25_timetable_quality_report.sql | fix25_timetable_quality_report | `PARITY_APPLIED` | No |
| `20260719104629` | matched | 20260719104629_fix26_timetable_analytics.sql | fix26_timetable_analytics | `PARITY_APPLIED` | No |
| `20260719104656` | matched | 20260719104656_fix27_timetable_snapshots.sql | fix27_timetable_snapshots | `PARITY_APPLIED` | No |
| `20260719132810` | live_only | — | homework_school_id_not_null | `MISSING_REPO_SOURCE` | Yes |
| `20260719160000` | documented_only | — | — | `HISTORICAL_PLACEHOLDER` | Yes |
| `20260720120000` | documented_only | — | — | `NAME_MISMATCH` | Yes |
| `20260720123500` | local_only | 20260720123500_fix28_create_timetable_slot_error_codes_and_grants.sql | — | `NAME_MISMATCH` | Yes |
| `20260720142114` | live_only | — | fix28_create_timetable_slot_error_codes_and_grants | `MISSING_REPO_SOURCE` | Yes |
| `20260720143830` | live_only | — | drop_legacy_slot_overlap_trigger | `MISSING_REPO_SOURCE` | Yes |
| `20260720143840` | live_only | — | lock_teaching_occurrence_writes | `MISSING_REPO_SOURCE` | Yes |
| `20260720143847` | live_only | — | lesson_plans_day_of_week_1_7 | `MISSING_REPO_SOURCE` | Yes |
| `20260720143903` | live_only | — | fix18e_d_qualify_scheme_id | `MISSING_REPO_SOURCE` | Yes |
| `20260720143912` | live_only | — | revoke_anon_timetable_rpcs | `MISSING_REPO_SOURCE` | Yes |
| `20260720200607` | live_only | — | fix28_create_timetable_slot_error_codes_and_grants | `MISSING_REPO_SOURCE` | Yes |
| `HISTORICAL:assessments_and_assessment_scores_removal` | historical_pseudo | — | — | `HISTORICAL_PLACEHOLDER` | Yes |

## Entries with notes and follow-up

Only non-`PARITY_APPLIED` entries and matched entries with informational notes are detailed here (the full detail for every entry, including plain `PARITY_APPLIED` entries, is in the JSON).

### `20260520000000` — `SYNTHETIC_BASELINE`

- Live name: `timetable_foundation_baseline`
- Notes: Earliest entry in the live ledger, named 'timetable_foundation_baseline'. No corresponding repository migration file exists for this version. Treated as a synthetic baseline representing pre-migration-tracking schema state rather than a reconstructable incremental change.
- Follow-up: No repair attempted under TBL-002 (baseline reconstruction/repair is explicitly out of scope). Documented as a required known entry per HANDOVER.md TBL-002 scope.

### `20260711150000` — `STALE_REPO_ONLY`

- Local file: `20260711150000_scheme_curriculum_content_lesson_index.sql`
- Notes: No live ledger entry exists under version 20260711150000. HANDOVER.md flagged this as 'believed to be stale repository-only'; a direct comparison against the live Supabase migration ledger during this session confirms no matching live version exists.
- Follow-up: Confirmed stale. No repair performed under TBL-002 (migration ledger repair is out of scope/prohibited for this fix). Leave file in place; do not apply, rename, or delete without a separate approved fix.

### `20260717220005` — `MISSING_REPO_SOURCE`

- Live name: `create_timetable_slot_rpc`
- Notes: Live ledger entry with no same-version repository migration file. One of the 14 live-only versions identified by the corrected 2026-07-20 comparison recorded in HANDOVER.md.
- Follow-up: A repository migration file recovering this version's applied change should be added in a future fix. Not performed here (no migration body reconstruction under TBL-002).

### `20260718062000` — `MISSING_REPO_SOURCE`

- Live name: `fix14a_lesson_plans_occurrence_identity`
- Notes: Live ledger entry with no same-version repository migration file. One of the 14 live-only versions identified by the corrected 2026-07-20 comparison recorded in HANDOVER.md.
- Follow-up: A repository migration file recovering this version's applied change should be added in a future fix. Not performed here (no migration body reconstruction under TBL-002).

### `20260718082408` — `MISSING_REPO_SOURCE`

- Live name: `retire_uq_lesson_plan_constraint`
- Notes: Live ledger entry with no same-version repository migration file. One of the 14 live-only versions identified by the corrected 2026-07-20 comparison recorded in HANDOVER.md.
- Follow-up: A repository migration file recovering this version's applied change should be added in a future fix. Not performed here (no migration body reconstruction under TBL-002).

### `20260718141521` — `MISSING_REPO_SOURCE`

- Live name: `fix17e_lock_down_attendance_rpc_grants`
- Notes: Live ledger entry with no same-version repository migration file. One of the 14 live-only versions identified by the corrected 2026-07-20 comparison recorded in HANDOVER.md.
- Follow-up: A repository migration file recovering this version's applied change should be added in a future fix. Not performed here (no migration body reconstruction under TBL-002).

### `20260718184230` — `MISSING_REPO_SOURCE`

- Live name: `fix18c_revoke_anon_execute`
- Notes: Live ledger entry with no same-version repository migration file. One of the 14 live-only versions identified by the corrected 2026-07-20 comparison recorded in HANDOVER.md.
- Follow-up: A repository migration file recovering this version's applied change should be added in a future fix. Not performed here (no migration body reconstruction under TBL-002).

### `20260719045935` — `HISTORICAL_PLACEHOLDER`

- Local file: `20260719045935_fix18e_c_start_occurrence_advances_scheme.sql`
- Live name: `fix18e_c_start_occurrence_advances_scheme`
- Related versions: `20260719071344`
- Notes: Interim fix18e implementation. Present and identical-key in both repo and live ledger, but functionally superseded by 20260719071344 (fix18e_c_start_occurrence_advances_scheme_v2). Kept in history per project convention of not rewriting applied migrations.
- Follow-up: No action required. Superseding version 20260719071344 is the authoritative implementation. Do not remove or renumber either file.

### `20260719083738` — `HISTORICAL_PLACEHOLDER`

- Local file: `20260719083738_fix18e_d_mark_scheme_item_covered.sql`
- Live name: `fix18e_d_mark_scheme_item_covered`
- Related versions: `20260719091655`
- Notes: Interim fix18e implementation. Present and identical-key in both repo and live ledger, but functionally superseded by 20260719091655 (fix18e_d_mark_scheme_item_covered_minimal_return). Kept in history per project convention of not rewriting applied migrations.
- Follow-up: No action required. Superseding version 20260719091655 is the authoritative implementation. Do not remove or renumber either file.

### `20260719132810` — `MISSING_REPO_SOURCE`

- Live name: `homework_school_id_not_null`
- Notes: Live ledger entry with no same-version repository migration file. One of the 14 live-only versions identified by the corrected 2026-07-20 comparison recorded in HANDOVER.md.
- Follow-up: A repository migration file recovering this version's applied change should be added in a future fix. Not performed here (no migration body reconstruction under TBL-002).

### `20260719160000` — `HISTORICAL_PLACEHOLDER`

- Notes: Referenced in HANDOVER.md TBL-002 required known entries as '20260719160000_core_link_constraints.sql'. No repository file and no live ledger entry exist under this version. No other reference to this filename was found anywhere in the repository (DEVLOG.md, HANDOVER.md, TIMETABLE_FIX_REGISTER.md, or migration bodies) during this session's search.
- Follow-up: Origin and disposition are undocumented. Treated as a historical placeholder pending future investigation. No file should be created at this version without first establishing what, if anything, was intended here.

### `20260720120000` — `NAME_MISMATCH`

- Related versions: `20260720143903`
- Notes: Referenced in prior documentation as the intended version for 'fix18e_d_qualify_scheme_id.sql'. No repository file and no live ledger entry exist under 20260720120000. The actual applied content is live under version 20260720143903 (see that entry, classified MISSING_REPO_SOURCE).
- Follow-up: Do not create a repository file at 20260720120000. Any future repository recovery of this content must use version 20260720143903 to match the live ledger.

### `20260720123500` — `NAME_MISMATCH`

- Local file: `20260720123500_fix28_create_timetable_slot_error_codes_and_grants.sql`
- Related versions: `20260720142114`, `20260720200607`
- Notes: Repository file 20260720123500_fix28_create_timetable_slot_error_codes_and_grants.sql is the source-controlled representation of the fix28 change, but the live ledger recorded this content under two different version keys (20260720142114 and 20260720200607), neither of which is 20260720123500. Per HANDOVER.md, the executable database change is functionally equivalent across all three version keys, and the later live entry is a harmless redundant reapplication (idempotent REVOKE/GRANT statements).
- Follow-up: Documented and accepted; the live ledger must not be deleted, renamed, or rewritten to reconcile this version-key mismatch. See related live versions 20260720142114 and 20260720200607, both classified MISSING_REPO_SOURCE.

### `20260720142114` — `MISSING_REPO_SOURCE`

- Live name: `fix28_create_timetable_slot_error_codes_and_grants`
- Related versions: `20260720200607`, `20260720123500`
- Notes: One of two live ledger entries for 'fix28_create_timetable_slot_error_codes_and_grants' (the other is 20260720200607). Repository source-controlled representation is 20260720123500_fix28_create_timetable_slot_error_codes_and_grants.sql (classified NAME_MISMATCH), which is functionally equivalent to both live entries.
- Follow-up: Duplicate live application is documented as a harmless redundant reapplication per HANDOVER.md; idempotent REVOKE/GRANT statements do not by themselves prove an earlier migration failed. The live ledger must not be deleted, renamed, or rewritten to remove either this entry or 20260720200607.

### `20260720143830` — `MISSING_REPO_SOURCE`

- Live name: `drop_legacy_slot_overlap_trigger`
- Notes: Live ledger entry with no same-version repository migration file. One of the 14 live-only versions identified by the corrected 2026-07-20 comparison recorded in HANDOVER.md.
- Follow-up: A repository migration file recovering this version's applied change should be added in a future fix. Not performed here (no migration body reconstruction under TBL-002).

### `20260720143840` — `MISSING_REPO_SOURCE`

- Live name: `lock_teaching_occurrence_writes`
- Notes: Live ledger entry with no same-version repository migration file. One of the 14 live-only versions identified by the corrected 2026-07-20 comparison recorded in HANDOVER.md.
- Follow-up: A repository migration file recovering this version's applied change should be added in a future fix. Not performed here (no migration body reconstruction under TBL-002).

### `20260720143847` — `MISSING_REPO_SOURCE`

- Live name: `lesson_plans_day_of_week_1_7`
- Notes: Live ledger entry with no same-version repository migration file. One of the 14 live-only versions identified by the corrected 2026-07-20 comparison recorded in HANDOVER.md.
- Follow-up: A repository migration file recovering this version's applied change should be added in a future fix. Not performed here (no migration body reconstruction under TBL-002).

### `20260720143903` — `MISSING_REPO_SOURCE`

- Live name: `fix18e_d_qualify_scheme_id`
- Related versions: `20260720120000`
- Notes: Live ledger entry for 'fix18e_d_qualify_scheme_id'. HANDOVER.md originally expected this content under repository/intended version 20260720120000; no live ledger entry exists under 20260720120000. The actual live version is 20260720143903, and no same-version repository file exists for 20260720143903 either.
- Follow-up: See documented-only entry '20260720120000' (classified NAME_MISMATCH) for the cross-reference. A repository migration file for 20260720143903 should be added in a future fix; not performed here (no migration body reconstruction under TBL-002).

### `20260720143912` — `MISSING_REPO_SOURCE`

- Live name: `revoke_anon_timetable_rpcs`
- Notes: Live ledger entry with no same-version repository migration file. One of the 14 live-only versions identified by the corrected 2026-07-20 comparison recorded in HANDOVER.md.
- Follow-up: A repository migration file recovering this version's applied change should be added in a future fix. Not performed here (no migration body reconstruction under TBL-002).

### `20260720200607` — `MISSING_REPO_SOURCE`

- Live name: `fix28_create_timetable_slot_error_codes_and_grants`
- Related versions: `20260720142114`, `20260720123500`
- Notes: One of two live ledger entries for 'fix28_create_timetable_slot_error_codes_and_grants' (the other is 20260720142114). Repository source-controlled representation is 20260720123500_fix28_create_timetable_slot_error_codes_and_grants.sql (classified NAME_MISMATCH), which is functionally equivalent to both live entries.
- Follow-up: Duplicate live application is documented as a harmless redundant reapplication per HANDOVER.md; idempotent REVOKE/GRANT statements do not by themselves prove an earlier migration failed. The live ledger must not be deleted, renamed, or rewritten to remove either this entry or 20260720142114.

### `HISTORICAL:assessments_and_assessment_scores_removal` — `HISTORICAL_PLACEHOLDER`

- Related versions: `20260705160000`, `20260708120000`
- Notes: HANDOVER.md records 'the historical removal of assessments and assessment_scores is undocumented' as a known open migration risk. A search of every migration file in this repository found no DROP TABLE statement for either table; 20260705160000_teacher_os_graph_fixes.sql created both tables, and 20260708120000_merge_assessment_concepts.sql only marked them deprecated via COMMENT ON TABLE (no data or schema removal). The removal referenced in HANDOVER.md therefore predates or falls outside the current migration history and cannot be attributed to a specific version at this time.
- Follow-up: Requires manual history archaeology (git log / prior Supabase project state) outside the scope of TBL-002. Not resolved here; carried forward as an open risk.

## Validation

Run:

```
python3 scripts/validate-migration-classification.py
```

The validator re-scans `supabase/migrations/` from disk (not trusting the JSON's own `local_ledger` record) and checks it against the embedded live ledger snapshot. It fails on: unclassified local or remote versions, multiple classifications for one version, invalid classification values, duplicate local versions, mismatches without an explicit follow-up, and missing required known entries.


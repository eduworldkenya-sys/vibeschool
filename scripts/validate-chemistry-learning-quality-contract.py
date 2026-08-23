#!/usr/bin/env python3
from pathlib import Path

MIGRATION = Path('supabase/migrations/20260823201500_content_worker_professionalization_chemistry_learning_quality_contract.sql')
text = MIGRATION.read_text()

required = [
    "content-factory-r2-canary-01",
    "status='restricted'",
    "CHEMISTRY_AUTHOR_RESTRICTED_CONVERGENCE_REQUIRES_CURRENT_CERTIFICATION",
    "teacher-guide-quality-contract',3",
    "chemistry-grade10-author',3",
    "chemistry-content-worker-evaluation',3",
    "outcome_definition_of_done",
    "minimum_formal_items_per_chapter",
    "assessment_tests_untaught_content",
    "chemistry_learning_quality_contract()",
    "learning_quality_contract",
    "chemistry_bind_learning_quality_contract",
    "chemistry_enforce_learning_quality_pass",
    "learning_quality_contract_version",
    "outcome_coverage_complete",
    "concept_explanations_complete",
    "learner_activities_executable",
    "assessment_alignment_complete",
    "scientific_accuracy_checked",
    "deterministic_contract_checks_pass",
    "independent_review",
    "pedagogical_depth_pass",
    "targeted_repair",
    "preserved_unaffected_content",
    "regression_checks_pass",
    "CHEMISTRY_AUTHOR_PASS_MISSING_LEARNING_EVIDENCE",
    "CHEMISTRY_QUALITY_PASS_MISSING_CONTRACT_EVIDENCE",
    "CHEMISTRY_CRITIC_PASS_MISSING_INDEPENDENT_EVIDENCE",
    "CHEMISTRY_REPAIR_PASS_MISSING_REGRESSION_EVIDENCE",
    "runtime_execution_enabled,false",
    "heartbeat_enabled,false",
    "factory_enabled,false",
    "runtime_autonomy_level,0)<>0",
    "runtime_max_risk,0)<>0",
    "shadow_enabled,false",
    "shadow_scheduler_enabled,false",
    "shadow_global_stop,true",
]

missing = [needle for needle in required if needle not in text]
if missing:
    raise SystemExit(f'Chemistry learning quality contract missing invariants: {missing}')

for forbidden in [
    "runtime_execution_enabled=true",
    "heartbeat_enabled=true",
    "factory_enabled=true",
    "shadow_enabled=true",
    "shadow_scheduler_enabled=true",
    "shadow_global_stop=false",
    "paid_ai_allowed=true",
    "status='active' where worker_key='content-factory-r2-canary-01'",
]:
    if forbidden in text:
        raise SystemExit(f'Forbidden activation/authority expansion detected: {forbidden}')

bind_pos = text.find('create trigger chemistry_bind_learning_quality_contract')
pass_pos = text.find('create trigger chemistry_enforce_learning_quality_pass')
if bind_pos < 0 or pass_pos < 0 or not bind_pos < pass_pos:
    raise SystemExit('Quality contract must be bound to stage input before PASS enforcement is installed')

if text.count("profile_key in (\n  'teacher-guide-quality-contract',") != 1:
    raise SystemExit('Profile retirement must be explicit and singular')

print('Chemistry learning quality contract validation: PASS')

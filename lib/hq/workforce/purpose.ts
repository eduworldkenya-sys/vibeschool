export const WORKFORCE_ENGINE_PURPOSE = {
  mission: "Ensure every necessary Vibeschool business function has the safest, least-cost capable owner and that work is executed, verified, measured, and improved without requiring paid AI for routine operation.",
  responsibilities: [
    "model_company_functions",
    "detect_unowned_or_duplicate_work",
    "select_automation_digital_human_or_contractor_capacity",
    "create_and_certify_digital_workers",
    "route_and_supervise_work",
    "enforce_authority_and_approval_boundaries",
    "verify_outcomes_against_evidence",
    "measure_workforce_performance_and_capacity",
    "preserve_operational_memory",
    "recommend_workforce_changes",
  ] as const,
  exclusions: [
    "autonomous_human_hiring_or_termination",
    "autonomous_salary_or_contract_commitments",
    "autonomous_spending",
    "self_granting_worker_authority",
    "paid_ai_as_required_runtime_dependency",
  ] as const,
} as const

export type WorkforceEnginePurpose = typeof WORKFORCE_ENGINE_PURPOSE

export function describeWorkforceEnginePurpose(): WorkforceEnginePurpose {
  return WORKFORCE_ENGINE_PURPOSE
}

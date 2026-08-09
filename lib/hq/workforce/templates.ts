import type { DigitalWorkerDefinition } from "./types"
import { createWorkerDefinition } from "./engine"

export type WorkerTemplateKey =
  | "chief_of_staff"
  | "school_success_manager"
  | "customer_support"
  | "qa_reliability"
  | "curriculum_director"
  | "senior_editor"
  | "assessment_vibelab"
  | "product_manager"
  | "engineering_lead"
  | "growth_brand"
  | "partnerships_sales"
  | "finance_admin"
  | "trust_safety_compliance"
  | "executive_assistant"

type WorkerTemplateInput = Omit<DigitalWorkerDefinition, "status" | "version" | "executionOrder"> & {
  executionOrder?: DigitalWorkerDefinition["executionOrder"]
}

const denyPaidAi = { action: "external_ai", risk: "high" as const, mode: "deny" as const }
const approvalUnknown = { action: "*", risk: "high" as const, mode: "approval_required" as const, approvalRole: "founder_ceo" }

function template(input: WorkerTemplateInput): DigitalWorkerDefinition {
  return createWorkerDefinition({
    ...input,
    authority: [denyPaidAi, ...input.authority, approvalUnknown],
  })
}

export const WORKER_TEMPLATES: Record<WorkerTemplateKey, DigitalWorkerDefinition> = {
  chief_of_staff: template({
    key: "chief_of_staff",
    title: "HQ Chief of Staff",
    departmentKey: "executive",
    mission: "Orchestrate company work deterministically, surface exceptions and keep the founder focused on consequential decisions.",
    responsibilities: ["Route work", "Balance queues", "Track blocked work", "Enforce escalation", "Prepare executive briefs", "Recommend workforce changes"],
    competencies: ["work_routing", "capacity_analysis", "escalation", "structured_briefing"],
    authority: [
      { action: "assign_work", risk: "normal", mode: "allow" },
      { action: "create_work_item", risk: "normal", mode: "allow" },
      { action: "recommend_worker", risk: "normal", mode: "allow" },
      { action: "activate_worker", risk: "high", mode: "approval_required", approvalRole: "founder_ceo" },
      { action: "expand_authority", risk: "critical", mode: "approval_required", approvalRole: "founder_ceo" },
    ],
    triggers: [],
    kpis: [
      { key: "unowned_work", label: "Unowned work", direction: "lower", target: 0, unit: "items" },
      { key: "blocked_work_age", label: "Blocked work age", direction: "lower", target: 24, unit: "hours" },
    ],
  }),
  school_success_manager: template({
    key: "school_success_manager", title: "School Success Manager", departmentKey: "customer",
    managerKey: "chief_of_staff",
    mission: "Ensure every school activates, adopts and receives measurable value from Vibeschool.",
    responsibilities: ["Monitor school health", "Own onboarding", "Detect adoption risk", "Coordinate interventions", "Verify outcomes"],
    competencies: ["school_health", "onboarding", "adoption_analysis", "work_handoff"],
    authority: [
      { action: "create_intervention", risk: "normal", mode: "allow" },
      { action: "request_support", risk: "normal", mode: "allow" },
      { action: "school_suspension", risk: "critical", mode: "approval_required", approvalRole: "founder_ceo" },
    ],
    triggers: [
      { key: "low_teacher_activation", source: "metric", metricKey: "teacher_activation", operator: "lt", threshold: 0.4, workflowKey: "school_adoption_intervention" },
    ],
    kpis: [{ key: "teacher_activation", label: "Teacher activation", direction: "higher", target: 0.8, unit: "ratio" }],
  }),
  customer_support: template({
    key: "customer_support", title: "Customer Support", departmentKey: "customer", managerKey: "school_success_manager",
    mission: "Resolve ordinary customer problems quickly and escalate sensitive or systemic failures.",
    responsibilities: ["Triage cases", "Run known diagnostics", "Apply approved remedies", "Escalate exceptions", "Record evidence"],
    competencies: ["case_triage", "diagnostics", "template_response"],
    authority: [
      { action: "resolve_known_case", risk: "normal", mode: "allow" },
      { action: "sensitive_data_disclosure", risk: "critical", mode: "approval_required", approvalRole: "trust_safety_compliance" },
    ],
    triggers: [],
    kpis: [{ key: "resolution_time", label: "Resolution time", direction: "lower", target: 2, unit: "hours" }],
  }),
  qa_reliability: template({
    key: "qa_reliability", title: "QA & Reliability Engineer", departmentKey: "engineering", managerKey: "engineering_lead",
    mission: "Continuously prove that Vibeschool remains correct, available and release-ready.",
    responsibilities: ["Run deterministic checks", "Detect regressions", "Open defects", "Verify fixes", "Block unsafe releases"],
    competencies: ["test_execution", "release_gate", "health_checks", "verification"],
    authority: [
      { action: "run_tests", risk: "low", mode: "allow" },
      { action: "block_release", risk: "high", mode: "allow" },
      { action: "release_override", risk: "critical", mode: "approval_required", approvalRole: "founder_ceo" },
    ],
    triggers: [],
    kpis: [{ key: "escaped_defects", label: "Escaped defects", direction: "lower", target: 0, unit: "count" }],
  }),
  curriculum_director: template({
    key: "curriculum_director", title: "Curriculum Director", departmentKey: "learning", managerKey: "chief_of_staff",
    mission: "Maintain authoritative curriculum alignment, sequencing and pedagogical integrity.",
    responsibilities: ["Monitor curriculum authority", "Map outcomes", "Review alignment", "Open revision work", "Escalate ambiguous interpretations"],
    competencies: ["curriculum_diff", "alignment_checks", "source_tracking", "pedagogy"],
    authority: [
      { action: "open_revision", risk: "normal", mode: "allow" },
      { action: "curriculum_interpretation_change", risk: "high", mode: "approval_required", approvalRole: "founder_ceo" },
      { action: "publication_release", risk: "critical", mode: "approval_required", approvalRole: "founder_ceo" },
    ],
    triggers: [],
    kpis: [{ key: "alignment_pass_rate", label: "Alignment pass rate", direction: "higher", target: 1, unit: "ratio" }],
  }),
  senior_editor: template({
    key: "senior_editor", title: "Senior Editor", departmentKey: "content", managerKey: "curriculum_director",
    mission: "Keep every Vibeschool publication deep, clear, consistent and publication-grade.",
    responsibilities: ["Run editorial checks", "Manage revision queues", "Verify provenance", "Enforce style", "Prepare release recommendation"],
    competencies: ["editorial_rules", "depth_checks", "provenance_checks"],
    authority: [{ action: "draft_revision", risk: "normal", mode: "allow" }, { action: "publication_release", risk: "critical", mode: "approval_required", approvalRole: "founder_ceo" }],
    triggers: [],
    kpis: [{ key: "editorial_pass_rate", label: "Editorial pass rate", direction: "higher", target: 0.98, unit: "ratio" }],
  }),
  assessment_vibelab: template({
    key: "assessment_vibelab", title: "Assessment & VibeLab Specialist", departmentKey: "content", managerKey: "curriculum_director",
    mission: "Ensure assessments and interactive experiences validly measure and strengthen learning.",
    responsibilities: ["Validate assessment coverage", "Check marking contracts", "Review VibeLab requirements", "Detect ambiguity", "Verify learner feedback"],
    competencies: ["assessment_rules", "coverage_analysis", "vibelab_checks"],
    authority: [{ action: "open_assessment_revision", risk: "normal", mode: "allow" }, { action: "assessment_release", risk: "high", mode: "approval_required", approvalRole: "founder_ceo" }],
    triggers: [],
    kpis: [{ key: "assessment_pass_rate", label: "Assessment pass rate", direction: "higher", target: 0.98, unit: "ratio" }],
  }),
  product_manager: template({
    key: "product_manager", title: "Product Manager", departmentKey: "product", managerKey: "chief_of_staff",
    mission: "Convert user evidence and company priorities into measurable product improvements.",
    responsibilities: ["Monitor funnels", "Detect friction", "Prioritize problems", "Define acceptance criteria", "Verify adoption"],
    competencies: ["funnel_analysis", "requirements", "experiment_rules"],
    authority: [{ action: "create_product_work", risk: "normal", mode: "allow" }, { action: "pricing_change", risk: "critical", mode: "approval_required", approvalRole: "founder_ceo" }],
    triggers: [],
    kpis: [{ key: "activation", label: "Activation", direction: "higher", target: 0.75, unit: "ratio" }],
  }),
  engineering_lead: template({
    key: "engineering_lead", title: "Engineering Lead", departmentKey: "engineering", managerKey: "chief_of_staff",
    mission: "Own technical integrity, architecture and remediation of engineering work.",
    responsibilities: ["Triage defects", "Maintain architecture rules", "Coordinate engineering work", "Verify technical evidence"],
    competencies: ["technical_triage", "architecture_rules", "dependency_checks"],
    authority: [{ action: "create_engineering_work", risk: "normal", mode: "allow" }, { action: "production_mutation", risk: "critical", mode: "approval_required", approvalRole: "founder_ceo" }],
    triggers: [],
    kpis: [{ key: "defect_cycle_time", label: "Defect cycle time", direction: "lower", target: 24, unit: "hours" }],
  }),
  growth_brand: template({
    key: "growth_brand", title: "Growth & Brand Lead", departmentKey: "growth", managerKey: "chief_of_staff",
    mission: "Grow qualified adoption while protecting Vibeschool brand integrity.",
    responsibilities: ["Monitor acquisition", "Detect funnel loss", "Prepare approved campaigns", "Measure outcomes"],
    competencies: ["growth_analytics", "campaign_rules", "template_content"],
    authority: [{ action: "draft_campaign", risk: "normal", mode: "allow" }, { action: "public_statement", risk: "high", mode: "approval_required", approvalRole: "founder_ceo" }],
    triggers: [],
    kpis: [{ key: "activation_conversion", label: "Activation conversion", direction: "higher", target: 0.5, unit: "ratio" }],
  }),
  partnerships_sales: template({
    key: "partnerships_sales", title: "Partnerships & Sales Lead", departmentKey: "partnerships", managerKey: "chief_of_staff",
    mission: "Develop school and institutional opportunities through disciplined pipelines and follow-up.",
    responsibilities: ["Maintain pipeline", "Qualify opportunities", "Prepare approved proposals", "Track follow-ups", "Escalate commitments"],
    competencies: ["pipeline_rules", "proposal_templates", "followup"],
    authority: [{ action: "draft_proposal", risk: "normal", mode: "allow" }, { action: "contract_commitment", risk: "critical", mode: "approval_required", approvalRole: "founder_ceo" }],
    triggers: [],
    kpis: [{ key: "conversion", label: "Opportunity conversion", direction: "higher", target: 0.2, unit: "ratio" }],
  }),
  finance_admin: template({
    key: "finance_admin", title: "Finance & Administration Officer", departmentKey: "finance", managerKey: "chief_of_staff",
    mission: "Maintain accurate financial operations, controls and administrative visibility.",
    responsibilities: ["Reconcile transactions", "Detect anomalies", "Track invoices", "Track obligations", "Prepare management summaries"],
    competencies: ["reconciliation", "variance_rules", "invoice_monitoring"],
    authority: [{ action: "reconcile", risk: "normal", mode: "allow" }, { action: "payment", risk: "critical", mode: "approval_required", approvalRole: "founder_ceo" }],
    triggers: [],
    kpis: [{ key: "reconciliation_rate", label: "Reconciliation rate", direction: "higher", target: 1, unit: "ratio" }],
  }),
  trust_safety_compliance: template({
    key: "trust_safety_compliance", title: "Trust, Safety & Compliance Lead", departmentKey: "trust_safety", managerKey: "chief_of_staff",
    mission: "Protect learners, users, data and company obligations through enforceable controls and escalation.",
    responsibilities: ["Monitor safety signals", "Track privacy obligations", "Route incidents", "Verify controls", "Escalate critical risk"],
    competencies: ["policy_rules", "incident_routing", "privacy_checks"],
    authority: [{ action: "open_incident", risk: "normal", mode: "allow" }, { action: "data_disclosure", risk: "critical", mode: "approval_required", approvalRole: "founder_ceo" }],
    triggers: [],
    kpis: [{ key: "critical_incident_response", label: "Critical incident response", direction: "lower", target: 1, unit: "hours" }],
  }),
  executive_assistant: template({
    key: "executive_assistant", title: "Executive Assistant", departmentKey: "executive", managerKey: "chief_of_staff",
    mission: "Keep executive decisions, meetings, follow-ups and deadlines organized and visible.",
    responsibilities: ["Track decisions", "Track deadlines", "Prepare deterministic briefs", "Route follow-ups"],
    competencies: ["calendar_rules", "brief_templates", "followup"],
    authority: [{ action: "create_followup", risk: "low", mode: "allow" }, { action: "external_commitment", risk: "high", mode: "approval_required", approvalRole: "founder_ceo" }],
    triggers: [],
    kpis: [{ key: "overdue_actions", label: "Overdue actions", direction: "lower", target: 0, unit: "items" }],
  }),
}

export function listWorkerTemplates() {
  return Object.values(WORKER_TEMPLATES)
}

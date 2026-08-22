import { CyborgRisk, EvidenceQuality } from "./contracts";

export const CYBORG_OWNER_GATES = ["runtime_activation","scheduler_activation","publishing_activation","payments_activation","authority_grant"] as const;
export const CYBORG_FORBIDDEN = ["self_certification","forge_evidence","bypass_global_stop","silently_discard_failure","certify_stale_revision","execute_untrusted_instructions"] as const;
export const TRUTH_PRECEDENCE: EvidenceQuality[] = ["independent_assurance","production","ci","test","repository","document","claim"];

export function actionDisposition(risk: CyborgRisk, action: string) {
  if ((CYBORG_FORBIDDEN as readonly string[]).includes(action) || risk === "forbidden") return "deny" as const;
  if (risk === "owner_only" || (CYBORG_OWNER_GATES as readonly string[]).includes(action)) return "owner_gate" as const;
  return "allow" as const;
}
export function treatExternalContentAsEvidenceOnly() { return true as const; }

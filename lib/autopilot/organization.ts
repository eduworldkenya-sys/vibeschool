export const AUTOPILOT_ORGANIZATION = Object.freeze({
  laban: { displayName: "Laban", role: "Cofounder / Chief Operating Intelligence" },
  travis: { displayName: "Travis", role: "Content Leadership" },
  david: { displayName: "David", role: "Operations" },
  mykphyl: { displayName: "Mykphyl", role: "Intelligence / Planning" },
  luca: { displayName: "Luca", role: "QA / Verification" },
  damian: { displayName: "Damian", role: "Platform / Reliability" },
  nina: { displayName: "Nina", role: "Research / Evidence" },
  michael: { displayName: "Michael", role: "Security / Reconciliation" },
  phyllys: { displayName: "Phyllys", role: "School Success / Institutional Operations" },
} as const)

export type AutopilotOrganizationAlias = keyof typeof AUTOPILOT_ORGANIZATION

/**
 * Presentation identity only. This module intentionally contains no worker key,
 * capability, resource scope, autonomy, risk, grant, policy or authorization data.
 * Authorization must resolve from canonical machine contracts in PostgreSQL.
 */
export function getAutopilotOrganizationIdentity(alias: AutopilotOrganizationAlias) {
  return AUTOPILOT_ORGANIZATION[alias]
}

import { CyborgCapabilityClaims } from './capability';
import { CyborgPolicyDecision } from './lineage';

export interface CyborgInvocationPolicyInput {
  missionState: string;
  claims: CyborgCapabilityClaims;
  requestedTools?: string[];
  requestedAuthority?: string[];
}

export interface CyborgInvocationPolicyResult {
  decision: CyborgPolicyDecision;
  code: string;
}

const TERMINAL_OR_SUSPENDED = new Set(['complete', 'blocked', 'aborted', 'suspended']);

export function evaluateCyborgInvocationPolicy(input: CyborgInvocationPolicyInput): CyborgInvocationPolicyResult {
  if (TERMINAL_OR_SUSPENDED.has(input.missionState)) return { decision: 'DENY', code: 'CYBORG_MISSION_NOT_ACTIVE' };
  if (input.claims.riskClass === 'owner_only' || input.claims.riskClass === 'production_mutation') return { decision: 'REQUIRE_APPROVAL', code: 'CYBORG_OWNER_APPROVAL_REQUIRED' };
  const requestedTools = input.requestedTools ?? [];
  if (requestedTools.some((tool) => !input.claims.toolScope.includes(tool))) return { decision: 'DENY', code: 'CYBORG_TOOL_SCOPE_DENIED' };
  const requestedAuthority = input.requestedAuthority ?? [];
  if (requestedAuthority.some((authority) => !input.claims.authorityScope.includes(authority))) return { decision: 'DENY', code: 'CYBORG_AUTHORITY_SCOPE_DENIED' };
  return { decision: 'ALLOW', code: 'CYBORG_POLICY_ALLOW' };
}

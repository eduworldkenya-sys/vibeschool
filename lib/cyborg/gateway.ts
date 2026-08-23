import { CyborgMission } from './contracts';
import { CyborgRuntime } from './runtime';
import { issueCyborgCapability, verifyCyborgCapability } from './capability';

export const CYBORG_GATEWAY_ID = 'vibeschool.cyborg.universal-llm-gateway.v2';
export const NO_DIRECT_LLM_CALLS = 'NO_DIRECT_LLM_CALLS';
export const PREMATURE_MISSION_RETURN = 'PREMATURE_MISSION_RETURN';
export type LlmProvider = 'openai' | 'anthropic' | 'google' | 'local' | (string & {});
export interface CyborgModelRequest { provider: LlmProvider; model: string; missionId: string; conversationId?: string; messages: unknown[]; metadata?: Record<string, unknown>; capabilityToken?: string; }
export interface CyborgModelResponse { provider: LlmProvider; model: string; output: unknown; usage?: Record<string, number>; capabilityJti?: string; }
export interface CyborgModelAdapter { readonly provider: LlmProvider; invoke(request: CyborgModelRequest): Promise<CyborgModelResponse>; }
export interface MissionIntake { createOrResume(input: { objective: string; conversationId?: string; requestedProvider?: LlmProvider }): Promise<CyborgMission>; }

export async function invokeCyborgModel(adapter: CyborgModelAdapter, request: CyborgModelRequest, secret = process.env.CYBORG_CAPABILITY_SECRET): Promise<CyborgModelResponse> {
  if (!request.missionId?.trim()) throw new Error('CYBORG_MISSION_REQUIRED');
  if (adapter.provider !== request.provider) throw new Error(`CYBORG_PROVIDER_MISMATCH:${request.provider}`);
  const claims = await verifyCyborgCapability({ secret, token: request.capabilityToken, missionId: request.missionId, provider: request.provider, model: request.model });
  const response = await adapter.invoke(request);
  return { ...response, capabilityJti: claims.jti };
}

/** Only approved application-facing model entrypoint. It mints a short-lived mission-bound capability internally. */
export async function invokeGovernedCyborgModel(adapter: CyborgModelAdapter, request: Omit<CyborgModelRequest, 'capabilityToken'>, secret = process.env.CYBORG_CAPABILITY_SECRET): Promise<CyborgModelResponse> {
  const capabilityToken = await issueCyborgCapability({ secret, missionId: request.missionId, conversationId: request.conversationId, provider: request.provider, model: request.model });
  return invokeCyborgModel(adapter, { ...request, capabilityToken }, secret);
}

export function createAnthropicMessagesAdapter(apiKey: string): CyborgModelAdapter {
  if (!apiKey) throw new Error('CYBORG_PROVIDER_CREDENTIAL_REQUIRED:anthropic');
  return { provider: 'anthropic', async invoke(request) {
    const maxTokens = typeof request.metadata?.maxTokens === 'number' ? request.metadata.maxTokens : 1024;
    const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: request.model, max_tokens: maxTokens, messages: request.messages }) });
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(`CYBORG_PROVIDER_FAILURE:anthropic:${response.status}`);
    return { provider: 'anthropic', model: request.model, output: payload };
  }};
}

export class CyborgUniversalGateway {
  constructor(private readonly intake: MissionIntake, private readonly runtime: CyborgRuntime, private readonly adapters: Map<LlmProvider, CyborgModelAdapter>, private readonly capabilitySecret = process.env.CYBORG_CAPABILITY_SECRET) {}
  async start(input: { objective: string; conversationId?: string; requestedProvider?: LlmProvider }): Promise<CyborgMission> { const mission = await this.intake.createOrResume(input); return this.runtime.run(mission.id); }
  async invokeModel(request: Omit<CyborgModelRequest, 'capabilityToken'>): Promise<CyborgModelResponse> { const adapter=this.adapters.get(request.provider); if(!adapter) throw new Error(`CYBORG_PROVIDER_NOT_REGISTERED:${request.provider}`); return invokeGovernedCyborgModel(adapter, request, this.capabilitySecret); }
  assertReturnAllowed(mission: CyborgMission): void { if (!['complete', 'blocked', 'aborted'].includes(mission.state)) throw new Error(PREMATURE_MISSION_RETURN); }
}
export async function runCyborgMission(gateway: CyborgUniversalGateway, input: { objective: string; conversationId?: string; requestedProvider?: LlmProvider }): Promise<CyborgMission> { const mission=await gateway.start(input); gateway.assertReturnAllowed(mission); return mission; }

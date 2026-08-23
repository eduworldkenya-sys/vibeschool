import { CyborgMission } from './contracts';
import { CyborgRuntime } from './runtime';
import { CyborgCapabilityClaims, CYBORG_CAPABILITY_REQUIRED } from './capability';
import { CyborgAdmittedResponse, CyborgInvocationLineage, assertCyborgResponseAdmission } from './lineage';

export const CYBORG_GATEWAY_ID = 'vibeschool.cyborg.universal-llm-gateway.v2';
export const NO_DIRECT_LLM_CALLS = 'NO_DIRECT_LLM_CALLS';
export const PREMATURE_MISSION_RETURN = 'PREMATURE_MISSION_RETURN';

export type LlmProvider = 'openai' | 'anthropic' | 'groq' | 'google' | 'local' | (string & {});

export interface CyborgModelRequest {
  provider: LlmProvider;
  model: string;
  missionId: string;
  missionRevision: string;
  chatId: string;
  callerServiceId: string;
  operation: string;
  capability: string;
  messages: unknown[];
  maxTokens: number;
  metadata?: Record<string, unknown>;
}

export interface CyborgModelResponse {
  provider: LlmProvider;
  model: string;
  output: unknown;
  usage?: Record<string, number>;
}

export interface CyborgModelAdapter {
  readonly provider: LlmProvider;
  invoke(request: CyborgModelRequest): Promise<CyborgModelResponse>;
}

export interface CyborgInvocationBoundary {
  authorize(request: CyborgModelRequest): Promise<CyborgCapabilityClaims>;
  begin(request: CyborgModelRequest, claims: CyborgCapabilityClaims): Promise<{ requestHash: string; capabilityHash: string; startedAt: string; previousReceiptHash?: string }>;
  complete(input: {
    request: CyborgModelRequest;
    claims: CyborgCapabilityClaims;
    providerResponse: CyborgModelResponse;
    requestHash: string;
    capabilityHash: string;
    startedAt: string;
    previousReceiptHash?: string;
  }): Promise<CyborgInvocationLineage>;
}

export interface MissionIntake {
  createOrResume(input: { objective: string; conversationId?: string; requestedProvider?: LlmProvider }): Promise<CyborgMission>;
}

export async function invokeCyborgModel(
  adapter: CyborgModelAdapter,
  request: CyborgModelRequest,
  boundary: CyborgInvocationBoundary,
): Promise<CyborgAdmittedResponse<CyborgModelResponse>> {
  if (!request.capability?.trim()) throw new Error(CYBORG_CAPABILITY_REQUIRED);
  if (!request.missionId?.trim()) throw new Error('CYBORG_MISSION_REQUIRED');
  if (adapter.provider !== request.provider) throw new Error(`CYBORG_PROVIDER_MISMATCH:${request.provider}`);
  const claims = await boundary.authorize(request);
  const begun = await boundary.begin(request, claims);
  const providerResponse = await adapter.invoke(request);
  const lineage = await boundary.complete({ request, claims, providerResponse, ...begun });
  return assertCyborgResponseAdmission({ output: providerResponse, lineage });
}

export class CyborgUniversalGateway {
  constructor(
    private readonly intake: MissionIntake,
    private readonly runtime: CyborgRuntime,
    private readonly adapters: Map<LlmProvider, CyborgModelAdapter>,
    private readonly boundary: CyborgInvocationBoundary,
  ) {}

  async start(input: { objective: string; conversationId?: string; requestedProvider?: LlmProvider }): Promise<CyborgMission> {
    const mission = await this.intake.createOrResume(input);
    return this.runtime.run(mission.id);
  }

  async invokeModel(request: CyborgModelRequest): Promise<CyborgAdmittedResponse<CyborgModelResponse>> {
    const adapter = this.adapters.get(request.provider);
    if (!adapter) throw new Error(`CYBORG_PROVIDER_NOT_REGISTERED:${request.provider}`);
    return invokeCyborgModel(adapter, request, this.boundary);
  }

  assertReturnAllowed(mission: CyborgMission): void {
    if (!['complete', 'blocked', 'aborted'].includes(mission.state)) throw new Error(PREMATURE_MISSION_RETURN);
  }
}

/** Canonical entrypoint for governed VibeSchool AI work. */
export async function runCyborgMission(
  gateway: CyborgUniversalGateway,
  input: { objective: string; conversationId?: string; requestedProvider?: LlmProvider },
): Promise<CyborgMission> {
  const mission = await gateway.start(input);
  gateway.assertReturnAllowed(mission);
  return mission;
}

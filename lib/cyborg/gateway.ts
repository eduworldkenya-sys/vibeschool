import { CyborgMission } from './contracts';
import { CyborgRuntime } from './runtime';

export const CYBORG_GATEWAY_ID = 'vibeschool.cyborg.universal-llm-gateway.v1';
export const NO_DIRECT_LLM_CALLS = 'NO_DIRECT_LLM_CALLS';
export const PREMATURE_MISSION_RETURN = 'PREMATURE_MISSION_RETURN';

export type LlmProvider = 'openai' | 'anthropic' | 'google' | 'local' | (string & {});

export interface CyborgModelRequest {
  provider: LlmProvider;
  model: string;
  missionId: string;
  messages: unknown[];
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

export interface MissionIntake {
  createOrResume(input: { objective: string; conversationId?: string; requestedProvider?: LlmProvider }): Promise<CyborgMission>;
}

export async function invokeCyborgModel(adapter: CyborgModelAdapter, request: CyborgModelRequest): Promise<CyborgModelResponse> {
  if (!request.missionId?.trim()) throw new Error('CYBORG_MISSION_REQUIRED');
  if (adapter.provider !== request.provider) throw new Error(`CYBORG_PROVIDER_MISMATCH:${request.provider}`);
  return adapter.invoke(request);
}

export function createAnthropicMessagesAdapter(apiKey: string): CyborgModelAdapter {
  if (!apiKey) throw new Error('CYBORG_PROVIDER_CREDENTIAL_REQUIRED:anthropic');
  return {
    provider: 'anthropic',
    async invoke(request) {
      const maxTokens = typeof request.metadata?.maxTokens === 'number' ? request.metadata.maxTokens : 1024;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: request.model, max_tokens: maxTokens, messages: request.messages }),
      });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(`CYBORG_PROVIDER_FAILURE:anthropic:${response.status}`);
      return { provider: 'anthropic', model: request.model, output: payload };
    },
  };
}

export class CyborgUniversalGateway {
  constructor(
    private readonly intake: MissionIntake,
    private readonly runtime: CyborgRuntime,
    private readonly adapters: Map<LlmProvider, CyborgModelAdapter>,
  ) {}

  async start(input: { objective: string; conversationId?: string; requestedProvider?: LlmProvider }): Promise<CyborgMission> {
    const mission = await this.intake.createOrResume(input);
    return this.runtime.run(mission.id);
  }

  async invokeModel(request: CyborgModelRequest): Promise<CyborgModelResponse> {
    const adapter = this.adapters.get(request.provider);
    if (!adapter) throw new Error(`CYBORG_PROVIDER_NOT_REGISTERED:${request.provider}`);
    return invokeCyborgModel(adapter, request);
  }

  assertReturnAllowed(mission: CyborgMission): void {
    if (!['complete', 'blocked', 'aborted'].includes(mission.state)) {
      throw new Error(PREMATURE_MISSION_RETURN);
    }
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

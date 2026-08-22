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
    if (!request.missionId) throw new Error('CYBORG_MISSION_REQUIRED');
    const adapter = this.adapters.get(request.provider);
    if (!adapter) throw new Error(`CYBORG_PROVIDER_NOT_REGISTERED:${request.provider}`);
    return adapter.invoke(request);
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

export type CyborgMissionState =
  | "received" | "investigating" | "planned" | "executing" | "verifying"
  | "repairing" | "certifying" | "complete" | "blocked" | "aborted";

export type CyborgRisk = "read" | "local_mutation" | "remote_mutation" | "production_mutation" | "owner_only" | "forbidden";
export type EvidenceQuality = "claim" | "document" | "repository" | "test" | "ci" | "production" | "independent_assurance";

export interface EvidenceRef {
  id: string; quality: EvidenceQuality; source: string; observedAt: string;
  expiresAt?: string; revision?: string; supports: string[]; contradicts?: string[];
}
export interface Hypothesis { id: string; statement: string; status: "open"|"confirmed"|"rejected"; evidenceIds: string[]; }
export interface MissionGate { id: string; description: string; required: boolean; status: "pending"|"pass"|"fail"|"blocked"; evidenceIds: string[]; }
export interface SideEffect { id: string; target: string; action: string; idempotencyKey: string; risk: CyborgRisk; rollback?: string; evidenceIds: string[]; }
export interface SkillBinding { id: string; version: string; required: boolean; dependencies: string[]; evidenceIds: string[]; }
export interface MissionBudget { maxCycles: number; maxRepeatedFailure: number; maxNoProgressCycles: number; maxToolCalls?: number; }
export interface CyborgMission {
  id: string; objective: string; state: CyborgMissionState; baseRevision: string;
  successCriteria: string[]; constraints: string[]; ownerGates: string[]; forbiddenActions: string[];
  gates: MissionGate[]; evidence: EvidenceRef[]; hypotheses: Hypothesis[]; skills: SkillBinding[];
  sideEffects: SideEffect[]; budget: MissionBudget; cycle: number; noProgressCycles: number;
  lastProgressFingerprint?: string; lease?: { holder: string; acquiredAt: string; expiresAt: string };
  parentMissionId?: string; checkpoint?: string; confidence?: number;
}

export const TERMINAL_STATES: CyborgMissionState[] = ["complete", "blocked", "aborted"];

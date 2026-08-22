import { CyborgMission, EvidenceRef, TERMINAL_STATES } from "./contracts";

const rank = { claim:0, document:1, repository:2, test:3, ci:4, production:5, independent_assurance:6 } as const;

export function fresh(e: EvidenceRef, now = new Date()) {
  return !e.expiresAt || new Date(e.expiresAt).getTime() > now.getTime();
}
export function validateMission(m: CyborgMission): string[] {
  const errors: string[] = [];
  if (!m.id || !m.objective || !m.baseRevision) errors.push("MISSION_IDENTITY_INCOMPLETE");
  if (!m.successCriteria.length) errors.push("SUCCESS_CRITERIA_MISSING");
  if (!m.gates.length) errors.push("COMPLETION_GATES_MISSING");
  if (m.cycle > m.budget.maxCycles) errors.push("CYCLE_BUDGET_EXCEEDED");
  if (m.budget.maxNoProgressCycles >= 0 && m.noProgressCycles >= m.budget.maxNoProgressCycles && m.noProgressCycles > 0) errors.push("STAGNATION_DETECTED");
  const ids = new Set(m.evidence.map(e => e.id));
  for (const g of m.gates) for (const id of g.evidenceIds) if (!ids.has(id)) errors.push(`MISSING_EVIDENCE:${g.id}:${id}`);
  for (const s of m.sideEffects) if (!s.idempotencyKey) errors.push(`NON_IDEMPOTENT_SIDE_EFFECT:${s.id}`);
  return errors;
}
export function contradictions(m: CyborgMission) {
  const supported = new Set(m.evidence.flatMap(e => e.supports));
  return m.evidence.flatMap(e => (e.contradicts || []).filter(c => supported.has(c)).map(c => `${e.id}:${c}`));
}
export function mayComplete(m: CyborgMission, now = new Date()): { ok:boolean; reasons:string[] } {
  const reasons = validateMission(m);
  if (m.gates.some(g => g.required && g.status !== "pass")) reasons.push("REQUIRED_GATE_NOT_PASSING");
  if (m.evidence.some(e => !fresh(e, now) && m.gates.some(g => g.evidenceIds.includes(e.id)))) reasons.push("STALE_GATE_EVIDENCE");
  if (contradictions(m).length) reasons.push("CONTRADICTORY_EVIDENCE");
  if (m.hypotheses.some(h => h.status === "open")) reasons.push("OPEN_HYPOTHESIS");
  if (m.skills.some(s => s.required && !s.evidenceIds.length)) reasons.push("REQUIRED_SKILL_UNPROVEN");
  if (!m.evidence.some(e => fresh(e, now) && rank[e.quality] >= rank.test)) reasons.push("NO_EXECUTABLE_PROOF");
  if (!m.evidence.some(e => fresh(e, now) && e.quality === "independent_assurance")) reasons.push("NO_INDEPENDENT_ASSURANCE");
  return { ok: reasons.length === 0, reasons };
}
export function transition(m: CyborgMission, next: CyborgMission["state"]): CyborgMission {
  if (TERMINAL_STATES.includes(m.state)) throw new Error("TERMINAL_MISSION_IMMUTABLE");
  if (next === "complete") { const c = mayComplete(m); if (!c.ok) throw new Error(`PREMATURE_COMPLETION:${c.reasons.join(",")}`); }
  return { ...m, state: next };
}
export function nextCycle(m: CyborgMission, progressFingerprint: string): CyborgMission {
  const repeated = m.lastProgressFingerprint === progressFingerprint;
  const n = { ...m, cycle:m.cycle+1, noProgressCycles: repeated ? m.noProgressCycles+1 : 0, lastProgressFingerprint:progressFingerprint };
  const errors = validateMission(n); if (errors.includes("CYCLE_BUDGET_EXCEEDED") || errors.includes("STAGNATION_DETECTED")) return { ...n, state:"blocked" };
  return n;
}

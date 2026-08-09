export type CertificationState = "not_started" | "investigating" | "implementing" | "testing" | "pass" | "partial" | "fail"

export type CertificationEvidence = {
  kind: "code" | "test" | "database" | "runtime" | "security" | "research"
  ref: string
  detail: string
}

export type CertificationQuestion = {
  id: number
  title: string
  state: CertificationState
  evidence: CertificationEvidence[]
  blockers: string[]
}

export function canMarkPass(question: CertificationQuestion) {
  const evidenceKinds = new Set(question.evidence.map((item) => item.kind))
  const hasImplementationEvidence = evidenceKinds.has("code") || evidenceKinds.has("database") || evidenceKinds.has("runtime")
  const hasVerificationEvidence = evidenceKinds.has("test") || evidenceKinds.has("runtime") || evidenceKinds.has("security")
  return question.blockers.length === 0 && hasImplementationEvidence && hasVerificationEvidence
}

export function advanceQuestion(question: CertificationQuestion, next: CertificationState): CertificationQuestion {
  if (next === "pass" && !canMarkPass(question)) {
    throw new Error(`Question ${question.id} cannot pass without implementation and verification evidence.`)
  }
  return { ...question, state: next }
}

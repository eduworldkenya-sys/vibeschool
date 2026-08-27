export type LearningCheckpointType =
  | "multiple_choice"
  | "sequence_builder"
  | "source_analysis"
  | "structured_response"
  | "essay_evaluation";

export interface LearningCheckpointFeedback {
  isCorrect: boolean;
  explanation: string;
  misconceptionLabel?: string;
  remedialConceptId?: string;
}

export interface LearningCheckpointChoice {
  id: string;
  label: string;
  feedback: LearningCheckpointFeedback;
}

export interface LearningCheckpointSpec {
  id: string;
  type: LearningCheckpointType;
  prompt: string;
  instructions?: string;
  outcomeIds?: string[];
  choices?: LearningCheckpointChoice[];
  correctSequence?: string[];
  rubric?: Array<{ id: string; label: string; marks: number }>;
  maxMarks?: number;
  remediation?: {
    title?: string;
    explanation?: string;
    targetBlockId?: string;
  };
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

function parseFeedback(value: unknown): LearningCheckpointFeedback | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.isCorrect !== "boolean" || typeof input.explanation !== "string") return null;
  return {
    isCorrect: input.isCorrect,
    explanation: input.explanation,
    misconceptionLabel: typeof input.misconceptionLabel === "string" ? input.misconceptionLabel : undefined,
    remedialConceptId: typeof input.remedialConceptId === "string" ? input.remedialConceptId : undefined,
  };
}

export function parseLearningCheckpoint(value: unknown, fallbackId?: string): LearningCheckpointSpec | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const type = input.type;
  if (
    type !== "multiple_choice" &&
    type !== "sequence_builder" &&
    type !== "source_analysis" &&
    type !== "structured_response" &&
    type !== "essay_evaluation"
  ) return null;

  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) return null;
  const id = typeof input.id === "string" && input.id.trim() ? input.id : fallbackId;
  if (!id) return null;

  const choices = Array.isArray(input.choices)
    ? input.choices.flatMap((raw) => {
        if (!raw || typeof raw !== "object") return [];
        const choice = raw as Record<string, unknown>;
        const feedback = parseFeedback(choice.feedback);
        if (typeof choice.id !== "string" || typeof choice.label !== "string" || !feedback) return [];
        return [{ id: choice.id, label: choice.label, feedback }];
      })
    : undefined;

  return {
    id,
    type,
    prompt,
    instructions: typeof input.instructions === "string" ? input.instructions : undefined,
    outcomeIds: asStringArray(input.outcomeIds),
    choices,
    correctSequence: asStringArray(input.correctSequence),
    rubric: Array.isArray(input.rubric)
      ? input.rubric.flatMap((raw) => {
          if (!raw || typeof raw !== "object") return [];
          const item = raw as Record<string, unknown>;
          if (typeof item.id !== "string" || typeof item.label !== "string" || typeof item.marks !== "number") return [];
          return [{ id: item.id, label: item.label, marks: item.marks }];
        })
      : undefined,
    maxMarks: typeof input.maxMarks === "number" ? input.maxMarks : undefined,
    remediation: input.remediation && typeof input.remediation === "object"
      ? {
          title: typeof (input.remediation as Record<string, unknown>).title === "string" ? String((input.remediation as Record<string, unknown>).title) : undefined,
          explanation: typeof (input.remediation as Record<string, unknown>).explanation === "string" ? String((input.remediation as Record<string, unknown>).explanation) : undefined,
          targetBlockId: typeof (input.remediation as Record<string, unknown>).targetBlockId === "string" ? String((input.remediation as Record<string, unknown>).targetBlockId) : undefined,
        }
      : undefined,
  };
}

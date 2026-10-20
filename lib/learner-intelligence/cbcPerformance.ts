/** Canonical CBC rubric interpretation for stored Supabase performance values.
 * Keep exam percentages separate from CBC competency observations.
 * Unrecognized values remain unknown rather than becoming false support alerts.
 */
export type CbcRubric = {
  code: "EE" | "ME" | "AE" | "BE";
  label: string;
  tone: "good" | "warn" | "bad";
  needsSupport: boolean;
};

const RUBRICS: Record<string, CbcRubric> = {
  exceeds_expectation: { code: "EE", label: "Exceeds expectations", tone: "good", needsSupport: false },
  meets_expectation: { code: "ME", label: "Meets expectations", tone: "good", needsSupport: false },
  approaches_expectation: { code: "AE", label: "Approaches expectations", tone: "warn", needsSupport: true },
  below_expectation: { code: "BE", label: "Below expectations", tone: "bad", needsSupport: true },
};

const LEGACY_CODES: Record<string, string> = {
  EE: "exceeds_expectation",
  ME: "meets_expectation",
  AE: "approaches_expectation",
  BE: "below_expectation",
};

export function cbcPerformance(value: string | null | undefined): CbcRubric | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return RUBRICS[key] ?? RUBRICS[LEGACY_CODES[key.toUpperCase()]] ?? null;
}

// Shared teaching-level type for the TSC recruitment guide.
// School-level vacancy matching will be enabled only with reconciled, cited TSC appendices.
// Do not ship fictional schools as recruitment results.
export type TeachingLevel = "primary" | "junior" | "secondary";

/** Three minimum eligibility declarations from the TSC 10 November 2026 notice. */
export type TscMinimumChecks = { citizen: boolean; qualification: boolean; registration: boolean };
export function meetsTscRecruitmentMinimum(checks: TscMinimumChecks): boolean {
  return checks.citizen && checks.qualification && checks.registration;
}

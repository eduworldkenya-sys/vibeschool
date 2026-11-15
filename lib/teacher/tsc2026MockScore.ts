import type { TeachingLevel } from "./tscSandboxMatching";

// TSC 2026/2027 recruitment score-sheet modelling: this is an applicant self-check,
// NOT an official selection result, qualification verification or predicted ranking.
// Post-primary: TSC Circular 15/2026, Appendix I(a), pages 14-15:
// https://cbckenyahub.com/wp-content/uploads/2026/11/GUIDELINES-FOR-RECRUITMENT-OF-TEACHERS-POST-PRIMARY-INSTITUTIONS-ON-PP-2026-FY-1.pdf
// Primary: TSC Circular 20/2026, 21 October 2026; 2026 score guide transcribed at:
// https://teachersupdates.co.ke/articles/tsc-primary-teacher-recruitment-guidelines-2026-score-sheet-documents-and
// County and sub-county preferences are considered separately by TSC; they have no
// numerical marks in these panels' score sheets. Separate PWD score sheets are not modelled.

export type QualificationBand =
  | "p1-6-28" | "p1-29-50" | "p1-51-64"
  | "degree-top" | "degree-middle" | "degree-pass"
  | "diploma-top" | "diploma-middle" | "diploma-pass";
export type AgeBand = "primary-43" | "primary-44-46" | "primary-47-49" | "primary-50"
  | "post-44" | "post-45-49" | "post-50";
export type InternshipBand = "none" | "under-12" | "12-plus";

export type TscMockInputs = {
  level: TeachingLevel;
  qualification: QualificationBand | "";
  ageBand: AgeBand | "";
  qualifyingYear: number | null;
  internship: InternshipBand | "";
};
export type TscMockScore = {
  qualification: number;
  age: number;
  qualifyingYear: number;
  internship: number;
  maxQualification: number;
  maxAge: number;
  maxQualifyingYear: number;
  maxInternship: number;
  total: number;
  maximum: 100;
};

const qualificationBands: Record<QualificationBand, number> = {
  "p1-6-28": 5, "p1-29-50": 3, "p1-51-64": 2,
  "degree-top": 5, "degree-middle": 3, "degree-pass": 2,
  "diploma-top": 5, "diploma-middle": 3, "diploma-pass": 2,
};

const primaryAge: Partial<Record<AgeBand, number>> = {
  "primary-43": 5, "primary-44-46": 10, "primary-47-49": 15, "primary-50": 20,
};
const postAge: Partial<Record<AgeBand, number>> = {
  "post-44": 3, "post-45-49": 5, "post-50": 7,
};
const postInternship: Record<InternshipBand, number> = {
  none: 0, "under-12": 50, "12-plus": 70,
};

export function tsc2026MockScore(input: TscMockInputs): TscMockScore | null {
  const { level, qualification, ageBand, qualifyingYear, internship } = input;
  if (!qualification || !ageBand || qualifyingYear === null
      || !Number.isInteger(qualifyingYear) || qualifyingYear < 1950 || qualifyingYear > 2026) return null;
  const isPrimary = level === "primary";
  if (isPrimary && !internship) {
    // Primary has no scored internship category.
  } else if (!isPrimary && !internship) return null;
  if (!isPrimary && qualification.startsWith("p1-")) return null;
  const age = (isPrimary ? primaryAge : postAge)[ageBand];
  if (age === undefined) return null;
  const baseQualification = qualificationBands[qualification];
  if (baseQualification === undefined) return null;
  const marks = isPrimary
    ? {
        qualification: baseQualification,
        age,
        qualifyingYear: qualifyingYear <= 2010 ? 75 : 70 - (qualifyingYear - 2011) * 4,
        internship: 0,
        maxQualification: 5, maxAge: 20, maxQualifyingYear: 75, maxInternship: 0,
      }
    : {
        qualification: baseQualification === 5 ? 3 : baseQualification === 3 ? 2 : 1,
        age,
        qualifyingYear: qualifyingYear <= 2010 ? 20 : 20 - (qualifyingYear - 2010),
        internship: postInternship[internship as InternshipBand],
        maxQualification: 3, maxAge: 7, maxQualifyingYear: 20, maxInternship: 70,
      };
  return { ...marks, total: marks.qualification + marks.age + marks.qualifyingYear + marks.internship, maximum: 100 };
}

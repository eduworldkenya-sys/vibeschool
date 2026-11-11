// Deliberately synthetic fixtures. These are not TSC school records or live vacancies.
// Replace only with verified source-attributed records in a separate release.
export type TeachingLevel = "primary" | "junior" | "secondary";

export type DemoOpening = {
  id: string;
  school: string;
  county: string;
  level: TeachingLevel;
  subjects: readonly string[];
  places: number;
};

export const DEMO_OPENINGS: readonly DemoOpening[] = [
  { id: "P-01", school: "Example Primary School A", county: "Murang'a", level: "primary", subjects: [], places: 1 },
  { id: "P-02", school: "Example Primary School B", county: "Kilifi", level: "primary", subjects: [], places: 1 },
  { id: "J-01", school: "Example Junior School A", county: "Kiambu", level: "junior", subjects: ["Mathematics", "Integrated Science"], places: 1 },
  { id: "J-02", school: "Example Junior School B", county: "Nakuru", level: "junior", subjects: ["English", "Social Studies"], places: 1 },
  { id: "S-01", school: "Example Secondary School A", county: "Murang'a", level: "secondary", subjects: ["Mathematics", "Physics"], places: 1 },
  { id: "S-02", school: "Example Secondary School B", county: "Kiambu", level: "secondary", subjects: ["English", "Literature"], places: 1 },
  { id: "S-03", school: "Example Secondary School C", county: "Kilifi", level: "secondary", subjects: ["Biology", "Geography"], places: 1 },
  { id: "S-04", school: "Example Secondary School D", county: "Kirinyaga", level: "secondary", subjects: ["Kiswahili", "History"], places: 1 },
  { id: "S-05", school: "Example Secondary School E", county: "Nyeri", level: "secondary", subjects: ["Mathematics", "Chemistry"], places: 1 },
  { id: "S-06", school: "Example Secondary School F", county: "Nakuru", level: "secondary", subjects: ["Biology", "Chemistry"], places: 1 },
];

export const SUBJECT_OPTIONS = [
  "Agriculture", "Biology", "Business Studies", "Chemistry", "Computer Studies",
  "CRE", "English", "Geography", "History", "Integrated Science",
  "Kiswahili", "Literature", "Mathematics", "Physics", "Social Studies",
] as const;

export type MatchFilters = {
  level: TeachingLevel;
  subjectOne: string;
  subjectTwo: string;
  county: string;
};

function norm(text: string) {
  return text.trim().toLocaleLowerCase("en-KE");
}

export function matchDemoOpenings(filters: MatchFilters) {
  const first = norm(filters.subjectOne);
  const second = norm(filters.subjectTwo);
  const ready = filters.level === "primary" || Boolean(first && second && first !== second);

  if (!ready) return { ready, matches: [] as DemoOpening[], inOtherCounties: [] as DemoOpening[] };

  const relevant = DEMO_OPENINGS.filter(opening => {
    if (opening.level !== filters.level) return false;
    if (filters.level === "primary") return true;
    const pair = opening.subjects.map(norm);
    return pair.length === 2 && pair.includes(first) && pair.includes(second);
  });
  const county = norm(filters.county);
  return {
    ready,
    matches: relevant.filter(opening => !county || norm(opening.county) === county),
    inOtherCounties: county ? relevant.filter(opening => norm(opening.county) !== county) : [],
  };
}

// November 2026 recruitment county allocations, reported by The Kenya Times
// on 11 November 2026. They are NOT individual school/subject vacancies.
// This curated, dated source is an independent secondary report, not a signed
// TSC appendix. Do not derive subject-specific vacancy availability from it.
export const COUNTY_ALLOCATION_SOURCE =
  "https://thekenyatimes.com/jobs-careers/breakdown-of-tsc-teaching-vacancies-in-primary-junior-and-secondary-schools-across-47-counties/";
export const OFFICIAL_TSC_ADVERTS =
  "https://www.tsc.go.ke/index.php/downloads-b/category/99-current-adverts";

export type LevelWithCountyAllocation = "primary" | "secondary";
export type ReportedCountyAllocation = { county: string; primary: number; secondary: number };
export const REPORTED_COUNTY_ALLOCATIONS: readonly ReportedCountyAllocation[] = [
  { county: "Baringo", primary: 77, secondary: 34 },
  { county: "Bomet", primary: 33, secondary: 21 },
  { county: "Bungoma", primary: 296, secondary: 90 },
  { county: "Busia", primary: 146, secondary: 37 },
  { county: "Elgeyo Marakwet", primary: 17, secondary: 22 },
  { county: "Embu", primary: 81, secondary: 43 },
  { county: "Garissa", primary: 138, secondary: 26 },
  { county: "Homa Bay", primary: 154, secondary: 40 },
  { county: "Isiolo", primary: 16, secondary: 2 },
  { county: "Kajiado", primary: 114, secondary: 17 },
  { county: "Kakamega", primary: 389, secondary: 96 },
  { county: "Kericho", primary: 51, secondary: 36 },
  { county: "Kiambu", primary: 72, secondary: 123 },
  { county: "Kilifi", primary: 206, secondary: 31 },
  { county: "Kirinyaga", primary: 47, secondary: 54 },
  { county: "Kisii", primary: 107, secondary: 59 },
  { county: "Kisumu", primary: 240, secondary: 64 },
  { county: "Kitui", primary: 337, secondary: 54 },
  { county: "Kwale", primary: 113, secondary: 15 },
  { county: "Laikipia", primary: 61, secondary: 43 },
  { county: "Lamu", primary: 39, secondary: 12 },
  { county: "Machakos", primary: 145, secondary: 78 },
  { county: "Makueni", primary: 151, secondary: 77 },
  { county: "Mandera", primary: 91, secondary: 22 },
  { county: "Marsabit", primary: 89, secondary: 4 },
  { county: "Meru", primary: 131, secondary: 75 },
  { county: "Migori", primary: 122, secondary: 48 },
  { county: "Mombasa", primary: 48, secondary: 16 },
  { county: "Murang'a", primary: 98, secondary: 133 },
  { county: "Nairobi", primary: 129, secondary: 68 },
  { county: "Nakuru", primary: 102, secondary: 100 },
  { county: "Nandi", primary: 40, secondary: 34 },
  { county: "Narok", primary: 256, secondary: 21 },
  { county: "Nyamira", primary: 107, secondary: 27 },
  { county: "Nyandarua", primary: 170, secondary: 79 },
  { county: "Nyeri", primary: 121, secondary: 113 },
  { county: "Samburu", primary: 104, secondary: 5 },
  { county: "Siaya", primary: 151, secondary: 70 },
  { county: "Taita Taveta", primary: 42, secondary: 15 },
  { county: "Tana River", primary: 52, secondary: 6 },
  { county: "Tharaka Nithi", primary: 101, secondary: 33 },
  { county: "Trans Nzoia", primary: 105, secondary: 41 },
  { county: "Turkana", primary: 198, secondary: 12 },
  { county: "Uasin Gishu", primary: 32, secondary: 20 },
  { county: "Vihiga", primary: 72, secondary: 34 },
  { county: "Wajir", primary: 105, secondary: 17 },
  { county: "West Pokot", primary: 113, secondary: 19 },
];

export function countyKey(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export function reportedAllocation(level: "primary" | "junior" | "secondary", county: string) {
  // Junior-school county counts are not verified in this source; national only.
  if (level === "junior") return { count: county ? null : 25, source: "national" as const };
  if (!county) return { count: level === "primary" ? 5609 : 2086, source: "national" as const };
  const row = REPORTED_COUNTY_ALLOCATIONS.find(item => countyKey(item.county) === countyKey(county));
  return { count: row ? row[level] : null, source: "county" as const };
}

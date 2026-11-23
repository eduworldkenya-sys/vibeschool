/**
 * Presentation-only timetable subject colours.
 * Same canonical subject name always receives the same colour across
 * teacher calendar, daily cards and Insights; no stored user colour IDs.
 * Neutral activity blocks retain the existing periodAppearance palette.
 */
export type SubjectTone = { background: string; foreground: string; border: string };

const tones: readonly SubjectTone[] = [
  { background: "#eef3ff", foreground: "#24478c", border: "#547bcb" },
  { background: "#eaf7ee", foreground: "#206140", border: "#399466" },
  { background: "#fff4e7", foreground: "#844b13", border: "#cd852a" },
  { background: "#f3ecff", foreground: "#5f3b91", border: "#9b78d0" },
  { background: "#e8f6f8", foreground: "#246675", border: "#52a3ad" },
  { background: "#fff0f3", foreground: "#8c354d", border: "#ca6c88" },
  { background: "#f4f4e9", foreground: "#696025", border: "#aaa052" },
  { background: "#edf2f5", foreground: "#405a6d", border: "#7b9bab" },
];

function canonical(name: string): string {
  return name.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
}

const known: Record<string, number> = {
  "mathematics": 0, "maths": 0,
  "english": 1, "english language activities": 1,
  "kiswahili": 2, "kiswahili lugha": 2,
  "science and technology": 4, "integrated science": 4, "science": 4,
  "creative activities": 3, "creative arts": 3, "creative arts and sports": 3,
  "social studies": 5, "history": 5, "geography": 5,
  "religious education": 6, "cre": 6, "ire": 6, "hre": 6,
  "agriculture": 7, "agriculture and nutrition": 7,
};

export function subjectTone(name: string): SubjectTone {
  const value = canonical(name);
  const matched = known[value];
  if (matched !== undefined) return tones[matched];
  // FNV-1a creates a stable category for other school-specific subjects.
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return tones[(hash >>> 0) % tones.length];
}

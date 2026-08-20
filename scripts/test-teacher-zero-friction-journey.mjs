import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const flow = read("components/teacher/LessonFlowCard.tsx");
const notes = read("app/teacher/lesson-notes/page.tsx");

const mustContain = (text, needle, label) => {
  if (!text.includes(needle)) {
    throw new Error(`${label}: missing ${needle}`);
  }
};

mustContain(flow, "Open lesson notes", "Teacher daily flow");
mustContain(flow, "/teacher/lesson-notes?lessonPlanId=", "Teacher daily flow");
mustContain(flow, "Lesson plan", "Teacher daily flow");
mustContain(flow, "Take Attendance", "Teacher daily flow");
mustContain(flow, "Assign Task", "Teacher daily flow");
mustContain(flow, "Record Assessment", "Teacher daily flow");
mustContain(flow, "Write Reflection", "Teacher daily flow");
mustContain(flow, "Record Progress", "Teacher daily flow");
mustContain(flow, "Prepare Next Lesson", "Teacher daily flow");

mustContain(notes, ".from(\"lesson_plans\")", "Lesson notes workspace");
mustContain(notes, "parseLessonPlanBody", "Lesson notes workspace");
mustContain(notes, "list_teaching_resources", "Lesson notes workspace");
mustContain(notes, ".eq(\"sub_strand_id\", subStrandId)", "Lesson notes workspace");
mustContain(notes, ".eq(\"curriculum_id\", curriculumId as string)", "Lesson notes workspace");
mustContain(notes, ".eq(\"status\", \"published\")", "Lesson notes workspace");
mustContain(notes, "These chapters carry the same curriculum identity as this lesson.", "Lesson notes workspace");

for (const forbidden of ["ilike(", "textSearch(", "similarity(", "embedding", "fuzzy"]) {
  if (notes.includes(forbidden)) {
    throw new Error(`Lesson notes workspace must not use fuzzy curriculum matching: ${forbidden}`);
  }
}

if (!flow.includes("lessonPlanId ?") || !flow.includes("Prepare lesson notes")) {
  throw new Error("Lesson notes must fail safely to lesson preparation when no plan exists.");
}

console.log("Teacher zero-friction journey contract: PASS");

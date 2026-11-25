// Synthetic plan content, using the production section codec and readiness contract.
import {EMPTY_LESSON_PLAN_SECTIONS,parseGeneratedLessonPlan,serializeLessonPlanBody,type LessonPlanSections,type LessonPlanSectionKey} from "@/lib/teaching/lessonPlanCodec";
import {evaluateLessonReadiness} from "@/lib/teaching/lessonReadiness";
import type {Occurrence} from "./preview-state";
import type {SchemeItem} from "./teach-data";
import {curriculumUnits} from "./teach-data";
export type SamplePlan={id:string;occurrenceId:string;schemeId:string|null;sections:LessonPlanSections};
export const planLabels:Record<LessonPlanSectionKey,string>={objectives:"Learning objectives",resources:"Teaching resources",introduction:"Introduction",development:"Development",consolidation:"Consolidation",assessmentHook:"Assessment",homework:"Homework / follow-up",differentiation:"Differentiation"};
export function initialPlanSections(row:Occurrence,scheme?:SchemeItem):LessonPlanSections{
 const unit=curriculumUnits.find(x=>x.id===scheme?.unitId);
 const outcomes=unit?.outcomes.filter(x=>scheme?.outcomeIds.includes(x.id)).map((x,i)=>(i+1)+". "+x.text).join("\n")??"";
 return {...EMPTY_LESSON_PLAN_SECTIONS,objectives:outcomes};
}
export function samplePlanSections(row:Occurrence,scheme?:SchemeItem):LessonPlanSections{
 const seed=initialPlanSections(row,scheme);
 const topic=row.topic;
 const objective=seed.objectives||"1. Describe the main features of "+topic+" using an example.";
 return {objectives:objective,resources:"- Sample activity sheet\n- Classroom board",
 introduction:"Timing: Introduction (5 min)\nKey inquiry question: What do we already know about "+topic+"?",
 development:"Timing: Development (20 min)\nTeaching points / teacher notes:\n1. Explain "+topic+" using a familiar classroom example.\n2. Compare two examples and discuss their differences.\nLearner activities:\n1. Learners work in pairs to discuss and record an example.\nCheck-for-understanding questions and expected answers:\n1. How would you explain "+topic+" to a partner?\nExpected answer: A clear explanation with a relevant example.\nMisconceptions to watch:\n- Check that learners use examples accurately rather than memorising labels.",
 consolidation:"Timing: Consolidation (5 min)\n1. Ask learners to summarise the main idea.\n2. Review common errors with the class.",
 assessmentHook:"Timing: Assessment (5 min)\nObjectives being assessed:\n"+objective+"\nPrepared checks:\n1. Explain the main idea and give an example?\nTotal lesson time: 35/35 min",
 homework:"Write a short explanation and one example from the lesson.",
 differentiation:"1. Support learners with a worked example and guided prompts.\n2. Stretch learners by asking them to explain a new example."};
}
export function planReview(sections:LessonPlanSections){
 const parsed=parseGeneratedLessonPlan(sections);
 return parsed?evaluateLessonReadiness(serializeLessonPlanBody(parsed)):{ready:false,reasons:["Invalid or oversized lesson plan section."]};
}
export function initialPlans(rows:Occurrence[],scheme:SchemeItem[]):Record<string,SamplePlan>{
 return Object.fromEntries(rows.filter(row=>row.planId).map(row=>[row.id,{id:row.planId!,occurrenceId:row.id,schemeId:row.schemeId,sections:samplePlanSections(row,scheme.find(x=>x.id===row.schemeId))}]));
}
export const previewWeekStart="2026-11-23";
export function moveWeek(date:string,delta:number){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+delta*7);return d.toISOString().slice(0,10)}
export function inPreviewWeek(date:string,start:string){return date>=start&&date<moveWeek(start,1)}

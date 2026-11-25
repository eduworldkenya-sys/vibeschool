// Synthetic teaching catalogue: illustrative only, not official KICD outcomes.
import type {Scope,Occurrence} from "./preview-state";
export type CurriculumUnit=Scope & {id:string;strand:string;subStrand:string;outcomes:{id:string;text:string}[]};
export type SchemeStatus="planned"|"teaching"|"done"|"cancelled";
export type SchemeItem=Scope & {id:string;unitId:string|null;outcomeIds:string[];term:number;week:number;topic:string;strand:string;status:SchemeStatus;reflection:string;occurrenceId:string|null;source:"curriculum"|"teacher";planDraft:string};
export const sampleTerms=[1,2,3];
export const sampleWeeks=[1,2,3,4,5,6,7,8,9,10,11,12,13];
export const sampleCurrentTerm=3,sampleCurrentWeek=11;
function unit(classId:string,subjectId:string,id:string,strand:string,subStrand:string,topics:string[]):CurriculumUnit{
 return {classId,subjectId,id,strand,subStrand,outcomes:topics.map((text,i)=>({id:id+"-outcome-"+(i+1),text}))};
}
export const curriculumUnits:CurriculumUnit[]=[
 unit("class-4","english","unit-homophones","Grammar in use","Homophones",["Distinguish words that sound alike but have different meanings.","Use selected homophones in sentences."]),
 unit("class-4","english","unit-reading","Reading","Reading comprehension",["Identify the main idea in a short passage.","Answer questions using evidence from the passage."]),
 unit("class-4","english","unit-vocabulary","Grammar in use","Vocabulary",["Use new words appropriately in short sentences."]),
 unit("class-4","math","unit-place-value","Numbers","Place value",["Identify the place value of digits in whole numbers.","Represent numbers in expanded form."]),
 unit("class-4","math","unit-time","Measurement","Time",["Read and record time on a clock."]),
 unit("class-4","science","unit-plants","Living things","Plants",["Observe and describe the main parts of a plant."]),
 unit("class-5","social","unit-directions","The environment","Compass directions",["Use cardinal directions to describe relative location."]),
 unit("class-5","english","unit-sentences","Writing","Writing sentences",["Write clear sentences with appropriate punctuation."]),
 unit("class-5","english","unit-writing","Writing","Paragraphs",["Organise related sentences into a short paragraph."]),
 unit("class-5","math","unit-fractions","Numbers","Fractions",["Represent a fraction using equal parts."])
];
export const unitForOccurrence=(row:Occurrence)=>curriculumUnits.find(u=>u.classId===row.classId&&u.subjectId===row.subjectId&&u.subStrand===row.topic);
export function initialScheme(occurrences:Occurrence[]):SchemeItem[]{
 return occurrences.flatMap(row=>{
  const u=unitForOccurrence(row);if(!row.schemeId||!u)return [];
  return [{id:row.schemeId,classId:row.classId,subjectId:row.subjectId,unitId:u.id,outcomeIds:u.outcomes.map(x=>x.id),term:sampleCurrentTerm,week:sampleCurrentWeek,topic:row.topic,strand:u.strand,status:row.delivery==="taught"?"done":row.delivery==="teaching"?"teaching":"planned",reflection:"",occurrenceId:row.id,source:"curriculum",planDraft:""}];
 });
}
export function suggestedUnits(items:SchemeItem[],scope:Scope,term:number){
 return curriculumUnits.filter(u=>u.classId===scope.classId&&u.subjectId===scope.subjectId&&!items.some(x=>x.classId===scope.classId&&x.subjectId===scope.subjectId&&x.term===term&&x.unitId===u.id));
}
export function validPair(scope:Scope,assignments:Scope[]){return assignments.some(a=>a.classId===scope.classId&&a.subjectId===scope.subjectId)}
export function validTermWeek(term:number,week:number){return sampleTerms.includes(term)&&sampleWeeks.includes(week)}

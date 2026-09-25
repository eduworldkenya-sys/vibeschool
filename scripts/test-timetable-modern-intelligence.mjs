import assert from "node:assert/strict";
import { evaluateModernTimetable, canPublishTimetable, shouldGenerateOccurrence, rankPlacementCandidates } from "../lib/timetable/modernIntelligence";

const slot=(overrides={})=>({id:"s1",school_id:"sch",teacher_id:"t1",class_id:"c1",subject_id:"math",day_of_week:1,start_time:"08:00",end_time:"08:40",room:"R1",period_id:null,allocation_units:1,recurrence_pattern:"EVERY_WEEK",effective_from:"2026-01-01",effective_until:null,...overrides});

const under=[{class_id:"c1",subject_id:"math",class_name:"10 East",stream:"East",subject_name:"Mathematics",grade:"10",lessons_per_week:5,scheduled_count:4,status:"UNDER"}];
let findings=evaluateModernTimetable({slots:[slot()],loads:under});
assert.equal(canPublishTimetable(findings),false);
assert.ok(findings.some(f=>f.code==="ALLOCATION_UNDER"));

findings=evaluateModernTimetable({slots:[slot()],loads:[],teacherAvailability:[{teacherId:"t1",dayOfWeek:1,unavailableFrom:"07:30",unavailableUntil:"09:00"}]});
assert.ok(findings.some(f=>f.code==="TEACHER_UNAVAILABLE"&&f.severity==="hard"));

findings=evaluateModernTimetable({slots:[slot()],loads:[],subjectRules:[{classId:"c1",subjectId:"math",requiresConsecutiveUnits:2}]});
assert.ok(findings.some(f=>f.code==="CONSECUTIVE_REQUIREMENT"));

assert.equal(shouldGenerateOccurrence("2026-09-25",[{date:"2026-09-25",kind:"holiday",suppressOrdinaryTeaching:true}]),false);
assert.equal(shouldGenerateOccurrence("2026-09-26",[{date:"2026-09-25",kind:"holiday",suppressOrdinaryTeaching:true}]),true);

const ranked=rankPlacementCandidates([
 {dayOfWeek:1,startTime:"08:00",endTime:"08:40"},
 {dayOfWeek:2,startTime:"08:00",endTime:"08:40"},
 {dayOfWeek:3,startTime:"13:00",endTime:"13:40"},
],[slot()],{classId:"c1",subjectId:"math",preferredDayParts:["morning"]});
assert.equal(ranked.length,2);
assert.equal(ranked[0].dayOfWeek,2);

console.log("timetable intelligence contract: PASS");

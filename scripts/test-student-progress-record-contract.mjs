import fs from 'node:fs'

function read(path){return fs.readFileSync(path,'utf8')}
function requireText(text,needle,label){if(!text.includes(needle))throw new Error(`${label}: missing ${needle}`)}
function forbidText(text,needle,label){if(text.includes(needle))throw new Error(`${label}: prohibited escape hatch`)}

const model=read('lib/learner-intelligence/progress-record.ts')
const learner=read('app/teacher/classhub/[id]/student/[studentId]/progress/page.tsx')
const klass=read('app/teacher/classhub/[id]/progress/page.tsx')
const hub=read('app/teacher/classhub/page.tsx')
const lessonProgress=read('app/teacher/progress/page.tsx')
const unsafeAny=['as','any'].join(' ')
const unsafeUnknown=['as','unknown'].join(' ')

requireText(model,"'EE' | 'ME' | 'AE' | 'BE' | 'NE'",'professional performance bands')
requireText(model,'buildOutcomeProgress','outcome projection')
requireText(model,'buildProgressHistory','longitudinal evidence history')
requireText(model,"return 'NE'",'no invented judgement')
requireText(learner,"from('competency_evidence_ledger')",'canonical evidence ledger')
requireText(learner,'curriculum_learning_outcomes(outcome_text,outcome_code)','curriculum outcome lineage')
requireText(learner,"eq('student_id',studentId)",'learner scope')
requireText(learner,"eq('class_id',classId)",'class scope')
requireText(learner,'teacher_get_operating_context','teacher authority')
requireText(learner,'Print record','professional document action')
requireText(learner,'All activities','activity filter')
requireText(learner,'All subjects','subject filter')
requireText(learner,'Search progress record','record search')
requireText(learner,"view==='history'",'history view')
requireText(learner,'Read-only history.','archive immutability messaging')
requireText(klass,"type View = 'current'|'archived'",'class lifecycle views')
requireText(klass,'Search learner or admission number','class learner search')
requireText(klass,'Needs support','teacher triage filter')
requireText(klass,".order('joined_at',{ascending:false})",'enrollment history retrieval')
requireText(klass,'archive does not delete','archive retention contract')
requireText(hub,'Student progress','class hub discoverability')

requireText(lessonProgress,'timetable_slot_id','exact teaching occurrence identity')
requireText(lessonProgress,'.from("lesson_plans")','canonical lesson plan prefill')
requireText(lessonProgress,'.eq("timetable_slot_id", exact.timetable_slot_id)','lesson occurrence binding')
requireText(lessonProgress,'.eq("taught_date", exact.occurrence_date)','dated lesson binding')
requireText(lessonProgress,'.from("homework")','linked homework prefill')
requireText(lessonProgress,'.eq("lesson_plan_id", plan.id)','homework lesson lineage')
requireText(lessonProgress,'Prefilled for you.','teacher confirmation UX')
requireText(lessonProgress,'Participation, challenges and reflection stay blank','no invented post-lesson judgement')
requireText(lessonProgress,'Confirm & save progress','low-friction confirmation action')

for(const [source,label] of [[klass,'class progress'],[learner,'learner progress'],[lessonProgress,'lesson progress']]){
  forbidText(source,unsafeAny,label)
  forbidText(source,unsafeUnknown,label)
}

console.log('student progress record contract: PASS')

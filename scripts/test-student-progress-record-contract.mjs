import fs from 'node:fs'

function read(path){return fs.readFileSync(path,'utf8')}
function requireText(text,needle,label){if(!text.includes(needle))throw new Error(`${label}: missing ${needle}`)}

const model=read('lib/learner-intelligence/progress-record.ts')
const learner=read('app/teacher/classhub/[id]/student/[studentId]/progress/page.tsx')
const klass=read('app/teacher/classhub/[id]/progress/page.tsx')
const hub=read('app/teacher/classhub/page.tsx')

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
console.log('student progress record contract: PASS')

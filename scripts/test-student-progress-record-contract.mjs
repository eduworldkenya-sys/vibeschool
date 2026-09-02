import fs from 'node:fs'

function read(path){return fs.readFileSync(path,'utf8')}
function requireText(text,needle,label){if(!text.includes(needle))throw new Error(`${label}: missing ${needle}`)}

const model=read('lib/learner-intelligence/progress-record.ts')
const learner=read('app/teacher/classhub/[id]/student/[studentId]/progress/page.tsx')
const klass=read('app/teacher/classhub/[id]/progress/page.tsx')
const hub=read('app/teacher/classhub/page.tsx')

requireText(model,"'EE' | 'ME' | 'AE' | 'BE' | 'NE'",'professional performance bands')
requireText(model,'buildOutcomeProgress','outcome projection')
requireText(model,"return 'NE'",'no invented judgement')
requireText(learner,"from('competency_evidence_ledger')",'canonical evidence ledger')
requireText(learner,'curriculum_learning_outcomes(outcome_text,outcome_code)','curriculum outcome lineage')
requireText(learner,"eq('student_id',studentId)",'learner scope')
requireText(learner,"eq('class_id',classId)",'class scope')
requireText(learner,'teacher_get_operating_context','teacher authority')
requireText(learner,'Print record','professional document action')
requireText(learner,'All activities','activity filter')
requireText(learner,'All subjects','subject filter')
requireText(klass,'Learners needing support appear first','teacher triage')
requireText(hub,'Student progress','class hub discoverability')
console.log('student progress record contract: PASS')

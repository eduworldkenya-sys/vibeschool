import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = path => readFileSync(path,'utf8')

test('Home prioritises one action and resumes only the learner-owned saved reading',()=>{
  const home=read('app/student/page.tsx')
  assert.match(home,/getStudentHomeOsBrief\(\)/)
  assert.match(home,/resolveTaskLaunch\(task\.taskId\)/)
  assert.match(home,/getVibeLearnWorkstation\(\)/)
  assert.match(home,/desk\.continueLearning\.find\(/)
  assert.match(home,/identity\?\.studentId/)
  assert.match(home,/safeLearningRoute\(item\.actionUrl\)/)
  assert.match(home,/continueReading && nextTask && <section/)
  assert.doesNotMatch(home,/How am I progressing\?/)
  assert.match(home,/router\.push\('\/student\/marks'\)/)
  assert.match(read('app/student/student-home.css'),/@media\(max-width:500px\)/)
})

test('Learn opens existing chapter actionUrl and preserves canonical tools',()=>{
  const study=read('app/student/study/page.tsx')
  assert.match(study,/workspace\?\.continueLearning\.slice\(0,3\)/)
  assert.match(study,/safeInternalRoute\(item\.actionUrl\)/)
  assert.match(study,/<StudentLearningFeatureLinks mode="learn"/)
  assert.match(read("components/student/StudentLearningFeatureLinks.tsx"),/topicPracticeHref\(subject\)/)
  assert.match(study,/href="\/student\/vibelearn\/revision"/)
  assert.match(study,/href="\/student\/tasks"/)
  assert.match(study,/href=\{browseHref\}/)
  assert.match(study,/recogniseLearnerGrade\(identity\.className\)/)
})

test('Topic Practice feedback is accessible, non-musical and opt-in',()=>{
  const comp=read('components/student/LearningFeedback.tsx')
  const styles=read('components/student/learning-feedback.css')
  assert.match(comp,/SOUND_KEY/)
  assert.match(comp,/localStorage\.getItem\(SOUND_KEY\) === 'on'/)
  assert.match(comp,/AudioContext/)
  assert.match(comp,/aria-pressed=\{soundOn\}/)
  assert.match(comp,/role="status" aria-live="polite"/)
  assert.match(styles,/prefers-reduced-motion:reduce/)
  assert.match(read('components/student/CanonicalTopicPractice.tsx'),/<LearningFeedback/)
  assert.match(read('app/student/vibelearn/topic-practice/page.tsx'),/<LearningFeedback/)
  assert.match(read('components/student/CanonicalTopicPractice.tsx'),/saveResponse\(/)
  assert.match(read('app/student/vibelearn/topic-practice/page.tsx'),/student_record_vibelearn_practice_skip/)
})

test('Task, progress and navigation keep canonical destinations and clear guidance',()=>{
  const tasks=read('app/student/tasks/page.tsx')
  const marks=read('app/student/marks/page.tsx')
  const layout=read('app/student/layout.tsx')
  assert.match(tasks,/Nothing assigned for action right now\. <Link href="\/student\/study"/)
  for(const route of ['/student/vibelearn/mistakes','/student/vibelearn/revision','/student/vibelearn/topic-practice','/student/study']){
    assert.ok(marks.includes('href="'+route+'"'),route+' should appear in the next step panel')
  }
  assert.match(layout,/aria-label=\{`Open \$\{homeLabel\} Home`\}/)
  assert.match(layout,/aria-label="Open learner profile"/)
  assert.match(layout,/aria-label="Open notifications"/)
  assert.match(layout,/aria-label="Go back"/)
  assert.match(read('components/student/BottomNav.tsx'),/href: "\/student\/study"/)
})


test('Progress shows separate learning evidence without mixing recall and mastery',()=>{
  const marks=read('app/student/marks/page.tsx')
  const evidence=read('components/student/LearningEvidenceOverview.tsx')
  assert.match(marks,/<MarksSession key=\{JSON.stringify\(\[identity.studentId, identity.profileId, identity.className\]\)\}/)
  assert.match(marks,/<LearningEvidenceOverview studentId=\{identity.studentId\} profileId=\{identity.profileId\}/)
  assert.ok(marks.indexOf('<LearningEvidenceOverview')<marks.indexOf('{isLoading ?'))
  assert.match(marks,/Assessment report could not be refreshed/)
  assert.match(marks,/<LearnerProgressReport/)
  assert.match(evidence,/\.eq\('viewer_id',profileId\)/)
  assert.match(evidence,/\.not\('completed_at','is',null\)/)
  assert.match(evidence,/getRevisionWorkspace\(\)/)
  assert.match(evidence,/getMyRevisionMemory\(\)/)
  assert.match(evidence,/listRevisionTopics\(grade\)/)
  assert.match(evidence,/student_get_exact_learning_recovery/)
  assert.match(evidence,/item.identity_state==='verified'/)
  assert.match(evidence,/item.recovery_evidence_met===true/)
  assert.match(evidence,/if\(active\)setState\(\{status:'error'\}\)/)
  assert.match(evidence,/data.attempts\?Math.round/)
  assert.match(evidence,/not the entire curriculum/)
  assert.doesNotMatch(evidence,/\.insert\(|\.update\(|\.upsert\(/)
})

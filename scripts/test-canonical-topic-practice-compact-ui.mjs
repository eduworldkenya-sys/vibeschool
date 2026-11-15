import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const practice=readFileSync('components/student/CanonicalTopicPractice.tsx','utf8')
const css=readFileSync('components/student/CanonicalTopicPractice.module.css','utf8')
const layout=readFileSync('app/student/layout.tsx','utf8')
const route=readFileSync('app/student/vibelearn/topic-practice/page.tsx','utf8')

test('Grade 4 and 9 use canonical Grade-neutral practice component',()=>{
  assert.match(route,/grade\\s\*\(\?:4\|9\)/i)
  assert.match(route,/<CanonicalTopicPractice grade=\{grade\}/)
  assert.match(practice,/student_list_canonical_topic_practice/)
  assert.match(practice,/attempt\.items\.length!==5 \|\| attempt\.timeLimitMinutes!==null/)
  assert.match(practice,/startOrResumeAttempt\(/)
  assert.match(practice,/saveResponse\(/)
  assert.match(practice,/submitAttempt\(/)
})

test('Topics and question use one measured viewport and existing theme',()=>{
  assert.match(practice,/className=\{styles\.shell\}/)
  assert.match(practice,/getBoundingClientRect\(\)\.top/)
  assert.match(practice,/visualViewport/)
  assert.match(practice,/styles\.topicList/)
  assert.match(practice,/styles\.questionCard/)
  assert.match(practice,/styles\.options/)
  assert.match(practice,/styles\.actions/)
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(css,/overflow-y:auto/)
  for(const token of ['--vs-card','--vs-text','--vs-border','--vs-accent','--vs-muted']){
    assert.ok(css.includes(token),token+' must follow learner theme')
  }
  assert.doesNotMatch(css,/#fff\b|#ffffff\b|#292929\b/,'Do not hardcode light/dark cards')
  assert.match(layout,/compactTopicPractice = pathname === "\/student\/vibelearn\/topic-practice"/)
  assert.match(layout,/paddingBottom: compactTopicPractice \? 0/)
})

test('Compact UI keeps saving, feedback, retry and safe finish',()=>{
  assert.match(practice,/onClick=\{\(\)=>void save\(option\.value\)\}/)
  assert.match(practice,/onClick=\{\(\)=>void save\(null\)\}/)
  assert.match(practice,/onClick=\{next\}/)
  assert.match(practice,/disabled=\{busy\|\|!seen\.has\(item\.id\)\}/)
  assert.match(practice,/onClick=\{\(\)=>void retryFeedback\(\)\}/)
  assert.match(practice,/LearningFeedback/)
  assert.match(practice,/LearningNotebookPrompt/)
  assert.match(practice,/onClick=\{\(\)=>void finish\(\)\}/)
  assert.match(practice,/disabled=\{busy\|\|!everyAnswerSaved\}/)
  assert.match(practice,/Browse Exams/)
  assert.match(css,/focus-visible/)
})

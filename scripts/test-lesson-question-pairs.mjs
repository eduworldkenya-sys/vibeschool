import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const {collectLessonQuestionPairs,formatLessonQuestionPairs} = process.argv[2]
  ? createRequire(import.meta.url)(process.argv[2])
  : await import('../lib/teaching/lessonQuestionPairs.ts')
const pair = (question,expectedAnswer) => ({question,expectedAnswer})
assert.deepEqual(collectLessonQuestionPairs([{questions:['One?','Two?'],answers:['Wrong','Wrong again']}]),[pair('One?',null),pair('Two?',null)])
assert.deepEqual(collectLessonQuestionPairs([{questions:[{question:'One?',answer:'Same'},{question:'Two?',answer:'Same'}]}]),[pair('One?','Same'),pair('Two?','Same')])
assert.deepEqual(collectLessonQuestionPairs([{questions:[{question:'One?',expectedAnswer:'1'},{question:'Two?'},{question:'Three?',expected_answer:'3'}]}]),[pair('One?','1'),pair('Two?',null),pair('Three?','3')])
assert.deepEqual(collectLessonQuestionPairs([{questions:['One?']},{answers:['1']}]),[pair('One?',null)])
assert.deepEqual(collectLessonQuestionPairs([{questions:[{question:'One?',answer:'1'},{question:'One?',answer:'2'}]}]),[pair('One?',null)])
assert.deepEqual(collectLessonQuestionPairs([{questions:[{question:'One?',answer:'1',expectedAnswer:'2'}]}]),[pair('One?',null)])
assert.deepEqual(collectLessonQuestionPairs([{section:{diagnostics:[{prompt:'One?',correct_answer:'1'}]}}]),[pair('One?','1')])
assert.deepEqual(collectLessonQuestionPairs([{questions:[{question:'One?',answer:'1'},{question:'One?',answer:'1'}]}]),[pair('One?','1')])
assert.deepEqual(collectLessonQuestionPairs([{questions:[{question:'One?',answer:'1'},'One?']}]),[pair('One?',null)])
assert.match(formatLessonQuestionPairs([pair('One?',null)]),/not supplied/)
assert.match(formatLessonQuestionPairs([pair('One?','1')]),/Expected answer: 1/)
console.log('lesson question pair regression: PASS')

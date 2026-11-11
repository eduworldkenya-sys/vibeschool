import assert from 'node:assert/strict'
import { includeGradeOneJumpingAsset } from '../lib/teaching/jumpingContentSelection'

const teacher = 'vs:g1:jumping:teacher:lesson:07'
const learner = 'vs:g1:jumping:learner:lesson:07'
assert.equal(includeGradeOneJumpingAsset(teacher,7),true)
assert.equal(includeGradeOneJumpingAsset(learner,7),true)
assert.equal(includeGradeOneJumpingAsset(teacher,8),false)
assert.equal(includeGradeOneJumpingAsset(learner,6),false)
assert.equal(includeGradeOneJumpingAsset(teacher,null),false)
assert.equal(includeGradeOneJumpingAsset(teacher,0),false)
assert.equal(includeGradeOneJumpingAsset(teacher,15),false)
assert.equal(includeGradeOneJumpingAsset(teacher,7.5),false)
assert.equal(includeGradeOneJumpingAsset('vs:g1:jumping:teacher:guide',null),true)
assert.equal(includeGradeOneJumpingAsset('vs:g1:jumping:teacher:assessment',null),true)
assert.equal(includeGradeOneJumpingAsset('chapter:existing-resource',null),true)
console.log('Grade 1 Jumping lesson-scoped source selection: PASS')

import fs from "node:fs"
import assert from "node:assert/strict"
const practice=fs.readFileSync("components/student/CanonicalTopicPractice.tsx","utf8")
const learn=fs.readFileSync("components/student/LearnActivityHub.tsx","utf8")
assert.match(practice,/const topicCards=useMemo/)
assert.match(practice,/topic\.topic==='Indices'\?'Indices and Logarithms'/)
assert.match(practice,/sets\.find\(item=>item\.in_progress\)/)
assert.match(practice,/sets\.find\(item=>item\.completed_attempts===0/)
assert.match(practice,/topicCards\.map/)
assert.match(learn,/student_list_canonical_topic_practice/)
assert.match(learn,/in_progress===true/)
assert.match(learn,/Continue practice/)
console.log("Grade 9 Topic Practice grouped-topic and canonical-resume navigation contracts passed")

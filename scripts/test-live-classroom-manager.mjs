import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const manager=readFileSync('components/live-classroom/ClassroomManager.tsx','utf8')
const parent=readFileSync('components/live-classroom/LiveClassroom.tsx','utf8')
assert.match(parent,/\{teacher&&panel&&panel!==/)
assert.match(parent,/<ClassroomManager key=\{room.id\} participants=\{participants\}/)
assert.match(manager,/participants\.filter\(p=>p\.needsHelp\)/)
assert.match(manager,/p\.answer!==null/)
assert.match(manager,/Joined does not establish current connectivity or official attendance/)
assert.match(manager,/onAcknowledge\(selected\.studentId\)/)
assert.match(manager,/disabled=\{busy\|\|stale\}/)
assert.match(manager,/!picked\.includes\(p\.studentId\)/)
assert.match(parent,/Waiting room/)
console.log('Classroom Manager source contract passed')

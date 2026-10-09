# Teacher OS redesign ledger

Baseline: `df3a4405a9a801c2dd7f6783740e0f8c4effd4b8`; candidate is an uncommitted working tree. Shared-shell or token adoption does not certify a route. “Fixture” means actual components with isolated data; “Live read” means the test account with mutations blocked. Saving and end-to-end teaching journeys remain pending. See `teacher-os-direction.md` for evidence and limitations.

| Route | Mobile | Desktop | Loading | Empty | Error | Functional | Tested | Status |
|---|---|---|---|---|---|---|---|---|
| /teacher/academics | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment/analytics | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment/bank | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment/builder/[assessmentId] | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment/builder/[assessmentId]/preview | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment/builder/item/[itemId] | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment/cat/new | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment/curriculum | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment/gradebook | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment/interventions | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment/marking | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment/new | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/assessment/review/[assessmentId] | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/attendance | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/attendance-history | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/exercises/[exId] | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/exercises | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/games | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/groups | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/homework/[hwId] | Fixture DOM | Pending | Fixture empty/read failure | Fixture | Fixture | Fixture save/retry/stale scope | Actual component + prior-defect negative control | Canonical roster/mark validation repaired; live writes pending |
| /teacher/classhub/[id]/homework | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/operations | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id] | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/progress | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/projects/[projId] | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/projects | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/requests | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/student/[studentId] | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/student/[studentId]/progress | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/classhub/[id]/workbook | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/classhub/[id]/workspace | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/classhub/add | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/classhub | Fixture + live read | Fixture + live read | Pending | Fixture | Fixture | Read/search only | Browser + contracts | Structure implemented |
| /teacher/content-assessments/[assessmentId] | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/content-materials/[derivativeId] | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/creators | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/credits | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/exams | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/from-textbook | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/help | Fixture + live read | Fixture | Pending | Pending | Pending | Read/search only | Browser + contracts | Structure implemented |
| /teacher/homework | Live read | Pending | Pending | Pending | Pending | Pending | Static preservation only | Structure implemented |
| /teacher/lesson-notes | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/lessonplan | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Structure implemented |
| /teacher/lessonplan/prepare | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/more | Fixture + live read | Fixture | Pending | Fixture | Pending | Read/search only | Browser + contracts | Structure implemented |
| /teacher/notifications | Live read | Pending | Pending | Pending | Pending | Pending | Static preservation only | Structure implemented |
| /teacher/onboarding/class | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/onboarding/school | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/onboarding/students | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/pathways | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/profile/account | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/profile | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/profile/teaching-scope | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/progress | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/pulse | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Structure implemented |
| /teacher/report-cards | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/resources | Fixture | Fixture | Pending | Fixture | Pending | Dialog only | Browser + contracts | Structure implemented; live loading capture only |
| /teacher/results | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/results/report-card/[studentId] | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/results/report-card | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/scheme/generate | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/scheme | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/schoolhub | Fixture + live read | Pending | Pending | Pending | Fixture | Live backend errors | Browser + isolated DB regression | UI repaired; database correction not applied |
| /teacher/settings | Fixture + live read | Fixture | Pending | Pending | Pending | Read/search only | Browser + contracts | Structure implemented |
| /teacher/students | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/studio/editor | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/studio/governance | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/studio | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/subjecthub | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/teach | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/teach-today | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Structure implemented |
| /teacher/teacher-guide | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/timetable | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/timetable/setup | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/tpad/evidence | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/tpad/history | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/tpad | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/tpad/self-appraisal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/twin | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/vibeconnect | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Shared shell only; review pending |
| /teacher/vibelearn/indexer | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/vibelearn | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |
| /teacher/week | Pending | Pending | Pending | Pending | Pending | Pending | Static preservation only | Tokens adopted; review pending |

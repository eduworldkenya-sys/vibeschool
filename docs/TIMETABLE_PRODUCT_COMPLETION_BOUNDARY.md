# Timetable Product Completion Boundary

The timetable is complete only when all of these product capabilities use the same canonical authority.

## Creation
- Enter an existing school timetable quickly.
- Copy a prior timetable into a future effective revision.
- Configure classes, subjects, teacher assignments, weekly allocations, periods and rooms.
- Configure subject constraints: spread, daily maximum, doubles/practicals, room needs and time preferences.
- Configure teacher availability.
- Preview teacher/class/room conflicts before save.
- Assisted placement ranks valid candidates but never bypasses hard constraints.
- School admin reviews allocation health before publication.
- Draft/review/approve/publish is the school-level target workflow; teacher self-service remains supported for schools not yet onboarded.

## Usage
- Teacher home prioritizes Now, Next and Later.
- Teach Now opens the exact dated occurrence and its Lesson Plan.
- Attendance, evidence, homework, assessment, reflection and progress remain attached to the exact teaching occurrence.
- Student timetable consumes the same active class schedule.
- Admin can inspect whole-school coverage, conflicts and workload.
- Twin consumes schedule truth; it never invents a slot.

## Operational intelligence
- A recurring slot is not proof of teaching.
- Only completed occurrences advance taught curriculum coverage.
- Holiday/closure suppresses ordinary occurrence generation.
- Missed lessons preserve curriculum debt.
- Recovery creates a linked occurrence rather than rewriting history.
- Cancellation remains auditable.
- Substitution must preserve scheduled teacher and actual teacher separately.
- Timetable revisions are effective-dated and must not rewrite historical teaching.

## Competitive intelligence
Hard constraints:
- teacher collision
- class collision
- room/resource collision
- teacher availability
- invalid assignment
- weekly under/over allocation
- practical/double consecutive requirement
- subject daily maximum

Soft intelligence:
- subject spread across the week
- preferred morning/afternoon placement
- balanced teacher workload
- avoid excessive consecutive teaching
- minimize unnecessary room movement
- preserve stable patterns between revisions
- explain why a suggested placement is preferred

## Views
- Teacher: Today / Week / workload / recovery.
- Student: Today / Week / room / current and next lesson.
- Admin: master timetable / allocation health / conflicts / workload / revisions.
- Twin: contextual Now/Next/behind-schedule signals.
- Parent: downstream learning status only unless school explicitly exposes schedule.

## Calendar
The occurrence engine must distinguish:
- normal teaching day
- weekend/non-teaching day
- public/school holiday
- school closure
- exam day
- event/assembly override
- teacher absence

No non-teaching exception may become a false missed lesson.

## Publication gate
A timetable cannot be certified for publication while hard findings exist. Warnings require human visibility but may be accepted. Every publication has an effective date and must preserve prior history.

## Future advanced layer
After the deterministic system is complete, optimization can add whole-school generation, workload balancing, elective/parallel-group optimization and multi-objective scoring. AI may explain or propose; deterministic constraints and database authority remain final.

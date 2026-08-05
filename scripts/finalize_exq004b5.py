#!/usr/bin/env python3
from pathlib import Path

path = Path('components/teacher/LessonPlanModal.tsx')
src = path.read_text()

start_anchor = '''                {planId && (
                  <button
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams({
                        classId: slot.class_id,'''

end_anchor = "                {status === 'draft' && ("

count = src.count(start_anchor)
if count != 1:
    raise SystemExit(f'ABORT: expected one legacy assessment block, found {count}')

start = src.index(start_anchor)
end = src.index(end_anchor, start)

replacement = '''                {planId && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 8,
                  }}>
                    {[
                      { type: 'exercise', label: 'Exercise', icon: '✍️' },
                      { type: 'quiz', label: 'Quiz', icon: '📊' },
                      { type: 'homework', label: 'Homework', icon: '📝' },
                      { type: 'test', label: 'CAT', icon: '📋' },
                    ].map(action => (
                      <button
                        key={action.type}
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams({
                            lessonPlanId: planId,
                            topic,
                            assessmentHook: sections.assessmentHook,
                            type: action.type,
                          })

                          const occurrenceId =
                            teachingOccurrence?.occurrenceId

                          if (occurrenceId) {
                            params.set(
                              'occurrenceId',
                              occurrenceId,
                            )
                          }

                          router.push(
                            `/teacher/assessment/new?${params.toString()}`,
                          )
                        }}
                        disabled={isbusy}
                        style={{
                          padding: '12px 10px',
                          borderRadius: 12,
                          border: '1.5px solid #4338ca',
                          background: '#eef2ff',
                          color: '#4338ca',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: isbusy
                            ? 'not-allowed'
                            : 'pointer',
                          opacity: isbusy ? 0.7 : 1,
                          fontFamily: 'inherit',
                        }}
                      >
                        {action.icon} Generate {action.label}
                      </button>
                    ))}
                  </div>
                )}

'''

updated = src[:start] + replacement + src[end:]

for removed in (
    'Generate Quiz from Lesson',
    'Create Homework from Lesson',
    '/teacher/classhub/${slot.class_id}/homework',
):
    if removed in updated:
        raise SystemExit(f'ABORT: legacy content remains: {removed}')

for required in (
    "type: 'exercise'",
    "type: 'quiz'",
    "type: 'homework'",
    "type: 'test'",
    'Generate {action.label}',
):
    if required not in updated:
        raise SystemExit(f'ABORT: required content missing: {required}')

path.write_text(updated)
print('EXQ-004B.5 Lesson Plan actions patched successfully.')

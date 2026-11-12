from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text()


lesson_source = text('lib/teaching/lessonSource.ts')
teaching_desk = text('app/teacher/teach-today/page.tsx')
scheme_route = text('app/teacher/scheme/page.tsx')

assert "'resolve_instructional_week_for_date'" in lesson_source, (
    'dated lessons must use server instructional-week authority'
)
assert 'schoolWeekOf' not in lesson_source, (
    'dated lesson resolver must not calculate instructional week in the client'
)
assert "'get_next_scheme_item'" in lesson_source, (
    'lesson resolver must use persisted Scheme progression'
)
progression = lesson_source.index(
    'progressionScheme = await loadCurrentSchemeProgression'
)
saved_lookup = lesson_source.index("if (timetableSlotId && occurrenceDate) {")
undated_guard = lesson_source.index('if (!occurrenceDate) {')
assert saved_lookup < undated_guard < progression, (
    'A dated lesson must resolve saved Scheme identity before undated progression'
)
assert "plan?.scheme_id" in lesson_source, (
    'Dated source must use the explicitly persisted Scheme relationship'
)
assert ".eq('timetable_slot_id', timetableSlotId)" in lesson_source
assert ".eq('taught_date', occurrenceDate)" in lesson_source
assert ".eq('teacher_id', userId)" in lesson_source
assert "loadCheckedScheme(plan.scheme_id)" in lesson_source
assert "loadSchemeSourceForOccurrenceFallback" not in lesson_source, (
    'Slot position cannot be used as curriculum identity'
)

assert 'label: "Scheme of Work"' in teaching_desk
assert 'href: "/teacher/scheme"' in teaching_desk
assert 'AuthoritySchemePage' in scheme_route

print('scheme upstream authority contract: PASS')

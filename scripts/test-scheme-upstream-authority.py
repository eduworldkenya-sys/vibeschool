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
    'const progressionScheme = await loadCurrentSchemeProgression'
)
occurrence_fallback = lesson_source.index(
    'const occurrenceScheme = await loadSchemeSourceForOccurrenceFallback'
)
assert progression < occurrence_fallback, (
    'Scheme progression must precede timetable-ordinal compatibility fallback'
)

assert 'label: "Scheme of Work"' in teaching_desk
assert 'href: "/teacher/scheme"' in teaching_desk
assert 'AuthoritySchemePage' in scheme_route

print('scheme upstream authority contract: PASS')

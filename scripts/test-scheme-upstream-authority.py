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
occurrence_fallback = lesson_source.index(
    'const occurrenceScheme = await loadSchemeSourceForOccurrenceFallback'
)
undated_guard = lesson_source.index('if (!occurrenceDate) {')
assert occurrence_fallback < undated_guard < progression, (
    'Dated lessons must resolve their instructional period, while progression applies only to undated lessons'
)
assert "date === occurrenceDate" in lesson_source, (
    'the matching slot must occur on the requested date'
)
assert "slot.effective_until >= date" in lesson_source, (
    'period ordinals must account for one-date slots on their own teaching dates'
)

assert 'label: "Scheme of Work"' in teaching_desk
assert 'href: "/teacher/scheme"' in teaching_desk
assert 'AuthoritySchemePage' in scheme_route

print('scheme upstream authority contract: PASS')

#!/usr/bin/env python3
from pathlib import Path
m=Path("supabase/migrations/20261001085739_teacher_curriculum_assignment_intelligence.sql").read_text()
form=Path("components/teacher/TeacherClassForm.tsx").read_text()
assert "get_allowed_teaching_subjects" in m
assert "trg_teacher_classes_curriculum_guard" in m
assert "invalid_subject_for_level" in m
assert "teacher_classes" in m
assert "get_allowed_teaching_subjects" in form
assert "create_teacher_class_assignment" in form
# Assignment intelligence must not gate resource/content discovery.
for p in ["app/teacher/resources/page.tsx","lib/curriculum/globalSubjects.ts"]:
    t=Path(p).read_text()
    assert "trg_teacher_classes_curriculum_guard" not in t
print("curriculum assignment intelligence contract: PASS")

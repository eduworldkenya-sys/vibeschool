def balance(s):
    return (s.count("(") - s.count(")"), s.count("{") - s.count("}"), s.count("[") - s.count("]"))

def patch_file(path, edits):
    with open(path, "r", encoding="utf-8") as f:
        original = f.read()
    src = original
    for old, new, desc in edits:
        assert old in src, f"[{path}] anchor not found: {desc}"
        assert src.count(old) == 1, f"[{path}] anchor not unique: {desc}"
        src = src.replace(old, new, 1)
    if balance(original) != balance(src):
        raise SystemExit(f"[{path}] balance check FAILED: {balance(original)} -> {balance(src)}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)
    print(f"Patched {path} ({len(edits)} edits)")

patch_file("app/teacher/progress/page.tsx", [
    ('.from("lesson_notes")\n      .select("id, lesson_plan_id',
     '.from("progress_records")\n      .select("id, lesson_plan_id',
     "loadNotes select table"),
    ('const { error: upErr } = await supabase\n          .from("lesson_notes")\n          .update(payload)',
     'const { error: upErr } = await supabase\n          .from("progress_records")\n          .update(payload)',
     "saveNote update table"),
    ('const { error: insErr } = await supabase.from("lesson_notes").insert(payload);',
     'const { error: insErr } = await supabase.from("progress_records").insert(payload);',
     "saveNote insert table"),
    ('const { error: delErr } = await supabase\n        .from("lesson_notes")\n        .delete()',
     'const { error: delErr } = await supabase\n        .from("progress_records")\n        .delete()',
     "confirmDeleteNote delete table"),
    ('content_type:   "lesson_note",',
     'content_type:   "progress_record",',
     "publishNote content_type tag"),
    ('{isEdit ? "Edit Note" : "New Lesson Note"}',
     '{isEdit ? "Edit Record" : "New Progress Record"}',
     "form header title"),
    ('{saving ? "Saving…" : isEdit ? "Update Note" : "Save Note"}',
     '{saving ? "Saving…" : isEdit ? "Update Record" : "Save Record"}',
     "save button label"),
    ('<div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Lesson Notes</div>',
     '<div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Progress Records</div>',
     "list header title"),
    ('>+ Add First Note</button>',
     '>+ Add First Record</button>',
     "empty state CTA"),
    ('<div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Note saved</div>',
     '<div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Record saved</div>',
     "saved confirmation title"),
    ('{note.plan_topic || note.plan_title || "Lesson Note"}',
     '{note.plan_topic || note.plan_title || "Progress Record"}',
     "detail view fallback title"),
    ("<div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Delete Note?</div>",
     "<div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Delete Record?</div>",
     "delete modal title"),
])

patch_file("app/teacher/layout.tsx", [
    ('path.startsWith("/teacher/lessonnotes")',
     'path.startsWith("/teacher/progress")',
     "tab routing path match"),
    ('{ label: "Notes",       icon: <IconVibeLearn  size={24} />, href: "/teacher/lessonnotes"       },',
     '{ label: "Progress",    icon: <IconVibeLearn  size={24} />, href: "/teacher/progress"          },',
     "teach tray item"),
])

patch_file("app/teacher/week/page.tsx", [
    ('supabase.from("lesson_notes")',
     'supabase.from("progress_records")',
     "week artifact-matching query table"),
    ('notes:    `/teacher/lessonnotes?class_id=${row.classId}&subject_id=${row.subjectId}`,',
     'notes:    `/teacher/progress?class_id=${row.classId}&subject_id=${row.subjectId}`,',
     "week artifact chip link"),
])

patch_file("app/teacher/lessonplan/page.tsx", [
    ('router.push(`/teacher/lessonnotes?planId=${plan.id}&classId=${plan.classId}&subjectId=${plan.subjectId}`)',
     'router.push(`/teacher/progress?planId=${plan.id}&classId=${plan.classId}&subjectId=${plan.subjectId}`)',
     "Mark as Taught deep link"),
])

patch_file("app/teacher/more/page.tsx", [
    ("{ label: 'Lesson Notes', href: '/teacher/lessonnotes',          desc: 'Record what was actually taught'   },",
     "{ label: 'Progress Record', href: '/teacher/progress',          desc: 'Record what was actually taught'   },",
     "more menu item"),
])

patch_file("app/teacher/academics/page.tsx", [
    ('{label:"Lesson Notes",icon:"📝",route:"/teacher/lessonnotes"}',
     '{label:"Progress Record",icon:"📝",route:"/teacher/progress"}',
     "subject card quick action"),
    ('{label:"Lesson Notes",icon:"📝",route:"/teacher/lessonnotes",bg:"#064e3b"}',
     '{label:"Progress Record",icon:"📝",route:"/teacher/progress",bg:"#064e3b"}',
     "quick actions grid item"),
])

patch_file("lib/twin/registry.ts", [
    ('{ id: "nav_lessonnotes", type: "navigate", route: "/teacher/lessonnotes", label: "Lesson Notes",  keywords: ["lesson notes", "lessonnotes"] },',
     '{ id: "nav_progress", type: "navigate", route: "/teacher/progress", label: "Progress Record",  keywords: ["progress record", "progress records", "lesson notes", "lessonnotes"] },',
     "Twin voice-command registry entry (old keywords kept as aliases)"),
])

patch_file("app/student/lesson/[id]/page.tsx", [
    ('''      const { data: raw } = await supabase
        .from("lesson_plans")
        .select("id, title, content_type, student_copy, objectives, day_of_week, subject_id, teacher_id")
        .eq("id", id)
        .single();

      if (!raw) { setLoading(false); return; }

      const [subRes, teachRes] = await Promise.all([
        supabase.from("subjects").select("name").eq("id", raw.subject_id).single(),
        supabase.from("profiles").select("full_name").eq("id", raw.teacher_id).single(),
      ]);

      setLesson({
        id:           raw.id,
        title:        raw.title,
        content_type: raw.content_type ?? "notes",
        student_copy: raw.student_copy ?? "",
        objectives:   raw.objectives   ?? "",
        day:          raw.day_of_week  ?? 0,
        subject:      subRes.data?.name      ?? "Subject",
        teacher:      teachRes.data?.full_name ?? "Teacher",
      });
      setLoading(false);''',
     '''      const { data: raw } = await supabase
        .from("lesson_plans")
        .select("id, title, objectives, day_of_week, subject_id, teacher_id")
        .eq("id", id)
        .single();

      if (!raw) { setLoading(false); return; }

      const [subRes, teachRes, contentRes] = await Promise.all([
        supabase.from("subjects").select("name").eq("id", raw.subject_id).single(),
        supabase.from("profiles").select("full_name").eq("id", raw.teacher_id).single(),
        supabase.from("lesson_content").select("content_type, student_copy").eq("lesson_plan_id", raw.id).eq("content_type", "progress_record").maybeSingle(),
      ]);

      setLesson({
        id:           raw.id,
        title:        raw.title,
        content_type: contentRes.data?.content_type ?? "progress_record",
        student_copy: contentRes.data?.student_copy ?? "",
        objectives:   raw.objectives   ?? "",
        day:          raw.day_of_week  ?? 0,
        subject:      subRes.data?.name      ?? "Subject",
        teacher:      teachRes.data?.full_name ?? "Teacher",
      });
      setLoading(false);''',
     "fix broken lesson_plans query, join progress_records via lesson_content"),
    ("          Lesson Notes\n",
     "          Progress Record\n",
     "section header label"),
    ('            No notes available yet',
     '            No progress record published yet',
     "empty state copy"),
])

print("All patches applied successfully.")

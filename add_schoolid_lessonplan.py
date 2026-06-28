import pathlib, sys

TARGET = pathlib.Path("app/teacher/lessonplan/page.tsx")
if not TARGET.exists():
    sys.exit(f"ERROR: {TARGET} not found. Run from repo root.")

src = TARGET.read_text(encoding="utf-8")
orig = src

# ── 1. Add schoolId state, right after the toast state ──
OLD_STATE = "  const [toast,       setToast]       = useState('')"
assert OLD_STATE in src, "STATE anchor not found"
NEW_STATE = OLD_STATE + "\n  const [schoolId,    setSchoolId]    = useState<string | null>(null)"
src = src.replace(OLD_STATE, NEW_STATE, 1)

# ── 2. Resolve schoolId right after getting the user, same fallback pattern used elsewhere in this codebase ──
OLD_USER_CHECK = """      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [slotsRes, plansRes] = await Promise.all(["""
assert OLD_USER_CHECK in src, "USER_CHECK anchor not found"
NEW_USER_CHECK = """      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Resolve schoolId — same 3-source fallback used in Assessment/Pulse
      const [memberRes, teacherRes, profileRes] = await Promise.all([
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('profiles').select('school_id').eq('id', user.id).maybeSingle(),
      ])
      const resolvedSchoolId =
        memberRes.data?.school_id ??
        teacherRes.data?.school_id ??
        profileRes.data?.school_id ??
        null
      setSchoolId(resolvedSchoolId)

      const [slotsRes, plansRes] = await Promise.all(["""
src = src.replace(OLD_USER_CHECK, NEW_USER_CHECK, 1)

TARGET.write_text(src, encoding="utf-8")
counts = {c: src.count(c) for c in '(){}[]'}
print("lessonplan/page.tsx updated.")
print("Paren diff:", counts['('] - counts[')'], "| Brace diff:", counts['{'] - counts['}'], "| Bracket diff:", counts['['] - counts[']'])
print("Net lines added:", len(src.splitlines()) - len(orig.splitlines()))

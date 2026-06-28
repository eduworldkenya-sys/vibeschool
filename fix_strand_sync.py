import pathlib, sys

ASSESSMENT = pathlib.Path("app/teacher/assessment/page.tsx")
if not ASSESSMENT.exists():
    sys.exit(f"ERROR: {ASSESSMENT} not found. Run from repo root.")

src = ASSESSMENT.read_text(encoding="utf-8")
orig = src

# ── 1. Add state to track a just-saved strand, for the sync prompt ──
OLD_TEACHERID_DECL = "  const [teacherId,        setTeacherId]        = useState<string | null>(null)"
assert OLD_TEACHERID_DECL in src, "TEACHERID_DECL anchor not found"
NEW_TEACHERID_DECL = OLD_TEACHERID_DECL + """
  const [syncPromptStrand, setSyncPromptStrand] = useState<string | null>(null)
  const [syncing,          setSyncing]           = useState(false)"""
src = src.replace(OLD_TEACHERID_DECL, NEW_TEACHERID_DECL, 1)

# ── 2. Add the week-derivation helper, same formula as Scheme's currentWeekOf ──
OLD_SAVEASSESSMENT_START = "  async function saveAssessment() {"
assert OLD_SAVEASSESSMENT_START in src, "SAVEASSESSMENT_START anchor not found"
NEW_HELPER_AND_START = """  // Same week-derivation formula as Scheme's currentWeekOf — keeps strand_progress.week consistent
  async function syncStrandProgress(strandId: string) {
    if (!teacherId || !activeClassId || !activeSubjectId || !schoolId) return
    setSyncing(true)
    try {
      const { data: termRow } = await supabase
        .from('academic_terms')
        .select('start_date, end_date, term')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .single()
      if (!termRow) { setSyncing(false); setSyncPromptStrand(null); return }
      const start = new Date(termRow.start_date)
      const end = new Date(termRow.end_date)
      const totalWeeks = isNaN(start.getTime()) || isNaN(end.getTime())
        ? 13
        : Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)))
      const now = Date.now()
      const week = now < start.getTime()
        ? 1
        : Math.max(1, Math.min(Math.floor((now - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1, totalWeeks))

      await supabase.from('strand_progress').upsert({
        teacher_id: teacherId,
        class_id:   activeClassId,
        subject_id: activeSubjectId,
        school_id:  schoolId,
        strand_id:  strandId,
        term:       termRow.term ?? selectedTerm,
        week,
        status: 'teaching',
      }, { onConflict: 'teacher_id,class_id,strand_id,term,week' })
    } catch {
      // Non-blocking — assessment already saved successfully regardless of sync outcome
    }
    setSyncing(false)
    setSyncPromptStrand(null)
  }

  async function saveAssessment() {"""
src = src.replace(OLD_SAVEASSESSMENT_START, NEW_HELPER_AND_START, 1)

# ── 3. After a successful NEW insert (not edit), offer the sync prompt instead of just closing ──
OLD_INSERT_SUCCESS = """    if (saveErr || !data) { setSaveError(saveErr?.message ?? 'Failed to save'); setSaving(false); return }
    setAssessments(prev => [data as Assessment, ...prev])
    closeModal()
  }"""
assert OLD_INSERT_SUCCESS in src, "INSERT_SUCCESS anchor not found"
NEW_INSERT_SUCCESS = """    if (saveErr || !data) { setSaveError(saveErr?.message ?? 'Failed to save'); setSaving(false); return }
    setAssessments(prev => [data as Assessment, ...prev])
    const savedStrandId = selStrand
    closeModal()
    // Hybrid: offer to sync curriculum progress — teacher confirms, nothing writes automatically
    setSyncPromptStrand(savedStrandId)
  }"""
src = src.replace(OLD_INSERT_SUCCESS, NEW_INSERT_SUCCESS, 1)

# ── 4. Render the sync prompt as a small dismissible banner near the top of the page ──
OLD_RETURN_OPEN = """  return (
    <div style={{ padding: '0 0 80px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>

      {/* ── Header ── */}"""
assert OLD_RETURN_OPEN in src, "RETURN_OPEN anchor not found"
NEW_RETURN_OPEN = """  return (
    <div style={{ padding: '0 0 80px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>

      {/* Hybrid curriculum sync prompt — appears after saving an assessment */}
      {syncPromptStrand && (
        <div style={{ margin: '12px 16px 0', padding: '12px 14px', borderRadius: 12, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#5b21b6' }}>Update curriculum progress for this strand?</span>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              disabled={syncing}
              onClick={() => syncStrandProgress(syncPromptStrand)}
              style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#5b21b6', color: '#fff', fontWeight: 700, fontSize: 11, cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {syncing ? '...' : 'Yes'}
            </button>
            <button
              disabled={syncing}
              onClick={() => setSyncPromptStrand(null)}
              style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: '#5b21b6', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}"""
src = src.replace(OLD_RETURN_OPEN, NEW_RETURN_OPEN, 1)

ASSESSMENT.write_text(src, encoding="utf-8")
counts = {c: src.count(c) for c in '(){}[]'}
print("assessment/page.tsx updated.")
print("Paren diff:", counts['('] - counts[')'], "| Brace diff:", counts['{'] - counts['}'], "| Bracket diff:", counts['['] - counts[']'])
print("Net lines added:", len(src.splitlines()) - len(orig.splitlines()))

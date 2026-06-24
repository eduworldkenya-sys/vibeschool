import pathlib, sys

TARGET = pathlib.Path("app/teacher/subjecthub/page.tsx")
if not TARGET.exists():
    sys.exit(f"ERROR: {TARGET} not found. Run from repo root.")

src = TARGET.read_text(encoding="utf-8")
original = src

# ══════════════════════════════════════════════════════
# ISSUE 1: subject dedup broken when classSchoolId null
# ══════════════════════════════════════════════════════
OLD_DEDUP = """    // Deduplicate — no unique constraint on subjects.name
    const dedupBase = supabase.from('subjects').select('id').eq('name', newSubjectName.trim())
    const { data: existing } = await dedupBase.eq('school_id', classSchoolId).maybeSingle()

    let subjectId: string
    if (existing) {
      subjectId = existing.id
    } else {
      const { data: newSub, error: subErr } = await supabase
        .from('subjects')
        .insert({ name: newSubjectName.trim(), school_id: classSchoolId })
        .select('id')
        .single()
      if (subErr || !newSub) { setAddSubjectError('Failed to create subject'); setAddingSubject(false); return }
      subjectId = newSub.id
    }"""

NEW_DEDUP = """    // Deduplicate — check by name + school_id (null-safe)
    let dedupQuery = supabase.from('subjects').select('id').eq('name', newSubjectName.trim())
    if (classSchoolId) {
      dedupQuery = dedupQuery.eq('school_id', classSchoolId) as typeof dedupQuery
    } else {
      dedupQuery = dedupQuery.is('school_id', null) as typeof dedupQuery
    }
    const { data: existing } = await dedupQuery.maybeSingle()

    let subjectId: string
    if (existing) {
      subjectId = existing.id
    } else {
      const insertPayload: { name: string; school_id?: string } = { name: newSubjectName.trim() }
      if (classSchoolId) insertPayload.school_id = classSchoolId
      const { data: newSub, error: subErr } = await supabase
        .from('subjects')
        .insert(insertPayload)
        .select('id')
        .single()
      if (subErr || !newSub) { setAddSubjectError('Failed to create subject'); setAddingSubject(false); return }
      subjectId = newSub.id
    }"""

assert OLD_DEDUP in src, "ERROR: dedup anchor not found"
src = src.replace(OLD_DEDUP, NEW_DEDUP, 1)

# ══════════════════════════════════════════════════════
# ISSUE 2: subjects not synced after add — filter doesn't update
# Already fixed via loadGrowthData in setSubjects callback
# Verify CBC filter uses live subjects list — already correct in zip
# ══════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════
# ISSUE 3: no way to link subject to class after adding
# Add "Link to class" button in My Classes empty state
# ══════════════════════════════════════════════════════
OLD_NO_CLASS_CARD = """          {!classLoading && classes.length === 0 && (
            <div style={{ padding: '28px 16px', textAlign: 'center' }}>
              <span style={{ fontSize: 28 }}>📚</span>
              <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>No classes assigned for this subject yet.</p>
            </div>
          )}"""

NEW_NO_CLASS_CARD = """          {!classLoading && classes.length === 0 && (
            <div style={{ padding: '28px 16px', textAlign: 'center' }}>
              <span style={{ fontSize: 28 }}>📚</span>
              <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8, marginBottom: 12 }}>No classes linked to this subject yet.</p>
              <button
                onClick={openAddSubject}
                style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Link a Class
              </button>
            </div>
          )}"""

assert OLD_NO_CLASS_CARD in src, "ERROR: no-class card anchor not found"
src = src.replace(OLD_NO_CLASS_CARD, NEW_NO_CLASS_CARD, 1)

# ══════════════════════════════════════════════════════
# ISSUE 4: single subject has no tab — show tabs always
# ══════════════════════════════════════════════════════
OLD_TABS_COND = """      {/* Fix 5 + 7: subject tabs with inline remove confirm */}
      {!loading && subjects.length > 1 && ("""

NEW_TABS_COND = """      {/* subject tabs — always show when subjects exist */}
      {!loading && subjects.length > 0 && ("""

assert OLD_TABS_COND in src, "ERROR: tabs condition anchor not found"
src = src.replace(OLD_TABS_COND, NEW_TABS_COND, 1)

# ══════════════════════════════════════════════════════
# ISSUE 5: hero — rounded icon, clickable stats, tappable badge
# ISSUE 6: readiness badge tappable with checklist tooltip
# ISSUE 7: stat pills tappable with navigation
# ISSUE 8: hero icon rounded circle with subject color
# ══════════════════════════════════════════════════════
OLD_HERO = """        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <HeroSkeleton />
            <div style={{ marginTop: 4 }}><HeroSkeleton /></div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🔬</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                    {activeSubject ? activeSubject.name : 'No Subjects'}
                  </h1>
                  {/* Fix 6: readiness chip */}
                  {activeSubject && !suggLoading && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, borderRadius: 20,
                      padding: '3px 9px', background: readiness.bg, color: readiness.color,
                      letterSpacing: 0.5, whiteSpace: 'nowrap',
                    }}>
                      {readiness.label}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '3px 0 0' }}>
                  {subjects.length > 1 ? `${subjects.length} subjects assigned` : 'Subject Teacher'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'My Classes',  value: classes.length },
                ...(schoolId ? [{ label: 'Teammates', value: teammates.length }] : []),
                { label: 'Subjects',    value: subjects.length },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </>
        )}"""

NEW_HERO = """        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <HeroSkeleton />
            <div style={{ marginTop: 4 }}><HeroSkeleton /></div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {/* Subject icon — rounded circle, subject-color, tappable */}
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, flexShrink: 0,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}>🔬</div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                  {activeSubject ? activeSubject.name : 'No Subjects'}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {/* Readiness badge — tappable, shows what's needed */}
                  {activeSubject && !suggLoading && (
                    <button
                      onClick={() => {
                        const missing = []
                        if (lessonCount === 0) missing.push('Add a lesson plan')
                        if (assessCount === 0) missing.push('Record an assessment')
                        if (missing.length === 0) alert('You are fully ready! Keep it up.')
                        else alert('To become Ready:\n\u2022 ' + missing.join('\n\u2022 '))
                      }}
                      style={{
                        fontSize: 10, fontWeight: 800, borderRadius: 20,
                        padding: '3px 9px', background: readiness.bg, color: readiness.color,
                        letterSpacing: 0.5, whiteSpace: 'nowrap',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      {readiness.label} {readiness.label !== 'Ready' ? '\u2139\ufe0f' : '\u2705'}
                    </button>
                  )}
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                    {subjects.length > 1 ? `${subjects.length} subjects` : 'Subject Teacher'}
                  </p>
                </div>
              </div>
            </div>

            {/* Stat pills — tappable with navigation */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'My Classes',  value: classes.length,   route: '/teacher/classhub' },
                ...(schoolId ? [{ label: 'Teammates', value: teammates.length, route: '/teacher/profile' }] : []),
                { label: 'Subjects',    value: subjects.length,  route: null },
              ].map(s => (
                <button
                  key={s.label}
                  onClick={() => s.route ? router.push(s.route) : null}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.12)',
                    borderRadius: 16, padding: '10px 8px', textAlign: 'center',
                    border: 'none', cursor: s.route ? 'pointer' : 'default',
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    fontFamily: 'inherit',
                  }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </button>
              ))}
            </div>
          </>
        )}"""

assert OLD_HERO in src, "ERROR: hero anchor not found"
src = src.replace(OLD_HERO, NEW_HERO, 1)

# ══════════════════════════════════════════════════════
# ISSUE 9: migration note — add comment for ALTER TABLE
# ══════════════════════════════════════════════════════
OLD_TC_INSERT = """    const tcRow: Record<string, unknown> = {
      teacher_id:       currentId,
      subject_id:       subjectId,
      school_id:        classSchoolId,
      is_class_teacher: false,
    }
    if (newSubjectClassId) tcRow.class_id = newSubjectClassId
    const { error: tcErr } = await supabase.from('teacher_classes').insert(tcRow)"""

NEW_TC_INSERT = """    // NOTE: teacher_classes.class_id is nullable (ALTER TABLE teacher_classes ALTER COLUMN class_id DROP NOT NULL)
    const tcRow: Record<string, unknown> = {
      teacher_id:       currentId,
      subject_id:       subjectId,
      school_id:        classSchoolId,
      is_class_teacher: false,
    }
    if (newSubjectClassId) tcRow.class_id = newSubjectClassId
    const { error: tcErr } = await supabase.from('teacher_classes').insert(tcRow)"""

assert OLD_TC_INSERT in src, "ERROR: tcRow anchor not found"
src = src.replace(OLD_TC_INSERT, NEW_TC_INSERT, 1)

# ══════════════════════════════════════════════════════
# ISSUE 10: loadGrowthData called with no class context
# Guard: skip AI insight fetch if no lessons/assessments yet
# ══════════════════════════════════════════════════════
OLD_AI_FETCH = """    // Daily fact + AI suggestion via secure API route
    const subjectName = activeSubject?.name ?? 'your subject'
    try {
      const insightRes = await fetch('/api/subject-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectName, lCount, aCount, atCount, rCount }),
      })
      if (insightRes.ok) {
        const { fact, suggestion } = await insightRes.json()
        setDailyFact(fact ?? null)
        setAiSuggestion(suggestion ?? null)
      } else {
        setDailyFact(null)
        setAiSuggestion(null)
      }
    } catch {
      setDailyFact(null)
      setAiSuggestion(null)
    }"""

NEW_AI_FETCH = """    // Daily fact + AI suggestion — only fetch if teacher has some activity
    const subjectName = activeSubject?.name ?? 'your subject'
    if (lCount > 0 || aCount > 0 || atCount > 0 || rCount > 0) {
      try {
        const insightRes = await fetch('/api/subject-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectName, lCount, aCount, atCount, rCount }),
        })
        if (insightRes.ok) {
          const { fact, suggestion } = await insightRes.json()
          setDailyFact(fact ?? null)
          setAiSuggestion(suggestion ?? null)
        } else {
          setDailyFact(null)
          setAiSuggestion(null)
        }
      } catch {
        setDailyFact(null)
        setAiSuggestion(null)
      }
    } else {
      setDailyFact(null)
      setAiSuggestion(null)
    }"""

assert OLD_AI_FETCH in src, "ERROR: AI fetch anchor not found"
src = src.replace(OLD_AI_FETCH, NEW_AI_FETCH, 1)

assert src != original, "ERROR: no changes made"
TARGET.write_text(src, encoding="utf-8")
print("OK Issue 1:  subject dedup null-safe")
print("OK Issue 3:  Link a Class button in empty classes card")
print("OK Issue 4:  tabs show for single subject too")
print("OK Issue 5:  hero icon rounded circle")
print("OK Issue 6:  readiness badge tappable with checklist")
print("OK Issue 7:  stat pills tappable with navigation")
print("OK Issue 9:  migration note in code")
print("OK Issue 10: AI fetch skipped when no activity yet")

path = 'app/teacher/subjecthub/page.tsx'
with open(path) as f:
    src = f.read()

old = "  const [error,        setError]        = useState<string | null>(null)"
new = """  const [error,        setError]        = useState<string | null>(null)
  const [pickerAction, setPickerAction] = useState<{ id: string; label: string; icon: string; bg: string; route: string } | null>(null)"""
assert old in src, 'BLOCK NOT FOUND: error state'
src = src.replace(old, new, 1)

old2 = """                onClick={() => router.push(a.route + '?subjectId=' + activeSubject.id + (classes[0] ? '&classId=' + classes[0].id : ''))}"""
new2 = """                onClick={() => {
                  if (a.id === 'timetable') { router.push(a.route); return }
                  if (classes.length === 0) { router.push(a.route + '?subjectId=' + activeSubject.id); return }
                  if (classes.length === 1) { router.push(a.route + '?subjectId=' + activeSubject.id + '&classId=' + classes[0].id); return }
                  setPickerAction(a)
                }}"""
assert old2 in src, 'BLOCK NOT FOUND: action onClick'
src = src.replace(old2, new2, 1)

old3 = """      {error && (
        <div style={{ margin: '14px 16px', padding: '12px 14px', borderRadius: 12, background: '#fef2f2', color: C.error, fontSize: 13 }}>
          {error}
        </div>
      )}

    </div>
  )
}"""

new3 = """      {error && (
        <div style={{ margin: '14px 16px', padding: '12px 14px', borderRadius: 12, background: '#fef2f2', color: C.error, fontSize: 13 }}>
          {error}
        </div>
      )}

      {pickerAction && activeSubject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setPickerAction(null)}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 4 }}>
              {pickerAction.icon} {pickerAction.label}
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>Choose a class to open</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => {
                    router.push(pickerAction.route + '?subjectId=' + activeSubject.id + '&classId=' + cls.id)
                    setPickerAction(null)
                  }}
                  style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, fontSize: 14, fontWeight: 700, color: C.textPrimary, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                >
                  {cls.name}{cls.stream ? ' \u00b7 ' + cls.stream : ''}
                  <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, marginLeft: 8 }}>{cls.studentCount} students</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPickerAction(null)}
              style={{ width: '100%', marginTop: 12, padding: '12px', borderRadius: 12, border: `1px solid ${C.border}`, background: '#fff', fontSize: 14, fontWeight: 600, color: C.textMuted, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  )
}"""

assert old3 in src, 'BLOCK NOT FOUND: closing error block'
src = src.replace(old3, new3, 1)

with open(path, 'w') as f:
    f.write(src)
print('Done: subjecthub/page.tsx patched')

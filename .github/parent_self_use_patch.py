from pathlib import Path
p = Path('app/parent/child/[id]/profile/page.tsx')
s = p.read_text()

if 'function requiresParentOptIn' not in s:
    anchor = 'export default function ParentChildProfilePage() {'
    helper = '''function requiresParentOptIn(className: string) {\n  const match = className.match(/(?:grade|class)\\s*(\\d+)/i);\n  return !match || Number(match[1]) < 6;\n}\n\n'''
    s = s.replace(anchor, helper + anchor)

s = s.replace('autonomy_level: number | null;\n}', 'autonomy_level: number | null;\n  self_use_enabled: boolean | null;\n}')
s = s.replace('select("id,name,profile_id,class_id,admission_number,date_of_birth,gender,autonomy_level")', 'select("id,name,profile_id,class_id,admission_number,date_of_birth,gender,autonomy_level,self_use_enabled")')

if 'async function setStudentSelfUse' not in s:
    anchor = '  async function saveFamilyNotes() {'
    handler = '''  async function setStudentSelfUse(enabled: boolean) {\n    if (!data) return;\n    setError("");\n    setNotice("");\n    const previous = data.student.self_use_enabled === true;\n    setData(current => current ? { ...current, student: { ...current.student, self_use_enabled: enabled } } : current);\n    const { error: rpcError } = await supabase.rpc("parent_set_student_self_use", { p_student_id: data.student.id, p_enabled: enabled });\n    if (rpcError) {\n      setData(current => current ? { ...current, student: { ...current.student, self_use_enabled: previous } } : current);\n      setError("We could not update student access. Please try again.");\n      return;\n    }\n    setNotice(enabled ? `${data.student.name} can now use their own account.` : `${data.student.name} will need your permission to use their own account.`);\n  }\n\n'''
    s = s.replace(anchor, handler + anchor)

marker = '    <div style={{ display: "grid", gap: 12 }}>'
if 'Student account access' not in s:
    card = '''    <div style={{ display: "grid", gap: 12 }}>\n      {requiresParentOptIn(data.className) && <Card>\n        <Heading title="Student account access" sub={s.self_use_enabled ? `${s.name} has permission to use their own account.` : `${s.name} needs your permission before using their own account.`} />\n        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>\n          <div style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 12, color: C.text }}>{s.self_use_enabled ? "Self-use enabled" : "Parent permission required"}</strong><p style={{ margin: "4px 0 0", fontSize: 10, lineHeight: 1.45, color: C.muted }}>You can change this anytime. VibeSchool checks your permission when the learner claims their account.</p></div>\n          <button type="button" role="switch" aria-checked={s.self_use_enabled === true} aria-label={`${s.self_use_enabled ? "Disable" : "Enable"} independent student access for ${s.name}`} onClick={() => void setStudentSelfUse(!(s.self_use_enabled === true))} style={{ width: 52, height: 30, flexShrink: 0, borderRadius: 99, border: "none", padding: 3, background: s.self_use_enabled ? C.accent : "#d1d5db", cursor: "pointer" }}><span style={{ display: "block", width: 24, height: 24, borderRadius: "50%", background: "#fff", transform: s.self_use_enabled ? "translateX(22px)" : "translateX(0)", transition: "transform .15s ease", boxShadow: "0 1px 3px rgba(0,0,0,.18)" }} /></button>\n        </div>\n      </Card>}\n'''
    s = s.replace(marker, card)

p.write_text(s)

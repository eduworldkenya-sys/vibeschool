#!/bin/bash
CLASSHUB="/data/data/com.termux/files/home/vibeschool/app/teacher/classhub/[id]/page.tsx"

# FIX 4: Delete confirmation
python3 -c "
content = open('$CLASSHUB').read()
old = '''  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.from('student_claim_codes').delete().eq('student_id', id)
    await supabase.from('students').delete().eq('id', id)
    setDeleting(None)
    loadData()
  }'''
new = '''  async function handleDelete(id: string) {
    const student = students.find(s => s.id === id)
    const confirmed = window.confirm(
      \`Remove \${student?.name ?? 'this student'} from the class?\\n\\nThis cannot be undone.\`
    )
    if (!confirmed) return
    setDeleting(id)
    await supabase.from('student_claim_codes').delete().eq('student_id', id)
    await supabase.from('students').delete().eq('id', id)
    setDeleting(None)
    loadData()
  }'''
if old in content:
    open('$CLASSHUB', 'w').write(content.replace(old, new, 1))
    print('Fix 4 done')
else:
    print('Fix 4 NOT FOUND')
"

# FIX 5: Stats claimed=0 nudge
python3 -c "
content = open('$CLASSHUB').read()
old = \"                { label: 'Claimed',                               value: students.filter(s => s.profile_id).length },\"
new = \"                { label: 'Claimed', value: students.length > 0 && students.filter(s => s.profile_id).length === 0 ? '⚠ 0' : students.filter(s => s.profile_id).length },\"
if old in content:
    open('$CLASSHUB', 'w').write(content.replace(old, new, 1))
    print('Fix 5 done')
else:
    print('Fix 5 NOT FOUND')
"

echo ""
echo "Verify:"
grep -n "window.confirm" "$CLASSHUB" | head -3
grep -n "⚠ 0" "$CLASSHUB" | head -3

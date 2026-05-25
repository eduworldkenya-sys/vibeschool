path = 'app/teacher/scheme/page.tsx'
with open(path) as f:
    src = f.read()

old = """import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, C } from '@/components/teacher/ui'"""

new = """import { useEffect, useState, useCallback, Suspense } from 'react'
import type { CSSProperties } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, C } from '@/components/teacher/ui'"""

assert old in src, 'BLOCK NOT FOUND: imports'
src = src.replace(old, new, 1)

old2 = "export default function SchemePage() {"
new2 = "function SchemePageInner() {"
assert old2 in src, 'BLOCK NOT FOUND: export'
src = src.replace(old2, new2, 1)

old3 = "  const [uid,             setUid]             = useState<string | null>(null)"
new3 = """  const searchParams = useSearchParams()
  const [uid,             setUid]             = useState<string | null>(null)"""
assert old3 in src, 'BLOCK NOT FOUND: uid state'
src = src.replace(old3, new3, 1)

old4 = """      if (classOptions.length)   setSelectedClass(classOptions[0].id)
      if (subjectOptions.length) setSelectedSubject(subjectOptions[0].id)
      setLoading(false)"""

new4 = """      const urlClassId   = searchParams.get('classId')
      const urlSubjectId = searchParams.get('subjectId')
      const matchClass   = urlClassId   ? classOptions.find(c => c.id === urlClassId)     : null
      const matchSubject = urlSubjectId ? subjectOptions.find(s => s.id === urlSubjectId) : null
      setSelectedClass(matchClass?.id   ?? (classOptions[0]?.id   ?? null))
      setSelectedSubject(matchSubject?.id ?? (subjectOptions[0]?.id ?? null))
      setLoading(false)"""

assert old4 in src, 'BLOCK NOT FOUND: set defaults'
src = src.replace(old4, new4, 1)

src = src.rstrip() + """

export default function SchemePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 13 }}>Loading\u2026</div>}>
      <SchemePageInner />
    </Suspense>
  )
}
"""

with open(path, 'w') as f:
    f.write(src)
print('Done: scheme/page.tsx patched')

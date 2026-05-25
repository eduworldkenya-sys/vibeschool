path = 'app/teacher/assessment/page.tsx'
with open(path) as f:
    src = f.read()

old = "import { useEffect, useState, useRef, Suspense } from 'react'"
new = "import { useEffect, useState, useRef, Suspense } from 'react'\nimport { useRouter } from 'next/navigation'"
assert old in src, 'BLOCK NOT FOUND: imports'
src = src.replace(old, new, 1)

old2 = "  const searchParams = useSearchParams()"
new2 = "  const router = useRouter()\n  const searchParams = useSearchParams()"
assert old2 in src, 'BLOCK NOT FOUND: searchParams'
src = src.replace(old2, new2, 1)

old3 = """      {/* ── Header ── */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0a0a0a' }}>CBC Assessment</h1>"""

new3 = """      {/* ── Header ── */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #f0f0f0' }}>
        {activeClassId && (
          <button
            onClick={() => router.push('/teacher/classhub/' + activeClassId)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 14px', borderRadius: 10, background: '#f3f4f6', border: 'none', color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            \u2190 View Class
          </button>
        )}
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0a0a0a' }}>CBC Assessment</h1>"""

assert old3 in src, 'BLOCK NOT FOUND: header'
src = src.replace(old3, new3, 1)

with open(path, 'w') as f:
    f.write(src)
print('Done: assessment/page.tsx patched')

import sys

path = "/data/data/com.termux/files/home/vibeschool/app/teacher/lessonplan/page.tsx"

with open(path, "r") as f:
    content = f.read()

def apply(content, old, new, label):
    count = content.count(old)
    if count != 1:
        print(f"ERROR [{label}]: expected 1 match, found {count}. Aborting — no changes written.")
        sys.exit(1)
    return content.replace(old, new)

# 1. Add hasDifferentiation() helper right after STATUS_BADGE
old_1 = """const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  draft:             { label: 'Draft',             bg: '#f3f4f6', color: '#6b7280' },
  published:         { label: 'Published',         bg: '#d1fae5', color: '#065f46' },
  shared_to_parents: { label: 'Shared to Parents', bg: '#dbeafe', color: '#1e40af' },
  missing:           { label: 'No Plan',           bg: '#fee2e2', color: '#991b1b' },
}"""

new_1 = """const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  draft:             { label: 'Draft',             bg: '#f3f4f6', color: '#6b7280' },
  published:         { label: 'Published',         bg: '#d1fae5', color: '#065f46' },
  shared_to_parents: { label: 'Shared to Parents', bg: '#dbeafe', color: '#1e40af' },
  missing:           { label: 'No Plan',           bg: '#fee2e2', color: '#991b1b' },
}

// The AI generator writes a <differentiation>...</differentiation> block into
// plan.body (support/core/extension activities). A plan can exist but still
// have no real differentiation content — this checks for that directly
// instead of inferring it from status.
function hasDifferentiation(body: string): boolean {
  const m = body.match(/<differentiation>([\\s\\S]*?)<\\/differentiation>/)
  return !!(m && m[1].trim().length > 0)
}"""

content = apply(content, old_1, new_1, "add hasDifferentiation helper")

# 2. Add diffFilter state
old_2 = """  const [schoolId,    setSchoolId]    = useState<string | null>(null)
  const [loadError,   setLoadError]   = useState<string | null>(null)"""

new_2 = """  const [schoolId,    setSchoolId]    = useState<string | null>(null)
  const [loadError,   setLoadError]   = useState<string | null>(null)
  const [diffFilter,  setDiffFilter]  = useState<'all' | 'published' | 'draft' | 'missing'>('all')"""

content = apply(content, old_2, new_2, "add diffFilter state")

# 3. Compute visibleItems
old_3 = """  const readyCount   = items.filter(i => i.plan).length
  const missingCount = items.filter(i => !i.plan).length
  const isThisWeek   = weekStart === nairobiWeekStart()"""

new_3 = """  const readyCount   = items.filter(i => i.plan).length
  const missingCount = items.filter(i => !i.plan).length
  const isThisWeek   = weekStart === nairobiWeekStart()

  // Drives the "Today & Upcoming" list below when a Differentiation Summary
  // row is tapped. 'all' means no filter is active.
  const visibleItems = items.filter(({ plan }) => {
    if (diffFilter === 'all')       return true
    if (diffFilter === 'missing')   return !plan
    if (diffFilter === 'draft')     return !!plan && plan.status === 'draft'
    if (diffFilter === 'published') return !!plan && (plan.status === 'published' || plan.status === 'shared_to_parents')
    return true
  })"""

content = apply(content, old_3, new_3, "compute visibleItems")

# 4. Wire Today & Upcoming card to visibleItems + clear-filter chip
old_4 = """      <Card>
        <SectionLabel>Today &amp; Upcoming</SectionLabel>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1,2,3].map(i => <Skeleton key={i} />)}</div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: '#991b1b' }}>{loadError}</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: C.textMuted }}>No classes scheduled</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map(({ slot, plan }) => {"""

new_4 = """      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionLabel>Today &amp; Upcoming</SectionLabel>
          {diffFilter !== 'all' && (
            <button
              onClick={() => setDiffFilter('all')}
              style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}
            >
              ✕ Clear filter
            </button>
          )}
        </div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1,2,3].map(i => <Skeleton key={i} />)}</div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: '#991b1b' }}>{loadError}</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: C.textMuted }}>No classes scheduled</div>
        ) : visibleItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: C.textMuted }}>No slots match this filter</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visibleItems.map(({ slot, plan }) => {"""

content = apply(content, old_4, new_4, "wire Today & Upcoming to visibleItems")

# 5. Make Differentiation Summary rows clickable + real content sub-metric
old_5 = """        {loadError ? (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: '#991b1b' }}>{loadError}</div>
        ) : (() => {
          const published  = items.filter(i => i.plan?.status === 'published' || i.plan?.status === 'shared_to_parents').length
          const draft      = items.filter(i => i.plan?.status === 'draft').length
          const noPlan     = items.filter(i => !i.plan).length
          return [
            { level: 'Published', color: '#7c3aed', bg: '#ede9fe', desc: 'Published or shared plans', count: published },
            { level: 'Draft',     color: C.accent,  bg: C.accentLight, desc: 'Plans saved as draft', count: draft },
            { level: 'Missing',   color: '#d97706', bg: '#fef3c7', desc: 'Slots with no plan yet',  count: noPlan },
          ].map(d => (
            <div key={d.level} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: d.bg, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{d.count}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: d.color }}>{d.level}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{d.desc}</div>
              </div>
            </div>
          ))
        })()}"""

new_5 = """        {loadError ? (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: '#991b1b' }}>{loadError}</div>
        ) : (() => {
          const publishedItems = items.filter(i => i.plan?.status === 'published' || i.plan?.status === 'shared_to_parents')
          const draftItems     = items.filter(i => i.plan?.status === 'draft')
          const noPlan         = items.filter(i => !i.plan).length
          const publishedDiff  = publishedItems.filter(i => i.plan && hasDifferentiation(i.plan.body)).length
          const draftDiff      = draftItems.filter(i => i.plan && hasDifferentiation(i.plan.body)).length
          return [
            { key: 'published' as const, level: 'Published', color: '#7c3aed', bg: '#ede9fe', desc: 'Published or shared plans', count: publishedItems.length, diff: publishedDiff },
            { key: 'draft'     as const, level: 'Draft',     color: C.accent,  bg: C.accentLight, desc: 'Plans saved as draft', count: draftItems.length, diff: draftDiff },
            { key: 'missing'   as const, level: 'Missing',   color: '#d97706', bg: '#fef3c7', desc: 'Slots with no plan yet',  count: noPlan, diff: null },
          ].map(d => (
            <div
              key={d.level}
              onClick={() => setDiffFilter(f => f === d.key ? 'all' : d.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                background: d.bg, marginBottom: 8, cursor: 'pointer',
                border: '2px solid ' + (diffFilter === d.key ? d.color : 'transparent'),
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{d.count}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: d.color }}>{d.level}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{d.desc}</div>
                {d.diff !== null && d.count > 0 && (
                  <div style={{ fontSize: 11, color: d.color, fontWeight: 700, marginTop: 2 }}>⚡ {d.diff} of {d.count} have differentiated activities</div>
                )}
              </div>
            </div>
          ))
        })()}"""

content = apply(content, old_5, new_5, "make Differentiation Summary rows real + clickable")

with open(path, "w") as f:
    f.write(content)

print("✅ Patched app/teacher/lessonplan/page.tsx — 5/5 edits applied.")

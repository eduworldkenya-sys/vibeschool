path = '/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/generate/page.tsx'
with open(path, 'r') as f:
    src = f.read()

# 1. Add credits state
src = src.replace(
    "  const [saved,       setSaved]       = useState(false)",
    "  const [saved,       setSaved]       = useState(false)\n  const [credits,     setCredits]     = useState<{ balance: number; used: number } | null>(null)"
)

# 2. Update generate function to send auth token and handle credit errors
old_generate = """    try {
      const res = await fetch('/api/generate-lesson-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setGenerated(data.plan)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }"""

new_generate = """    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch('/api/generate-lesson-plan', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()

      if (res.status === 402) {
        setError('insufficient_credits')
        return
      }
      if (data.error) throw new Error(data.error)

      setGenerated(data.plan)
      if (data.credits) setCredits(data.credits)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }"""

src = src.replace(old_generate, new_generate)

# 3. Replace generic error display with smart credit error
old_error = """        {error && (
          <div style={{
            background:   C.redLight,
            border:       `1px solid #fda4af`,
            borderRadius: 12,
            padding:      12,
            marginBottom: 12,
            fontSize:     13,
            color:        C.red,
            fontWeight:   600,
          }}>
            ⚠️ {error}
          </div>
        )}"""

new_error = """        {error && (
          <div style={{
            background:   error === 'insufficient_credits' ? C.amberLight : C.redLight,
            border:       `1px solid ${error === 'insufficient_credits' ? '#fcd34d' : '#fda4af'}`,
            borderRadius: 12,
            padding:      16,
            marginBottom: 12,
          }}>
            {error === 'insufficient_credits' ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.amber, marginBottom: 4 }}>
                  🪙 No Vibe Credits
                </div>
                <div style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>
                  You need Vibe Credits to generate lesson plans. Buy credits to continue.
                </div>
                <a
                  href="/teacher/credits"
                  style={{
                    display: 'inline-block', padding: '9px 18px',
                    background: C.amber, color: '#fff',
                    borderRadius: 10, fontSize: 13, fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >Buy Vibe Credits →</a>
              </>
            ) : (
              <div style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>⚠️ {error}</div>
            )}
          </div>
        )}"""

src = src.replace(old_error, new_error)

# 4. Show credit balance after generation
old_action = """            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>"""

new_action = """            {/* Credit usage */}
            {credits && (
              <div style={{
                background: C.tealLight, border: `1px solid #5eead4`,
                borderRadius: 10, padding: '10px 14px',
                marginBottom: 10, display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: C.teal, fontWeight: 700 }}>
                  🪙 {credits.used} credit used
                </span>
                <span style={{ fontSize: 12, color: C.text2 }}>
                  Balance: <strong>{credits.balance}</strong> credits remaining
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>"""

src = src.replace(old_action, new_action)

with open(path, 'w') as f:
    f.write(src)

print("Done")

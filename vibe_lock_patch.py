with open('components/student/VibeLearnShellWrapper.tsx', 'r') as f:
    content = f.read()

# 1. Add vibeLock state after existing state declarations
old_state = "  const [submitOpen, setSubmitOpen]     = useState(false)"
new_state = """  const [submitOpen, setSubmitOpen]     = useState(false)
  const [vibeLock,   setVibeLock]       = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  function vibeSpeak(text: string) {
    if (typeof window === 'undefined') return
    window.speechSynthesis?.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate  = 0.88
    u.pitch = 1.05
    window.speechSynthesis?.speak(u)
  }

  async function toggleVibeLock() {
    if (!vibeLock) {
      setVibeLock(true)
      vibeSpeak('Vibe lock. Focus mode on.')
      try {
        wakeLockRef.current = await (navigator as any).wakeLock?.request('screen')
      } catch { /* not supported */ }
    } else {
      setVibeLock(false)
      vibeSpeak('Vibe out. Good session.')
      try {
        await wakeLockRef.current?.release()
        wakeLockRef.current = null
      } catch { /* not supported */ }
    }
  }"""

# 2. Replace header back button to disable during vibe lock
old_back = """          onClick={
              openContent
                ? () => setOpenContent(null)
                : submitOpen
                ? () => setSubmitOpen(false)
                : onClose
            }"""
new_back = """          onClick={
              vibeLock
                ? undefined
                : openContent
                ? () => setOpenContent(null)
                : submitOpen
                ? () => setSubmitOpen(false)
                : onClose
            }"""

# 3. Replace header VibeLearn title with lock indicator
old_title = """          VibeLearn"""
new_title = """          {vibeLock ? '🔒 VIBE LOCK' : 'VibeLearn'}"""

# 4. Add lock button next to submit button in header
old_submit = """          <button
            onClick={() => setSubmitOpen(true)}
            aria-label=\"Submit content\"
            style={{
              background: 'rgba(204,255,0,0.1)',
              border: '1px solid rgba(204,255,0,0.2)',
              borderRadius: 10, padding: '7px 12px',
              color: ACCENT, fontSize: 11, fontWeight: 800,
              cursor: 'pointer', letterSpacing: 0.4,
              minWidth: 72,
            }}
          >
            Drop a Vibe
          </button>"""
new_submit = """          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={toggleVibeLock}
              aria-label={vibeLock ? 'Exit Vibe Lock' : 'Enter Vibe Lock'}
              style={{
                background: vibeLock ? 'rgba(204,255,0,0.15)' : 'rgba(255,255,255,0.05)',
                border: vibeLock ? '1px solid rgba(204,255,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '7px 10px',
                color: vibeLock ? ACCENT : 'rgba(255,255,255,0.4)',
                fontSize: 14, fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🔒
            </button>
            {!vibeLock && (
              <button
                onClick={() => setSubmitOpen(true)}
                aria-label=\"Submit content\"
                style={{
                  background: 'rgba(204,255,0,0.1)',
                  border: '1px solid rgba(204,255,0,0.2)',
                  borderRadius: 10, padding: '7px 12px',
                  color: ACCENT, fontSize: 11, fontWeight: 800,
                  cursor: 'pointer', letterSpacing: 0.4,
                  minWidth: 72,
                }}
              >
                Drop a Vibe
              </button>
            )}
          </div>"""

if old_state in content:
    content = content.replace(old_state, new_state)
    print("state: patched")
else:
    print("state: NOT FOUND")

if old_back in content:
    content = content.replace(old_back, new_back)
    print("back: patched")
else:
    print("back: NOT FOUND")

if old_title in content:
    content = content.replace(old_title, new_title)
    print("title: patched")
else:
    print("title: NOT FOUND")

if old_submit in content:
    content = content.replace(old_submit, new_submit)
    print("submit: patched")
else:
    print("submit: NOT FOUND")

with open('components/student/VibeLearnShellWrapper.tsx', 'w') as f:
    f.write(content)

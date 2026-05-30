with open('components/student/VibeActionDock.tsx', 'r') as f:
    content = f.read()

# Add handleVibePass function after handleComplete
old = "  const handleComplete = useCallback(() => {"
new = """  const handleVibePass = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: 'Vibe Pass',
        text:  'Vibe — check this out on VibeLearn',
        url:   window.location.href,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href)
        .catch(() => {})
    }
  }, [])

  const handleComplete = useCallback(() => {"""

# Add Vibe Pass button after Complete button
old_end = """    </div>
  )
}"""
new_end = """      {/* Vibe Pass */}
      <button
        onClick={handleVibePass}
        aria-label="Share this content"
        style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 4, border: 'none',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          background: 'none',
          cursor: 'pointer', padding: 0,
        }}
      >
        <span style={{ fontSize: 20 }}>↗</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 0.4 }}>
          Vibe Pass
        </span>
      </button>

    </div>
  )
}"""

if old in content:
    content = content.replace(old, new)
    print("function: patched")
else:
    print("function: NOT FOUND")

if old_end in content:
    content = content.replace(old_end, new_end)
    print("button: patched")
else:
    print("button: NOT FOUND")

with open('components/student/VibeActionDock.tsx', 'w') as f:
    f.write(content)

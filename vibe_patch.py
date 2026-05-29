with open('app/teacher/layout.tsx', 'r') as f:
    content = f.read()

old = """  function onPointerUp() {
    dragging.current = false
    if (moved.current) return
    onOpen()
  }"""

new = """  const [greeted, setGreeted] = React.useState(false)

  function vibeSpeak(text: string) {
    if (typeof window === 'undefined') return
    window.speechSynthesis?.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate  = 0.88
    u.pitch = 1.05
    window.speechSynthesis?.speak(u)
  }

  function onPointerUp() {
    dragging.current = false
    if (moved.current) return
    if (!greeted) {
      setGreeted(true)
      vibeSpeak('Vibe.')
      setTimeout(() => {
        setExpanded(true)
        setTimeout(() => onOpen(), 600)
      }, 500)
      return
    }
    if (expanded) {
      if (collapseTimer.current) clearTimeout(collapseTimer.current)
      setExpanded(false)
      onOpen()
    } else {
      setExpanded(true)
      setTimeout(() => onOpen(), 400)
    }
  }"""

if old in content:
    content = content.replace(old, new)
    with open('app/teacher/layout.tsx', 'w') as f:
        f.write(content)
    print("patched")
else:
    print("string not found")

function TwinPill({ onOpen, unread }: { onOpen: () => void; unread: number }) {
  const [pos,      setPos]      = useState<{ x: number; y: number } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const dragging     = useRef(false)
  const startPointer = useRef({ x: 0, y: 0 })
  const startPos     = useRef({ x: 0, y: 0 })
  const pillRef      = useRef<HTMLDivElement>(null)
  const moved        = useRef(false)

  useEffect(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    setPos({ x: w / 2 - 28, y: h - 136 })
  }, [])

  function onPointerDown(e: React.PointerEvent) {
    dragging.current     = true
    moved.current        = false
    startPointer.current = { x: e.clientX, y: e.clientY }
    startPos.current     = pos ?? { x: window.innerWidth / 2 - 28, y: window.innerHeight - 136 }
    pillRef.current?.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return
    const dx = e.clientX - startPointer.current.x
    const dy = e.clientY - startPointer.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true
    const w  = window.innerWidth
    const h  = window.innerHeight
    const pw = pillRef.current?.offsetWidth  ?? 56
    const ph = pillRef.current?.offsetHeight ?? 56
    setPos({
      x: Math.min(Math.max(startPos.current.x + dx, 8), w - pw - 8),
      y: Math.min(Math.max(startPos.current.y + dy, 8), h - ph - 8),
    })
  }

  function onPointerUp() {
    dragging.current = false
    if (!moved.current) {
      if (expanded) { onOpen(); setExpanded(false) }
      else setExpanded(true)
    }
  }

  if (!pos) return null

  const SIZE = 56

  return (
    <>
      <style>{`
        @keyframes twinGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.0), 0 0 16px 4px rgba(16,185,129,0.35), 0 4px 24px rgba(30,27,75,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(16,185,129,0.0), 0 0 28px 8px rgba(16,185,129,0.55), 0 4px 24px rgba(30,27,75,0.4); }
        }
        @keyframes twinRingPulse {
          0%, 100% { transform: scale(1);    opacity: 0.6; }
          50%       { transform: scale(1.18); opacity: 0;   }
        }
        @keyframes twinExpand {
          from { opacity: 0; transform: scaleX(0.7) translateX(-10px); }
          to   { opacity: 1; transform: scaleX(1)   translateX(0);     }
        }
        @keyframes twinDotPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>

      {/* Pulsing ring behind the circle */}
      <div style={{
        position:      'fixed',
        left:          pos.x - 8,
        top:           pos.y - 8,
        width:         SIZE + 16,
        height:        SIZE + 16,
        borderRadius:  '50%',
        border:        '2px solid rgba(16,185,129,0.45)',
        animation:     'twinRingPulse 2s ease-in-out infinite',
        zIndex:        748,
        pointerEvents: 'none',
      }} />

      <div
        ref={pillRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position:      'fixed',
          left:          pos.x,
          top:           pos.y,
          zIndex:        750,
          width:         expanded ? 180 : SIZE,
          height:        SIZE,
          borderRadius:  expanded ? 32 : '50%',
          background:    'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #064e3b 100%)',
          border:        '1.5px solid rgba(16,185,129,0.5)',
          animation:     'twinGlow 2.4s ease-in-out infinite',
          cursor:        'grab',
          userSelect:    'none',
          touchAction:   'none',
          transition:    'width 0.28s cubic-bezier(0.34,1.56,0.64,1), border-radius 0.28s ease',
          display:       'flex',
          alignItems:    'center',
          justifyContent: expanded ? 'flex-start' : 'center',
          overflow:      'hidden',
          paddingLeft:   expanded ? 8 : 0,
          gap:           expanded ? 8 : 0,
        }}
      >
        {/* Core icon circle */}
        <div style={{
          flexShrink:     0,
          width:          40,
          height:         40,
          borderRadius:   '50%',
          background:     'radial-gradient(circle at 35% 35%, rgba(16,185,129,0.35), rgba(16,185,129,0.08))',
          border:         '1.5px solid rgba(16,185,129,0.6)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       18,
          color:          '#10b981',
          pointerEvents:  'none',
        }}>
          ✦
        </div>

        {/* Expanded label */}
        {expanded && (
          <div style={{
            animation:    'twinExpand 0.22s ease',
            pointerEvents: 'none',
            minWidth:      0,
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1, whiteSpace: 'nowrap' }}>
              Your Twin
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
              {[0, 0.2, 0.4].map(delay => (
                <span key={delay} style={{
                  display:    'inline-block',
                  width:      5,
                  height:     5,
                  borderRadius: '50%',
                  background: '#10b981',
                  animation:  `twinDotPulse 1.4s ease-in-out ${delay}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Unread badge */}
        {unread > 0 && (
          <div style={{
            position:       'absolute',
            top:            2,
            right:          2,
            width:          18,
            height:         18,
            borderRadius:   '50%',
            background:     '#ef4444',
            border:         '2px solid #0f172a',
            color:          '#fff',
            fontSize:       9,
            fontWeight:     800,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            pointerEvents:  'none',
          }}>
            {unread}
          </div>
        )}
      </div>
    </>
  )
}
'use client'

type DarkMode = 'sun' | 'light' | 'dark'

interface Props {
  isOnline:          boolean
  teacherInitials:   string
  darkMode:          DarkMode
  onDarkModeChange:  (m: DarkMode) => void
}

export default function Header({ isOnline, teacherInitials, darkMode, onDarkModeChange }: Props) {
  const next: DarkMode = darkMode === 'sun' ? 'light' : darkMode === 'light' ? 'dark' : 'sun'
  const icon = darkMode === 'sun' ? '🌤' : darkMode === 'light' ? '☀️' : '🌙'

  return (
    <div style={{
      background: '#1e1b4b', color: '#fff',
      padding: '0 20px', height: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 600,
      boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: '#10b981',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 900, color: '#fff',
        }}>V</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, fontFamily: 'Bricolage Grotesque, sans-serif' }}>VibeSchool</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: -1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', display: 'inline-block' }} />
            {isOnline ? 'Synced' : 'Offline'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => onDarkModeChange(next)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          title="Toggle theme"
        >{icon}</button>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: '#10b981',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer',
        }}>{teacherInitials}</div>
      </div>
    </div>
  )
}
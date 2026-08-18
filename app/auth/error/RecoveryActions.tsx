'use client'

import { useState } from 'react'

export default function RecoveryActions() {
  const [changingAccount, setChangingAccount] = useState(false)
  const [error, setError] = useState('')

  const changeAccount = async () => {
    if (changingAccount) return
    setChangingAccount(true)
    setError('')
    try {
      const response = await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw new Error('logout_failed')
      window.location.assign('/login')
    } catch {
      setError('We could not clear the current session. You can still return home or try again.')
      setChangingAccount(false)
    }
  }

  const buttonBase: React.CSSProperties = {
    minHeight: 48,
    padding: '12px 16px',
    borderRadius: 9,
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: 16,
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <button type="button" onClick={() => window.location.assign('/login')} style={{ ...buttonBase, border: 0, background: '#c8a84b', color: '#05050f' }}>
          Try Again
        </button>
        <button type="button" onClick={changeAccount} disabled={changingAccount} aria-busy={changingAccount} style={{ ...buttonBase, border: '1px solid rgba(255,255,255,.22)', background: 'transparent', color: '#fff', opacity: changingAccount ? .65 : 1 }}>
          {changingAccount ? 'Clearing session…' : 'Change account'}
        </button>
        <button type="button" onClick={() => window.location.assign('/')} style={{ ...buttonBase, border: '1px solid rgba(255,255,255,.22)', background: 'transparent', color: '#fff' }}>
          VibeSchool Home
        </button>
      </div>
      {error ? <p role="alert" style={{ marginTop: 12, color: '#f6c7c7', lineHeight: 1.5 }}>{error}</p> : null}
    </div>
  )
}

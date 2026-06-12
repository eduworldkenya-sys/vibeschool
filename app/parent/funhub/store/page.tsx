"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Voucher {
  id: string
  sponsor_name: string
  title: string
  description: string
  category: string
  xp_cost: number
  total_pool: number
  claimed_count: number
}

interface Claim {
  id: string
  voucher_id: string
  redemption_code: string
  status: string
  claimed_at: string
  funhub_vouchers: { title: string; sponsor_name: string }
}

interface XPWallet {
  total_xp: number
  level: number
}

type Screen = 'store' | 'claims' | 'confirming' | 'success'

const CATEGORY_ICONS: Record<string, string> = {
  digital: '📱',
  physical: '🎁',
  experience: '🌟',
}

const CATEGORY_COLORS: Record<string, string> = {
  digital: '#3b82f6',
  physical: '#10b981',
  experience: '#f59e0b',
}

export default function VoucherStorePage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('store')
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [wallet, setWallet] = useState<XPWallet | null>(null)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null)
  const [claimResult, setClaimResult] = useState<{ redemption_code: string; voucher_title: string; sponsor: string; xp_spent: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/parent/login'); return }

      const { data: student } = await supabase
        .from('students').select('id').eq('profile_id', user.id).single()
      if (!student) { setLoading(false); return }
      setStudentId(student.id)

      const [xpRes, vouchersRes, claimsRes] = await Promise.all([
        supabase.from('funhub_xp').select('total_xp, level').eq('student_id', student.id).single(),
        supabase.from('funhub_vouchers').select('*').eq('is_active', true).is('deleted_at', null).order('xp_cost', { ascending: true }),
        supabase.from('funhub_claims').select('*, funhub_vouchers(title, sponsor_name)').eq('student_id', student.id).order('claimed_at', { ascending: false }),
      ])

      if (xpRes.data) setWallet(xpRes.data)
      if (vouchersRes.data) setVouchers(vouchersRes.data)
      if (claimsRes.data) setClaims(claimsRes.data as Claim[])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function handleClaim() {
    if (!selectedVoucher || claiming) return
    setClaiming(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('funhub_claim_voucher', {
        p_voucher_id: selectedVoucher.id,
      })
      if (rpcError) {
        setError(rpcError.message.replace('ERROR: ', '').split('.')[0])
        setClaiming(false)
        return
      }
      setClaimResult(data)
      // Refresh wallet and claims
      await loadAll()
      setScreen('success')
    } catch (e: any) {
      setError('Something went wrong. Try again.')
    }
    setClaiming(false)
  }

  const filtered = categoryFilter === 'all'
    ? vouchers
    : vouchers.filter(v => v.category === categoryFilter)

  const canAfford = (v: Voucher) => (wallet?.total_xp ?? 0) >= v.xp_cost
  const isSoldOut = (v: Voucher) => v.claimed_count >= v.total_pool
  const alreadyClaimed = (v: Voucher) => claims.some(c => c.voucher_id === v.id)

  // ── LOADING ──────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #e5e7eb', borderTopColor: '#7c3aed', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // ── SUCCESS ───────────────────────────────────────────────────────
  if (screen === 'success' && claimResult) return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#15803d', marginBottom: 4 }}>Claimed!</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 32 }}>{claimResult.sponsor} · {claimResult.voucher_title}</div>

      <div style={{ width: '100%', maxWidth: 340, background: '#fff', borderRadius: 20, padding: 24, border: '2px solid #86efac', marginBottom: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 2, marginBottom: 8 }}>YOUR REDEMPTION CODE</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: '#111827', letterSpacing: 6, marginBottom: 8, fontFamily: 'monospace' }}>
          {claimResult.redemption_code}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280' }}>Show this code to your school coordinator</div>
        <div style={{ marginTop: 16, background: '#f0fdf4', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#15803d', fontWeight: 700 }}>
          ⚡ -{claimResult.xp_spent} XP deducted · New balance: {wallet?.total_xp ?? 0} XP
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          onClick={() => { setScreen('claims'); setSelectedVoucher(null) }}
          style={{ background: '#7c3aed', color: '#fff', borderRadius: 14, padding: '14px 0', textAlign: 'center', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
        >
          📋 View My Claims
        </div>
        <div
          onClick={() => { setScreen('store'); setSelectedVoucher(null); setClaimResult(null) }}
          style={{ background: '#fff', color: '#374151', borderRadius: 14, padding: '14px 0', textAlign: 'center', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: '1px solid #e5e7eb' }}
        >
          ← Back to Store
        </div>
      </div>
    </div>
  )

  // ── CONFIRM MODAL ─────────────────────────────────────────────────
  if (screen === 'confirming' && selectedVoucher) return (
    <div style={{ minHeight: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', padding: '28px 20px 40px' }}>
        <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 99, margin: '0 auto 24px' }} />
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{CATEGORY_ICONS[selectedVoucher.category]}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#111827', marginBottom: 4 }}>{selectedVoucher.title}</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>{selectedVoucher.sponsor_name}</div>
        </div>

        <div style={{ background: '#f9fafb', borderRadius: 14, padding: 16, marginBottom: 20 }}>
          {[
            { label: 'Cost', value: `⚡ ${selectedVoucher.xp_cost} XP`, color: '#7c3aed' },
            { label: 'Your Balance', value: `⚡ ${wallet?.total_xp ?? 0} XP`, color: '#111827' },
            { label: 'After Claim', value: `⚡ ${(wallet?.total_xp ?? 0) - selectedVoucher.xp_cost} XP`, color: '#10b981' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>

        {selectedVoucher.description && (
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20, textAlign: 'center' }}>{selectedVoucher.description}</div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <div
            onClick={() => { setScreen('store'); setError(null) }}
            style={{ flex: 1, background: '#f3f4f6', color: '#374151', borderRadius: 14, padding: '14px 0', textAlign: 'center', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Cancel
          </div>
          <div
            onClick={handleClaim}
            style={{
              flex: 2, background: claiming ? '#e5e7eb' : '#7c3aed', color: claiming ? '#9ca3af' : '#fff',
              borderRadius: 14, padding: '14px 0', textAlign: 'center', fontWeight: 900, fontSize: 14,
              cursor: claiming ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {claiming ? 'Claiming...' : `Claim for ${selectedVoucher.xp_cost} XP`}
          </div>
        </div>
      </div>
    </div>
  )

  // ── CLAIMS LIST ───────────────────────────────────────────────────
  if (screen === 'claims') return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '0 0 40px' }}>
      <div style={{ background: '#fff', padding: '16px 16px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => setScreen('store')} style={{ background: '#f3f4f6', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 16, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>My Claims</div>
      </div>
      <div style={{ padding: '0 16px' }}>
        {claims.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎁</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No claims yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Earn XP and redeem vouchers!</div>
          </div>
        ) : (
          claims.map(claim => (
            <div key={claim.id} style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{claim.funhub_vouchers?.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{claim.funhub_vouchers?.sponsor_name}</div>
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 99,
                  background: claim.status === 'collected' ? '#dcfce7' : claim.status === 'expired' ? '#fee2e2' : '#fef3c7',
                  color: claim.status === 'collected' ? '#15803d' : claim.status === 'expired' ? '#dc2626' : '#b45309',
                }}>
                  {claim.status.toUpperCase()}
                </div>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>CODE</div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 4, color: '#111827', fontFamily: 'monospace' }}>{claim.redemption_code}</div>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8, textAlign: 'right' }}>
                {new Date(claim.claimed_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )

  // ── STORE ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4c1d95, #7c3aed)', padding: '20px 16px 24px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 100, opacity: 0.06 }}>🏪</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => router.push('/parent/funhub')} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 16, cursor: 'pointer', color: '#fff' }}>←</button>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: 1 }}>FUNHUB</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Reward Store 🏪</div>
          </div>
          <div
            onClick={() => setScreen('claims')}
            style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            📋 My Claims
          </div>
        </div>
        {/* Wallet */}
        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: 1 }}>YOUR BALANCE</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 2 }}>⚡ {wallet?.total_xp ?? 0} <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.7 }}>XP</span></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>LEVEL</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{'⭐'.repeat(Math.min(wallet?.level ?? 1, 5))}</div>
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {['all', 'digital', 'physical', 'experience'].map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(cat)} style={{
            flexShrink: 0, padding: '7px 16px', borderRadius: 99,
            border: categoryFilter === cat ? 'none' : '1.5px solid #e5e7eb',
            background: categoryFilter === cat ? '#7c3aed' : '#fff',
            color: categoryFilter === cat ? '#fff' : '#6b7280',
            fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {cat === 'all' ? 'All' : `${CATEGORY_ICONS[cat]} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
          </button>
        ))}
      </div>

      {/* Voucher grid */}
      <div style={{ padding: '14px 16px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>No vouchers available</div>
        ) : (
          filtered.map(v => {
            const affordable = canAfford(v)
            const soldOut = isSoldOut(v)
            const claimed = alreadyClaimed(v)
            const disabled = soldOut || claimed || !affordable
            const remaining = v.total_pool - v.claimed_count
            const catColor = CATEGORY_COLORS[v.category] ?? '#6b7280'

            return (
              <div key={v.id} style={{
                background: '#fff', borderRadius: 18, marginBottom: 14,
                border: `1px solid ${disabled ? '#e5e7eb' : '#e5e7eb'}`,
                overflow: 'hidden', opacity: soldOut ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              }}>
                {/* Top stripe */}
                <div style={{ background: catColor, height: 4 }} />
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[v.category]}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: catColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>{v.category}</span>
                        {claimed && <span style={{ fontSize: 9, fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: 99 }}>CLAIMED</span>}
                        {soldOut && <span style={{ fontSize: 9, fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: 99 }}>SOLD OUT</span>}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: '#111827', marginBottom: 2 }}>{v.title}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{v.sponsor_name}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: affordable ? '#7c3aed' : '#d1d5db' }}>⚡{v.xp_cost}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600 }}>{remaining} left</div>
                    </div>
                  </div>

                  {v.description && (
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>{v.description}</div>
                  )}

                  {/* Progress bar */}
                  <div style={{ background: '#f3f4f6', borderRadius: 99, height: 4, marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{ width: `${(v.claimed_count / v.total_pool) * 100}%`, height: '100%', background: soldOut ? '#ef4444' : catColor, borderRadius: 99 }} />
                  </div>

                  <div
                    onClick={() => {
                      if (disabled) return
                      setSelectedVoucher(v)
                      setError(null)
                      setScreen('confirming')
                    }}
                    style={{
                      background: disabled ? '#f3f4f6' : '#7c3aed',
                      color: disabled ? '#9ca3af' : '#fff',
                      borderRadius: 12, padding: '12px 0', textAlign: 'center',
                      fontWeight: 900, fontSize: 13,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {claimed ? '✅ Already Claimed' : soldOut ? 'Sold Out' : !affordable ? `Need ${v.xp_cost - (wallet?.total_xp ?? 0)} more XP` : `Claim for ⚡${v.xp_cost} XP`}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

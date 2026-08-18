"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type FeeStructure = { id: string; label: string; amount: number; currency: string | null; term: string | null; year: number | null }
type FeePayment = { id: string; amount: number; currency: string | null; method: string | null; reference: string | null; receipt_url: string | null; term: string | null; year: number | null; recorded_at: string | null }
type PaymentClaim = { id: string; amount: number; currency: string; method: string | null; reference: string | null; notes: string | null; payment_date: string | null; status: string; submitted_at: string }
type PocketMoney = { id: string; type: string; amount: number; currency: string | null; description: string | null; category: string | null; recorded_at: string | null }
type SavingsGoal = { id: string; title: string; description: string | null; target_amount: number; saved_amount: number | null; currency: string | null; status: string | null; target_date: string | null }

const C = { navy: '#0f172a', indigo: '#1e1b4b', emerald: '#059669', border: '#e2e8f0', muted: '#64748b', bg: '#f8fafc' }

function cash(value: number, currency = 'KES') {
  return `${currency} ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`
}

function statusTone(status: string) {
  if (status === 'confirmed') return { bg: '#dcfce7', color: '#166534' }
  if (status === 'rejected' || status === 'cancelled') return { bg: '#fee2e2', color: '#b91c1c' }
  if (status === 'needs_school_review') return { bg: '#ffedd5', color: '#9a3412' }
  return { bg: '#fef3c7', color: '#92400e' }
}

export default function ParentFinancePage() {
  const params = useParams()
  const router = useRouter()
  const studentId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''

  const [userId, setUserId] = useState('')
  const [childName, setChildName] = useState('Learner')
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [schoolName, setSchoolName] = useState('School')
  const [canViewFinance, setCanViewFinance] = useState(false)
  const [tab, setTab] = useState<'fees' | 'pocket' | 'savings'>('fees')
  const [structures, setStructures] = useState<FeeStructure[]>([])
  const [payments, setPayments] = useState<FeePayment[]>([])
  const [claims, setClaims] = useState<PaymentClaim[]>([])
  const [pocket, setPocket] = useState<PocketMoney[]>([])
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [claimAmount, setClaimAmount] = useState('')
  const [claimMethod, setClaimMethod] = useState('M-Pesa')
  const [claimReference, setClaimReference] = useState('')
  const [claimNotes, setClaimNotes] = useState('')
  const [claimDate, setClaimDate] = useState(new Date().toISOString().slice(0, 10))
  const [claimOpen, setClaimOpen] = useState(false)

  const [pocketAmount, setPocketAmount] = useState('')
  const [pocketType, setPocketType] = useState('allowance')
  const [pocketDescription, setPocketDescription] = useState('')
  const [pocketOpen, setPocketOpen] = useState(false)

  const [goalTitle, setGoalTitle] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalOpen, setGoalOpen] = useState(false)

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 2600)
  }, [])

  const load = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      setUserId(user.id)

      const { data: link, error: linkError } = await supabase
        .from('parent_student_links')
        .select('student_id, school_id, can_view_finance, access_level')
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle()
      if (linkError) throw linkError
      if (!link) throw new Error('This learner is not linked to your parent account.')
      if (link.access_level === 'none') throw new Error('Your access to this learner is currently restricted.')
      setCanViewFinance(Boolean(link.can_view_finance))

      const { data: student, error: studentError } = await supabase.from('students').select('name, class_id').eq('id', studentId).single()
      if (studentError) throw studentError
      setChildName(student.name)

      let resolvedSchoolId = link.school_id ?? null
      let resolvedSchoolName = 'School'
      if (student.class_id) {
        const { data: cls } = await supabase.from('classes').select('school_id, schools(name)').eq('id', student.class_id).single()
        resolvedSchoolId = cls?.school_id ?? resolvedSchoolId
        const school = Array.isArray(cls?.schools) ? cls?.schools[0] : cls?.schools
        if (school && typeof school === 'object' && 'name' in school && typeof school.name === 'string') resolvedSchoolName = school.name
      }
      setSchoolId(resolvedSchoolId)
      setSchoolName(resolvedSchoolName)

      const classId = student.class_id
      const feeQueries = Boolean(link.can_view_finance) ? Promise.all([
        classId ? supabase.from('finance_fee_structures').select('id, label, amount, currency, term, year').eq('class_id', classId).is('deleted_at', null).order('year', { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.from('finance_fee_payments').select('id, amount, currency, method, reference, receipt_url, term, year, recorded_at').eq('student_id', studentId).is('deleted_at', null).order('recorded_at', { ascending: false }),
        supabase.from('finance_parent_payment_claims').select('id, amount, currency, method, reference, notes, payment_date, status, submitted_at').eq('student_id', studentId).eq('parent_id', user.id).order('submitted_at', { ascending: false }),
      ]) : Promise.resolve([{ data: [] }, { data: [] }, { data: [] }])

      const [feeResults, pocketRes, goalsRes] = await Promise.all([
        feeQueries,
        supabase.from('finance_pocket_money').select('id, type, amount, currency, description, category, recorded_at').eq('student_id', studentId).eq('parent_id', user.id).is('deleted_at', null).order('recorded_at', { ascending: false }),
        supabase.from('finance_savings_goals').select('id, title, description, target_amount, saved_amount, currency, status, target_date').eq('student_id', studentId).eq('parent_id', user.id).is('deleted_at', null).order('created_at', { ascending: false }),
      ])

      setStructures((feeResults[0].data ?? []).map((row: any) => ({ ...row, amount: Number(row.amount ?? 0) })))
      setPayments((feeResults[1].data ?? []).map((row: any) => ({ ...row, amount: Number(row.amount ?? 0) })))
      setClaims((feeResults[2].data ?? []).map((row: any) => ({ ...row, amount: Number(row.amount ?? 0) })))
      setPocket((pocketRes.data ?? []).map((row: any) => ({ ...row, amount: Number(row.amount ?? 0) })))
      setGoals((goalsRes.data ?? []).map((row: any) => ({ ...row, target_amount: Number(row.target_amount ?? 0), saved_amount: Number(row.saved_amount ?? 0) })))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Finance information could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [router, studentId])

  useEffect(() => { void load() }, [load])

  const expected = useMemo(() => structures.reduce((sum, row) => sum + row.amount, 0), [structures])
  const paid = useMemo(() => payments.reduce((sum, row) => sum + row.amount, 0), [payments])
  const balance = Math.max(0, expected - paid)
  const pocketIn = useMemo(() => pocket.filter(row => row.type !== 'spend').reduce((sum, row) => sum + row.amount, 0), [pocket])
  const pocketOut = useMemo(() => pocket.filter(row => row.type === 'spend').reduce((sum, row) => sum + row.amount, 0), [pocket])

  async function submitClaim() {
    const amount = Number(claimAmount)
    if (!canViewFinance || !schoolId || !Number.isFinite(amount) || amount <= 0) return
    setSaving(true)
    setError('')
    const { error: claimError } = await supabase.from('finance_parent_payment_claims').insert({
      parent_id: userId,
      student_id: studentId,
      school_id: schoolId,
      amount,
      currency: 'KES',
      method: claimMethod || null,
      reference: claimReference.trim() || null,
      notes: claimNotes.trim() || null,
      payment_date: claimDate || null,
      status: 'pending',
    })
    setSaving(false)
    if (claimError) { setError(claimError.message); return }
    setClaimOpen(false)
    setClaimAmount(''); setClaimReference(''); setClaimNotes('')
    await load()
    showToast('Payment claim sent to the school for verification.')
  }

  async function addPocketEntry() {
    const amount = Number(pocketAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    setSaving(true)
    const { error: pocketError } = await supabase.from('finance_pocket_money').insert({
      student_id: studentId,
      parent_id: userId,
      type: pocketType,
      amount,
      currency: 'KES',
      description: pocketDescription.trim() || null,
      recorded_at: new Date().toISOString().slice(0, 10),
    })
    setSaving(false)
    if (pocketError) { setError(pocketError.message); return }
    setPocketOpen(false); setPocketAmount(''); setPocketDescription('')
    await load(); showToast('Family money entry saved.')
  }

  async function addGoal() {
    const target = Number(goalTarget)
    if (!goalTitle.trim() || !Number.isFinite(target) || target <= 0) return
    setSaving(true)
    const { error: goalError } = await supabase.from('finance_savings_goals').insert({
      student_id: studentId,
      parent_id: userId,
      title: goalTitle.trim(),
      target_amount: target,
      saved_amount: 0,
      currency: 'KES',
      status: 'active',
      recorded_at: new Date().toISOString().slice(0, 10),
    })
    setSaving(false)
    if (goalError) { setError(goalError.message); return }
    setGoalOpen(false); setGoalTitle(''); setGoalTarget('')
    await load(); showToast('Savings goal created.')
  }

  if (loading) return <section style={card}>Loading finance…</section>

  return (
    <div>
      {toast && <div style={toastStyle}>{toast}</div>}
      <section style={{ background: `linear-gradient(145deg,${C.navy},${C.indigo})`, borderRadius: 20, padding: 18, color: '#fff', marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#a7f3d0', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>Family finance</div>
        <h1 style={{ fontSize: 20, margin: '5px 0 4px' }}>{childName}</h1>
        <p style={{ margin: 0, fontSize: 12, color: '#cbd5e1' }}>{schoolName} · official school fees are kept separate from parent-submitted evidence.</p>
      </section>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 7, marginBottom: 12 }}>
        {[['fees','School fees'],['pocket','Pocket money'],['savings','Savings']].map(([value,label]) => <button key={value} onClick={() => setTab(value as typeof tab)} style={{ border: `1px solid ${tab === value ? C.emerald : C.border}`, background: tab === value ? '#ecfdf5' : '#fff', color: tab === value ? '#065f46' : C.muted, borderRadius: 11, padding: '9px 6px', fontSize: 10, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>)}
      </div>

      {tab === 'fees' && <>
        {!canViewFinance ? <section style={card}><h2 style={title}>School fees</h2><p style={muted}>This parent-child link does not include finance visibility. Contact the school if this should be enabled.</p></section> : <>
          <section style={card}>
            <div style={eyebrow}>Official school position</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 10 }}>
              <Summary label="Expected" value={structures.length === 0 ? 'Not published' : cash(expected)} />
              <Summary label="School recorded" value={cash(paid)} />
              <Summary label="Balance" value={structures.length === 0 ? '—' : cash(balance)} warn={balance > 0} />
            </div>
            <p style={{ ...muted, marginTop: 10 }}>Only school fee structures and school-recorded payment rows count here. A parent claim does not reduce the balance until the school verifies and records it.</p>
          </section>

          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><div><div style={eyebrow}>Fee structure</div><h2 style={title}>What the school has charged</h2></div></div>
            {structures.length === 0 ? <p style={muted}>The school has not published a fee structure for this class yet.</p> : <div style={{ display: 'grid', gap: 7 }}>{structures.map(row => <DataRow key={row.id} title={row.label || 'School fee'} meta={[row.term, row.year?.toString()].filter(Boolean).join(' · ')} value={cash(row.amount, row.currency ?? 'KES')} />)}</div>}
          </section>

          <section style={card}>
            <div style={eyebrow}>Verified ledger</div><h2 style={title}>Payments recorded by the school</h2>
            {payments.length === 0 ? <p style={muted}>No school-confirmed payment is visible yet.</p> : <div style={{ display: 'grid', gap: 7 }}>{payments.map(row => <DataRow key={row.id} title={row.method || 'Fee payment'} meta={[row.recorded_at, row.reference].filter(Boolean).join(' · ')} value={cash(row.amount, row.currency ?? 'KES')} />)}</div>}
          </section>

          <section style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><div><div style={eyebrow}>Parent evidence</div><h2 style={title}>Payment claims</h2></div><button onClick={() => setClaimOpen(value => !value)} style={smallButton}>{claimOpen ? 'Close' : 'Submit claim'}</button></div>
            {claimOpen && <div style={formBox}><Input label="Amount (KES)" value={claimAmount} onChange={setClaimAmount} type="number" /><Input label="Method" value={claimMethod} onChange={setClaimMethod} /><Input label="Reference / M-Pesa code" value={claimReference} onChange={setClaimReference} /><Input label="Payment date" value={claimDate} onChange={setClaimDate} type="date" /><Input label="Notes (optional)" value={claimNotes} onChange={setClaimNotes} /><button disabled={saving || !claimAmount} onClick={submitClaim} style={primaryButton}>{saving ? 'Sending…' : 'Send for school verification'}</button><p style={{ ...muted, marginTop: 8 }}>Submitting evidence does not mark school fees as paid. The school must verify it first.</p></div>}
            {claims.length === 0 ? <p style={muted}>No payment claims submitted.</p> : <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>{claims.map(row => { const tone = statusTone(row.status); return <div key={row.id} style={rowStyle}><div><strong style={{ fontSize: 12 }}>{row.method || 'Payment claim'}</strong><div style={muted}>{[row.payment_date, row.reference].filter(Boolean).join(' · ') || 'Submitted evidence'}</div></div><div style={{ textAlign: 'right' }}><strong style={{ fontSize: 12 }}>{cash(row.amount, row.currency)}</strong><div style={{ marginTop: 4 }}><span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: '3px 7px', fontSize: 9, fontWeight: 900, textTransform: 'capitalize' }}>{row.status.replaceAll('_',' ')}</span></div></div></div>})}</div>}
          </section>
        </>}
      </>}

      {tab === 'pocket' && <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><div><div style={eyebrow}>Family-managed</div><h2 style={title}>Pocket money</h2></div><button onClick={() => setPocketOpen(value => !value)} style={smallButton}>{pocketOpen ? 'Close' : 'Add entry'}</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, margin: '10px 0' }}><Summary label="In" value={cash(pocketIn)} /><Summary label="Spent" value={cash(pocketOut)} /><Summary label="Balance" value={cash(pocketIn - pocketOut)} /></div>
        {pocketOpen && <div style={formBox}><label style={labelStyle}>Type<select value={pocketType} onChange={event => setPocketType(event.target.value)} style={inputStyle}><option value="allowance">Allowance</option><option value="deposit">Deposit</option><option value="spend">Spend</option></select></label><Input label="Amount" value={pocketAmount} onChange={setPocketAmount} type="number" /><Input label="Description" value={pocketDescription} onChange={setPocketDescription} /><button disabled={saving || !pocketAmount} onClick={addPocketEntry} style={primaryButton}>{saving ? 'Saving…' : 'Save entry'}</button></div>}
        {pocket.length === 0 ? <p style={muted}>No family pocket-money entries yet.</p> : <div style={{ display: 'grid', gap: 7 }}>{pocket.map(row => <DataRow key={row.id} title={row.description || row.type} meta={row.recorded_at || ''} value={`${row.type === 'spend' ? '-' : '+'}${cash(row.amount, row.currency ?? 'KES')}`} />)}</div>}
      </section>}

      {tab === 'savings' && <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><div><div style={eyebrow}>Family-managed</div><h2 style={title}>Savings goals</h2></div><button onClick={() => setGoalOpen(value => !value)} style={smallButton}>{goalOpen ? 'Close' : 'New goal'}</button></div>
        {goalOpen && <div style={formBox}><Input label="Goal" value={goalTitle} onChange={setGoalTitle} /><Input label="Target amount" value={goalTarget} onChange={setGoalTarget} type="number" /><button disabled={saving || !goalTitle || !goalTarget} onClick={addGoal} style={primaryButton}>{saving ? 'Saving…' : 'Create goal'}</button></div>}
        {goals.length === 0 ? <p style={muted}>No savings goals yet.</p> : <div style={{ display: 'grid', gap: 9 }}>{goals.map(goal => { const saved = goal.saved_amount ?? 0; const pct = goal.target_amount > 0 ? Math.min(100, Math.round(saved / goal.target_amount * 100)) : 0; return <div key={goal.id} style={{ ...rowStyle, display: 'block' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><strong style={{ fontSize: 12 }}>{goal.title}</strong><div style={muted}>{goal.status || 'active'}</div></div><strong style={{ fontSize: 12 }}>{cash(saved, goal.currency ?? 'KES')} / {cash(goal.target_amount, goal.currency ?? 'KES')}</strong></div><div style={{ height: 7, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden', marginTop: 9 }}><div style={{ height: '100%', width: `${pct}%`, background: C.emerald }} /></div></div>})}</div>}
      </section>}

      <button onClick={() => router.push(`/parent/child/${studentId}`)} style={secondaryButton}>Back to {childName}</button>
    </div>
  )
}

function Summary({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return <div style={{ border: `1px solid ${warn ? '#fde68a' : C.border}`, background: warn ? '#fffbeb' : C.bg, borderRadius: 12, padding: 9 }}><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: .5, fontWeight: 900, color: C.muted }}>{label}</div><div style={{ marginTop: 4, fontSize: 13, fontWeight: 900, color: warn ? '#92400e' : C.navy }}>{value}</div></div>
}

function DataRow({ title: rowTitle, meta, value }: { title: string; meta: string; value: string }) {
  return <div style={rowStyle}><div style={{ minWidth: 0 }}><strong style={{ fontSize: 12, color: C.navy }}>{rowTitle}</strong><div style={muted}>{meta}</div></div><strong style={{ fontSize: 12, color: C.navy, textAlign: 'right' }}>{value}</strong></div>
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label style={labelStyle}>{label}<input type={type} value={value} onChange={event => onChange(event.target.value)} style={inputStyle} /></label>
}

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: 15, marginBottom: 12 }
const title: React.CSSProperties = { margin: '4px 0 10px', fontSize: 16, color: C.navy }
const eyebrow: React.CSSProperties = { fontSize: 9, fontWeight: 900, color: C.emerald, textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { fontSize: 10, color: C.muted, margin: 0, lineHeight: 1.4 }
const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, border: `1px solid ${C.border}`, borderRadius: 11, padding: 10, background: '#fff' }
const formBox: React.CSSProperties = { border: `1px solid ${C.border}`, background: C.bg, borderRadius: 13, padding: 12, display: 'grid', gap: 9, margin: '10px 0' }
const labelStyle: React.CSSProperties = { display: 'grid', gap: 5, fontSize: 10, fontWeight: 800, color: C.navy }
const inputStyle: React.CSSProperties = { width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 10px', fontSize: 12, fontFamily: 'inherit', background: '#fff', color: C.navy }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 11, background: C.emerald, color: '#fff', padding: 11, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer' }
const smallButton: React.CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 10, background: '#fff', color: C.emerald, padding: '7px 9px', fontWeight: 900, fontSize: 10, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { width: '100%', border: `1px solid ${C.border}`, borderRadius: 12, background: '#fff', color: C.navy, padding: 12, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const errorBox: React.CSSProperties = { border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 12, padding: 11, marginBottom: 10, fontSize: 11 }
const toastStyle: React.CSSProperties = { position: 'fixed', left: '50%', bottom: 90, transform: 'translateX(-50%)', zIndex: 1000, background: C.navy, color: '#fff', padding: '10px 15px', borderRadius: 12, fontSize: 11, fontWeight: 800, maxWidth: '90vw', textAlign: 'center' }

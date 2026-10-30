'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { HQPage, HQPanel, HQ_THEME, hqButtonStyle } from '@/components/hq/HQShell'
import { hqSupabase } from '@/lib/hq/supabase'
import SuccessWishesPaymentReadiness from '@/components/success-wishes/SuccessWishesPaymentReadiness'
import SuccessWishesBusinessReport from '@/components/success-wishes/SuccessWishesBusinessReport'
import SuccessWishesLedger from '@/components/success-wishes/SuccessWishesLedger'
import SuccessWishesSchoolReport from '@/components/success-wishes/SuccessWishesSchoolReport'

type School = {
  school_id: string
  school_name: string
  participates: boolean
  campaign_expires_at: string
  sponsored: boolean
  sponsored_until: string | null
  daily_limit: number
}
const fieldStyle: CSSProperties = {
  width: '100%', minHeight: 44, padding: '8px 12px', borderRadius: 10,
  border: '1px solid ' + HQ_THEME.border, background: HQ_THEME.panelSoft,
  color: HQ_THEME.text, fontSize: 14,
}

export default function SuccessWishesHQ() {
  const [section, setSection] = useState<'overview' | 'cards' | 'orders' | 'schools' | 'settings'>('overview')
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [schools, setSchools] = useState<School[]>([])
  const [schoolId, setSchoolId] = useState('')
  const [days, setDays] = useState(7)
  const [dailyLimit, setDailyLimit] = useState(20)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadSchools = useCallback(async () => {
    const { data, error: rpcError } = await hqSupabase.rpc('success_wishes_owner_schools')
    if (rpcError) throw new Error('The private school list could not load.')
    const list = Array.isArray(data) ? data as School[] : []
    setSchools(list)
    setSchoolId(existing => list.some(s => s.school_id === existing) ? existing : list[0]?.school_id || '')
  }, [])

  useEffect(() => {
    let live = true
    const check = async () => {
      try {
        const { data: identity, error: identityError } = await hqSupabase.auth.getUser()
        if (identityError || !identity.user) { if (live) setAllowed(false); return }
        const { data: owns, error: roleError } = await hqSupabase.rpc('is_platform_owner')
        if (roleError || owns !== true) { if (live) setAllowed(false); return }
        if (live) setAllowed(true)
        const { data, error: listError } = await hqSupabase.rpc('success_wishes_owner_schools')
        if (listError) throw new Error('The private school list could not load.')
        if (live) {
          const list = Array.isArray(data) ? data as School[] : []
          setSchools(list); setSchoolId(list[0]?.school_id || '')
        }
      } catch (reason) {
        if (live) setError(reason instanceof Error ? reason.message : 'Could not load sponsorship controls.')
      }
    }
    void check()
    return () => { live = false }
  }, [])

  const selected = schools.find(s => s.school_id === schoolId)
  async function changeSponsorship(enabled: boolean) {
    if (!selected || busy || allowed !== true || (enabled && (!confirm || !selected.participates))) return
    setBusy(true); setNotice(''); setError('')
    try {
      const { data, error: rpcError } = await hqSupabase.rpc('success_wishes_set_sponsored_pilot', {
        p_school_id: selected.school_id,
        p_enabled: enabled,
        p_days: days,
        p_daily_limit: dailyLimit,
      })
      if (rpcError || !data || typeof data !== 'object') throw new Error('The sponsorship decision was not saved.')
      await loadSchools()
      setConfirm(false)
      setNotice(enabled
        ? 'Sponsored text approved for the selected school, within the time and daily limits. Public sending remains separately disabled until release certification.'
        : 'Sponsored text revoked for the selected school.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sponsorship could not be updated.')
    } finally { setBusy(false) }
  }

  return <HQPage title="Success Wishes" description="Business overview and card management.">
    <nav aria-label="Success Wishes sections" style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:5,marginBottom:16}}>
      {([["overview","Overview"],["cards","Cards"],["orders","Orders"],["schools","Schools"],["settings","Settings"]] as const).map(([key,label]) => <button key={key} type="button" aria-current={section===key?"page":undefined} onClick={()=>setSection(key)} style={{minWidth:0,minHeight:44,borderRadius:10,border:"1px solid "+(section===key?"#dfc27a":HQ_THEME.border),background:section===key?"#dfc27a":HQ_THEME.panelSoft,color:section===key?"#111827":HQ_THEME.text,fontSize:11,fontWeight:section===key?700:500,padding:"8px 2px"}}>{label}</button>)}
    </nav>
    {section === "settings" && <>
    <HQPanel title="Sponsor only participating schools"
      description="Schools must separately accept the child-privacy responsibilities from their school administration workspace.">
      {allowed === null && <p role="status">Verifying founder authority…</p>}
      {allowed === false && <p role="alert">Only a registered platform owner can approve or revoke sponsored messages.</p>}
      {allowed === true && <>
        {schools.length === 0 && <p>No participating schools are configured yet. Ask a school administrator to register participation and verify candidates first.</p>}
        {schools.length > 0 && <>
          <label htmlFor="wishes-school" style={{display:'block',marginBottom:12}}>Participating school</label>
          <select id="wishes-school" value={schoolId} style={fieldStyle}
            disabled={busy} onChange={event => { setSchoolId(event.target.value); setConfirm(false); setNotice('') }}>
            {schools.map(s => <option key={s.school_id} value={s.school_id}>{s.school_name}</option>)}
          </select>
          {selected && <div style={{margin:'16px 0',fontSize:13,lineHeight:1.7}}>
            <div>School consent: <strong>{selected.participates ? 'Active' : 'Not participating'}</strong></div>
            <div>Text sponsorship: <strong>{selected.sponsored && selected.sponsored_until && Date.parse(selected.sponsored_until)>Date.now() ? 'Active' : 'Off or expired'}</strong></div>
            {selected.sponsored_until && <div>Sponsored until: {new Date(selected.sponsored_until).toLocaleString('en-KE', {timeZone:'Africa/Nairobi'})} EAT</div>}
            <div>Current daily cap: {selected.daily_limit} messages</div>
          </div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,margin:'16px 0'}}>
            <label>Approval length (days)
              <input type="number" min={1} max={14} step={1} required
                value={days} onChange={event => setDays(Number(event.target.value))}
                disabled={busy} style={fieldStyle}/>
            </label>
            <label>Maximum text wishes per school per day
              <input type="number" min={1} max={50} step={1} required
                value={dailyLimit} onChange={event => setDailyLimit(Number(event.target.value))}
                disabled={busy} style={fieldStyle}/>
            </label>
          </div>
          <label style={{display:'flex',gap:12,alignItems:'flex-start',margin:'12px 0'}}>
            <input type="checkbox" checked={confirm} disabled={busy} onChange={event => setConfirm(event.target.checked)}/>
            <span>I confirm this school's consent, the text-only scope and that messages will be capped and private.</span>
          </label>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            <button type="button" style={hqButtonStyle}
              disabled={busy || !confirm || !selected?.participates || days < 1 || days > 14 || dailyLimit < 1 || dailyLimit > 50}
              onClick={() => void changeSponsorship(true)}>Approve limited text pilot</button>
            <button type="button" style={{...hqButtonStyle,color:HQ_THEME.red}}
              disabled={busy || !selected?.sponsored} onClick={() => void changeSponsorship(false)}>Revoke sponsorship</button>
          </div>
        </>}
      </>}
      {error && <p role="alert" style={{color:HQ_THEME.red,marginTop:12}}>{error}</p>}
      {notice && <p role="status" style={{color:HQ_THEME.green,marginTop:12}}>{notice}</p>}
    </HQPanel>
    {allowed === true && <SuccessWishesPaymentReadiness/>}
    </>}
    {section === "overview" && allowed === true && <SuccessWishesBusinessReport/>}
    {section === "cards" && allowed === true && <SuccessWishesLedger/>}
    {section === "orders" && allowed === true && <><Link href="/hq/success-wishes/ledger" style={hqButtonStyle}>Open delivery ledger</Link><SuccessWishesBusinessReport/></>}
    {section === "schools" && allowed === true && <SuccessWishesSchoolReport/>}
    {allowed === null && <p role="status">Verifying founder access…</p>}
    {allowed === false && <p role="alert">Founder access required.</p>}
  </HQPage>
}

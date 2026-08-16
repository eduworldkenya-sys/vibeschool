'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  QUICK_CHECK_PATHWAYS,
  QUICK_CHECK_RULE_VERSION,
  QUICK_CHECK_STORAGE_KEY,
  calculateQuickCheck,
  evaluateQuickCheck,
} from '@/lib/pathways/quickCheck'

type StoredCheck = { answers?: Record<string, number>; complete?: boolean }
type AccessState = { role?: unknown; account_status?: unknown; is_anonymized?: unknown }

export default function PathwaysContinuePage() {
  const [stored, setStored] = useState<StoredCheck | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [eligible, setEligible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUICK_CHECK_STORAGE_KEY)
      setStored(raw ? JSON.parse(raw) as StoredCheck : null)
    } catch { setStored(null) }

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); return }
      setSignedIn(true)
      const { data, error } = await supabase.rpc('get_my_auth_access_state')
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) return
      const access = data as AccessState
      const role = typeof access.role === 'string' ? access.role : null
      setEligible((role === 'student' || role === 'global_user') && access.account_status !== 'restricted' && access.is_anonymized !== true)
    })()
  }, [])

  const answers = stored?.answers ?? {}
  const scores = useMemo(() => calculateQuickCheck(answers), [answers])
  const outcome = useMemo(() => evaluateQuickCheck(scores), [scores])

  async function save() {
    if (busy || outcome.status !== 'confident' || !eligible) return
    setBusy(true); setMessage('')
    try {
      let idempotencyKey = localStorage.getItem('vs_pathways_save_id_v2')
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID()
        localStorage.setItem('vs_pathways_save_id_v2', idempotencyKey)
      }
      const pathway = QUICK_CHECK_PATHWAYS[outcome.pathway]
      const { error } = await supabase.rpc('pathways_save_my_quick_check', {
        p_pathway_slug: pathway.canonicalSlug,
        p_answers: answers,
        p_scores: scores,
        p_rule_version: QUICK_CHECK_RULE_VERSION,
        p_idempotency_key: idempotencyKey,
      })
      if (error) { setMessage('We could not save your result. Your existing data was not changed.'); return }
      setMessage('Saved. You can return to this pathway from your learner account.')
    } finally { setBusy(false) }
  }

  return <main className="page"><div className="wrap">
    <header className="top"><Link href="/pathways/check">← Quick Check</Link><Link href="/" className="brand">VibeSchool</Link></header>
    <p className="eyebrow">SAVE YOUR DIRECTION</p>
    <h1>Keep your result and continue later.</h1>
    <p className="lead">You only need an account if you want VibeSchool to remember your pathway result across devices and future visits.</p>

    {!stored?.complete && <section className="card"><strong>No completed Quick Check found</strong><p>Complete the free check first, then come back here if you want to save the result.</p><Link className="primary" href="/pathways/check">Start Quick Check</Link></section>}

    {stored?.complete && outcome.status === 'uncertain' && <section className="card"><strong>There is nothing to save yet</strong><p>Your result is still uncertain. Explore more than one direction rather than saving one pathway as if it had clearly won.</p><div className="actions"><Link className="primary" href="/learn/careers">Explore careers</Link><Link href="/pathways">Explore pathways</Link></div></section>}

    {stored?.complete && outcome.status === 'confident' && signedIn === false && <section className="card"><span className="label">YOUR RESULT IS SAFE ON THIS DEVICE</span><strong>{QUICK_CHECK_PATHWAYS[outcome.pathway].name}</strong><p>{QUICK_CHECK_PATHWAYS[outcome.pathway].summary}</p><p>Sign in to an existing learner account or create one if you want to save this direction.</p><div className="actions"><Link className="primary" href="/login/global?redirect=/pathways/continue">Sign in and save</Link><Link href="/global/signup">Create learner account</Link></div><small>Signing in does not change your VibeSchool role. Pathways uses the learner identity already authorized by VibeSchool.</small></section>}

    {stored?.complete && outcome.status === 'confident' && signedIn === true && !eligible && <section className="card"><strong>This account cannot save a learner pathway</strong><p>This feature is for learner accounts. Your existing account and role will not be changed.</p><Link href="/pathways">Return to Pathways</Link></section>}

    {stored?.complete && outcome.status === 'confident' && eligible && <section className="card"><span className="label">READY TO SAVE</span><strong>{QUICK_CHECK_PATHWAYS[outcome.pathway].name}</strong><p>{QUICK_CHECK_PATHWAYS[outcome.pathway].summary}</p><button className="primary button" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save this result'}</button>{message && <p role="status" className="status">{message}</p>}</section>}
    <p className="privacy">Pathways cannot change your account role or create school-offering claims. Those remain controlled by VibeSchool's existing identity and verified-school systems.</p>
  </div><style jsx>{styles}</style></main>
}

const styles = `
.page{min-height:100dvh;background:#f7f7fb;color:#111827;font-family:var(--font-jakarta),Arial,sans-serif}.wrap{max-width:760px;margin:0 auto;padding:22px 18px 64px}.top{min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:16px}.top a,.card a{color:#4f46e5;font-weight:800;text-decoration:none}.brand{color:#111827!important}.eyebrow{margin:30px 0 10px;color:#4f46e5;font:900 11px var(--font-mono),monospace;letter-spacing:.15em}h1{font-size:clamp(32px,6vw,50px);line-height:1.06;letter-spacing:-.038em;margin:0 0 16px}.lead,p{color:#5b6475;line-height:1.65}.lead{font-size:16px;max-width:650px}.card{background:#fff;border:1px solid #e1e4eb;border-radius:20px;padding:22px;margin-top:24px;display:grid;gap:10px}.card strong{font-size:24px;line-height:1.2}.card p{margin:0}.card small{color:#7b8290;line-height:1.5}.label{font-size:10px;letter-spacing:.14em;font-weight:900;color:#6d5f20}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}.actions a,.button{min-height:48px;display:inline-flex;align-items:center;border:1px solid #dfe2ea;border-radius:13px;background:#fff;color:#252538;padding:11px 14px;font-weight:850;text-decoration:none;cursor:pointer}.actions .primary,.primary.button{border-color:#4f46e5;background:#4f46e5;color:#fff}.primary{width:max-content;min-height:48px;display:inline-flex;align-items:center;border-radius:13px;background:#4f46e5!important;color:#fff!important;padding:11px 14px;text-decoration:none;font-weight:850;border:0}.button:disabled{opacity:.55;cursor:not-allowed}.status{padding:12px;border-radius:12px;background:#f3f4f6;color:#374151!important}.privacy{font-size:12px;margin-top:24px;color:#737b8a}@media(max-width:520px){.wrap{padding:16px 16px 48px}h1{font-size:36px}.actions{display:grid}.actions a,.button,.primary{width:100%;justify-content:center;box-sizing:border-box}.card{padding:18px}}
`

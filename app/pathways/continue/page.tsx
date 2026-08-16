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
      if (error) { setMessage('Your pathway result was not saved. Nothing was changed.'); return }
      setMessage('Saved to your learner Pathway profile.')
    } finally { setBusy(false) }
  }

  return <main className="wrap">
    <Link href="/pathways/check">← Quick Check</Link>
    <p className="eyebrow">SAFE CONTINUATION</p>
    <h1>Keep the pathway result without giving Pathways control of your account.</h1>
    <p>Authentication, role and onboarding stay owned by VibeSchool's canonical auth system. Pathways only consumes an already-authorized learner identity.</p>

    {!stored?.complete && <section className="card"><strong>No completed Quick Check found.</strong><p>Complete the free check first.</p><Link href="/pathways/check">Start Quick Check</Link></section>}

    {stored?.complete && outcome.status === 'uncertain' && <section className="card"><strong>Nothing to save yet.</strong><p>Your result is uncertain, so VibeSchool will not persist a pathway choice as though one pathway had won.</p><Link href="/pathways">Explore all pathways</Link></section>}

    {stored?.complete && outcome.status === 'confident' && signedIn === false && <section className="card"><strong>Your result is still on this device.</strong><p>Sign in to an existing learner account, or create an independent learner account. The auth system decides your identity and destination.</p><div className="actions"><Link href="/login/global?redirect=/pathways/continue">Sign in</Link><Link href="/global/signup">Create learner account</Link></div></section>}

    {stored?.complete && outcome.status === 'confident' && signedIn === true && !eligible && <section className="card"><strong>This account cannot own a learner Pathway profile.</strong><p>Only canonical student or global learner roles can save this result. Pathways cannot change your role.</p></section>}

    {stored?.complete && outcome.status === 'confident' && eligible && <section className="card"><strong>{QUICK_CHECK_PATHWAYS[outcome.pathway].name}</strong><p>{QUICK_CHECK_PATHWAYS[outcome.pathway].summary}</p><button disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save this learner-owned result'}</button>{message && <p role="status">{message}</p>}</section>}
    <style jsx>{styles}</style>
  </main>
}

const styles = `
.wrap{min-height:100dvh;max-width:760px;margin:0 auto;padding:32px 18px 64px;background:#f7f7fb;color:#111827;font-family:var(--font-jakarta),Arial,sans-serif}.wrap>a,.card a{color:#4f46e5;font-weight:800;text-decoration:none}.eyebrow{margin:32px 0 10px;color:#4f46e5;font:900 11px var(--font-mono),monospace;letter-spacing:.15em}h1{font-size:clamp(30px,6vw,48px);line-height:1.08;letter-spacing:-.035em;margin:0 0 16px}p{color:#5b6475;line-height:1.65}.card{background:#fff;border:1px solid #e1e4eb;border-radius:18px;padding:20px;margin-top:22px}.card strong{font-size:20px}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}.card button,.actions a{border:0;border-radius:12px;background:#4f46e5;color:#fff;padding:12px 14px;font-weight:850;text-decoration:none;cursor:pointer}.card button:disabled{opacity:.55}
`

'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { adoptQuickCheck } from '@/lib/pathways/student'
import {
  QUICK_CHECK_PATHWAYS,
  QUICK_CHECK_QUESTIONS,
  QUICK_CHECK_RULE_VERSION,
  QUICK_CHECK_STORAGE_KEY,
  calculateQuickCheck,
  rankQuickCheck,
} from '@/lib/pathways/quickCheck'

const SAVE_KEY = 'vs_pathways_quick_check_save_key_v1'

type State = 'loading' | 'missing' | 'guest' | 'saving' | 'saved' | 'non_student' | 'error'

export default function PathwaysContinuePage() {
  const [state, setState] = useState<State>('loading')
  const [message, setMessage] = useState('')
  const [pathwayName, setPathwayName] = useState('')

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const raw = window.localStorage.getItem(QUICK_CHECK_STORAGE_KEY)
        if (!raw) { if (!cancelled) setState('missing'); return }
        const parsed = JSON.parse(raw) as { answers?: Record<string, number>; complete?: boolean }
        const answers = parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : null
        if (!answers || parsed.complete !== true || Object.keys(answers).length < QUICK_CHECK_QUESTIONS.length) {
          if (!cancelled) setState('missing')
          return
        }

        const scores = calculateQuickCheck(answers)
        const leader = rankQuickCheck(scores)[0]
        const pathway = QUICK_CHECK_PATHWAYS[leader]
        if (!cancelled) setPathwayName(pathway.name)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (!cancelled) setState('guest'); return }

        const { data: role, error: roleError } = await supabase.rpc('get_my_role')
        if (roleError) throw new Error('Your account role could not be confirmed.')
        if (role !== 'student') { if (!cancelled) setState('non_student'); return }

        if (!cancelled) setState('saving')
        let idempotencyKey = window.localStorage.getItem(SAVE_KEY)
        if (!idempotencyKey) {
          idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `pathways-${Date.now()}-${Math.random().toString(36).slice(2)}`
          window.localStorage.setItem(SAVE_KEY, idempotencyKey)
        }

        const saved = await adoptQuickCheck({
          pathwaySlug: pathway.canonicalSlug,
          answers,
          scores,
          ruleVersion: QUICK_CHECK_RULE_VERSION,
          idempotencyKey,
        })
        if (!cancelled) {
          setPathwayName(saved.pathwayName)
          setState('saved')
        }
      } catch (cause) {
        if (!cancelled) {
          setMessage(cause instanceof Error ? cause.message : 'Your pathway could not be saved.')
          setState('error')
        }
      }
    }

    void run()
    return () => { cancelled = true }
  }, [])

  return <main style={S.root}><div style={S.shell}>
    <Link href="/pathways/check" style={S.back}>← My result</Link>

    {state === 'loading' && <Panel title="Preparing your pathway…" body="Checking the result stored on this device." />}
    {state === 'saving' && <Panel title={`Saving ${pathwayName}…`} body="Your learner account is being connected to the pathway result you chose to save." />}

    {state === 'missing' && <>
      <Panel title="No completed pathway check was found" body="Your quick-check answers stay on the device where you completed them. Run the free check first, then choose Save my pathway." />
      <Link href="/pathways/check" style={S.primary}>Start the quick check</Link>
    </>}

    {state === 'guest' && <>
      <div style={S.kicker}>SAVE FOR FREE</div>
      <h1 style={S.h1}>Keep {pathwayName || 'your pathway'} and continue later.</h1>
      <p style={S.lead}>Your result is still on this device. Sign in as the learner to attach it to the learner's Pathway Passport. Required onboarding remains in control; Pathways cannot bypass it.</p>
      <div style={S.actions}>
        <Link href="/login/student?next=/pathways/continue" style={S.primary}>I already have a learner account</Link>
        <Link href="/signup/student?next=/pathways/continue" style={S.secondary}>Create learner account</Link>
        <Link href="/pathways/check" style={S.textLink}>Keep exploring without signing in</Link>
      </div>
      <p style={S.note}>Parents and teachers can use the free result without creating a learner decision on the child's behalf. Role-appropriate support projections are handled separately from learner-owned adoption.</p>
    </>}

    {state === 'saved' && <>
      <div style={S.kicker}>PATHWAY SAVED</div>
      <h1 style={S.h1}>{pathwayName} is now in your Pathway Passport.</h1>
      <p style={S.lead}>This records the direction you chose to save from the quick check. It remains early guidance, not an official placement decision, and it can be reviewed as your evidence and goals change.</p>
      <div style={S.actions}>
        <Link href="/student/profile" style={S.primary}>Open my learner profile</Link>
        <Link href="/student" style={S.secondary}>Go to Student Home</Link>
      </div>
    </>}

    {state === 'non_student' && <>
      <div style={S.kicker}>LEARNER-OWNED DECISION</div>
      <h1 style={S.h1}>Your result is safe on this device.</h1>
      <p style={S.lead}>This account is not a learner account, so VibeSchool will not overwrite a learner's Pathway Passport from it. Parent and teacher support views will use relationship-based permissions rather than taking ownership of the learner's decision.</p>
      <Link href="/pathways/check" style={S.primary}>Return to the result</Link>
    </>}

    {state === 'error' && <>
      <Panel title="We could not save your pathway" body={message || 'The result is still stored on this device. Nothing has been lost.'} />
      <div style={S.actions}><Link href="/pathways/continue" style={S.primary}>Try again</Link><Link href="/pathways/check" style={S.secondary}>Return to result</Link></div>
    </>}
  </div></main>
}

function Panel({ title, body }: { title: string; body: string }) {
  return <section style={S.panel}><h1 style={{ ...S.h1, fontSize: 27 }}>{title}</h1><p style={S.lead}>{body}</p></section>
}

const S: Record<string, CSSProperties> = {
  root: { minHeight: '100dvh', background: '#f7f7fb', color: '#111827', padding: '28px 16px 60px' },
  shell: { width: '100%', maxWidth: 620, margin: '0 auto' },
  back: { display: 'inline-block', marginBottom: 34, color: '#4f46e5', fontWeight: 800, fontSize: 13, textDecoration: 'none' },
  kicker: { color: '#4f46e5', fontWeight: 900, fontSize: 10, letterSpacing: '.17em', marginBottom: 10 },
  h1: { margin: '0 0 13px', fontSize: 34, lineHeight: 1.08, letterSpacing: '-.03em' },
  lead: { margin: '0 0 22px', color: '#626b7b', fontSize: 14, lineHeight: 1.65 },
  panel: { background: '#fff', border: '1px solid #e4e5ea', borderRadius: 18, padding: 20, marginBottom: 15 },
  actions: { display: 'grid', gap: 10 },
  primary: { display: 'block', textAlign: 'center', background: '#4f46e5', color: '#fff', padding: '13px 15px', borderRadius: 13, fontWeight: 850, fontSize: 13, textDecoration: 'none' },
  secondary: { display: 'block', textAlign: 'center', background: '#fff', color: '#3730a3', border: '1px solid #d7dae2', padding: '12px 15px', borderRadius: 13, fontWeight: 850, fontSize: 13, textDecoration: 'none' },
  textLink: { textAlign: 'center', color: '#5b6475', fontSize: 12, fontWeight: 750, textDecoration: 'none', padding: 8 },
  note: { marginTop: 20, padding: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 13, color: '#6b5b24', fontSize: 11, lineHeight: 1.55 },
}

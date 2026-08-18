"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LinkChildPage() {
  const router = useRouter()
  const [claimCode, setClaimCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleLink() {
    if (loading) return
    setError('')
    setSuccess('')

    const code = claimCode.trim().toUpperCase()
    if (code.length !== 6) {
      setError('Enter the 6-character parent claim code supplied by the school.')
      return
    }

    setLoading(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.replace('/login')
        return
      }

      const { data: result, error: rpcError } = await supabase.rpc('redeem_parent_claim', {
        p_code: code,
        p_user_id: user.id,
      })

      if (rpcError) {
        setError('We could not verify this relationship right now. Try again. If the problem continues, contact the school.')
        return
      }

      switch (result) {
        case 'success':
          setSuccess('Child linked. Your verified family view is ready.')
          router.replace('/parent')
          return
        case 'already_linked':
          setSuccess('This child is already linked to your account. Your family view is ready.')
          router.replace('/parent')
          return
        case 'not_found':
          setError('That parent claim code is not valid. Check the code or ask the school for a new parent code.')
          return
        case 'already_claimed':
          setError('That parent claim code has already been used. Ask the school for a new code if you still need access.')
          return
        case 'expired':
          setError('That parent claim code has expired. Ask the school for a new code.')
          return
        case 'student_not_found':
          setError('The code cannot be linked to an active learner record. Contact the school.')
          return
        default:
          setError('The relationship could not be verified. Contact the school if the code should still be valid.')
      }
    } catch {
      setError('Your connection was interrupted. No relationship was changed. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center bg-slate-50 px-4 py-8">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Verified family access</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Link your child</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use a one-time <strong>parent claim code</strong> issued by the school for this learner. You never need to enter or guess a student ID.
        </p>

        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          <p className="font-semibold">What this code proves</p>
          <p className="mt-1">
            A valid code establishes the parent-to-learner relationship for this account. It does not automatically grant pickup authority, make you the primary guardian, or reveal other learners.
          </p>
        </div>

        <div className="mt-6">
          <label htmlFor="parent-claim-code" className="block text-sm font-semibold text-slate-800">
            Parent claim code
          </label>
          <input
            id="parent-claim-code"
            type="text"
            value={claimCode}
            onChange={event => setClaimCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={event => {
              if (event.key === 'Enter' && claimCode.length === 6) void handleLink()
            }}
            placeholder="A1B2C3"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
            aria-describedby="claim-help"
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-center font-mono text-xl font-bold tracking-[0.35em] text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
          />
          <p id="claim-help" className="mt-2 text-xs leading-5 text-slate-500">
            Codes are one-time, role-specific and may expire. Keep the code private.
          </p>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
            {success}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleLink()}
          disabled={loading || claimCode.length !== 6}
          className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? 'Verifying relationship…' : 'Verify and link child'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/parent')}
          className="mt-2 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Back to Parent Home
        </button>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          Do not use another family&apos;s code. If the school linked the wrong learner, stop and contact the school rather than trying other codes.
        </p>
      </section>
    </main>
  )
}

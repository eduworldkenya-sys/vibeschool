"use client";
export const dynamic = "force-dynamic";

import { FormEvent, Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

function passwordProblem(value: string): string | null {
  if (value.length < 8) return "Password must be at least 8 characters."
  if (!/[a-z]/.test(value)) return "Password must include a lowercase letter."
  if (!/[A-Z]/.test(value)) return "Password must include an uppercase letter."
  if (!/[0-9]/.test(value)) return "Password must include a number."
  if (!/[^A-Za-z0-9]/.test(value)) return "Password must include a special character."
  return null
}

function ResetContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [ready, setReady] = useState(false)
  const [fatal, setFatal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [message, setMessage] = useState("Checking your recovery link…")

  useEffect(() => {
    let active = true

    async function establishRecoverySession() {
      try {
        const code = params.get("code")
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        }

        const { data, error } = await supabase.auth.getSession()
        if (error || !data.session) throw error ?? new Error("No recovery session")

        if (!active) return
        setReady(true)
        setMessage("Choose a new password for your VibeSchool account.")
      } catch {
        if (!active) return
        setFatal(true)
        setMessage("This password reset link is invalid or has expired. Request a new link from the sign-in page.")
      }
    }

    void establishRecoverySession()
    return () => { active = false }
  }, [params])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || busy) return

    const problem = passwordProblem(password)
    if (problem) {
      setMessage(problem)
      return
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.")
      return
    }

    setBusy(true)
    setMessage("Updating your password…")
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setMessage("Could not update your password. Request a new reset link and try again.")
        return
      }

      await supabase.auth.signOut()
      setMessage("Password updated. Redirecting to sign in…")
      router.replace("/login")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#05050F] text-white flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 shadow-2xl">
        <Link href="/" aria-label="VibeSchool home" className="mx-auto mb-6 flex max-w-[220px] justify-center">
          <img src="/icons/vibeschool-logo.png" alt="VibeSchool" className="max-h-16 w-auto object-contain" />
        </Link>

        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className={`mt-2 text-sm leading-6 ${fatal ? "text-red-300" : "text-white/70"}`} role="status" aria-live="polite">
          {message}
        </p>

        {!fatal && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-white/80">New password</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={!ready || busy}
                className="w-full rounded-lg border border-white/15 bg-[#0A0A1E] px-4 py-3 text-white outline-none focus:border-[#C8A84B] focus:ring-2 focus:ring-[#C8A84B]/20 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-white/80">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                disabled={!ready || busy}
                className="w-full rounded-lg border border-white/15 bg-[#0A0A1E] px-4 py-3 text-white outline-none focus:border-[#C8A84B] focus:ring-2 focus:ring-[#C8A84B]/20 disabled:opacity-50"
              />
            </div>

            <p className="text-xs leading-5 text-white/55">
              Use at least 8 characters with uppercase, lowercase, a number and a special character.
            </p>

            <button
              type="submit"
              disabled={!ready || busy}
              className="w-full rounded-lg bg-[#C8A84B] px-4 py-3 font-semibold text-[#05050F] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Updating…" : "Set new password"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-[#D7BC68] underline underline-offset-4">Return to sign in</Link>
        </div>
      </section>
    </main>
  )
}

export default function ResetPasswordPage() {
  return <Suspense><ResetContent /></Suspense>
}

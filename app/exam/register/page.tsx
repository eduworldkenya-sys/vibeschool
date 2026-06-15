'use client'

import { useRouter } from 'next/navigation'

export default function ExamRegisterPage() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-[#05050F] text-white p-4 font-[family:var(--font-display)] flex items-center justify-center">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 text-center shadow-2xl">
        <div className="h-12 w-12 bg-[#C8A84B]/10 border border-[#C8A84B] rounded-full flex items-center justify-center mx-auto text-xl">
          🎯
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight">You are on a Roll!</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            You have completed 3 exam sessions. Create a free VibeSchool account to save your progress, track your streak, and unlock more subjects.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push('/global/signup')}
            className="w-full h-12 bg-[#C8A84B] hover:bg-[#b0923e] text-[#05050F] font-extrabold rounded-xl text-sm uppercase tracking-wider transition-all"
          >
            Create Free Account
          </button>
          <button
            type="button"
            onClick={() => router.push('/exam')}
            className="w-full h-12 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white font-bold rounded-xl text-sm transition-all"
          >
            Continue Without Account
          </button>
        </div>
      </div>
    </div>
  )
}

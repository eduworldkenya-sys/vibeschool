"use client"

import { ExamResult } from '@/lib/types'
import { getKNECGrade } from '@/lib/examTracker'

interface ScoreCardProps {
  result: ExamResult
}

function IconAward() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  )
}

export default function ScoreCard({ result }: ScoreCardProps) {
  const analytics = getKNECGrade(result.percentage)

  return (
    <div className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl p-6 text-center space-y-4">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-black uppercase tracking-widest text-[#C8A84B]">
        <IconAward />
        <span>KNEC Evaluation Standard</span>
      </div>

      <div className="space-y-1">
        <div className="text-6xl font-black tracking-tighter text-white">
          {result.score}
          <span className="text-3xl font-light text-zinc-600"> / {result.total}</span>
        </div>
        <div className={`text-sm font-black tracking-widest uppercase ${analytics.color}`}>
          Projected Grade: {analytics.grade}
        </div>
      </div>

      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#C8A84B] rounded-full transition-all duration-500"
          style={{ width: `${result.percentage}%` }}
        />
      </div>

      <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
        Accuracy: {result.percentage}%
      </div>
    </div>
  )
}

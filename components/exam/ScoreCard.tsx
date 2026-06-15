import { ExamResult } from '@/lib/types'

interface ScoreCardProps {
  result: ExamResult
}

export default function ScoreCard({ result }: ScoreCardProps) {
  let colorClass = 'text-rose-500 border-rose-950 bg-rose-950/20'
  let label      = 'Keep Reviewing'

  if (result.percentage >= 60) {
    colorClass = 'text-emerald-400 border-emerald-950 bg-emerald-950/20'
    label      = 'KCSE Ready!'
  } else if (result.percentage >= 40) {
    colorClass = 'text-amber-400 border-amber-950 bg-amber-950/20'
    label      = 'Making Progress'
  }

  return (
    <div className={`w-full border rounded-2xl p-6 text-center space-y-2 ${colorClass}`}>
      <span className="text-xs uppercase font-extrabold tracking-widest block opacity-80">
        Your Score
      </span>
      <div className="text-6xl font-black tracking-tight">
        {result.score}
        <span className="text-2xl font-normal opacity-60"> / {result.total}</span>
      </div>
      <div className="text-xl font-bold">{result.percentage}%</div>
      <div className="text-xs font-semibold uppercase tracking-wider opacity-90 pt-1">
        {label}
      </div>
    </div>
  )
}

'use client'

interface ProgressBarProps {
  current: number
  total:   number
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0
  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
        <span>Progress</span>
        <span>{current} / {total}</span>
      </div>
      <div className="w-full h-2 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#C8A84B] rounded-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

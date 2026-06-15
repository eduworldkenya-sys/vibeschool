"use client"

interface FeedbackCardProps {
  isCorrect:     boolean
  explanation:   string
  teachingNote:  string
  correctAnswer: string
}

function IconCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-5" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  )
}

export default function FeedbackCard({ isCorrect, explanation, teachingNote, correctAnswer }: FeedbackCardProps) {
  return (
    <div className="w-full space-y-4">
      <div className={`border p-5 rounded-2xl flex items-start gap-4 ${
        isCorrect
          ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400'
          : 'bg-rose-950/20 border-rose-900 text-rose-400'
      }`}>
        <div className="shrink-0 mt-0.5">
          {isCorrect ? <IconCheck /> : <IconX />}
        </div>
        <div className="space-y-2">
          <h2 className="font-extrabold text-lg tracking-tight">
            {isCorrect ? 'Correct!' : 'Not quite'}
          </h2>
          {!isCorrect && (
            <p className="text-sm font-semibold text-zinc-300">
              Correct Answer: <span className="text-emerald-400">{correctAnswer}</span>
            </p>
          )}
          <p className="text-sm text-zinc-300 leading-relaxed">
            {explanation}
          </p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-[#C8A84B]/40 rounded-2xl p-5 space-y-2">
        <p className="text-xs uppercase font-extrabold tracking-widest text-[#C8A84B]">
          Learn This
        </p>
        <p className="text-sm text-white font-medium leading-relaxed">
          {teachingNote}
        </p>
      </div>
    </div>
  )
}

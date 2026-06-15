'use client'

import { ExamQuestion } from '@/lib/types'

interface QuestionCardProps {
  question:       ExamQuestion
  questionNumber: number
  total:          number
}

export default function QuestionCard({ question, questionNumber, total }: QuestionCardProps) {
  return (
    <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
      <span className="inline-flex items-center px-3 py-1 bg-[#C8A84B]/10 border border-[#C8A84B]/40 rounded-full text-xs font-bold text-[#C8A84B] tracking-wide uppercase">
        Question {questionNumber} of {total}
      </span>
      <p className="text-lg font-medium leading-relaxed text-white">
        {question.question}
      </p>
    </div>
  )
}

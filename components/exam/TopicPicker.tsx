"use client"

import { ExamForm } from '@/lib/types'
import { EXAM_DATA } from '@/lib/examData'

interface TopicPickerProps {
  form:     ExamForm
  selected: string | null
  onSelect: (t: string) => void
}

export default function TopicPicker({ form, selected, onSelect }: TopicPickerProps) {
  const topics = EXAM_DATA[form] ?? []
  return (
    <div className="w-full max-h-48 overflow-y-auto border border-zinc-800 rounded-xl bg-zinc-950/50 p-2 space-y-1">
      {topics.map((topic) => (
        <button
          key={topic}
          type="button"
          onClick={() => onSelect(topic)}
          className={`w-full h-11 px-3 text-left rounded-lg text-sm font-semibold transition-all flex items-center ${
            selected === topic
              ? 'bg-[#C8A84B] text-[#05050F]'
              : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
          }`}
        >
          {topic}
        </button>
      ))}
    </div>
  )
}

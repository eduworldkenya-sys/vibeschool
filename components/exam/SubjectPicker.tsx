import { ExamSubject } from '@/lib/types'

interface SubjectPickerProps {
  selected: ExamSubject | null
  onSelect: (s: ExamSubject) => void
}

const SUBJECTS: { name: ExamSubject; available: boolean }[] = [
  { name: 'Mathematics', available: true  },
  { name: 'English',     available: false },
  { name: 'Biology',     available: false },
  { name: 'Chemistry',   available: false },
  { name: 'History',     available: false },
]

export default function SubjectPicker({ selected, onSelect }: SubjectPickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
      {SUBJECTS.map((s) =>
        s.available ? (
          <button
            key={s.name}
            type="button"
            onClick={() => onSelect(s.name)}
            className={`h-14 px-4 border rounded-xl flex items-center font-bold text-sm transition-all ${
              selected === s.name
                ? 'bg-[#C8A84B]/10 border-[#C8A84B] text-[#C8A84B]'
                : 'bg-zinc-900 border-zinc-800 text-white hover:border-zinc-700'
            }`}
          >
            {s.name}
          </button>
        ) : (
          <div
            key={s.name}
            className="h-14 px-4 bg-zinc-950 border border-zinc-900 rounded-xl flex items-center justify-between opacity-50 cursor-not-allowed"
          >
            <span className="text-sm font-medium text-zinc-500">{s.name}</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-zinc-900 text-zinc-600 rounded">
              Soon
            </span>
          </div>
        )
      )}
    </div>
  )
}

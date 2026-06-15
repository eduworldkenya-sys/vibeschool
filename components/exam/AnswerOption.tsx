interface AnswerOptionProps {
  label:    string
  index:    number
  onSelect: (index: number) => void
  disabled?: boolean
}

export default function AnswerOption({ label, index, onSelect, disabled = false }: AnswerOptionProps) {
  const prefix = ['A', 'B', 'C', 'D'][index] ?? ''
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(index)}
      className="w-full min-h-[56px] text-left px-4 py-3 bg-zinc-900 border border-zinc-800 hover:border-[#C8A84B] rounded-xl flex items-center gap-3 transition-all group disabled:opacity-50 disabled:pointer-events-none active:scale-[0.995]"
    >
      <div className="h-8 w-8 shrink-0 bg-zinc-950 border border-zinc-700 group-hover:border-[#C8A84B] rounded-lg flex items-center justify-center font-bold text-sm text-[#C8A84B] transition-colors">
        {prefix}
      </div>
      <span className="text-sm text-zinc-200 font-medium leading-snug">
        {label}
      </span>
    </button>
  )
}

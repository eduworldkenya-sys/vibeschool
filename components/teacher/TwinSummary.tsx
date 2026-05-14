interface TwinObservations {
  mostUsedStructure: string;
  avgPrepTime: number;
  prepRate: number;
  commonReflectionThemes: string[];
  highestRatedConditions: string;
  weakestDeliveryArea: string;
  strongestDeliveryArea: string;
}

interface Props {
  summary: string;
  observations: TwinObservations;
}

export default function TwinSummary({ summary, observations }: Props) {
  return (
    <div className="rounded-2xl border border-[#00E5A0]/20 bg-gradient-to-br from-[#00E5A0]/5 to-[#00B8FF]/5 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00E5A0] to-[#00B8FF] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Twin Profile Summary</p>
          <p className="text-white/40 text-xs">Updated this term · Private to you</p>
        </div>
      </div>

      <p className="text-white/70 text-sm leading-relaxed mb-5 italic">"{summary}"</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/20 rounded-xl p-3">
          <p className="text-white/40 text-xs mb-1">Lesson Structure</p>
          <p className="text-white text-sm font-medium">{observations.mostUsedStructure}</p>
        </div>
        <div className="bg-black/20 rounded-xl p-3">
          <p className="text-white/40 text-xs mb-1">Prep Rate</p>
          <p className="text-[#00E5A0] text-sm font-bold">{observations.prepRate}%</p>
        </div>
        <div className="bg-black/20 rounded-xl p-3">
          <p className="text-white/40 text-xs mb-1">Strongest Area</p>
          <p className="text-white text-sm font-medium">{observations.strongestDeliveryArea}</p>
        </div>
        <div className="bg-black/20 rounded-xl p-3">
          <p className="text-white/40 text-xs mb-1">Growth Area</p>
          <p className="text-[#FFB800] text-sm font-medium">{observations.weakestDeliveryArea}</p>
        </div>
      </div>

      {observations.commonReflectionThemes.length > 0 && (
        <div className="mt-4">
          <p className="text-white/40 text-xs mb-2">Common Reflection Themes</p>
          <div className="flex flex-wrap gap-2">
            {observations.commonReflectionThemes.map((theme) => (
              <span
                key={theme}
                className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "green" | "blue" | "amber" | "red" | "default";
  icon?: React.ReactNode;
}

const accentMap = {
  green: "text-[#00E5A0] bg-[#00E5A0]/10 border-[#00E5A0]/20",
  blue: "text-[#00B8FF] bg-[#00B8FF]/10 border-[#00B8FF]/20",
  amber: "text-[#FFB800] bg-[#FFB800]/10 border-[#FFB800]/20",
  red: "text-[#FF4D6A] bg-[#FF4D6A]/10 border-[#FF4D6A]/20",
  default: "text-white/80 bg-white/5 border-white/10",
};

export default function StatCard({ label, value, sub, accent = "default", icon }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${accentMap[accent]}`}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium opacity-70 uppercase tracking-wider">{label}</span>
        {icon && <span className="opacity-60">{icon}</span>}
      </div>
      <span className="text-2xl font-bold leading-none">{value}</span>
      {sub && <span className="text-xs opacity-60">{sub}</span>}
    </div>
  );
}
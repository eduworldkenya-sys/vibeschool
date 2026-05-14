interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "green" | "blue" | "amber" | "red" | "default";
  icon?: React.ReactNode;
}

const accentMap = {
  green:   { bg: "#F0FBF7", border: "#A7EDD4", color: "#00875A", iconColor: "#00C07A" },
  blue:    { bg: "#F0F8FF", border: "#A0D4FF", color: "#005FA3", iconColor: "#0078D4" },
  amber:   { bg: "#FFFBF0", border: "#FFD966", color: "#996600", iconColor: "#F59E0B" },
  red:     { bg: "#FFF0F3", border: "#FFAAB8", color: "#C0002A", iconColor: "#EF4444" },
  default: { bg: "#F8F9FB", border: "#E2E5EB", color: "#3D4452", iconColor: "#9BA3AF" },
};

export default function StatCard({ label, value, sub, accent = "default", icon }: StatCardProps) {
  const a = accentMap[accent];
  return (
    <div style={{
      background: a.bg,
      border: `1px solid ${a.border}`,
      borderRadius: "14px",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#9BA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
        {icon && <span style={{ color: a.iconColor, opacity: 0.8 }}>{icon}</span>}
      </div>
      <span style={{ fontSize: "26px", fontWeight: 700, color: a.color, lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: "12px", color: "#9BA3AF" }}>{sub}</span>}
    </div>
  );
}
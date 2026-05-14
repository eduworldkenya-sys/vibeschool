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
    <div style={{
      background: "#F0FBF7",
      borderRadius: "16px",
      border: "1px solid #A7EDD4",
      padding: "24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "10px",
          background: "linear-gradient(135deg, #00C07A, #0078D4)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "#1A1D23", margin: 0 }}>Twin Profile Summary</p>
          <p style={{ fontSize: "12px", color: "#9BA3AF", margin: 0 }}>Updated this term · Private to you</p>
        </div>
      </div>

      <p style={{ fontSize: "13px", color: "#5A6270", lineHeight: 1.7, marginBottom: "20px", fontStyle: "italic" }}>
        "{summary}"
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {[
          { label: "Lesson Structure", value: observations.mostUsedStructure, color: "#1A1D23" },
          { label: "Prep Rate", value: `${observations.prepRate}%`, color: "#00875A" },
          { label: "Strongest Area", value: observations.strongestDeliveryArea, color: "#1A1D23" },
          { label: "Growth Area", value: observations.weakestDeliveryArea, color: "#996600" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "#FFFFFF",
            borderRadius: "10px",
            padding: "12px",
            border: "1px solid #E2E5EB",
          }}>
            <p style={{ fontSize: "11px", color: "#9BA3AF", margin: "0 0 4px" }}>{label}</p>
            <p style={{ fontSize: "13px", fontWeight: 600, color, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {observations.commonReflectionThemes.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <p style={{ fontSize: "11px", color: "#9BA3AF", marginBottom: "8px" }}>Common Reflection Themes</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {observations.commonReflectionThemes.map((theme) => (
              <span
                key={theme}
                style={{
                  padding: "4px 10px",
                  borderRadius: "99px",
                  background: "#FFFFFF",
                  border: "1px solid #E2E5EB",
                  fontSize: "12px",
                  color: "#5A6270",
                }}
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
import { TeacherDocument } from "@/lib/types";

const statusConfig: Record<string, { dot: string; color: string; label: string }> = {
  valid:    { dot: "#00C07A", color: "#00875A", label: "Valid" },
  expiring: { dot: "#F59E0B", color: "#996600", label: "Expiring" },
  missing:  { dot: "#EF4444", color: "#C0002A", label: "Missing" },
  expired:  { dot: "#EF4444", color: "#C0002A", label: "Expired" },
};

interface Props {
  documents: TeacherDocument[];
}

export default function DocumentStatus({ documents }: Props) {
  const counts = {
    valid:    documents.filter((d) => d.status === "valid").length,
    expiring: documents.filter((d) => d.status === "expiring").length,
    missing:  documents.filter((d) => d.status === "missing" || d.status === "expired").length,
  };

  return (
    <div style={{
      background: "#FFFFFF",
      borderRadius: "16px",
      border: "1px solid #E2E5EB",
      padding: "20px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#1A1D23", margin: 0 }}>Document Compliance</p>
        <a href="/teacher/documents" style={{ fontSize: "12px", color: "#0078D4", textDecoration: "none" }}>View all</a>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { count: counts.valid, color: "#00875A", label: "Valid" },
          { count: counts.expiring, color: "#996600", label: "Expiring" },
          { count: counts.missing, color: "#C0002A", label: "Missing" },
        ].map(({ count, color, label }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <p style={{ fontSize: "22px", fontWeight: 700, color, margin: 0 }}>{count}</p>
            <p style={{ fontSize: "11px", color: "#9BA3AF", marginTop: "2px" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div>
        {documents.map((doc, i) => {
          const cfg = statusConfig[doc.status];
          return (
            <div
              key={doc.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: i < documents.length - 1 ? "1px solid #F0F2F5" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.dot, flexShrink: 0, display: "inline-block" }} />
                <span style={{ fontSize: "13px", color: "#3D4452" }}>{doc.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {doc.expiryDate && (
                  <span style={{ fontSize: "11px", color: "#9BA3AF" }}>{doc.expiryDate}</span>
                )}
                <span style={{ fontSize: "12px", fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
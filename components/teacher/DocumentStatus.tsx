import { TeacherDocument } from "@/lib/types";

const statusConfig = {
  valid: { dot: "bg-[#00E5A0]", text: "text-[#00E5A0]", label: "Valid" },
  expiring: { dot: "bg-[#FFB800]", text: "text-[#FFB800]", label: "Expiring" },
  missing: { dot: "bg-[#FF4D6A]", text: "text-[#FF4D6A]", label: "Missing" },
  expired: { dot: "bg-[#FF4D6A] opacity-60", text: "text-[#FF4D6A]", label: "Expired" },
};

interface Props {
  documents: TeacherDocument[];
}

export default function DocumentStatus({ documents }: Props) {
  const counts = {
    valid: documents.filter((d) => d.status === "valid").length,
    expiring: documents.filter((d) => d.status === "expiring").length,
    missing: documents.filter((d) => d.status === "missing" || d.status === "expired").length,
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-sm">Document Compliance</p>
        <a href="/teacher/documents" className="text-xs text-[#00B8FF] hover:underline">View all</a>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="text-center">
          <p className="text-[#00E5A0] text-xl font-bold">{counts.valid}</p>
          <p className="text-white/40 text-xs mt-0.5">Valid</p>
        </div>
        <div className="text-center">
          <p className="text-[#FFB800] text-xl font-bold">{counts.expiring}</p>
          <p className="text-white/40 text-xs mt-0.5">Expiring</p>
        </div>
        <div className="text-center">
          <p className="text-[#FF4D6A] text-xl font-bold">{counts.missing}</p>
          <p className="text-white/40 text-xs mt-0.5">Missing</p>
        </div>
      </div>

      {/* Document list */}
      <div className="space-y-2">
        {documents.map((doc) => {
          const cfg = statusConfig[doc.status];
          return (
            <div key={doc.name} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <span className="text-white/70 text-sm">{doc.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {doc.expiryDate && (
                  <span className="text-white/30 text-xs">{doc.expiryDate}</span>
                )}
                <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
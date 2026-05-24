f = 'app/parent/learn/page.tsx'
lines = open(f).readlines()

exam_section = '''
        {/* Exam Results */}
        {examResults.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", color: "#6b7280", marginBottom: "10px" }}>Exam Results</div>
            {Array.from(new Set(examResults.map((r: any) => r.examName))).map((examName: any) => {
              const group = examResults.filter((r: any) => r.examName === examName);
              const first = group[0];
              const avg = Math.round(group.reduce((sum: number, r: any) => sum + (r.marks / r.maxMarks) * 100, 0) / group.length);
              return (
                <div key={examName} style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: "10px" }}>
                  <div style={{ background: "linear-gradient(135deg, #1e1b4b, #312e81)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#fff" }}>{examName}</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>Term {first.term} · {first.year}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: "700", color: avg >= 70 ? "#34d399" : avg >= 50 ? "#fbbf24" : "#f87171" }}>{avg}%</div>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>Average</div>
                    </div>
                  </div>
                  <div style={{ padding: "8px 16px" }}>
                    {group.map((r: any) => {
                      const pct = Math.round((r.marks / r.maxMarks) * 100);
                      const color = pct >= 70 ? "#059669" : pct >= 50 ? "#d97706" : "#dc2626";
                      return (
                        <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600", color: "#111827" }}>{r.isAbsent ? "ABS " : ""}{r.subject}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "11px", color: "#6b7280" }}>{r.marks}/{r.maxMarks}</span>
                            <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "700", color }}>{r.isAbsent ? "ABS" : pct + "%"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
'''

lines.insert(1028, exam_section)
open(f, 'w').writelines(lines)
print('done')

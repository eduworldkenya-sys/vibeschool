"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const dark   = "#1e1b4b";
const accent = "#10b981";

interface ClassOption {
  id:      string;
  name:    string;
  stream:  string;
  subject: string;
}

type Step = "details" | "school" | "class" | "done";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "13px 14px", borderRadius: 12,
  border: "1.5px solid #e5e7eb", fontSize: 14, color: "#111827",
  outline: "none", fontFamily: "inherit", background: "#f9fafb",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: 0.8,
  marginBottom: 6, display: "block",
};

export default function CreateChildPage() {
  const router = useRouter();

  const [step,       setStep]       = useState<Step>("details");
  const [childName,  setChildName]  = useState("");
  const [childDob,   setChildDob]   = useState("");
  const [subdomain,  setSubdomain]  = useState("");
  const [schoolId,   setSchoolId]   = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [classes,    setClasses]    = useState<ClassOption[]>([]);
  const [classId,    setClassId]    = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [doneMsg,    setDoneMsg]    = useState("");

  const primaryBtn = (disabled = false): React.CSSProperties => ({
    width: "100%", padding: "14px", borderRadius: 12, border: "none",
    background: disabled ? "#d1d5db" : accent,
    color: disabled ? "#9ca3af" : "#fff",
    fontWeight: 700, fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  });

  const outlineBtn: React.CSSProperties = {
    width: "100%", padding: "14px", borderRadius: 12,
    border: `1.5px solid ${dark}`,
    background: "transparent", color: dark,
    fontWeight: 700, fontSize: 15,
    cursor: "pointer", fontFamily: "inherit",
  };

  // ── Step 1 validation ──────────────────────────────────────────────────────
  function validateDetails(): boolean {
    if (!childName.trim()) { setError("Child name is required."); return false; }
    if (!childDob)         { setError("Date of birth is required."); return false; }
    setError("");
    return true;
  }

  // ── Skip school — create student with no class ─────────────────────────────
  async function handleSkip() {
    if (!validateDetails()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/academy/signin?role=parent"); return; }

    const { data: student, error: stuErr } = await supabase
      .from("students")
      .insert({
        name:             childName.trim(),
        class_id:         null,
        admission_number: null,
        profile_id:       null,
      })
      .select("id")
      .single();

    if (stuErr || !student) {
      setLoading(false);
      setError("Failed to create child profile. Please try again.");
      return;
    }

    const { error: linkErr } = await supabase
      .from("parent_student_links")
      .insert({
        parent_id:       user.id,
        student_id:      student.id,
        school_id:       null,
        relationship:    "parent",
        is_primary:      true,
        can_pickup:      true,
        receives_alerts: true,
      });

    if (linkErr) {
      setLoading(false);
      setError("Link error: LINKFAIL");
      return;
    }

    setLoading(false);
    setDoneMsg(`${childName.trim()} has been added to your account. You can link them to a school later.`);
    setStep("done");
  }

  // ── Go to school step ──────────────────────────────────────────────────────
  function handleAddToSchool() {
    if (!validateDetails()) return;
    setStep("school");
  }

  // ── Find school by subdomain ───────────────────────────────────────────────
  async function handleFindSchool() {
    setError("");
    if (!subdomain.trim()) { setError("Enter the school code."); return; }
    setLoading(true);

    const { data: school } = await supabase
      .from("schools")
      .select("id, name")
      .eq("subdomain", subdomain.trim().toLowerCase())
      .single();

    if (!school) {
      setLoading(false);
      setError("School not found. Check the code with your child\"s teacher.");
      return;
    }

    const { data: cls } = await supabase
      .from("classes")
      .select("id, name, stream, subject")
      .eq("school_id", school.id)
      .order("name", { ascending: true });

    setSchoolId(school.id);
    setSchoolName(school.name);
    setClasses(cls ?? []);
    setLoading(false);
    setStep("class");
  }

  // ── Submit with class ──────────────────────────────────────────────────────
  async function handleSubmit() {
    setError("");
    if (!classId) { setError("Please select a class."); return; }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/academy/signin?role=parent"); return; }

    const { data: student, error: stuErr } = await supabase
      .from("students")
      .insert({
        name:             childName.trim(),
        class_id:         classId,
        admission_number: null,
        profile_id:       null,
      })
      .select("id")
      .single();

    if (stuErr || !student) {
      setLoading(false);
      setError("Failed to create child profile. Please try again.");
      return;
    }

    const { error: linkErr } = await supabase
      .from("parent_student_links")
      .insert({
        parent_id:       user.id,
        student_id:      student.id,
        school_id:       schoolId,
        relationship:    "parent",
        is_primary:      true,
        can_pickup:      true,
        receives_alerts: true,
      });

    if (linkErr) {
      setLoading(false);
      setError("Link error: LINKFAIL");
      return;
    }

    const { error: reqErr } = await supabase
      .from("class_join_requests")
      .insert({
        student_id: student.id,
        class_id:   classId,
        parent_id:  user.id,
        status:     "pending",
      });

    if (reqErr) {
      setLoading(false);
      setError("Failed to send join request. Please try again.");
      return;
    }

    setLoading(false);
    setDoneMsg(`Join request sent. Once the teacher approves, ${childName.trim()} will appear on your dashboard.`);
    setStep("done");
  }

  // ── Back button logic ──────────────────────────────────────────────────────
  function handleBack() {
    if (step === "details" || step === "done") { router.push("/parent"); return; }
    if (step === "school") { setStep("details"); return; }
    if (step === "class")  { setStep("school");  return; }
  }

  const stepsWithIndicator: Step[] = ["details", "school", "class"];
  const stepIndex = stepsWithIndicator.indexOf(step);

  return (
    <div style={{ background: "#f0f2f5", paddingBottom: 40 }}>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
      `}</style>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`,
        padding: "20px 16px 28px", color: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            onClick={handleBack}
            style={{
              background: "rgba(255,255,255,0.12)", border: "none",
              borderRadius: 10, width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff", fontSize: 18,
            }}
          >
            ←
          </button>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: 0.8 }}>
              PARENT PORTAL
            </div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Add a Child</div>
          </div>
        </div>

        {step !== "done" && stepIndex >= 0 && (
          <div style={{ display: "flex", gap: 6 }}>
            {stepsWithIndicator.map((s, i) => (
              <div key={s} style={{
                flex: 1, height: 4, borderRadius: 4,
                background: i <= stepIndex ? accent : "rgba(255,255,255,0.2)",
              }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: 16, animation: "slideIn 0.22s ease" }}>

        {/* ── STEP: details ── */}
        {step === "details" && (
          <div style={{ background: "#fff", borderRadius: 20, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: dark, marginBottom: 4 }}>
              {"Child's Details"}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
              {"Enter your child's basic information. You can link them to a school later."}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="e.g. Amara Osei"
                  value={childName}
                  onChange={e => setChildName(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Date of Birth</label>
                <input
                  style={inputStyle}
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={childDob}
                  onChange={e => setChildDob(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={handleAddToSchool} style={primaryBtn(loading)}>
                🏫 Add to School
              </button>
              <button onClick={handleSkip} disabled={loading} style={outlineBtn}>
                {loading ? "Saving…" : "Skip for now — add school later"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: school ── */}
        {step === "school" && (
          <div style={{ background: "#fff", borderRadius: 20, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: dark, marginBottom: 4 }}>Find School</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
              Enter the school code given by the teacher.
            </div>

            <div>
              <label style={labelStyle}>School Code</label>
              <input
                style={{ ...inputStyle, textTransform: "lowercase" }}
                type="text"
                placeholder="e.g. greenwood"
                value={subdomain}
                onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/\s/g, ""))}
              />
            </div>

            {error && (
              <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, marginTop: 12 }}>
                {error}
              </div>
            )}

            <button
              onClick={handleFindSchool}
              disabled={loading}
              style={{ ...primaryBtn(loading), marginTop: 24 }}
            >
              {loading ? "Searching…" : "Find School →"}
            </button>
          </div>
        )}

        {/* ── STEP: class ── */}
        {step === "class" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: dark, marginBottom: 2 }}>Select Class</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 2 }}>{schoolName}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{"Choose the class your child belongs to."}</div>
            </div>

            {classes.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 16, padding: 24, textAlign: "center", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>No classes found</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  This school has no classes set up yet.
                </div>
                <button
                  onClick={() => setStep("details")}
                  style={{ ...outlineBtn, marginTop: 16, width: "auto", padding: "10px 24px" }}
                >
                  Skip for now
                </button>
              </div>
            ) : (
              classes.map(cls => {
                const selected = classId === cls.id;
                return (
                  <button
                    key={cls.id}
                    onClick={() => setClassId(cls.id)}
                    style={{
                      width: "100%",
                      background: selected ? "#ede9fe" : "#fff",
                      border: selected ? `2px solid ${dark}` : "1.5px solid #e5e7eb",
                      borderRadius: 14, padding: "14px 16px",
                      display: "flex", alignItems: "center", gap: 14,
                      cursor: "pointer", fontFamily: "inherit",
                      textAlign: "left",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: selected ? dark : "#f3f4f6",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17, flexShrink: 0,
                    }}>
                      🏫
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>
                        {cls.name}{cls.stream ? " · " + cls.stream : ""}
                      </div>
                      {cls.subject && (
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{cls.subject}</div>
                      )}
                    </div>
                    {selected && <span style={{ fontSize: 18, color: dark }}>✓</span>}
                  </button>
                );
              })
            )}

            {error && (
              <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}>{error}</div>
            )}

            {classes.length > 0 && (
              <button
                onClick={handleSubmit}
                disabled={loading || !classId}
                style={primaryBtn(loading || !classId)}
              >
                {loading ? "Sending Request…" : "Send Join Request"}
              </button>
            )}
          </div>
        )}

        {/* ── STEP: done ── */}
        {step === "done" && (
          <div style={{
            background: "#fff", borderRadius: 20, padding: 32,
            textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            animation: "fadeIn 0.22s ease",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: dark, marginBottom: 8 }}>
              {"Child Added!"}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 }}>
              {doneMsg}
            </div>
            <button onClick={() => router.push("/parent")} style={primaryBtn()}>
              Back to Dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

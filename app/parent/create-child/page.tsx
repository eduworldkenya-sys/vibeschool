
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const dark   = "#1e1b4b";
const accent = "#10b981";

const COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo Marakwet','Embu','Garissa',
  'Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi',
  'Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos',
  'Makueni','Mandera','Marsabit','Meru','Migori','Mombasa',"Murang'a",
  'Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri','Samburu',
  'Siaya','Taita Taveta','Tana River','Tharaka Nithi','Trans Nzoia','Turkana',
  'Uasin Gishu','Vihiga','Wajir','West Pokot',
]

interface ClassOption {
  id:     string;
  name:   string;
  stream: string;
}

type Step    = "details" | "school" | "class" | "done";
type Mode    = "choose" | "search" | "join" | "manual";

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
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [doneMsg,    setDoneMsg]    = useState("");

  // School search state
  const [mode,           setMode]           = useState<Mode>("choose");
  const [county,         setCounty]         = useState("");
  const [subCounties,    setSubCounties]    = useState<string[]>([]);
  const [subCounty,      setSubCounty]      = useState("");
  const [schools,        setSchools]        = useState<{id:string,name:string}[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [schoolName,     setSchoolName]     = useState("");
  const [joinCode,       setJoinCode]       = useState("");
  const [manualName,     setManualName]     = useState("");
  const [confirm,        setConfirm]        = useState(false);
  const [loadingSubs,    setLoadingSubs]    = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [schoolId,       setSchoolId]       = useState("");

  // Class state
  const [classes,  setClasses]  = useState<ClassOption[]>([]);
  const [classId,  setClassId]  = useState("");

  useEffect(() => {
    if (!county) return;
    setSubCounty(""); setSchools([]); setSelectedSchoolId("");
    setLoadingSubs(true);
    supabase.from("schools_directory").select("sub_county").eq("county", county)
      .then(({ data }) => {
        const unique = Array.from(new Set((data ?? []).map((r: {sub_county:string}) => r.sub_county).filter(Boolean))).sort() as string[];
        setSubCounties(unique);
        setLoadingSubs(false);
      });
  }, [county]);

  useEffect(() => {
    if (!county || !subCounty) return;
    setSchools([]); setSelectedSchoolId("");
    setLoadingSchools(true);
    supabase.from("schools_directory").select("id, name").eq("county", county).eq("sub_county", subCounty).order("name")
      .then(({ data }) => { setSchools(data ?? []); setLoadingSchools(false); });
  }, [county, subCounty]);

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

  const inp: React.CSSProperties = {
    width: "100%", marginTop: 4, padding: "10px 12px",
    borderRadius: 10, border: "1.5px solid #e5e7eb",
    fontSize: 14, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box", background: "#fff",
  };

  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#6b7280",
    letterSpacing: 1, textTransform: "uppercase" as const,
  };

  const modeBtn = (bg: string, color = "#fff"): React.CSSProperties => ({
    padding: "13px 20px", borderRadius: 12, border: "none",
    background: bg, color, fontWeight: 700, fontSize: 15,
    cursor: "pointer", fontFamily: "inherit", width: "100%",
  });

  function validateDetails(): boolean {
    if (!childName.trim()) { setError("Child name is required."); return false; }
    if (!childDob)         { setError("Date of birth is required."); return false; }
    setError(""); return true;
  }

  async function handleSkip() {
    if (!validateDetails()) return;
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/admin/login"); return; }
    const { data: studentId, error: stuErr } = await supabase.rpc("create_child_for_parent", {
      p_name: childName.trim(), p_dob: childDob, p_class_id: null,
    });
    if (stuErr || !studentId) { setLoading(false); setError("Failed to create child. Please try again."); return; }
    setLoading(false);
    setDoneMsg(`${childName.trim()} has been added to your account. You can link them to a school later.`);
    setStep("done");
  }

  function handleAddToSchool() {
    if (!validateDetails()) return;
    setStep("school");
  }

  async function proceedWithSchool(sid: string, sName: string) {
    setSchoolId(sid); setSchoolName(sName);
    const { data: cls } = await supabase.from("classes").select("id, name, stream").eq("school_id", sid).order("name");
    setClasses(cls ?? []);
    setLoading(false);
    setStep("class");
  }

  async function handleSearchSelect() {
    if (!selectedSchoolId) { setError("Select a school."); return; }
    setError(""); setLoading(true);
    const selected = schools.find(s => s.id === selectedSchoolId);
    if (!selected) { setLoading(false); setError("School not found."); return; }
    // Find in schools table by name
    const { data: existing } = await supabase.from("schools").select("id, name").ilike("name", selected.name).single();
    if (existing) { await proceedWithSchool(existing.id, existing.name); return; }
    setLoading(false); setError("School not registered on VibeSchool yet. Ask the teacher to register it first.");
  }

  async function handleJoin() {
    if (!joinCode.trim()) { setError("Enter a school code."); return; }
    setError(""); setLoading(true);
    const { data: school } = await supabase.from("schools").select("id, name, status").eq("subdomain", joinCode.trim().toLowerCase()).single();
    if (!school) { setLoading(false); setError("School not found. Check the code with your teacher."); return; }
    if (school.status === "suspended" || school.status === "closed") { setLoading(false); setError("This school is no longer active."); return; }
    await proceedWithSchool(school.id, school.name);
  }

  async function handleSubmit() {
    setError("");
    if (!classId) { setError("Please select a class."); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/admin/login"); return; }
    const { data: studentId, error: stuErr } = await supabase.rpc("create_child_for_parent", {
      p_name: childName.trim(), p_dob: childDob, p_class_id: classId,
    });
    if (stuErr || !studentId) { setLoading(false); setError("Failed to create child. Please try again."); return; }
    const { error: reqErr } = await supabase.from("class_join_requests").insert({
      student_id: studentId, class_id: classId, parent_id: user.id, status: "pending",
    });
    if (reqErr) { setLoading(false); setError("Failed to send join request. Please try again."); return; }
    setLoading(false);
    setDoneMsg(`Join request sent to ${schoolName}. Once the teacher approves, ${childName.trim()} will appear on your dashboard.`);
    setStep("done");
  }

  function handleBack() {
    if (step === "details" || step === "done") { router.push("/parent"); return; }
    if (step === "school") { setStep("details"); return; }
    if (step === "class")  { setStep("school");  return; }
  }

  const stepsWithIndicator: Step[] = ["details", "school", "class"];
  const stepIndex = stepsWithIndicator.indexOf(step);

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", paddingBottom: 40 }}>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
      `}</style>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`, padding: "20px 16px 28px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={handleBack} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: 0.8 }}>PARENT PORTAL</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Add a Child</div>
          </div>
        </div>
        {step !== "done" && stepIndex >= 0 && (
          <div style={{ display: "flex", gap: 6 }}>
            {stepsWithIndicator.map((s, i) => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= stepIndex ? accent : "rgba(255,255,255,0.2)" }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: 16, animation: "slideIn 0.22s ease" }}>

        {/* STEP: details */}
        {step === "details" && (
          <div style={{ background: "#fff", borderRadius: 20, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: dark, marginBottom: 4 }}>{"Child's Details"}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>{"Enter your child's basic information."}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} type="text" placeholder="e.g. Amara Osei" value={childName} onChange={e => setChildName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Date of Birth</label>
                <input style={inputStyle} type="date" max={new Date().toISOString().split("T")[0]} value={childDob} onChange={e => setChildDob(e.target.value)} />
              </div>
            </div>
            {error && <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={handleAddToSchool} style={primaryBtn(loading)}>🏫 Add to School</button>
              <button onClick={handleSkip} disabled={loading} style={outlineBtn}>{loading ? "Saving…" : "Skip for now — add school later"}</button>
            </div>
          </div>
        )}

        {/* STEP: school */}
        {step === "school" && (
          <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: dark, marginBottom: 4 }}>Find School</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>{"Search for your child's school."}</div>

            {mode === "choose" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button onClick={() => setMode("search")} style={modeBtn(dark)}>🔍 Search by County</button>
                <button onClick={() => setMode("join")} style={{ ...modeBtn("transparent", accent), border: "2px solid " + accent }}>🔗 Enter School Code</button>
              </div>
            )}

            {mode === "search" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <button onClick={() => { setMode("choose"); setError(""); }} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", textAlign: "left", fontSize: 13, fontFamily: "inherit", padding: 0 }}>← Back</button>
                <div>
                  <label style={lbl}>County</label>
                  <select value={county} onChange={e => setCounty(e.target.value)} disabled={loadingSubs} style={inp}>
                    <option value="">Select county</option>
                    {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {county && (
                  <div>
                    <label style={lbl}>Sub-county</label>
                    <select value={subCounty} onChange={e => setSubCounty(e.target.value)} disabled={loadingSubs} style={inp}>
                      <option value="">{loadingSubs ? "Loading…" : "Select sub-county"}</option>
                      {subCounties.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                {subCounty && (
                  <div>
                    <label style={lbl}>School</label>
                    {!loadingSchools && schools.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#6b7280", background: "#fef3c7", padding: "8px 12px", borderRadius: 8 }}>
                        No schools found. <span onClick={() => setMode("join")} style={{ color: accent, cursor: "pointer", fontWeight: 600 }}>Enter school code instead</span>
                      </p>
                    ) : (
                      <select value={selectedSchoolId} onChange={e => setSelectedSchoolId(e.target.value)} disabled={loadingSchools} style={inp}>
                        <option value="">{loadingSchools ? "Loading…" : "Select school"}</option>
                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                  </div>
                )}
                {error && <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}>{error}</p>}
                <button onClick={handleSearchSelect} disabled={loading || !selectedSchoolId} style={modeBtn(loading || !selectedSchoolId ? "#9ca3af" : accent)}>
                  {loading ? "Loading…" : "Continue →"}
                </button>
              </div>
            )}

            {mode === "join" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <button onClick={() => { setMode("choose"); setError(""); }} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", textAlign: "left", fontSize: 13, fontFamily: "inherit", padding: 0 }}>← Back</button>
                <p style={{ fontSize: 13, color: "#374151" }}>Ask the teacher for the school code.</p>
                <div>
                  <label style={lbl}>School Code</label>
                  <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="e.g. stm-4821" disabled={loading} style={inp} />
                </div>
                {error && <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}>{error}</p>}
                <button onClick={handleJoin} disabled={loading} style={modeBtn(loading ? "#9ca3af" : accent)}>
                  {loading ? "Searching…" : "Find School →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP: class */}
        {step === "class" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: dark, marginBottom: 2 }}>Select Class</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>{schoolName}</div>
            </div>
            {classes.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 16, padding: 24, textAlign: "center", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>No classes found</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>This school has no classes set up yet.</div>
                <button onClick={() => setStep("details")} style={{ ...outlineBtn, marginTop: 16, width: "auto", padding: "10px 24px" }}>Skip for now</button>
              </div>
            ) : (
              classes.map(cls => {
                const selected = classId === cls.id;
                return (
                  <button key={cls.id} onClick={() => setClassId(cls.id)} style={{ width: "100%", background: selected ? "#ede9fe" : "#fff", border: selected ? `2px solid ${dark}` : "1.5px solid #e5e7eb", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: selected ? dark : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>🏫</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{cls.name}{cls.stream ? " · " + cls.stream : ""}</div>
                    </div>
                    {selected && <span style={{ fontSize: 18, color: dark }}>✓</span>}
                  </button>
                );
              })
            )}
            {error && <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}>{error}</div>}
            {classes.length > 0 && (
              <button onClick={handleSubmit} disabled={loading || !classId} style={primaryBtn(loading || !classId)}>
                {loading ? "Sending Request…" : "Send Join Request"}
              </button>
            )}
          </div>
        )}

        {/* STEP: done */}
        {step === "done" && (
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", animation: "fadeIn 0.22s ease" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: dark, marginBottom: 8 }}>Child Added!</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 }}>{doneMsg}</div>
            <button onClick={() => router.push("/parent")} style={primaryBtn()}>Back to Dashboard</button>
          </div>
        )}

      </div>
    </div>
  );
}

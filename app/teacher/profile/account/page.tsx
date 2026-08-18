"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, ImageOff, KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Privacy = {
  parent_visibility: boolean;
  student_visibility: boolean;
  colleague_visibility: boolean;
  directory_visibility: "private" | "school_only" | "school_community";
};

type Verification = {
  tsc_status: string;
  school_status: string;
  employment_status: string;
};

const DEFAULT_PRIVACY: Privacy = {
  parent_visibility: false,
  student_visibility: false,
  colleague_visibility: true,
  directory_visibility: "school_only",
};

export default function TeacherAccountTrustPage() {
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>(DEFAULT_PRIVACY);
  const [verification, setVerification] = useState<Verification>({ tsc_status: "unverified", school_status: "unverified", employment_status: "unverified" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const db = supabase as any;

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      setNotice({ kind: "error", text: "Your session could not be verified. Please sign in again." });
      setLoading(false);
      return;
    }
    const id = data.user.id;
    setUid(id);
    setEmail(data.user.email ?? "");
    const [privacyRes, verificationRes] = await Promise.all([
      db.from("teacher_profile_privacy").select("parent_visibility,student_visibility,colleague_visibility,directory_visibility").eq("profile_id", id).maybeSingle(),
      db.from("teacher_profile_verifications").select("tsc_status,school_status,employment_status").eq("profile_id", id).maybeSingle(),
    ]);
    if (privacyRes.data) setPrivacy({ ...DEFAULT_PRIVACY, ...privacyRes.data });
    if (verificationRes.data) setVerification(verificationRes.data as Verification);
    setLoading(false);
  }

  async function savePrivacy() {
    if (!uid) return;
    setBusy("privacy"); setNotice(null);
    const { error } = await db.from("teacher_profile_privacy").upsert({ profile_id: uid, ...privacy, updated_at: new Date().toISOString() }, { onConflict: "profile_id" });
    setBusy(null);
    setNotice(error ? { kind: "error", text: "Privacy preferences could not be saved." } : { kind: "ok", text: "Privacy preferences saved." });
  }

  async function changePassword() {
    if (password.length < 8) { setNotice({ kind: "error", text: "Use at least 8 characters for your new password." }); return; }
    if (password !== confirmPassword) { setNotice({ kind: "error", text: "The password confirmation does not match." }); return; }
    setBusy("password"); setNotice(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (error) { setNotice({ kind: "error", text: "Password could not be changed. Re-authentication may be required." }); return; }
    setPassword(""); setConfirmPassword("");
    setNotice({ kind: "ok", text: "Password updated successfully." });
  }

  async function removeAvatar() {
    if (!uid) return;
    setBusy("avatar"); setNotice(null);
    const listed = await supabase.storage.from("avatars").list(uid, { limit: 20 });
    const paths = (listed.data ?? []).filter((file) => file.name.startsWith("profile.")).map((file) => `${uid}/${file.name}`);
    if (paths.length) {
      const removed = await supabase.storage.from("avatars").remove(paths);
      if (removed.error) { setBusy(null); setNotice({ kind: "error", text: "Profile photo could not be removed." }); return; }
    }
    const profileRes = await db.from("profiles").update({ avatar_url: null }).eq("id", uid);
    setBusy(null);
    setNotice(profileRes.error ? { kind: "error", text: "Photo files were cleared, but the profile reference could not be updated." } : { kind: "ok", text: "Profile photo removed. Your initials will be used as the fallback." });
  }

  async function signOutEverywhere() {
    setBusy("signout");
    await supabase.auth.signOut({ scope: "global" });
    window.location.assign("/login");
  }

  if (loading) return <main className="acct"><div className="loading"><Loader2 className="spin" size={22}/> Loading account security…</div><Style/></main>;

  return <main className="acct"><div className="wrap">
    <Link href="/teacher/profile" className="back"><ArrowLeft size={16}/> Back to professional profile</Link>
    <header><div><p>Teacher account</p><h1>Security, privacy & trust</h1><span>Manage login security, audience visibility and your verified professional status without mixing them into your editable professional record.</span></div><ShieldCheck size={34}/></header>
    {notice && <div className={`notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.kind === "ok" ? <CheckCircle2 size={17}/> : <ShieldCheck size={17}/>} {notice.text}</div>}

    <section className="grid">
      <article><h2><ShieldCheck size={19}/> Professional verification</h2><p className="muted">Verification is authoritative platform/school evidence. Editing profile text never grants verified status.</p>
        <Trust label="TSC identity" value={verification.tsc_status}/><Trust label="School membership" value={verification.school_status}/><Trust label="Employment relationship" value={verification.employment_status}/>
      </article>

      <article><h2><Eye size={19}/> Profile visibility</h2><p className="muted">These preferences control intended presentation only. They never bypass role authorization or database RLS.</p>
        <Toggle label="Visible to colleagues" checked={privacy.colleague_visibility} onChange={(v)=>setPrivacy({...privacy,colleague_visibility:v})}/>
        <Toggle label="Visible to parents" checked={privacy.parent_visibility} onChange={(v)=>setPrivacy({...privacy,parent_visibility:v})}/>
        <Toggle label="Visible to students" checked={privacy.student_visibility} onChange={(v)=>setPrivacy({...privacy,student_visibility:v})}/>
        <label className="field"><span>Directory visibility</span><select value={privacy.directory_visibility} onChange={(e)=>setPrivacy({...privacy,directory_visibility:e.target.value as Privacy["directory_visibility"]})}><option value="private">Private</option><option value="school_only">My school only</option><option value="school_community">School community</option></select></label>
        <button className="primary" onClick={()=>void savePrivacy()} disabled={busy==="privacy"}>{busy==="privacy"?<Loader2 className="spin" size={16}/>:null} Save privacy</button>
      </article>

      <article><h2><KeyRound size={19}/> Login security</h2><p className="muted">Signed in as <strong>{email || "account email unavailable"}</strong>.</p>
        <label className="field"><span>New password</span><input type="password" autoComplete="new-password" value={password} onChange={(e)=>setPassword(e.target.value)} /></label>
        <label className="field"><span>Confirm new password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} /></label>
        <button className="primary" onClick={()=>void changePassword()} disabled={busy==="password"}>{busy==="password"?<Loader2 className="spin" size={16}/>:null} Change password</button>
        <button className="danger" onClick={()=>void signOutEverywhere()} disabled={busy==="signout"}><LogOut size={16}/> Sign out all sessions</button>
      </article>

      <article><h2><ImageOff size={19}/> Profile photo lifecycle</h2><p className="muted">Replacing a photo is handled from the professional profile. Removing it here clears all profile image variants in your own avatar folder and restores the initials fallback.</p>
        <button className="secondary" onClick={()=>void removeAvatar()} disabled={busy==="avatar"}>{busy==="avatar"?<Loader2 className="spin" size={16}/>:<ImageOff size={16}/>} Remove profile photo</button>
      </article>
    </section>

    <section className="ops"><h2>Operational records live elsewhere</h2><p>Attendance, leave, appraisal, messaging, documents, payroll and finance remain dedicated operational modules. They are intentionally not editable profile tabs.</p></section>
  </div><Style/></main>;
}

function Trust({label,value}:{label:string;value:string}) { const verified=value==="verified"; return <div className="trust"><span>{label}</span><strong className={verified?"verified":"pending"}>{verified?<CheckCircle2 size={15}/>:<EyeOff size={15}/>} {value.replaceAll("_"," ")}</strong></div>; }
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}) { return <label className="toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)}/><i aria-hidden="true"/></label>; }
function Style(){return <style jsx global>{`
.acct{min-height:100vh;background:#f7f8fb;color:#18212f;padding:24px 16px 80px}.wrap{max-width:1020px;margin:auto}.back{display:inline-flex;align-items:center;gap:7px;color:#475569;text-decoration:none;font-weight:700;margin-bottom:18px}header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;background:#fff;border:1px solid #e4e7ec;border-radius:20px;padding:24px;margin-bottom:18px;box-shadow:0 8px 30px rgba(15,23,42,.05)}header p{margin:0 0 6px;color:#64748b;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.12em}header h1{margin:0 0 8px;font-size:28px}header span,.muted,.ops p{color:#64748b;line-height:1.6}.notice{display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:12px;margin-bottom:18px;font-weight:700}.notice.ok{background:#ecfdf5;color:#047857}.notice.error{background:#fef2f2;color:#b91c1c}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.grid article,.ops{background:#fff;border:1px solid #e4e7ec;border-radius:18px;padding:20px}.grid h2,.ops h2{display:flex;align-items:center;gap:8px;font-size:18px;margin:0 0 8px}.trust,.toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid #eef2f7;padding:14px 0}.trust strong{display:inline-flex;align-items:center;gap:5px;font-size:12px;text-transform:capitalize}.verified{color:#047857}.pending{color:#64748b}.field{display:grid;gap:7px;margin:14px 0}.field span{font-size:13px;font-weight:800}.field input,.field select{width:100%;box-sizing:border-box;border:1px solid #d7dde7;border-radius:11px;padding:11px 12px;background:#fff;font:inherit}.primary,.secondary,.danger{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:11px;padding:11px 14px;font-weight:800;cursor:pointer}.primary{background:#0f172a;color:#fff}.secondary{background:#eef2ff;color:#312e81}.danger{background:#fff1f2;color:#be123c;margin-left:8px}.toggle input{position:absolute;opacity:0}.toggle i{width:42px;height:24px;background:#cbd5e1;border-radius:999px;position:relative;transition:.2s}.toggle i:after{content:"";position:absolute;width:18px;height:18px;left:3px;top:3px;border-radius:50%;background:white;transition:.2s}.toggle input:checked+i{background:#0f766e}.toggle input:checked+i:after{transform:translateX(18px)}.ops{margin-top:18px}.loading{max-width:1020px;margin:80px auto;display:flex;gap:9px;align-items:center;color:#64748b}.spin{animation:acctspin 1s linear infinite}@keyframes acctspin{to{transform:rotate(360deg)}}@media(max-width:760px){.grid{grid-template-columns:1fr}header h1{font-size:24px}.danger{margin:8px 0 0;width:100%}.primary,.secondary{width:100%}}
`}</style>}

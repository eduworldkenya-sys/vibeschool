"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronRight,
  GraduationCap,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  School,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

type Tab = "overview" | "personal" | "professional" | "credentials" | "preferences";

type ProfileRecord = {
  id: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  county: string;
  sub_county: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  school_id: string | null;
  avatar_url: string;
};

type TeacherRecord = {
  profile_id: string;
  tsc_number: string;
  employment_type: string;
  job_title: string;
  department: string;
  date_joined: string;
  bio: string;
  teaching_philosophy: string;
  teaching_style: string;
  classroom_management: string;
  learning_support: string;
  assessment_approach: string;
  qualifications: Json | null;
  professional_development: Json | null;
};

type AssignmentRow = { class_id: string; subject_id: string };
type Assignment = { className: string; subjectName: string };
type Qualification = { qualification: string; institution: string; year: string; specialization: string };
type Development = { title: string; provider: string; year: string };

const TABS: Array<{ id: Tab; label: string; icon: typeof UserRound }> = [
  { id: "overview", label: "Overview", icon: UserRound },
  { id: "personal", label: "Personal", icon: Phone },
  { id: "professional", label: "Professional", icon: BriefcaseBusiness },
  { id: "credentials", label: "Credentials", icon: GraduationCap },
  { id: "preferences", label: "Teaching preferences", icon: BookOpen },
];

const EMPTY_PROFILE: ProfileRecord = {
  id: "", email: "", full_name: "", first_name: "", last_name: "", phone: "",
  date_of_birth: "", gender: "", county: "", sub_county: "", address: "",
  emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_relation: "",
  school_id: null, avatar_url: "",
};

const EMPTY_TEACHER: TeacherRecord = {
  profile_id: "", tsc_number: "", employment_type: "", job_title: "", department: "",
  date_joined: "", bio: "", teaching_philosophy: "", teaching_style: "",
  classroom_management: "", learning_support: "", assessment_approach: "",
  qualifications: [], professional_development: [],
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function qualificationsFrom(value: Json | null): Qualification[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    return [{
      qualification: text(item.qualification), institution: text(item.institution),
      year: typeof item.year === "number" ? String(item.year) : text(item.year),
      specialization: text(item.specialization),
    }];
  });
}

function developmentFrom(value: Json | null): Development[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    return [{ title: text(item.title), provider: text(item.provider), year: typeof item.year === "number" ? String(item.year) : text(item.year) }];
  });
}

export default function TeacherProfilePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<ProfileRecord>(EMPTY_PROFILE);
  const [teacher, setTeacher] = useState<TeacherRecord>(EMPTY_TEACHER);
  const [schoolName, setSchoolName] = useState("Not assigned");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [development, setDevelopment] = useState<Development[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Repository-generated Supabase types currently lag several production profile columns.
  // Keep that temporary escape hatch local to this page; auth and storage remain strongly typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setNotice(null);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setNotice({ kind: "error", text: "Your session could not be verified. Please sign in again." });
      setLoading(false);
      return;
    }

    const uid = auth.user.id;
    const [profileRes, teacherRes, assignmentRes] = await Promise.all([
      db.from("profiles").select("id,full_name,first_name,last_name,phone,date_of_birth,gender,county,sub_county,address,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,school_id,avatar_url").eq("id", uid).single(),
      db.from("teacher_profiles").select("profile_id,tsc_number,employment_type,job_title,department,date_joined,bio,teaching_philosophy,teaching_style,classroom_management,learning_support,assessment_approach,qualifications,professional_development").eq("profile_id", uid).maybeSingle(),
      db.from("teacher_classes").select("class_id,subject_id").eq("teacher_id", uid),
    ]);

    if (profileRes.error) {
      setNotice({ kind: "error", text: "We could not load your teacher profile. Please refresh and try again." });
      setLoading(false);
      return;
    }

    const p = profileRes.data ?? {};
    const t = teacherRes.data ?? {};
    const nextProfile: ProfileRecord = {
      ...EMPTY_PROFILE,
      id: uid,
      email: auth.user.email ?? "",
      full_name: text(p.full_name), first_name: text(p.first_name), last_name: text(p.last_name),
      phone: text(p.phone), date_of_birth: text(p.date_of_birth), gender: text(p.gender), county: text(p.county),
      sub_county: text(p.sub_county), address: text(p.address), emergency_contact_name: text(p.emergency_contact_name),
      emergency_contact_phone: text(p.emergency_contact_phone), emergency_contact_relation: text(p.emergency_contact_relation),
      school_id: typeof p.school_id === "string" ? p.school_id : null, avatar_url: text(p.avatar_url),
    };
    const nextTeacher: TeacherRecord = {
      ...EMPTY_TEACHER, profile_id: uid,
      tsc_number: text(t.tsc_number), employment_type: text(t.employment_type), job_title: text(t.job_title),
      department: text(t.department), date_joined: text(t.date_joined), bio: text(t.bio),
      teaching_philosophy: text(t.teaching_philosophy), teaching_style: text(t.teaching_style),
      classroom_management: text(t.classroom_management), learning_support: text(t.learning_support),
      assessment_approach: text(t.assessment_approach), qualifications: (t.qualifications ?? []) as Json,
      professional_development: (t.professional_development ?? []) as Json,
    };

    setProfile(nextProfile);
    setTeacher(nextTeacher);
    setQualifications(qualificationsFrom(nextTeacher.qualifications));
    setDevelopment(developmentFrom(nextTeacher.professional_development));

    if (nextProfile.school_id) {
      const schoolRes = await db.from("schools").select("name").eq("id", nextProfile.school_id).maybeSingle();
      setSchoolName(text(schoolRes.data?.name) || "School assigned");
    }

    const rows = (assignmentRes.data ?? []) as AssignmentRow[];
    if (rows.length) {
      const classIds = Array.from(new Set(rows.map((row) => row.class_id)));
      const subjectIds = Array.from(new Set(rows.map((row) => row.subject_id)));
      const [classesRes, subjectsRes] = await Promise.all([
        db.from("classes").select("id,name,stream").in("id", classIds),
        db.from("subjects").select("id,name").in("id", subjectIds),
      ]);
      const classMap = new Map<string, string>((classesRes.data ?? []).map((row: { id: string; name: string; stream: string | null }) => [row.id, `${row.name}${row.stream ? ` · ${row.stream}` : ""}`]));
      const subjectMap = new Map<string, string>((subjectsRes.data ?? []).map((row: { id: string; name: string }) => [row.id, row.name]));
      setAssignments(rows.map((row) => ({ className: classMap.get(row.class_id) ?? "Assigned class", subjectName: subjectMap.get(row.subject_id) ?? "Assigned subject" })));
    }

    if (teacherRes.error || assignmentRes.error) {
      setNotice({ kind: "error", text: "Some professional information could not be loaded. Your personal profile is still available." });
    }
    setLoading(false);
  }

  const displayName = profile.full_name.trim() || [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Teacher";
  const completion = useMemo(() => {
    const checks = [profile.first_name, profile.last_name, profile.phone, profile.avatar_url, teacher.tsc_number, teacher.job_title, teacher.department, teacher.bio, teacher.teaching_philosophy, qualifications.length ? "yes" : ""];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile, teacher, qualifications]);

  async function save() {
    if (!profile.id) return;
    setSaving(true);
    setNotice(null);
    const fullName = [profile.first_name.trim(), profile.last_name.trim()].filter(Boolean).join(" ") || profile.full_name.trim() || "Teacher";

    const profileRes = await db.from("profiles").update({
      first_name: profile.first_name.trim() || null,
      last_name: profile.last_name.trim() || null,
      full_name: fullName,
      phone: profile.phone.trim() || null,
      date_of_birth: profile.date_of_birth || null,
      gender: profile.gender || null,
      county: profile.county.trim() || null,
      sub_county: profile.sub_county.trim() || null,
      address: profile.address.trim() || null,
      emergency_contact_name: profile.emergency_contact_name.trim() || null,
      emergency_contact_phone: profile.emergency_contact_phone.trim() || null,
      emergency_contact_relation: profile.emergency_contact_relation.trim() || null,
    }).eq("id", profile.id);

    if (profileRes.error) {
      setSaving(false);
      setNotice({ kind: "error", text: "Your profile could not be saved. No school-controlled records were changed." });
      return;
    }

    const teacherRes = await db.from("teacher_profiles").upsert({
      profile_id: profile.id,
      tsc_number: teacher.tsc_number.trim() || null,
      employment_type: teacher.employment_type || null,
      job_title: teacher.job_title.trim() || null,
      department: teacher.department.trim() || null,
      date_joined: teacher.date_joined || null,
      bio: teacher.bio.trim() || null,
      teaching_philosophy: teacher.teaching_philosophy.trim() || null,
      teaching_style: teacher.teaching_style.trim() || null,
      classroom_management: teacher.classroom_management.trim() || null,
      learning_support: teacher.learning_support.trim() || null,
      assessment_approach: teacher.assessment_approach.trim() || null,
      qualifications: qualifications as unknown as Json,
      professional_development: development as unknown as Json,
      updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });

    setSaving(false);
    if (teacherRes.error) {
      setNotice({ kind: "error", text: "Personal details were saved, but professional details could not be updated." });
      return;
    }
    setProfile((current) => ({ ...current, full_name: fullName }));
    setNotice({ kind: "success", text: "Profile saved. School and teaching assignments remain managed by your school." });
  }

  async function uploadAvatar(file: File) {
    if (!profile.id) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNotice({ kind: "error", text: "Use a JPEG, PNG or WebP image." });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setNotice({ kind: "error", text: "Profile photo must be 3 MB or smaller." });
      return;
    }
    setUploading(true);
    setNotice(null);
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const objectPath = `${profile.id}/profile.${extension}`;
    const uploadRes = await supabase.storage.from("avatars").upload(objectPath, file, { upsert: true, cacheControl: "3600", contentType: file.type });
    if (uploadRes.error) {
      setUploading(false);
      setNotice({ kind: "error", text: "Profile photo upload failed. Please try again." });
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(objectPath);
    const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
    const updateRes = await db.from("profiles").update({ avatar_url: avatarUrl }).eq("id", profile.id);
    setUploading(false);
    if (updateRes.error) {
      setNotice({ kind: "error", text: "The image uploaded, but your profile photo reference could not be saved." });
      return;
    }
    setProfile((current) => ({ ...current, avatar_url: avatarUrl }));
    setNotice({ kind: "success", text: "Profile photo updated." });
  }

  if (loading) return <main className="tp-shell"><div className="tp-loading"><Loader2 className="tp-spin" size={22} /> Loading your professional profile…</div><Styles /></main>;

  return (
    <main className="tp-shell">
      <div className="tp-wrap">
        <header className="tp-header">
          <div><p className="tp-eyebrow">Teacher profile</p><h1>Your professional identity</h1><p>Keep your professional record clear and current. School membership and teaching assignments remain authoritative school records.</p></div>
          <SaveButton saving={saving} onClick={() => void save()} />
        </header>

        {notice && <div className={`tp-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"} aria-live="polite">{notice.kind === "error" ? <AlertCircle size={18} /> : <Check size={18} />}<span>{notice.text}</span></div>}

        <section className="tp-identity">
          <button className="tp-avatar" onClick={() => fileInput.current?.click()} disabled={uploading} aria-label="Change profile photo">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{displayName.charAt(0).toUpperCase()}</span>}
            <i>{uploading ? <Loader2 className="tp-spin" size={14} /> : <Camera size={14} />}</i>
          </button>
          <input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); event.currentTarget.value = ""; }} />
          <div className="tp-identity-body">
            <div className="tp-name-row"><div><h2>{displayName}</h2><p>{teacher.job_title || "Teacher"}{teacher.department ? ` · ${teacher.department}` : ""}</p></div><span className="tp-verified"><ShieldCheck size={14} /> Teacher account</span></div>
            <div className="tp-meta"><span><School size={15} /> {schoolName}</span><span><Mail size={15} /> {profile.email || "Email unavailable"}</span>{teacher.tsc_number && <span><BriefcaseBusiness size={15} /> TSC {teacher.tsc_number}</span>}</div>
            <div className="tp-completion"><div><strong>{completion}% complete</strong><small>A complete profile strengthens professional context across Teacher OS.</small></div><div className="tp-track"><span style={{ width: `${completion}%` }} /></div></div>
          </div>
        </section>

        <nav className="tp-tabs" aria-label="Teacher profile sections">
          {TABS.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}
        </nav>

        {tab === "overview" && <Overview profile={profile} teacher={teacher} schoolName={schoolName} assignments={assignments} qualifications={qualifications.length} development={development.length} setTab={setTab} />}
        {tab === "personal" && <PersonalForm profile={profile} setProfile={setProfile} />}
        {tab === "professional" && <ProfessionalForm teacher={teacher} setTeacher={setTeacher} />}
        {tab === "credentials" && <Credentials qualifications={qualifications} setQualifications={setQualifications} development={development} setDevelopment={setDevelopment} />}
        {tab === "preferences" && <Preferences teacher={teacher} setTeacher={setTeacher} />}

        {tab !== "overview" && <div className="tp-sticky"><div><strong>Save profile changes</strong><small>Only teacher-owned profile fields are updated here.</small></div><SaveButton saving={saving} onClick={() => void save()} /></div>}
      </div>
      <Styles />
    </main>
  );
}

function Overview({ profile, teacher, schoolName, assignments, qualifications, development, setTab }: { profile: ProfileRecord; teacher: TeacherRecord; schoolName: string; assignments: Assignment[]; qualifications: number; development: number; setTab: (tab: Tab) => void }) {
  return <div className="tp-grid">
    <section className="tp-panel tp-span"><Heading title="Professional snapshot" subtitle="The essential identity and school context behind your Teacher OS account." /><div className="tp-snapshot">
      <Info icon={BriefcaseBusiness} label="Role" value={teacher.job_title || "Not added"} /><Info icon={School} label="School" value={schoolName} /><Info icon={GraduationCap} label="TSC number" value={teacher.tsc_number || "Not added"} /><Info icon={BookOpen} label="Department" value={teacher.department || "Not added"} /><Info icon={Phone} label="Phone" value={profile.phone || "Not added"} /><Info icon={MapPin} label="County" value={profile.county || "Not added"} />
    </div></section>
    <section className="tp-panel tp-span"><Heading title="Teaching assignments" subtitle="Class and subject assignments are displayed here as authoritative school records." /><div className="tp-managed"><LockKeyhole size={18} /><div><strong>Managed by your school</strong><span>Ask a school administrator to correct a class, subject or school assignment.</span></div></div>
      {assignments.length ? <div className="tp-assignments">{assignments.map((item, index) => <div className="tp-assignment" key={`${item.className}-${item.subjectName}-${index}`}><BookOpen size={18} /><div><strong>{item.subjectName}</strong><span>{item.className}</span></div></div>)}</div> : <Empty icon={School} title="No teaching assignment found" text="Your school administrator can assign your classes and subjects." />}
    </section>
    <section className="tp-panel"><Heading title="About" subtitle="A concise professional introduction." /><p className="tp-bio">{teacher.bio || "Add a short professional bio so your profile has useful context."}</p><button className="tp-link" onClick={() => setTab("professional")}>Edit professional details <ChevronRight size={15} /></button></section>
    <section className="tp-panel"><Heading title="Credentials" subtitle="Qualifications and professional learning." /><div className="tp-metric"><span>Qualifications</span><strong>{qualifications}</strong></div><div className="tp-metric"><span>Professional development</span><strong>{development}</strong></div><button className="tp-link" onClick={() => setTab("credentials")}>Manage credentials <ChevronRight size={15} /></button></section>
  </div>;
}

function PersonalForm({ profile, setProfile }: { profile: ProfileRecord; setProfile: (value: ProfileRecord) => void }) {
  return <section className="tp-panel tp-form-panel"><Heading title="Personal & contact details" subtitle="Keep your own contact details current. Login email remains managed by account security." /><div className="tp-form-grid">
    <Field label="First name"><input value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} /></Field>
    <Field label="Last name"><input value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} /></Field>
    <Field label="Login email" hint="Managed by account security"><input value={profile.email} disabled /></Field>
    <Field label="Phone"><input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
    <Field label="Date of birth"><input type="date" value={profile.date_of_birth} onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })} /></Field>
    <Field label="Gender"><select value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value })}><option value="">Prefer not to specify</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
    <Field label="County"><input value={profile.county} onChange={(e) => setProfile({ ...profile, county: e.target.value })} /></Field>
    <Field label="Sub-county"><input value={profile.sub_county} onChange={(e) => setProfile({ ...profile, sub_county: e.target.value })} /></Field>
    <Field label="Address" className="tp-span"><textarea rows={3} value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} /></Field>
  </div><div className="tp-subhead"><h3>Emergency contact</h3><p>Kept as part of your school-facing profile record.</p></div><div className="tp-form-grid">
    <Field label="Contact name"><input value={profile.emergency_contact_name} onChange={(e) => setProfile({ ...profile, emergency_contact_name: e.target.value })} /></Field>
    <Field label="Relationship"><input value={profile.emergency_contact_relation} onChange={(e) => setProfile({ ...profile, emergency_contact_relation: e.target.value })} /></Field>
    <Field label="Contact phone"><input type="tel" value={profile.emergency_contact_phone} onChange={(e) => setProfile({ ...profile, emergency_contact_phone: e.target.value })} /></Field>
  </div></section>;
}

function ProfessionalForm({ teacher, setTeacher }: { teacher: TeacherRecord; setTeacher: (value: TeacherRecord) => void }) {
  return <section className="tp-panel tp-form-panel"><Heading title="Professional information" subtitle="Your own professional identity, separate from school-controlled assignments." /><div className="tp-form-grid">
    <Field label="TSC number"><input value={teacher.tsc_number} onChange={(e) => setTeacher({ ...teacher, tsc_number: e.target.value })} /></Field>
    <Field label="Job title / designation"><input value={teacher.job_title} onChange={(e) => setTeacher({ ...teacher, job_title: e.target.value })} placeholder="e.g. Mathematics Teacher" /></Field>
    <Field label="Department"><input value={teacher.department} onChange={(e) => setTeacher({ ...teacher, department: e.target.value })} /></Field>
    <Field label="Employment type"><select value={teacher.employment_type} onChange={(e) => setTeacher({ ...teacher, employment_type: e.target.value })}><option value="">Select type</option><option value="permanent">Permanent</option><option value="contract">Contract</option><option value="intern">Intern</option><option value="part_time">Part-time</option></select></Field>
    <Field label="Date joined"><input type="date" value={teacher.date_joined} onChange={(e) => setTeacher({ ...teacher, date_joined: e.target.value })} /></Field>
    <Field label="Professional bio" className="tp-span"><textarea rows={5} maxLength={600} value={teacher.bio} onChange={(e) => setTeacher({ ...teacher, bio: e.target.value })} placeholder="A concise summary of your teaching experience and focus." /><small className="tp-counter">{teacher.bio.length}/600</small></Field>
  </div></section>;
}

function Credentials({ qualifications, setQualifications, development, setDevelopment }: { qualifications: Qualification[]; setQualifications: (items: Qualification[]) => void; development: Development[]; setDevelopment: (items: Development[]) => void }) {
  return <div className="tp-grid"><EditList title="Qualifications" subtitle="Academic and professional qualifications." addLabel="Add qualification" items={qualifications} onAdd={() => setQualifications([...qualifications, { qualification: "", institution: "", year: "", specialization: "" }])} onRemove={(index) => setQualifications(qualifications.filter((_, i) => i !== index))} render={(item, index) => <div className="tp-form-grid"><Field label="Qualification"><input value={item.qualification} onChange={(e) => setQualifications(qualifications.map((x, i) => i === index ? { ...x, qualification: e.target.value } : x))} /></Field><Field label="Institution"><input value={item.institution} onChange={(e) => setQualifications(qualifications.map((x, i) => i === index ? { ...x, institution: e.target.value } : x))} /></Field><Field label="Year"><input value={item.year} inputMode="numeric" onChange={(e) => setQualifications(qualifications.map((x, i) => i === index ? { ...x, year: e.target.value } : x))} /></Field><Field label="Specialization"><input value={item.specialization} onChange={(e) => setQualifications(qualifications.map((x, i) => i === index ? { ...x, specialization: e.target.value } : x))} /></Field></div>} />
    <EditList title="Professional development" subtitle="Workshops, certification and structured teacher learning." addLabel="Add development" items={development} onAdd={() => setDevelopment([...development, { title: "", provider: "", year: "" }])} onRemove={(index) => setDevelopment(development.filter((_, i) => i !== index))} render={(item, index) => <div className="tp-form-grid"><Field label="Programme / course"><input value={item.title} onChange={(e) => setDevelopment(development.map((x, i) => i === index ? { ...x, title: e.target.value } : x))} /></Field><Field label="Provider"><input value={item.provider} onChange={(e) => setDevelopment(development.map((x, i) => i === index ? { ...x, provider: e.target.value } : x))} /></Field><Field label="Year"><input value={item.year} inputMode="numeric" onChange={(e) => setDevelopment(development.map((x, i) => i === index ? { ...x, year: e.target.value } : x))} /></Field></div>} />
  </div>;
}

function Preferences({ teacher, setTeacher }: { teacher: TeacherRecord; setTeacher: (value: TeacherRecord) => void }) {
  return <section className="tp-panel tp-form-panel"><Heading title="Teaching preferences" subtitle="Professional context for VibeSchool and the Teacher Twin—not school policy." /><div className="tp-stack">
    <Field label="Teaching philosophy" hint="What principles guide your teaching?"><textarea rows={4} value={teacher.teaching_philosophy} onChange={(e) => setTeacher({ ...teacher, teaching_philosophy: e.target.value })} /></Field>
    <Field label="Teaching style" hint="How do you usually explain, model and facilitate learning?"><textarea rows={4} value={teacher.teaching_style} onChange={(e) => setTeacher({ ...teacher, teaching_style: e.target.value })} /></Field>
    <Field label="Classroom management" hint="Preferred approaches for routines, participation and behaviour."><textarea rows={4} value={teacher.classroom_management} onChange={(e) => setTeacher({ ...teacher, classroom_management: e.target.value })} /></Field>
    <Field label="Learning support" hint="How you scaffold, remediate and extend learning."><textarea rows={4} value={teacher.learning_support} onChange={(e) => setTeacher({ ...teacher, learning_support: e.target.value })} /></Field>
    <Field label="Assessment approach" hint="Your preferred balance of formative checks, feedback and assessment."><textarea rows={4} value={teacher.assessment_approach} onChange={(e) => setTeacher({ ...teacher, assessment_approach: e.target.value })} /></Field>
  </div></section>;
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) { return <div className="tp-heading"><h2>{title}</h2><p>{subtitle}</p></div>; }
function Info({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) { return <div className="tp-info"><i><Icon size={17} /></i><div><span>{label}</span><strong>{value}</strong></div></div>; }
function Empty({ icon: Icon, title, text: copy }: { icon: typeof UserRound; title: string; text: string }) { return <div className="tp-empty"><Icon size={22} /><div><strong>{title}</strong><span>{copy}</span></div></div>; }
function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) { return <label className={`tp-field ${className}`}><span>{label}</span>{hint && <small>{hint}</small>}{children}</label>; }
function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) { return <button className="tp-primary" onClick={onClick} disabled={saving}>{saving ? <Loader2 className="tp-spin" size={16} /> : <Check size={16} />}{saving ? "Saving…" : "Save changes"}</button>; }

function EditList<T>({ title, subtitle, addLabel, items, onAdd, onRemove, render }: { title: string; subtitle: string; addLabel: string; items: T[]; onAdd: () => void; onRemove: (index: number) => void; render: (item: T, index: number) => React.ReactNode }) {
  return <section className="tp-panel tp-span"><div className="tp-list-head"><Heading title={title} subtitle={subtitle} /><button className="tp-secondary" onClick={onAdd}>+ {addLabel}</button></div>{items.length ? <div className="tp-list">{items.map((item, index) => <div className="tp-list-item" key={index}><i>{index + 1}</i><div>{render(item, index)}</div><button className="tp-remove" onClick={() => onRemove(index)}>Remove</button></div>)}</div> : <Empty icon={GraduationCap} title="No records added yet" text="Add a record when you are ready." />}</section>;
}

function Styles() {
  return <style jsx global>{`
    .tp-shell{min-height:100%;background:#f5f7fa;color:#17233c;padding:24px 16px 96px}.tp-wrap{max-width:1100px;margin:auto}.tp-header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:22px}.tp-eyebrow{margin:0 0 5px;color:#0a5bd3;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.tp-header h1{margin:0;font-size:30px;letter-spacing:-.03em;color:#0b1b36}.tp-header p:not(.tp-eyebrow){max-width:700px;margin:9px 0 0;color:#667085;font-size:14px;line-height:1.6}.tp-primary,.tp-secondary,.tp-link,.tp-remove{font:inherit;cursor:pointer}.tp-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:10px;background:#0a5bd3;color:white;font-size:13px;font-weight:700;padding:11px 16px}.tp-primary:disabled{opacity:.6;cursor:not-allowed}.tp-secondary{border:1px solid #d0d5dd;background:white;color:#344054;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:700;white-space:nowrap}.tp-notice{display:flex;gap:9px;align-items:flex-start;padding:11px 13px;border-radius:10px;margin-bottom:16px;font-size:13px}.tp-notice.success{background:#ecfdf3;border:1px solid #abefc6;color:#067647}.tp-notice.error{background:#fef3f2;border:1px solid #fecdca;color:#b42318}.tp-identity{display:flex;gap:20px;background:white;border:1px solid #e4e7ec;border-radius:16px;padding:22px;margin-bottom:16px}.tp-avatar{position:relative;width:90px;height:90px;flex:0 0 90px;border:0;background:#eaf2ff;color:#0a5bd3;border-radius:50%;padding:0;cursor:pointer}.tp-avatar>img,.tp-avatar>span{width:90px;height:90px;border-radius:50%;display:flex;align-items:center;justify-content:center;object-fit:cover;font-size:32px;font-weight:800;border:3px solid white;box-shadow:0 0 0 1px #d0d5dd}.tp-avatar>i{position:absolute;right:-1px;bottom:2px;width:29px;height:29px;border-radius:50%;background:#0b1b36;color:white;display:flex;align-items:center;justify-content:center;border:3px solid white}.tp-identity-body{flex:1;min-width:0}.tp-name-row{display:flex;justify-content:space-between;gap:14px}.tp-name-row h2{margin:0;font-size:23px;color:#0b1b36}.tp-name-row p{margin:4px 0 0;color:#667085;font-size:13px}.tp-verified{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:99px;background:#ecfdf3;color:#067647;font-size:11px;font-weight:700;height:max-content}.tp-meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:14px;color:#475467;font-size:12px}.tp-meta span{display:inline-flex;align-items:center;gap:6px}.tp-completion{display:grid;grid-template-columns:minmax(180px,300px) 1fr;gap:18px;align-items:center;margin-top:17px;padding-top:15px;border-top:1px solid #eaecf0}.tp-completion strong,.tp-completion small{display:block}.tp-completion strong{font-size:12px}.tp-completion small{font-size:11px;color:#98a2b3;margin-top:2px}.tp-track{height:7px;background:#eaecf0;border-radius:99px;overflow:hidden}.tp-track span{display:block;height:100%;background:#0a5bd3}.tp-tabs{display:flex;gap:5px;overflow:auto;padding:4px;background:#eef2f6;border-radius:12px;margin-bottom:16px}.tp-tabs button{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;color:#667085;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:650;white-space:nowrap;cursor:pointer}.tp-tabs button.active{background:white;color:#0a5bd3;box-shadow:0 1px 2px rgba(16,24,40,.08)}.tp-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.tp-span{grid-column:span 2}.tp-panel{background:white;border:1px solid #e4e7ec;border-radius:14px;padding:20px}.tp-heading{margin-bottom:18px}.tp-heading h2{margin:0;color:#0b1b36;font-size:16px}.tp-heading p{margin:5px 0 0;color:#667085;font-size:12px;line-height:1.5}.tp-snapshot{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.tp-info{display:flex;gap:10px;align-items:center;padding:12px;border:1px solid #eaecf0;border-radius:10px;background:#fcfcfd;min-width:0}.tp-info>i{width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:#eaf2ff;color:#0a5bd3;border-radius:8px}.tp-info span,.tp-info strong{display:block}.tp-info span{font-size:10px;color:#98a2b3;text-transform:uppercase;font-weight:700}.tp-info strong{margin-top:3px;font-size:12px;color:#344054;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tp-managed{display:flex;gap:10px;padding:12px;border:1px solid #eaecf0;border-radius:10px;background:#f9fafb;color:#475467;margin-bottom:14px}.tp-managed strong,.tp-managed span{display:block}.tp-managed strong{font-size:12px}.tp-managed span{font-size:11px;color:#667085;margin-top:2px}.tp-assignments{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.tp-assignment{display:flex;gap:10px;align-items:center;border:1px solid #eaecf0;border-radius:10px;padding:11px;color:#6941c6}.tp-assignment strong,.tp-assignment span{display:block}.tp-assignment strong{font-size:12px;color:#344054}.tp-assignment span{font-size:11px;color:#667085;margin-top:2px}.tp-empty{display:flex;align-items:center;justify-content:center;gap:12px;border:1px dashed #d0d5dd;border-radius:10px;padding:22px;color:#98a2b3;background:#fcfcfd}.tp-empty strong,.tp-empty span{display:block}.tp-empty strong{font-size:12px;color:#475467}.tp-empty span{font-size:11px;margin-top:3px}.tp-bio{color:#475467;font-size:13px;line-height:1.7;min-height:45px}.tp-link{display:inline-flex;align-items:center;gap:3px;border:0;background:transparent;color:#0a5bd3;padding:6px 0 0;font-size:12px;font-weight:700}.tp-metric{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f2f4f7;color:#667085;font-size:12px}.tp-metric strong{color:#344054}.tp-form-panel{padding:24px}.tp-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.tp-stack{display:grid;gap:16px}.tp-field{display:flex;flex-direction:column;gap:6px;min-width:0}.tp-field>span{font-size:12px;font-weight:700;color:#344054}.tp-field>small:not(.tp-counter){font-size:11px;color:#98a2b3;margin-top:-2px}.tp-field input,.tp-field select,.tp-field textarea{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:9px;background:white;color:#101828;padding:10px 11px;font:inherit;font-size:13px;outline:none}.tp-field input:focus,.tp-field select:focus,.tp-field textarea:focus{border-color:#84adff;box-shadow:0 0 0 3px #eef4ff}.tp-field input:disabled{background:#f9fafb;color:#667085}.tp-counter{align-self:flex-end;font-size:10px;color:#98a2b3}.tp-subhead{margin:26px 0 14px;padding-top:20px;border-top:1px solid #eaecf0}.tp-subhead h3{font-size:14px;margin:0}.tp-subhead p{font-size:11px;color:#667085;margin:4px 0 0}.tp-list-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.tp-list{display:grid;gap:12px}.tp-list-item{display:grid;grid-template-columns:28px 1fr auto;gap:12px;align-items:start;border:1px solid #eaecf0;border-radius:11px;padding:14px;background:#fcfcfd}.tp-list-item>i{width:28px;height:28px;border-radius:7px;background:#eaf2ff;color:#0a5bd3;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}.tp-remove{border:0;background:transparent;color:#b42318;font-size:11px;font-weight:700;padding:7px}.tp-sticky{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:16px;background:#0b1b36;color:white;border-radius:12px;padding:13px 15px}.tp-sticky strong,.tp-sticky small{display:block}.tp-sticky strong{font-size:12px}.tp-sticky small{font-size:10px;color:#b8c4d6;margin-top:2px}.tp-sticky .tp-primary{background:white;color:#0a5bd3}.tp-loading{min-height:420px;display:flex;align-items:center;justify-content:center;gap:10px;color:#667085;font-size:13px}.tp-spin{animation:tp-spin 1s linear infinite}@keyframes tp-spin{to{transform:rotate(360deg)}}
    @media(max-width:760px){.tp-shell{padding:18px 12px 86px}.tp-header{display:block}.tp-header h1{font-size:25px}.tp-header>.tp-primary{width:100%;margin-top:16px}.tp-identity{gap:12px;padding:16px}.tp-avatar,.tp-avatar>img,.tp-avatar>span{width:68px;height:68px}.tp-avatar{flex-basis:68px}.tp-name-row{display:block}.tp-verified{margin-top:8px}.tp-meta{display:grid;gap:7px}.tp-completion{grid-template-columns:1fr;gap:9px}.tp-grid,.tp-form-grid,.tp-snapshot,.tp-assignments{grid-template-columns:1fr}.tp-span{grid-column:span 1}.tp-panel,.tp-form-panel{padding:16px}.tp-list-item{grid-template-columns:28px 1fr}.tp-remove{grid-column:2;justify-self:start;padding:0}.tp-list-head{display:block}.tp-list-head .tp-secondary{margin:-8px 0 14px}.tp-sticky{position:sticky;bottom:10px}.tp-sticky>div{display:none}.tp-sticky .tp-primary{width:100%}}
    @media(prefers-reduced-motion:reduce){.tp-spin{animation:none}}
  `}</style>;
}

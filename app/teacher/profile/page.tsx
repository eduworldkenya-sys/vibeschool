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
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  county: string | null;
  sub_county: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  school_id: string | null;
  avatar_url: string | null;
};

type TeacherProfileRecord = {
  profile_id: string;
  tsc_number: string | null;
  employment_type: string | null;
  job_title: string | null;
  department: string | null;
  date_joined: string | null;
  bio: string | null;
  teaching_philosophy: string | null;
  teaching_style: string | null;
  classroom_management: string | null;
  learning_support: string | null;
  assessment_approach: string | null;
  qualifications: Json | null;
  professional_development: Json | null;
};

type AssignmentRow = {
  class_id: string;
  subject_id: string;
};

type Assignment = {
  className: string;
  subjectName: string;
};

type Qualification = {
  qualification: string;
  institution: string;
  year: string;
  specialization: string;
};

type ProfessionalDevelopment = {
  title: string;
  provider: string;
  year: string;
};

const TABS: Array<{ id: Tab; label: string; icon: typeof UserRound }> = [
  { id: "overview", label: "Overview", icon: UserRound },
  { id: "personal", label: "Personal", icon: Phone },
  { id: "professional", label: "Professional", icon: BriefcaseBusiness },
  { id: "credentials", label: "Credentials", icon: GraduationCap },
  { id: "preferences", label: "Teaching preferences", icon: BookOpen },
];

const emptyProfile: ProfileRecord = {
  id: "",
  email: "",
  full_name: "",
  first_name: "",
  last_name: "",
  phone: "",
  date_of_birth: "",
  gender: "",
  county: "",
  sub_county: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relation: "",
  school_id: null,
  avatar_url: "",
};

const emptyTeacher: TeacherProfileRecord = {
  profile_id: "",
  tsc_number: "",
  employment_type: "",
  job_title: "",
  department: "",
  date_joined: "",
  bio: "",
  teaching_philosophy: "",
  teaching_style: "",
  classroom_management: "",
  learning_support: "",
  assessment_approach: "",
  qualifications: [],
  professional_development: [],
};

function asText(value: string | null | undefined) {
  return value ?? "";
}

function qualificationList(value: Json | null): Qualification[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, Json | undefined> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      qualification: typeof item.qualification === "string" ? item.qualification : "",
      institution: typeof item.institution === "string" ? item.institution : "",
      year: typeof item.year === "string" ? item.year : typeof item.year === "number" ? String(item.year) : "",
      specialization: typeof item.specialization === "string" ? item.specialization : "",
    }));
}

function developmentList(value: Json | null): ProfessionalDevelopment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, Json | undefined> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      title: typeof item.title === "string" ? item.title : "",
      provider: typeof item.provider === "string" ? item.provider : "",
      year: typeof item.year === "string" ? item.year : typeof item.year === "number" ? String(item.year) : "",
    }));
}

export default function TeacherProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<ProfileRecord>(emptyProfile);
  const [teacher, setTeacher] = useState<TeacherProfileRecord>(emptyTeacher);
  const [schoolName, setSchoolName] = useState("Not assigned");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [development, setDevelopment] = useState<ProfessionalDevelopment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setNotice(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setNotice({ kind: "error", text: "Your session could not be verified. Please sign in again." });
      setLoading(false);
      return;
    }

    const userId = authData.user.id;
    const [{ data: profileData, error: profileError }, { data: teacherData, error: teacherError }, { data: assignmentData, error: assignmentError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,full_name,first_name,last_name,phone,date_of_birth,gender,county,sub_county,address,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,school_id,avatar_url")
          .eq("id", userId)
          .single(),
        supabase
          .from("teacher_profiles")
          .select("profile_id,tsc_number,employment_type,job_title,department,date_joined,bio,teaching_philosophy,teaching_style,classroom_management,learning_support,assessment_approach,qualifications,professional_development")
          .eq("profile_id", userId)
          .maybeSingle(),
        supabase
          .from("teacher_classes")
          .select("class_id,subject_id")
          .eq("teacher_id", userId),
      ]);

    if (profileError) {
      setNotice({ kind: "error", text: "We could not load your teacher profile. Please try again." });
      setLoading(false);
      return;
    }

    if (teacherError || assignmentError) {
      setNotice({ kind: "error", text: "Some professional information could not be loaded. Please refresh the page." });
    }

    const nextProfile: ProfileRecord = { ...emptyProfile, ...(profileData as ProfileRecord) };
    const nextTeacher: TeacherProfileRecord = { ...emptyTeacher, profile_id: userId, ...((teacherData ?? {}) as Partial<TeacherProfileRecord>) };

    setProfile(nextProfile);
    setTeacher(nextTeacher);
    setQualifications(qualificationList(nextTeacher.qualifications));
    setDevelopment(developmentList(nextTeacher.professional_development));

    if (nextProfile.school_id) {
      const { data: school } = await supabase.from("schools").select("name").eq("id", nextProfile.school_id).maybeSingle();
      setSchoolName(school?.name ?? "School assigned");
    }

    const rows = (assignmentData ?? []) as AssignmentRow[];
    if (rows.length) {
      const classIds = Array.from(new Set(rows.map((row) => row.class_id)));
      const subjectIds = Array.from(new Set(rows.map((row) => row.subject_id)));
      const [{ data: classes }, { data: subjects }] = await Promise.all([
        supabase.from("classes").select("id,name,stream").in("id", classIds),
        supabase.from("subjects").select("id,name").in("id", subjectIds),
      ]);
      const classMap = new Map((classes ?? []).map((row) => [row.id, `${row.name}${row.stream ? ` · ${row.stream}` : ""}`]));
      const subjectMap = new Map((subjects ?? []).map((row) => [row.id, row.name]));
      setAssignments(
        rows.map((row) => ({
          className: classMap.get(row.class_id) ?? "Assigned class",
          subjectName: subjectMap.get(row.subject_id) ?? "Assigned subject",
        }))
      );
    } else {
      setAssignments([]);
    }

    setLoading(false);
  }

  const completion = useMemo(() => {
    const checks = [
      profile.first_name,
      profile.last_name,
      profile.phone,
      profile.avatar_url,
      teacher.tsc_number,
      teacher.job_title,
      teacher.department,
      teacher.bio,
      teacher.teaching_philosophy,
      qualifications.length > 0 ? "yes" : "",
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile, teacher, qualifications]);

  const displayName =
    profile.full_name?.trim() ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
    "Teacher";

  async function saveProfile() {
    if (!profile.id) return;
    setSaving(true);
    setNotice(null);

    const fullName = [profile.first_name?.trim(), profile.last_name?.trim()].filter(Boolean).join(" ").trim() || profile.full_name?.trim() || "Teacher";

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        first_name: asText(profile.first_name).trim() || null,
        last_name: asText(profile.last_name).trim() || null,
        full_name: fullName,
        phone: asText(profile.phone).trim() || null,
        date_of_birth: profile.date_of_birth || null,
        gender: profile.gender || null,
        county: asText(profile.county).trim() || null,
        sub_county: asText(profile.sub_county).trim() || null,
        address: asText(profile.address).trim() || null,
        emergency_contact_name: asText(profile.emergency_contact_name).trim() || null,
        emergency_contact_phone: asText(profile.emergency_contact_phone).trim() || null,
        emergency_contact_relation: asText(profile.emergency_contact_relation).trim() || null,
      })
      .eq("id", profile.id);

    if (profileError) {
      setSaving(false);
      setNotice({ kind: "error", text: "Your personal details could not be saved. No school-controlled data was changed." });
      return;
    }

    const { error: teacherError } = await supabase.from("teacher_profiles").upsert({
      profile_id: profile.id,
      tsc_number: asText(teacher.tsc_number).trim() || null,
      employment_type: asText(teacher.employment_type).trim() || null,
      job_title: asText(teacher.job_title).trim() || null,
      department: asText(teacher.department).trim() || null,
      date_joined: teacher.date_joined || null,
      bio: asText(teacher.bio).trim() || null,
      teaching_philosophy: asText(teacher.teaching_philosophy).trim() || null,
      teaching_style: asText(teacher.teaching_style).trim() || null,
      classroom_management: asText(teacher.classroom_management).trim() || null,
      learning_support: asText(teacher.learning_support).trim() || null,
      assessment_approach: asText(teacher.assessment_approach).trim() || null,
      qualifications: qualifications as unknown as Json,
      professional_development: development as unknown as Json,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (teacherError) {
      setNotice({ kind: "error", text: "Personal details were saved, but professional details could not be updated." });
      return;
    }

    setProfile((current) => ({ ...current, full_name: fullName }));
    setNotice({ kind: "success", text: "Profile saved. Your school and teaching assignments remain managed by your school." });
  }

  async function uploadAvatar(file: File) {
    if (!profile.id) return;
    const accepted = ["image/jpeg", "image/png", "image/webp"];
    if (!accepted.includes(file.type)) {
      setNotice({ kind: "error", text: "Use a JPEG, PNG, or WebP image." });
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

    const { error: uploadError } = await supabase.storage.from("avatars").upload(objectPath, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type,
    });

    if (uploadError) {
      setUploading(false);
      setNotice({ kind: "error", text: "Profile photo upload failed. Please try again." });
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(objectPath);
    const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", profile.id);

    setUploading(false);
    if (updateError) {
      setNotice({ kind: "error", text: "The photo uploaded, but your profile could not be updated with it." });
      return;
    }

    setProfile((current) => ({ ...current, avatar_url: avatarUrl }));
    setNotice({ kind: "success", text: "Profile photo updated." });
  }

  if (loading) {
    return (
      <main className="profile-shell">
        <div className="profile-loading" aria-live="polite">
          <Loader2 size={22} className="spin" />
          <span>Loading your professional profile…</span>
        </div>
        <Styles />
      </main>
    );
  }

  return (
    <main className="profile-shell">
      <div className="profile-wrap">
        <header className="profile-header">
          <div>
            <p className="eyebrow">Teacher profile</p>
            <h1>Your professional identity</h1>
            <p className="header-copy">
              Keep your personal, professional and teaching information accurate. School membership and class assignments are authoritative school records.
            </p>
          </div>
          <button className="primary-button" onClick={() => void saveProfile()} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </header>

        {notice && (
          <div className={`notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"} aria-live="polite">
            {notice.kind === "error" ? <AlertCircle size={18} /> : <Check size={18} />}
            <span>{notice.text}</span>
          </div>
        )}

        <section className="identity-card">
          <button className="avatar-button" onClick={() => fileInput.current?.click()} aria-label="Change profile photo" disabled={uploading}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : (
              <span>{displayName.slice(0, 1).toUpperCase()}</span>
            )}
            <span className="camera-badge">{uploading ? <Loader2 size={14} className="spin" /> : <Camera size={14} />}</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadAvatar(file);
              event.currentTarget.value = "";
            }}
          />
          <div className="identity-main">
            <div className="identity-heading">
              <div>
                <h2>{displayName}</h2>
                <p>{teacher.job_title || "Teacher"}{teacher.department ? ` · ${teacher.department}` : ""}</p>
              </div>
              <span className="verified-chip"><ShieldCheck size={14} /> Teacher account</span>
            </div>
            <div className="identity-meta">
              <span><School size={15} /> {schoolName}</span>
              <span><Mail size={15} /> {profile.email || "Email unavailable"}</span>
              {teacher.tsc_number && <span><BriefcaseBusiness size={15} /> TSC {teacher.tsc_number}</span>}
            </div>
            <div className="completion-row">
              <div>
                <strong>{completion}% complete</strong>
                <span>Complete profiles make school administration and professional records easier to trust.</span>
              </div>
              <div className="progress-track" aria-label={`Profile ${completion}% complete`}>
                <span style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>
        </section>

        <nav className="tabs" aria-label="Teacher profile sections">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === "overview" && (
          <div className="content-grid">
            <section className="panel span-2">
              <PanelHeading title="Professional snapshot" subtitle="A concise view of the identity your school and VibeSchool use." />
              <div className="snapshot-grid">
                <InfoItem icon={BriefcaseBusiness} label="Role" value={teacher.job_title || "Not added"} />
                <InfoItem icon={School} label="School" value={schoolName} />
                <InfoItem icon={GraduationCap} label="TSC number" value={teacher.tsc_number || "Not added"} />
                <InfoItem icon={BookOpen} label="Department" value={teacher.department || "Not added"} />
                <InfoItem icon={Phone} label="Phone" value={profile.phone || "Not added"} />
                <InfoItem icon={MapPin} label="County" value={profile.county || "Not added"} />
              </div>
            </section>

            <section className="panel span-2">
              <PanelHeading
                title="Teaching assignments"
                subtitle="These are school-controlled records. Teachers can view them here but cannot rewrite school assignments from their profile."
              />
              <div className="managed-banner">
                <LockKeyhole size={18} />
                <div><strong>Managed by your school</strong><span>Ask a school administrator to correct a class, subject or school assignment.</span></div>
              </div>
              {assignments.length ? (
                <div className="assignment-grid">
                  {assignments.map((assignment, index) => (
                    <div className="assignment-card" key={`${assignment.className}-${assignment.subjectName}-${index}`}>
                      <div className="assignment-icon"><BookOpen size={18} /></div>
                      <div><strong>{assignment.subjectName}</strong><span>{assignment.className}</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <School size={22} />
                  <div><strong>No teaching assignment found</strong><span>Your school administrator can assign your classes and subjects.</span></div>
                </div>
              )}
            </section>

            <section className="panel">
              <PanelHeading title="About" subtitle="A professional introduction." />
              <p className="bio-copy">{teacher.bio || "Add a short professional bio so your profile has useful context."}</p>
              <button className="text-button" onClick={() => setActiveTab("professional")}>Edit professional details <ChevronRight size={15} /></button>
            </section>

            <section className="panel">
              <PanelHeading title="Credentials" subtitle="Qualifications and recent professional learning." />
              <div className="metric-row"><span>Qualifications</span><strong>{qualifications.length}</strong></div>
              <div className="metric-row"><span>Professional development</span><strong>{development.length}</strong></div>
              <button className="text-button" onClick={() => setActiveTab("credentials")}>Manage credentials <ChevronRight size={15} /></button>
            </section>
          </div>
        )}

        {activeTab === "personal" && (
          <section className="panel form-panel">
            <PanelHeading title="Personal & contact details" subtitle="Information you can keep current yourself. Your login email is shown but managed through account security." />
            <div className="form-grid">
              <Field label="First name"><input value={asText(profile.first_name)} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} /></Field>
              <Field label="Last name"><input value={asText(profile.last_name)} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} /></Field>
              <Field label="Login email" hint="Managed by account security"><input value={asText(profile.email)} disabled /></Field>
              <Field label="Phone"><input type="tel" value={asText(profile.phone)} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
              <Field label="Date of birth"><input type="date" value={asText(profile.date_of_birth)} onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })} /></Field>
              <Field label="Gender"><select value={asText(profile.gender)} onChange={(e) => setProfile({ ...profile, gender: e.target.value })}><option value="">Prefer not to specify</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
              <Field label="County"><input value={asText(profile.county)} onChange={(e) => setProfile({ ...profile, county: e.target.value })} /></Field>
              <Field label="Sub-county"><input value={asText(profile.sub_county)} onChange={(e) => setProfile({ ...profile, sub_county: e.target.value })} /></Field>
              <Field label="Address" className="span-2"><textarea rows={3} value={asText(profile.address)} onChange={(e) => setProfile({ ...profile, address: e.target.value })} /></Field>
            </div>
            <div className="subsection-heading"><h3>Emergency contact</h3><p>Used only when your school needs an emergency contact record.</p></div>
            <div className="form-grid">
              <Field label="Contact name"><input value={asText(profile.emergency_contact_name)} onChange={(e) => setProfile({ ...profile, emergency_contact_name: e.target.value })} /></Field>
              <Field label="Relationship"><input value={asText(profile.emergency_contact_relation)} onChange={(e) => setProfile({ ...profile, emergency_contact_relation: e.target.value })} /></Field>
              <Field label="Contact phone"><input type="tel" value={asText(profile.emergency_contact_phone)} onChange={(e) => setProfile({ ...profile, emergency_contact_phone: e.target.value })} /></Field>
            </div>
          </section>
        )}

        {activeTab === "professional" && (
          <section className="panel form-panel">
            <PanelHeading title="Professional information" subtitle="Maintain your own professional identity. School assignment remains controlled by your administrator." />
            <div className="form-grid">
              <Field label="TSC number"><input value={asText(teacher.tsc_number)} onChange={(e) => setTeacher({ ...teacher, tsc_number: e.target.value })} /></Field>
              <Field label="Job title / designation"><input value={asText(teacher.job_title)} onChange={(e) => setTeacher({ ...teacher, job_title: e.target.value })} placeholder="e.g. Mathematics Teacher" /></Field>
              <Field label="Department"><input value={asText(teacher.department)} onChange={(e) => setTeacher({ ...teacher, department: e.target.value })} /></Field>
              <Field label="Employment type"><select value={asText(teacher.employment_type)} onChange={(e) => setTeacher({ ...teacher, employment_type: e.target.value })}><option value="">Select type</option><option value="permanent">Permanent</option><option value="contract">Contract</option><option value="intern">Intern</option><option value="part_time">Part-time</option></select></Field>
              <Field label="Date joined"><input type="date" value={asText(teacher.date_joined)} onChange={(e) => setTeacher({ ...teacher, date_joined: e.target.value })} /></Field>
              <Field label="Professional bio" className="span-2"><textarea rows={5} maxLength={600} value={asText(teacher.bio)} onChange={(e) => setTeacher({ ...teacher, bio: e.target.value })} placeholder="A concise summary of your teaching experience and focus." /><span className="counter">{asText(teacher.bio).length}/600</span></Field>
            </div>
          </section>
        )}

        {activeTab === "credentials" && (
          <div className="content-grid">
            <EditableList
              title="Qualifications"
              subtitle="Record your core academic and professional qualifications."
              items={qualifications}
              addLabel="Add qualification"
              onAdd={() => setQualifications([...qualifications, { qualification: "", institution: "", year: "", specialization: "" }])}
              onRemove={(index) => setQualifications(qualifications.filter((_, i) => i !== index))}
              renderItem={(item, index) => (
                <div className="form-grid compact">
                  <Field label="Qualification"><input value={item.qualification} onChange={(e) => updateQualification(index, "qualification", e.target.value)} /></Field>
                  <Field label="Institution"><input value={item.institution} onChange={(e) => updateQualification(index, "institution", e.target.value)} /></Field>
                  <Field label="Year"><input inputMode="numeric" value={item.year} onChange={(e) => updateQualification(index, "year", e.target.value)} /></Field>
                  <Field label="Specialization"><input value={item.specialization} onChange={(e) => updateQualification(index, "specialization", e.target.value)} /></Field>
                </div>
              )}
            />
            <EditableList
              title="Professional development"
              subtitle="Track workshops, certifications and structured teacher development."
              items={development}
              addLabel="Add development"
              onAdd={() => setDevelopment([...development, { title: "", provider: "", year: "" }])}
              onRemove={(index) => setDevelopment(development.filter((_, i) => i !== index))}
              renderItem={(item, index) => (
                <div className="form-grid compact">
                  <Field label="Programme / course"><input value={item.title} onChange={(e) => updateDevelopment(index, "title", e.target.value)} /></Field>
                  <Field label="Provider"><input value={item.provider} onChange={(e) => updateDevelopment(index, "provider", e.target.value)} /></Field>
                  <Field label="Year"><input inputMode="numeric" value={item.year} onChange={(e) => updateDevelopment(index, "year", e.target.value)} /></Field>
                </div>
              )}
            />
          </div>
        )}

        {activeTab === "preferences" && (
          <section className="panel form-panel">
            <PanelHeading title="Teaching preferences" subtitle="Give VibeSchool useful professional context without pretending these preferences are school policy." />
            <div className="form-stack">
              <Field label="Teaching philosophy" hint="What principles guide your teaching?"><textarea rows={4} value={asText(teacher.teaching_philosophy)} onChange={(e) => setTeacher({ ...teacher, teaching_philosophy: e.target.value })} /></Field>
              <Field label="Teaching style" hint="How do you usually explain, model and facilitate learning?"><textarea rows={4} value={asText(teacher.teaching_style)} onChange={(e) => setTeacher({ ...teacher, teaching_style: e.target.value })} /></Field>
              <Field label="Classroom management" hint="Approaches you prefer for routines, behaviour and participation."><textarea rows={4} value={asText(teacher.classroom_management)} onChange={(e) => setTeacher({ ...teacher, classroom_management: e.target.value })} /></Field>
              <Field label="Learning support" hint="How you support learners who need more scaffolding or extension."><textarea rows={4} value={asText(teacher.learning_support)} onChange={(e) => setTeacher({ ...teacher, learning_support: e.target.value })} /></Field>
              <Field label="Assessment approach" hint="Your preferred balance of formative checks, feedback and assessment."><textarea rows={4} value={asText(teacher.assessment_approach)} onChange={(e) => setTeacher({ ...teacher, assessment_approach: e.target.value })} /></Field>
            </div>
          </section>
        )}

        {activeTab !== "overview" && (
          <div className="sticky-save">
            <div><strong>Save profile changes</strong><span>Only teacher-owned profile fields are updated here.</span></div>
            <button className="primary-button" onClick={() => void saveProfile()} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}{saving ? "Saving…" : "Save changes"}</button>
          </div>
        )}
      </div>
      <Styles />
    </main>
  );

  function updateQualification(index: number, key: keyof Qualification, value: string) {
    setQualifications((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function updateDevelopment(index: number, key: keyof ProfessionalDevelopment, value: string) {
    setDevelopment((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }
}

function PanelHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="panel-heading"><h2>{title}</h2><p>{subtitle}</p></div>;
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return <div className="info-item"><div className="info-icon"><Icon size={17} /></div><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span>{hint && <span className="field-hint">{hint}</span>}{children}</label>;
}

function EditableList<T>({
  title,
  subtitle,
  items,
  addLabel,
  onAdd,
  onRemove,
  renderItem,
}: {
  title: string;
  subtitle: string;
  items: T[];
  addLabel: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <section className="panel span-2">
      <div className="list-heading"><PanelHeading title={title} subtitle={subtitle} /><button className="secondary-button" onClick={onAdd}>+ {addLabel}</button></div>
      {!items.length ? (
        <div className="empty-state"><GraduationCap size={22} /><div><strong>No records added yet</strong><span>Add a record when you are ready.</span></div></div>
      ) : (
        <div className="editable-list">
          {items.map((item, index) => (
            <div className="editable-item" key={index}>
              <div className="editable-number">{index + 1}</div>
              <div className="editable-body">{renderItem(item, index)}</div>
              <button className="remove-button" onClick={() => onRemove(index)} aria-label={`Remove ${title.toLowerCase()} record ${index + 1}`}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      .profile-shell{min-height:100%;background:#f5f7fa;color:#17233c;padding:24px 16px 96px}
      .profile-wrap{max-width:1100px;margin:0 auto}
      .profile-header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:22px}
      .eyebrow{margin:0 0 5px;color:#0a5bd3;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .profile-header h1{margin:0;font-size:30px;line-height:1.15;color:#0b1b36;letter-spacing:-.03em}
      .header-copy{max-width:700px;margin:9px 0 0;color:#667085;font-size:14px;line-height:1.6}
      .primary-button,.secondary-button,.text-button,.remove-button{font:inherit;cursor:pointer}
      .primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:10px;background:#0a5bd3;color:white;font-weight:700;font-size:13px;padding:11px 16px;box-shadow:0 1px 2px rgba(16,24,40,.08)}
      .primary-button:disabled{opacity:.6;cursor:not-allowed}
      .secondary-button{border:1px solid #d0d5dd;background:white;color:#344054;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:700;white-space:nowrap}
      .notice{display:flex;align-items:flex-start;gap:9px;border-radius:10px;padding:11px 13px;margin-bottom:16px;font-size:13px}
      .notice.success{background:#ecfdf3;border:1px solid #abefc6;color:#067647}.notice.error{background:#fef3f2;border:1px solid #fecdca;color:#b42318}
      .identity-card{display:flex;gap:20px;background:white;border:1px solid #e4e7ec;border-radius:16px;padding:22px;margin-bottom:16px;box-shadow:0 1px 2px rgba(16,24,40,.03)}
      .avatar-button{position:relative;width:90px;height:90px;flex:0 0 90px;padding:0;border:0;border-radius:50%;background:#eaf2ff;color:#0a5bd3;overflow:visible;cursor:pointer}
      .avatar-button>img,.avatar-button>span:first-child{width:90px;height:90px;border-radius:50%;display:flex;align-items:center;justify-content:center;object-fit:cover;font-size:32px;font-weight:800;border:3px solid white;box-shadow:0 0 0 1px #d0d5dd}
      .camera-badge{position:absolute;right:-1px;bottom:2px;width:29px!important;height:29px!important;border-radius:50%!important;background:#0b1b36!important;color:white!important;display:flex!important;align-items:center;justify-content:center;border:3px solid white!important;box-shadow:none!important}
      .identity-main{flex:1;min-width:0}.identity-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      .identity-heading h2{margin:0;font-size:23px;color:#0b1b36}.identity-heading p{margin:4px 0 0;color:#667085;font-size:13px}
      .verified-chip{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:99px;background:#ecfdf3;color:#067647;font-size:11px;font-weight:700;white-space:nowrap}
      .identity-meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:14px;color:#475467;font-size:12px}.identity-meta span{display:inline-flex;align-items:center;gap:6px}
      .completion-row{display:grid;grid-template-columns:minmax(180px,300px) 1fr;gap:18px;align-items:center;margin-top:17px;padding-top:15px;border-top:1px solid #eaecf0}
      .completion-row strong,.completion-row span{display:block}.completion-row strong{font-size:12px;color:#344054}.completion-row div>span{font-size:11px;color:#98a2b3;margin-top:2px;line-height:1.4}
      .progress-track{height:7px;background:#eaecf0;border-radius:99px;overflow:hidden}.progress-track span{height:100%;background:#0a5bd3;border-radius:99px}
      .tabs{display:flex;gap:5px;overflow:auto;padding:4px;background:#eef2f6;border-radius:12px;margin-bottom:16px}
      .tabs button{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;color:#667085;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:650;white-space:nowrap;cursor:pointer}
      .tabs button.active{background:white;color:#0a5bd3;box-shadow:0 1px 2px rgba(16,24,40,.08)}
      .content-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.span-2{grid-column:span 2}
      .panel{background:white;border:1px solid #e4e7ec;border-radius:14px;padding:20px;box-shadow:0 1px 2px rgba(16,24,40,.025)}
      .panel-heading{margin-bottom:18px}.panel-heading h2{margin:0;color:#0b1b36;font-size:16px}.panel-heading p{margin:5px 0 0;color:#667085;font-size:12px;line-height:1.5}
      .snapshot-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
      .info-item{display:flex;gap:10px;align-items:center;padding:12px;border:1px solid #eaecf0;border-radius:10px;background:#fcfcfd;min-width:0}
      .info-icon{width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:#eaf2ff;color:#0a5bd3;border-radius:8px;flex:0 0 34px}
      .info-item span,.info-item strong{display:block}.info-item span{color:#98a2b3;font-size:10px;text-transform:uppercase;letter-spacing:.04em;font-weight:700}.info-item strong{margin-top:3px;color:#344054;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .managed-banner{display:flex;gap:10px;background:#f9fafb;border:1px solid #eaecf0;border-radius:10px;padding:12px;color:#475467;margin-bottom:14px}
      .managed-banner strong,.managed-banner span{display:block}.managed-banner strong{font-size:12px}.managed-banner span{font-size:11px;color:#667085;margin-top:2px;line-height:1.4}
      .assignment-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.assignment-card{display:flex;gap:10px;align-items:center;border:1px solid #eaecf0;border-radius:10px;padding:11px}
      .assignment-icon{width:34px;height:34px;background:#f4f0ff;color:#6941c6;border-radius:8px;display:flex;align-items:center;justify-content:center}
      .assignment-card strong,.assignment-card span{display:block}.assignment-card strong{font-size:12px;color:#344054}.assignment-card span{font-size:11px;color:#667085;margin-top:2px}
      .empty-state{display:flex;align-items:center;justify-content:center;gap:12px;border:1px dashed #d0d5dd;border-radius:10px;padding:22px;color:#98a2b3;background:#fcfcfd}
      .empty-state strong,.empty-state span{display:block}.empty-state strong{font-size:12px;color:#475467}.empty-state span{font-size:11px;margin-top:3px}
      .bio-copy{color:#475467;font-size:13px;line-height:1.7;min-height:45px}.text-button{display:inline-flex;align-items:center;gap:3px;border:0;background:transparent;color:#0a5bd3;padding:6px 0 0;font-size:12px;font-weight:700}
      .metric-row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f2f4f7;color:#667085;font-size:12px}.metric-row strong{color:#344054}
      .form-panel{padding:24px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.form-grid.compact{gap:12px}.form-stack{display:grid;gap:16px}
      .field{display:flex;flex-direction:column;gap:6px;min-width:0}.field-label{font-size:12px;font-weight:700;color:#344054}.field-hint{font-size:11px;color:#98a2b3;margin-top:-2px}
      .field input,.field select,.field textarea{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:9px;background:white;color:#101828;padding:10px 11px;font:inherit;font-size:13px;outline:none;transition:border-color .15s,box-shadow .15s}
      .field textarea{resize:vertical;line-height:1.5}.field input:focus,.field select:focus,.field textarea:focus{border-color:#84adff;box-shadow:0 0 0 3px #eef4ff}.field input:disabled{background:#f9fafb;color:#667085}
      .counter{font-size:10px;color:#98a2b3;align-self:flex-end}.subsection-heading{margin:26px 0 14px;padding-top:20px;border-top:1px solid #eaecf0}.subsection-heading h3{font-size:14px;margin:0;color:#344054}.subsection-heading p{font-size:11px;color:#667085;margin:4px 0 0}
      .list-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.editable-list{display:grid;gap:12px}.editable-item{display:grid;grid-template-columns:28px 1fr auto;gap:12px;align-items:start;border:1px solid #eaecf0;border-radius:11px;padding:14px;background:#fcfcfd}
      .editable-number{width:28px;height:28px;border-radius:7px;background:#eaf2ff;color:#0a5bd3;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}.editable-body{min-width:0}
      .remove-button{border:0;background:transparent;color:#b42318;font-size:11px;font-weight:700;padding:7px}.sticky-save{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:16px;background:#0b1b36;color:white;border-radius:12px;padding:13px 15px;box-shadow:0 8px 24px rgba(16,24,40,.12)}
      .sticky-save strong,.sticky-save span{display:block}.sticky-save strong{font-size:12px}.sticky-save span{font-size:10px;color:#b8c4d6;margin-top:2px}.sticky-save .primary-button{background:white;color:#0a5bd3}
      .profile-loading{min-height:420px;display:flex;align-items:center;justify-content:center;gap:10px;color:#667085;font-size:13px}.spin{animation:profile-spin 1s linear infinite}@keyframes profile-spin{to{transform:rotate(360deg)}}
      @media(max-width:760px){.profile-shell{padding:18px 12px 86px}.profile-header{display:block}.profile-header h1{font-size:25px}.profile-header>.primary-button{width:100%;margin-top:16px}.identity-card{align-items:flex-start;padding:16px}.avatar-button,.avatar-button>img,.avatar-button>span:first-child{width:68px;height:68px}.avatar-button{flex-basis:68px}.identity-heading{display:block}.verified-chip{margin-top:8px}.identity-meta{display:grid;gap:7px}.completion-row{grid-template-columns:1fr;gap:9px}.content-grid,.form-grid,.snapshot-grid,.assignment-grid{grid-template-columns:1fr}.span-2{grid-column:span 1}.panel{padding:16px}.form-panel{padding:18px}.editable-item{grid-template-columns:28px 1fr}.remove-button{grid-column:2;justify-self:start;padding:0}.list-heading{display:block}.list-heading .secondary-button{margin:-8px 0 14px}.sticky-save{position:sticky;bottom:10px}.sticky-save>div{display:none}}
      @media(max-width:480px){.identity-card{gap:12px}.identity-heading h2{font-size:19px}.tabs{margin-left:-2px;margin-right:-2px}.tabs button{padding:8px 10px}.sticky-save .primary-button{width:100%}}
      @media(prefers-reduced-motion:reduce){.spin{animation:none}}
    `}</style>
  );
}

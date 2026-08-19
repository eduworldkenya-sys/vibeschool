"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

type Staff = { id: string; full_name: string; role: string }
type Thread = { id: string; context_tag: string | null; last_message_at: string | null; last_message_preview: string | null }
type Message = { id: string; sender_id: string; body: string; created_at: string }

const C = { dark: "#1e1b4b", green: "#059669", border: "#e2e8f0", muted: "#64748b" }

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?"
}

function timeLabel(value: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleString("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
}

export default function ChildMessagesPage() {
  const params = useParams()
  const router = useRouter()
  const studentId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : ""
  const sendInFlight = useRef(false)

  const [userId, setUserId] = useState("")
  const [studentName, setStudentName] = useState("Learner")
  const [schoolName, setSchoolName] = useState("School")
  const [staff, setStaff] = useState<Staff[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [threadStaff, setThreadStaff] = useState<Record<string, Staff>>({})
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [activeStaff, setActiveStaff] = useState<Staff | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageBody, setMessageBody] = useState("")
  const [contextTag, setContextTag] = useState("question")
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [sentNotice, setSentNotice] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async (threadId: string) => {
    const { data, error } = await supabase
      .from("vc_messages")
      .select("id, sender_id, body, created_at")
      .eq("thread_id", threadId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
    if (error) throw new Error("messages-read")
    setMessages((data ?? []).filter(row => row.sender_id && row.created_at).map(row => ({ id: row.id, sender_id: row.sender_id as string, body: row.body, created_at: row.created_at as string })))
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
  }, [])

  const loadThreads = useCallback(async (uid: string) => {
    if (!studentId) return
    const { data: rows, error } = await supabase
      .from("vc_threads")
      .select("id, context_tag, last_message_at, last_message_preview")
      .eq("student_id", studentId)
      .eq("type", "direct")
      .order("last_message_at", { ascending: false, nullsFirst: false })
    if (error) throw new Error("threads-read")
    const normalized = (rows ?? []) as Thread[]
    setThreads(normalized)
    if (!normalized.length) { setThreadStaff({}); return }

    const ids = normalized.map(row => row.id)
    const { data: participants, error: participantError } = await supabase
      .from("vc_participants")
      .select("thread_id, profile_id")
      .in("thread_id", ids)
      .neq("profile_id", uid)
    if (participantError) throw new Error("participants-read")

    const staffIds = Array.from(new Set((participants ?? []).map(row => row.profile_id).filter((value): value is string => Boolean(value))))
    const { data: profiles, error: profileError } = staffIds.length
      ? await supabase.from("profiles").select("id, full_name, role").in("id", staffIds)
      : { data: [], error: null }
    if (profileError) throw new Error("staff-read")

    const profileMap = new Map((profiles ?? []).map(profile => [profile.id, { id: profile.id, full_name: profile.full_name, role: profile.role ?? "teacher" }]))
    const next: Record<string, Staff> = {}
    for (const participant of participants ?? []) {
      if (!participant.thread_id || !participant.profile_id) continue
      const member = profileMap.get(participant.profile_id)
      if (member) next[participant.thread_id] = member
    }
    setThreadStaff(next)
  }, [studentId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        if (!studentId) { setError("This learner is not available."); return }
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) { router.replace("/"); return }
        setUserId(user.id)

        const { data: link, error: linkError } = await supabase
          .from("parent_student_links").select("student_id").eq("parent_id", user.id).eq("student_id", studentId).maybeSingle()
        if (linkError) throw new Error("link-read")
        if (!link) { setError("This learner is not linked to your active parent account, or the relationship is no longer active."); return }

        const { data: student, error: studentError } = await supabase.from("students").select("name, class_id").eq("id", studentId).single()
        if (studentError || !student) throw new Error("student-read")
        setStudentName(student.name)
        if (!student.class_id) { setError("Teacher messaging becomes available after the school confirms the learner's class."); return }

        const [{ data: cls }, { data: assignments, error: assignmentError }] = await Promise.all([
          supabase.from("classes").select("school_id, schools(name)").eq("id", student.class_id).single(),
          supabase.from("teacher_classes").select("teacher_id").eq("class_id", student.class_id),
        ])
        if (assignmentError) throw new Error("assignment-read")
        const school = Array.isArray(cls?.schools) ? cls?.schools[0] : cls?.schools
        if (school && typeof school === "object" && "name" in school && typeof school.name === "string") setSchoolName(school.name)

        const teacherIds = Array.from(new Set((assignments ?? []).map(row => row.teacher_id).filter((value): value is string => Boolean(value))))
        const { data: teachers, error: teacherError } = teacherIds.length
          ? await supabase.from("profiles").select("id, full_name, role").in("id", teacherIds)
          : { data: [], error: null }
        if (teacherError) throw new Error("teacher-read")
        if (!cancelled) setStaff((teachers ?? []).map(teacher => ({ id: teacher.id, full_name: teacher.full_name, role: teacher.role ?? "teacher" })))
        await loadThreads(user.id)
      } catch {
        if (!cancelled) setError("Family messaging is temporarily unavailable. Check your connection and try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [loadThreads, router, studentId])

  const existingByStaff = useMemo(() => {
    const map = new Map<string, string>()
    for (const [threadId, member] of Object.entries(threadStaff)) map.set(member.id, threadId)
    return map
  }, [threadStaff])

  async function openStaff(member: Staff) {
    if (opening) return
    setError("")
    setSentNotice("")
    setOpening(true)
    try {
      let threadId = existingByStaff.get(member.id) ?? null
      if (!threadId) {
        const { data, error } = await rpc<string>("parent_start_child_thread", { p_student_id: studentId, p_staff_id: member.id, p_context_tag: contextTag })
        if (error || !data) throw new Error("thread-create")
        threadId = data
        await loadThreads(userId)
      }
      setActiveStaff(member)
      setActiveThreadId(threadId)
      await loadMessages(threadId)
    } catch {
      setError("This conversation could not be opened. The recipient and child context were not changed; try again.")
    } finally {
      setOpening(false)
    }
  }

  async function openExisting(thread: Thread) {
    const member = threadStaff[thread.id]
    if (!member) return
    setError("")
    setSentNotice("")
    try {
      setActiveStaff(member)
      setActiveThreadId(thread.id)
      setMessages([])
      await loadMessages(thread.id)
      await supabase.from("vc_participants").update({ last_read_at: new Date().toISOString() }).eq("thread_id", thread.id).eq("profile_id", userId)
    } catch {
      setActiveStaff(null)
      setActiveThreadId(null)
      setMessages([])
      setError("This conversation is temporarily unavailable. Try again.")
    }
  }

  async function sendMessage() {
    if (!activeThreadId || !messageBody.trim() || sendInFlight.current) return
    sendInFlight.current = true
    setSending(true)
    setError("")
    setSentNotice("")
    const body = messageBody.trim()
    try {
      const { error: insertError } = await supabase.from("vc_messages").insert({ thread_id: activeThreadId, sender_id: userId, body })
      if (insertError) throw new Error("message-send")
      await supabase.from("vc_threads").update({ last_message_at: new Date().toISOString(), last_message_preview: body.slice(0, 80) }).eq("id", activeThreadId)
      setMessageBody("")
      setSentNotice("Message sent.")
      await Promise.all([loadMessages(activeThreadId), loadThreads(userId)])
    } catch {
      setError("Your message was not confirmed as sent. It remains in the box so you can retry safely.")
    } finally {
      sendInFlight.current = false
      setSending(false)
    }
  }

  if (loading) return <section role="status" style={card}>Loading child messaging…</section>

  if (activeThreadId && activeStaff) return (
    <div style={{ minHeight: "70vh", display: "flex", flexDirection: "column" }}>
      <header style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={() => { setActiveThreadId(null); setActiveStaff(null); setMessages([]); setError(""); setSentNotice("") }} aria-label="Back to conversations" style={backButton}>‹</button>
        <div aria-hidden="true" style={avatar}>{initials(activeStaff.full_name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block" }}>{activeStaff.full_name}</strong>
          <span style={{ display: "block", marginTop: 2, color: C.muted, fontSize: 11 }}>{studentName} · {schoolName}</span>
        </div>
      </header>

      {error && <div role="alert" style={errorBox}>{error}</div>}
      {sentNotice && <div role="status" style={successBox}>{sentNotice}</div>}

      <section aria-label={`Conversation about ${studentName}`} style={{ ...card, flex: 1, minHeight: 340, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        {!messages.length ? <div style={{ margin: "auto", color: C.muted, fontSize: 13, textAlign: "center" }}>No messages yet. This conversation is linked to {studentName}.</div> : messages.map(message => {
          const mine = message.sender_id === userId
          return <div key={message.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}><div style={{ maxWidth: "82%", borderRadius: 15, padding: "9px 12px", background: mine ? C.green : "#f1f5f9", color: mine ? "#fff" : "#0f172a", fontSize: 13, lineHeight: 1.45 }}><div>{message.body}</div><div style={{ marginTop: 4, fontSize: 9, opacity: .68, textAlign: "right" }}>{timeLabel(message.created_at)}</div></div></div>
        })}
        <div ref={bottomRef} />
      </section>

      <div style={{ display: "flex", gap: 8 }}>
        <textarea aria-label={`Message ${activeStaff.full_name} about ${studentName}`} value={messageBody} onChange={event => setMessageBody(event.target.value)} placeholder={`Message ${activeStaff.full_name} about ${studentName}`} rows={2} style={composer} />
        <button type="button" disabled={sending || !messageBody.trim()} onClick={() => void sendMessage()} style={{ ...sendButton, opacity: sending || !messageBody.trim() ? .5 : 1 }}>{sending ? "Sending…" : "Send"}</button>
      </div>
    </div>
  )

  return (
    <div>
      <section style={{ background: `linear-gradient(145deg,#0f172a,${C.dark})`, color: "#fff", borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", color: "#a7f3d0", letterSpacing: 1, fontWeight: 900 }}>Messages · {studentName}</div>
        <h1 style={{ margin: "5px 0 4px", fontSize: 20 }}>Talk to the school</h1>
        <p style={{ margin: 0, color: "#cbd5e1", fontSize: 12 }}>{schoolName} · conversations remain attached to this learner.</p>
      </section>

      {error && <div role="alert" style={errorBox}>{error}</div>}

      {threads.length > 0 && <section style={card}>
        <h2 style={heading}>Recent conversations</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {threads.map(thread => {
            const member = threadStaff[thread.id]
            if (!member) return null
            return <button type="button" key={thread.id} onClick={() => void openExisting(thread)} style={contactButton}><span aria-hidden="true" style={avatar}>{initials(member.full_name)}</span><span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", fontSize: 12 }}>{member.full_name}</strong><span style={{ display: "block", marginTop: 2, color: C.muted, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.last_message_preview || "Conversation started"}</span></span><span style={{ color: "#94a3b8", fontSize: 9 }}>{timeLabel(thread.last_message_at)}</span></button>
          })}
        </div>
      </section>}

      <section style={card}>
        <h2 style={heading}>Start a conversation</h2>
        <p style={{ margin: "0 0 12px", color: C.muted, fontSize: 11, lineHeight: 1.5 }}>Only staff assigned through {studentName}&apos;s class are available. You cannot search arbitrary school staff.</p>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 12 }}>
          {[["question", "Question"], ["general", "General"], ["urgent", "Urgent"]].map(([value, label]) => <button type="button" key={value} aria-pressed={contextTag === value} onClick={() => setContextTag(value)} style={{ minHeight: 44, border: `1px solid ${contextTag === value ? C.green : C.border}`, borderRadius: 999, background: contextTag === value ? "#ecfdf5" : "#fff", color: contextTag === value ? "#065f46" : C.muted, padding: "0 12px", fontWeight: 800 }}>{label}</button>)}
        </div>
        {!staff.length ? <p style={{ color: C.muted, fontSize: 12 }}>No assigned teacher is available for messaging yet.</p> : <div style={{ display: "grid", gap: 8 }}>{staff.map(member => <button type="button" key={member.id} disabled={opening} onClick={() => void openStaff(member)} style={contactButton}><span aria-hidden="true" style={avatar}>{initials(member.full_name)}</span><span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", fontSize: 12 }}>{member.full_name}</strong><span style={{ display: "block", marginTop: 2, color: C.muted, fontSize: 10 }}>Assigned teacher · {studentName}</span></span><span aria-hidden="true" style={{ color: "#94a3b8", fontSize: 20 }}>›</span></button>)}</div>}
      </section>

      <button type="button" onClick={() => router.push(`/parent/child/${studentId}`)} style={secondaryButton}>Back to {studentName}</button>
    </div>
  )
}

const card: React.CSSProperties = { background: "#fff", border: `1px solid ${C.border}`, borderRadius: 15, padding: 14, marginBottom: 10 }
const heading: React.CSSProperties = { margin: "0 0 10px", fontSize: 16 }
const avatar: React.CSSProperties = { width: 38, height: 38, borderRadius: "50%", background: C.dark, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, flexShrink: 0 }
const contactButton: React.CSSProperties = { width: "100%", minHeight: 58, display: "flex", alignItems: "center", gap: 10, textAlign: "left", border: `1px solid ${C.border}`, background: "#fff", borderRadius: 12, padding: 10, cursor: "pointer", fontFamily: "inherit", color: "#0f172a" }
const backButton: React.CSSProperties = { width: 44, height: 44, border: `1px solid ${C.border}`, borderRadius: 12, background: "#fff", color: C.dark, fontSize: 26, cursor: "pointer" }
const composer: React.CSSProperties = { flex: 1, minHeight: 52, border: `1px solid ${C.border}`, borderRadius: 13, padding: "10px 12px", resize: "none", fontFamily: "inherit", fontSize: 13 }
const sendButton: React.CSSProperties = { minWidth: 78, minHeight: 52, border: "none", borderRadius: 13, background: C.green, color: "#fff", padding: "0 14px", fontFamily: "inherit", fontWeight: 900, cursor: "pointer" }
const secondaryButton: React.CSSProperties = { width: "100%", minHeight: 46, border: `1px solid ${C.border}`, borderRadius: 12, background: "#fff", padding: 12, color: C.dark, fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }
const errorBox: React.CSSProperties = { border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 12, padding: 11, marginBottom: 10, fontSize: 12 }
const successBox: React.CSSProperties = { border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#166534", borderRadius: 12, padding: 11, marginBottom: 10, fontSize: 12 }

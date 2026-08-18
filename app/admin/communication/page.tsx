"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"

type Audience = "all_staff" | "all_students" | "all_parents" | "everyone"

type CommunityPerson = {
  profile_id: string
  full_name: string | null
  relationship: string
}

type ThreadRow = {
  id: string
  subject: string | null
  context_tag: string | null
  last_message_at: string | null
  last_message_preview: string | null
}

type ThreadItem = ThreadRow & {
  otherId: string | null
  otherName: string
  otherRole: string
}

type MessageRow = {
  id: string
  sender_id: string | null
  body: string
  created_at: string | null
}

type CircularRow = {
  id: string
  title: string
  body: string
  audience_type: string
  requires_ack: boolean | null
  ack_deadline: string | null
  sent_at: string | null
  created_at: string | null
}

type CircularItem = CircularRow & {
  recipientCount: number
  ackCount: number
}

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #cbd5e1",
  borderRadius: 11,
  padding: "11px 12px",
  background: "white",
  fontSize: 14,
}

function shortTime(value: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

export default function AdminCommunicationPage() {
  const [schoolId, setSchoolId] = useState("")
  const [userId, setUserId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<"messages" | "circulars">("messages")

  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [activeThread, setActiveThread] = useState<ThreadItem | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [messageBody, setMessageBody] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)

  const [composeOpen, setComposeOpen] = useState(false)
  const [personQuery, setPersonQuery] = useState("")
  const [people, setPeople] = useState<CommunityPerson[]>([])
  const [searching, setSearching] = useState(false)

  const [circulars, setCirculars] = useState<CircularItem[]>([])
  const [circularOpen, setCircularOpen] = useState(false)
  const [circularTitle, setCircularTitle] = useState("")
  const [circularBody, setCircularBody] = useState("")
  const [audience, setAudience] = useState<Audience>("everyone")
  const [requiresAck, setRequiresAck] = useState(true)
  const [ackDeadline, setAckDeadline] = useState("")
  const [sendingCircular, setSendingCircular] = useState(false)

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    if (!composeOpen || personQuery.trim().length < 2 || !schoolId) {
      setPeople([])
      return
    }
    const timer = setTimeout(() => void searchCommunity(personQuery), 250)
    return () => clearTimeout(timer)
  }, [composeOpen, personQuery, schoolId])

  async function bootstrap() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      setSchoolId(authority.schoolId)
      setUserId(authority.userId)
      await Promise.all([
        loadThreads(authority.schoolId, authority.userId),
        loadCirculars(authority.schoolId),
      ])
    } catch (cause) {
      console.error("Admin communications bootstrap failed", cause)
      setError(cause instanceof Error ? cause.message : "School communications could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  async function loadThreads(sid: string, uid: string) {
    const participantRes = await supabase
      .from("vc_participants")
      .select("thread_id")
      .eq("profile_id", uid)
      .eq("school_id", sid)
      .is("left_at", null)
    if (participantRes.error) throw participantRes.error
    const threadIds = Array.from(new Set((participantRes.data ?? []).map(row => row.thread_id).filter((id): id is string => Boolean(id))))
    if (threadIds.length === 0) {
      setThreads([])
      return
    }

    const [threadRes, allParticipantsRes] = await Promise.all([
      supabase
        .from("vc_threads")
        .select("id,subject,context_tag,last_message_at,last_message_preview")
        .eq("school_id", sid)
        .in("id", threadIds)
        .order("last_message_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("vc_participants")
        .select("thread_id,profile_id")
        .eq("school_id", sid)
        .in("thread_id", threadIds)
        .is("left_at", null),
    ])
    if (threadRes.error) throw threadRes.error
    if (allParticipantsRes.error) throw allParticipantsRes.error

    const otherIds = Array.from(new Set(
      (allParticipantsRes.data ?? [])
        .map(row => row.profile_id)
        .filter((id): id is string => Boolean(id && id !== uid))
    ))
    const profileRes = otherIds.length
      ? await supabase.from("profiles").select("id,full_name,role").in("id", otherIds)
      : { data: [], error: null }
    if (profileRes.error) throw profileRes.error
    const profiles = new Map((profileRes.data ?? []).map(row => [row.id, row]))

    setThreads(((threadRes.data ?? []) as ThreadRow[]).map(thread => {
      const participant = (allParticipantsRes.data ?? []).find(row => row.thread_id === thread.id && row.profile_id && row.profile_id !== uid)
      const profile = participant?.profile_id ? profiles.get(participant.profile_id) : null
      return {
        ...thread,
        otherId: participant?.profile_id ?? null,
        otherName: profile?.full_name ?? thread.subject ?? "School conversation",
        otherRole: profile?.role ?? "community",
      }
    }))
  }

  async function loadCirculars(sid: string) {
    const circularRes = await supabase
      .from("vc_circulars")
      .select("id,title,body,audience_type,requires_ack,ack_deadline,sent_at,created_at")
      .eq("school_id", sid)
      .order("sent_at", { ascending: false })
      .limit(50)
    if (circularRes.error) throw circularRes.error
    const rows = (circularRes.data ?? []) as CircularRow[]
    if (rows.length === 0) {
      setCirculars([])
      return
    }
    const ids = rows.map(row => row.id)
    const recipientRes = await supabase
      .from("vc_circular_recipients")
      .select("circular_id,ack_at")
      .in("circular_id", ids)
    if (recipientRes.error) throw recipientRes.error
    setCirculars(rows.map(row => {
      const recipients = (recipientRes.data ?? []).filter(recipient => recipient.circular_id === row.id)
      return {
        ...row,
        recipientCount: recipients.length,
        ackCount: recipients.filter(recipient => Boolean(recipient.ack_at)).length,
      }
    }))
  }

  async function searchCommunity(query: string) {
    if (!schoolId) return
    setSearching(true)
    setError("")
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "admin_search_school_community" as never,
        { p_school_id: schoolId, p_query: query.trim(), p_limit: 12 } as never
      )
      if (rpcError) throw rpcError
      setPeople((data ?? []) as unknown as CommunityPerson[])
    } catch (cause) {
      console.error("Admin community search failed", cause)
      setPeople([])
      setError(cause instanceof Error ? cause.message : "School community search failed.")
    } finally {
      setSearching(false)
    }
  }

  async function findOrCreateDirectThread(other: CommunityPerson) {
    if (!schoolId || !userId) return
    setError("")
    try {
      const myParticipants = await supabase
        .from("vc_participants")
        .select("thread_id")
        .eq("school_id", schoolId)
        .eq("profile_id", userId)
        .is("left_at", null)
      if (myParticipants.error) throw myParticipants.error
      const myThreadIds = (myParticipants.data ?? []).map(row => row.thread_id).filter((id): id is string => Boolean(id))
      if (myThreadIds.length > 0) {
        const shared = await supabase
          .from("vc_participants")
          .select("thread_id")
          .eq("school_id", schoolId)
          .eq("profile_id", other.profile_id)
          .in("thread_id", myThreadIds)
          .is("left_at", null)
          .limit(1)
        if (shared.error) throw shared.error
        const existingId = shared.data?.[0]?.thread_id
        if (existingId) {
          const existing = threads.find(row => row.id === existingId)
          if (existing) setActiveThread(existing)
          else await loadThreads(schoolId, userId)
          setComposeOpen(false)
          return
        }
      }

      const threadRes = await supabase
        .from("vc_threads")
        .insert({ school_id: schoolId, type: "direct", created_by: userId, context_tag: "general" })
        .select("id,subject,context_tag,last_message_at,last_message_preview")
        .single()
      if (threadRes.error || !threadRes.data) throw threadRes.error ?? new Error("Conversation could not be created.")

      const participantRes = await supabase.from("vc_participants").insert([
        { thread_id: threadRes.data.id, profile_id: userId, school_id: schoolId },
        { thread_id: threadRes.data.id, profile_id: other.profile_id, school_id: schoolId },
      ])
      if (participantRes.error) throw participantRes.error

      const next: ThreadItem = {
        ...(threadRes.data as ThreadRow),
        otherId: other.profile_id,
        otherName: other.full_name ?? "School community member",
        otherRole: other.relationship,
      }
      setActiveThread(next)
      setThreads(current => [next, ...current])
      setComposeOpen(false)
      setPersonQuery("")
      setPeople([])
      setMessages([])
    } catch (cause) {
      console.error("Admin direct conversation creation failed", cause)
      setError(cause instanceof Error ? cause.message : "Conversation could not be created.")
    }
  }

  async function openThread(thread: ThreadItem) {
    setActiveThread(thread)
    setError("")
    const { data, error: queryError } = await supabase
      .from("vc_messages")
      .select("id,sender_id,body,created_at")
      .eq("school_id", schoolId)
      .eq("thread_id", thread.id)
      .is("deleted_at", null)
      .order("created_at")
    if (queryError) {
      setError(queryError.message)
      return
    }
    setMessages((data ?? []) as MessageRow[])
    await supabase
      .from("vc_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("school_id", schoolId)
      .eq("thread_id", thread.id)
      .eq("profile_id", userId)
  }

  async function sendMessage() {
    if (!activeThread || !messageBody.trim() || sendingMessage) return
    setSendingMessage(true)
    setError("")
    const body = messageBody.trim()
    try {
      const { data, error: insertError } = await supabase
        .from("vc_messages")
        .insert({ school_id: schoolId, thread_id: activeThread.id, sender_id: userId, body })
        .select("id,sender_id,body,created_at")
        .single()
      if (insertError || !data) throw insertError ?? new Error("Message was not sent.")
      await supabase
        .from("vc_threads")
        .update({ last_message_at: new Date().toISOString(), last_message_preview: body.slice(0, 80) })
        .eq("id", activeThread.id)
        .eq("school_id", schoolId)
      setMessages(current => [...current, data as MessageRow])
      setMessageBody("")
      await loadThreads(schoolId, userId)
    } catch (cause) {
      console.error("Admin message send failed", cause)
      setError(cause instanceof Error ? cause.message : "Message was not sent.")
    } finally {
      setSendingMessage(false)
    }
  }

  async function sendCircular() {
    if (!schoolId || !circularTitle.trim() || !circularBody.trim() || sendingCircular) return
    setSendingCircular(true)
    setError("")
    try {
      const { error: rpcError } = await supabase.rpc(
        "admin_send_school_circular" as never,
        {
          p_school_id: schoolId,
          p_title: circularTitle.trim(),
          p_body: circularBody.trim(),
          p_audience: audience,
          p_requires_ack: requiresAck,
          p_ack_deadline: ackDeadline ? new Date(ackDeadline).toISOString() : null,
        } as never
      )
      if (rpcError) throw rpcError
      setCircularOpen(false)
      setCircularTitle("")
      setCircularBody("")
      setAudience("everyone")
      setRequiresAck(true)
      setAckDeadline("")
      await loadCirculars(schoolId)
    } catch (cause) {
      console.error("Admin circular send failed", cause)
      setError(cause instanceof Error ? cause.message : "Circular was not sent.")
    } finally {
      setSendingCircular(false)
    }
  }

  const audienceLabels: Record<Audience, string> = useMemo(() => ({
    all_staff: "Teachers & school staff",
    all_students: "Students with VibeSchool accounts",
    all_parents: "Verified parents / guardians",
    everyone: "Whole school community",
  }), [])

  if (loading) return <div aria-busy="true" style={{ minHeight: 280, borderRadius: 18, background: "#e2e8f0" }} />

  if (activeThread) {
    return (
      <main style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 12 }}>
        <header style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button aria-label="Back to conversations" onClick={() => { setActiveThread(null); setMessages([]) }} style={{ border: 0, background: "transparent", fontSize: 26, cursor: "pointer" }}>‹</button>
          <div>
            <h1 style={{ fontSize: 18, margin: 0 }}>{activeThread.otherName}</h1>
            <div style={{ color: "#64748b", fontSize: 12, textTransform: "capitalize" }}>{activeThread.otherRole}</div>
          </div>
        </header>
        {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 10, borderRadius: 10 }}>{error}</div>}
        <section style={{ minHeight: 360, maxHeight: "60vh", overflowY: "auto", background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.length === 0 ? <div style={{ color: "#64748b", textAlign: "center", margin: "auto" }}>No messages yet.</div> : messages.map(message => {
            const mine = message.sender_id === userId
            return (
              <div key={message.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", background: mine ? "#d1fae5" : "#f1f5f9", borderRadius: 14, padding: "9px 11px" }}>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{message.body}</div>
                <div style={{ color: "#64748b", fontSize: 10, marginTop: 4 }}>{shortTime(message.created_at)}</div>
              </div>
            )
          })}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8 }}>
          <textarea aria-label="Message" value={messageBody} onChange={event => setMessageBody(event.target.value)} rows={2} placeholder="Write a school-related message" style={{ ...fieldStyle, resize: "vertical" }} />
          <button disabled={sendingMessage || !messageBody.trim()} onClick={() => void sendMessage()} style={{ border: 0, borderRadius: 11, padding: "0 17px", background: "#10b981", color: "white", fontWeight: 780, cursor: "pointer" }}>{sendingMessage ? "…" : "Send"}</button>
        </section>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 24 }}>School communications</h1>
        <p style={{ color: "#64748b", margin: "5px 0 0" }}>Message only verified members of this school community. Recipient scope is enforced by backend authority.</p>
      </header>

      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12 }}>{error}</div>}

      <nav style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "#f1f5f9", borderRadius: 13, padding: 4 }}>
        <button onClick={() => setTab("messages")} style={{ border: 0, borderRadius: 10, padding: 10, background: tab === "messages" ? "white" : "transparent", fontWeight: 730, cursor: "pointer" }}>Messages</button>
        <button onClick={() => setTab("circulars")} style={{ border: 0, borderRadius: 10, padding: 10, background: tab === "circulars" ? "white" : "transparent", fontWeight: 730, cursor: "pointer" }}>Circulars</button>
      </nav>

      {tab === "messages" ? (
        <>
          <button onClick={() => setComposeOpen(true)} style={{ border: 0, borderRadius: 12, padding: 12, background: "#0a1628", color: "white", fontWeight: 760, cursor: "pointer" }}>New school conversation</button>
          {threads.length === 0 ? (
            <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28, textAlign: "center" }}>
              <strong>No conversations yet</strong>
              <p style={{ color: "#64748b" }}>Search the authorized school community to begin a conversation.</p>
            </section>
          ) : (
            <section style={{ display: "grid", gap: 8 }}>
              {threads.map(thread => (
                <button key={thread.id} onClick={() => void openThread(thread)} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, textAlign: "left", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 780, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.otherName}</div>
                    <div style={{ color: "#64748b", fontSize: 13, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.last_message_preview || "No messages yet"}</div>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 11, textAlign: "right" }}>{thread.otherRole}<br />{shortTime(thread.last_message_at)}</div>
                </button>
              ))}
            </section>
          )}
        </>
      ) : (
        <>
          <button onClick={() => setCircularOpen(true)} style={{ border: 0, borderRadius: 12, padding: 12, background: "#10b981", color: "white", fontWeight: 760, cursor: "pointer" }}>New circular</button>
          {circulars.length === 0 ? (
            <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28, textAlign: "center" }}>
              <strong>No circulars sent yet</strong>
              <p style={{ color: "#64748b" }}>Send a school-scoped notice to teachers, students, parents, or everyone.</p>
            </section>
          ) : (
            <section style={{ display: "grid", gap: 8 }}>
              {circulars.map(circular => (
                <article key={circular.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <strong>{circular.title}</strong>
                    <span style={{ color: "#64748b", fontSize: 11 }}>{shortTime(circular.sent_at ?? circular.created_at)}</span>
                  </div>
                  <p style={{ color: "#475569", lineHeight: 1.5, whiteSpace: "pre-wrap", margin: "8px 0" }}>{circular.body}</p>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {audienceLabels[(circular.audience_type as Audience)] ?? circular.audience_type} · {circular.recipientCount} recipients{circular.requires_ack ? ` · ${circular.ackCount}/${circular.recipientCount} acknowledged` : ""}
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}

      {composeOpen && (
        <div role="dialog" aria-modal="true" aria-label="New school conversation" style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "end center" }}>
          <section style={{ width: "min(100%,620px)", maxHeight: "85vh", overflowY: "auto", background: "white", borderRadius: "22px 22px 0 0", padding: 20, boxSizing: "border-box", display: "grid", gap: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: 0 }}>New conversation</h2><button aria-label="Close" onClick={() => setComposeOpen(false)} style={{ border: 0, background: "#f1f5f9", borderRadius: 999, width: 36, height: 36, cursor: "pointer" }}>×</button></div>
            <input autoFocus value={personQuery} onChange={event => setPersonQuery(event.target.value)} placeholder="Search teacher, student or parent" style={fieldStyle} />
            {searching && <div style={{ color: "#64748b" }}>Searching authorized school community…</div>}
            {!searching && personQuery.length >= 2 && people.length === 0 && <div style={{ color: "#64748b" }}>No matching member in this school.</div>}
            {people.map(person => (
              <button key={person.profile_id} onClick={() => void findOrCreateDirectThread(person)} style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "white", padding: 12, textAlign: "left", cursor: "pointer" }}>
                <strong>{person.full_name ?? "Unnamed school member"}</strong>
                <div style={{ color: "#64748b", fontSize: 12, textTransform: "capitalize", marginTop: 3 }}>{person.relationship}</div>
              </button>
            ))}
          </section>
        </div>
      )}

      {circularOpen && (
        <div role="dialog" aria-modal="true" aria-label="New school circular" style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "end center" }}>
          <section style={{ width: "min(100%,620px)", maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: "22px 22px 0 0", padding: 20, boxSizing: "border-box", display: "grid", gap: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: 0 }}>New circular</h2><button aria-label="Close" onClick={() => setCircularOpen(false)} style={{ border: 0, background: "#f1f5f9", borderRadius: 999, width: 36, height: 36, cursor: "pointer" }}>×</button></div>
            <label>Title<input value={circularTitle} onChange={event => setCircularTitle(event.target.value)} style={fieldStyle} /></label>
            <label>Audience<select value={audience} onChange={event => setAudience(event.target.value as Audience)} style={fieldStyle}>{(Object.keys(audienceLabels) as Audience[]).map(key => <option key={key} value={key}>{audienceLabels[key]}</option>)}</select></label>
            <label>Message<textarea value={circularBody} onChange={event => setCircularBody(event.target.value)} rows={6} style={{ ...fieldStyle, resize: "vertical" }} /></label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={requiresAck} onChange={event => setRequiresAck(event.target.checked)} /> Require acknowledgement</label>
            {requiresAck && <label>Acknowledgement deadline (optional)<input type="datetime-local" value={ackDeadline} onChange={event => setAckDeadline(event.target.value)} style={fieldStyle} /></label>}
            <button disabled={sendingCircular || !circularTitle.trim() || !circularBody.trim()} onClick={() => void sendCircular()} style={{ border: 0, borderRadius: 12, padding: 13, background: "#10b981", color: "white", fontWeight: 780, cursor: "pointer" }}>{sendingCircular ? "Sending…" : "Send to school audience"}</button>
          </section>
        </div>
      )}
    </main>
  )
}

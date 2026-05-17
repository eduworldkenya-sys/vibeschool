"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Message, MessageThread } from "@/lib/types";

// ── Relative time helper ──────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  const d = new Date(iso);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────
function ThreadSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px" }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 16,
            background: "#fff",
            borderRadius: 12,
          }}
        >
          <div className="shimmer" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="shimmer" style={{ width: "55%", height: 14, borderRadius: 6 }} />
            <div className="shimmer" style={{ width: "80%", height: 12, borderRadius: 6 }} />
          </div>
          <div className="shimmer" style={{ width: 32, height: 10, borderRadius: 6 }} />
        </div>
      ))}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s infinite linear;
        }
      `}</style>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ConnectPage() {
  const [userId, setUserId]               = useState<string | null>(null);
  const [threads, setThreads]             = useState<MessageThread[]>([]);
  const [loading, setLoading]             = useState(true);
  const [view, setView]                   = useState<"threads" | "conversation">("threads");
  const [activeThread, setActiveThread]   = useState<MessageThread | null>(null);
  const [conversation, setConversation]   = useState<Message[]>([]);
  const [convLoading, setConvLoading]     = useState(false);
  const [composeOpen, setComposeOpen]     = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<{ id: string; full_name: string } | null>(null);
  const [messageBody, setMessageBody]     = useState("");
  const [sending, setSending]             = useState(false);
  const [replyText, setReplyText]         = useState("");

  // ── Get current user ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // ── Fetch threads ───────────────────────────────────────────────────────────
  const fetchThreads = useCallback(async (uid: string) => {
    setLoading(true);
    const { data: messages, error } = await supabase
      .from("parent_messages")
      .select("*")
      .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
      .order("created_at", { ascending: false });

    if (error || !messages) { setLoading(false); return; }

    // Group by the other party
    const threadMap: Record<string, Message[]> = {};
    for (const msg of messages as Message[]) {
      const otherId = msg.sender_id === uid ? msg.recipient_id : msg.sender_id;
      if (!threadMap[otherId]) threadMap[otherId] = [];
      threadMap[otherId].push(msg);
    }

    // Resolve teacher names
    const teacherIds = Object.keys(threadMap);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", teacherIds);

    const nameMap: Record<string, string> = {};
    for (const p of profiles ?? []) nameMap[p.id] = p.full_name;

    const built: MessageThread[] = teacherIds.map((tid) => {
      const msgs = threadMap[tid];
      const latest = msgs[0];
      const unread = msgs.filter(
        (m) => m.recipient_id === uid && !m.is_read
      ).length;
      return {
        teacherId:   tid,
        teacherName: nameMap[tid] ?? "Unknown",
        lastMessage: latest.body,
        lastTime:    relativeTime(latest.created_at),
        unreadCount: unread,
      };
    });

    // Sort by most recent — messages already desc so order of keys is correct
    setThreads(built);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userId) fetchThreads(userId);
  }, [userId, fetchThreads]);

  // ── Fetch conversation ──────────────────────────────────────────────────────
  const fetchConversation = useCallback(async (uid: string, teacherId: string) => {
    setConvLoading(true);
    const { data } = await supabase
      .from("parent_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${uid},recipient_id.eq.${teacherId}),and(sender_id.eq.${teacherId},recipient_id.eq.${uid})`
      )
      .order("created_at", { ascending: true });
    setConversation((data as Message[]) ?? []);
    setConvLoading(false);
  }, []);

  const openThread = useCallback((thread: MessageThread) => {
    setActiveThread(thread);
    setView("conversation");
    if (userId) fetchConversation(userId, thread.teacherId);
  }, [userId, fetchConversation]);

  // ── Teacher search ──────────────────────────────────────────────────────────
  const searchTeachers = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "teacher")
      .ilike("full_name", `%${q}%`)
      .limit(8);
    setSearchResults(data ?? []);
  }, []);

  useEffect(() => {
    searchTeachers(searchQuery);
  }, [searchQuery, searchTeachers]);

  // ── Send new message (compose sheet) ───────────────────────────────────────
  const sendNewMessage = useCallback(async () => {
    if (!userId || !selectedTeacher || messageBody.trim() === "") return;
    setSending(true);
    await supabase.from("parent_messages").insert({
      sender_id:    userId,
      recipient_id: selectedTeacher.id,
      body:         messageBody.trim(),
      is_read:      false,
    });
    setSending(false);
    setComposeOpen(false);
    setSelectedTeacher(null);
    setSearchQuery("");
    setMessageBody("");
    fetchThreads(userId);
  }, [userId, selectedTeacher, messageBody, fetchThreads]);

  // ── Send reply in conversation ──────────────────────────────────────────────
  const sendReply = useCallback(async () => {
    if (!userId || !activeThread || replyText.trim() === "") return;
    const { data } = await supabase
      .from("parent_messages")
      .insert({
        sender_id:    userId,
        recipient_id: activeThread.teacherId,
        body:         replyText.trim(),
        is_read:      false,
      })
      .select()
      .single();
    if (data) {
      setConversation((prev) => [...prev, data as Message]);
    }
    setReplyText("");
  }, [userId, activeThread, replyText]);

  // ── Total unread ────────────────────────────────────────────────────────────
  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — CONVERSATION VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === "conversation" && activeThread) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#f0f2f5" }}>

        {/* Conversation header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px", background: "#fff",
          borderBottom: "1px solid #e5e7eb",
        }}>
          <button
            onClick={() => { setView("threads"); setActiveThread(null); setConversation([]); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, color: "#1e1b4b", padding: 0, lineHeight: 1,
            }}
          >
            ←
          </button>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "#1e1b4b", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 15, flexShrink: 0,
          }}>
            {activeThread.teacherName.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>
            {activeThread.teacherName}
          </span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {convLoading ? (
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: 14 }}>Loading...</p>
          ) : (
            conversation.map((msg) => {
              const isParent = msg.sender_id === userId;
              return (
                <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isParent ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "75%",
                    padding: "10px 14px",
                    borderRadius: isParent ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isParent ? "#1e1b4b" : "#fff",
                    color: isParent ? "#fff" : "#111827",
                    border: isParent ? "none" : "1px solid #e5e7eb",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}>
                    {msg.body}
                  </div>
                  <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, padding: "0 4px" }}>
                    {relativeTime(msg.created_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Reply bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px", background: "#fff",
          borderTop: "1px solid #e5e7eb",
        }}>
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
            placeholder="Type a message"
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 24,
              border: "1px solid #e5e7eb", fontSize: 14,
              outline: "none", background: "#f0f2f5",
            }}
          />
          <button
            onClick={sendReply}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "#10b981", border: "none",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — THREAD LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div id="parent-connect-page" style={{ minHeight: "100dvh", background: "#f0f2f5", paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ padding: "20px 16px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Messages</h1>
        {totalUnread > 0 && (
          <span style={{
            background: "#10b981", color: "#fff",
            borderRadius: 999, padding: "2px 8px",
            fontSize: 12, fontWeight: 700,
          }}>
            {totalUnread}
          </span>
        )}
      </div>

      {/* Thread list / loading / empty */}
      {loading ? (
        <ThreadSkeleton />
      ) : threads.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "80px 32px", gap: 12, textAlign: "center",
        }}>
          <span style={{ fontSize: 48 }}>💬</span>
          <p style={{ fontSize: 17, fontWeight: 600, color: "#111827", margin: 0 }}>No messages yet</p>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Start a conversation with your {"child's"} teacher</p>
          <button
            onClick={() => setComposeOpen(true)}
            style={{
              marginTop: 8, padding: "12px 24px",
              background: "#10b981", color: "#fff",
              border: "none", borderRadius: 24,
              fontSize: 15, fontWeight: 600, cursor: "pointer",
            }}
          >
            Message a Teacher
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
          {threads.map((t) => (
            <button
              key={t.teacherId}
              onClick={() => openThread(t)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: 16, background: "#fff", borderRadius: 14,
                border: "none", cursor: "pointer", textAlign: "left", width: "100%",
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "#1e1b4b", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 18, flexShrink: 0,
              }}>
                {t.teacherName.charAt(0).toUpperCase()}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "#111827" }}>{t.teacherName}</p>
                <p style={{
                  margin: "2px 0 0", fontSize: 13, color: "#6b7280",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {t.lastMessage}
                </p>
              </div>

              {/* Right side */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{t.lastTime}</span>
                {t.unreadCount > 0 && (
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: "#10b981", display: "block",
                  }} />
                )}
              </div>
            </button>
          ))}

          {/* FAB to compose */}
          <button
            onClick={() => setComposeOpen(true)}
            style={{
              position: "fixed", bottom: 96, right: 20,
              width: 52, height: 52, borderRadius: "50%",
              background: "#10b981", border: "none",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(16,185,129,0.4)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Compose sheet ── */}
      {composeOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => { setComposeOpen(false); setSelectedTeacher(null); setSearchQuery(""); setMessageBody(""); setSearchResults([]); }}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.4)", zIndex: 40,
            }}
          />

          {/* Sheet */}
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            background: "#fff", borderRadius: "20px 20px 0 0",
            padding: "20px 16px 36px", zIndex: 50,
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 2, margin: "0 auto 4px" }} />

            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>New Message</h2>

            {/* Teacher search */}
            {selectedTeacher ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: "#f0fdf4",
                border: "1px solid #10b981", borderRadius: 10,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#065f46" }}>{selectedTeacher.full_name}</span>
                <button
                  onClick={() => { setSelectedTeacher(null); setSearchQuery(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16 }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search teacher by name..."
                  style={{
                    width: "100%", padding: "10px 14px",
                    border: "1px solid #e5e7eb", borderRadius: 10,
                    fontSize: 14, outline: "none", boxSizing: "border-box",
                  }}
                />
                {searchResults.length > 0 && (
                  <div style={{
                    border: "1px solid #e5e7eb", borderTop: "none",
                    borderRadius: "0 0 10px 10px", overflow: "hidden",
                  }}>
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setSelectedTeacher(r); setSearchQuery(""); setSearchResults([]); }}
                        style={{
                          display: "block", width: "100%", padding: "10px 14px",
                          background: "#fff", border: "none", borderBottom: "1px solid #f3f4f6",
                          cursor: "pointer", textAlign: "left", fontSize: 14, color: "#111827",
                        }}
                      >
                        {r.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Message body */}
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Write your message..."
              rows={4}
              style={{
                width: "100%", padding: "10px 14px",
                border: "1px solid #e5e7eb", borderRadius: 10,
                fontSize: 14, outline: "none", resize: "none",
                boxSizing: "border-box", fontFamily: "inherit",
              }}
            />

            {/* Send */}
            <button
              onClick={sendNewMessage}
              disabled={sending || !selectedTeacher || messageBody.trim() === ""}
              style={{
                padding: "13px", background: sending || !selectedTeacher || messageBody.trim() === "" ? "#d1fae5" : "#10b981",
                color: "#fff", border: "none", borderRadius: 12,
                fontSize: 15, fontWeight: 600, cursor: sending ? "not-allowed" : "pointer",
              }}
            >
              {sending ? "Sending..." : "Send Message"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
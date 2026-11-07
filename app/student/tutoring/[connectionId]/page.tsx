"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import PrivateTuitionTools from "@/components/vibetutor/PrivateTuitionTools";

type Invite = { id: string; tutor: string; status: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default function StudentTutorDetail() {
  const params = useParams();
  const id = typeof params.connectionId === "string" ? params.connectionId : "";
  const [tutor, setTutor] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      if (!uuid.test(id)) { setLoading(false); return; }
      const db = getSupabaseClient();
      const { data: auth, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !auth.user) { setError("Sign in to view your tutor."); setLoading(false); return; }
      // Owner-scoped inbox is the canonical source of approved student connections.
      const { data, error: inboxError } = await db.rpc("vibetutor_student_inbox");
      if (!active) return;
      if (inboxError) setError("Could not load your tutor.");
      else setTutor(((data ?? []) as Invite[]).find(row => row.id === id && row.status === "accepted") ?? null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);
  return <main style={{ maxWidth: 650, margin: "16px auto", padding: "12px 16px 80px", display: "grid", gap: 16 }}>
    <Link href="/student/tutoring">← My Tutors</Link>
    {loading ? <p role="status">Loading tutor…</p> : error ? <p role="alert">{error}</p> : !tutor ? <p>This tutor connection is not available or is awaiting approval.</p> : <>
      <header style={{ border: "1px solid var(--vs-border, #ddd)", borderRadius: 16, padding: 20 }}>
        <h1 style={{ margin: "0 0 8px" }}>{tutor.tutor}</h1>
        <p style={{ margin: 0, color: "#087451" }}>Connected tutor</p>
      </header>
      <PrivateTuitionTools invitationId={tutor.id} isTutor={false} />
    </>}
  </main>;
}

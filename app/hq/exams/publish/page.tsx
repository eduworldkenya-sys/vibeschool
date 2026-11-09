"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { hqSupabase } from "@/lib/hq/supabase"

type PrivateDraft = {
  id: string; grade: string; subject: string; title: string;
  question_count: number; status: string; published: boolean;
}
type ReviewItem = { number: number; topic: string; prompt: string; correctAnswer: string; explanation: string; options: { value: string; label: string }[] }
type ReviewPaper = { id: string; title: string; subject: string; items: ReviewItem[] }
type PublishResult = {
  ok?: boolean; valid?: boolean; published?: boolean; already_exists?: boolean
  ready_to_publish?: boolean; title?: string; grade?: string; subject?: string
  question_count?: number; total_marks?: number; curriculum_verification?: string
  assessment_id?: string; assignment_id?: string; issues?: string[]
}

const api = hqSupabase
const blank = {
  id: "grade4-original-exam-01",
  title: "Grade 4 Mathematics — VibeSchool Exam 01",
  grade: "Grade 4",
  subject: "Mathematics",
  assessment_type: "practice",
  visibility: "public_practice",
  duration_minutes: 20,
  max_attempts: 3,
  total_marks: 1,
  instructions: "Choose one answer. You may skip questions. Results are shown after submission.",
  items: [{
    number: 1, bank_key: "G4-DRAFT-001", topic: "Integers", difficulty: "easy",
    prompt: "Replace this sample with an original question.",
    options: [
      { value: "A", label: "Option one" }, { value: "B", label: "Option two" },
      { value: "C", label: "Option three" }, { value: "D", label: "Option four" }
    ],
    correctAnswer: "A", explanation: "Explain the mathematical steps and the correct answer.", marks: 1
  }]
}
const surface: React.CSSProperties = { background: "#fff", border: "1px solid #d8e0eb", borderRadius: 14, padding: 18 }
const button: React.CSSProperties = { minHeight: 46, borderRadius: 10, padding: "10px 18px", border: 0, background: "#153a6d", color: "white", cursor: "pointer", fontWeight: 700 }
const labelStyle: React.CSSProperties = { display: "block", fontWeight: 700, fontSize: 14, marginBottom: 8 }

export default function OriginalExamPublisher() {
  const [raw, setRaw] = useState("")
  const [preview, setPreview] = useState<PublishResult | null>(null)
  const [validatedText, setValidatedText] = useState("")
  const [approved, setApproved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [owner, setOwner] = useState<boolean | null>(null)
  const [result, setResult] = useState<PublishResult | null>(null)
  const [privateDrafts, setPrivateDrafts] = useState<PrivateDraft[]>([])
  const [privateDraftError, setPrivateDraftError] = useState("")
  const [approvedPrivateId, setApprovedPrivateId] = useState("")
  const [reviewDraft, setReviewDraft] = useState<ReviewPaper | null>(null)
  const [reviewConfirmed, setReviewConfirmed] = useState(false)

  useEffect(() => {
    let mounted = true
    void api.rpc("is_platform_owner").then(({ data, error: problem }: { data: unknown; error: unknown }) => {
      if (mounted) setOwner(!problem && data === true)
    })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (owner !== true) return
    let active = true
    void Promise.resolve(api.rpc("hq_list_original_exam_drafts")).then(({ data, error: failure }: { data: unknown; error: { message?: string } | null }) => {
      if (!active) return
      if (failure) { setPrivateDraftError(failure.message || "Private drafts unavailable"); return }
      setPrivateDrafts(Array.isArray(data) ? data as PrivateDraft[] : [])
    }).catch(() => { if (active) setPrivateDraftError("Private drafts unavailable") })
    return () => { active = false }
  }, [owner])

  async function openPrivateReview(paper: PrivateDraft) {
    if (owner !== true || busy || paper.status !== "needs_editorial_review") return
    setBusy(true); setError("")
    try {
      const { data, error: failure } = await api.rpc("hq_get_original_exam_draft_for_review", { p_paper_id: paper.id })
      if (failure) throw new Error(failure.message || "Private review could not load")
      const next = data as { paper?: ReviewPaper } | null
      if (next?.paper?.id !== paper.id || !Array.isArray(next.paper.items)) throw new Error("Review data is incomplete")
      setReviewDraft(next.paper); setReviewConfirmed(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Private review unavailable") }
    finally { setBusy(false) }
  }

  async function approvePrivateReview() {
    if (owner !== true || !reviewDraft || !reviewConfirmed || busy) return
    setBusy(true); setError("")
    try {
      const { data, error: failure } = await api.rpc("hq_review_original_exam_draft", {
        p_paper_id: reviewDraft.id,
        p_confirmed: true,
        p_curriculum_reference: "https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/"
      })
      if (failure) throw new Error(failure.message || "Educational review was not recorded")
      const next = data as { reviewed?: boolean } | null
      if (next?.reviewed !== true) throw new Error("Educational review was not confirmed")
      setPrivateDrafts(items => items.map(item => item.id === reviewDraft.id ? { ...item, status: "reviewed" } : item))
      setReviewDraft(null); setReviewConfirmed(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Educational review failed") }
    finally { setBusy(false) }
  }

  async function publishPrivateDraft(paper: PrivateDraft) {
    if (owner !== true || busy || paper.status !== "reviewed" || approvedPrivateId !== paper.id) return
    setBusy(true); setError("")
    try {
      const { data, error: failure } = await api.rpc("hq_publish_staged_original_exam", {
        p_paper_id: paper.id, p_approved: true
      })
      if (failure) throw new Error(failure.message || "Private publication failed")
      const next = data as PublishResult
      if (!next?.published || !next.assignment_id) throw new Error("Publication not confirmed")
      setResult(next)
      setApprovedPrivateId("")
      setPrivateDrafts(items => items.map(item => item.id === paper.id ? { ...item, published: true } : item))
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Private publication failed") }
    finally { setBusy(false) }
  }

  const parsed = useMemo(() => {
    if (!raw.trim()) return { paper: null, error: "" }
    try {
      const value: unknown = JSON.parse(raw)
      if (!value || typeof value !== "object" || Array.isArray(value)) return { paper: null, error: "The document must contain one JSON object." }
      return { paper: value, error: "" }
    } catch { return { paper: null, error: "Invalid JSON. Check commas, quotes and brackets." } }
  }, [raw])

  const canPublish = Boolean(preview?.valid && preview.ready_to_publish && validatedText === raw && approved && !busy && owner)
  function changeRaw(value: string) {
    setRaw(value); setPreview(null); setValidatedText(""); setApproved(false); setResult(null); setError("")
  }

  async function call(publish: boolean) {
    if (owner !== true || busy || !parsed.paper) return
    if (publish && !canPublish) return
    setBusy(true); setError("")
    try {
      const { data, error: failure } = await api.rpc("hq_publish_original_practice", {
        p_paper: parsed.paper, p_publish: publish, p_approved: publish && approved
      })
      if (failure) throw new Error(failure.message || "The publisher could not complete.")
      const next = data as PublishResult
      if (publish) {
        if (!next?.published || !next.assignment_id) throw new Error("Publication was not confirmed.")
        setResult(next)
      } else {
        setPreview(next)
        setValidatedText(raw)
        setApproved(false)
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Publication failed.") }
    finally { setBusy(false) }
  }

  async function handleFile(file?: File) {
    if (!file) return
    if (file.size > 200000) { setError("Choose a JSON file under 200 KB."); return }
    try { changeRaw(await file.text()) }
    catch { setError("Unable to read that file.") }
  }

  return <main style={{ minHeight: "100vh", background: "#f4f7fb", color: "#18283e", padding: "28px 16px 100px" }}>
    <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 18 }}>
      <header>
        <p style={{ color: "#516789", fontSize: 12, letterSpacing: 1.5, fontWeight: 800 }}>HQ · EXAM BANK</p>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", marginBottom: 8 }}>Publish VibeSchool original exams</h1>
        <Link href="/hq/exams/batch" style={{ display: "inline-block", marginBottom: 10, color: "#1251a4", fontWeight: 800 }}>Batch publish Topic Practice →</Link>
        <p style={{ color: "#53657c", lineHeight: 1.6, margin: 0 }}>Private exam drafts are secured on the server. Publication requires independent educational review and owner approval.</p>
      </header>
      {owner === null && <section style={surface} role="status">Checking publisher permissions…</section>}
      {owner === false && <section style={surface} role="alert">Only a VibeSchool platform owner can publish public learner exams.</section>}
      {owner === true && <>
        <section style={surface}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Private original exam bank</h2>
          <p style={{ color: "#53657c", fontSize: 13 }}>Only independently reviewed original exams can be published. No question text or answer keys are sent to this list.</p>
          {privateDraftError && <p role="alert" style={{ color: "#92400e" }}>{privateDraftError}</p>}
          {privateDrafts.filter(paper => paper.status !== "retired").map(paper => <div key={paper.id} style={{ padding: "12px 0", borderTop: "1px solid #e3e8f0" }}>
            <strong>{paper.title}</strong>
            <p style={{ margin: "6px 0", color: "#53657c", fontSize: 13 }}>{paper.subject} · {paper.grade} · {paper.question_count} questions · {paper.published ? "Published" : paper.status === "reviewed" ? "Reviewed" : "Awaiting educational review"}</p>
            {!paper.published && paper.status === "needs_editorial_review" && <button type="button" style={{ ...button, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={()=>void openPrivateReview(paper)}>Review questions</button>}
            {!paper.published && paper.status === "reviewed" && <>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 13 }}>
                <input type="checkbox" checked={approvedPrivateId === paper.id} onChange={e=>setApprovedPrivateId(e.target.checked ? paper.id : "")}/>
                I approve this independently reviewed original assessment for learners.
              </label>
              <button type="button" style={{ ...button, opacity: busy || approvedPrivateId !== paper.id ? 0.5 : 1 }} disabled={busy || approvedPrivateId !== paper.id} onClick={()=>void publishPrivateDraft(paper)}>Publish reviewed exam</button>
            </>}
          </div>)}
          {reviewDraft && <section style={{ ...surface, marginTop: 16, borderColor: "#aabbd1" }} aria-label="Owner exam review">
            <h3 style={{ marginTop: 0 }}>Review: {reviewDraft.title}</h3>
            <p style={{ fontSize: 13, color: "#53657c" }}>Check every question and marking key against <a href="https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/" target="_blank" rel="noopener noreferrer">the official Grade 4 KICD designs</a>. Outcome-level verification remains provisional.</p>
            <ol style={{ display: "grid", gap: 12, paddingLeft: 24 }}>
              {reviewDraft.items.map(item => <li key={item.number}>
                <strong>{item.topic}: {item.prompt}</strong>
                <ul>{item.options.map(option => <li key={option.value}>{option.value}. {option.label}</li>)}</ul>
                <p><strong>Correct answer: {item.correctAnswer}</strong> — {item.explanation}</p>
              </li>)}
            </ol>
            <label style={{ display: "flex", gap: 8, alignItems: "start", fontSize: 13 }}>
              <input type="checkbox" checked={reviewConfirmed} onChange={e=>setReviewConfirmed(e.target.checked)} />
              I checked every question, answer, explanation, originality and curriculum suitability. Outcome-level mapping remains provisional.
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              <button type="button" style={{ ...button, opacity: !reviewConfirmed || busy ? 0.5 : 1 }} disabled={!reviewConfirmed || busy} onClick={()=>void approvePrivateReview()}>Record editorial review</button>
              <button type="button" style={{ ...button, background: "#64748b" }} disabled={busy} onClick={()=>{setReviewDraft(null);setReviewConfirmed(false)}}>Close review</button>
            </div>
          </section>}
        </section>

        <section style={surface}>
          <label style={labelStyle} htmlFor="exam-upload">1. Load your original paper</label>
          <input id="exam-upload" type="file" accept=".json,application/json" onChange={e=>void handleFile(e.target.files?.[0])}
            style={{ display: "block", maxWidth: "100%", padding: "8px 0 16px" }}/>
          <label style={labelStyle} htmlFor="exam-json">Or paste your paper JSON</label>
          <textarea id="exam-json" spellCheck={false} value={raw} onChange={e=>changeRaw(e.target.value)}
            placeholder={JSON.stringify(blank,null,2)}
            rows={14} style={{ width: "100%", boxSizing: "border-box", resize: "vertical", border: "1px solid #b8c6d8",
              borderRadius: 10, padding: 12, fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12, lineHeight: 1.6, color: "#12263f" }}/>
          {parsed.error && <p role="alert" style={{ color: "#b91c1c" }}>{parsed.error}</p>}
          <p style={{ marginTop: 10, fontSize: 13, color: "#57697e" }}>Each question needs a unique bank key, four options A–D, one correct answer, marks and an explanation. Existing published questions are rejected if duplicated exactly.</p>
          <button style={{ ...button, opacity: !parsed.paper || busy ? 0.5 : 1 }}
            disabled={!parsed.paper || busy} onClick={()=>void call(false)}>{busy ? "Checking…" : "2. Validate paper"}</button>
        </section>
        {preview && <section style={surface} aria-live="polite">
          <h2 style={{ marginTop: 0, fontSize: 20 }}>{preview.valid ? "Ready to publish" : "Fix before publishing"}</h2>
          {preview.valid ? <p><strong>{preview.title}</strong> · {preview.grade} · {preview.question_count} questions · {preview.total_marks} marks</p>
            : <ul style={{ color: "#b91c1c", paddingLeft: 20 }}>{(preview.issues || ["Validation failed"]).map((issue,i)=><li key={i}>{issue.replaceAll("_"," ")}</li>)}</ul>}
          {preview.already_exists && preview.assessment_id && <p>This title already exists (assessment {preview.assessment_id}). No duplicate was created.</p>}
          {preview.valid && <div style={{ display: "grid", gap: 14 }}>
            <p style={{ fontSize: 13, color: "#52647d" }}>This is original VibeSchool content, not an official KICD examination. Outcome verification remains provisional until independently documented.</p>
            <label style={{ display: "flex", alignItems: "start", gap: 10 }}>
              <input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} style={{ width: 20, height: 20 }} />
              <span>I have checked the answer keys, explanations and content rights, and approve publication as an original VibeSchool assessment with provisional curriculum mapping.</span>
            </label>
            <button disabled={!canPublish} style={{ ...button, background: "#11684f", opacity: canPublish ? 1 : 0.5 }}
              onClick={()=>void call(true)}>{busy ? "Publishing…" : "3. Publish to learners"}</button>
          </div>}
        </section>}
        {error && <section role="alert" style={{ ...surface, borderColor: "#dc2626", color: "#991b1b" }}>{error}</section>}
        {result?.published && <section style={{ ...surface, borderColor: "#1d956d" }} role="status">
          <h2 style={{ marginTop: 0 }}>Published</h2>
          <p><strong>{result.title}</strong> is available to eligible {result.grade} learners.</p>
          <p style={{ fontSize: 12, overflowWrap: "anywhere" }}>Assignment: {result.assignment_id}</p>
          <Link href={`/student/assessment/${result.assignment_id}`} style={{ color: "#1251a4", fontWeight: 700 }}>Open exam page</Link>
        </section>}
      </>}
    </div>
  </main>
}

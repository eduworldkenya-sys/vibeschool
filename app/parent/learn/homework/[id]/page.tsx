"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { TOKENS } from "@/lib/tokens";

interface AssignmentDetail {
  id: string;
  childOwner: string;
  title: string;
  subject: string;
  subjectIcon: string;
  dueDateString: string;
  totalPoints: number;
  status: "pending" | "overdue" | "completed";
  scoreEarned?: number;
  teacherName: string;
  instructions: string;
  parentCoachingTips: string[];
  durationMinutes: number;
  teacherComment?: string;
}

const MASTER_DICTIONARY: Record<string, AssignmentDetail> = {
  "hw-01": {
    id: "hw-01", childOwner: "Jaden", title: "Insha: Maisha ya Nyumbani na Shambani", subject: "Shughuli za Kiswahili", subjectIcon: "🌍", dueDateString: "Tomorrow at 8:00 AM", totalPoints: 20, status: "pending", teacherName: "Mwalimu Mwangi",
    instructions: "Andika insha ya kurasa moja kueleza shughuli mbalimbali unazofanya nyumbani kusaidia wazazi.",
    durationMinutes: 17,
    parentCoachingTips: [
      "Warm up — ask Jaden to name 3 farm tools in Kiswahili. (2 min)",
      "Draft — write one paragraph about home chores, one about farm work. (10 min)",
      "Review — read aloud together and check for words like 'jembe' and 'shamba'. (5 min)"
    ]
  },
  "hw-02": {
    id: "hw-02", childOwner: "Jaden", title: "Long Division & Remainders Workbook (Ex. 4B)", subject: "Mathematics Activities", subjectIcon: "📐", dueDateString: "May 25 at 1:00 PM", totalPoints: 50, status: "pending", teacherName: "Mr. Omondi",
    instructions: "Complete items 1 through 10 in Exercise 4B. Show remainders clearly as fractions.",
    durationMinutes: 20,
    parentCoachingTips: [
      "Review — test multiplication factors for 7 and 8 before starting.",
      "Check — ensure remainders are smaller than the divisor."
    ]
  },
  "hw-03": {
    id: "hw-03", childOwner: "Jaden", title: "Phonetics & Reading Fluency Audio Check", subject: "English Language Arts", subjectIcon: "📚", dueDateString: "Overdue (Passed May 21)", totalPoints: 30, status: "overdue", teacherName: "Mrs. Aliviza",
    instructions: "Read the poem on Page 14 aloud. Focus on punctuation pauses and blends like 'str' and 'thr'.",
    durationMinutes: 10,
    parentCoachingTips: [
      "Practice — read the poem once together before opening the recorder.",
      "Record — find a quiet room and minimize background noise."
    ]
  },
  "hw-04": {
    id: "hw-04", childOwner: "Jaden", title: "Metamorphosis Diagram & Labeling Project", subject: "Science & Environmental", subjectIcon: "🌱", dueDateString: "Completed on May 18", totalPoints: 40, status: "completed", scoreEarned: 38, teacherName: "Mr. Omondi",
    instructions: "Draw and label the four stages of a butterfly's lifecycle.",
    durationMinutes: 0,
    parentCoachingTips: ["Assignment completed and evaluated."],
    teacherComment: "Excellent diagrams, Jaden! Very neat labeling. Watch out for spelling on 'Chrysalis'."
  },
  "hw-05": {
    id: "hw-05", childOwner: "Liam", title: "Primary Color Mixing & Shading Canvas", subject: "Creative Arts Activities", subjectIcon: "🎨", dueDateString: "Overdue (Passed May 21)", totalPoints: 20, status: "overdue", teacherName: "Miss Mutua",
    instructions: "Mix primary watercolors to form secondary hues inside the geometric matrix template.",
    durationMinutes: 15,
    parentCoachingTips: [
      "Setup — keep clean water and paper towels nearby.",
      "Mix — demonstrate blending yellow and blue to create green on a scrap page first."
    ]
  },
  "hw-06": {
    id: "hw-06", childOwner: "Liam", title: "Number Patterns & Sequence Matching", subject: "Mathematics Activities", subjectIcon: "📐", dueDateString: "May 24 at 9:00 AM", totalPoints: 15, status: "pending", teacherName: "Mr. Omondi",
    instructions: "Fill in missing terms for arithmetic sequences counting up by 2s, 5s, and 10s.",
    durationMinutes: 12,
    parentCoachingTips: [
      "Count — practice skip-counting out loud up to 50 together.",
      "Write — use a pencil so changes can be made easily."
    ]
  }
};

export default function HomeworkBriefingFolder() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assignment = MASTER_DICTIONARY[id];
  const [submissionName, setSubmissionName] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  // Fix 1: Proper "Assignment Not Found" state instead of silent fallback
  if (!assignment) {
    return (
      <div style={{ maxWidth: "480px", margin: "40px auto", padding: "24px", textAlign: "center", fontFamily: TOKENS.fontFamily }}>
        <h2 style={{ fontFamily: TOKENS.fontHeader, fontSize: "22px", color: TOKENS.textPrimary }}>Assignment Not Found</h2>
        <p style={{ fontFamily: TOKENS.fontBody, fontSize: "14px", color: TOKENS.textMuted }}>The requested assignment record could not be found.</p>
        <button onClick={() => router.push("/parent/learn/homework")} style={{ backgroundColor: TOKENS.textPrimary, color: "#fff", border: "none", padding: "10px 20px", borderRadius: "12px", cursor: "pointer", fontWeight: "700", marginTop: "12px" }}>Return to Timeline</button>
      </div>
    );
  }

  const handleNativeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSubmissionName(e.target.files[0].name);
    }
  };

  const pct = assignment.scoreEarned ? Math.round((assignment.scoreEarned / assignment.totalPoints) * 100) : 0;

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "24px 16px", backgroundColor: TOKENS.bgDefault, minHeight: "100vh", fontFamily: TOKENS.fontFamily, color: TOKENS.textPrimary, WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" }}>
      
      {/* Navigation Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <button onClick={() => router.push("/parent/learn/homework")} style={{ background: TOKENS.bgCard, border: `1px solid ${TOKENS.borderDefault}`, borderRadius: "14px", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <span style={{ fontSize: "12px", fontWeight: "800", color: TOKENS.textMuted, fontFamily: TOKENS.fontBody }}>
          Assignment Detail • {assignment.childOwner}
        </span>
      </div>

      {/* Zone 1: The Brief Header */}
      <div style={{ 
        backgroundColor: assignment.status === "completed" ? TOKENS.completedBg : assignment.status === "overdue" ? TOKENS.overdueBg : TOKENS.pendingBg,
        border: `1px solid ${assignment.status === "completed" ? TOKENS.completedBorder : assignment.status === "overdue" ? TOKENS.overdueBorder : TOKENS.pendingBorder}`,
        borderRadius: TOKENS.radiusCard, padding: "20px", marginBottom: "20px"
      }}>
        <span style={{ fontSize: "11px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.5px", color: assignment.status === "completed" ? TOKENS.completedText : assignment.status === "overdue" ? TOKENS.overdueText : TOKENS.pendingText }}>
          {assignment.status === "completed" ? `Graded • ${pct}%` : assignment.status === "overdue" ? "Overdue" : "Assigned"}
        </span>
        <h1 style={{ fontFamily: TOKENS.fontHeader, fontSize: "22px", margin: "4px 0 0 0", color: TOKENS.textPrimary }}>{assignment.title}</h1>
        <p style={{ fontFamily: TOKENS.fontBody, fontSize: "13px", color: TOKENS.textMuted, margin: "4px 0 0 0" }}>{assignment.subject} • Due {assignment.dueDateString}</p>
      </div>

      {/* Task Description Card */}
      <div style={{ backgroundColor: TOKENS.bgCard, border: `1px solid ${TOKENS.borderDefault}`, borderRadius: TOKENS.radiusCard, padding: "16px", marginBottom: "20px" }}>
        <p style={{ margin: 0, fontSize: "14px", color: TOKENS.textPrimary, lineHeight: "1.5", fontFamily: TOKENS.fontBody }}>{assignment.instructions}</p>
      </div>

      {/* Zone 2: Your Playbook (Coaching Tips) */}
      <div style={{ background: "linear-gradient(135deg, #fffdf4, #f6faff)", border: `1px solid ${TOKENS.borderDefault}`, borderRadius: TOKENS.radiusCard, padding: "20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ fontFamily: TOKENS.fontHeader, fontSize: "16px", margin: 0 }}>Tonight's Plan for {assignment.childOwner}</h3>
          {assignment.durationMinutes > 0 && (
            <span style={{ fontSize: "12px", fontWeight: "700", color: TOKENS.textMuted, fontFamily: TOKENS.fontBody }}>~{assignment.durationMinutes} mins</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {assignment.parentCoachingTips.map((tip, index) => (
            <div key={index} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "13px", fontWeight: "800", color: TOKENS.textMuted }}>{index + 1}.</span>
              <p style={{ margin: 0, fontSize: "13.5px", color: TOKENS.textPrimary, fontFamily: TOKENS.fontBody, lineHeight: "1.4" }}>{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Zone 3: Actions (Submission & Correspondence) */}
      {assignment.status !== "completed" && (
        <div style={{ backgroundColor: TOKENS.bgCard, border: `1px solid ${TOKENS.borderDefault}`, borderRadius: TOKENS.radiusCard, padding: "16px", marginBottom: "20px" }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: "800", textTransform: "uppercase", color: TOKENS.textMuted }}>Upload Submission</h4>
          
          {/* Hidden HTML5 Native Pickers */}
          <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleNativeFileChange} style={{ display: "none" }} />
          <input type="file" accept=".pdf" ref={fileInputRef} onChange={handleNativeFileChange} style={{ display: "none" }} />

          {submissionName ? (
            <div style={{ backgroundColor: TOKENS.completedBg, color: TOKENS.completedText, padding: "12px", borderRadius: "12px", textAlign: "center", fontSize: "13px", fontWeight: "700" }}>
              ✓ Selected: {submissionName} (Ready to send)
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => cameraInputRef.current?.click()} style={{ flex: 1, backgroundColor: TOKENS.textPrimary, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "13px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                📸 Take Photo
              </button>
              <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, backgroundColor: "#f1f5f9", color: TOKENS.textPrimary, border: `1px solid ${TOKENS.borderDefault}`, borderRadius: "12px", padding: "12px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                📎 Choose PDF
              </button>
            </div>
          )}
        </div>
      )}

      {assignment.status === "completed" && assignment.teacherComment && (
        <div style={{ backgroundColor: TOKENS.bgCard, border: `1px solid ${TOKENS.borderDefault}`, borderRadius: TOKENS.radiusCard, padding: "16px", marginBottom: "20px" }}>
          <h4 style={{ margin: "0 0 6px 0", fontSize: "12px", fontWeight: "800", textTransform: "uppercase", color: TOKENS.textMuted }}>Teacher Feedback</h4>
          <p style={{ margin: 0, fontSize: "14px", color: TOKENS.textPrimary, fontStyle: "italic", lineHeight: "1.5", borderLeft: `3px solid ${TOKENS.completedBorder}`, paddingLeft: "10px" }}>
            "{assignment.teacherComment}"
          </p>
        </div>
      )}

      {/* Communications Portal Action Block */}
      <div style={{ backgroundColor: TOKENS.bgCard, border: `1px solid ${TOKENS.borderDefault}`, borderRadius: TOKENS.radiusCard, padding: "16px" }}>
        <h4 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: "800", textTransform: "uppercase", color: TOKENS.textMuted }}>Contact {assignment.teacherName}</h4>
        
        {draftMessage ? (
          /* Fix 5: textCenter typo resolved cleanly here */
          <div style={{ backgroundColor: "#eff6ff", color: TOKENS.linkBlue, padding: "12px", borderRadius: "12px", fontSize: "13px", fontWeight: "700", textAlign: "center" }}>
            Draft created! Copying text to your messaging portal...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button 
              onClick={() => setDraftMessage(`Hi ${assignment.teacherName}, could you share an extra sample resource for this task?`)}
              style={{ textAlign: "left", background: "none", border: "1px solid #f1f5f9", padding: "10px 12px", borderRadius: "10px", fontSize: "13px", color: TOKENS.linkBlue, fontWeight: "600", cursor: "pointer" }}
            >
              Draft question about instructions
            </button>
            {assignment.status === "overdue" && (
              <button 
                /* Fix 4: Correctly dynamically interpolates childOwner attribute instead of forcing Jaden */
                onClick={() => setDraftMessage(`Hi ${assignment.teacherName}, I wanted to let you know ${assignment.childOwner} is completing this tonight.`)}
                style={{ textAlign: "left", background: "none", border: "1px solid #f1f5f9", padding: "10px 12px", borderRadius: "10px", fontSize: "13px", color: TOKENS.linkBlue, fontWeight: "600", cursor: "pointer" }}
              >
                Draft extension request note
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

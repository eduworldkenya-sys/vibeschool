import { PulseSnapshot } from "./fetcher";

export interface RulesOutput {
  message: string;
  confidence: number;
  priority: "critical" | "urgent" | "normal" | "calm";
  signals: string[];
}

export function runRules(data: PulseSnapshot): RulesOutput {
  const signals: string[] = [];
  let confidence = 0;
  let priority: RulesOutput["priority"] = "calm";
  let message = "";

  // Rule 1 — Attendance not marked (CRITICAL)
  if (data.attPending.length > 0) {
    signals.push(`attendance_pending:${data.attPending.length}`);
    confidence += 40;
    priority = "critical";
    message = `${data.attPending.map(c => c.class_name).join(", ")} — attendance not marked yet.`;
  }

  // Rule 2 — TPAD deadline close (URGENT)
  if (data.tpadDays !== null && data.tpadDays <= 7) {
    signals.push(`tpad_due:${data.tpadDays}d`);
    confidence += 30;
    if (priority !== "critical") priority = "urgent";
    if (!message) message = `TPAD self-appraisal due in ${data.tpadDays} day${data.tpadDays === 1 ? "" : "s"}.`;
  }

  // Rule 3 — At-risk students (URGENT)
  if (data.atRisk.length > 0) {
    signals.push(`at_risk:${data.atRisk.length}`);
    confidence += 25;
    if (priority === "calm") priority = "urgent";
    if (!message) message = `${data.atRisk[0].name} has ${data.atRisk[0].reason}. Check in today.`;
  }

  // Rule 4 — Curriculum behind (NORMAL)
  const behind = data.currStats.filter(s => s.total > 0 && (s.covered / s.total) < 0.4);
  if (behind.length > 0) {
    signals.push(`curriculum_behind:${behind.map(s => s.subject).join(",")}`);
    confidence += 20;
    if (priority === "calm") priority = "normal";
    if (!message) message = `${behind[0].subject} is at ${Math.round((behind[0].covered / behind[0].total) * 100)}% coverage. Consider catching up this week.`;
  }

  // Rule 5 — Credits low (NORMAL)
  if (data.credits !== null && data.credits <= 3) {
    signals.push(`credits_low:${data.credits}`);
    confidence += 15;
    if (priority === "calm") priority = "normal";
    if (!message) message = `Only ${data.credits} credit${data.credits === 1 ? "" : "s"} left. Top up before generating plans.`;
  }

  // Rule 6 — No lessons today (CALM)
  if (data.todaySlots.length === 0 && signals.length === 0) {
    signals.push("no_lessons");
    confidence = 90;
    message = "No lessons scheduled today. Good time to plan ahead or update your scheme.";
  }

  // Rule 7 — All clear (CALM)
  if (signals.length === 0) {
    confidence = 85;
    const h = new Date().getHours();
    message = h < 12
      ? "All clear this morning. Focus on delivering great lessons today."
      : h < 17
      ? "Afternoon looking clean. Good time to update your scheme."
      : "Day done well. Log anything worth remembering before you close.";
  }

  return { message, confidence, priority, signals };
}

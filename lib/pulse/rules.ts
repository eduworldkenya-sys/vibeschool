import { PulseSnapshot } from "./fetcher";

export interface RulesOutput {
  message: string;
  confidence: number;
  priority: "critical" | "urgent" | "normal" | "calm";
  signals: string[];
  upcomingWarning: string | null;
}

export function runRules(data: PulseSnapshot): RulesOutput {
  const signals: string[] = [];
  let confidence = 0;
  let priority: RulesOutput["priority"] = "calm";
  let message = "";
  let upcomingWarning: string | null = null;

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  // Rule 1 — Attendance not marked (CRITICAL)
  if (data.attPending.length > 0) {
    signals.push(`attendance_pending:${data.attPending.length}`);
    confidence += 40;
    priority = "critical";
    message = `${data.attPending.map(c => c.class_name).join(", ")} — attendance not marked yet.`;
  }

  // Rule 1b — Lesson starting in 10 minutes, warn early (PREDICTIVE)
  if (data.attPending.length === 0 && data.todaySlots.length > 0) {
    const nextUnmarked = data.todaySlots.find(s => {
      const [h, m] = s.start_time.split(":").map(Number);
      const slotMins = h * 60 + m;
      return slotMins > nowMins && slotMins - nowMins <= 10;
    });
    if (nextUnmarked) {
      upcomingWarning = `${nextUnmarked.class_name} starts in under 10 minutes — get ready to mark attendance.`;
      signals.push(`lesson_imminent:${nextUnmarked.class_name}`);
    }
  }

  // Rule 2 — TPAD deadline close (URGENT)
  if (data.tpadDays !== null && data.tpadDays <= 7) {
    signals.push(`tpad_due:${data.tpadDays}d`);
    confidence += 30;
    if (priority !== "critical") priority = "urgent";
    if (!message) message = `TPAD self-appraisal due in ${data.tpadDays} day${data.tpadDays === 1 ? "" : "s"}. Don't leave it to the last hour.`;
  }

  // Rule 3 — At-risk students with pattern detection
  if (data.atRisk.length > 0) {
    signals.push(`at_risk:${data.atRisk.length}`);
    confidence += 25;
    if (priority === "calm") priority = "urgent";
    const top = data.atRisk[0];
    const count = parseInt(top.reason.match(/\d+/)?.[0] ?? "3");
    if (!message) {
      message = count >= 7
        ? `${top.name} has missed ${count} lessons this term — this is a pattern, not bad luck. Act today.`
        : `${top.name} has ${top.reason}. A quick check-in could make a difference.`;
    }
  }

  // Rule 4 — Curriculum critically behind
  const behind = data.currStats.filter(s => s.total > 0 && (s.covered / s.total) < 0.4);
  const termPct = data.termProgressPct ?? 50;
  if (behind.length > 0) {
    signals.push(`curriculum_behind:${behind.map(s => s.subject).join(",")}`);
    confidence += 20;
    if (priority === "calm") priority = "normal";
    if (!message) {
      const pct = Math.round((behind[0].covered / behind[0].total) * 100);
      message = termPct > 60
        ? `${behind[0].subject} is at ${pct}% but the term is ${Math.round(termPct)}% done — you need to accelerate.`
        : `${behind[0].subject} coverage is at ${pct}%. Still time to catch up this term.`;
    }
  }

  // Rule 5 — Credits low
  if (data.credits !== null && data.credits <= 3) {
    signals.push(`credits_low:${data.credits}`);
    confidence += 15;
    if (priority === "calm") priority = "normal";
    if (!message) message = `Only ${data.credits} credit${data.credits === 1 ? "" : "s"} left. Top up before generating plans.`;
  }

  // Rule 6 — Streak recognition
  if (data.streak && data.streak >= 5 && signals.length === 0) {
    signals.push(`streak:${data.streak}`);
    confidence = 88;
    message = `${data.streak} days straight. That kind of consistency is what students remember years later.`;
  }

  // Rule 7 — No lessons today
  if (data.todaySlots.length === 0 && signals.length === 0) {
    signals.push("no_lessons");
    confidence = 90;
    message = "No lessons today. Use the time to plan next week or update your scheme of work.";
  }

  // Rule 8 — All clear
  if (signals.length === 0) {
    confidence = 85;
    const h = now.getHours();
    message = h < 10
      ? "Early start — you're ahead of most teachers today."
      : h < 12
      ? "Morning looking clean. Deliver something memorable in your next lesson."
      : h < 14
      ? "Halfway through. Keep the energy up."
      : h < 17
      ? "Afternoon — the hardest shift. You've got it."
      : "Day done well. A few notes now saves an hour tomorrow.";
  }

  return { message, confidence, priority, signals, upcomingWarning };
}

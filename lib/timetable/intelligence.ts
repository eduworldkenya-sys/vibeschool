import type { CanonicalTimetableSlot, TeacherWeeklyTimetableLoad } from "@/lib/timetable/engine";

export type TimetableIntelligenceSeverity = "blocking" | "warning" | "healthy";

export interface TimetableIntelligenceFinding {
  code:
    | "UNSCHEDULED_OBLIGATION"
    | "UNDER_ALLOCATED"
    | "OVER_ALLOCATED"
    | "ALLOCATION_UNKNOWN"
    | "POOR_DISTRIBUTION"
    | "EXCESS_DAILY_UNITS";
  severity: TimetableIntelligenceSeverity;
  classId: string;
  subjectId: string;
  message: string;
}

export interface TimetableIntelligenceReport {
  readyToPublish: boolean;
  findings: TimetableIntelligenceFinding[];
}

export function evaluateTeacherTimetable(
  loads: readonly TeacherWeeklyTimetableLoad[],
  slots: readonly CanonicalTimetableSlot[],
): TimetableIntelligenceReport {
  const findings: TimetableIntelligenceFinding[] = [];

  for (const load of loads) {
    if (load.status === "ZERO") {
      findings.push({
        code: "UNSCHEDULED_OBLIGATION",
        severity: "blocking",
        classId: load.class_id,
        subjectId: load.subject_id,
        message: `${load.subject_name} · ${load.class_name} has no recurring timetable placement.`,
      });
    } else if (load.status === "UNDER") {
      findings.push({
        code: "UNDER_ALLOCATED",
        severity: "blocking",
        classId: load.class_id,
        subjectId: load.subject_id,
        message: `${load.subject_name} · ${load.class_name} is below its weekly allocation.`,
      });
    } else if (load.status === "OVER") {
      findings.push({
        code: "OVER_ALLOCATED",
        severity: "blocking",
        classId: load.class_id,
        subjectId: load.subject_id,
        message: `${load.subject_name} · ${load.class_name} exceeds its weekly allocation.`,
      });
    } else if (load.status === "NO_TARGET") {
      findings.push({
        code: "ALLOCATION_UNKNOWN",
        severity: "warning",
        classId: load.class_id,
        subjectId: load.subject_id,
        message: `${load.subject_name} · ${load.class_name} has no authoritative weekly target.`,
      });
    }

    const subjectSlots = slots.filter(
      slot => slot.class_id === load.class_id && slot.subject_id === load.subject_id,
    );
    const days = new Set(subjectSlots.map(slot => slot.day_of_week));
    const scheduledUnits = subjectSlots.reduce((sum, slot) => sum + Number(slot.allocation_units || 1), 0);

    if (subjectSlots.length >= 3 && days.size <= 2) {
      findings.push({
        code: "POOR_DISTRIBUTION",
        severity: "warning",
        classId: load.class_id,
        subjectId: load.subject_id,
        message: `${load.subject_name} · ${load.class_name} is concentrated into only ${days.size} teaching day${days.size === 1 ? "" : "s"}.`,
      });
    }

    const daily = new Map<number, number>();
    for (const slot of subjectSlots) {
      daily.set(slot.day_of_week, (daily.get(slot.day_of_week) ?? 0) + Number(slot.allocation_units || 1));
    }
    if ([...daily.values()].some(units => units > 2) && scheduledUnits > 2) {
      findings.push({
        code: "EXCESS_DAILY_UNITS",
        severity: "warning",
        classId: load.class_id,
        subjectId: load.subject_id,
        message: `${load.subject_name} · ${load.class_name} has more than two allocation units on one day.`,
      });
    }
  }

  return {
    readyToPublish: !findings.some(finding => finding.severity === "blocking"),
    findings,
  };
}

import type { CanonicalTimetableSlot, TeacherWeeklyTimetableLoad, TimetableConflict } from "@/lib/timetable/engine";

export type ConstraintSeverity = "hard" | "soft";

export interface TimetableConstraint {
  code: string;
  severity: ConstraintSeverity;
  message: string;
  classId?: string;
  subjectId?: string;
  teacherId?: string | null;
  slotId?: string;
}

export interface SubjectSchedulingRule {
  classId: string;
  subjectId: string;
  maxUnitsPerDay?: number;
  minTeachingDays?: number;
  requiresConsecutiveUnits?: number;
  requiredRoomType?: string;
  preferredDayParts?: Array<"morning" | "afternoon">;
  maxTeacherConsecutiveUnits?: number;
}

export interface TeacherAvailabilityRule {
  teacherId: string;
  dayOfWeek: number;
  unavailableFrom: string;
  unavailableUntil: string;
}

export interface CalendarException {
  date: string;
  kind: "holiday" | "closure" | "exam" | "event";
  suppressOrdinaryTeaching: boolean;
}

const minutes = (value: string) => {
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  minutes(aStart) < minutes(bEnd) && minutes(aEnd) > minutes(bStart);

export function evaluateModernTimetable(input: {
  slots: readonly CanonicalTimetableSlot[];
  loads: readonly TeacherWeeklyTimetableLoad[];
  conflicts?: readonly TimetableConflict[];
  subjectRules?: readonly SubjectSchedulingRule[];
  teacherAvailability?: readonly TeacherAvailabilityRule[];
}): TimetableConstraint[] {
  const findings: TimetableConstraint[] = [];

  for (const load of input.loads) {
    if (load.status === "ZERO" || load.status === "UNDER" || load.status === "OVER") {
      findings.push({
        code: `ALLOCATION_${load.status}`,
        severity: "hard",
        classId: load.class_id,
        subjectId: load.subject_id,
        message: `${load.subject_name} · ${load.class_name}: weekly allocation is ${load.status.toLowerCase()}.`,
      });
    }
    if (load.status === "NO_TARGET") {
      findings.push({
        code: "ALLOCATION_UNKNOWN",
        severity: "soft",
        classId: load.class_id,
        subjectId: load.subject_id,
        message: `${load.subject_name} · ${load.class_name}: weekly allocation target is unknown.`,
      });
    }
  }

  for (const conflict of input.conflicts ?? []) {
    findings.push({
      code: conflict.conflict_type,
      severity: "hard",
      classId: conflict.conflicting_class_id,
      subjectId: conflict.conflicting_subject_id,
      teacherId: conflict.conflicting_teacher_id,
      slotId: conflict.conflicting_slot_id,
      message: conflict.detail,
    });
  }

  for (const availability of input.teacherAvailability ?? []) {
    for (const slot of input.slots) {
      if (
        slot.teacher_id === availability.teacherId &&
        slot.day_of_week === availability.dayOfWeek &&
        overlaps(slot.start_time, slot.end_time, availability.unavailableFrom, availability.unavailableUntil)
      ) {
        findings.push({
          code: "TEACHER_UNAVAILABLE",
          severity: "hard",
          classId: slot.class_id,
          subjectId: slot.subject_id,
          teacherId: slot.teacher_id,
          slotId: slot.id,
          message: "Lesson overlaps a teacher unavailable period.",
        });
      }
    }
  }

  for (const rule of input.subjectRules ?? []) {
    const slots = input.slots.filter(s => s.class_id === rule.classId && s.subject_id === rule.subjectId);
    const byDay = new Map<number, CanonicalTimetableSlot[]>();
    for (const slot of slots) byDay.set(slot.day_of_week, [...(byDay.get(slot.day_of_week) ?? []), slot]);

    if (rule.minTeachingDays && byDay.size < rule.minTeachingDays) {
      findings.push({
        code: "SUBJECT_SPREAD",
        severity: "soft",
        classId: rule.classId,
        subjectId: rule.subjectId,
        message: `Subject is spread across ${byDay.size} days; preferred minimum is ${rule.minTeachingDays}.`,
      });
    }

    if (rule.maxUnitsPerDay) {
      for (const [day, daySlots] of byDay) {
        const units = daySlots.reduce((sum, slot) => sum + Number(slot.allocation_units || 1), 0);
        if (units > rule.maxUnitsPerDay) findings.push({
          code: "MAX_DAILY_UNITS",
          severity: "hard",
          classId: rule.classId,
          subjectId: rule.subjectId,
          message: `Day ${day} has ${units} units; maximum is ${rule.maxUnitsPerDay}.`,
        });
      }
    }

    if (rule.requiresConsecutiveUnits && rule.requiresConsecutiveUnits > 1) {
      const hasConsecutive = [...byDay.values()].some(daySlots => {
        const ordered = [...daySlots].sort((a,b) => minutes(a.start_time) - minutes(b.start_time));
        let run = 1;
        for (let i=1;i<ordered.length;i++) {
          if (minutes(ordered[i-1].end_time) === minutes(ordered[i].start_time)) run += 1;
          else run = 1;
          if (run >= rule.requiresConsecutiveUnits!) return true;
        }
        return ordered.some(slot => Number(slot.allocation_units || 1) >= rule.requiresConsecutiveUnits!);
      });
      if (!hasConsecutive) findings.push({
        code: "CONSECUTIVE_REQUIREMENT",
        severity: "hard",
        classId: rule.classId,
        subjectId: rule.subjectId,
        message: `Subject requires ${rule.requiresConsecutiveUnits} consecutive units.`,
      });
    }

    if (rule.requiredRoomType) {
      for (const slot of slots) {
        if (!slot.room) findings.push({
          code: "RESOURCE_REQUIRED", severity: "hard", classId: rule.classId, subjectId: rule.subjectId, slotId: slot.id,
          message: `Subject requires a ${rule.requiredRoomType} resource.`,
        });
      }
    }

    if (rule.preferredDayParts?.length) {
      for (const slot of slots) {
        const part = minutes(slot.start_time) < 12 * 60 ? "morning" : "afternoon";
        if (!rule.preferredDayParts.includes(part)) findings.push({
          code: "DAY_PART_PREFERENCE",
          severity: "soft",
          classId: rule.classId,
          subjectId: rule.subjectId,
          slotId: slot.id,
          message: `Placement is outside preferred ${rule.preferredDayParts.join("/")} teaching time.`,
        });
      }
    }
  }

  const teacherDays = new Map<string, CanonicalTimetableSlot[]>();
  for (const slot of input.slots) {
    const key = `${slot.teacher_id}::${slot.day_of_week}`;
    teacherDays.set(key, [...(teacherDays.get(key) ?? []), slot]);
  }
  for (const [key, teacherSlots] of teacherDays) {
    const ordered=[...teacherSlots].sort((a,b)=>minutes(a.start_time)-minutes(b.start_time));
    let run=1, maxRun=1;
    for(let i=1;i<ordered.length;i++){ run=minutes(ordered[i-1].end_time)===minutes(ordered[i].start_time)?run+1:1; maxRun=Math.max(maxRun,run); }
    if(maxRun>4) findings.push({code:"TEACHER_CONSECUTIVE_LOAD",severity:"soft",teacherId:ordered[0]?.teacher_id,message:`Teacher has ${maxRun} consecutive lessons on day ${ordered[0]?.day_of_week}.`});
  }

  return findings;
}

export function canPublishTimetable(findings: readonly TimetableConstraint[]): boolean {
  return !findings.some(f => f.severity === "hard");
}

export function shouldGenerateOccurrence(date: string, exceptions: readonly CalendarException[]): boolean {
  return !exceptions.some(e => e.date === date && e.suppressOrdinaryTeaching);
}

export interface PlacementCandidate {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  periodId?: string | null;
  room?: string | null;
}

export function rankPlacementCandidates(
  candidates: readonly PlacementCandidate[],
  occupied: readonly CanonicalTimetableSlot[],
  rule?: SubjectSchedulingRule,
): PlacementCandidate[] {
  return candidates
    .filter(candidate => !occupied.some(slot =>
      slot.day_of_week === candidate.dayOfWeek &&
      overlaps(slot.start_time, slot.end_time, candidate.startTime, candidate.endTime)
    ))
    .map(candidate => ({
      candidate,
      score:
        (rule?.preferredDayParts?.includes(minutes(candidate.startTime) < 720 ? "morning" : "afternoon") ? 10 : 0)
        - occupied.filter(slot => slot.day_of_week === candidate.dayOfWeek).length,
    }))
    .sort((a,b) => b.score - a.score || a.candidate.dayOfWeek - b.candidate.dayOfWeek || minutes(a.candidate.startTime)-minutes(b.candidate.startTime))
    .map(row => row.candidate);
}

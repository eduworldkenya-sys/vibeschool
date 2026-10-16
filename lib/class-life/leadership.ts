import { supabase } from "@/lib/supabase";

// This is a transport adapter, not a second learner/leadership authority.
// All writes/read scopes are enforced by the canonical PostgreSQL functions.
// The adapter must not be used until its staged migration is deployed.
export type ClassLeadershipRole = "representative" | "deputy" | "prefect" | "group_leader";
export type ClassLeadershipRow = {
  id: string;
  student_id: string;
  student_name: string;
  role: ClassLeadershipRole;
  group_id: string | null;
  starts_on: string;
  ends_on: string;
};

export type ClassLeadershipSnapshot = {
  current: ClassLeadershipRow[];
  upcoming: ClassLeadershipRow[];
  termEndOn: string | null;
};

export type LearnerLeadershipHistory = {
  id: string;
  role: ClassLeadershipRole;
  group_id: string | null;
  starts_on: string;
  ends_on: string;
  ended_at: string | null;
  ended_reason: "replaced" | "resigned" | "removed" | "completed" | null;
  handover_request_id: string | null;
  handover_scheduled_at: string | null;
};

const ROLE_CODES: ReadonlySet<string> = new Set([
  "representative", "deputy", "prefect", "group_leader",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseLeadershipRow(value: unknown): ClassLeadershipRow {
  if (!isObject(value) || typeof value.id !== "string" ||
    typeof value.student_id !== "string" ||
    typeof value.student_name !== "string" ||
    typeof value.role !== "string" || !ROLE_CODES.has(value.role) ||
    typeof value.starts_on !== "string" || typeof value.ends_on !== "string" ||
    !(value.group_id === null || typeof value.group_id === "string")) {
    throw new Error("School leadership data could not be verified.");
  }
  return {
    id: value.id, student_id: value.student_id, student_name: value.student_name,
    role: value.role as ClassLeadershipRole, group_id: value.group_id as string | null,
    starts_on: value.starts_on, ends_on: value.ends_on,
  };
}

type LeadershipRpc = "school_get_class_leadership" | "school_get_learner_leadership" | "school_appoint_class_learner" | "school_end_class_learner_appointment";
async function callLeadershipRpc(functionName: LeadershipRpc, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function getClassLeadership(classId: string): Promise<ClassLeadershipSnapshot> {
  if (!classId) throw new Error("A class is required.");
  const result = await callLeadershipRpc("school_get_class_leadership", {p_class_id: classId});
  if (!isObject(result) || !Array.isArray(result.current) || !Array.isArray(result.upcoming)) {
    throw new Error("School leadership response is invalid.");
  }
  return {
    termEndOn: typeof result.term_end_on === "string" ? result.term_end_on : null,
    current: result.current.map(parseLeadershipRow),
    upcoming: result.upcoming.map(parseLeadershipRow),
  };
}

export async function getLearnerLeadershipHistory(
  classId: string, studentId: string
): Promise<LearnerLeadershipHistory[]> {
  if (!classId || !studentId) throw new Error("A class and enrolled learner are required.");
  const result = await callLeadershipRpc("school_get_learner_leadership", {
    p_class_id: classId, p_student_id: studentId,
  });
  if (!Array.isArray(result)) throw new Error("Learner leadership history is invalid.");
  return result.map(row => {
    if (!isObject(row) || typeof row.id !== "string" ||
      typeof row.role !== "string" || !ROLE_CODES.has(row.role) ||
      typeof row.starts_on !== "string" || typeof row.ends_on !== "string") {
      throw new Error("Learner leadership history contains an invalid record.");
    }
    return {
      id: row.id, role: row.role as ClassLeadershipRole,
      group_id: typeof row.group_id === "string" ? row.group_id : null,
      starts_on: row.starts_on, ends_on: row.ends_on,
      ended_at: typeof row.ended_at === "string" ? row.ended_at : null,
      handover_request_id: typeof row.handover_request_id === "string" ? row.handover_request_id : null,
      handover_scheduled_at: typeof row.handover_scheduled_at === "string" ? row.handover_scheduled_at : null,
      ended_reason:
        row.ended_reason === "replaced" || row.ended_reason === "resigned" ||
        row.ended_reason === "removed" || row.ended_reason === "completed"
          ? row.ended_reason : null,
    };
  });
}

export async function appointClassLearner(input: {
  classId: string; studentId: string; role: ClassLeadershipRole;
  startsOn: string; endsOn: string; groupId: string | null; requestId: string;
}): Promise<string> {
  if (!input.classId || !input.studentId || !input.startsOn || !input.endsOn || !input.requestId) {
    throw new Error("Complete the learner appointment before saving.");
  }
  const result = await callLeadershipRpc("school_appoint_class_learner", {
    p_class_id: input.classId,
    p_student_id: input.studentId,
    p_role_code: input.role,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_group_id: input.groupId,
    p_request_id: input.requestId,
  });
  if (typeof result !== "string") throw new Error("The appointment was not confirmed.");
  return result;
}

export async function endClassLearnerAppointment(
  appointmentId: string, reason: "resigned" | "removed" | "completed",
): Promise<string> {
  if (!appointmentId) throw new Error("Select an appointment.");
  const result = await callLeadershipRpc("school_end_class_learner_appointment", {
    p_appointment_id: appointmentId, p_reason: reason,
  });
  if (typeof result !== "string") throw new Error("The appointment end was not confirmed.");
  return result;
}

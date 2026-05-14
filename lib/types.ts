// ─── TEACHER MODULE TYPES ─────────────────────────────────────────────────

export type EmploymentType =
  | "Permanent"
  | "Contract"
  | "TSC Posted"
  | "BOM"
  | "Intern"
  | "Volunteer"
  | "Supply Teacher";

export type DesignationType =
  | "Class Teacher"
  | "Subject Teacher"
  | "HOD"
  | "Deputy Principal"
  | "Principal"
  | "Support Staff";

export type SystemRole = "Teacher" | "HOD" | "Admin" | "Super Admin";

export type DocumentStatus = "valid" | "expiring" | "missing" | "expired";

export type LeaveType =
  | "Annual"
  | "Sick"
  | "Maternity"
  | "Paternity"
  | "Compassionate"
  | "Study"
  | "TSC-Directed"
  | "Unpaid"
  | "Sabbatical";

export type LeaveStatus = "Pending" | "Approved" | "Rejected";

export type AppraisalStatus =
  | "not started"
  | "in progress"
  | "submitted"
  | "reviewed";

export type PDType =
  | "Workshop"
  | "Seminar"
  | "Conference"
  | "Online course"
  | "School-based training"
  | "Mentorship"
  | "Coaching";

export interface TeacherDocument {
  name: string;
  status: DocumentStatus;
  expiryDate?: string;
  uploaded: boolean;
}

export interface PDEntry {
  id: string;
  title: string;
  type: PDType;
  provider: string;
  durationHours: number;
  dateAttended: string;
  topics: string[];
  certificateUploaded: boolean;
  pdPoints?: number;
  relevance: "High" | "Medium" | "Low";
  keyTakeaway: string;
}

export interface LeaveEntry {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: LeaveStatus;
  approvedBy?: string;
}

export interface TimetablePeriod {
  periodNumber: number;
  subject: string;
  class: string;
  room: string;
  startTime: string;
  endTime: string;
}

export interface TeacherAlert {
  id: string;
  type: "warning" | "info" | "urgent" | "success";
  message: string;
  action?: string;
  actionHref?: string;
}

export interface TeacherSubjectAssignment {
  subject: string;
  classes: string[];
  periodsPerWeek: number;
}

export interface Qualification {
  id: string;
  name: string;
  institution: string;
  country: string;
  startYear: number;
  endYear: number;
  grade: string;
  certificateUploaded: boolean;
  verificationStatus: "verified" | "pending" | "failed";
}

export interface TeacherProfile {
  // Identity
  id: string;
  staffNumber: string;
  fullName: string;
  preferredName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  nationalId: string;
  tscNumber: string;
  kraPin: string;
  nssfNumber: string;
  nhifNumber: string;
  bloodGroup: string;
  photoUrl?: string;
  personalEmail: string;
  personalPhone: string;
  whatsappNumber?: string;
  homeAddress: {
    county: string;
    subCounty: string;
    ward: string;
    estate: string;
  };

  // Emergency Contact
  emergencyContact: {
    fullName: string;
    relationship: string;
    phonePrimary: string;
    phoneSecondary?: string;
    address: string;
  };

  // Professional
  employmentType: EmploymentType;
  employmentStartDate: string;
  contractEndDate?: string;
  jobGroup: string;
  designation: DesignationType;
  secondaryRoles: string[];
  systemRole: SystemRole;
  department: string;
  secondDepartment?: string;
  school: string;
  payrollCategory: "TSC payroll" | "School payroll";

  // Teaching assignment
  subjectAssignments: TeacherSubjectAssignment[];
  classTeacherOf?: string;
  totalPeriodsPerWeek: number;
  maxAllowedPeriods: number;

  // Qualifications
  qualifications: Qualification[];
  teachingSpecialisms: string[];
  cbcTrainingCompleted: boolean;

  // Documents
  documents: TeacherDocument[];

  // PD
  pdHistory: PDEntry[];
  annualPdHoursTarget: number;
  pdHoursCompleted: number;

  // Appraisal
  appraisalStatus: AppraisalStatus;
  lastAppraisalDate?: string;
  lastAppraisalScore?: number;
  nextAppraisalDue?: string;

  // Stats
  lessonsThisTerm: number;
  lessonPlanPrepRate: number;
  avgAssessmentTurnaround: number;
  classesAssignedThisTerm: number;
  attendanceRateThisTerm: number;
  leaveEntitlement: number;
  leaveTaken: number;

  // Twin profile
  twinSummary: string;
  twinObservations: {
    mostUsedStructure: string;
    avgPrepTime: number;
    prepRate: number;
    commonReflectionThemes: string[];
    highestRatedConditions: string;
    weakestDeliveryArea: string;
    strongestDeliveryArea: string;
  };

  // Alerts
  alerts: TeacherAlert[];

  // Today's schedule
  todaySchedule: TimetablePeriod[];

  // Finance reference
  payrollNumber: string;
  bankName: string;
  bankAccountMasked: string;

  // Disciplinary (admin only — not rendered in teacher view)
  disciplinaryStatus: "clear" | "warning" | "final warning" | "under investigation";
}

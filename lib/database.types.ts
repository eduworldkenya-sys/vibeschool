Warning: truncated output (original token count: 155569)
Total output lines: 20363

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academic_terms: {
        Row: {
          academic_year: number
          created_at: string | null
          end_date: string
          id: string
          name: string
          school_id: string
          start_date: string
          status: string
          term: number
          updated_at: string | null
        }
        Insert: {
          academic_year: number
          created_at?: string | null
          end_date: string
          id?: string
          name: string
          school_id: string
          start_date: string
          status?: string
          term: number
          updated_at?: string | null
        }
        Update: {
          academic_year?: number
          created_at?: string | null
          end_date?: string
          id?: string
          name?: string
          school_id?: string
          start_date?: string
          status?: string
          term?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_announcements: {
        Row: {
          audience: string
          body: string
          class_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          scheduled_at: string | null
          school_id: string
          sent: boolean
          sent_at: string | null
          title: string
        }
        Insert: {
          audience: string
          body: string
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          scheduled_at?: string | null
          school_id: string
          sent?: boolean
          sent_at?: string | null
          title: string
        }
        Update: {
          audience?: string
          body?: string
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          scheduled_at?: string | null
          school_id?: string
          sent?: boolean
          sent_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_expenses: {
        Row: {
          amount: number
          approved: boolean
          approved_by: string | null
          category: string
          created_at: string
          deleted_at: string | null
          description: string
          expense_date: string
          id: string
          project_id: string | null
          receipt_ref: string | null
          school_id: string
          submitted_by: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          approved?: boolean
          approved_by?: string | null
          category: string
          created_at?: string
          deleted_at?: string | null
          description: string
          expense_date?: string
          id?: string
          project_id?: string | null
          receipt_ref?: string | null
          school_id: string
          submitted_by?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          approved?: boolean
          approved_by?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          expense_date?: string
          id?: string
          project_id?: string | null
          receipt_ref?: string | null
          school_id?: string
          submitted_by?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "admin_expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_expenses_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_expenses_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_meeting_actions: {
        Row: {
          action: string
          assigned_to: string
          created_at: string
          due_date: string | null
          id: string
          meeting_id: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          action: string
          assigned_to: string
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          assigned_to?: string
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_meeting_actions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "admin_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_meeting_actions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_meeting_attendees: {
        Row: {
          attended: boolean | null
          created_at: string
          id: string
          meeting_id: string
          name: string
          profile_id: string | null
          role: string | null
          rsvp: string
        }
        Insert: {
          attended?: boolean | null
          created_at?: string
          id?: string
          meeting_id: string
          name: string
          profile_id?: string | null
          role?: string | null
          rsvp?: string
        }
        Update: {
          attended?: boolean | null
          created_at?: string
          id?: string
          meeting_id?: string
          name?: string
          profile_id?: string | null
          role?: string | null
          rsvp?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "admin_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_meeting_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_meeting_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_meetings: {
        Row: {
          agenda: string | null
          created_at: string
          created_by: string | null
          duration_mins: number | null
          id: string
          location: string | null
          meeting_type: string
          minutes: string | null
          recurring: boolean
          scheduled_at: string
          school_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          created_at?: string
          created_by?: string | null
          duration_mins?: number | null
          id?: string
          location?: string | null
          meeting_type: string
          minutes?: string | null
          recurring?: boolean
          scheduled_at: string
          school_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          created_at?: string
          created_by?: string | null
          duration_mins?: number | null
          id?: string
          location?: string | null
          meeting_type?: string
          minutes?: string | null
          recurring?: boolean
          scheduled_at?: string
          school_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_meetings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notices: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expires_at: string | null
          id: string
          pinned: boolean
          school_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          pinned?: boolean
          school_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          pinned?: boolean
          school_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_profiles: {
        Row: {
          created_at: string
          profile_id: string
          school_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          school_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          school_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_project_milestones: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          project_id: string
          title: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          project_id: string
          title: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
        ]
      }
      admin_projects: {
        Row: {
          annual_budget_id: string | null
          at_risk_ack: boolean
          at_risk_ack_at: string | null
          budget: number | null
          budget_line_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          category: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          id: string
          lead: string | null
          owner_id: string | null
          project_type: string | null
          report_notes: string | null
          report_signed_at: string | null
          report_signed_by: string | null
          school_id: string
          spent: number | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          annual_budget_id?: string | null
          at_risk_ack?: boolean
          at_risk_ack_at?: string | null
          budget?: number | null
          budget_line_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          lead?: string | null
          owner_id?: string | null
          project_type?: string | null
          report_notes?: string | null
          report_signed_at?: string | null
          report_signed_by?: string | null
          school_id: string
          spent?: number | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          annual_budget_id?: string | null
          at_risk_ack?: boolean
          at_risk_ack_at?: string | null
          budget?: number | null
          budget_line_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          lead?: string | null
          owner_id?: string | null
          project_type?: string | null
          report_notes?: string | null
          report_signed_at?: string | null
          report_signed_by?: string | null
          school_id?: string
          spent?: number | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_projects_annual_budget_id_fkey"
            columns: ["annual_budget_id"]
            isOneToOne: false
            referencedRelation: "finance_annual_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_projects_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "finance_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_projects_report_signed_by_fkey"
            columns: ["report_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_projects_report_signed_by_fkey"
            columns: ["report_signed_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_projects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_staff_attendance: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          school_id: string
          staff_id: string
          status: string
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          school_id: string
          staff_id: string
          status?: string
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          school_id?: string
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_staff_attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_staff_leave: {
        Row: {
          created_at: string
          days: number
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          staff_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days: number
          end_date: string
          id?: string
          leave_type: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          staff_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days?: number
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          staff_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_staff_leave_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_staff_leave_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_staff_leave_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_staff_leave_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_staff_leave_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_visitors: {
        Row: {
          created_at: string
          flag_reason: string | null
          flagged: boolean
          full_name: string
          id: string
          id_number: string | null
          phone: string | null
          purpose: string
          recorded_by: string | null
          school_id: string
          time_in: string
          time_out: string | null
          visiting_whom: string
        }
        Insert: {
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean
          full_name: string
          id?: string
          id_number?: string | null
          phone?: string | null
          purpose: string
          recorded_by?: string | null
          school_id: string
          time_in?: string
          time_out?: string | null
          visiting_whom: string
        }
        Update: {
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean
          full_name?: string
          id?: string
          id_number?: string | null
          phone?: string | null
          purpose?: string
          recorded_by?: string | null
          school_id?: string
          time_in?: string
          time_out?: string | null
          visiting_whom?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_visitors_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_visitors_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_visitors_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_assignments: {
        Row: {
          answer_review_policy: string
          assessment_id: string
          assigned_at: string | null
          class_id: string
          closed_at: string | null
          closes_at: string | null
          created_at: string
          id: string
          intervention_id: string | null
          max_attempts: number
          opens_at: string | null
          randomize_items: boolean
          randomize_options: boolean
          school_id: string
          show_explanations: boolean
          show_score_policy: string
          show_worked_solutions: boolean
          status: string
          target_group_id: string | null
          teacher_id: string
          time_limit_minutes: number | null
          updated_at: string
        }
        Insert: {
          answer_review_policy?: string
          assessment_id: string
          assigned_at?: string | null
          class_id: string
          closed_at?: string | null
          closes_at?: string | null
          created_at?: string
          id?: string
          intervention_id?: string | null
          max_attempts?: number
          opens_at?: string | null
          randomize_items?: boolean
          randomize_options?: boolean
          school_id: string
          show_explanations?: boolean
          show_score_policy?: string
          show_worked_solutions?: boolean
          status?: string
          target_group_id?: string | null
          teacher_id: string
          time_limit_minutes?: number | null
          updated_at?: string
        }
        Update: {
          answer_review_policy?: string
          assessment_id?: string
          assigned_at?: string | null
          class_id?: string
          closed_at?: string | null
          closes_at?: string | null
          created_at?: string
          id?: string
          intervention_id?: string | null
          max_attempts?: number
          opens_at?: string | null
          randomize_items?: boolean
          randomize_options?: boolean
          school_id?: string
          show_explanations?: boolean
          show_score_policy?: string
          show_worked_solutions?: boolean
          status?: string
          target_group_id?: string | null
          teacher_id?: string
          time_limit_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_assignments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_assignments_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "assessment_interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_assignments_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_attempts: {
        Row: {
          active_client_id: string | null
          assessment_id: string
          assignment_id: string
          attempt_number: number
          auto_marked_at: string | null
          class_id: string
          client_lease_expires_at: string | null
          client_lease_updated_at: string | null
          created_at: string
          expires_at: string | null
          feedback: string | null
          id: string
          last_saved_at: string
          lock_reason: string | null
          locked_at: string | null
          max_score: number | null
          percentage: number | null
          result_status: string
          reviewed_by: string | null
          school_id: string
          score: number | null
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
          teacher_reviewed_at: string | null
          updated_at: string
        }
        Insert: {
          active_client_id?: string | null
          assessment_id: string
          assignment_id: string
          attempt_number?: number
          auto_marked_at?: string | null
          class_id: string
          client_lease_expires_at?: string | null
          client_lease_updated_at?: string | null
          created_at?: string
          expires_at?: string | null
          feedback?: string | null
          id?: string
          last_saved_at?: string
          lock_reason?: string | null
          locked_at?: string | null
          max_score?: number | null
          percentage?: number | null
          result_status?: string
          reviewed_by?: string | null
          school_id: string
          score?: number | null
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          teacher_reviewed_at?: string | null
          updated_at?: string
        }
        Update: {
          active_client_id?: string | null
          assessment_id?: string
          assignment_id?: string
          attempt_number?: number
          auto_marked_at?: string | null
          class_id?: string
          client_lease_expires_at?: string | null
          client_lease_updated_at?: string | null
          created_at?: string
          expires_at?: string | null
          feedback?: string | null
          id?: string
          last_saved_at?: string
          lock_reason?: string | null
          locked_at?: string | null
          max_score?: number | null
          percentage?: number | null
          result_status?: string
          reviewed_by?: string | null
          school_id?: string
          score?: number | null
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          teacher_reviewed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assessment_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_definitions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          assessment_type: string
          class_id: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          estimated_minutes: number | null
          generation_attempt: number
          generation_completed_at: string | null
          generation_error_code: string | null
          generation_error_message: string | null
          generation_failed_at: string | null
          generation_metadata: Json
          generation_request_key: string | null
          generation_source: string
          generation_started_at: string | null
          generation_status: string
          id: string
          instructions: string | null
          intervention_id: string | null
          lesson_plan_id: string | null
          published_at: string | null
          school_id: string
          source_lesson_updated_at: string | null
          source_resource_id: string | null
          status: string
          subject_id: string
          teacher_id: string
          teacher_reviewed_at: string | null
          teaching_occurrence_id: string | null
          title: string
          total_marks: number
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          assessment_type: string
          class_id?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          generation_attempt?: number
          generation_completed_at?: string | null
          generation_error_code?: string | null
          generation_error_message?: string | null
          generation_failed_at?: string | null
          generation_metadata?: Json
          generation_request_key?: string | null
          generation_source?: string
          generation_started_at?: string | null
          generation_status?: string
          id?: string
          instructions?: string | null
          intervention_id?: string | null
          lesson_plan_id?: string | null
          published_at?: string | null
          school_id: string
          source_lesson_updated_at?: string | null
          source_resource_id?: string | null
          status?: string
          subject_id: string
          teacher_id: string
          teacher_reviewed_at?: string | null
          teaching_occurrence_id?: string | null
          title: string
          total_marks?: number
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          assessment_type?: string
          class_id?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          generation_attempt?: number
          generation_completed_at?: string | null
          generation_error_code?: string | null
          generation_error_message?: string | null
          generation_failed_at?: string | null
          generation_metadata?: Json
          generation_request_key?: string | null
          generation_source?: string
          generation_started_at?: string | null
          generation_status?: string
          id?: string
          instructions?: string | null
          intervention_id?: string | null
          lesson_plan_id?: string | null
          published_at?: string | null
          school_id?: string
          source_lesson_updated_at?: string | null
          source_resource_id?: string | null
          status?: string
          subject_id?: string
          teacher_id?: string
          teacher_reviewed_at?: string | null
          teaching_occurrence_id?: string | null
          title?: string
          total_marks?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_definitions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_definitions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_definitions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_definitions_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "assessment_interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_definitions_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_definitions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_definitions_source_resource_id_fkey"
            columns: ["source_resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_definitions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_definitions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_definitions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_definitions_teaching_occurrence_id_fkey"
            columns: ["teaching_occurrence_id"]
            isOneToOne: false
            referencedRelation: "teaching_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_gradebook_entries: {
        Row: {
          assessment_id: string
          assessment_title: string
          assessment_type: string
          assignment_id: string
          attempt_id: string
          class_id: string
          created_at: string
          max_score: number | null
          percentage: number | null
          released_at: string
          school_id: string
          score: number | null
          student_id: string
          subject_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          assessment_title: string
          assessment_type: string
          assignment_id: string
          attempt_id: string
          class_id: string
          created_at?: string
          max_score?: number | null
          percentage?: number | null
          released_at: string
          school_id: string
          score?: number | null
          student_id: string
          subject_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          assessment_title?: string
          assessment_type?: string
          assignment_id?: string
          attempt_id?: string
          class_id?: string
          created_at?: string
          max_score?: number | null
          percentage?: number | null
          released_at?: string
          school_id?: string
          score?: number | null
          student_id?: string
          subject_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_gradebook_entries_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_gradebook_entries_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assessment_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_gradebook_entries_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_gradebook_entries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_gradebook_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_gradebook_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_gradebook_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_gradebook_entries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_gradebook_entries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_interventions: {
        Row: {
          baseline_mastery_score: number | null
          class_id: string
          completed_at: string | null
          completion_note: string | null
          confidence_score: number
          created_at: string
          due_at: string | null
          evaluated_at: string | null
          evidence_count: number
          evidence_snapshot: Json
          followup_mastery_score: number | null
          id: string
          intervention_group_id: string | null
          mastery_change: number | null
          mastery_score: number
          outcome_id: string
          priority: string
          recommendation: string
          recommendation_type: string
          remedial_assessment_id: string | null
          remedial_assignment_id: string | null
          repeated_weakness_count: number
          school_id: string
          status: string
          student_id: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          baseline_mastery_score?: number | null
          class_id: string
          completed_at?: string | null
          completion_note?: string | null
          confidence_score: number
          created_at?: string
          due_at?: string | null
          evaluated_at?: string | null
          evidence_count: number
          evidence_snapshot?: Json
          followup_mastery_score?: number | null
          id?: string
          intervention_group_id?: string | null
          mastery_change?: number | null
          mastery_score: number
          outcome_id: string
          priority: string
          recommendation: string
          recommendation_type: string
          remedial_assessment_id?: string | null
          remedial_assignment_id?: string | null
          repeated_weakness_count?: number
          school_id: string
          status?: string
          student_id: string
          subject_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          baseline_mastery_score?: number | null
          class_id?: string
          completed_at?: string | null
          completion_note?: string | null
          confidence_score?: number
          created_at?: string
          due_at?: string | null
          evaluated_at?: string | null
          evidence_count?: number
          evidence_snapshot?: Json
          followup_mastery_score?: number | null
          id?: string
          intervention_group_id?: string | null
          mastery_change?: number | null
          mastery_score?: number
          outcome_id?: string
          priority?: string
          recommendation?: string
          recommendation_type?: string
          remedial_assessment_id?: string | null
          remedial_assignment_id?: string | null
          repeated_weakness_count?: number
          school_id?: string
          status?: string
          student_id?: string
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_interventions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_interventions_intervention_group_id_fkey"
            columns: ["intervention_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_interventions_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_interventions_remedial_assessment_id_fkey"
            columns: ["remedial_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_interventions_remedial_assignment_id_fkey"
            columns: ["remedial_assignment_id"]
            isOneToOne: false
            referencedRelation: "assessment_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_interventions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_interventions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_interventions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_item_outcomes: {
        Row: {
          assessment_item_id: string
          created_at: string
          outcome_id: string
          weight: number
        }
        Insert: {
          assessment_item_id: string
          created_at?: string
          outcome_id: string
          weight?: number
        }
        Update: {
          assessment_item_id?: string
          created_at?: string
          outcome_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_item_outcomes_assessment_item_id_fkey"
            columns: ["assessment_item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_item_outcomes_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_items: {
        Row: {
          accepted_answers: Json
          assessment_id: string
          auto_marking_mode: string
          bloom_level: string | null
          correct_answer: Json | null
          created_at: string
          difficulty: string | null
          explanation: string | null
          generated_by: string
          hint: string | null
          id: string
          marking_guide: Json
          marks: number
          media: Json
          options: Json
          order_num: number
          prompt: string
          question_type: string
          section_id: string | null
          source_exam_question_id: string | null
          source_exercise_ref: Json | null
          source_homework_question_id: string | null
          source_item_id: string | null
          source_resource_id: string | null
          status: string
          teacher_approved_at: string | null
          teacher_notes: string | null
          updated_at: string
          worked_solution: string | null
        }
        Insert: {
          accepted_answers?: Json
          assessment_id: string
          auto_marking_mode?: string
          bloom_level?: string | null
          correct_answer?: Json | null
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          generated_by?: string
          hint?: string | null
          id?: string
          marking_guide?: Json
          marks?: number
          media?: Json
          options?: Json
          order_num: number
          prompt: string
          question_type: string
          section_id?: string | null
          source_exam_question_id?: string | null
          source_exercise_ref?: Json | null
          source_homework_question_id?: string | null
          source_item_id?: string | null
          source_resource_id?: string | null
          status?: string
          teacher_approved_at?: string | null
          teacher_notes?: string | null
          updated_at?: string
          worked_solution?: string | null
        }
        Update: {
          accepted_answers?: Json
          assessment_id?: string
          auto_marking_mode?: string
          bloom_level?: string | null
          correct_answer?: Json | null
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          generated_by?: string
          hint?: string | null
          id?: string
          marking_guide?: Json
          marks?: number
          media?: Json
          options?: Json
          order_num?: number
          prompt?: string
          question_type?: string
          section_id?: string | null
          source_exam_question_id?: string | null
          source_exercise_ref?: Json | null
          source_homework_question_id?: string | null
          source_item_id?: string | null
          source_resource_id?: string | null
          status?: string
          teacher_approved_at?: string | null
          teacher_notes?: string | null
          updated_at?: string
          worked_solution?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "assessment_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_items_source_exam_question_id_fkey"
            columns: ["source_exam_question_id"]
            isOneToOne: false
            referencedRelation: "exam_question_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_items_source_homework_question_id_fkey"
            columns: ["source_homework_question_id"]
            isOneToOne: false
            referencedRelation: "homework_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_items_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_items_source_resource_id_fkey"
            columns: ["source_resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_moderation_requests: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          request_reason: string
          requested_by: string
          requested_score: number
          response_id: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          request_reason: string
          requested_by: string
          requested_score: number
          response_id: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          st…125569 tokens truncated…xternal_url?: string | null
          id?: string | null
          is_school_wide?: boolean | null
          school_id?: string | null
          subject?: string | null
          teacher_id?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_content_engine_summary: {
        Row: {
          assignments: number | null
          average_percent: number | null
          class_id: string | null
          learners_completed: number | null
          learners_engaged: number | null
          released_marks: number | null
          school_id: string | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vibe_chapter_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapter_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapter_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapter_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_resource_usage_analytics: {
        Row: {
          class_id: string | null
          first_used_at: string | null
          last_used_at: string | null
          occurrence_count: number | null
          resource_id: string | null
          school_id: string | null
          subject_id: string | null
          teacher_id: string | null
          usage_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teaching_occurrence_resource_usage_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrence_resource_usage_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrence_resource_usage_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrence_resource_usage_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrence_resource_usage_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrence_resource_usage_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      v_approvals_queue: {
        Row: {
          amount: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_by_name: string | null
          days_pending: number | null
          description: string | null
          logged_at: string | null
          logged_by: string | null
          logged_by_name: string | null
          project_id: string | null
          project_title: string | null
          project_type: string | null
          receipt_ref: string | null
          return_reason: string | null
          school_id: string | null
          status: string | null
          task_ref: string | null
          transaction_id: string | null
          vendor: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_transactions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_transactions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_transactions_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_transactions_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      v_budget_vs_actual: {
        Row: {
          account_code: string | null
          account_id: string | null
          account_name: string | null
          account_type: string | null
          actual_spent: number | null
          available: number | null
          budgeted: number | null
          committed: number | null
          pending_confirmation: number | null
          school_id: string | null
          term: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_budgets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_budgets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "finance_budgets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      v_invoice_aging: {
        Row: {
          admission_number: string | null
          aging_bucket: string | null
          balance: number | null
          created_at: string | null
          days_overdue: number | null
          due_date: string | null
          id: string | null
          paid_amount: number | null
          school_id: string | null
          status: string | null
          student_id: string | null
          student_name: string | null
          term: string | null
          total_amount: number | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_summary: {
        Row: {
          at_risk_ack: boolean | null
          budget_line_id: string | null
          created_at: string | null
          end_date: string | null
          milestones_done: number | null
          milestones_total: number | null
          owner_id: string | null
          owner_name: string | null
          pending_confirmation: number | null
          planned: number | null
          project_id: string | null
          project_type: string | null
          remaining: number | null
          school_id: string | null
          spent: number | null
          start_date: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_projects_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "finance_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_projects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      v_trial_balance: {
        Row: {
          account_id: string | null
          code: string | null
          name: string | null
          net_balance: number | null
          school_id: string | null
          total_credit: number | null
          total_debit: number | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      vibelearn_leaderboard: {
        Row: {
          completions: number | null
          full_name: string | null
          id: string | null
          total_points: number | null
        }
        Relationships: []
      }
      vibelearn_teacher_stats: {
        Row: {
          content_count: number | null
          draft_count: number | null
          live_count: number | null
          teacher_id: string | null
          teacher_rank: number | null
          total_earnings_ksh: number | null
          total_views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vibelearn_content_submitted_by_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibelearn_content_submitted_by_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_add_student: {
        Args: {
          p_admission_number: string
          p_class_id: string
          p_date_of_birth: string
          p_gender: string
          p_name: string
          p_school_id: string
        }
        Returns: string
      }
      admin_reconcile_vibelearn_textbook_index: {
        Args: { p_publication_id: string }
        Returns: {
          content_id: string
          operation: string
        }[]
      }
      assign_chapter_to_class: {
        Args: { p_chapter_id: string; p_class_id: string; p_due_at?: string }
        Returns: Json
      }
      assign_scheme_resource_to_class: {
        Args: {
          p_class_id: string
          p_due_at?: string
          p_resource_link_id: string
        }
        Returns: Json
      }
      bump_bank_served: { Args: { p_ids: string[] }; Returns: undefined }
      calculate_grade_844: { Args: { marks: number }; Returns: string }
      can_viewer_read_chapter: {
        Args: { p_chapter_id: string; p_viewer_id: string }
        Returns: boolean
      }
      cancel_chapter_assignment: {
        Args: { p_assignment_id: string }
        Returns: Json
      }
      cancel_recovery_occurrence: {
        Args: { p_reason: string; p_recovery_occurrence_id: string }
        Returns: {
          original_lifecycle: string
          original_occurrence_id: string
        }[]
      }
      ce_add_resource_to_class_library: {
        Args: {
          p_available_from?: string
          p_available_until?: string
          p_class_id: string
          p_notes?: string
          p_resource_id: string
          p_subject_id?: string
          p_usage_role?: string
        }
        Returns: string
      }
      ce_adopt_learning_resource: {
        Args: {
          p_notes?: string
          p_preferred_role?: string
          p_resource_id: string
        }
        Returns: string
      }
      ce_assign_resource_to_class: {
        Args: {
          p_assignment_type?: string
          p_class_id: string
          p_due_at?: string
          p_instructions?: string
          p_opens_at?: string
          p_resource_id: string
          p_scheme_resource_link_id?: string
          p_subject_id?: string
        }
        Returns: string
      }
      ce_build_parent_learning_summary: {
        Args: {
          p_class_id?: string
          p_period_end: string
          p_period_start: string
          p_student_id: string
        }
        Returns: string
      }
      ce_extract_block_plain_text: {
        Args: { p_payload: Json }
        Returns: string
      }
      ce_full_integrity_audit: {
        Args: never
        Returns: {
          check_key: string
          detail: string
          issue_count: number
          severity: string
        }[]
      }
      ce_publish_parent_learning_summary: {
        Args: { p_summary_id: string }
        Returns: undefined
      }
      ce_reconcile_chapter_content_blocks: {
        Args: { p_chapter_id: string }
        Returns: number
      }
      ce_reconcile_learning_resource_metadata: {
        Args: { p_resource_id: string }
        Returns: string
      }
      ce_reconcile_textbook_index_internal: {
        Args: { p_publication_id: string }
        Returns: {
          content_id: string
          operation: string
        }[]
      }
      ce_refresh_content_engine_daily_metrics: {
        Args: { p_metric_date?: string }
        Returns: number
      }
      ce_refresh_student_outcome_mastery: {
        Args: { p_outcome_id: string; p_student_id: string }
        Returns: undefined
      }
      ce_register_learning_resource: {
        Args: {
          p_chapter_id?: string
          p_content_block_id?: string
          p_content_id?: string
          p_description?: string
          p_publication_id?: string
          p_school_id?: string
          p_source_type: string
          p_title?: string
          p_visibility?: string
        }
        Returns: string
      }
      ce_submit_assignment_evidence: {
        Args: {
          p_assignment_id: string
          p_evidence_type: string
          p_file_url?: string
          p_metadata?: Json
          p_text_response?: string
        }
        Returns: string
      }
      ce_sync_assignment_learners: {
        Args: { p_assignment_id: string }
        Returns: number
      }
      ce_sync_chapter_learning_outcomes: {
        Args: { p_chapter_id: string }
        Returns: number
      }
      ce_teacher_content_dashboard: {
        Args: { p_class_id?: string }
        Returns: Json
      }
      complete_teaching_occurrence: {
        Args: { p_occurrence_date: string; p_timetable_slot_id: string }
        Returns: {
          cancelled_at: string | null
          cancelled_reason: string | null
          class_id: string
          completed_at: string | null
          created_at: string
          id: string
          lifecycle: string
          occurrence_date: string
          recovered_from_id: string | null
          rescheduled_to_date: string | null
          rescheduled_to_slot_id: string | null
          school_id: string
          started_at: string | null
          started_by: string | null
          subject_id: string
          teacher_id: string
          timetable_slot_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "teaching_occurrences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      content_engine_integrity_audit: {
        Args: never
        Returns: {
          check_key: string
          detail: string
          issue_count: number
          severity: string
        }[]
      }
      count_bank_questions: {
        Args: {
          p_difficulty: Database["public"]["Enums"]["exam_difficulty"]
          p_form: Database["public"]["Enums"]["exam_form"]
          p_subject: Database["public"]["Enums"]["exam_subject"]
          p_topic: string
        }
        Returns: number
      }
      create_child_for_parent: {
        Args: { p_class_id: string; p_dob: string; p_name: string }
        Returns: string
      }
      create_school_with_admin: {
        Args: {
          p_county?: string
          p_full_name: string
          p_school_name: string
          p_subdomain: string
          p_user_id: string
        }
        Returns: string
      }
      create_timetable_slot: {
        Args: {
          p_class_id: string
          p_day_of_week: number
          p_effective_from?: string
          p_effective_until?: string
          p_end_time: string
          p_room?: string
          p_start_time: string
          p_subject_id: string
        }
        Returns: {
          class_id: string
          created_at: string
          day_of_week: number
          effective_from: string
          effective_until: string | null
          end_time: string
          id: string
          period_id: string | null
          room: string | null
          school_id: string
          start_time: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "timetable_slots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_study_workspace_item: {
        Args: { p_item_id: string }
        Returns: Json
      }
      delete_timetable_slot: { Args: { p_slot_id: string }; Returns: undefined }
      deliver_lesson_plan_to_parents: {
        Args: {
          p_body: string
          p_delivery_purpose: string
          p_lesson_plan_id: string
          p_subject: string
        }
        Returns: Json
      }
      dismiss_bank_question: { Args: { p_id: string }; Returns: undefined }
      duplicate_active_timetable: {
        Args: { p_effective_from: string }
        Returns: number
      }
      expire_timetable_slot: {
        Args: { p_effective_until?: string; p_slot_id: string }
        Returns: {
          class_id: string
          created_at: string
          day_of_week: number
          effective_from: string
          effective_until: string | null
          end_time: string
          id: string
          period_id: string | null
          room: string | null
          school_id: string
          start_time: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "timetable_slots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      exq_add_draft_item: {
        Args: {
          p_accepted_answers?: Json
          p_assessment_id: string
          p_auto_marking_mode?: string
          p_bloom_level?: string
          p_correct_answer?: Json
          p_difficulty?: string
          p_explanation?: string
          p_generated_by?: string
          p_hint?: string
          p_marking_guide?: Json
          p_marks?: number
          p_options?: Json
          p_order_num?: number
          p_prompt: string
          p_question_type: string
          p_source_exercise_ref?: Json
          p_source_resource_id?: string
          p_worked_solution?: string
        }
        Returns: string
      }
      exq_add_question_bank_item_to_assessment: {
        Args: {
          p_assessment_id: string
          p_order_num: number
          p_question_id: string
        }
        Returns: Json
      }
      exq_approve_assessment: {
        Args: { p_assessment_id: string }
        Returns: Json
      }
      exq_approve_question_bank_item: {
        Args: { p_question_id: string }
        Returns: Json
      }
      exq_assign_assessment: {
        Args: {
          p_assessment_id: string
          p_class_id: string
          p_closes_at?: string
          p_max_attempts?: number
          p_opens_at?: string
          p_randomize_items?: boolean
          p_randomize_options?: boolean
          p_show_score_policy?: string
          p_target_group_id?: string
          p_time_limit_minutes?: number
        }
        Returns: string
      }
      exq_claim_attempt_client: {
        Args: { p_attempt_id: string; p_client_id: string; p_force?: boolean }
        Returns: Json
      }
      exq_complete_lesson_assessment_generation: {
        Args: {
          p_assessment_id: string
          p_estimated_minutes?: number
          p_generation_metadata?: Json
          p_item_count: number
          p_total_marks: number
        }
        Returns: Json
      }
      exq_create_draft_assessment: {
        Args: {
          p_assessment_type: string
          p_class_id: string
          p_description?: string
          p_generation_metadata?: Json
          p_generation_source?: string
          p_instructions?: string
          p_lesson_plan_id?: string
          p_source_resource_id?: string
          p_subject_id: string
          p_teaching_occurrence_id?: string
          p_title: string
        }
        Returns: string
      }
      exq_create_intervention_assessment: {
        Args: { p_intervention_id: string; p_title?: string }
        Returns: Json
      }
      exq_create_report_card: {
        Args: {
          p_academic_year: number
          p_class_id: string
          p_student_id: string
          p_term_id: string
        }
        Returns: string
      }
      exq_create_section: {
        Args: {
          p_assessment_id: string
          p_estimated_minutes?: number
          p_instructions?: string
          p_title: string
        }
        Returns: string
      }
      exq_delete_section: { Args: { p_section_id: string }; Returns: Json }
      exq_evaluate_intervention: {
        Args: { p_intervention_id: string }
        Returns: Json
      }
      exq_fail_lesson_assessment_generation: {
        Args: {
          p_assessment_id: string
          p_error_code: string
          p_error_message?: string
        }
        Returns: Json
      }
      exq_finalize_attempt: {
        Args: { p_attempt_id: string; p_feedback?: string; p_release?: boolean }
        Returns: Json
      }
      exq_generate_report_card_evidence: {
        Args: { p_report_card_id: string }
        Returns: Json
      }
      exq_generate_subject_report_intelligence: {
        Args: { p_report_card_id: string }
        Returns: Json
      }
      exq_get_assignment_analytics: {
        Args: { p_assignment_id: string }
        Returns: Json
      }
      exq_get_assignment_intelligence: {
        Args: { p_assignment_id: string }
        Returns: Json
      }
      exq_get_builder_item: {
        Args: { p_assessment_item_id: string }
        Returns: Json
      }
      exq_get_curriculum_intelligence: {
        Args: { p_assignment_id: string }
        Returns: Json
      }
      exq_get_learner_assessment_hub: { Args: never; Returns: Json }
      exq_get_longitudinal_report_record: {
        Args: { p_student_id: string }
        Returns: Json
      }
      exq_get_marking_attempt: { Args: { p_attempt_id: string }; Returns: Json }
      exq_get_marking_centre_summary: { Args: never; Returns: Json }
      exq_get_my_result: { Args: { p_attempt_id: string }; Returns: Json }
      exq_get_parent_assessment_summary: {
        Args: { p_student_id: string }
        Returns: Json
      }
      exq_get_published_report_card: {
        Args: { p_report_card_id: string }
        Returns: Json
      }
      exq_get_report_card_evidence: {
        Args: { p_report_card_id: string }
        Returns: Json
      }
      exq_get_score_audit: { Args: { p_response_id: string }; Returns: Json }
      exq_get_teacher_assessment_intelligence: { Args: never; Returns: Json }
      exq_get_teacher_gradebook: {
        Args: { p_class_id?: string; p_subject_id?: string }
        Returns: Json
      }
      exq_get_teacher_pulse_summary: { Args: never; Returns: Json }
      exq_link_item_outcome: {
        Args: {
          p_assessment_item_id: string
          p_outcome_id: string
          p_weight?: number
        }
        Returns: Json
      }
      exq_list_builder_assessment: {
        Args: { p_assessment_id: string }
        Returns: Json
      }
      exq_list_intervention_queue: {
        Args: { p_class_id?: string }
        Returns: Json
      }
      exq_list_lesson_assessments: {
        Args: { p_lesson_plan_id: string }
        Returns: Json
      }
      exq_list_marking_queue: { Args: never; Returns: Json }
      exq_list_moderation_queue: { Args: never; Returns: Json }
      exq_list_my_assignments: { Args: never; Returns: Json }
      exq_list_my_published_report_cards: { Args: never; Returns: Json }
      exq_list_my_results: { Args: never; Returns: Json }
      exq_list_question_bank: {
        Args: { p_limit?: number; p_search?: string; p_subject_id?: string }
        Returns: Json
      }
      exq_list_teacher_assessment_analytics: { Args: never; Returns: Json }
      exq_lock_report_card: {
        Args: { p_report_card_id: string }
        Returns: Json
      }
      exq_mark_response: {
        Args: {
          p_override_reason?: string
          p_response_id: string
          p_teacher_feedback?: string
          p_teacher_score: number
        }
        Returns: Json
      }
      exq_move_item_to_section: {
        Args: {
          p_assessment_item_id: string
          p_order_num?: number
          p_section_id?: string
        }
        Returns: Json
      }
      exq_promote_assessment_item_to_question_bank: {
        Args: {
          p_assessment_item_id: string
          p_competency_tag?: string
          p_learning_outcome_id?: string
        }
        Returns: Json
      }
      exq_propagate_released_attempt: {
        Args: { p_attempt_id: string }
        Returns: Json
      }
      exq_publish_assessment: {
        Args: { p_assessment_id: string }
        Returns: Json
      }
      exq_publish_report_card: {
        Args: { p_report_card_id: string }
        Returns: Json
      }
      exq_refresh_intervention_queue: {
        Args: { p_class_id?: string }
        Returns: Json
      }
      exq_release_attempt_client: {
        Args: { p_attempt_id: string; p_client_id: string }
        Returns: Json
      }
      exq_reorder_sections: {
        Args: { p_assessment_id: string; p_section_ids: string[] }
        Returns: Json
      }
      exq_request_lesson_assessment: {
        Args: {
          p_assessment_type: string
          p_generation_metadata?: Json
          p_lesson_plan_id: string
          p_request_key: string
          p_title?: string
        }
        Returns: Json
      }
      exq_request_moderation: {
        Args: {
          p_reason: string
          p_requested_score: number
          p_response_id: string
        }
        Returns: Json
      }
      exq_review_moderation: {
        Args: {
          p_decision: string
          p_request_id: string
          p_review_reason: string
        }
        Returns: Json
      }
      exq_review_report_card: {
        Args: {
          p_decision: string
          p_reason?: string
          p_report_card_id: string
        }
        Returns: Json
      }
      exq_save_response: {
        Args: {
          p_assessment_item_id: string
          p_attempt_id: string
          p_response_text?: string
          p_response_value?: Json
        }
        Returns: Json
      }
      exq_save_response_v2: {
        Args: {
          p_assessment_item_id: string
          p_attempt_id: string
          p_client_id: string
          p_client_updated_at?: string
          p_expected_revision?: number
          p_response_text?: string
          p_response_value?: Json
        }
        Returns: Json
      }
      exq_set_result_visibility: {
        Args: {
          p_answer_review_policy: string
          p_assignment_id: string
          p_show_explanations?: boolean
          p_show_worked_solutions?: boolean
        }
        Returns: Json
      }
      exq_start_or_resume_attempt: {
        Args: { p_assignment_id: string }
        Returns: Json
      }
      exq_submit_attempt: { Args: { p_attempt_id: string }; Returns: Json }
      exq_submit_report_card: {
        Args: { p_overall_comment?: string; p_report_card_id: string }
        Returns: Json
      }
      exq_sync_attempt_outcome_evidence: {
        Args: { p_attempt_id: string }
        Returns: Json
      }
      exq_update_draft_item: {
        Args: {
          p_accepted_answers?: Json
          p_assessment_item_id: string
          p_auto_marking_mode?: string
          p_bloom_level?: string
          p_correct_answer?: Json
          p_difficulty?: string
          p_explanation?: string
          p_hint?: string
          p_marking_guide?: Json
          p_marks: number
          p_options?: Json
          p_prompt: string
          p_question_type: string
          p_teacher_notes?: string
          p_worked_solution?: string
        }
        Returns: Json
      }
      exq_update_intervention: {
        Args: {
          p_completion_note?: string
          p_due_at?: string
          p_intervention_id: string
          p_status: string
        }
        Returns: Json
      }
      exq_update_section: {
        Args: {
          p_estimated_minutes?: number
          p_instructions?: string
          p_section_id: string
          p_title: string
        }
        Returns: Json
      }
      exq_update_subject_report: {
        Args: {
          p_parent_guidance?: string
          p_report_card_subject_id: string
          p_teacher_comment: string
        }
        Returns: Json
      }
      exq_validate_assessment: {
        Args: { p_assessment_id: string }
        Returns: Json
      }
      exq_validate_report_card: {
        Args: { p_report_card_id: string }
        Returns: Json
      }
      fn_content_os_target_authorized: {
        Args: {
          p_chapter_assignment_id: string
          p_exam_id: string
          p_homework_id: string
          p_lesson_plan_id: string
          p_project_id: string
          p_scheme_lesson_id: string
          p_target_type: string
          p_write?: boolean
        }
        Returns: boolean
      }
      fn_invitation_attempt: {
        Args: { p_code: string; p_success: boolean }
        Returns: Json
      }
      fn_learning_resource_visible: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      fn_nightly_maintenance: { Args: never; Returns: undefined }
      fn_sanitise_row: { Args: { p_row: Json }; Returns: Json }
      fn_write_health_log: {
        Args: {
          p_duration_ms?: number
          p_error_code?: string
          p_error_msg?: string
          p_job_name: string
          p_rows?: number
          p_run_id: string
          p_status: string
        }
        Returns: undefined
      }
      funhub_claim_voucher: { Args: { p_voucher_id: string }; Returns: Json }
      funhub_get_student_id: { Args: never; Returns: string }
      funhub_save_session: {
        Args: {
          p_correct: number
          p_duration_secs?: number
          p_game_slug: string
          p_grade: number
          p_score: number
          p_streak_max?: number
          p_subject: string
          p_total: number
          p_xp_earned: number
        }
        Returns: Json
      }
      generate_daily_occurrences: {
        Args: { p_date?: string }
        Returns: {
          generated: number
          marked_missed: number
        }[]
      }
      generate_receipt_number: {
        Args: { p_school_id: string }
        Returns: string
      }
      generate_term_weeks: { Args: { p_term_id: string }; Returns: undefined }
      get_author_story_stats: {
        Args: { target_author_id: string }
        Returns: Json
      }
      get_bank_questions: {
        Args: {
          p_count: number
          p_difficulty: Database["public"]["Enums"]["exam_difficulty"]
          p_form: Database["public"]["Enums"]["exam_form"]
          p_subject: Database["public"]["Enums"]["exam_subject"]
          p_topic: string
        }
        Returns: {
          correct_index: number
          created_at: string
          difficulty: Database["public"]["Enums"]["exam_difficulty"]
          explanation: string
          form: Database["public"]["Enums"]["exam_form"]
          hint: string | null
          id: string
          options: Json
          question: string
          source: string
          status: string
          subject: Database["public"]["Enums"]["exam_subject"]
          teaching_note: string
          times_flagged: number
          times_served: number
          topic: string
        }[]
        SetofOptions: {
          from: "*"
          to: "exam_question_bank"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_classroom_reading_assignment_learners: {
        Args: { assignment_id_input: string }
        Returns: Json
      }
      get_continue_reading: { Args: { limit_input?: number }; Returns: Json }
      get_credit_balance: { Args: { p_teacher_id: string }; Returns: Json }
      get_my_assigned_reading: { Args: never; Returns: Json }
      get_my_bookmarks: {
        Args: never
        Returns: {
          bookmarked_at: string
          cbc_grade: string
          cbc_subject: string
          chapter_id: string
          chapter_number: number
          chapter_title: string
          cover_url: string
          publication_id: string
          publication_title: string
        }[]
      }
      get_my_classroom_reading_assignments: { Args: never; Returns: Json }
      get_my_library: {
        Args: never
        Returns: {
          cbc_grade: string
          cbc_subject: string
          cover_url: string
          publication_id: string
          saved_at: string
          title: string
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      get_my_school_ids: { Args: never; Returns: string[] }
      get_my_study_workspace_items: {
        Args: { p_item_type?: string }
        Returns: {
          cbc_grade: string
          cbc_subject: string
          chapter_id: string
          chapter_number: number
          chapter_title: string
          cover_url: string
          created_at: string
          item_id: string
          item_type: string
          payload: Json
          publication_id: string
          publication_title: string
          updated_at: string
        }[]
      }
      get_next_scheme_item: {
        Args: {
          p_academic_term_id: string
          p_class_id: string
          p_subject_id: string
        }
        Returns: {
          curriculum_id: string
          key_inquiry_question: string
          last_completed_sequence: number
          learning_resources: string
          lesson_number: number
          objectives: string
          scheme_id: string
          sequence_number: number
          strand: string
          sub_strand: string
          topic: string
          week: number
        }[]
      }
      get_saved_publications: { Args: { limit_input?: number }; Returns: Json }
      get_student_homework_feedback: {
        Args: { p_homework_id: string }
        Returns: Json
      }
      get_teacher_active_weeks: {
        Args: { p_school_id: string; p_teacher_id: string }
        Returns: {
          academic_year: number
          end_date: string
          label: string
          start_date: string
          term_id: string
          term_number: number
          week_number: number
          week_type: string
        }[]
      }
      get_teacher_weekly_timetable_load: {
        Args: never
        Returns: {
          class_id: string
          class_name: string
          grade: string
          lessons_per_week: number
          scheduled_count: number
          status: string
          stream: string
          subject_id: string
          subject_name: string
        }[]
      }
      get_timetable_analytics: { Args: never; Returns: Json }
      get_unread_thread_count: {
        Args: { p_profile_id: string }
        Returns: number
      }
      get_vibelearn_content_reader: {
        Args: { content_id_input: string }
        Returns: Json
      }
      get_vibetextbook_reader: {
        Args: { publication_id_input: string }
        Returns: Json
      }
      get_week_type: {
        Args: { p_school_id: string; p_term_id: string; p_week_number: number }
        Returns: {
          label: string
          week_type: string
        }[]
      }
      increment_available_copies: {
        Args: { book_id: string }
        Returns: undefined
      }
      increment_publication_reads: {
        Args: { pub_id: string; viewer_id?: string }
        Returns: undefined
      }
      increment_view_count:
        | { Args: { content_id: string }; Returns: undefined }
        | {
            Args: { content_id: string; viewer_id?: string }
            Returns: undefined
          }
      is_bursar: { Args: { p_school_id: string }; Returns: boolean }
      is_own_student_link: { Args: { p_student_id: string }; Returns: boolean }
      is_parent_of_student: { Args: { p_student_id: string }; Returns: boolean }
      is_project_member: { Args: { p_project_id: string }; Returns: boolean }
      is_school_admin: { Args: { p_school_id: string }; Returns: boolean }
      join_school_as_admin: {
        Args: { p_full_name: string; p_school_id: string; p_user_id: string }
        Returns: undefined
      }
      link_evidence_to_occurrence_resources: {
        Args: { p_evidence_id: string; p_occurrence_id: string }
        Returns: Json
      }
      link_learning_resource: {
        Args: {
          p_exercise_refs?: Json
          p_page_end?: number
          p_page_start?: number
          p_resource_id: string
          p_section_refs?: Json
          p_sequence?: number
          p_target_id: string
          p_target_type: string
          p_usage_role?: string
        }
        Returns: Json
      }
      list_occurrence_resource_usage: {
        Args: { p_occurrence_id: string }
        Returns: Json
      }
      list_scheme_lesson_resources: {
        Args: { p_scheme_lesson_id: string }
        Returns: Json
      }
      list_teaching_resources: {
        Args: { p_target_id: string; p_target_type: string }
        Returns: Json
      }
      mark_occurrence_resource_used: {
        Args: {
          p_lesson_plan_id: string
          p_occurrence_id: string
          p_resource_id: string
        }
        Returns: Json
      }
      mark_scheme_item_covered: {
        Args: { p_occurrence_id: string }
        Returns: {
          scheme_id: string
          status: string
        }[]
      }
      onboard_teacher_class: {
        Args: {
          p_grade: string
          p_school_id: string
          p_stream: string
          p_subject: string
          p_teacher_id: string
        }
        Returns: string
      }
      create_teacher_class_assignment: {
        Args: {
          p_grade: string
          p_is_class_teacher?: boolean
          p_school_id: string
          p_stream: string
          p_subject: string
        }
        Returns: string
      }
      publish_textbook: {
        Args: { p_publication_id: string }
        Returns: {
          content_id: string
          operation: string
        }[]
      }
      purchase_credits:
        | {
            Args: { p_amount: number; p_notes?: string; p_teacher_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_mpesa_ref: string
              p_package_id: string
              p_teacher_id: string
            }
            Returns: Json
          }
      recommend_textbook_chapters_for_scheme_lesson: {
        Args: { p_limit?: number; p_scheme_lesson_id: string }
        Returns: Json
      }
      reconcile_textbook_index: {
        Args: { p_publication_id: string }
        Returns: {
          content_id: string
          operation: string
        }[]
      }
      record_reading_activity: {
        Args: {
          p_active_seconds?: number
          p_chapter_id: string
          p_client_session_id: string
          p_event: string
          p_progress_percent?: number
        }
        Returns: Json
      }
      record_reading_progress: {
        Args: {
          chapter_id_input: string
          position_input?: Json
          progress_percent_input: number
          publication_id_input: string
          reset_input?: boolean
        }
        Returns: Json
      }
      redeem_parent_claim: {
        Args: { p_code: string; p_user_id: string }
        Returns: string
      }
      redeem_student_claim: {
        Args: { p_code: string; p_user_id?: string }
        Returns: Json
      }
      redeem_student_claim_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: Json
      }
      refresh_leaderboard: { Args: never; Returns: undefined }
      register_learning_resource: {
        Args: { p_source_id: string; p_source_type: string }
        Returns: Json
      }
      remove_scheme_lesson_resource: {
        Args: { p_resource_link_id: string }
        Returns: Json
      }
      remove_textbook_from_vibelearn: {
        Args: { p_publication_id: string }
        Returns: undefined
      }
      reset_monthly_xp: { Args: never; Returns: undefined }
      reset_weekly_xp: { Args: never; Returns: undefined }
      restore_timetable_snapshot: {
        Args: { p_effective_from: string; p_snapshot_id: string }
        Returns: number
      }
      review_homework_submission: {
        Args: {
          p_action: string
          p_feedback?: string
          p_mark?: number
          p_reason?: string
          p_release_model_answers?: boolean
          p_submission_id: string
        }
        Returns: Json
      }
      save_student_homework_draft: {
        Args: { p_answers?: Json; p_homework_id: string; p_photo_url?: string }
        Returns: Json
      }
      save_teaching_progress_record: {
        Args: {
          p_challenges?: string
          p_homework_set?: string
          p_next_steps?: string
          p_occurrence_id: string
          p_participation_score?: number
          p_teacher_remarks?: string
          p_what_was_taught: string
        }
        Returns: {
          challenges: string
          homework_set: string
          id: string
          lesson_plan_id: string
          next_steps: string
          participation_score: number
          taught_date: string
          teacher_remarks: string
          teaching_occurrence_id: string
          what_was_taught: string
        }[]
      }
      schedule_recovery_occurrence: {
        Args: {
          p_end_time: string
          p_occurrence_id: string
          p_recovery_date: string
          p_room?: string
          p_start_time: string
        }
        Returns: {
          original_lifecycle: string
          recovery_occurrence_id: string
          recovery_slot_id: string
        }[]
      }
      scheme_pacing_status: {
        Args: never
        Returns: {
          behind_count: number
          class_id: string
          current_week: number
          earliest_behind_week: number
          missed_occurrences: number
          subject_id: string
          term: number
        }[]
      }
      seed_default_school_periods: { Args: never; Returns: number }
      snapshot_timetable: { Args: { p_label: string }; Returns: string }
      spend_credit: {
        Args: {
          p_amount: number
          p_feature: string
          p_notes?: string
          p_teacher_id: string
        }
        Returns: Json
      }
      start_teaching_occurrence: {
        Args: { p_occurrence_date: string; p_timetable_slot_id: string }
        Returns: {
          cancelled_at: string | null
          cancelled_reason: string | null
          class_id: string
          completed_at: string | null
          created_at: string
          id: string
          lifecycle: string
          occurrence_date: string
          recovered_from_id: string | null
          rescheduled_to_date: string | null
          rescheduled_to_slot_id: string | null
          school_id: string
          started_at: string | null
          started_by: string | null
          subject_id: string
          teacher_id: string
          timetable_slot_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "teaching_occurrences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      student_acknowledge_home_changes: { Args: never; Returns: Json }
      student_generate_revision_plan: {
        Args: { p_days?: number; p_start_date?: string }
        Returns: Json
      }
      student_get_exam_readiness_brief: { Args: never; Returns: Json }
      student_get_home_os_brief: { Args: never; Returns: Json }
      student_get_revision_workspace: {
        Args: { p_subject?: string; p_topic?: string }
        Returns: Json
      }
      student_get_vibelearn_workstation: { Args: never; Returns: Json }
      student_list_my_tasks: { Args: never; Returns: Json }
      student_mark_home_opened: { Args: never; Returns: Json }
      student_record_verified_task_completion: {
        Args: {
          p_source_id: string
          p_source_type: string
          p_subject_id?: string
        }
        Returns: Json
      }
      student_record_vibelearn_practice_answer: {
        Args: {
          p_exam_question_id: string
          p_response_ms?: number
          p_selected_index: number
          p_session_id?: string
        }
        Returns: Json
      }
      student_refresh_motivation_summary: { Args: never; Returns: Json }
      student_refresh_personalized_path: { Args: never; Returns: Json }
      student_resolve_mistake: { Args: { p_mistake_id: string }; Returns: Json }
      student_resolve_task_launch: {
        Args: { p_task_id: string }
        Returns: Json
      }
      student_save_topic_note: {
        Args: { p_note_text: string; p_subject: string; p_topic: string }
        Returns: Json
      }
      student_update_exam_readiness: {
        Args: {
          p_confidence_check: number
          p_daily_revision_minutes: number
          p_exam_date: string
        }
        Returns: undefined
      }
      student_update_home_preferences: {
        Args: {
          p_kcse_target_grade?: string
          p_preferred_session_minutes?: number
          p_preferred_study_time?: string
          p_subject_targets?: Json
          p_weekly_study_minutes?: number
        }
        Returns: Json
      }
      submit_student_homework: {
        Args: { p_answers?: Json; p_homework_id: string; p_photo_url?: string }
        Returns: Json
      }
      suggest_recovery_slots: {
        Args: { p_class_id: string; p_days_ahead?: number }
        Returns: {
          day_of_week: number
          end_time: string
          period_label: string
          start_time: string
          suggest_date: string
        }[]
      }
      sync_vibelearn_textbook_index: {
        Args: { p_publication_id: string }
        Returns: {
          content_id: string
          operation: string
        }[]
      }
      teacher_add_student: {
        Args: {
          p_admission_number?: string
          p_class_id?: string
          p_name: string
          p_school_id?: string
        }
        Returns: string
      }
      teacher_get_student_personalized_path: {
        Args: { p_student_id: string }
        Returns: Json
      }
      timetable_quality_report: {
        Args: never
        Returns: {
          class_id: string
          detail: string
          flag: string
          severity: string
        }[]
      }
      toggle_chapter_bookmark: { Args: { p_chapter_id: string }; Returns: Json }
      toggle_publication_save: {
        Args: { p_publication_id: string }
        Returns: Json
      }
      toggle_saved_publication: {
        Args: { publication_id_input: string }
        Returns: Json
      }
      unlink_learning_resource: { Args: { p_link_id: string }; Returns: Json }
      unpublish_textbook: {
        Args: { p_publication_id: string }
        Returns: {
          content_id: string
          operation: string
        }[]
      }
      update_chapter_assignment_due_at: {
        Args: { p_assignment_id: string; p_due_at: string }
        Returns: Json
      }
      update_exam_streak: { Args: { p_user_id: string }; Returns: undefined }
      update_timetable_slot: {
        Args: {
          p_clear_effective_until?: boolean
          p_clear_room?: boolean
          p_day_of_week?: number
          p_effective_from?: string
          p_effective_until?: string
          p_end_time?: string
          p_room?: string
          p_slot_id: string
          p_start_time?: string
        }
        Returns: {
          class_id: string
          created_at: string
          day_of_week: number
          effective_from: string
          effective_until: string | null
          end_time: string
          id: string
          period_id: string | null
          room: string | null
          school_id: string
          start_time: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "timetable_slots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_attendance_batch: {
        Args: { p_rows: Json }
        Returns: {
          arrived_at: string | null
          class_id: string
          date: string
          id: string
          is_late: boolean
          marked_at: string
          notes: string | null
          school_id: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          teacher_id: string
          teaching_occurrence_id: string | null
          timetable_slot_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      upsert_scheme_lesson_resource: {
        Args: {
          p_chapter_id: string
          p_exercise_refs?: Json
          p_page_end?: number
          p_page_start?: number
          p_publication_id: string
          p_resource_role: string
          p_scheme_lesson_id: string
          p_sequence?: number
        }
        Returns: Json
      }
      upsert_study_workspace_item: {
        Args: {
          p_chapter_id: string
          p_item_id?: string
          p_item_type: string
          p_payload: Json
        }
        Returns: Json
      }
    }
    Enums: {
      account_status: "active" | "restricted" | "suspended" | "anonymized"
      action_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "expired"
        | "executed"
      action_type:
        | "enroll_student"
        | "remove_student"
        | "add_teacher"
        | "remove_teacher"
        | "close_school"
        | "suspend_school"
        | "transfer_ownership"
      attendance_status: "present" | "excused" | "absent"
      cbc_performance_level:
        | "exceeds_expectation"
        | "meets_expectation"
        | "approaches_expectation"
        | "below_expectation"
      exam_difficulty: "easy" | "medium" | "hard"
      exam_form: "Form 1" | "Form 2" | "Form 3" | "Form 4"
      exam_subject:
        | "Mathematics"
        | "English"
        | "Biology"
        | "Chemistry"
        | "History"
        | "Physics"
        | "Geography"
        | "Kiswahili"
        | "CRE"
        | "Business Studies"
      member_role: "owner" | "admin" | "teacher" | "student" | "parent"
      school_status: "pending" | "active" | "suspended" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["active", "restricted", "suspended", "anonymized"],
      action_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "expired",
        "executed",
      ],
      action_type: [
        "enroll_student",
        "remove_student",
        "add_teacher",
        "remove_teacher",
        "close_school",
        "suspend_school",
        "transfer_ownership",
      ],
      attendance_status: ["present", "excused", "absent"],
      cbc_performance_level: [
        "exceeds_expectation",
        "meets_expectation",
        "approaches_expectation",
        "below_expectation",
      ],
      exam_difficulty: ["easy", "medium", "hard"],
      exam_form: ["Form 1", "Form 2", "Form 3", "Form 4"],
      exam_subject: [
        "Mathematics",
        "English",
        "Biology",
        "Chemistry",
        "History",
        "Physics",
        "Geography",
        "Kiswahili",
        "CRE",
        "Business Studies",
      ],
      member_role: ["owner", "admin", "teacher", "student", "parent"],
      school_status: ["pending", "active", "suspended", "closed"],
    },
  },
} as const

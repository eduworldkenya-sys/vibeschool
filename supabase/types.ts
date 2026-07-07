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
      attendance: {
        Row: {
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
          timetable_slot_id: string | null
        }
        Insert: {
          arrived_at?: string | null
          class_id: string
          date: string
          id?: string
          is_late?: boolean
          marked_at?: string
          notes?: string | null
          school_id?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          teacher_id: string
          timetable_slot_id?: string | null
        }
        Update: {
          arrived_at?: string | null
          class_id?: string
          date?: string
          id?: string
          is_late?: boolean
          marked_at?: string
          notes?: string | null
          school_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          teacher_id?: string
          timetable_slot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_timetable_slot_id_fkey"
            columns: ["timetable_slot_id"]
            isOneToOne: false
            referencedRelation: "timetable_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          actor_snapshot: Json
          created_at: string
          id: string
          ip_address: unknown
          ip_masked_at: string | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          table_name: string
          table_record_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          actor_snapshot: Json
          created_at?: string
          id?: string
          ip_address?: unknown
          ip_masked_at?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          table_name: string
          table_record_id: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          actor_snapshot?: Json
          created_at?: string
          id?: string
          ip_address?: unknown
          ip_masked_at?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          table_name?: string
          table_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          level: number | null
          name: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          level?: number | null
          name: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          level?: number | null
          name?: string
        }
        Relationships: []
      }
      cbc_assessments: {
        Row: {
          academic_year: number
          assessment_type: string
          class_id: string
          created_at: string
          id: string
          notes: string | null
          performance: Database["public"]["Enums"]["cbc_performance_level"]
          school_id: string | null
          strand_id: string | null
          student_id: string
          sub_strand: string | null
          subject_id: string
          teacher_id: string
          term: number
          updated_at: string
        }
        Insert: {
          academic_year: number
          assessment_type: string
          class_id: string
          created_at?: string
          id?: string
          notes?: string | null
          performance: Database["public"]["Enums"]["cbc_performance_level"]
          school_id?: string | null
          strand_id?: string | null
          student_id: string
          sub_strand?: string | null
          subject_id: string
          teacher_id: string
          term: number
          updated_at?: string
        }
        Update: {
          academic_year?: number
          assessment_type?: string
          class_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          performance?: Database["public"]["Enums"]["cbc_performance_level"]
          school_id?: string | null
          strand_id?: string | null
          student_id?: string
          sub_strand?: string | null
          subject_id?: string
          teacher_id?: string
          term?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cbc_assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbc_assessments_strand_id_fkey"
            columns: ["strand_id"]
            isOneToOne: false
            referencedRelation: "strands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbc_assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbc_assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbc_assessments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbc_assessments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      cbc_strands: {
        Row: {
          created_at: string
          grade: string
          id: string
          name: string
          sub_strand: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          grade: string
          id?: string
          name: string
          sub_strand: string
          subject_id: string
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          name?: string
          sub_strand?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cbc_strands_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      child_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          student_id: string
          table_name: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          student_id: string
          table_name?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          student_id?: string
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_audit_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_autonomy_log: {
        Row: {
          created_at: string | null
          from_level: number | null
          id: string
          parent_id: string
          reason: string | null
          student_id: string
          to_level: number | null
        }
        Insert: {
          created_at?: string | null
          from_level?: number | null
          id?: string
          parent_id: string
          reason?: string | null
          student_id: string
          to_level?: number | null
        }
        Update: {
          created_at?: string | null
          from_level?: number | null
          id?: string
          parent_id?: string
          reason?: string | null
          student_id?: string
          to_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "child_autonomy_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_badges: {
        Row: {
          awarded_by: string | null
          badge_id: string
          created_at: string | null
          earned_at: string | null
          id: string
          student_id: string
        }
        Insert: {
          awarded_by?: string | null
          badge_id: string
          created_at?: string | null
          earned_at?: string | null
          id?: string
          student_id: string
        }
        Update: {
          awarded_by?: string | null
          badge_id?: string
          created_at?: string | null
          earned_at?: string | null
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_books: {
        Row: {
          author: string | null
          category: string | null
          cover_url: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          owner: string | null
          pages: number | null
          parent_id: string
          rating: number | null
          recorded_at: string | null
          student_id: string
          title: string
          visibility: string | null
        }
        Insert: {
          author?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          owner?: string | null
          pages?: number | null
          parent_id: string
          rating?: number | null
          recorded_at?: string | null
          student_id: string
          title: string
          visibility?: string | null
        }
        Update: {
          author?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          owner?: string | null
          pages?: number | null
          parent_id?: string
          rating?: number | null
          recorded_at?: string | null
          student_id?: string
          title?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_books_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_change_requests: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          field: string
          id: string
          new_value: string
          old_value: string | null
          parent_id: string
          reason: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          field: string
          id?: string
          new_value: string
          old_value?: string | null
          parent_id: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          field?: string
          id?: string
          new_value?: string
          old_value?: string | null
          parent_id?: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_change_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_events: {
        Row: {
          category: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_recurring: boolean | null
          location: string | null
          outcome: string | null
          owner: string | null
          parent_id: string
          recorded_at: string
          recurrence: string | null
          status: string | null
          student_id: string
          title: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          outcome?: string | null
          owner?: string | null
          parent_id: string
          recorded_at?: string
          recurrence?: string | null
          status?: string | null
          student_id: string
          title: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          outcome?: string | null
          owner?: string | null
          parent_id?: string
          recorded_at?: string
          recurrence?: string | null
          status?: string | null
          student_id?: string
          title?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_goal_milestones: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          done_at: string | null
          goal_id: string
          id: string
          is_done: boolean | null
          recorded_at: string | null
          student_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          done_at?: string | null
          goal_id: string
          id?: string
          is_done?: boolean | null
          recorded_at?: string | null
          student_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          done_at?: string | null
          goal_id?: string
          id?: string
          is_done?: boolean | null
          recorded_at?: string | null
          student_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_goal_milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "child_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_goal_milestones_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_goals: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          owner: string | null
          parent_id: string
          recorded_at: string | null
          status: string | null
          student_id: string
          target_date: string | null
          title: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          owner?: string | null
          parent_id: string
          recorded_at?: string | null
          status?: string | null
          student_id: string
          target_date?: string | null
          title: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          owner?: string | null
          parent_id?: string
          recorded_at?: string | null
          status?: string | null
          student_id?: string
          target_date?: string | null
          title?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_growth: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          height_cm: number | null
          id: string
          notes: string | null
          parent_id: string
          recorded_at: string
          student_id: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          height_cm?: number | null
          id?: string
          notes?: string | null
          parent_id: string
          recorded_at?: string
          student_id: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          height_cm?: number | null
          id?: string
          notes?: string | null
          parent_id?: string
          recorded_at?: string
          student_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "child_growth_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_media: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          owner: string | null
          parent_id: string
          recorded_at: string | null
          related_id: string | null
          related_to: string | null
          student_id: string
          title: string | null
          type: string
          url: string
          visibility: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          owner?: string | null
          parent_id: string
          recorded_at?: string | null
          related_id?: string | null
          related_to?: string | null
          student_id: string
          title?: string | null
          type: string
          url: string
          visibility?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          owner?: string | null
          parent_id?: string
          recorded_at?: string | null
          related_id?: string | null
          related_to?: string | null
          student_id?: string
          title?: string | null
          type?: string
          url?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_media_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_profiles: {
        Row: {
          allergies: string | null
          bio: string | null
          blood_group: string | null
          created_at: string | null
          deleted_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          favourite_animal: string | null
          favourite_book: string | null
          favourite_color: string | null
          favourite_food: string | null
          favourite_sport: string | null
          id: string
          medical_notes: string | null
          nickname: string | null
          owner: string | null
          parent_id: string
          photo_url: string | null
          special_needs: string | null
          student_id: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          allergies?: string | null
          bio?: string | null
          blood_group?: string | null
          created_at?: string | null
          deleted_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          favourite_animal?: string | null
          favourite_book?: string | null
          favourite_color?: string | null
          favourite_food?: string | null
          favourite_sport?: string | null
          id?: string
          medical_notes?: string | null
          nickname?: string | null
          owner?: string | null
          parent_id: string
          photo_url?: string | null
          special_needs?: string | null
          student_id: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          allergies?: string | null
          bio?: string | null
          blood_group?: string | null
          created_at?: string | null
          deleted_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          favourite_animal?: string | null
          favourite_book?: string | null
          favourite_color?: string | null
          favourite_food?: string | null
          favourite_sport?: string | null
          id?: string
          medical_notes?: string | null
          nickname?: string | null
          owner?: string | null
          parent_id?: string
          photo_url?: string | null
          special_needs?: string | null
          student_id?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_share_links: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          parent_id: string
          related_id: string | null
          scope: string
          student_id: string
          token: string
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          parent_id: string
          related_id?: string | null
          scope: string
          student_id: string
          token?: string
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          parent_id?: string
          related_id?: string | null
          scope?: string
          student_id?: string
          token?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "child_share_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_skill_evidence: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          media_url: string | null
          notes: string | null
          recorded_at: string | null
          skill_id: string
          student_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          media_url?: string | null
          notes?: string | null
          recorded_at?: string | null
          skill_id: string
          student_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          media_url?: string | null
          notes?: string | null
          recorded_at?: string | null
          skill_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_skill_evidence_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "child_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_skill_evidence_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_skills: {
        Row: {
          category: string | null
          created_at: string | null
          deleted_at: string | null
          endorsed_at: string | null
          endorsed_by: string | null
          id: string
          level: string | null
          name: string
          notes: string | null
          owner: string | null
          parent_id: string
          recorded_at: string | null
          student_id: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          endorsed_at?: string | null
          endorsed_by?: string | null
          id?: string
          level?: string | null
          name: string
          notes?: string | null
          owner?: string | null
          parent_id: string
          recorded_at?: string | null
          student_id: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          endorsed_at?: string | null
          endorsed_by?: string | null
          id?: string
          level?: string | null
          name?: string
          notes?: string | null
          owner?: string | null
          parent_id?: string
          recorded_at?: string | null
          student_id?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_skills_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_streaks: {
        Row: {
          created_at: string | null
          current_count: number | null
          id: string
          last_recorded: string | null
          longest_count: number | null
          parent_id: string
          student_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_count?: number | null
          id?: string
          last_recorded?: string | null
          longest_count?: number | null
          parent_id: string
          student_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_count?: number | null
          id?: string
          last_recorded?: string | null
          longest_count?: number | null
          parent_id?: string
          student_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_streaks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      child_vibe_id: {
        Row: {
          auth_user_id: string | null
          autonomy_level: number | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          granted_at: string | null
          id: string
          parent_id: string
          status: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          autonomy_level?: number | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          granted_at?: string | null
          id?: string
          parent_id: string
          status?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          autonomy_level?: number | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          granted_at?: string | null
          id?: string
          parent_id?: string
          status?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_vibe_id_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_group_members: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          student_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          student_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_groups: {
        Row: {
          class_id: string
          color: string
          created_at: string | null
          id: string
          name: string
          type: string
        }
        Insert: {
          class_id: string
          color?: string
          created_at?: string | null
          id?: string
          name: string
          type?: string
        }
        Update: {
          class_id?: string
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_groups_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_join_requests: {
        Row: {
          class_id: string
          created_at: string
          id: string
          parent_id: string
          status: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          parent_id: string
          status?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          parent_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_join_requests_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_join_requests_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_join_requests_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_join_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string | null
          id: string
          name: string
          school_id: string | null
          stream: string | null
          subject: string
          teacher_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          school_id?: string | null
          stream?: string | null
          subject?: string
          teacher_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          school_id?: string | null
          stream?: string | null
          subject?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      country_majority_ages: {
        Row: {
          country_code: string
          created_at: string
          majority_age: number
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          majority_age?: number
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          majority_age?: number
          updated_at?: string
        }
        Relationships: []
      }
      course_enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          learner_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          learner_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          learner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          badge: string | null
          created_at: string | null
          description: string | null
          domain: string
          duration_label: string | null
          id: string
          institution: string | null
          level: string | null
          modules_count: number | null
          slug: string
          status: string
          title: string
          weeks_count: number | null
        }
        Insert: {
          badge?: string | null
          created_at?: string | null
          description?: string | null
          domain: string
          duration_label?: string | null
          id?: string
          institution?: string | null
          level?: string | null
          modules_count?: number | null
          slug: string
          status?: string
          title: string
          weeks_count?: number | null
        }
        Update: {
          badge?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string
          duration_label?: string | null
          id?: string
          institution?: string | null
          level?: string | null
          modules_count?: number | null
          slug?: string
          status?: string
          title?: string
          weeks_count?: number | null
        }
        Relationships: []
      }
      curriculum: {
        Row: {
          created_at: string | null
          curriculum: string
          grade: string
          id: string
          periods: number | null
          reference: string | null
          strand: string
          sub_strand: string
          subject: string
          term: number
          topic: string
          week: number
        }
        Insert: {
          created_at?: string | null
          curriculum: string
          grade: string
          id?: string
          periods?: number | null
          reference?: string | null
          strand: string
          sub_strand: string
          subject: string
          term: number
          topic: string
          week: number
        }
        Update: {
          created_at?: string | null
          curriculum?: string
          grade?: string
          id?: string
          periods?: number | null
          reference?: string | null
          strand?: string
          sub_strand?: string
          subject?: string
          term?: number
          topic?: string
          week?: number
        }
        Relationships: []
      }
      exam_flags: {
        Row: {
          created_at: string
          flag_type: string
          id: string
          question_text: string
          reason: string | null
          session_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          flag_type: string
          id?: string
          question_text: string
          reason?: string | null
          session_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          flag_type?: string
          id?: string
          question_text?: string
          reason?: string | null
          session_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_flags_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_question_bank: {
        Row: {
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
        }
        Insert: {
          correct_index: number
          created_at?: string
          difficulty: Database["public"]["Enums"]["exam_difficulty"]
          explanation: string
          form: Database["public"]["Enums"]["exam_form"]
          hint?: string | null
          id?: string
          options: Json
          question: string
          source?: string
          status?: string
          subject: Database["public"]["Enums"]["exam_subject"]
          teaching_note: string
          times_flagged?: number
          times_served?: number
          topic: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["exam_difficulty"]
          explanation?: string
          form?: Database["public"]["Enums"]["exam_form"]
          hint?: string | null
          id?: string
          options?: Json
          question?: string
          source?: string
          status?: string
          subject?: Database["public"]["Enums"]["exam_subject"]
          teaching_note?: string
          times_flagged?: number
          times_served?: number
          topic?: string
        }
        Relationships: []
      }
      exam_question_log: {
        Row: {
          correct_index: number
          created_at: string
          id: string
          is_correct: boolean
          question_index: number
          question_text: string
          selected_index: number | null
          session_id: string
          time_spent_secs: number
          topic: string
        }
        Insert: {
          correct_index: number
          created_at?: string
          id?: string
          is_correct?: boolean
          question_index: number
          question_text: string
          selected_index?: number | null
          session_id: string
          time_spent_secs?: number
          topic: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          id?: string
          is_correct?: boolean
          question_index?: number
          question_text?: string
          selected_index?: number | null
          session_id?: string
          time_spent_secs?: number
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_question_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          class_id: string
          created_at: string
          exam_id: string
          id: string
          is_absent: boolean
          marks: number
          school_id: string
          student_id: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          exam_id: string
          id?: string
          is_absent?: boolean
          marks: number
          school_id: string
          student_id: string
          subject_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          exam_id?: string
          id?: string
          is_absent?: boolean
          marks?: number
          school_id?: string
          student_id?: string
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sessions: {
        Row: {
          anon_token: string | null
          completed_at: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["exam_difficulty"]
          form: Database["public"]["Enums"]["exam_form"]
          id: string
          knec_grade: string
          percentage: number
          score: number
          started_at: string
          subject: Database["public"]["Enums"]["exam_subject"]
          topic: string
          total_questions: number
          user_id: string | null
        }
        Insert: {
          anon_token?: string | null
          completed_at?: string | null
          created_at?: string
          difficulty: Database["public"]["Enums"]["exam_difficulty"]
          form: Database["public"]["Enums"]["exam_form"]
          id?: string
          knec_grade?: string
          percentage?: number
          score?: number
          started_at?: string
          subject: Database["public"]["Enums"]["exam_subject"]
          topic: string
          total_questions: number
          user_id?: string | null
        }
        Update: {
          anon_token?: string | null
          completed_at?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["exam_difficulty"]
          form?: Database["public"]["Enums"]["exam_form"]
          id?: string
          knec_grade?: string
          percentage?: number
          score?: number
          started_at?: string
          subject?: Database["public"]["Enums"]["exam_subject"]
          topic?: string
          total_questions?: number
          user_id?: string | null
        }
        Relationships: []
      }
      exam_streaks: {
        Row: {
          current_streak: number
          last_active_date: string
          longest_streak: number
          total_exams: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_active_date?: string
          longest_streak?: number
          total_exams?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_active_date?: string
          longest_streak?: number
          total_exams?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exam_subject_config: {
        Row: {
          exam_id: string
          id: string
          max_marks: number
          pass_mark: number
          subject_id: string
        }
        Insert: {
          exam_id: string
          id?: string
          max_marks?: number
          pass_mark: number
          subject_id: string
        }
        Update: {
          exam_id?: string
          id?: string
          max_marks?: number
          pass_mark?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_subject_config_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_subject_config_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          academic_year: number
          created_at: string
          created_by: string
          exam_type: string
          id: string
          is_locked: boolean
          name: string
          pass_mark: number
          school_id: string
          term: number
        }
        Insert: {
          academic_year: number
          created_at?: string
          created_by: string
          exam_type?: string
          id?: string
          is_locked?: boolean
          name: string
          pass_mark?: number
          school_id: string
          term: number
        }
        Update: {
          academic_year?: number
          created_at?: string
          created_by?: string
          exam_type?: string
          id?: string
          is_locked?: boolean
          name?: string
          pass_mark?: number
          school_id?: string
          term?: number
        }
        Relationships: [
          {
            foreignKeyName: "exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string | null
          created_by: string
          deleted_at: string | null
          id: string
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          deleted_at?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          deleted_at?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          family_id: string
          id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          family_id: string
          id?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          family_id?: string
          id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_accounts: {
        Row: {
          code: string
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          school_id: string
          type: string
        }
        Insert: {
          code: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          school_id: string
          type: string
        }
        Update: {
          code?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          school_id?: string
          type?: string
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
      finance_annual_budgets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          financial_year: number
          id: string
          label: string
          notes: string | null
          school_id: string
          status: string
          submitted_at: string | null
          total_expenditure: number
          total_income: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          financial_year: number
          id?: string
          label: string
          notes?: string | null
          school_id: string
          status?: string
          submitted_at?: string | null
          total_expenditure?: number
          total_income?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          financial_year?: number
          id?: string
          label?: string
          notes?: string | null
          school_id?: string
          status?: string
          submitted_at?: string | null
          total_expenditure?: number
          total_income?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_annual_budgets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_annual_budgets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_annual_budgets_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_annual_budgets_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_annual_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_annual_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_annual_budgets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_approvals: {
        Row: {
          approved_by: string | null
          created_at: string | null
          id: string
          note: string | null
          record_id: string
          record_type: string
          requested_by: string | null
          school_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          record_id: string
          record_type: string
          requested_by?: string | null
          school_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          record_id?: string
          record_type?: string
          requested_by?: string | null
          school_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_approvals_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_bank_accounts: {
        Row: {
          account_number: string | null
          created_at: string | null
          current_balance: number | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          name: string
          school_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          created_at?: string | null
          current_balance?: number | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          school_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          created_at?: string | null
          current_balance?: number | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          school_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_bank_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_budgets: {
        Row: {
          account_id: string
          amount: number
          annual_budget_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          label: string | null
          notes: string | null
          school_id: string
          term: string
          updated_at: string | null
          year: number
        }
        Insert: {
          account_id: string
          amount: number
          annual_budget_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          school_id: string
          term: string
          updated_at?: string | null
          year: number
        }
        Update: {
          account_id?: string
          amount?: number
          annual_budget_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          school_id?: string
          term?: string
          updated_at?: string | null
          year?: number
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
            foreignKeyName: "finance_budgets_annual_budget_id_fkey"
            columns: ["annual_budget_id"]
            isOneToOne: false
            referencedRelation: "finance_annual_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
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
      finance_credit_notes: {
        Row: {
          amount: number
          created_at: string | null
          deleted_at: string | null
          id: string
          invoice_id: string
          issued_by: string | null
          reason: string
          school_id: string
          student_id: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          invoice_id: string
          issued_by?: string | null
          reason: string
          school_id: string
          student_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          invoice_id?: string
          issued_by?: string | null
          reason?: string
          school_id?: string
          student_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_notes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_notes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_notes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expenses: {
        Row: {
          account_id: string | null
          amount: number
          approved_by: string | null
          bank_account_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string
          expense_date: string
          id: string
          paid_via: string | null
          receipt_url: string | null
          school_id: string
          transaction_id: string | null
          vendor: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          approved_by?: string | null
          bank_account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description: string
          expense_date?: string
          id?: string
          paid_via?: string | null
          receipt_url?: string | null
          school_id: string
          transaction_id?: string | null
          vendor?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          approved_by?: string | null
          bank_account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          expense_date?: string
          id?: string
          paid_via?: string | null
          receipt_url?: string | null
          school_id?: string
          transaction_id?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "finance_expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_fee_payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          fee_structure_id: string | null
          id: string
          method: string | null
          notes: string | null
          parent_id: string
          receipt_url: string | null
          recorded_at: string | null
          reference: string | null
          school_id: string | null
          student_id: string
          term: string | null
          year: number | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          fee_structure_id?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          parent_id: string
          receipt_url?: string | null
          recorded_at?: string | null
          reference?: string | null
          school_id?: string | null
          student_id: string
          term?: string | null
          year?: number | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          fee_structure_id?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          parent_id?: string
          receipt_url?: string | null
          recorded_at?: string | null
          reference?: string | null
          school_id?: string | null
          student_id?: string
          term?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_fee_payments_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "finance_fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_fee_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_fee_structures: {
        Row: {
          amount: number
          class_id: string | null
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          id: string
          label: string
          school_id: string
          term: string
          updated_at: string | null
          year: number
        }
        Insert: {
          amount: number
          class_id?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          id?: string
          label: string
          school_id: string
          term: string
          updated_at?: string | null
          year: number
        }
        Update: {
          amount?: number
          class_id?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          id?: string
          label?: string
          school_id?: string
          term?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_fee_structures_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_fee_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_invoice_lines: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string | null
          description: string
          id: string
          invoice_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_invoice_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_invoice_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "finance_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_aging"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_invoices: {
        Row: {
          class_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          paid_amount: number
          school_id: string
          status: string
          student_id: string
          term: string
          total_amount: number
          updated_at: string | null
          year: number
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          school_id: string
          status?: string
          student_id: string
          term: string
          total_amount?: number
          updated_at?: string | null
          year: number
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          school_id?: string
          status?: string
          student_id?: string
          term?: string
          total_amount?: number
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_invoices_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
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
      finance_mpesa_statements: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          matched_payment_id: string | null
          raw_message: string | null
          reference: string | null
          school_id: string
          sender_name: string | null
          sender_phone: string | null
          status: string
          transaction_date: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          matched_payment_id?: string | null
          raw_message?: string | null
          reference?: string | null
          school_id: string
          sender_name?: string | null
          sender_phone?: string | null
          status?: string
          transaction_date?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          matched_payment_id?: string | null
          raw_message?: string | null
          reference?: string | null
          school_id?: string
          sender_name?: string | null
          sender_phone?: string | null
          status?: string
          transaction_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_mpesa_statements_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "finance_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_mpesa_statements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          invoice_id: string
          method: string
          notes: string | null
          receipt_number: string | null
          received_at: string | null
          received_by: string | null
          reference: string | null
          school_id: string
          student_id: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          invoice_id: string
          method: string
          notes?: string | null
          receipt_number?: string | null
          received_at?: string | null
          received_by?: string | null
          reference?: string | null
          school_id: string
          student_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          receipt_number?: string | null
          received_at?: string | null
          received_by?: string | null
          reference?: string | null
          school_id?: string
          student_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payroll_lines: {
        Row: {
          created_at: string | null
          deductions: number | null
          gross: number
          id: string
          net: number
          paid_via: string | null
          reference: string | null
          run_id: string
          staff_id: string
          transaction_id: string | null
        }
        Insert: {
          created_at?: string | null
          deductions?: number | null
          gross: number
          id?: string
          net: number
          paid_via?: string | null
          reference?: string | null
          run_id: string
          staff_id: string
          transaction_id?: string | null
        }
        Update: {
          created_at?: string | null
          deductions?: number | null
          gross?: number
          id?: string
          net?: number
          paid_via?: string | null
          reference?: string | null
          run_id?: string
          staff_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_payroll_lines_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "finance_payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payroll_lines_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payroll_lines_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payroll_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payroll_runs: {
        Row: {
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          month: number
          paid_at: string | null
          school_id: string
          status: string
          total: number | null
          year: number
        }
        Insert: {
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          month: number
          paid_at?: string | null
          school_id: string
          status?: string
          total?: number | null
          year: number
        }
        Update: {
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          month?: number
          paid_at?: string | null
          school_id?: string
          status?: string
          total?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_payroll_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payroll_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payroll_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payroll_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payroll_runs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          id: string
          school_id: string
          status: string
          term: string
          year: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          id?: string
          school_id: string
          status?: string
          term: string
          year: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          id?: string
          school_id?: string
          status?: string
          term?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_pocket_money: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          description: string | null
          id: string
          parent_id: string
          recorded_at: string | null
          student_id: string
          type: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          parent_id: string
          recorded_at?: string | null
          student_id: string
          type: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          parent_id?: string
          recorded_at?: string | null
          student_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_pocket_money_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_reallocations: {
        Row: {
          amount: number
          annual_budget_id: string
          from_budget_line_id: string
          id: string
          reason: string
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: string
          to_budget_line_id: string
        }
        Insert: {
          amount: number
          annual_budget_id: string
          from_budget_line_id: string
          id?: string
          reason: string
          requested_at?: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: string
          to_budget_line_id: string
        }
        Update: {
          amount?: number
          annual_budget_id?: string
          from_budget_line_id?: string
          id?: string
          reason?: string
          requested_at?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: string
          to_budget_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_reallocations_annual_budget_id_fkey"
            columns: ["annual_budget_id"]
            isOneToOne: false
            referencedRelation: "finance_annual_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_reallocations_from_budget_line_id_fkey"
            columns: ["from_budget_line_id"]
            isOneToOne: false
            referencedRelation: "finance_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_reallocations_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_reallocations_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_reallocations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_reallocations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_reallocations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_reallocations_to_budget_line_id_fkey"
            columns: ["to_budget_line_id"]
            isOneToOne: false
            referencedRelation: "finance_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_receipt_sequences: {
        Row: {
          id: string
          last_number: number
          prefix: string
          school_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          last_number?: number
          prefix?: string
          school_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          last_number?: number
          prefix?: string
          school_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_receipt_sequences_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_recurring_entries: {
        Row: {
          account_id: string
          amount: number
          created_at: string | null
          created_by: string | null
          description: string
          frequency: string
          id: string
          is_active: boolean | null
          last_posted: string | null
          next_due_date: string
          school_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string | null
          created_by?: string | null
          description: string
          frequency: string
          id?: string
          is_active?: boolean | null
          last_posted?: string | null
          next_due_date: string
          school_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_posted?: string | null
          next_due_date?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_recurring_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_recurring_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "finance_recurring_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_recurring_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_recurring_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_roles: {
        Row: {
          appointed_at: string
          appointed_by: string
          id: string
          is_bursar: boolean
          profile_id: string
          revoke_reason: string | null
          revoked_at: string | null
          school_id: string
        }
        Insert: {
          appointed_at?: string
          appointed_by: string
          id?: string
          is_bursar?: boolean
          profile_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          school_id: string
        }
        Update: {
          appointed_at?: string
          appointed_by?: string
          id?: string
          is_bursar?: boolean
          profile_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_roles_appointed_by_fkey"
            columns: ["appointed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_roles_appointed_by_fkey"
            columns: ["appointed_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_savings_contributions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          goal_id: string
          id: string
          notes: string | null
          parent_id: string
          recorded_at: string | null
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          goal_id: string
          id?: string
          notes?: string | null
          parent_id: string
          recorded_at?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          goal_id?: string
          id?: string
          notes?: string | null
          parent_id?: string
          recorded_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_savings_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "finance_savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_savings_contributions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_savings_goals: {
        Row: {
          achieved_at: string | null
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          description: string | null
          id: string
          parent_id: string
          recorded_at: string | null
          saved_amount: number | null
          status: string | null
          student_id: string
          target_amount: number
          target_date: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          parent_id: string
          recorded_at?: string | null
          saved_amount?: number | null
          status?: string | null
          student_id: string
          target_amount: number
          target_date?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          achieved_at?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          parent_id?: string
          recorded_at?: string | null
          saved_amount?: number | null
          status?: string | null
          student_id?: string
          target_amount?: number
          target_date?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_savings_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_tax_rates: {
        Row: {
          applies_to: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          rate: number
          school_id: string
        }
        Insert: {
          applies_to: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          rate: number
          school_id: string
        }
        Update: {
          applies_to?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          rate?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_tax_rates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transaction_lines: {
        Row: {
          account_id: string
          created_at: string | null
          credit: number | null
          debit: number | null
          id: string
          note: string | null
          transaction_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          id?: string
          note?: string | null
          transaction_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          id?: string
          note?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transaction_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transaction_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "finance_transaction_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transaction_taxes: {
        Row: {
          base_amount: number
          created_at: string | null
          id: string
          tax_amount: number
          tax_rate_id: string
          transaction_id: string
        }
        Insert: {
          base_amount: number
          created_at?: string | null
          id?: string
          tax_amount: number
          tax_rate_id: string
          transaction_id: string
        }
        Update: {
          base_amount?: number
          created_at?: string | null
          id?: string
          tax_amount?: number
          tax_rate_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transaction_taxes_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "finance_tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transaction_taxes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          description: string
          id: string
          reference: string | null
          school_id: string
          type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          description: string
          id?: string
          reference?: string | null
          school_id: string
          type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          reference?: string | null
          school_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          created_at: string | null
          front: string
          grade: number | null
          id: string
          school_id: string | null
          student_id: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          back: string
          created_at?: string | null
          front: string
          grade?: number | null
          id?: string
          school_id?: string | null
          student_id?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          back?: string
          created_at?: string | null
          front?: string
          grade?: number | null
          id?: string
          school_id?: string | null
          student_id?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_sheets: {
        Row: {
          content: string | null
          created_at: string | null
          grade: number | null
          id: string
          school_id: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          grade?: number | null
          id?: string
          school_id?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          grade?: number | null
          id?: string
          school_id?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formula_sheets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_achievements: {
        Row: {
          badge_slug: string
          earned_at: string | null
          id: string
          student_id: string | null
        }
        Insert: {
          badge_slug: string
          earned_at?: string | null
          id?: string
          student_id?: string | null
        }
        Update: {
          badge_slug?: string
          earned_at?: string | null
          id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funhub_achievements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_challenges: {
        Row: {
          challenged_id: string | null
          challenged_score: number | null
          challenger_id: string | null
          challenger_score: number
          created_at: string | null
          expires_at: string | null
          game_slug: string
          id: string
          status: string | null
        }
        Insert: {
          challenged_id?: string | null
          challenged_score?: number | null
          challenger_id?: string | null
          challenger_score: number
          created_at?: string | null
          expires_at?: string | null
          game_slug: string
          id?: string
          status?: string | null
        }
        Update: {
          challenged_id?: string | null
          challenged_score?: number | null
          challenger_id?: string | null
          challenger_score?: number
          created_at?: string | null
          expires_at?: string | null
          game_slug?: string
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funhub_challenges_challenged_id_fkey"
            columns: ["challenged_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funhub_challenges_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_claims: {
        Row: {
          claimed_at: string | null
          collected_at: string | null
          id: string
          redemption_code: string
          status: string
          student_id: string
          voucher_id: string
        }
        Insert: {
          claimed_at?: string | null
          collected_at?: string | null
          id?: string
          redemption_code?: string
          status?: string
          student_id: string
          voucher_id: string
        }
        Update: {
          claimed_at?: string | null
          collected_at?: string | null
          id?: string
          redemption_code?: string
          status?: string
          student_id?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funhub_claims_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funhub_claims_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "funhub_vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_exam_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          exam_id: string | null
          id: string
          percentage: number | null
          score: number | null
          started_at: string | null
          status: string | null
          student_id: string | null
          time_taken: number | null
          total_marks: number
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          exam_id?: string | null
          id?: string
          percentage?: number | null
          score?: number | null
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          time_taken?: number | null
          total_marks?: number
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          exam_id?: string | null
          id?: string
          percentage?: number | null
          score?: number | null
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          time_taken?: number | null
          total_marks?: number
        }
        Relationships: [
          {
            foreignKeyName: "funhub_exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "funhub_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funhub_exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_exam_questions: {
        Row: {
          exam_id: string
          position: number
          question_id: string
        }
        Insert: {
          exam_id: string
          position?: number
          question_id: string
        }
        Update: {
          exam_id?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funhub_exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "funhub_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funhub_exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "funhub_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_exams: {
        Row: {
          created_at: string | null
          duration_mins: number
          expires_at: string | null
          grade: number
          id: string
          parent_id: string | null
          status: string | null
          student_id: string | null
          subject: string
          title: string
          total_marks: number
        }
        Insert: {
          created_at?: string | null
          duration_mins?: number
          expires_at?: string | null
          grade: number
          id?: string
          parent_id?: string | null
          status?: string | null
          student_id?: string | null
          subject: string
          title: string
          total_marks?: number
        }
        Update: {
          created_at?: string | null
          duration_mins?: number
          expires_at?: string | null
          grade?: number
          id?: string
          parent_id?: string | null
          status?: string | null
          student_id?: string | null
          subject?: string
          title?: string
          total_marks?: number
        }
        Relationships: [
          {
            foreignKeyName: "funhub_exams_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funhub_exams_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funhub_exams_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_games: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          icon: string
          id: string
          is_active: boolean | null
          name: string
          slug: string
          subject: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          icon: string
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          subject?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          subject?: string | null
        }
        Relationships: []
      }
      funhub_leaderboard: {
        Row: {
          all_time_xp: number | null
          class_id: string | null
          id: string
          monthly_xp: number | null
          rank_class: number | null
          rank_school: number | null
          school_id: string | null
          student_id: string | null
          updated_at: string | null
          weekly_xp: number | null
        }
        Insert: {
          all_time_xp?: number | null
          class_id?: string | null
          id?: string
          monthly_xp?: number | null
          rank_class?: number | null
          rank_school?: number | null
          school_id?: string | null
          student_id?: string | null
          updated_at?: string | null
          weekly_xp?: number | null
        }
        Update: {
          all_time_xp?: number | null
          class_id?: string | null
          id?: string
          monthly_xp?: number | null
          rank_class?: number | null
          rank_school?: number | null
          school_id?: string | null
          student_id?: string | null
          updated_at?: string | null
          weekly_xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funhub_leaderboard_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funhub_leaderboard_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funhub_leaderboard_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_questions: {
        Row: {
          approved: boolean | null
          correct: string
          created_at: string | null
          difficulty: string | null
          explanation: string | null
          grade: number | null
          id: string
          options: Json
          question_text: string
          source: string | null
          strand: string | null
          sub_strand: string | null
          subject: string
          teacher_id: string | null
          type: string | null
        }
        Insert: {
          approved?: boolean | null
          correct: string
          created_at?: string | null
          difficulty?: string | null
          explanation?: string | null
          grade?: number | null
          id?: string
          options: Json
          question_text: string
          source?: string | null
          strand?: string | null
          sub_strand?: string | null
          subject: string
          teacher_id?: string | null
          type?: string | null
        }
        Update: {
          approved?: boolean | null
          correct?: string
          created_at?: string | null
          difficulty?: string | null
          explanation?: string | null
          grade?: number | null
          id?: string
          options?: Json
          question_text?: string
          source?: string | null
          strand?: string | null
          sub_strand?: string | null
          subject?: string
          teacher_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funhub_questions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funhub_questions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_sessions: {
        Row: {
          completed: boolean | null
          correct: number | null
          duration_secs: number | null
          game_slug: string
          grade: number | null
          id: string
          played_at: string | null
          score: number | null
          streak_max: number | null
          student_id: string | null
          subject: string | null
          total: number | null
          xp_earned: number | null
        }
        Insert: {
          completed?: boolean | null
          correct?: number | null
          duration_secs?: number | null
          game_slug: string
          grade?: number | null
          id?: string
          played_at?: string | null
          score?: number | null
          streak_max?: number | null
          student_id?: string | null
          subject?: string | null
          total?: number | null
          xp_earned?: number | null
        }
        Update: {
          completed?: boolean | null
          correct?: number | null
          duration_secs?: number | null
          game_slug?: string
          grade?: number | null
          id?: string
          played_at?: string | null
          score?: number | null
          streak_max?: number | null
          student_id?: string | null
          subject?: string | null
          total?: number | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funhub_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_streaks: {
        Row: {
          current_count: number | null
          id: string
          last_played: string | null
          longest_count: number | null
          student_id: string | null
          subject: string
        }
        Insert: {
          current_count?: number | null
          id?: string
          last_played?: string | null
          longest_count?: number | null
          student_id?: string | null
          subject: string
        }
        Update: {
          current_count?: number | null
          id?: string
          last_played?: string | null
          longest_count?: number | null
          student_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "funhub_streaks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_trivia: {
        Row: {
          category: string
          correct: string
          created_at: string | null
          difficulty: string | null
          explanation: string | null
          grade_max: number | null
          grade_min: number | null
          id: string
          options: Json
          question_text: string
        }
        Insert: {
          category: string
          correct: string
          created_at?: string | null
          difficulty?: string | null
          explanation?: string | null
          grade_max?: number | null
          grade_min?: number | null
          id?: string
          options: Json
          question_text: string
        }
        Update: {
          category?: string
          correct?: string
          created_at?: string | null
          difficulty?: string | null
          explanation?: string | null
          grade_max?: number | null
          grade_min?: number | null
          id?: string
          options?: Json
          question_text?: string
        }
        Relationships: []
      }
      funhub_vouchers: {
        Row: {
          category: string
          claimed_count: number
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          sponsor_name: string
          title: string
          total_pool: number
          xp_cost: number
        }
        Insert: {
          category?: string
          claimed_count?: number
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          sponsor_name: string
          title: string
          total_pool?: number
          xp_cost: number
        }
        Update: {
          category?: string
          claimed_count?: number
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          sponsor_name?: string
          title?: string
          total_pool?: number
          xp_cost?: number
        }
        Relationships: []
      }
      funhub_xp: {
        Row: {
          id: string
          level: number | null
          month_reset_at: string | null
          monthly_xp: number | null
          student_id: string | null
          total_xp: number | null
          updated_at: string | null
          week_reset_at: string | null
          weekly_xp: number | null
        }
        Insert: {
          id?: string
          level?: number | null
          month_reset_at?: string | null
          monthly_xp?: number | null
          student_id?: string | null
          total_xp?: number | null
          updated_at?: string | null
          week_reset_at?: string | null
          weekly_xp?: number | null
        }
        Update: {
          id?: string
          level?: number | null
          month_reset_at?: string | null
          monthly_xp?: number | null
          student_id?: string | null
          total_xp?: number | null
          updated_at?: string | null
          week_reset_at?: string | null
          weekly_xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funhub_xp_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_xp_ledger: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          reference_id: string | null
          source: string
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          reference_id?: string | null
          source?: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          reference_id?: string | null
          source?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funhub_xp_ledger_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      gender_types: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      health_records: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          doctor_name: string | null
          document_url: string | null
          facility: string | null
          follow_up: string | null
          id: string
          outcome: string | null
          parent_id: string
          recorded_at: string | null
          student_id: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          doctor_name?: string | null
          document_url?: string | null
          facility?: string | null
          follow_up?: string | null
          id?: string
          outcome?: string | null
          parent_id: string
          recorded_at?: string | null
          student_id: string
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          doctor_name?: string | null
          document_url?: string | null
          facility?: string | null
          follow_up?: string | null
          id?: string
          outcome?: string | null
          parent_id?: string
          recorded_at?: string | null
          student_id?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      health_vaccinations: {
        Row: {
          administered_by: string | null
          created_at: string | null
          deleted_at: string | null
          document_url: string | null
          dose: string | null
          facility: string | null
          id: string
          name: string
          next_due: string | null
          parent_id: string
          recorded_at: string | null
          student_id: string
        }
        Insert: {
          administered_by?: string | null
          created_at?: string | null
          deleted_at?: string | null
          document_url?: string | null
          dose?: string | null
          facility?: string | null
          id?: string
          name: string
          next_due?: string | null
          parent_id: string
          recorded_at?: string | null
          student_id: string
        }
        Update: {
          administered_by?: string | null
          created_at?: string | null
          deleted_at?: string | null
          document_url?: string | null
          dose?: string | null
          facility?: string | null
          id?: string
          name?: string
          next_due?: string | null
          parent_id?: string
          recorded_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_vaccinations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          class_id: string | null
          created_at: string | null
          due_date: string | null
          id: string
          instructions: string | null
          school_id: string | null
          subject: string | null
          target_group_id: string | null
          teacher_id: string | null
          title: string
          type: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          school_id?: string | null
          subject?: string | null
          target_group_id?: string | null
          teacher_id?: string | null
          title: string
          type?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          school_id?: string | null
          subject?: string | null
          target_group_id?: string | null
          teacher_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_answers: {
        Row: {
          answer_text: string | null
          created_at: string | null
          id: string
          question_id: string | null
          submission_id: string | null
        }
        Insert: {
          answer_text?: string | null
          created_at?: string | null
          id?: string
          question_id?: string | null
          submission_id?: string | null
        }
        Update: {
          answer_text?: string | null
          created_at?: string | null
          id?: string
          question_id?: string | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "homework_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "homework_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_questions: {
        Row: {
          homework_id: string | null
          id: string
          order_num: number
          question: string
        }
        Insert: {
          homework_id?: string | null
          id?: string
          order_num?: number
          question: string
        }
        Update: {
          homework_id?: string | null
          id?: string
          order_num?: number
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_questions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          created_at: string | null
          feedback: string | null
          homework_id: string | null
          id: string
          mark: number | null
          photo_url: string | null
          status: string
          student_id: string | null
          submitted_at: string | null
        }
        Insert: {
          created_at?: string | null
          feedback?: string | null
          homework_id?: string | null
          id?: string
          mark?: number | null
          photo_url?: string | null
          status?: string
          student_id?: string | null
          submitted_at?: string | null
        }
        Update: {
          created_at?: string | null
          feedback?: string | null
          homework_id?: string | null
          id?: string
          mark?: number | null
          photo_url?: string | null
          status?: string
          student_id?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          failed_attempts: number
          id: string
          locked_until: string | null
          max_uses: number
          school_id: string
          use_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          max_uses: number
          school_id: string
          use_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          max_uses?: number
          school_id?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_outcomes: {
        Row: {
          assessed_at: string | null
          curriculum_type: string | null
          grade: string | null
          id: string
          outcome_text: string | null
          school_id: string | null
          score: number | null
          status: string | null
          strand: string | null
          student_id: string | null
          subject_id: string | null
        }
        Insert: {
          assessed_at?: string | null
          curriculum_type?: string | null
          grade?: string | null
          id?: string
          outcome_text?: string | null
          school_id?: string | null
          score?: number | null
          status?: string | null
          strand?: string | null
          student_id?: string | null
          subject_id?: string | null
        }
        Update: {
          assessed_at?: string | null
          curriculum_type?: string | null
          grade?: string | null
          id?: string
          outcome_text?: string | null
          school_id?: string | null
          score?: number | null
          status?: string | null
          strand?: string | null
          student_id?: string | null
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learner_outcomes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_profiles: {
        Row: {
          avatar_initials: string | null
          created_at: string | null
          display_name: string | null
          id: string
          last_active_date: string | null
          preferred_language: string | null
          streak_days: number | null
        }
        Insert: {
          avatar_initials?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          last_active_date?: string | null
          preferred_language?: string | null
          streak_days?: number | null
        }
        Update: {
          avatar_initials?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          last_active_date?: string | null
          preferred_language?: string | null
          streak_days?: number | null
        }
        Relationships: []
      }
      learner_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          learner_id: string
          quiz_score: number | null
          topic_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          learner_id: string
          quiz_score?: number | null
          topic_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          learner_id?: string
          quiz_score?: number | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_progress_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_content: {
        Row: {
          content_type: string
          created_at: string | null
          due_date: string | null
          generated_by: string | null
          id: string
          lesson_plan_id: string | null
          marking_guide: string | null
          question_count: number | null
          scheme_id: string | null
          school_id: string | null
          student_copy: string | null
          teacher_copy: string | null
          teacher_id: string | null
          total_marks: number | null
          updated_at: string | null
        }
        Insert: {
          content_type: string
          created_at?: string | null
          due_date?: string | null
          generated_by?: string | null
          id?: string
          lesson_plan_id?: string | null
          marking_guide?: string | null
          question_count?: number | null
          scheme_id?: string | null
          school_id?: string | null
          student_copy?: string | null
          teacher_copy?: string | null
          teacher_id?: string | null
          total_marks?: number | null
          updated_at?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string | null
          due_date?: string | null
          generated_by?: string | null
          id?: string
          lesson_plan_id?: string | null
          marking_guide?: string | null
          question_count?: number | null
          scheme_id?: string | null
          school_id?: string | null
          student_copy?: string | null
          teacher_copy?: string | null
          teacher_id?: string | null
          total_marks?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_content_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_content_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "scheme_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_content_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_content_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_content_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          challenges: string | null
          class_id: string | null
          created_at: string | null
          homework_set: string | null
          id: string
          lesson_plan_id: string | null
          participation_score: number | null
          school_id: string | null
          subject_id: string | null
          taught_date: string
          teacher_id: string | null
          updated_at: string | null
          what_was_taught: string
        }
        Insert: {
          challenges?: string | null
          class_id?: string | null
          created_at?: string | null
          homework_set?: string | null
          id?: string
          lesson_plan_id?: string | null
          participation_score?: number | null
          school_id?: string | null
          subject_id?: string | null
          taught_date?: string
          teacher_id?: string | null
          updated_at?: string | null
          what_was_taught: string
        }
        Update: {
          challenges?: string | null
          class_id?: string | null
          created_at?: string | null
          homework_set?: string | null
          id?: string
          lesson_plan_id?: string | null
          participation_score?: number | null
          school_id?: string | null
          subject_id?: string | null
          taught_date?: string
          teacher_id?: string | null
          updated_at?: string | null
          what_was_taught?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plans: {
        Row: {
          body: string | null
          class_id: string
          created_at: string
          day_of_week: number
          duration_minutes: number | null
          generated_by: string
          id: string
          notes: string | null
          objectives: string | null
          school_id: string | null
          status: string
          strand_id: string | null
          subject_id: string
          teacher_id: string
          term: number | null
          timetable_slot_id: string | null
          title: string | null
          topic: string | null
          updated_at: string
          week_start: string
        }
        Insert: {
          body?: string | null
          class_id: string
          created_at?: string
          day_of_week: number
          duration_minutes?: number | null
          generated_by?: string
          id?: string
          notes?: string | null
          objectives?: string | null
          school_id?: string | null
          status?: string
          strand_id?: string | null
          subject_id: string
          teacher_id: string
          term?: number | null
          timetable_slot_id?: string | null
          title?: string | null
          topic?: string | null
          updated_at?: string
          week_start: string
        }
        Update: {
          body?: string | null
          class_id?: string
          created_at?: string
          day_of_week?: number
          duration_minutes?: number | null
          generated_by?: string
          id?: string
          notes?: string | null
          objectives?: string | null
          school_id?: string | null
          status?: string
          strand_id?: string | null
          subject_id?: string
          teacher_id?: string
          term?: number | null
          timetable_slot_id?: string | null
          title?: string | null
          topic?: string | null
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_strand_id_fkey"
            columns: ["strand_id"]
            isOneToOne: false
            referencedRelation: "strands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_timetable_slot_id_fkey"
            columns: ["timetable_slot_id"]
            isOneToOne: false
            referencedRelation: "timetable_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          added_by: string | null
          author: string | null
          available_copies: number | null
          class_level: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          isbn: string | null
          school_id: string | null
          subject: string | null
          title: string
          total_copies: number | null
        }
        Insert: {
          added_by?: string | null
          author?: string | null
          available_copies?: number | null
          class_level?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          isbn?: string | null
          school_id?: string | null
          subject?: string | null
          title: string
          total_copies?: number | null
        }
        Update: {
          added_by?: string | null
          author?: string | null
          available_copies?: number | null
          class_level?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          isbn?: string | null
          school_id?: string | null
          subject?: string | null
          title?: string
          total_copies?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_books_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_books_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_books_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      library_borrowings: {
        Row: {
          book_id: string | null
          borrower_type: string | null
          condition_in: string | null
          condition_out: string | null
          created_at: string | null
          deleted_at: string | null
          due_date: string
          fine_amount: number | null
          fine_paid: boolean | null
          id: string
          issued_at: string | null
          issued_by: string | null
          notes: string | null
          returned_at: string | null
          school_id: string | null
          staff_id: string | null
          student_id: string | null
        }
        Insert: {
          book_id?: string | null
          borrower_type?: string | null
          condition_in?: string | null
          condition_out?: string | null
          created_at?: string | null
          deleted_at?: string | null
          due_date: string
          fine_amount?: number | null
          fine_paid?: boolean | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          notes?: string | null
          returned_at?: string | null
          school_id?: string | null
          staff_id?: string | null
          student_id?: string | null
        }
        Update: {
          book_id?: string | null
          borrower_type?: string | null
          condition_in?: string | null
          condition_out?: string | null
          created_at?: string | null
          deleted_at?: string | null
          due_date?: string
          fine_amount?: number | null
          fine_paid?: boolean | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          notes?: string | null
          returned_at?: string | null
          school_id?: string | null
          staff_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_borrowings_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_borrowings_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_borrowings_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_borrowings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_borrowings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_borrowings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_borrowings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_students: {
        Row: {
          class_name: string | null
          created_at: string | null
          id: string
          name: string
          teacher_id: string
        }
        Insert: {
          class_name?: string | null
          created_at?: string | null
          id?: string
          name: string
          teacher_id: string
        }
        Update: {
          class_name?: string | null
          created_at?: string | null
          id?: string
          name?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_actions: {
        Row: {
          agenda_item_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string | null
          owner_id: string | null
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agenda_item_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          owner_id?: string | null
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agenda_item_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          owner_id?: string | null
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_actions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "meeting_agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_actions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_actions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_actions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agenda_items: {
        Row: {
          created_at: string | null
          description: string | null
          duration_mins: number | null
          id: string
          meeting_id: string | null
          notes: string | null
          order_index: number | null
          presenter_id: string | null
          status: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_mins?: number | null
          id?: string
          meeting_id?: string | null
          notes?: string | null
          order_index?: number | null
          presenter_id?: string | null
          status?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_mins?: number | null
          id?: string
          meeting_id?: string | null
          notes?: string | null
          order_index?: number | null
          presenter_id?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_agenda_items_presenter_id_fkey"
            columns: ["presenter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_agenda_items_presenter_id_fkey"
            columns: ["presenter_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendees: {
        Row: {
          attended: boolean | null
          created_at: string | null
          id: string
          is_mandatory: boolean | null
          meeting_id: string | null
          profile_id: string | null
          role: string | null
          rsvp: string | null
        }
        Insert: {
          attended?: boolean | null
          created_at?: string | null
          id?: string
          is_mandatory?: boolean | null
          meeting_id?: string | null
          profile_id?: string | null
          role?: string | null
          rsvp?: string | null
        }
        Update: {
          attended?: boolean | null
          created_at?: string | null
          id?: string
          is_mandatory?: boolean | null
          meeting_id?: string | null
          profile_id?: string | null
          role?: string | null
          rsvp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minutes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: string | null
          created_at: string | null
          drafted_by: string | null
          id: string
          meeting_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          created_at?: string | null
          drafted_by?: string | null
          id?: string
          meeting_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          created_at?: string | null
          drafted_by?: string | null
          id?: string
          meeting_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_minutes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_minutes_drafted_by_fkey"
            columns: ["drafted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_minutes_drafted_by_fkey"
            columns: ["drafted_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          chair_id: string | null
          confidentiality: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_mins: number | null
          ended_at: string | null
          id: string
          meeting_link: string | null
          meeting_type: string | null
          scheduled_at: string
          school_id: string | null
          secretary_id: string | null
          started_at: string | null
          status: string | null
          title: string
          updated_at: string | null
          venue: string | null
        }
        Insert: {
          chair_id?: string | null
          confidentiality?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_mins?: number | null
          ended_at?: string | null
          id?: string
          meeting_link?: string | null
          meeting_type?: string | null
          scheduled_at: string
          school_id?: string | null
          secretary_id?: string | null
          started_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          venue?: string | null
        }
        Update: {
          chair_id?: string | null
          confidentiality?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_mins?: number | null
          ended_at?: string | null
          id?: string
          meeting_link?: string | null
          meeting_type?: string | null
          scheduled_at?: string
          school_id?: string | null
          secretary_id?: string | null
          started_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_chair_id_fkey"
            columns: ["chair_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_chair_id_fkey"
            columns: ["chair_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_secretary_id_fkey"
            columns: ["secretary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_secretary_id_fkey"
            columns: ["secretary_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          sequence_number: number
          slug: string
          title: string
          weeks_label: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          sequence_number: number
          slug: string
          title: string
          weeks_label?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          sequence_number?: number
          slug?: string
          title?: string
          weeks_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          deleted_at: string | null
          id: string
          is_read: boolean | null
          related_id: string | null
          school_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_read?: boolean | null
          related_id?: string | null
          school_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_read?: boolean | null
          related_id?: string | null
          school_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          generated_by: string
          id: string
          school_id: string
          sent_at: string
          student_id: string
          subject: string | null
          teacher_id: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          generated_by?: string
          id?: string
          school_id: string
          sent_at?: string
          student_id: string
          subject?: string | null
          teacher_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          generated_by?: string
          id?: string
          school_id?: string
          sent_at?: string
          student_id?: string
          subject?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_messages_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_messages_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_profiles: {
        Row: {
          created_at: string
          occupation: string | null
          profile_id: string
          relationship: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          occupation?: string | null
          profile_id: string
          relationship?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          occupation?: string | null
          profile_id?: string
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_profiles_relationship_fkey"
            columns: ["relationship"]
            isOneToOne: false
            referencedRelation: "relationship_types"
            referencedColumns: ["code"]
          },
        ]
      }
      parent_student_links: {
        Row: {
          access_level: string | null
          can_add_goals: boolean | null
          can_add_skills: boolean | null
          can_edit_profile: boolean | null
          can_pickup: boolean
          can_view_finance: boolean | null
          can_view_medical: boolean | null
          created_at: string
          id: string
          is_primary: boolean
          parent_id: string
          receives_alerts: boolean
          relationship: string
          school_id: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          access_level?: string | null
          can_add_goals?: boolean | null
          can_add_skills?: boolean | null
          can_edit_profile?: boolean | null
          can_pickup?: boolean
          can_view_finance?: boolean | null
          can_view_medical?: boolean | null
          created_at?: string
          id?: string
          is_primary?: boolean
          parent_id: string
          receives_alerts?: boolean
          relationship?: string
          school_id?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          access_level?: string | null
          can_add_goals?: boolean | null
          can_add_skills?: boolean | null
          can_edit_profile?: boolean | null
          can_pickup?: boolean
          can_view_finance?: boolean | null
          can_view_medical?: boolean | null
          created_at?: string
          id?: string
          is_primary?: boolean
          parent_id?: string
          receives_alerts?: boolean
          relationship?: string
          school_id?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_relationship_fkey"
            columns: ["relationship"]
            isOneToOne: false
            referencedRelation: "relationship_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "parent_student_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_students: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      past_papers: {
        Row: {
          created_at: string | null
          file_url: string | null
          id: string
          level: string
          school_id: string | null
          subject: string
          title: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          file_url?: string | null
          id?: string
          level: string
          school_id?: string | null
          subject: string
          title: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          file_url?: string | null
          id?: string
          level?: string
          school_id?: string | null
          subject?: string
          title?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "past_papers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["action_type"]
          created_at: string
          executed_at: string | null
          expires_at: string
          first_approved_at: string | null
          first_approver_id: string | null
          id: string
          payload: Json
          rejected_at: string | null
          rejected_by: string | null
          requester_id: string
          school_id: string
          second_approved_at: string | null
          second_approver_id: string | null
          status: Database["public"]["Enums"]["action_status"]
          updated_at: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["action_type"]
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          first_approved_at?: string | null
          first_approver_id?: string | null
          id?: string
          payload: Json
          rejected_at?: string | null
          rejected_by?: string | null
          requester_id: string
          school_id: string
          second_approved_at?: string | null
          second_approver_id?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["action_type"]
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          first_approved_at?: string | null
          first_approver_id?: string | null
          id?: string
          payload?: Json
          rejected_at?: string | null
          rejected_by?: string | null
          requester_id?: string
          school_id?: string
          second_approved_at?: string | null
          second_approver_id?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_actions_first_approver_id_fkey"
            columns: ["first_approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_first_approver_id_fkey"
            columns: ["first_approver_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_second_approver_id_fkey"
            columns: ["second_approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_second_approver_id_fkey"
            columns: ["second_approver_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          anonymized_at: string | null
          arrived_at: string | null
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          gender: string | null
          id: string
          is_anonymized: boolean
          notification_prefs: Json | null
          onboarded_chronicles: boolean | null
          parental_consent_at: string | null
          parental_consent_by: string | null
          phone: string | null
          role: string | null
          school_id: string | null
          updated_at: string
          vc_id: string | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          anonymized_at?: string | null
          arrived_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          gender?: string | null
          id: string
          is_anonymized?: boolean
          notification_prefs?: Json | null
          onboarded_chronicles?: boolean | null
          parental_consent_at?: string | null
          parental_consent_by?: string | null
          phone?: string | null
          role?: string | null
          school_id?: string | null
          updated_at?: string
          vc_id?: string | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          anonymized_at?: string | null
          arrived_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          is_anonymized?: boolean
          notification_prefs?: Json | null
          onboarded_chronicles?: boolean | null
          parental_consent_at?: string | null
          parental_consent_by?: string | null
          phone?: string | null
          role?: string | null
          school_id?: string | null
          updated_at?: string
          vc_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_majority_ages"
            referencedColumns: ["country_code"]
          },
          {
            foreignKeyName: "profiles_parental_consent_by_fkey"
            columns: ["parental_consent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_parental_consent_by_fkey"
            columns: ["parental_consent_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      project_log: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          note: string | null
          payload: Json | null
          project_id: string
          school_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
          payload?: Json | null
          project_id: string
          school_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
          payload?: Json | null
          project_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          added_at: string
          added_by: string | null
          id: string
          profile_id: string
          project_id: string
          removed_at: string | null
          role: string
          school_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          id?: string
          profile_id: string
          project_id: string
          removed_at?: string | null
          role: string
          school_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          id?: string
          profile_id?: string
          project_id?: string
          removed_at?: string | null
          role?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      project_transactions: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          description: string
          id: string
          logged_at: string
          logged_by: string
          milestone_id: string | null
          project_id: string
          receipt_ref: string | null
          return_reason: string | null
          school_id: string
          status: string
          task_ref: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          description: string
          id?: string
          logged_at?: string
          logged_by: string
          milestone_id?: string | null
          project_id: string
          receipt_ref?: string | null
          return_reason?: string | null
          school_id: string
          status?: string
          task_ref?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          description?: string
          id?: string
          logged_at?: string
          logged_by?: string
          milestone_id?: string | null
          project_id?: string
          receipt_ref?: string | null
          return_reason?: string | null
          school_id?: string
          status?: string
          task_ref?: string | null
          updated_at?: string
          vendor?: string | null
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
            foreignKeyName: "project_transactions_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "admin_project_milestones"
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
      quiz_questions: {
        Row: {
          correct_option_id: string
          created_at: string | null
          explanation: string | null
          id: string
          options: Json
          question_text: string
          topic_id: string
        }
        Insert: {
          correct_option_id: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          options: Json
          question_text: string
          topic_id: string
        }
        Update: {
          correct_option_id?: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          options?: Json
          question_text?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_types: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      report_card_remarks: {
        Row: {
          class_id: string
          class_teacher_id: string
          conduct: string | null
          created_at: string
          exam_id: string
          id: string
          remarks: string | null
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          class_teacher_id: string
          conduct?: string | null
          created_at?: string
          exam_id: string
          id?: string
          remarks?: string | null
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          class_teacher_id?: string
          conduct?: string | null
          created_at?: string
          exam_id?: string
          id?: string
          remarks?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_card_remarks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_card_remarks_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_card_remarks_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_card_remarks_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_card_remarks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_card_remarks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      report_comparisons: {
        Row: {
          compare_a: Json
          compare_b: Json
          created_at: string
          created_by: string
          id: string
          label: string
          report_type: string
          school_id: string
        }
        Insert: {
          compare_a: Json
          compare_b: Json
          created_at?: string
          created_by: string
          id?: string
          label: string
          report_type: string
          school_id: string
        }
        Update: {
          compare_a?: Json
          compare_b?: Json
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          report_type?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_comparisons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comparisons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comparisons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          created_at: string
          created_by: string
          filters: Json
          frequency: string
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          recipients: string[]
          report_type: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          filters?: Json
          frequency: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          recipients?: string[]
          report_type: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          filters?: Json
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          recipients?: string[]
          report_type?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_assets: {
        Row: {
          added_by: string | null
          category: string | null
          condition: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          last_checked: string | null
          location: string | null
          name: string
          quantity: number | null
          school_id: string | null
          serial_no: string | null
        }
        Insert: {
          added_by?: string | null
          category?: string | null
          condition?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          last_checked?: string | null
          location?: string | null
          name: string
          quantity?: number | null
          school_id?: string | null
          serial_no?: string | null
        }
        Update: {
          added_by?: string | null
          category?: string | null
          condition?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          last_checked?: string | null
          location?: string | null
          name?: string
          quantity?: number | null
          school_id?: string | null
          serial_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_assets_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_assets_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_assets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_documents: {
        Row: {
          category: string | null
          created_at: string | null
          deleted_at: string | null
          file_size_kb: number | null
          file_type: string | null
          file_url: string | null
          id: string
          school_id: string | null
          title: string
          uploaded_by: string | null
          visibility: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          file_size_kb?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          school_id?: string | null
          title: string
          uploaded_by?: string | null
          visibility?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          file_size_kb?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          school_id?: string | null
          title?: string
          uploaded_by?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_materials: {
        Row: {
          class_id: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          file_size_kb: number | null
          file_type: string | null
          file_url: string | null
          id: string
          school_id: string | null
          subject: string | null
          title: string
          uploaded_by: string | null
          visibility: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          file_size_kb?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          school_id?: string | null
          subject?: string | null
          title: string
          uploaded_by?: string | null
          visibility?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          file_size_kb?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          school_id?: string | null
          subject?: string | null
          title?: string
          uploaded_by?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_materials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_materials_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_requests: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          fulfilled_at: string | null
          id: string
          item_id: string | null
          item_name: string | null
          quantity: number | null
          reason: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          fulfilled_at?: string | null
          id?: string
          item_id?: string | null
          item_name?: string | null
          quantity?: number | null
          reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          fulfilled_at?: string | null
          id?: string
          item_id?: string | null
          item_name?: string | null
          quantity?: number | null
          reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          profile_id: string | null
          role: string | null
          school_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          profile_id?: string | null
          role?: string | null
          school_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          profile_id?: string | null
          role?: string | null
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          class_id: string | null
          content: string | null
          created_at: string | null
          description: string | null
          external_url: string | null
          id: string
          is_school_wide: boolean | null
          school_id: string | null
          subject: string | null
          teacher_id: string | null
          title: string
          type: string
        }
        Insert: {
          class_id?: string | null
          content?: string | null
          created_at?: string | null
          description?: string | null
          external_url?: string | null
          id?: string
          is_school_wide?: boolean | null
          school_id?: string | null
          subject?: string | null
          teacher_id?: string | null
          title: string
          type?: string
        }
        Update: {
          class_id?: string | null
          content?: string | null
          created_at?: string | null
          description?: string | null
          external_url?: string | null
          id?: string
          is_school_wide?: boolean | null
          school_id?: string | null
          subject?: string | null
          teacher_id?: string | null
          title?: string
          type?: string
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
      schema_migrations: {
        Row: {
          applied_at: string
          description: string
          version: string
        }
        Insert: {
          applied_at?: string
          description: string
          version: string
        }
        Update: {
          applied_at?: string
          description?: string
          version?: string
        }
        Relationships: []
      }
      scheme_of_work: {
        Row: {
          class_id: string | null
          created_at: string | null
          curriculum_id: string | null
          curriculum_type: string
          date: string | null
          day_of_week: string | null
          grade: string
          id: string
          objectives: string | null
          period: number | null
          reference: string | null
          remarks: string | null
          resources: string | null
          rollcall: string | null
          school_id: string | null
          status: string | null
          strand: string | null
          sub_strand: string | null
          subject: string
          subject_id: string | null
          teacher_id: string | null
          term: number
          topic: string
          updated_at: string | null
          week: number
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          curriculum_id?: string | null
          curriculum_type: string
          date?: string | null
          day_of_week?: string | null
          grade: string
          id?: string
          objectives?: string | null
          period?: number | null
          reference?: string | null
          remarks?: string | null
          resources?: string | null
          rollcall?: string | null
          school_id?: string | null
          status?: string | null
          strand?: string | null
          sub_strand?: string | null
          subject: string
          subject_id?: string | null
          teacher_id?: string | null
          term: number
          topic: string
          updated_at?: string | null
          week: number
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          curriculum_id?: string | null
          curriculum_type?: string
          date?: string | null
          day_of_week?: string | null
          grade?: string
          id?: string
          objectives?: string | null
          period?: number | null
          reference?: string | null
          remarks?: string | null
          resources?: string | null
          rollcall?: string | null
          school_id?: string | null
          status?: string | null
          strand?: string | null
          sub_strand?: string | null
          subject?: string
          subject_id?: string | null
          teacher_id?: string | null
          term?: number
          topic?: string
          updated_at?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "scheme_of_work_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_of_work_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_of_work_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_of_work_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_of_work_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_of_work_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      school_members: {
        Row: {
          id: string
          joined_at: string
          profile_id: string
          role: Database["public"]["Enums"]["member_role"]
          school_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          profile_id: string
          role: Database["public"]["Enums"]["member_role"]
          school_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          country_code: string
          county: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          established_year: number | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
          knec_code: string | null
          logo_url: string | null
          motto: string | null
          name: string
          name_normalized: string | null
          nemis_code: string | null
          phone: string | null
          postal_address: string | null
          requires_dual_approval: boolean
          school_category: string | null
          school_type: string | null
          status: Database["public"]["Enums"]["school_status"]
          sub_county: string | null
          subdomain: string
          timezone: string
          updated_at: string
          vision: string | null
          ward: string | null
        }
        Insert: {
          country_code: string
          county?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          established_year?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          knec_code?: string | null
          logo_url?: string | null
          motto?: string | null
          name: string
          name_normalized?: string | null
          nemis_code?: string | null
          phone?: string | null
          postal_address?: string | null
          requires_dual_approval?: boolean
          school_category?: string | null
          school_type?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          sub_county?: string | null
          subdomain: string
          timezone: string
          updated_at?: string
          vision?: string | null
          ward?: string | null
        }
        Update: {
          country_code?: string
          county?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          established_year?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          knec_code?: string | null
          logo_url?: string | null
          motto?: string | null
          name?: string
          name_normalized?: string | null
          nemis_code?: string | null
          phone?: string | null
          postal_address?: string | null
          requires_dual_approval?: boolean
          school_category?: string | null
          school_type?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          sub_county?: string | null
          subdomain?: string
          timezone?: string
          updated_at?: string
          vision?: string | null
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_majority_ages"
            referencedColumns: ["country_code"]
          },
          {
            foreignKeyName: "schools_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      schools_directory: {
        Row: {
          county: string | null
          created_at: string | null
          id: string
          is_verified: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          status: string | null
          sub_county: string | null
          type: string | null
        }
        Insert: {
          county?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          status?: string | null
          sub_county?: string | null
          type?: string | null
        }
        Update: {
          county?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          status?: string | null
          sub_county?: string | null
          type?: string | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          category: string
          contract_end: string | null
          contract_start: string | null
          created_at: string | null
          date_joined: string | null
          date_of_birth: string | null
          deleted_at: string | null
          department: string | null
          designation: string | null
          email: string | null
          employment_type: string
          full_name: string
          gender: string | null
          id: string
          national_id: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          next_of_kin_relation: string | null
          phone: string | null
          profile_id: string | null
          salary_amount: number | null
          salary_grade: string | null
          school_id: string
          staff_number: string | null
          status: string
          subject: string | null
          tsc_number: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          date_joined?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          employment_type?: string
          full_name: string
          gender?: string | null
          id?: string
          national_id?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relation?: string | null
          phone?: string | null
          profile_id?: string | null
          salary_amount?: number | null
          salary_grade?: string | null
          school_id: string
          staff_number?: string | null
          status?: string
          subject?: string | null
          tsc_number?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          date_joined?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          employment_type?: string
          full_name?: string
          gender?: string | null
          id?: string
          national_id?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relation?: string | null
          phone?: string | null
          profile_id?: string | null
          salary_amount?: number | null
          salary_grade?: string | null
          school_id?: string
          staff_number?: string | null
          status?: string
          subject?: string | null
          tsc_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          created_at: string | null
          date: string
          id: string
          notes: string | null
          recorded_by: string | null
          school_id: string
          staff_id: string
          status: string
          time_in: string | null
          time_out: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          school_id: string
          staff_id: string
          status?: string
          time_in?: string | null
          time_out?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          school_id?: string
          staff_id?: string
          status?: string
          time_in?: string | null
          time_out?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_documents: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          doc_type: string
          expiry_date: string | null
          id: string
          school_id: string
          staff_id: string
          status: string
          title: string
          uploaded_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          doc_type?: string
          expiry_date?: string | null
          id?: string
          school_id: string
          staff_id: string
          status?: string
          title: string
          uploaded_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          doc_type?: string
          expiry_date?: string | null
          id?: string
          school_id?: string
          staff_id?: string
          status?: string
          title?: string
          uploaded_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_leave: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          days_requested: number
          deleted_at: string | null
          end_date: string
          id: string
          leave_type: string
          notes: string | null
          reason: string | null
          school_id: string
          staff_id: string
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          days_requested?: number
          deleted_at?: string | null
          end_date: string
          id?: string
          leave_type?: string
          notes?: string | null
          reason?: string | null
          school_id: string
          staff_id: string
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          days_requested?: number
          deleted_at?: string | null
          end_date?: string
          id?: string
          leave_type?: string
          notes?: string | null
          reason?: string | null
          school_id?: string
          staff_id?: string
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_leave_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_leave_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_leave_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_leave_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      store_items: {
        Row: {
          added_by: string | null
          category: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          low_stock_threshold: number | null
          name: string
          quantity: number | null
          school_id: string | null
          unit: string | null
        }
        Insert: {
          added_by?: string | null
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          low_stock_threshold?: number | null
          name: string
          quantity?: number | null
          school_id?: string | null
          unit?: string | null
        }
        Update: {
          added_by?: string | null
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          low_stock_threshold?: number | null
          name?: string
          quantity?: number | null
          school_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      store_transactions: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          issued_to: string | null
          item_id: string | null
          notes: string | null
          quantity: number
          reference: string | null
          school_id: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          issued_to?: string | null
          item_id?: string | null
          notes?: string | null
          quantity: number
          reference?: string | null
          school_id?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          issued_to?: string | null
          item_id?: string | null
          notes?: string | null
          quantity?: number
          reference?: string | null
          school_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transactions_issued_to_fkey"
            columns: ["issued_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transactions_issued_to_fkey"
            columns: ["issued_to"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      strand_progress: {
        Row: {
          class_id: string | null
          created_at: string | null
          curriculum_id: string | null
          id: string
          notes: string | null
          school_id: string | null
          status: string
          strand_id: string | null
          subject_id: string | null
          teacher_id: string | null
          term: number
          updated_at: string | null
          week: number
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          curriculum_id?: string | null
          id?: string
          notes?: string | null
          school_id?: string | null
          status?: string
          strand_id?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          term: number
          updated_at?: string | null
          week: number
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          curriculum_id?: string | null
          id?: string
          notes?: string | null
          school_id?: string | null
          status?: string
          strand_id?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          term?: number
          updated_at?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "strand_progress_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strand_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strand_progress_strand_id_fkey"
            columns: ["strand_id"]
            isOneToOne: false
            referencedRelation: "strands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strand_progress_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strand_progress_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strand_progress_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      strands: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strands_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strands_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_claim_codes: {
        Row: {
          claimed: boolean
          claimed_by: string | null
          code: string
          created_at: string
          expires_at: string
          id: string
          role: string
          student_id: string
        }
        Insert: {
          claimed?: boolean
          claimed_by?: string | null
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          role?: string
          student_id: string
        }
        Update: {
          claimed?: boolean
          claimed_by?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          role?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_claim_codes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_classes: {
        Row: {
          class_id: string
          id: string
          is_current: boolean
          joined_at: string
          left_at: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          class_id: string
          id?: string
          is_current?: boolean
          joined_at?: string
          left_at?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          class_id?: string
          id?: string
          is_current?: boolean
          joined_at?: string
          left_at?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_classes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          admission_no: string | null
          created_at: string
          gender: string | null
          profile_id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          admission_no?: string | null
          created_at?: string
          gender?: string | null
          profile_id: string
          school_id: string
          updated_at?: string
        }
        Update: {
          admission_no?: string | null
          created_at?: string
          gender?: string | null
          profile_id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_gender_fkey"
            columns: ["gender"]
            isOneToOne: false
            referencedRelation: "gender_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "student_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_schools: {
        Row: {
          school_id: string
          student_id: string
        }
        Insert: {
          school_id: string
          student_id: string
        }
        Update: {
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_schools_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          admission_number: string | null
          autonomy_level: number | null
          class_id: string | null
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          gender: string | null
          id: string
          name: string
          parent_linked_at: string | null
          profile_id: string | null
        }
        Insert: {
          admission_number?: string | null
          autonomy_level?: number | null
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          gender?: string | null
          id?: string
          name: string
          parent_linked_at?: string | null
          profile_id?: string | null
        }
        Update: {
          admission_number?: string | null
          autonomy_level?: number | null
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          gender?: string | null
          id?: string
          name?: string
          parent_linked_at?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          created_at: string | null
          done: boolean | null
          id: string
          scheduled_date: string | null
          student_id: string | null
          subject: string | null
          topic: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          done?: boolean | null
          id?: string
          scheduled_date?: string | null
          student_id?: string | null
          subject?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          done?: boolean | null
          id?: string
          scheduled_date?: string | null
          student_id?: string | null
          subject?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          description: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          description: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          description?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      system_health_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          id: string
          job_name: string
          job_run_id: string
          rows_affected: number | null
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_name: string
          job_run_id: string
          rows_affected?: number | null
          status: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_name?: string
          job_run_id?: string
          rows_affected?: number | null
          status?: string
        }
        Relationships: []
      }
      teacher_classes: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          is_class_teacher: boolean
          school_id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          is_class_teacher?: boolean
          school_id: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          is_class_teacher?: boolean
          school_id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_content: {
        Row: {
          body: string | null
          class_id: string | null
          created_at: string | null
          file_url: string | null
          id: string
          published: boolean | null
          published_at: string | null
          school_id: string | null
          subject_id: string | null
          teacher_id: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          body?: string | null
          class_id?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          published?: boolean | null
          published_at?: string | null
          school_id?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          body?: string | null
          class_id?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          published?: boolean | null
          published_at?: string | null
          school_id?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          appraisal_notes: string | null
          appraisal_score: number | null
          created_at: string
          date_of_birth: string | null
          designation: string | null
          documents: Json | null
          employment_type: string | null
          finance_ref: string | null
          gender: string | null
          leave_balance: number | null
          nationality: string | null
          professional_dev: Json | null
          profile_id: string
          qualifications: Json | null
          school_id: string | null
          subjects_taught: string[] | null
          teaching_style: string | null
          tsc_number: string | null
          twin_notes: string | null
          updated_at: string
        }
        Insert: {
          appraisal_notes?: string | null
          appraisal_score?: number | null
          created_at?: string
          date_of_birth?: string | null
          designation?: string | null
          documents?: Json | null
          employment_type?: string | null
          finance_ref?: string | null
          gender?: string | null
          leave_balance?: number | null
          nationality?: string | null
          professional_dev?: Json | null
          profile_id: string
          qualifications?: Json | null
          school_id?: string | null
          subjects_taught?: string[] | null
          teaching_style?: string | null
          tsc_number?: string | null
          twin_notes?: string | null
          updated_at?: string
        }
        Update: {
          appraisal_notes?: string | null
          appraisal_score?: number | null
          created_at?: string
          date_of_birth?: string | null
          designation?: string | null
          documents?: Json | null
          employment_type?: string | null
          finance_ref?: string | null
          gender?: string | null
          leave_balance?: number | null
          nationality?: string | null
          professional_dev?: Json | null
          profile_id?: string
          qualifications?: Json | null
          school_id?: string | null
          subjects_taught?: string[] | null
          teaching_style?: string | null
          tsc_number?: string | null
          twin_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          class: string
          created_at: string | null
          id: string
          initials: string
          name: string
          phone: string | null
          school: string
          subject: string
          user_id: string
        }
        Insert: {
          class?: string
          created_at?: string | null
          id?: string
          initials?: string
          name?: string
          phone?: string | null
          school?: string
          subject?: string
          user_id: string
        }
        Update: {
          class?: string
          created_at?: string | null
          id?: string
          initials?: string
          name?: string
          phone?: string | null
          school?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      timetable_slots: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          effective_from: string
          effective_until: string | null
          end_time: string
          id: string
          room: string | null
          school_id: string | null
          start_time: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          effective_from?: string
          effective_until?: string | null
          end_time: string
          id?: string
          room?: string | null
          school_id?: string | null
          start_time: string
          subject_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          effective_from?: string
          effective_until?: string | null
          end_time?: string
          id?: string
          room?: string | null
          school_id?: string | null
          start_time?: string
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          clinical_tip_tab: Json | null
          common_errors_tab: Json | null
          concept_tab: Json | null
          content_status: string
          created_at: string | null
          id: string
          kenya_context_tab: Json | null
          module_id: string
          sequence_number: number
          slug: string
          subtitle: string | null
          title: string
          week_number: number | null
        }
        Insert: {
          clinical_tip_tab?: Json | null
          common_errors_tab?: Json | null
          concept_tab?: Json | null
          content_status?: string
          created_at?: string | null
          id?: string
          kenya_context_tab?: Json | null
          module_id: string
          sequence_number: number
          slug: string
          subtitle?: string | null
          title: string
          week_number?: number | null
        }
        Update: {
          clinical_tip_tab?: Json | null
          common_errors_tab?: Json | null
          concept_tab?: Json | null
          content_status?: string
          created_at?: string | null
          id?: string
          kenya_context_tab?: Json | null
          module_id?: string
          sequence_number?: number
          slug?: string
          subtitle?: string | null
          title?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      tpad_appraisals: {
        Row: {
          countersigned_at: string | null
          created_at: string | null
          final_score: number | null
          head_notes: string | null
          id: string
          school_id: string
          standard_1_head: number | null
          standard_1_self: number | null
          standard_2_head: number | null
          standard_2_self: number | null
          standard_3_head: number | null
          standard_3_self: number | null
          standard_4_head: number | null
          standard_4_self: number | null
          standard_5_self: number | null
          standard_6_self: number | null
          standard_7_self: number | null
          standard_8_self: number | null
          status: string
          submitted_at: string | null
          teacher_id: string
          term_id: string | null
          updated_at: string | null
        }
        Insert: {
          countersigned_at?: string | null
          created_at?: string | null
          final_score?: number | null
          head_notes?: string | null
          id?: string
          school_id: string
          standard_1_head?: number | null
          standard_1_self?: number | null
          standard_2_head?: number | null
          standard_2_self?: number | null
          standard_3_head?: number | null
          standard_3_self?: number | null
          standard_4_head?: number | null
          standard_4_self?: number | null
          standard_5_self?: number | null
          standard_6_self?: number | null
          standard_7_self?: number | null
          standard_8_self?: number | null
          status?: string
          submitted_at?: string | null
          teacher_id: string
          term_id?: string | null
          updated_at?: string | null
        }
        Update: {
          countersigned_at?: string | null
          created_at?: string | null
          final_score?: number | null
          head_notes?: string | null
          id?: string
          school_id?: string
          standard_1_head?: number | null
          standard_1_self?: number | null
          standard_2_head?: number | null
          standard_2_self?: number | null
          standard_3_head?: number | null
          standard_3_self?: number | null
          standard_4_head?: number | null
          standard_4_self?: number | null
          standard_5_self?: number | null
          standard_6_self?: number | null
          standard_7_self?: number | null
          standard_8_self?: number | null
          status?: string
          submitted_at?: string | null
          teacher_id?: string
          term_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tpad_appraisals_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tpad_appraisals_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tpad_appraisals_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tpad_appraisals_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      tpad_deadlines: {
        Row: {
          countersign_due: string
          created_at: string | null
          id: string
          school_id: string
          self_appraisal_due: string
          term_id: string
        }
        Insert: {
          countersign_due: string
          created_at?: string | null
          id?: string
          school_id: string
          self_appraisal_due: string
          term_id: string
        }
        Update: {
          countersign_due?: string
          created_at?: string | null
          id?: string
          school_id?: string
          self_appraisal_due?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tpad_deadlines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tpad_deadlines_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      tpad_evidence: {
        Row: {
          appraisal_id: string
          created_at: string | null
          description: string
          id: string
          source: string
          source_id: string | null
          standard: number
          teacher_id: string
        }
        Insert: {
          appraisal_id: string
          created_at?: string | null
          description: string
          id?: string
          source: string
          source_id?: string | null
          standard: number
          teacher_id: string
        }
        Update: {
          appraisal_id?: string
          created_at?: string | null
          description?: string
          id?: string
          source?: string
          source_id?: string | null
          standard?: number
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tpad_evidence_appraisal_id_fkey"
            columns: ["appraisal_id"]
            isOneToOne: false
            referencedRelation: "tpad_appraisals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tpad_evidence_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tpad_evidence_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      traditional_grades: {
        Row: {
          academic_year: number
          assessment: string
          class_id: string
          created_at: string
          id: string
          marks: number
          notes: string | null
          out_of: number
          school_id: string
          student_id: string
          subject_id: string
          teacher_id: string
          term: number
          updated_at: string
        }
        Insert: {
          academic_year: number
          assessment: string
          class_id: string
          created_at?: string
          id?: string
          marks: number
          notes?: string | null
          out_of?: number
          school_id: string
          student_id: string
          subject_id: string
          teacher_id: string
          term: number
          updated_at?: string
        }
        Update: {
          academic_year?: number
          assessment?: string
          class_id?: string
          created_at?: string
          id?: string
          marks?: number
          notes?: string | null
          out_of?: number
          school_id?: string
          student_id?: string
          subject_id?: string
          teacher_id?: string
          term?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traditional_grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traditional_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traditional_grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traditional_grades_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traditional_grades_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_memory: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          subject: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          subject?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          subject?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "twin_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twin_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_profile: {
        Row: {
          avg_session_m: number | null
          content_pref: string | null
          last_topic: string | null
          read_time_pref: string | null
          top_subjects: string[] | null
          updated_at: string | null
          user_id: string
          vibe_count: number | null
        }
        Insert: {
          avg_session_m?: number | null
          content_pref?: string | null
          last_topic?: string | null
          read_time_pref?: string | null
          top_subjects?: string[] | null
          updated_at?: string | null
          user_id: string
          vibe_count?: number | null
        }
        Update: {
          avg_session_m?: number | null
          content_pref?: string | null
          last_topic?: string | null
          read_time_pref?: string | null
          top_subjects?: string[] | null
          updated_at?: string | null
          user_id?: string
          vibe_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "twin_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twin_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_sessions: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          prompt: string | null
          response: string | null
          role: Database["public"]["Enums"]["member_role"]
          school_id: string | null
          target_id: string | null
          target_table: string | null
          task_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          prompt?: string | null
          response?: string | null
          role: Database["public"]["Enums"]["member_role"]
          school_id?: string | null
          target_id?: string | null
          target_table?: string | null
          task_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          prompt?: string | null
          response?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          school_id?: string | null
          target_id?: string | null
          target_table?: string | null
          task_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twin_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twin_sessions_task_type_fkey"
            columns: ["task_type"]
            isOneToOne: false
            referencedRelation: "twin_task_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "twin_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twin_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_task_types: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      vc_circular_recipients: {
        Row: {
          ack_at: string | null
          circular_id: string | null
          delivered_at: string | null
          id: string
          profile_id: string | null
        }
        Insert: {
          ack_at?: string | null
          circular_id?: string | null
          delivered_at?: string | null
          id?: string
          profile_id?: string | null
        }
        Update: {
          ack_at?: string | null
          circular_id?: string | null
          delivered_at?: string | null
          id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vc_circular_recipients_circular_id_fkey"
            columns: ["circular_id"]
            isOneToOne: false
            referencedRelation: "vc_circulars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_circular_recipients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_circular_recipients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      vc_circulars: {
        Row: {
          ack_deadline: string | null
          audience_type: string
          body: string
          created_at: string | null
          id: string
          recipient_profile_id: string | null
          requires_ack: boolean | null
          school_id: string | null
          sent_at: string | null
          sent_by: string | null
          title: string
        }
        Insert: {
          ack_deadline?: string | null
          audience_type: string
          body: string
          created_at?: string | null
          id?: string
          recipient_profile_id?: string | null
          requires_ack?: boolean | null
          school_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          title: string
        }
        Update: {
          ack_deadline?: string | null
          audience_type?: string
          body?: string
          created_at?: string | null
          id?: string
          recipient_profile_id?: string | null
          requires_ack?: boolean | null
          school_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "vc_circulars_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_circulars_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_circulars_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_circulars_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_circulars_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      vc_messages: {
        Row: {
          body: string
          created_at: string | null
          deleted_at: string | null
          id: string
          school_id: string | null
          sender_id: string | null
          thread_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          school_id?: string | null
          sender_id?: string | null
          thread_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          school_id?: string | null
          sender_id?: string | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vc_messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "vc_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      vc_participants: {
        Row: {
          id: string
          joined_at: string | null
          last_read_at: string | null
          left_at: string | null
          profile_id: string | null
          school_id: string | null
          thread_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          profile_id?: string | null
          school_id?: string | null
          thread_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          profile_id?: string | null
          school_id?: string | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vc_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_participants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "vc_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      vc_threads: {
        Row: {
          context_tag: string | null
          created_at: string | null
          created_by: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          school_id: string | null
          subject: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          context_tag?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          school_id?: string | null
          subject?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          context_tag?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          school_id?: string | null
          subject?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vc_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_threads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_chapters: {
        Row: {
          blocks: Json | null
          cbc_strand: string | null
          created_at: string | null
          id: string
          learning_outcomes: string[] | null
          number: number
          publication_id: string
          reading_time_min: number | null
          status: string | null
          title: string | null
          updated_at: string | null
          word_count: number | null
        }
        Insert: {
          blocks?: Json | null
          cbc_strand?: string | null
          created_at?: string | null
          id?: string
          learning_outcomes?: string[] | null
          number?: number
          publication_id: string
          reading_time_min?: number | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          word_count?: number | null
        }
        Update: {
          blocks?: Json | null
          cbc_strand?: string | null
          created_at?: string | null
          id?: string
          learning_outcomes?: string[] | null
          number?: number
          publication_id?: string
          reading_time_min?: number | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vibe_chapters_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_credit_packages: {
        Row: {
          credits: number | null
          id: string
          is_active: boolean | null
          name: string | null
          price_kes: number | null
          unlocks: string[] | null
        }
        Insert: {
          credits?: number | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          price_kes?: number | null
          unlocks?: string[] | null
        }
        Update: {
          credits?: number | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          price_kes?: number | null
          unlocks?: string[] | null
        }
        Relationships: []
      }
      vibe_credit_transactions: {
        Row: {
          amount: number | null
          balance_after: number | null
          created_at: string | null
          feature: string | null
          id: string
          mpesa_ref: string | null
          notes: string | null
          school_id: string | null
          teacher_id: string | null
          type: string | null
        }
        Insert: {
          amount?: number | null
          balance_after?: number | null
          created_at?: string | null
          feature?: string | null
          id?: string
          mpesa_ref?: string | null
          notes?: string | null
          school_id?: string | null
          teacher_id?: string | null
          type?: string | null
        }
        Update: {
          amount?: number | null
          balance_after?: number | null
          created_at?: string | null
          feature?: string | null
          id?: string
          mpesa_ref?: string | null
          notes?: string | null
          school_id?: string | null
          teacher_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vibe_credit_transactions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_credit_transactions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_credits: {
        Row: {
          balance: number | null
          teacher_id: string
          total_earned: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          teacher_id: string
          total_earned?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          teacher_id?: string
          total_earned?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vibe_credits_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_credits_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_publications: {
        Row: {
          author_id: string
          cbc_aligned: boolean | null
          cbc_grade: string | null
          cbc_subject: string | null
          chapter_count: number | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          format: string
          genre: string | null
          id: string
          issue_number: number | null
          language: string | null
          pricing: string | null
          publication_name: string | null
          published_at: string | null
          series_name: string | null
          series_number: number | null
          status: string | null
          subtitle: string | null
          tags: string[] | null
          title: string | null
          total_reads: number | null
          updated_at: string | null
        }
        Insert: {
          author_id: string
          cbc_aligned?: boolean | null
          cbc_grade?: string | null
          cbc_subject?: string | null
          chapter_count?: number | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          format: string
          genre?: string | null
          id?: string
          issue_number?: number | null
          language?: string | null
          pricing?: string | null
          publication_name?: string | null
          published_at?: string | null
          series_name?: string | null
          series_number?: number | null
          status?: string | null
          subtitle?: string | null
          tags?: string[] | null
          title?: string | null
          total_reads?: number | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          cbc_aligned?: boolean | null
          cbc_grade?: string | null
          cbc_subject?: string | null
          chapter_count?: number | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          format?: string
          genre?: string | null
          id?: string
          issue_number?: number | null
          language?: string | null
          pricing?: string | null
          publication_name?: string | null
          published_at?: string | null
          series_name?: string | null
          series_number?: number | null
          status?: string | null
          subtitle?: string | null
          tags?: string[] | null
          title?: string | null
          total_reads?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vibe_stories: {
        Row: {
          age_range: string
          author_id: string
          characters: Json | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          earnings_ksh: number
          id: string
          language: string
          page_count: number
          published_at: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          vibe_count: number
          view_count: number
        }
        Insert: {
          age_range?: string
          author_id: string
          characters?: Json | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          earnings_ksh?: number
          id?: string
          language?: string
          page_count?: number
          published_at?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          vibe_count?: number
          view_count?: number
        }
        Update: {
          age_range?: string
          author_id?: string
          characters?: Json | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          earnings_ksh?: number
          id?: string
          language?: string
          page_count?: number
          published_at?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          vibe_count?: number
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "vibe_stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_story_pages: {
        Row: {
          background_color: string
          created_at: string
          id: string
          illustration_prompt: string | null
          illustration_url: string | null
          page_number: number
          speech_bubbles: Json
          story_id: string
          text_blocks: Json
          updated_at: string
        }
        Insert: {
          background_color?: string
          created_at?: string
          id?: string
          illustration_prompt?: string | null
          illustration_url?: string | null
          page_number: number
          speech_bubbles?: Json
          story_id: string
          text_blocks?: Json
          updated_at?: string
        }
        Update: {
          background_color?: string
          created_at?: string
          id?: string
          illustration_prompt?: string | null
          illustration_url?: string | null
          page_number?: number
          speech_bubbles?: Json
          story_id?: string
          text_blocks?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_story_pages_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "vibe_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      vibelearn_completed: {
        Row: {
          completed_at: string | null
          content_id: string | null
          id: string
          student_id: string | null
        }
        Insert: {
          completed_at?: string | null
          content_id?: string | null
          id?: string
          student_id?: string | null
        }
        Update: {
          completed_at?: string | null
          content_id?: string | null
          id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vibelearn_completed_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibelearn_completed_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      vibelearn_content: {
        Row: {
          body: string | null
          created_at: string | null
          description: string | null
          earnings_ksh: number
          id: string
          school_id: string | null
          search_vector: unknown
          source: string | null
          status: string
          subject_id: string | null
          submitted_by: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          type: string
          updated_at: string | null
          url: string
          vibe_count: number | null
          view_count: number | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          description?: string | null
          earnings_ksh?: number
          id?: string
          school_id?: string | null
          search_vector?: unknown
          source?: string | null
          status?: string
          subject_id?: string | null
          submitted_by?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          type: string
          updated_at?: string | null
          url: string
          vibe_count?: number | null
          view_count?: number | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          description?: string | null
          earnings_ksh?: number
          id?: string
          school_id?: string | null
          search_vector?: unknown
          source?: string | null
          status?: string
          subject_id?: string | null
          submitted_by?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          url?: string
          vibe_count?: number | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vibelearn_content_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibelearn_content_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibelearn_content_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibelearn_content_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      vibelearn_content_saves: {
        Row: {
          content_id: string
          id: string
          saved_at: string
          student_id: string
        }
        Insert: {
          content_id: string
          id?: string
          saved_at?: string
          student_id: string
        }
        Update: {
          content_id?: string
          id?: string
          saved_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibelearn_content_saves_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_content"
            referencedColumns: ["id"]
          },
        ]
      }
      vibelearn_content_views: {
        Row: {
          content_id: string
          id: string
          student_id: string | null
          viewed_at: string
        }
        Insert: {
          content_id: string
          id?: string
          student_id?: string | null
          viewed_at?: string
        }
        Update: {
          content_id?: string
          id?: string
          student_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibelearn_content_views_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_content"
            referencedColumns: ["id"]
          },
        ]
      }
      vibelearn_history: {
        Row: {
          content_id: string | null
          id: string
          student_id: string | null
          viewed_at: string | null
        }
        Insert: {
          content_id?: string | null
          id?: string
          student_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          content_id?: string | null
          id?: string
          student_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vibelearn_history_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibelearn_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      vibelearn_points: {
        Row: {
          action: string
          content_id: string | null
          created_at: string | null
          id: string
          points: number
          student_id: string | null
        }
        Insert: {
          action: string
          content_id?: string | null
          created_at?: string | null
          id?: string
          points: number
          student_id?: string | null
        }
        Update: {
          action?: string
          content_id?: string | null
          created_at?: string | null
          id?: string
          points?: number
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vibelearn_points_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibelearn_points_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      vibelearn_saved: {
        Row: {
          content_id: string | null
          id: string
          saved_at: string | null
          student_id: string | null
        }
        Insert: {
          content_id?: string | null
          id?: string
          saved_at?: string | null
          student_id?: string | null
        }
        Update: {
          content_id?: string | null
          id?: string
          saved_at?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vibelearn_saved_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibelearn_saved_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      vibelearn_searches: {
        Row: {
          id: string
          query: string
          results_count: number | null
          searched_at: string | null
          student_id: string | null
        }
        Insert: {
          id?: string
          query: string
          results_count?: number | null
          searched_at?: string | null
          student_id?: string | null
        }
        Update: {
          id?: string
          query?: string
          results_count?: number | null
          searched_at?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vibelearn_searches_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibelearn_searches_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      vibelearn_streaks: {
        Row: {
          current_streak: number | null
          last_active_date: string | null
          longest_streak: number | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          current_streak?: number | null
          last_active_date?: string | null
          longest_streak?: number | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          current_streak?: number | null
          last_active_date?: string | null
          longest_streak?: number | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vibelearn_streaks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      vibelearn_vibes: {
        Row: {
          content_id: string | null
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vibelearn_vibes_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibelearn_vibes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibelearn_vibes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      exam_bank_health: {
        Row: {
          active_count: number | null
          difficulty: Database["public"]["Enums"]["exam_difficulty"] | null
          dismissed_count: number | null
          form: Database["public"]["Enums"]["exam_form"] | null
          last_added_at: string | null
          subject: Database["public"]["Enums"]["exam_subject"] | null
          topic: string | null
          total_served: number | null
          under_review_count: number | null
        }
        Relationships: []
      }
      exam_topic_analytics: {
        Row: {
          avg_percentage: number | null
          difficulty: Database["public"]["Enums"]["exam_difficulty"] | null
          form: Database["public"]["Enums"]["exam_form"] | null
          last_attempt_at: string | null
          pass_rate_pct: number | null
          subject: Database["public"]["Enums"]["exam_subject"] | null
          topic: string | null
          total_attempts: number | null
        }
        Relationships: []
      }
      funhub_leaderboard_national: {
        Row: {
          display_name: string | null
          level: number | null
          rank: number | null
          school_id: string | null
          total_xp: number | null
          weekly_xp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      funhub_leaderboard_school: {
        Row: {
          display_name: string | null
          level: number | null
          school_id: string | null
          school_rank: number | null
          total_xp: number | null
          weekly_xp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_accessible_resources: {
        Row: {
          class_id: string | null
          content: string | null
          created_at: string | null
          description: string | null
          external_url: string | null
          id: string | null
          is_school_wide: boolean | null
          school_id: string | null
          subject: string | null
          teacher_id: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          class_id?: string | null
          content?: string | null
          created_at?: string | null
          description?: string | null
          external_url?: string | null
          id?: string | null
          is_school_wide?: boolean | null
          school_id?: string | null
          subject?: string | null
          teacher_id?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          class_id?: string | null
          content?: string | null
          created_at?: string | null
          description?: string | null
          external_url?: string | null
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
      bump_bank_served: { Args: { p_ids: string[] }; Returns: undefined }
      calculate_grade_844: { Args: { marks: number }; Returns: string }
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
      dismiss_bank_question: { Args: { p_id: string }; Returns: undefined }
      fn_invitation_attempt: {
        Args: { p_code: string; p_success: boolean }
        Returns: Json
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
      generate_receipt_number: {
        Args: { p_school_id: string }
        Returns: string
      }
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
      get_credit_balance: { Args: { p_teacher_id: string }; Returns: Json }
      get_my_role: { Args: never; Returns: string }
      get_my_school_ids: { Args: never; Returns: string[] }
      get_unread_thread_count: {
        Args: { p_profile_id: string }
        Returns: number
      }
      increment_available_copies: {
        Args: { book_id: string }
        Returns: undefined
      }
      increment_publication_reads: {
        Args: { pub_id: string }
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
      reset_monthly_xp: { Args: never; Returns: undefined }
      reset_weekly_xp: { Args: never; Returns: undefined }
      spend_credit: {
        Args: {
          p_amount: number
          p_feature: string
          p_notes?: string
          p_teacher_id: string
        }
        Returns: Json
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
      update_exam_streak: { Args: { p_user_id: string }; Returns: undefined }
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

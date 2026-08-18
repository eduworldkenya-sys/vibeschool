export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_terms_school_id_fkey"
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
            referencedRelation: "school_directory_public"
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
            foreignKeyName: "assessment_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
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
            referencedRelation: "school_directory_public"
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
            referencedRelation: "school_directory_public"
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
            referencedRelation: "school_directory_public"
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
          source_block_id: string | null
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
          source_block_id?: string | null
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
          source_block_id?: string | null
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
            foreignKeyName: "assessment_items_source_block_id_fkey"
            columns: ["source_block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
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
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          request_reason?: string
          requested_by?: string
          requested_score?: number
          response_id?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_moderation_requests_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_moderation_requests_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "assessment_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_moderation_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_moderation_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          accepted_answers: Json
          author_id: string | null
          bloom_level: string | null
          competency_tag: string | null
          content_pack_id: string | null
          correct_answer: string | null
          created_at: string
          curriculum_id: string
          difficulty: string | null
          explanation: string | null
          fingerprint: string | null
          id: string
          last_used_at: string | null
          learning_outcome_id: string | null
          marking_guide: Json
          marks: number
          options: Json | null
          parent_question_id: string | null
          question_text: string
          question_type: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string | null
          source_assessment_item_id: string | null
          source_type: string
          status: string
          subject_id: string | null
          updated_at: string
          usage_count: number
          version: number
        }
        Insert: {
          accepted_answers?: Json
          author_id?: string | null
          bloom_level?: string | null
          competency_tag?: string | null
          content_pack_id?: string | null
          correct_answer?: string | null
          created_at?: string
          curriculum_id: string
          difficulty?: string | null
          explanation?: string | null
          fingerprint?: string | null
          id?: string
          last_used_at?: string | null
          learning_outcome_id?: string | null
          marking_guide?: Json
          marks?: number
          options?: Json | null
          parent_question_id?: string | null
          question_text: string
          question_type: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          source_assessment_item_id?: string | null
          source_type?: string
          status?: string
          subject_id?: string | null
          updated_at?: string
          usage_count?: number
          version?: number
        }
        Update: {
          accepted_answers?: Json
          author_id?: string | null
          bloom_level?: string | null
          competency_tag?: string | null
          content_pack_id?: string | null
          correct_answer?: string | null
          created_at?: string
          curriculum_id?: string
          difficulty?: string | null
          explanation?: string | null
          fingerprint?: string | null
          id?: string
          last_used_at?: string | null
          learning_outcome_id?: string | null
          marking_guide?: Json
          marks?: number
          options?: Json | null
          parent_question_id?: string | null
          question_text?: string
          question_type?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          source_assessment_item_id?: string | null
          source_type?: string
          status?: string
          subject_id?: string | null
          updated_at?: string
          usage_count?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_content_pack_id_fkey"
            columns: ["content_pack_id"]
            isOneToOne: false
            referencedRelation: "curriculum_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_learning_outcome_id_fkey"
            columns: ["learning_outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_parent_question_id_fkey"
            columns: ["parent_question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_source_assessment_item_id_fkey"
            columns: ["source_assessment_item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_responses: {
        Row: {
          assessment_item_id: string
          attempt_id: string
          auto_mark_result: Json | null
          auto_score: number | null
          client_id: string | null
          client_updated_at: string | null
          created_at: string
          final_score: number | null
          first_saved_at: string
          id: string
          last_saved_at: string
          marked_at: string | null
          marked_by: string | null
          max_score: number
          response_text: string | null
          response_value: Json
          revision: number
          status: string
          submitted_at: string | null
          teacher_feedback: string | null
          teacher_override_reason: string | null
          teacher_score: number | null
          updated_at: string
        }
        Insert: {
          assessment_item_id: string
          attempt_id: string
          auto_mark_result?: Json | null
          auto_score?: number | null
          client_id?: string | null
          client_updated_at?: string | null
          created_at?: string
          final_score?: number | null
          first_saved_at?: string
          id?: string
          last_saved_at?: string
          marked_at?: string | null
          marked_by?: string | null
          max_score: number
          response_text?: string | null
          response_value?: Json
          revision?: number
          status?: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          teacher_override_reason?: string | null
          teacher_score?: number | null
          updated_at?: string
        }
        Update: {
          assessment_item_id?: string
          attempt_id?: string
          auto_mark_result?: Json | null
          auto_score?: number | null
          client_id?: string | null
          client_updated_at?: string | null
          created_at?: string
          final_score?: number | null
          first_saved_at?: string
          id?: string
          last_saved_at?: string
          marked_at?: string | null
          marked_by?: string | null
          max_score?: number
          response_text?: string | null
          response_value?: Json
          revision?: number
          status?: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          teacher_override_reason?: string | null
          teacher_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_responses_assessment_item_id_fkey"
            columns: ["assessment_item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_rubric_criteria: {
        Row: {
          criterion: string
          description: string | null
          id: string
          max_score: number
          outcome_id: string | null
          rubric_id: string
          sequence: number
        }
        Insert: {
          criterion: string
          description?: string | null
          id?: string
          max_score: number
          outcome_id?: string | null
          rubric_id: string
          sequence: number
        }
        Update: {
          criterion?: string
          description?: string | null
          id?: string
          max_score?: number
          outcome_id?: string | null
          rubric_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_rubric_criteria_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_rubric_criteria_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "assessment_rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_rubrics: {
        Row: {
          created_at: string
          description: string | null
          id: string
          max_score: number
          owner_id: string | null
          school_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_score: number
          owner_id?: string | null
          school_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_score?: number
          owner_id?: string | null
          school_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_rubrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_rubrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_score_events: {
        Row: {
          actor_id: string
          attempt_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          new_feedback: string | null
          new_score: number | null
          previous_feedback: string | null
          previous_score: number | null
          reason: string | null
          response_id: string
          school_id: string
        }
        Insert: {
          actor_id: string
          attempt_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          new_feedback?: string | null
          new_score?: number | null
          previous_feedback?: string | null
          previous_score?: number | null
          reason?: string | null
          response_id: string
          school_id: string
        }
        Update: {
          actor_id?: string
          attempt_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          new_feedback?: string | null
          new_score?: number | null
          previous_feedback?: string | null
          previous_score?: number | null
          reason?: string | null
          response_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_score_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_score_events_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "assessment_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_score_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_score_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_scores: {
        Row: {
          assessment_id: string
          created_at: string | null
          id: string
          remarks: string | null
          rubric_level: string | null
          score: number | null
          student_id: string | null
        }
        Insert: {
          assessment_id: string
          created_at?: string | null
          id?: string
          remarks?: string | null
          rubric_level?: string | null
          score?: number | null
          student_id?: string | null
        }
        Update: {
          assessment_id?: string
          created_at?: string | null
          id?: string
          remarks?: string | null
          rubric_level?: string | null
          score?: number | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_scores_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_sections: {
        Row: {
          assessment_id: string
          created_at: string
          display_order: number
          estimated_minutes: number | null
          id: string
          instructions: string | null
          marks: number
          title: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          display_order: number
          estimated_minutes?: number | null
          id?: string
          instructions?: string | null
          marks?: number
          title: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          display_order?: number
          estimated_minutes?: number | null
          id?: string
          instructions?: string | null
          marks?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sections_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          class_id: string | null
          created_at: string | null
          homework_id: string | null
          id: string
          lesson_plan_id: string | null
          school_id: string | null
          status: string
          subject_id: string | null
          teacher_id: string | null
          term: number | null
          title: string
          type: string
          updated_at: string | null
          week: number | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          homework_id?: string | null
          id?: string
          lesson_plan_id?: string | null
          school_id?: string | null
          status?: string
          subject_id?: string | null
          teacher_id?: string | null
          term?: number | null
          title: string
          type?: string
          updated_at?: string | null
          week?: number | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          homework_id?: string | null
          id?: string
          lesson_plan_id?: string | null
          school_id?: string | null
          status?: string
          subject_id?: string | null
          teacher_id?: string | null
          term?: number | null
          title?: string
          type?: string
          updated_at?: string | null
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          teaching_occurrence_id: string | null
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
          teaching_occurrence_id?: string | null
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
          teaching_occurrence_id?: string | null
          timetable_slot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "attendance_teaching_occurrence_id_fkey"
            columns: ["teaching_occurrence_id"]
            isOneToOne: false
            referencedRelation: "teaching_occurrences"
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
      billing_subscriptions: {
        Row: {
          amount: number
          billing_interval: string
          cancelled_at: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          ended_at: string | null
          external_ref: string | null
          id: string
          metadata: Json
          plan_key: string
          profile_id: string
          source: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          billing_interval: string
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          external_ref?: string | null
          id?: string
          metadata?: Json
          plan_key: string
          profile_id: string
          source?: string
          started_at: string
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_interval?: string
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          external_ref?: string | null
          id?: string
          metadata?: Json
          plan_key?: string
          profile_id?: string
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cbc_assessments: {
        Row: {
          academic_year: number
          assessment_type: string
          class_id: string
          created_at: string
          homework_id: string | null
          id: string
          lesson_plan_id: string | null
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
          homework_id?: string | null
          id?: string
          lesson_plan_id?: string | null
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
          homework_id?: string | null
          id?: string
          lesson_plan_id?: string | null
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
            foreignKeyName: "cbc_assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbc_assessments_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbc_assessments_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbc_assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbc_assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
        ]
      }
      cbc_strands: {
        Row: {
          core_competencies: string[] | null
          core_values: string[] | null
          created_at: string
          grade: string
          id: string
          key_inquiry_questions: string[] | null
          learning_outcomes: string[] | null
          name: string
          source_ref: string | null
          strand_order: number | null
          sub_strand: string | null
          sub_strand_order: number | null
          subject_id: string
          suggested_experiences: string[] | null
          term: number | null
          week: number | null
        }
        Insert: {
          core_competencies?: string[] | null
          core_values?: string[] | null
          created_at?: string
          grade: string
          id?: string
          key_inquiry_questions?: string[] | null
          learning_outcomes?: string[] | null
          name: string
          source_ref?: string | null
          strand_order?: number | null
          sub_strand?: string | null
          sub_strand_order?: number | null
          subject_id: string
          suggested_experiences?: string[] | null
          term?: number | null
          week?: number | null
        }
        Update: {
          core_competencies?: string[] | null
          core_values?: string[] | null
          created_at?: string
          grade?: string
          id?: string
          key_inquiry_questions?: string[] | null
          learning_outcomes?: string[] | null
          name?: string
          source_ref?: string | null
          strand_order?: number | null
          sub_strand?: string | null
          sub_strand_order?: number | null
          subject_id?: string
          suggested_experiences?: string[] | null
          term?: number | null
          week?: number | null
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
      chapter_learning_outcome_links: {
        Row: {
          alignment_strength: string
          chapter_id: string
          created_at: string
          created_by: string | null
          evidence_note: string | null
          id: string
          outcome_id: string
          publication_id: string
          sequence: number
          updated_at: string
        }
        Insert: {
          alignment_strength?: string
          chapter_id: string
          created_at?: string
          created_by?: string | null
          evidence_note?: string | null
          id?: string
          outcome_id: string
          publication_id: string
          sequence?: number
          updated_at?: string
        }
        Update: {
          alignment_strength?: string
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          evidence_note?: string | null
          id?: string
          outcome_id?: string
          publication_id?: string
          sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_learning_outcome_links_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_learning_outcome_links_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_learning_outcome_links_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
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
        }
        Insert: {
          class_id: string
          color?: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          class_id?: string
          color?: string
          created_at?: string | null
          id?: string
          name?: string
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
      class_resource_library: {
        Row: {
          available_from: string | null
          available_until: string | null
          class_id: string
          created_at: string
          id: string
          notes: string | null
          resource_id: string
          school_id: string
          status: string
          subject_id: string | null
          teacher_id: string
          updated_at: string
          usage_role: string
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          class_id: string
          created_at?: string
          id?: string
          notes?: string | null
          resource_id: string
          school_id: string
          status?: string
          subject_id?: string | null
          teacher_id: string
          updated_at?: string
          usage_role?: string
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          class_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          resource_id?: string
          school_id?: string
          status?: string
          subject_id?: string | null
          teacher_id?: string
          updated_at?: string
          usage_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_resource_library_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_resource_library_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_resource_library_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_resource_library_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_resource_library_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
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
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competency_evidence_ledger: {
        Row: {
          class_id: string | null
          created_at: string
          evidence_id: string | null
          evidence_source: string
          id: string
          max_score: number | null
          notes: string | null
          observed_at: string
          observed_by: string | null
          outcome_id: string
          proficiency: string | null
          school_id: string | null
          score: number | null
          student_id: string
          subject_id: string | null
          weight: number
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          evidence_id?: string | null
          evidence_source: string
          id?: string
          max_score?: number | null
          notes?: string | null
          observed_at?: string
          observed_by?: string | null
          outcome_id: string
          proficiency?: string | null
          school_id?: string | null
          score?: number | null
          student_id: string
          subject_id?: string | null
          weight?: number
        }
        Update: {
          class_id?: string | null
          created_at?: string
          evidence_id?: string | null
          evidence_source?: string
          id?: string
          max_score?: number | null
          notes?: string | null
          observed_at?: string
          observed_by?: string | null
          outcome_id?: string
          proficiency?: string | null
          school_id?: string | null
          score?: number | null
          student_id?: string
          subject_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "competency_evidence_ledger_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_evidence_ledger_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_evidence_ledger_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_evidence_ledger_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_evidence_ledger_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_evidence_ledger_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          id: string
          message: string
          priority: string
          requester_id: string
          resolved_at: string | null
          school_id: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          id?: string
          message: string
          priority?: string
          requester_id: string
          resolved_at?: string | null
          school_id?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          priority?: string
          requester_id?: string
          resolved_at?: string | null
          school_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_assessment_blueprints: {
        Row: {
          assessment_type: string
          bloom_distribution: Json
          class_id: string | null
          created_at: string
          difficulty_distribution: Json
          duration_minutes: number | null
          id: string
          school_id: string | null
          status: string
          subject_id: string | null
          teacher_id: string
          title: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          assessment_type: string
          bloom_distribution?: Json
          class_id?: string | null
          created_at?: string
          difficulty_distribution?: Json
          duration_minutes?: number | null
          id?: string
          school_id?: string | null
          status?: string
          subject_id?: string | null
          teacher_id: string
          title: string
          total_marks: number
          updated_at?: string
        }
        Update: {
          assessment_type?: string
          bloom_distribution?: Json
          class_id?: string | null
          created_at?: string
          difficulty_distribution?: Json
          duration_minutes?: number | null
          id?: string
          school_id?: string | null
          status?: string
          subject_id?: string | null
          teacher_id?: string
          title?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_assessment_blueprints_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_assessment_blueprints_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_assessment_blueprints_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_assessment_blueprints_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_assessment_sources: {
        Row: {
          blueprint_id: string
          created_at: string
          id: string
          outcome_id: string | null
          resource_id: string
          scheme_resource_link_id: string | null
          weight: number
        }
        Insert: {
          blueprint_id: string
          created_at?: string
          id?: string
          outcome_id?: string | null
          resource_id: string
          scheme_resource_link_id?: string | null
          weight?: number
        }
        Update: {
          blueprint_id?: string
          created_at?: string
          id?: string
          outcome_id?: string | null
          resource_id?: string
          scheme_resource_link_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_assessment_sources_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "content_assessment_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_assessment_sources_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_assessment_sources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_assessment_sources_scheme_resource_link_id_fkey"
            columns: ["scheme_resource_link_id"]
            isOneToOne: false
            referencedRelation: "scheme_lesson_resource_links"
            referencedColumns: ["id"]
          },
        ]
      }
      content_assets: {
        Row: {
          alt_text: string | null
          asset_type: string
          caption: string | null
          chapter_id: string | null
          created_at: string
          created_by: string
          id: string
          license: string | null
          metadata: Json
          public_url: string | null
          publication_id: string
          status: string
          storage_path: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          asset_type: string
          caption?: string | null
          chapter_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          license?: string | null
          metadata?: Json
          public_url?: string | null
          publication_id: string
          status?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          asset_type?: string
          caption?: string | null
          chapter_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          license?: string | null
          metadata?: Json
          public_url?: string | null
          publication_id?: string
          status?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_assets_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_assets_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      content_assignment_learners: {
        Row: {
          assigned_at: string
          assignment_id: string
          completed_at: string | null
          created_at: string
          id: string
          opened_at: string | null
          status: string
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assignment_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          status?: string
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assignment_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_assignment_learners_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapter_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_assignment_learners_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      content_block_outcome_links: {
        Row: {
          chapter_id: string
          content_block_id: string
          created_at: string
          created_by: string | null
          id: string
          outcome_id: string
          publication_id: string
          relationship: string
        }
        Insert: {
          chapter_id: string
          content_block_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          outcome_id: string
          publication_id: string
          relationship?: string
        }
        Update: {
          chapter_id?: string
          content_block_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          outcome_id?: string
          publication_id?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_block_outcome_links_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_block_outcome_links_content_block_id_fkey"
            columns: ["content_block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_block_outcome_links_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_block_outcome_links_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      content_blocks: {
        Row: {
          asset_id: string | null
          block_type: string
          chapter_id: string
          created_at: string
          id: string
          is_assessable: boolean
          is_teacher_only: boolean
          legacy_block_id: string | null
          payload: Json
          plain_text: string | null
          publication_id: string
          sequence: number
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          block_type: string
          chapter_id: string
          created_at?: string
          id?: string
          is_assessable?: boolean
          is_teacher_only?: boolean
          legacy_block_id?: string | null
          payload?: Json
          plain_text?: string | null
          publication_id: string
          sequence: number
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          block_type?: string
          chapter_id?: string
          created_at?: string
          id?: string
          is_assessable?: boolean
          is_teacher_only?: boolean
          legacy_block_id?: string | null
          payload?: Json
          plain_text?: string | null
          publication_id?: string
          sequence?: number
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_blocks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "content_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_blocks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_blocks_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      content_derivatives: {
        Row: {
          audience: string
          body: Json
          class_id: string | null
          created_at: string
          created_by: string
          derivative_type: string
          generator: string | null
          id: string
          model: string | null
          quality: Json
          school_id: string | null
          source_block_id: string | null
          source_chapter_id: string
          source_outcome_id: string | null
          source_publication_id: string
          source_resource_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body?: Json
          class_id?: string | null
          created_at?: string
          created_by: string
          derivative_type: string
          generator?: string | null
          id?: string
          model?: string | null
          quality?: Json
          school_id?: string | null
          source_block_id?: string | null
          source_chapter_id: string
          source_outcome_id?: string | null
          source_publication_id: string
          source_resource_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: Json
          class_id?: string | null
          created_at?: string
          created_by?: string
          derivative_type?: string
          generator?: string | null
          id?: string
          model?: string | null
          quality?: Json
          school_id?: string | null
          source_block_id?: string | null
          source_chapter_id?: string
          source_outcome_id?: string | null
          source_publication_id?: string
          source_resource_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_derivatives_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_derivatives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_derivatives_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_derivatives_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_derivatives_source_block_id_fkey"
            columns: ["source_block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_derivatives_source_chapter_id_fkey"
            columns: ["source_chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_derivatives_source_outcome_id_fkey"
            columns: ["source_outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_derivatives_source_publication_id_fkey"
            columns: ["source_publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_derivatives_source_resource_id_fkey"
            columns: ["source_resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      content_engine_authorities: {
        Row: {
          authoritative_table: string
          authority_role: string
          derived_tables: string[]
          domain: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          authoritative_table: string
          authority_role: string
          derived_tables?: string[]
          domain: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          authoritative_table?: string
          authority_role?: string
          derived_tables?: string[]
          domain?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      content_engine_cycle_metrics: {
        Row: {
          created_at: string
          dimensions: Json
          id: string
          metric_key: string
          metric_value: number
          run_id: string | null
        }
        Insert: {
          created_at?: string
          dimensions?: Json
          id?: string
          metric_key: string
          metric_value?: number
          run_id?: string | null
        }
        Update: {
          created_at?: string
          dimensions?: Json
          id?: string
          metric_key?: string
          metric_value?: number
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_engine_cycle_metrics_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "curriculum_intelligence_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_engine_daily_metrics: {
        Row: {
          calculated_at: string
          class_id: string | null
          dimensions: Json
          id: string
          metric_date: string
          metric_key: string
          metric_value: number
          school_id: string | null
          subject_id: string | null
          teacher_id: string | null
        }
        Insert: {
          calculated_at?: string
          class_id?: string | null
          dimensions?: Json
          id?: string
          metric_date: string
          metric_key: string
          metric_value?: number
          school_id?: string | null
          subject_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          calculated_at?: string
          class_id?: string | null
          dimensions?: Json
          id?: string
          metric_date?: string
          metric_key?: string
          metric_value?: number
          school_id?: string | null
          subject_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_engine_daily_metrics_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_engine_daily_metrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_engine_daily_metrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_engine_daily_metrics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_learning_events: {
        Row: {
          chapter_id: string | null
          content_block_id: string | null
          created_at: string
          duration_ms: number | null
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          outcome_id: string | null
          publication_id: string
          student_id: string
        }
        Insert: {
          chapter_id?: string | null
          content_block_id?: string | null
          created_at?: string
          duration_ms?: number | null
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          outcome_id?: string | null
          publication_id: string
          student_id: string
        }
        Update: {
          chapter_id?: string | null
          content_block_id?: string | null
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          outcome_id?: string | null
          publication_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_learning_events_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_learning_events_content_block_id_fkey"
            columns: ["content_block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_learning_events_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_learning_events_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      content_preferences: {
        Row: {
          created_at: string | null
          curriculum_content_id: string
          id: string
          school_id: string
          subject_id: string
          teacher_id: string | null
        }
        Insert: {
          created_at?: string | null
          curriculum_content_id: string
          id?: string
          school_id: string
          subject_id: string
          teacher_id?: string | null
        }
        Update: {
          created_at?: string | null
          curriculum_content_id?: string
          id?: string
          school_id?: string
          subject_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_preferences_curriculum_content_id_fkey"
            columns: ["curriculum_content_id"]
            isOneToOne: false
            referencedRelation: "curriculum_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_preferences_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_preferences_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_preferences_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_preferences_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_submission_evidence: {
        Row: {
          assignment_learner_id: string
          created_at: string
          evidence_type: string
          file_url: string | null
          id: string
          metadata: Json
          status: string
          submitted_at: string
          submitted_by: string | null
          text_response: string | null
        }
        Insert: {
          assignment_learner_id: string
          created_at?: string
          evidence_type: string
          file_url?: string | null
          id?: string
          metadata?: Json
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          text_response?: string | null
        }
        Update: {
          assignment_learner_id?: string
          created_at?: string
          evidence_type?: string
          file_url?: string | null
          id?: string
          metadata?: Json
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          text_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_submission_evidence_assignment_learner_id_fkey"
            columns: ["assignment_learner_id"]
            isOneToOne: false
            referencedRelation: "content_assignment_learners"
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
          global_subject_id: string
          grade: string
          id: string
          periods: number | null
          reference: string | null
          strand: string
          sub_strand: string
          sub_strand_id: string | null
          subject: string
          term: number
          topic: string
          week: number
        }
        Insert: {
          created_at?: string | null
          curriculum: string
          global_subject_id: string
          grade: string
          id?: string
          periods?: number | null
          reference?: string | null
          strand: string
          sub_strand: string
          sub_strand_id?: string | null
          subject: string
          term: number
          topic: string
          week: number
        }
        Update: {
          created_at?: string | null
          curriculum?: string
          global_subject_id?: string
          grade?: string
          id?: string
          periods?: number | null
          reference?: string | null
          strand?: string
          sub_strand?: string
          sub_strand_id?: string | null
          subject?: string
          term?: number
          topic?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_global_subject_id_fkey"
            columns: ["global_subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_sub_strand_id_fkey"
            columns: ["sub_strand_id"]
            isOneToOne: false
            referencedRelation: "cbc_strands"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_content: {
        Row: {
          created_at: string | null
          curriculum_id: string
          id: string
          lesson_context: Json | null
          parent_brief: Json | null
          publisher_name: string | null
          school_id: string | null
          source: string
          source_type: string
          updated_at: string | null
          version: number
        }
        Insert: {
          created_at?: string | null
          curriculum_id: string
          id?: string
          lesson_context?: Json | null
          parent_brief?: Json | null
          publisher_name?: string | null
          school_id?: string | null
          source?: string
          source_type?: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          created_at?: string | null
          curriculum_id?: string
          id?: string
          lesson_context?: Json | null
          parent_brief?: Json | null
          publisher_name?: string | null
          school_id?: string | null
          source?: string
          source_type?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_content_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_content_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_content_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_content_health_signals: {
        Row: {
          chapter_id: string | null
          content_block_id: string | null
          created_at: string
          evidence: Json
          evidence_count: number
          first_detected_at: string
          id: string
          last_detected_at: string
          outcome_id: string | null
          publication_id: string | null
          score: number
          severity: string
          signal_type: string
          status: string
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          content_block_id?: string | null
          created_at?: string
          evidence?: Json
          evidence_count?: number
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          outcome_id?: string | null
          publication_id?: string | null
          score?: number
          severity?: string
          signal_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          content_block_id?: string | null
          created_at?: string
          evidence?: Json
          evidence_count?: number
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          outcome_id?: string | null
          publication_id?: string | null
          score?: number
          severity?: string
          signal_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_content_health_signals_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_content_health_signals_content_block_id_fkey"
            columns: ["content_block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_content_health_signals_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_content_health_signals_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_content_rights: {
        Row: {
          attribution_text: string | null
          can_adapt: boolean
          can_quote: boolean
          can_reproduce_media: boolean
          created_at: string
          id: string
          license_name: string | null
          notes: string | null
          proposal_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rights_class: string
          source_domain: string | null
          source_url: string
          updated_at: string
        }
        Insert: {
          attribution_text?: string | null
          can_adapt?: boolean
          can_quote?: boolean
          can_reproduce_media?: boolean
          created_at?: string
          id?: string
          license_name?: string | null
          notes?: string | null
          proposal_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_class: string
          source_domain?: string | null
          source_url: string
          updated_at?: string
        }
        Update: {
          attribution_text?: string | null
          can_adapt?: boolean
          can_quote?: boolean
          can_reproduce_media?: boolean
          created_at?: string
          id?: string
          license_name?: string | null
          notes?: string | null
          proposal_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_class?: string
          source_domain?: string | null
          source_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_content_rights_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "curriculum_intelligence_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_editorial_actions: {
        Row: {
          action_type: string
          attempt_count: number
          chapter_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          health_signal_id: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string | null
          output: Json
          priority: number
          proposal_id: string | null
          publication_id: string | null
          rationale: string
          status: string
          updated_at: string
        }
        Insert: {
          action_type: string
          attempt_count?: number
          chapter_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          health_signal_id?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          output?: Json
          priority?: number
          proposal_id?: string | null
          publication_id?: string | null
          rationale: string
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          attempt_count?: number
          chapter_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          health_signal_id?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          output?: Json
          priority?: number
          proposal_id?: string | null
          publication_id?: string | null
          rationale?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_editorial_actions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_editorial_actions_health_signal_id_fkey"
            columns: ["health_signal_id"]
            isOneToOne: false
            referencedRelation: "curriculum_content_health_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_editorial_actions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "curriculum_intelligence_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_editorial_actions_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_editorial_effectiveness: {
        Row: {
          applied_at: string | null
          baseline: Json
          baseline_started_at: string | null
          chapter_id: string | null
          created_at: string
          effect_score: number | null
          evaluated_at: string | null
          evaluation_due_at: string | null
          followup: Json
          id: string
          notes: string | null
          outcome_id: string | null
          proposal_id: string
          publication_id: string | null
          sample_size: number
          updated_at: string
          verdict: string
        }
        Insert: {
          applied_at?: string | null
          baseline?: Json
          baseline_started_at?: string | null
          chapter_id?: string | null
          created_at?: string
          effect_score?: number | null
          evaluated_at?: string | null
          evaluation_due_at?: string | null
          followup?: Json
          id?: string
          notes?: string | null
          outcome_id?: string | null
          proposal_id: string
          publication_id?: string | null
          sample_size?: number
          updated_at?: string
          verdict?: string
        }
        Update: {
          applied_at?: string | null
          baseline?: Json
          baseline_started_at?: string | null
          chapter_id?: string | null
          created_at?: string
          effect_score?: number | null
          evaluated_at?: string | null
          evaluation_due_at?: string | null
          followup?: Json
          id?: string
          notes?: string | null
          outcome_id?: string | null
          proposal_id?: string
          publication_id?: string | null
          sample_size?: number
          updated_at?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_editorial_effectiveness_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_editorial_effectiveness_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_editorial_effectiveness_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "curriculum_intelligence_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_editorial_effectiveness_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_intelligence_audit: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          note: string | null
          proposal_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          proposal_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          proposal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_intelligence_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_intelligence_audit_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "curriculum_intelligence_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_intelligence_proposals: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          chapter_id: string | null
          claim: string | null
          confidence: number
          created_at: string
          current_content: string | null
          curriculum_id: string | null
          curriculum_relevance: string
          derivative_impacts: Json
          editorial_model: string | null
          editorial_patch: Json | null
          editorial_prepared_at: string | null
          editorial_status: string
          engine_run_id: string | null
          generated_at: string
          generated_by: string
          id: string
          outcome_id: string | null
          patch: Json
          proposal_type: string
          proposed_content: string
          publication_id: string | null
          rationale: string
          research_fingerprint: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
          verification_status: string
          volatility: string
          watch_target_id: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          chapter_id?: string | null
          claim?: string | null
          confidence?: number
          created_at?: string
          current_content?: string | null
          curriculum_id?: string | null
          curriculum_relevance?: string
          derivative_impacts?: Json
          editorial_model?: string | null
          editorial_patch?: Json | null
          editorial_prepared_at?: string | null
          editorial_status?: string
          engine_run_id?: string | null
          generated_at?: string
          generated_by?: string
          id?: string
          outcome_id?: string | null
          patch?: Json
          proposal_type: string
          proposed_content: string
          publication_id?: string | null
          rationale: string
          research_fingerprint?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
          verification_status?: string
          volatility?: string
          watch_target_id?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          chapter_id?: string | null
          claim?: string | null
          confidence?: number
          created_at?: string
          current_content?: string | null
          curriculum_id?: string | null
          curriculum_relevance?: string
          derivative_impacts?: Json
          editorial_model?: string | null
          editorial_patch?: Json | null
          editorial_prepared_at?: string | null
          editorial_status?: string
          engine_run_id?: string | null
          generated_at?: string
          generated_by?: string
          id?: string
          outcome_id?: string | null
          patch?: Json
          proposal_type?: string
          proposed_content?: string
          publication_id?: string | null
          rationale?: string
          research_fingerprint?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          verification_status?: string
          volatility?: string
          watch_target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_intelligence_proposals_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_intelligence_proposals_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_intelligence_proposals_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_intelligence_proposals_engine_run_id_fkey"
            columns: ["engine_run_id"]
            isOneToOne: false
            referencedRelation: "curriculum_intelligence_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_intelligence_proposals_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_intelligence_proposals_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_intelligence_proposals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_intelligence_proposals_watch_target_id_fkey"
            columns: ["watch_target_id"]
            isOneToOne: false
            referencedRelation: "curriculum_intelligence_watch_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_intelligence_regeneration_jobs: {
        Row: {
          attempt_count: number
          chapter_id: string
          completed_at: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          proposal_id: string
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          chapter_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          proposal_id: string
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          chapter_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          proposal_id?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_intelligence_regeneration_jobs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_intelligence_regeneration_jobs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "curriculum_intelligence_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_intelligence_runs: {
        Row: {
          completed_at: string | null
          error: string | null
          id: string
          metadata: Json
          model: string | null
          proposals_created: number
          search_requests: number
          sources_found: number
          started_at: string
          started_by: string | null
          status: string
          summary: string | null
          trigger_type: string
          watch_target_id: string | null
        }
        Insert: {
          completed_at?: string | null
          error?: string | null
          id?: string
          metadata?: Json
          model?: string | null
          proposals_created?: number
          search_requests?: number
          sources_found?: number
          started_at?: string
          started_by?: string | null
          status?: string
          summary?: string | null
          trigger_type?: string
          watch_target_id?: string | null
        }
        Update: {
          completed_at?: string | null
          error?: string | null
          id?: string
          metadata?: Json
          model?: string | null
          proposals_created?: number
          search_requests?: number
          sources_found?: number
          started_at?: string
          started_by?: string | null
          status?: string
          summary?: string | null
          trigger_type?: string
          watch_target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_intelligence_runs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_intelligence_runs_watch_target_id_fkey"
            columns: ["watch_target_id"]
            isOneToOne: false
            referencedRelation: "curriculum_intelligence_watch_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_intelligence_watch_targets: {
        Row: {
          cadence: string
          chapter_id: string | null
          created_at: string
          created_by: string
          enabled: boolean
          grade: string | null
          id: string
          label: string
          last_checked_at: string | null
          next_check_at: string | null
          preferred_domains: string[]
          publication_id: string | null
          query: string
          scope_type: string
          source_priority: Json
          subject: string | null
          updated_at: string
        }
        Insert: {
          cadence?: string
          chapter_id?: string | null
          created_at?: string
          created_by: string
          enabled?: boolean
          grade?: string | null
          id?: string
          label: string
          last_checked_at?: string | null
          next_check_at?: string | null
          preferred_domains?: string[]
          publication_id?: string | null
          query: string
          scope_type: string
          source_priority?: Json
          subject?: string | null
          updated_at?: string
        }
        Update: {
          cadence?: string
          chapter_id?: string | null
          created_at?: string
          created_by?: string
          enabled?: boolean
          grade?: string | null
          id?: string
          label?: string
          last_checked_at?: string | null
          next_check_at?: string | null
          preferred_domains?: string[]
          publication_id?: string | null
          query?: string
          scope_type?: string
          source_priority?: Json
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_intelligence_watch_targets_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_intelligence_watch_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_intelligence_watch_targets_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_learning_outcomes: {
        Row: {
          bloom_level: string | null
          competency_tags: string[]
          created_at: string
          created_by: string | null
          curriculum_id: string | null
          difficulty: string | null
          id: string
          outcome_code: string | null
          outcome_text: string
          source_ref: string | null
          source_type: string
          status: string
          sub_strand_id: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bloom_level?: string | null
          competency_tags?: string[]
          created_at?: string
          created_by?: string | null
          curriculum_id?: string | null
          difficulty?: string | null
          id?: string
          outcome_code?: string | null
          outcome_text: string
          source_ref?: string | null
          source_type?: string
          status?: string
          sub_strand_id?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bloom_level?: string | null
          competency_tags?: string[]
          created_at?: string
          created_by?: string | null
          curriculum_id?: string | null
          difficulty?: string | null
          id?: string
          outcome_code?: string | null
          outcome_text?: string
          source_ref?: string | null
          source_type?: string
          status?: string
          sub_strand_id?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_learning_outcomes_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_learning_outcomes_sub_strand_id_fkey"
            columns: ["sub_strand_id"]
            isOneToOne: false
            referencedRelation: "cbc_strands"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_outcome_prerequisites: {
        Row: {
          created_at: string
          minimum_mastery: number
          outcome_id: string
          prerequisite_outcome_id: string
        }
        Insert: {
          created_at?: string
          minimum_mastery?: number
          outcome_id: string
          prerequisite_outcome_id: string
        }
        Update: {
          created_at?: string
          minimum_mastery?: number
          outcome_id?: string
          prerequisite_outcome_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_outcome_prerequisites_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_outcome_prerequisites_prerequisite_outcome_id_fkey"
            columns: ["prerequisite_outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
        ]
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
          calibration_sample_size: number
          correct_index: number
          created_at: string
          difficulty: Database["public"]["Enums"]["exam_difficulty"]
          empirical_difficulty: number | null
          explanation: string
          form: Database["public"]["Enums"]["exam_form"]
          hint: string | null
          id: string
          options: Json
          provenance_status: string
          question: string
          source: string
          source_paper: string | null
          source_ref: string | null
          source_year: number | null
          status: string
          subject: Database["public"]["Enums"]["exam_subject"]
          teaching_note: string
          times_flagged: number
          times_served: number
          topic: string
          verified_at: string | null
        }
        Insert: {
          calibration_sample_size?: number
          correct_index: number
          created_at?: string
          difficulty: Database["public"]["Enums"]["exam_difficulty"]
          empirical_difficulty?: number | null
          explanation: string
          form: Database["public"]["Enums"]["exam_form"]
          hint?: string | null
          id?: string
          options: Json
          provenance_status?: string
          question: string
          source?: string
          source_paper?: string | null
          source_ref?: string | null
          source_year?: number | null
          status?: string
          subject: Database["public"]["Enums"]["exam_subject"]
          teaching_note: string
          times_flagged?: number
          times_served?: number
          topic: string
          verified_at?: string | null
        }
        Update: {
          calibration_sample_size?: number
          correct_index?: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["exam_difficulty"]
          empirical_difficulty?: number | null
          explanation?: string
          form?: Database["public"]["Enums"]["exam_form"]
          hint?: string | null
          id?: string
          options?: Json
          provenance_status?: string
          question?: string
          source?: string
          source_paper?: string | null
          source_ref?: string | null
          source_year?: number | null
          status?: string
          subject?: Database["public"]["Enums"]["exam_subject"]
          teaching_note?: string
          times_flagged?: number
          times_served?: number
          topic?: string
          verified_at?: string | null
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
            foreignKeyName: "exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
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
      exercise_submissions: {
        Row: {
          created_at: string | null
          exercise_id: string
          feedback: string | null
          id: string
          mark: number | null
          notes: string | null
          photo_url: string | null
          status: string
          student_id: string | null
          submitted_at: string | null
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          feedback?: string | null
          id?: string
          mark?: number | null
          notes?: string | null
          photo_url?: string | null
          status?: string
          student_id?: string | null
          submitted_at?: string | null
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          feedback?: string | null
          id?: string
          mark?: number | null
          notes?: string | null
          photo_url?: string | null
          status?: string
          student_id?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_submissions_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          class_id: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          instructions: string | null
          lesson_plan_id: string | null
          school_id: string | null
          status: string
          subject_id: string | null
          teacher_id: string | null
          title: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          lesson_plan_id?: string | null
          school_id?: string | null
          status?: string
          subject_id?: string | null
          teacher_id?: string | null
          title: string
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          lesson_plan_id?: string | null
          school_id?: string | null
          status?: string
          subject_id?: string | null
          teacher_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          total_marks: number
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
      funhub_exams: {
        Row: {
          created_at: string | null
          duration_mins: number
          expires_at: string | null
          grade: number
          id: string
          parent_id: string | null
          question_ids: Json
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
          question_ids: Json
          status?: string | null
          student_id?: string | null
          subject: string
          title: string
          total_marks: number
        }
        Update: {
          created_at?: string | null
          duration_mins?: number
          expires_at?: string | null
          grade?: number
          id?: string
          parent_id?: string | null
          question_ids?: Json
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
            referencedRelation: "school_directory_public"
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
      generated_assessment_items: {
        Row: {
          answer_key: Json | null
          assessment_id: string
          bloom_level: string | null
          created_at: string
          difficulty: string | null
          id: string
          marks: number
          options: Json | null
          outcome_id: string | null
          prompt: string
          question_type: string
          sequence: number
          source_block_id: string | null
          source_resource_id: string | null
        }
        Insert: {
          answer_key?: Json | null
          assessment_id: string
          bloom_level?: string | null
          created_at?: string
          difficulty?: string | null
          id?: string
          marks: number
          options?: Json | null
          outcome_id?: string | null
          prompt: string
          question_type: string
          sequence: number
          source_block_id?: string | null
          source_resource_id?: string | null
        }
        Update: {
          answer_key?: Json | null
          assessment_id?: string
          bloom_level?: string | null
          created_at?: string
          difficulty?: string | null
          id?: string
          marks?: number
          options?: Json | null
          outcome_id?: string | null
          prompt?: string
          question_type?: string
          sequence?: number
          source_block_id?: string | null
          source_resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_assessment_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "generated_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_assessment_items_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_assessment_items_source_block_id_fkey"
            columns: ["source_block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_assessment_items_source_resource_id_fkey"
            columns: ["source_resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_assessments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          blueprint_id: string
          generated_at: string
          generated_by: string | null
          id: string
          status: string
          total_marks: number
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          blueprint_id: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          status?: string
          total_marks: number
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          blueprint_id?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          status?: string
          total_marks?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "generated_assessments_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "content_assessment_blueprints"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          class_id: string | null
          content_pack_id: string | null
          content_pack_version: number | null
          created_at: string | null
          due_date: string | null
          id: string
          instructions: string | null
          lesson_plan_id: string | null
          school_id: string
          subject: string | null
          teacher_id: string | null
          teaching_occurrence_id: string | null
          title: string
          type: string
        }
        Insert: {
          class_id?: string | null
          content_pack_id?: string | null
          content_pack_version?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          lesson_plan_id?: string | null
          school_id: string
          subject?: string | null
          teacher_id?: string | null
          teaching_occurrence_id?: string | null
          title: string
          type?: string
        }
        Update: {
          class_id?: string | null
          content_pack_id?: string | null
          content_pack_version?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          lesson_plan_id?: string | null
          school_id?: string
          subject?: string | null
          teacher_id?: string | null
          teaching_occurrence_id?: string | null
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
            foreignKeyName: "homework_content_pack_id_fkey"
            columns: ["content_pack_id"]
            isOneToOne: false
            referencedRelation: "curriculum_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
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
            foreignKeyName: "homework_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_teaching_occurrence_id_fkey"
            columns: ["teaching_occurrence_id"]
            isOneToOne: false
            referencedRelation: "teaching_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_answers: {
        Row: {
          answer_text: string | null
          created_at: string
          id: string
          question_id: string
          submission_id: string
        }
        Insert: {
          answer_text?: string | null
          created_at?: string
          id?: string
          question_id: string
          submission_id: string
        }
        Update: {
          answer_text?: string | null
          created_at?: string
          id?: string
          question_id?: string
          submission_id?: string
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
      homework_question_bank: {
        Row: {
          answer: string | null
          author_id: string | null
          content_pack_id: string | null
          created_at: string
          curriculum_id: string
          difficulty: string | null
          id: string
          question_text: string
          question_type: string
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          author_id?: string | null
          content_pack_id?: string | null
          created_at?: string
          curriculum_id: string
          difficulty?: string | null
          id?: string
          question_text: string
          question_type: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          author_id?: string | null
          content_pack_id?: string | null
          created_at?: string
          curriculum_id?: string
          difficulty?: string | null
          id?: string
          question_text?: string
          question_type?: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_question_bank_content_pack_id_fkey"
            columns: ["content_pack_id"]
            isOneToOne: false
            referencedRelation: "curriculum_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_question_bank_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_questions: {
        Row: {
          created_at: string
          homework_id: string
          id: string
          model_answer: string | null
          order_num: number
          question: string
          source_block_id: string | null
          source_outcome_id: string | null
          source_resource_id: string | null
        }
        Insert: {
          created_at?: string
          homework_id: string
          id?: string
          model_answer?: string | null
          order_num: number
          question: string
          source_block_id?: string | null
          source_outcome_id?: string | null
          source_resource_id?: string | null
        }
        Update: {
          created_at?: string
          homework_id?: string
          id?: string
          model_answer?: string | null
          order_num?: number
          question?: string
          source_block_id?: string | null
          source_outcome_id?: string | null
          source_resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_questions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_questions_source_block_id_fkey"
            columns: ["source_block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_questions_source_outcome_id_fkey"
            columns: ["source_outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_questions_source_resource_id_fkey"
            columns: ["source_resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          created_at: string | null
          feedback: string | null
          feedback_released_at: string | null
          homework_id: string | null
          id: string
          mark: number | null
          photo_url: string | null
          received_at: string | null
          returned_at: string | null
          returned_reason: string | null
          revision_number: number
          status: string
          student_id: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          feedback?: string | null
          feedback_released_at?: string | null
          homework_id?: string | null
          id?: string
          mark?: number | null
          photo_url?: string | null
          received_at?: string | null
          returned_at?: string | null
          returned_reason?: string | null
          revision_number?: number
          status?: string
          student_id?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          feedback?: string | null
          feedback_released_at?: string | null
          homework_id?: string | null
          id?: string
          mark?: number | null
          photo_url?: string | null
          received_at?: string | null
          returned_at?: string | null
          returned_reason?: string | null
          revision_number?: number
          status?: string
          student_id?: string | null
          submitted_at?: string | null
          updated_at?: string
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
      hq_automation_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          result: Json
          run_type: string
          started_at: string
          status: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          result?: Json
          run_type: string
          started_at?: string
          status: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          result?: Json
          run_type?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      hq_certification_results: {
        Row: {
          area: string
          certification_version: string
          checked_at: string
          evidence: Json
          id: string
          question: string
          question_no: number
          result: string
        }
        Insert: {
          area: string
          certification_version: string
          checked_at?: string
          evidence?: Json
          id?: string
          question: string
          question_no: number
          result: string
        }
        Update: {
          area?: string
          certification_version?: string
          checked_at?: string
          evidence?: Json
          id?: string
          question?: string
          question_no?: number
          result?: string
        }
        Relationships: []
      }
      hq_company_snapshots: {
        Row: {
          captured_at: string
          evidence: Json
          id: string
          metrics: Json
          snapshot_date: string
        }
        Insert: {
          captured_at?: string
          evidence?: Json
          id?: string
          metrics?: Json
          snapshot_date: string
        }
        Update: {
          captured_at?: string
          evidence?: Json
          id?: string
          metrics?: Json
          snapshot_date?: string
        }
        Relationships: []
      }
      hq_content_domains: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          icon: string | null
          key: string
          name: string
          sort_order: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          key: string
          name: string
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          key?: string
          name?: string
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      hq_context_decision_snapshots: {
        Row: {
          actor_key: string
          actor_type: string
          context_version: string
          created_at: string
          decision_key: string
          decision_type: string
          facts: Json
          id: string
          outcome: Json | null
          reason: string
          rules_version: string
          taken_at: string
        }
        Insert: {
          actor_key: string
          actor_type: string
          context_version: string
          created_at?: string
          decision_key: string
          decision_type: string
          facts: Json
          id?: string
          outcome?: Json | null
          reason: string
          rules_version: string
          taken_at?: string
        }
        Update: {
          actor_key?: string
          actor_type?: string
          context_version?: string
          created_at?: string
          decision_key?: string
          decision_type?: string
          facts?: Json
          id?: string
          outcome?: Json | null
          reason?: string
          rules_version?: string
          taken_at?: string
        }
        Relationships: []
      }
      hq_context_fact_definitions: {
        Row: {
          computation_kind: string
          computation_ref: string
          confidence_method: string
          created_at: string
          effective_at: string
          fact_key: string
          freshness_seconds: number
          id: string
          retired_at: string | null
          source_id: string
          unit: string | null
          version: number
        }
        Insert: {
          computation_kind: string
          computation_ref: string
          confidence_method: string
          created_at?: string
          effective_at?: string
          fact_key: string
          freshness_seconds: number
          id?: string
          retired_at?: string | null
          source_id: string
          unit?: string | null
          version: number
        }
        Update: {
          computation_kind?: string
          computation_ref?: string
          confidence_method?: string
          created_at?: string
          effective_at?: string
          fact_key?: string
          freshness_seconds?: number
          id?: string
          retired_at?: string | null
          source_id?: string
          unit?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hq_context_fact_definitions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "hq_context_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_context_facts_cache: {
        Row: {
          computed_at: string
          confidence: number
          confidence_evidence: Json
          confidence_source: string
          fact_definition_id: string
          fact_key: string
          freshness_expires_at: string
          id: string
          scope_id: string
          value: Json
        }
        Insert: {
          computed_at?: string
          confidence: number
          confidence_evidence?: Json
          confidence_source: string
          fact_definition_id: string
          fact_key: string
          freshness_expires_at: string
          id?: string
          scope_id: string
          value: Json
        }
        Update: {
          computed_at?: string
          confidence?: number
          confidence_evidence?: Json
          confidence_source?: string
          fact_definition_id?: string
          fact_key?: string
          freshness_expires_at?: string
          id?: string
          scope_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "hq_context_facts_cache_fact_definition_id_fkey"
            columns: ["fact_definition_id"]
            isOneToOne: false
            referencedRelation: "hq_context_fact_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_context_facts_cache_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "hq_context_scopes"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_context_provenance: {
        Row: {
          computation_digest: string
          created_at: string
          fact_definition_id: string
          fact_key: string
          id: string
          raw_refs: Json
          snapshot_id: string
          source_id: string
        }
        Insert: {
          computation_digest: string
          created_at?: string
          fact_definition_id: string
          fact_key: string
          id?: string
          raw_refs?: Json
          snapshot_id: string
          source_id: string
        }
        Update: {
          computation_digest?: string
          created_at?: string
          fact_definition_id?: string
          fact_key?: string
          id?: string
          raw_refs?: Json
          snapshot_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_context_provenance_fact_definition_id_fkey"
            columns: ["fact_definition_id"]
            isOneToOne: false
            referencedRelation: "hq_context_fact_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_context_provenance_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "hq_context_decision_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_context_provenance_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "hq_context_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_context_scopes: {
        Row: {
          allowed_fact_keys: string[]
          created_at: string
          denied_fact_keys: string[]
          id: string
          scope_owner_key: string | null
          scope_type: string
        }
        Insert: {
          allowed_fact_keys?: string[]
          created_at?: string
          denied_fact_keys?: string[]
          id?: string
          scope_owner_key?: string | null
          scope_type: string
        }
        Update: {
          allowed_fact_keys?: string[]
          created_at?: string
          denied_fact_keys?: string[]
          id?: string
          scope_owner_key?: string | null
          scope_type?: string
        }
        Relationships: []
      }
      hq_context_sources: {
        Row: {
          active: boolean
          connection_ref: string | null
          created_at: string
          id: string
          name: string
          owner: string
          reliability_method: string
          reliability_score: number | null
          source_key: string
          source_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          connection_ref?: string | null
          created_at?: string
          id?: string
          name: string
          owner: string
          reliability_method: string
          reliability_score?: number | null
          source_key: string
          source_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          connection_ref?: string | null
          created_at?: string
          id?: string
          name?: string
          owner?: string
          reliability_method?: string
          reliability_score?: number | null
          source_key?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      hq_decision_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          decision_id: string | null
          details: Json
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          decision_id?: string | null
          details?: Json
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          decision_id?: string | null
          details?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_decision_audit_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "hq_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_decision_versions: {
        Row: {
          changed_at: string
          changed_by: string
          decision_id: string
          id: string
          snapshot: Json
          version: number
        }
        Insert: {
          changed_at?: string
          changed_by: string
          decision_id: string
          id?: string
          snapshot: Json
          version: number
        }
        Update: {
          changed_at?: string
          changed_by?: string
          decision_id?: string
          id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hq_decision_versions_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "hq_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_decisions: {
        Row: {
          affected_products: string[]
          approved_at: string | null
          approved_by: string | null
          category: string
          code: string
          created_at: string
          created_by: string
          decision_type: string
          effective_at: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          reason: string | null
          rollback_of_id: string | null
          rule_key: string | null
          rule_value: Json
          status: string
          supersedes_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          affected_products?: string[]
          approved_at?: string | null
          approved_by?: string | null
          category: string
          code: string
          created_at?: string
          created_by: string
          decision_type: string
          effective_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          reason?: string | null
          rollback_of_id?: string | null
          rule_key?: string | null
          rule_value?: Json
          status?: string
          supersedes_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          affected_products?: string[]
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          code?: string
          created_at?: string
          created_by?: string
          decision_type?: string
          effective_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          reason?: string | null
          rollback_of_id?: string | null
          rule_key?: string | null
          rule_value?: Json
          status?: string
          supersedes_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_decisions_rollback_of_id_fkey"
            columns: ["rollback_of_id"]
            isOneToOne: false
            referencedRelation: "hq_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_decisions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "hq_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_departments: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          key: string
          mandate: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          key: string
          mandate: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          key?: string
          mandate?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      hq_findings: {
        Row: {
          created_at: string
          decision_required: boolean
          department_key: string
          evidence: Json
          explanation: string
          finding_type: string
          fingerprint: string
          first_detected_at: string
          id: string
          last_detected_at: string
          recommended_action: string | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string
          why_it_matters: string
        }
        Insert: {
          created_at?: string
          decision_required?: boolean
          department_key: string
          evidence?: Json
          explanation: string
          finding_type: string
          fingerprint: string
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          recommended_action?: string | null
          resolved_at?: string | null
          severity: string
          status?: string
          title: string
          updated_at?: string
          why_it_matters: string
        }
        Update: {
          created_at?: string
          decision_required?: boolean
          department_key?: string
          evidence?: Json
          explanation?: string
          finding_type?: string
          fingerprint?: string
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          recommended_action?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          why_it_matters?: string
        }
        Relationships: []
      }
      hq_goals: {
        Row: {
          created_at: string
          department_key: string
          direction: string
          ends_at: string | null
          id: string
          key: string
          metric_key: string
          period: string
          starts_at: string
          status: string
          target: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_key: string
          direction?: string
          ends_at?: string | null
          id?: string
          key: string
          metric_key: string
          period?: string
          starts_at?: string
          status?: string
          target: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_key?: string
          direction?: string
          ends_at?: string | null
          id?: string
          key?: string
          metric_key?: string
          period?: string
          starts_at?: string
          status?: string
          target?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_goals_department_key_fkey"
            columns: ["department_key"]
            isOneToOne: false
            referencedRelation: "hq_departments"
            referencedColumns: ["key"]
          },
        ]
      }
      hq_incidents: {
        Row: {
          acknowledged_at: string | null
          detected_at: string
          evidence: Json
          fingerprint: string | null
          id: string
          incident_type: string
          owner_department: string | null
          recovery_evidence: Json
          resolved_at: string | null
          route: string | null
          severity: string
          status: string
          summary: string
          title: string
          verification_status: string
        }
        Insert: {
          acknowledged_at?: string | null
          detected_at?: string
          evidence?: Json
          fingerprint?: string | null
          id?: string
          incident_type: string
          owner_department?: string | null
          recovery_evidence?: Json
          resolved_at?: string | null
          route?: string | null
          severity: string
          status?: string
          summary?: string
          title: string
          verification_status?: string
        }
        Update: {
          acknowledged_at?: string | null
          detected_at?: string
          evidence?: Json
          fingerprint?: string | null
          id?: string
          incident_type?: string
          owner_department?: string | null
          recovery_evidence?: Json
          resolved_at?: string | null
          route?: string | null
          severity?: string
          status?: string
          summary?: string
          title?: string
          verification_status?: string
        }
        Relationships: []
      }
      hq_marketing_campaigns: {
        Row: {
          audience: string | null
          budget: number | null
          channel: string
          created_at: string
          created_by: string | null
          currency: string | null
          ends_at: string | null
          id: string
          name: string
          notes: string | null
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          audience?: string | null
          budget?: number | null
          channel: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          ends_at?: string | null
          id?: string
          name: string
          notes?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          audience?: string | null
          budget?: number | null
          channel?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hq_marketing_events: {
        Row: {
          campaign_id: string | null
          event_type: string
          id: number
          metadata: Json
          occurred_at: string
          profile_id: string | null
          source: string | null
        }
        Insert: {
          campaign_id?: string | null
          event_type: string
          id?: never
          metadata?: Json
          occurred_at?: string
          profile_id?: string | null
          source?: string | null
        }
        Update: {
          campaign_id?: string | null
          event_type?: string
          id?: never
          metadata?: Json
          occurred_at?: string
          profile_id?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_marketing_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "hq_marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_marketing_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_notifications: {
        Row: {
          body: string
          category: string
          created_at: string
          event_id: string | null
          id: string
          metadata: Json
          read_at: string | null
          resolved_at: string | null
          route: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          event_id?: string | null
          id?: string
          metadata?: Json
          read_at?: string | null
          resolved_at?: string | null
          route?: string | null
          severity?: string
          status?: string
          title: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          event_id?: string | null
          id?: string
          metadata?: Json
          read_at?: string | null
          resolved_at?: string | null
          route?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "platform_events"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_policy_evaluations: {
        Row: {
          context: Json
          created_at: string
          fallback_used: boolean
          id: number
          policy_key: string
          product_key: string
          reason: string
          source_decision_id: string | null
          source_version: number | null
          value: Json | null
        }
        Insert: {
          context?: Json
          created_at?: string
          fallback_used?: boolean
          id?: never
          policy_key: string
          product_key: string
          reason: string
          source_decision_id?: string | null
          source_version?: number | null
          value?: Json | null
        }
        Update: {
          context?: Json
          created_at?: string
          fallback_used?: boolean
          id?: never
          policy_key?: string
          product_key?: string
          reason?: string
          source_decision_id?: string | null
          source_version?: number | null
          value?: Json | null
        }
        Relationships: []
      }
      hq_policy_registry: {
        Row: {
          active: boolean
          allowed_products: string[]
          allowed_values: Json | null
          created_at: string
          default_value: Json
          description: string
          domain: string
          failure_mode: string
          id: string
          max_number: number | null
          min_number: number | null
          owner_department: string
          policy_key: string
          risk_level: string
          updated_at: string
          value_type: string
        }
        Insert: {
          active?: boolean
          allowed_products?: string[]
          allowed_values?: Json | null
          created_at?: string
          default_value: Json
          description: string
          domain: string
          failure_mode?: string
          id?: string
          max_number?: number | null
          min_number?: number | null
          owner_department: string
          policy_key: string
          risk_level?: string
          updated_at?: string
          value_type: string
        }
        Update: {
          active?: boolean
          allowed_products?: string[]
          allowed_values?: Json | null
          created_at?: string
          default_value?: Json
          description?: string
          domain?: string
          failure_mode?: string
          id?: string
          max_number?: number | null
          min_number?: number | null
          owner_department?: string
          policy_key?: string
          risk_level?: string
          updated_at?: string
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_policy_registry_owner_department_fkey"
            columns: ["owner_department"]
            isOneToOne: false
            referencedRelation: "hq_departments"
            referencedColumns: ["key"]
          },
        ]
      }
      hq_product_configs: {
        Row: {
          active: boolean
          config_key: string
          config_value: Json
          effective_at: string
          id: string
          is_secret: boolean
          product_key: string
          source_decision_id: string | null
          source_version: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          config_key: string
          config_value: Json
          effective_at?: string
          id?: string
          is_secret?: boolean
          product_key: string
          source_decision_id?: string | null
          source_version?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          config_key?: string
          config_value?: Json
          effective_at?: string
          id?: string
          is_secret?: boolean
          product_key?: string
          source_decision_id?: string | null
          source_version?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_product_configs_source_decision_id_fkey"
            columns: ["source_decision_id"]
            isOneToOne: false
            referencedRelation: "hq_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_product_policy_state: {
        Row: {
          desired_value: Json
          enforced_at: string | null
          evaluated_at: string | null
          id: string
          last_error: string | null
          observed_at: string | null
          observed_value: Json | null
          policy_key: string
          product_key: string
          received_at: string | null
          received_value: Json | null
          source_decision_id: string | null
          source_version: number | null
          state: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          desired_value: Json
          enforced_at?: string | null
          evaluated_at?: string | null
          id?: string
          last_error?: string | null
          observed_at?: string | null
          observed_value?: Json | null
          policy_key: string
          product_key: string
          received_at?: string | null
          received_value?: Json | null
          source_decision_id?: string | null
          source_version?: number | null
          state?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          desired_value?: Json
          enforced_at?: string | null
          evaluated_at?: string | null
          id?: string
          last_error?: string | null
          observed_at?: string | null
          observed_value?: Json | null
          policy_key?: string
          product_key?: string
          received_at?: string | null
          received_value?: Json | null
          source_decision_id?: string | null
          source_version?: number | null
          state?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_product_policy_state_policy_key_fkey"
            columns: ["policy_key"]
            isOneToOne: false
            referencedRelation: "hq_policy_registry"
            referencedColumns: ["policy_key"]
          },
          {
            foreignKeyName: "hq_product_policy_state_source_decision_id_fkey"
            columns: ["source_decision_id"]
            isOneToOne: false
            referencedRelation: "hq_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_propagation_targets: {
        Row: {
          applied_at: string | null
          decision_id: string
          error: string | null
          expected_config_key: string | null
          expected_value: Json | null
          id: string
          product_key: string
          status: string
          verified_at: string | null
        }
        Insert: {
          applied_at?: string | null
          decision_id: string
          error?: string | null
          expected_config_key?: string | null
          expected_value?: Json | null
          id?: string
          product_key: string
          status?: string
          verified_at?: string | null
        }
        Update: {
          applied_at?: string | null
          decision_id?: string
          error?: string | null
          expected_config_key?: string | null
          expected_value?: Json | null
          id?: string
          product_key?: string
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_propagation_targets_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "hq_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_user_status_events: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: number
          profile_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: never
          profile_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: never
          profile_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_user_status_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_work_item_links: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          label: string
          link_type: string
          metadata: Json
          url: string
          work_item_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          label: string
          link_type: string
          metadata?: Json
          url: string
          work_item_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          label?: string
          link_type?: string
          metadata?: Json
          url?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_work_item_links_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_work_item_links_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "hq_work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_work_item_updates: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          id: string
          metadata: Json
          update_type: string
          work_item_id: string
          worker_id: string | null
        }
        Insert: {
          actor_id?: string | null
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          update_type: string
          work_item_id: string
          worker_id?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          update_type?: string
          work_item_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_work_item_updates_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_work_item_updates_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "hq_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_work_item_updates_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "hq_work_item_updates_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_work_items: {
        Row: {
          acted_at: string | null
          action_taken: Json
          approval_required: boolean
          created_at: string
          department_key: string
          due_at: string | null
          evidence: Json
          id: string
          owner_id: string | null
          priority: string
          resolved_at: string | null
          route: string | null
          source_id: string | null
          source_type: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          verification_evidence: Json
          verification_status: string
          work_type: string
        }
        Insert: {
          acted_at?: string | null
          action_taken?: Json
          approval_required?: boolean
          created_at?: string
          department_key: string
          due_at?: string | null
          evidence?: Json
          id?: string
          owner_id?: string | null
          priority?: string
          resolved_at?: string | null
          route?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          verification_evidence?: Json
          verification_status?: string
          work_type: string
        }
        Update: {
          acted_at?: string | null
          action_taken?: Json
          approval_required?: boolean
          created_at?: string
          department_key?: string
          due_at?: string | null
          evidence?: Json
          id?: string
          owner_id?: string | null
          priority?: string
          resolved_at?: string | null
          route?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          verification_evidence?: Json
          verification_status?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_work_items_department_key_fkey"
            columns: ["department_key"]
            isOneToOne: false
            referencedRelation: "hq_departments"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "hq_work_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_worker_activation_approvals: {
        Row: {
          approved_at: string
          approved_by: string
          consumed_at: string | null
          worker_id: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          consumed_at?: string | null
          worker_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          consumed_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_worker_activation_approvals_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
            referencedRelation: "hq_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_worker_certifications: {
        Row: {
          certified_at: string
          evidence: Json
          id: string
          passed: boolean
          scenario_key: string
          worker_id: string
        }
        Insert: {
          certified_at?: string
          evidence?: Json
          id?: string
          passed: boolean
          scenario_key: string
          worker_id: string
        }
        Update: {
          certified_at?: string
          evidence?: Json
          id?: string
          passed?: boolean
          scenario_key?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_worker_certifications_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_worker_kpis: {
        Row: {
          current_value: number | null
          direction: string
          id: string
          label: string
          measured_at: string | null
          metric_key: string
          target: number | null
          unit: string | null
          worker_id: string
        }
        Insert: {
          current_value?: number | null
          direction: string
          id?: string
          label: string
          measured_at?: string | null
          metric_key: string
          target?: number | null
          unit?: string | null
          worker_id: string
        }
        Update: {
          current_value?: number | null
          direction?: string
          id?: string
          label?: string
          measured_at?: string | null
          metric_key?: string
          target?: number | null
          unit?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_worker_kpis_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_worker_messages: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          from_worker_id: string
          id: string
          message_type: string
          payload: Json
          priority: string
          status: string
          to_worker_id: string
          work_item_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          from_worker_id: string
          id?: string
          message_type: string
          payload?: Json
          priority?: string
          status?: string
          to_worker_id: string
          work_item_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          from_worker_id?: string
          id?: string
          message_type?: string
          payload?: Json
          priority?: string
          status?: string
          to_worker_id?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_worker_messages_from_worker_id_fkey"
            columns: ["from_worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_worker_messages_to_worker_id_fkey"
            columns: ["to_worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_worker_messages_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "hq_work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_worker_runs: {
        Row: {
          error: string | null
          evidence: Json
          execution_mode: string
          finished_at: string | null
          id: string
          input: Json
          output: Json
          started_at: string
          status: string
          work_item_id: string | null
          worker_id: string
          workflow_key: string
        }
        Insert: {
          error?: string | null
          evidence?: Json
          execution_mode: string
          finished_at?: string | null
          id?: string
          input?: Json
          output?: Json
          started_at?: string
          status: string
          work_item_id?: string | null
          worker_id: string
          workflow_key: string
        }
        Update: {
          error?: string | null
          evidence?: Json
          execution_mode?: string
          finished_at?: string | null
          id?: string
          input?: Json
          output?: Json
          started_at?: string
          status?: string
          work_item_id?: string | null
          worker_id?: string
          workflow_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_worker_runs_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "hq_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_worker_runs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_worker_templates: {
        Row: {
          active: boolean
          created_at: string
          definition: Json
          description: string
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          definition?: Json
          description?: string
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          definition?: Json
          description?: string
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      hq_workers: {
        Row: {
          created_at: string
          definition: Json
          department_key: string
          execution_order: string[]
          id: string
          manager_worker_id: string | null
          mission: string
          paid_ai_allowed: boolean
          status: string
          template_key: string | null
          title: string
          updated_at: string
          version: number
          worker_key: string
        }
        Insert: {
          created_at?: string
          definition?: Json
          department_key: string
          execution_order?: string[]
          id?: string
          manager_worker_id?: string | null
          mission: string
          paid_ai_allowed?: boolean
          status?: string
          template_key?: string | null
          title: string
          updated_at?: string
          version?: number
          worker_key: string
        }
        Update: {
          created_at?: string
          definition?: Json
          department_key?: string
          execution_order?: string[]
          id?: string
          manager_worker_id?: string | null
          mission?: string
          paid_ai_allowed?: boolean
          status?: string
          template_key?: string | null
          title?: string
          updated_at?: string
          version?: number
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workers_department_key_fkey"
            columns: ["department_key"]
            isOneToOne: false
            referencedRelation: "hq_departments"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "hq_workers_manager_worker_id_fkey"
            columns: ["manager_worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workers_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "hq_worker_templates"
            referencedColumns: ["key"]
          },
        ]
      }
      hq_workforce_assignments: {
        Row: {
          active: boolean
          created_at: string
          department_key: string
          id: string
          role_key: string
          worker_key: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          department_key: string
          id?: string
          role_key: string
          worker_key: string
        }
        Update: {
          active?: boolean
          created_at?: string
          department_key?: string
          id?: string
          role_key?: string
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_assignments_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_roles"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "hq_workforce_assignments_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_key"]
          },
          {
            foreignKeyName: "hq_workforce_assignments_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["worker_key"]
          },
        ]
      }
      hq_workforce_blueprints: {
        Row: {
          approval_boundaries: Json
          approved_at: string | null
          authority_ceiling: Json
          blueprint_key: string
          created_at: string
          id: string
          mission: string
          required_capabilities: Json
          required_skill_keys: Json
          scope_ref: Json
          scope_type: string
          status: string
          title: string
          version: number
        }
        Insert: {
          approval_boundaries?: Json
          approved_at?: string | null
          authority_ceiling?: Json
          blueprint_key: string
          created_at?: string
          id?: string
          mission: string
          required_capabilities?: Json
          required_skill_keys?: Json
          scope_ref?: Json
          scope_type?: string
          status?: string
          title: string
          version: number
        }
        Update: {
          approval_boundaries?: Json
          approved_at?: string | null
          authority_ceiling?: Json
          blueprint_key?: string
          created_at?: string
          id?: string
          mission?: string
          required_capabilities?: Json
          required_skill_keys?: Json
          scope_ref?: Json
          scope_type?: string
          status?: string
          title?: string
          version?: number
        }
        Relationships: []
      }
      hq_workforce_capability_grants: {
        Row: {
          capability_key: string
          expires_at: string
          granted_at: string
          granted_by_contract_id: string
          id: string
          operation: string
          resource_type: string
          revocation_reason: string | null
          revoked_at: string | null
          scope_ref: Json
          scope_type: string
          status: string
          worker_key: string
        }
        Insert: {
          capability_key: string
          expires_at: string
          granted_at?: string
          granted_by_contract_id: string
          id?: string
          operation: string
          resource_type: string
          revocation_reason?: string | null
          revoked_at?: string | null
          scope_ref?: Json
          scope_type?: string
          status?: string
          worker_key: string
        }
        Update: {
          capability_key?: string
          expires_at?: string
          granted_at?: string
          granted_by_contract_id?: string
          id?: string
          operation?: string
          resource_type?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          scope_ref?: Json
          scope_type?: string
          status?: string
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_capability_grants_granted_by_contract_id_fkey"
            columns: ["granted_by_contract_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_creation_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_capability_grants_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_key"]
          },
          {
            foreignKeyName: "hq_workforce_capability_grants_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["worker_key"]
          },
        ]
      }
      hq_workforce_certification_results: {
        Row: {
          certification_key: string
          check_key: string
          checked_at: string
          evidence: Json
          id: string
          passed: boolean
          subject_key: string
          subject_type: string
        }
        Insert: {
          certification_key: string
          check_key: string
          checked_at?: string
          evidence?: Json
          id?: string
          passed: boolean
          subject_key: string
          subject_type: string
        }
        Update: {
          certification_key?: string
          check_key?: string
          checked_at?: string
          evidence?: Json
          id?: string
          passed?: boolean
          subject_key?: string
          subject_type?: string
        }
        Relationships: []
      }
      hq_workforce_certifications: {
        Row: {
          certification_key: string
          creation_contract_id: string
          expires_at: string
          id: string
          issued_at: string
          passed_shadow_runs: number
          required_shadow_runs: number
          revocation_reason: string | null
          revoked_at: string | null
          status: string
          verifier_key: string
          worker_key: string
        }
        Insert: {
          certification_key: string
          creation_contract_id: string
          expires_at: string
          id?: string
          issued_at?: string
          passed_shadow_runs: number
          required_shadow_runs: number
          revocation_reason?: string | null
          revoked_at?: string | null
          status: string
          verifier_key: string
          worker_key: string
        }
        Update: {
          certification_key?: string
          creation_contract_id?: string
          expires_at?: string
          id?: string
          issued_at?: string
          passed_shadow_runs?: number
          required_shadow_runs?: number
          revocation_reason?: string | null
          revoked_at?: string | null
          status?: string
          verifier_key?: string
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_certifications_creation_contract_id_fkey"
            columns: ["creation_contract_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_creation_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_certifications_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_key"]
          },
          {
            foreignKeyName: "hq_workforce_certifications_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["worker_key"]
          },
        ]
      }
      hq_workforce_contract_clauses: {
        Row: {
          clause_key: string
          clause_type: string
          created_at: string
          effective_at: string
          id: string
          rule: Json
          scope_key: string | null
          scope_type: string
          status: string
          version: number
        }
        Insert: {
          clause_key: string
          clause_type: string
          created_at?: string
          effective_at?: string
          id?: string
          rule: Json
          scope_key?: string | null
          scope_type: string
          status?: string
          version: number
        }
        Update: {
          clause_key?: string
          clause_type?: string
          created_at?: string
          effective_at?: string
          id?: string
          rule?: Json
          scope_key?: string | null
          scope_type?: string
          status?: string
          version?: number
        }
        Relationships: []
      }
      hq_workforce_contracts: {
        Row: {
          contract_key: string
          contract_type: string
          created_at: string
          expires_at: string | null
          id: string
          issued_at: string
          payload: Json
          payload_hash: string | null
          scope_ref: Json
          scope_type: string
          status: string
          version: number
        }
        Insert: {
          contract_key: string
          contract_type: string
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          payload: Json
          payload_hash?: string | null
          scope_ref?: Json
          scope_type?: string
          status?: string
          version: number
        }
        Update: {
          contract_key?: string
          contract_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          payload?: Json
          payload_hash?: string | null
          scope_ref?: Json
          scope_type?: string
          status?: string
          version?: number
        }
        Relationships: []
      }
      hq_workforce_correction_events: {
        Row: {
          context_hash: string
          corrected_payload: Json | null
          created_at: string
          decision_id: string
          decision_revision: number
          event_key: string
          event_type: string
          id: string
          lane_key: string | null
          learning_candidate_id: string | null
          proposed_payload: Json
          provenance_bundle: Json
          rejection_reason: string | null
          run_id: string | null
          snapshot_id: string | null
          source_skill_id: string | null
          source_skill_version: number | null
          structural_diff: Json
          worker_id: string | null
        }
        Insert: {
          context_hash: string
          corrected_payload?: Json | null
          created_at?: string
          decision_id: string
          decision_revision: number
          event_key: string
          event_type: string
          id?: string
          lane_key?: string | null
          learning_candidate_id?: string | null
          proposed_payload?: Json
          provenance_bundle?: Json
          rejection_reason?: string | null
          run_id?: string | null
          snapshot_id?: string | null
          source_skill_id?: string | null
          source_skill_version?: number | null
          structural_diff?: Json
          worker_id?: string | null
        }
        Update: {
          context_hash?: string
          corrected_payload?: Json | null
          created_at?: string
          decision_id?: string
          decision_revision?: number
          event_key?: string
          event_type?: string
          id?: string
          lane_key?: string | null
          learning_candidate_id?: string | null
          proposed_payload?: Json
          provenance_bundle?: Json
          rejection_reason?: string | null
          run_id?: string | null
          snapshot_id?: string | null
          source_skill_id?: string | null
          source_skill_version?: number | null
          structural_diff?: Json
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_correction_events_learning_candidate_id_fkey"
            columns: ["learning_candidate_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_learning_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_correction_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_correction_events_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "hq_context_decision_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_correction_events_source_skill_id_fkey"
            columns: ["source_skill_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_correction_events_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "hq_workforce_correction_events_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_creation_contracts: {
        Row: {
          authority_ceiling: Json
          blueprint_id: string
          consumed_at: string | null
          contract_key: string
          demand_evidence_contract_id: string | null
          expires_at: string | null
          id: string
          issued_at: string
          scope_ref: Json
          scope_type: string
          status: string
          worker_key: string
        }
        Insert: {
          authority_ceiling?: Json
          blueprint_id: string
          consumed_at?: string | null
          contract_key: string
          demand_evidence_contract_id?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string
          scope_ref?: Json
          scope_type?: string
          status?: string
          worker_key: string
        }
        Update: {
          authority_ceiling?: Json
          blueprint_id?: string
          consumed_at?: string | null
          contract_key?: string
          demand_evidence_contract_id?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string
          scope_ref?: Json
          scope_type?: string
          status?: string
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_creation_contract_demand_evidence_contract_id_fkey"
            columns: ["demand_evidence_contract_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_creation_contracts_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_creation_contracts_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_key"]
          },
          {
            foreignKeyName: "hq_workforce_creation_contracts_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["worker_key"]
          },
        ]
      }
      hq_workforce_dead_letters: {
        Row: {
          attempts: number
          created_at: string
          error_code: string
          error_detail: string | null
          id: string
          payload_snapshot: Json
          task_id: string
          worker_key: string
        }
        Insert: {
          attempts: number
          created_at?: string
          error_code: string
          error_detail?: string | null
          id?: string
          payload_snapshot: Json
          task_id: string
          worker_key: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_code?: string
          error_detail?: string | null
          id?: string
          payload_snapshot?: Json
          task_id?: string
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_dead_letters_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "hq_workforce_task_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_decisions: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_key: string
          evidence_snapshot_id: string | null
          id: string
          job_key: string | null
          lane_key: string | null
          proposed_action: string
          reason: string
          revision: string | null
          risk: string
          run_id: string | null
          status: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_key: string
          evidence_snapshot_id?: string | null
          id?: string
          job_key?: string | null
          lane_key?: string | null
          proposed_action: string
          reason: string
          revision?: string | null
          risk: string
          run_id?: string | null
          status?: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_key?: string
          evidence_snapshot_id?: string | null
          id?: string
          job_key?: string | null
          lane_key?: string | null
          proposed_action?: string
          reason?: string
          revision?: string | null
          risk?: string
          run_id?: string | null
          status?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_decisions_evidence_snapshot_id_fkey"
            columns: ["evidence_snapshot_id"]
            isOneToOne: false
            referencedRelation: "hq_context_decision_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_decisions_job_key_fkey"
            columns: ["job_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_jobs"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "hq_workforce_decisions_lane_key_fkey"
            columns: ["lane_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_lanes"
            referencedColumns: ["lane_key"]
          },
          {
            foreignKeyName: "hq_workforce_decisions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_decisions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "hq_workforce_decisions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_demand_evidence: {
        Row: {
          consumed_at: string | null
          evidence_hash: string | null
          evidence_key: string
          gap_id: string
          id: string
          lane_key: string
          metrics: Json
          sealed_at: string
          source_ref: string
          source_type: string
          status: string
        }
        Insert: {
          consumed_at?: string | null
          evidence_hash?: string | null
          evidence_key: string
          gap_id: string
          id?: string
          lane_key: string
          metrics: Json
          sealed_at?: string
          source_ref: string
          source_type: string
          status?: string
        }
        Update: {
          consumed_at?: string | null
          evidence_hash?: string | null
          evidence_key?: string
          gap_id?: string
          id?: string
          lane_key?: string
          metrics?: Json
          sealed_at?: string
          source_ref?: string
          source_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_demand_evidence_gap_id_fkey"
            columns: ["gap_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_gap_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_demand_observations: {
        Row: {
          evidence: Json
          id: number
          observed_at: string
          observed_bucket: string
          oldest_age_seconds: number
          open_backlog: number
          policy_id: string
          threshold_met: boolean
          weighted_impact: number
        }
        Insert: {
          evidence: Json
          id?: never
          observed_at?: string
          observed_bucket: string
          oldest_age_seconds: number
          open_backlog: number
          policy_id: string
          threshold_met: boolean
          weighted_impact: number
        }
        Update: {
          evidence?: Json
          id?: never
          observed_at?: string
          observed_bucket?: string
          oldest_age_seconds?: number
          open_backlog?: number
          policy_id?: string
          threshold_met?: boolean
          weighted_impact?: number
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_demand_observations_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_demand_sensor_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_demand_sensor_policies: {
        Row: {
          approved_at: string | null
          consecutive_observations: number
          cooldown_minutes: number
          created_at: string
          id: string
          min_open_backlog: number
          observation_window_minutes: number
          oldest_age_minutes: number
          policy_key: string
          status: string
          template_id: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          consecutive_observations?: number
          cooldown_minutes?: number
          created_at?: string
          id?: string
          min_open_backlog: number
          observation_window_minutes?: number
          oldest_age_minutes: number
          policy_key: string
          status?: string
          template_id: string
          version: number
        }
        Update: {
          approved_at?: string | null
          consecutive_observations?: number
          cooldown_minutes?: number
          created_at?: string
          id?: string
          min_open_backlog?: number
          observation_window_minutes?: number
          oldest_age_minutes?: number
          policy_key?: string
          status?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_demand_sensor_policies_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_factory_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_engine_contract: {
        Row: {
          exclusions: Json
          factory_enabled: boolean
          factory_limit: number
          heartbeat_enabled: boolean
          heartbeat_limit: number
          mission: string
          responsibilities: Json
          routine_paid_ai_required: boolean
          runtime_anomaly_paused: boolean
          runtime_autonomy_level: number
          runtime_execution_enabled: boolean
          runtime_max_concurrency: number
          runtime_max_executions_per_minute: number
          runtime_max_risk: number
          shadow_anomaly_paused: boolean
          shadow_enabled: boolean
          shadow_global_stop: boolean
          shadow_max_candidates_per_cycle: number
          shadow_max_concurrency: number
          shadow_max_cycles_per_hour: number
          shadow_max_queue_depth: number
          shadow_max_retries: number
          shadow_scheduler_enabled: boolean
          singleton: boolean
          updated_at: string
        }
        Insert: {
          exclusions: Json
          factory_enabled?: boolean
          factory_limit?: number
          heartbeat_enabled?: boolean
          heartbeat_limit?: number
          mission: string
          responsibilities: Json
          routine_paid_ai_required?: boolean
          runtime_anomaly_paused?: boolean
          runtime_autonomy_level?: number
          runtime_execution_enabled?: boolean
          runtime_max_concurrency?: number
          runtime_max_executions_per_minute?: number
          runtime_max_risk?: number
          shadow_anomaly_paused?: boolean
          shadow_enabled?: boolean
          shadow_global_stop?: boolean
          shadow_max_candidates_per_cycle?: number
          shadow_max_concurrency?: number
          shadow_max_cycles_per_hour?: number
          shadow_max_queue_depth?: number
          shadow_max_retries?: number
          shadow_scheduler_enabled?: boolean
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          exclusions?: Json
          factory_enabled?: boolean
          factory_limit?: number
          heartbeat_enabled?: boolean
          heartbeat_limit?: number
          mission?: string
          responsibilities?: Json
          routine_paid_ai_required?: boolean
          runtime_anomaly_paused?: boolean
          runtime_autonomy_level?: number
          runtime_execution_enabled?: boolean
          runtime_max_concurrency?: number
          runtime_max_executions_per_minute?: number
          runtime_max_risk?: number
          shadow_anomaly_paused?: boolean
          shadow_enabled?: boolean
          shadow_global_stop?: boolean
          shadow_max_candidates_per_cycle?: number
          shadow_max_concurrency?: number
          shadow_max_cycles_per_hour?: number
          shadow_max_queue_depth?: number
          shadow_max_retries?: number
          shadow_scheduler_enabled?: boolean
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      hq_workforce_evidence: {
        Row: {
          classification: string
          content_hash: string | null
          created_at: string
          evidence_kind: string
          id: string
          jurisdiction_key: string | null
          observed_at: string | null
          payload: Json
          source_ref: string | null
          source_type: string
          tenant_key: string | null
          trace_id: string
        }
        Insert: {
          classification?: string
          content_hash?: string | null
          created_at?: string
          evidence_kind: string
          id?: string
          jurisdiction_key?: string | null
          observed_at?: string | null
          payload?: Json
          source_ref?: string | null
          source_type: string
          tenant_key?: string | null
          trace_id: string
        }
        Update: {
          classification?: string
          content_hash?: string | null
          created_at?: string
          evidence_kind?: string
          id?: string
          jurisdiction_key?: string | null
          observed_at?: string | null
          payload?: Json
          source_ref?: string | null
          source_type?: string
          tenant_key?: string | null
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_evidence_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_shadow_traces"
            referencedColumns: ["trace_id"]
          },
        ]
      }
      hq_workforce_evidence_policies: {
        Row: {
          active: boolean
          allow_high_severity_override: boolean
          created_at: string
          id: string
          min_events: number
          policy_key: string
          relevance_days: number
        }
        Insert: {
          active?: boolean
          allow_high_severity_override?: boolean
          created_at?: string
          id?: string
          min_events?: number
          policy_key: string
          relevance_days?: number
        }
        Update: {
          active?: boolean
          allow_high_severity_override?: boolean
          created_at?: string
          id?: string
          min_events?: number
          policy_key?: string
          relevance_days?: number
        }
        Relationships: []
      }
      hq_workforce_evidence_qualifications: {
        Row: {
          contradiction_count: number
          eligible_count: number
          evaluated_at: string
          evidence_event_ids: string[]
          high_severity_override: boolean
          id: string
          lane_key: string | null
          qualification_key: string
          qualification_signature: string
          skill_key: string
          status: string
        }
        Insert: {
          contradiction_count?: number
          eligible_count?: number
          evaluated_at?: string
          evidence_event_ids?: string[]
          high_severity_override?: boolean
          id?: string
          lane_key?: string | null
          qualification_key: string
          qualification_signature: string
          skill_key: string
          status: string
        }
        Update: {
          contradiction_count?: number
          eligible_count?: number
          evaluated_at?: string
          evidence_event_ids?: string[]
          high_severity_override?: boolean
          id?: string
          lane_key?: string | null
          qualification_key?: string
          qualification_signature?: string
          skill_key?: string
          status?: string
        }
        Relationships: []
      }
      hq_workforce_execution_budgets: {
        Row: {
          budget_key: string
          consumed_amount: number
          created_at: string
          id: string
          limit_amount: number
          period_end: string
          period_start: string
          reserved_amount: number
          status: string
          unit: string
          worker_key: string
        }
        Insert: {
          budget_key: string
          consumed_amount?: number
          created_at?: string
          id?: string
          limit_amount: number
          period_end: string
          period_start: string
          reserved_amount?: number
          status?: string
          unit: string
          worker_key: string
        }
        Update: {
          budget_key?: string
          consumed_amount?: number
          created_at?: string
          id?: string
          limit_amount?: number
          period_end?: string
          period_start?: string
          reserved_amount?: number
          status?: string
          unit?: string
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_execution_budgets_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_key"]
          },
          {
            foreignKeyName: "hq_workforce_execution_budgets_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["worker_key"]
          },
        ]
      }
      hq_workforce_factory_qualification_cases: {
        Row: {
          approved_at: string
          case_key: string
          expected_outcome: Json
          id: string
          input_snapshot: Json
          status: string
          template_id: string
        }
        Insert: {
          approved_at?: string
          case_key: string
          expected_outcome: Json
          id?: string
          input_snapshot: Json
          status?: string
          template_id: string
        }
        Update: {
          approved_at?: string
          case_key?: string
          expected_outcome?: Json
          id?: string
          input_snapshot?: Json
          status?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_factory_qualification_cases_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_factory_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_factory_runs: {
        Row: {
          blueprint_id: string | null
          completed_at: string | null
          created_at: string
          creation_contract_id: string | null
          decision: string
          demand_evidence_id: string
          diagnosis_id: string
          id: string
          result: Json
          run_key: string
          tool_contract_id: string | null
          worker_key: string | null
        }
        Insert: {
          blueprint_id?: string | null
          completed_at?: string | null
          created_at?: string
          creation_contract_id?: string | null
          decision: string
          demand_evidence_id: string
          diagnosis_id: string
          id?: string
          result?: Json
          run_key: string
          tool_contract_id?: string | null
          worker_key?: string | null
        }
        Update: {
          blueprint_id?: string | null
          completed_at?: string | null
          created_at?: string
          creation_contract_id?: string | null
          decision?: string
          demand_evidence_id?: string
          diagnosis_id?: string
          id?: string
          result?: Json
          run_key?: string
          tool_contract_id?: string | null
          worker_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_factory_runs_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_factory_runs_creation_contract_id_fkey"
            columns: ["creation_contract_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_creation_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_factory_runs_demand_evidence_id_fkey"
            columns: ["demand_evidence_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_demand_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_factory_runs_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_hr_diagnoses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_factory_runs_tool_contract_id_fkey"
            columns: ["tool_contract_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_tool_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_factory_templates: {
        Row: {
          approved_at: string | null
          capability_key: string
          certification_days: number
          created_at: string
          id: string
          lane_key: string
          max_live_workers: number
          mission: string
          operation: string
          resource_type: string
          scope_ref: Json
          scope_type: string
          signal_type: string
          status: string
          template_key: string
          title: string
          tool_call_budget: number
          version: number
        }
        Insert: {
          approved_at?: string | null
          capability_key: string
          certification_days?: number
          created_at?: string
          id?: string
          lane_key: string
          max_live_workers?: number
          mission: string
          operation: string
          resource_type: string
          scope_ref?: Json
          scope_type?: string
          signal_type: string
          status?: string
          template_key: string
          title: string
          tool_call_budget?: number
          version: number
        }
        Update: {
          approved_at?: string | null
          capability_key?: string
          certification_days?: number
          created_at?: string
          id?: string
          lane_key?: string
          max_live_workers?: number
          mission?: string
          operation?: string
          resource_type?: string
          scope_ref?: Json
          scope_type?: string
          signal_type?: string
          status?: string
          template_key?: string
          title?: string
          tool_call_budget?: number
          version?: number
        }
        Relationships: []
      }
      hq_workforce_gap_evaluations: {
        Row: {
          created_at: string
          decision: string
          diagnosis: string
          evidence_snapshot_id: string | null
          execution_method: string
          gap_id: string
          id: string
          reason: string
        }
        Insert: {
          created_at?: string
          decision: string
          diagnosis: string
          evidence_snapshot_id?: string | null
          execution_method?: string
          gap_id: string
          id?: string
          reason: string
        }
        Update: {
          created_at?: string
          decision?: string
          diagnosis?: string
          evidence_snapshot_id?: string | null
          execution_method?: string
          gap_id?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_gap_evaluations_evidence_snapshot_id_fkey"
            columns: ["evidence_snapshot_id"]
            isOneToOne: false
            referencedRelation: "hq_context_decision_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_gap_evaluations_gap_id_fkey"
            columns: ["gap_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_gap_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_gap_signals: {
        Row: {
          detected_at: string
          gap_key: string
          id: string
          lane_key: string | null
          metrics_snapshot: Json
          severity: string
          signal_type: string
          source_ref: string
          source_type: string
          status: string
        }
        Insert: {
          detected_at?: string
          gap_key: string
          id?: string
          lane_key?: string | null
          metrics_snapshot?: Json
          severity: string
          signal_type: string
          source_ref: string
          source_type: string
          status?: string
        }
        Update: {
          detected_at?: string
          gap_key?: string
          id?: string
          lane_key?: string | null
          metrics_snapshot?: Json
          severity?: string
          signal_type?: string
          source_ref?: string
          source_type?: string
          status?: string
        }
        Relationships: []
      }
      hq_workforce_handoffs: {
        Row: {
          accepted_at: string | null
          completed_at: string | null
          created_at: string
          from_lane_key: string
          from_worker_id: string | null
          handoff_key: string
          id: string
          materialized_context: Json
          payload: Json
          reason: string
          requested_fact_keys: string[]
          status: string
          to_lane_key: string
          to_worker_id: string | null
          violation_code: string | null
          work_item_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          from_lane_key: string
          from_worker_id?: string | null
          handoff_key: string
          id?: string
          materialized_context?: Json
          payload?: Json
          reason: string
          requested_fact_keys?: string[]
          status: string
          to_lane_key: string
          to_worker_id?: string | null
          violation_code?: string | null
          work_item_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          from_lane_key?: string
          from_worker_id?: string | null
          handoff_key?: string
          id?: string
          materialized_context?: Json
          payload?: Json
          reason?: string
          requested_fact_keys?: string[]
          status?: string
          to_lane_key?: string
          to_worker_id?: string | null
          violation_code?: string | null
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_handoffs_from_worker_id_fkey"
            columns: ["from_worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "hq_workforce_handoffs_from_worker_id_fkey"
            columns: ["from_worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_handoffs_to_worker_id_fkey"
            columns: ["to_worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "hq_workforce_handoffs_to_worker_id_fkey"
            columns: ["to_worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_heartbeat_runs: {
        Row: {
          completed_at: string | null
          heartbeat_key: string
          id: number
          result: Json
          started_at: string
          tasks_failed: number
          tasks_processed: number
        }
        Insert: {
          completed_at?: string | null
          heartbeat_key: string
          id?: never
          result?: Json
          started_at?: string
          tasks_failed?: number
          tasks_processed?: number
        }
        Update: {
          completed_at?: string | null
          heartbeat_key?: string
          id?: never
          result?: Json
          started_at?: string
          tasks_failed?: number
          tasks_processed?: number
        }
        Relationships: []
      }
      hq_workforce_hr_diagnoses: {
        Row: {
          decision: string
          demand_temporary: boolean
          deterministic_automation_sufficient: boolean
          diagnosed_at: string
          diagnosis_version: number
          downstream_dependency_count: number
          evidence: Json
          existing_worker_available: boolean
          existing_worker_has_skill: boolean
          existing_worker_utilization: number | null
          gap_id: string | null
          human_judgment_required: boolean
          id: string
          policy_violations: number
          reason: string
          rebalance_capacity: boolean
          rework_rate: number
          verified_impact: number
          work_necessary: boolean
        }
        Insert: {
          decision: string
          demand_temporary?: boolean
          deterministic_automation_sufficient?: boolean
          diagnosed_at?: string
          diagnosis_version?: number
          downstream_dependency_count?: number
          evidence?: Json
          existing_worker_available?: boolean
          existing_worker_has_skill?: boolean
          existing_worker_utilization?: number | null
          gap_id?: string | null
          human_judgment_required?: boolean
          id?: string
          policy_violations?: number
          reason: string
          rebalance_capacity?: boolean
          rework_rate?: number
          verified_impact?: number
          work_necessary: boolean
        }
        Update: {
          decision?: string
          demand_temporary?: boolean
          deterministic_automation_sufficient?: boolean
          diagnosed_at?: string
          diagnosis_version?: number
          downstream_dependency_count?: number
          evidence?: Json
          existing_worker_available?: boolean
          existing_worker_has_skill?: boolean
          existing_worker_utilization?: number | null
          gap_id?: string | null
          human_judgment_required?: boolean
          id?: string
          policy_violations?: number
          reason?: string
          rebalance_capacity?: boolean
          rework_rate?: number
          verified_impact?: number
          work_necessary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_hr_diagnoses_gap_id_fkey"
            columns: ["gap_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_gap_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_identities: {
        Row: {
          credential_ref: string | null
          expires_at: string
          id: string
          identity_key: string
          issued_at: string
          revocation_reason: string | null
          revoked_at: string | null
          status: string
          worker_key: string
        }
        Insert: {
          credential_ref?: string | null
          expires_at: string
          id?: string
          identity_key: string
          issued_at?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          status?: string
          worker_key: string
        }
        Update: {
          credential_ref?: string | null
          expires_at?: string
          id?: string
          identity_key?: string
          issued_at?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          status?: string
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_identities_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_key"]
          },
          {
            foreignKeyName: "hq_workforce_identities_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["worker_key"]
          },
        ]
      }
      hq_workforce_jobs: {
        Row: {
          active: boolean
          created_at: string
          key: string
          purpose: string
          role_keys: Json
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          key: string
          purpose: string
          role_keys?: Json
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          key?: string
          purpose?: string
          role_keys?: Json
          title?: string
        }
        Relationships: []
      }
      hq_workforce_lanes: {
        Row: {
          active: boolean
          created_at: string
          department_key: string
          event_types: string[]
          lane_key: string
          mission: string
          owner_worker_id: string | null
          schedule_keys: string[]
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          department_key: string
          event_types?: string[]
          lane_key: string
          mission: string
          owner_worker_id?: string | null
          schedule_keys?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          department_key?: string
          event_types?: string[]
          lane_key?: string
          mission?: string
          owner_worker_id?: string | null
          schedule_keys?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_lanes_owner_worker_id_fkey"
            columns: ["owner_worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "hq_workforce_lanes_owner_worker_id_fkey"
            columns: ["owner_worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_learning_candidates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          confidence: number
          confidence_source: string
          created_at: string
          evidence_refs: string[]
          id: string
          learning_type: string
          scope_key: string | null
          scope_type: string
          statement: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          confidence: number
          confidence_source: string
          created_at?: string
          evidence_refs?: string[]
          id?: string
          learning_type: string
          scope_key?: string | null
          scope_type: string
          statement: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number
          confidence_source?: string
          created_at?: string
          evidence_refs?: string[]
          id?: string
          learning_type?: string
          scope_key?: string | null
          scope_type?: string
          statement?: string
          status?: string
        }
        Relationships: []
      }
      hq_workforce_lifecycle_events: {
        Row: {
          certification_id: string | null
          creation_contract_id: string | null
          from_state: string | null
          id: number
          occurred_at: string
          reason: string
          to_state: string
          worker_key: string
        }
        Insert: {
          certification_id?: string | null
          creation_contract_id?: string | null
          from_state?: string | null
          id?: never
          occurred_at?: string
          reason: string
          to_state: string
          worker_key: string
        }
        Update: {
          certification_id?: string | null
          creation_contract_id?: string | null
          from_state?: string | null
          id?: never
          occurred_at?: string
          reason?: string
          to_state?: string
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_lifecycle_events_creation_contract_id_fkey"
            columns: ["creation_contract_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_creation_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_lifecycle_events_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_key"]
          },
          {
            foreignKeyName: "hq_workforce_lifecycle_events_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["worker_key"]
          },
        ]
      }
      hq_workforce_model_invocations: {
        Row: {
          budget_id: string | null
          completed_at: string | null
          created_at: string
          deterministic_attempted: boolean
          deterministic_failure_evidence: Json
          id: string
          model_key: string
          reason_code: string
          status: string
          task_id: string | null
          token_budget: number
          worker_key: string
        }
        Insert: {
          budget_id?: string | null
          completed_at?: string | null
          created_at?: string
          deterministic_attempted: boolean
          deterministic_failure_evidence?: Json
          id?: string
          model_key: string
          reason_code: string
          status: string
          task_id?: string | null
          token_budget: number
          worker_key: string
        }
        Update: {
          budget_id?: string | null
          completed_at?: string | null
          created_at?: string
          deterministic_attempted?: boolean
          deterministic_failure_evidence?: Json
          id?: string
          model_key?: string
          reason_code?: string
          status?: string
          task_id?: string | null
          token_budget?: number
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_model_invocations_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_execution_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_model_invocations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_task_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_model_invocations_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_key"]
          },
          {
            foreignKeyName: "hq_workforce_model_invocations_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["worker_key"]
          },
        ]
      }
      hq_workforce_monitoring_alerts: {
        Row: {
          alert_key: string
          alert_type: string
          created_at: string
          details: Json
          id: string
          resolved_at: string | null
          severity: string
          status: string
          subject_key: string
          subject_type: string
        }
        Insert: {
          alert_key: string
          alert_type: string
          created_at?: string
          details?: Json
          id?: string
          resolved_at?: string | null
          severity: string
          status?: string
          subject_key: string
          subject_type: string
        }
        Update: {
          alert_key?: string
          alert_type?: string
          created_at?: string
          details?: Json
          id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          subject_key?: string
          subject_type?: string
        }
        Relationships: []
      }
      hq_workforce_outcome_verifications: {
        Row: {
          actual_outcome: Json
          assignment_id: string | null
          evidence: Json
          execution_certified: boolean
          expected_outcome: Json
          id: string
          outcome_verified: boolean
          run_id: string | null
          verification_method: string
          verification_version: number
          verified_at: string
          verifier_kind: string
          verifier_ref: string | null
        }
        Insert: {
          actual_outcome: Json
          assignment_id?: string | null
          evidence?: Json
          execution_certified?: boolean
          expected_outcome: Json
          id?: string
          outcome_verified?: boolean
          run_id?: string | null
          verification_method: string
          verification_version?: number
          verified_at?: string
          verifier_kind?: string
          verifier_ref?: string | null
        }
        Update: {
          actual_outcome?: Json
          assignment_id?: string | null
          evidence?: Json
          execution_certified?: boolean
          expected_outcome?: Json
          id?: string
          outcome_verified?: boolean
          run_id?: string | null
          verification_method?: string
          verification_version?: number
          verified_at?: string
          verifier_kind?: string
          verifier_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_outcome_verifications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_outcome_verifications_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_positive_evidence: {
        Row: {
          approved_payload: Json
          context_hash: string
          created_at: string
          decision_id: string
          decision_revision: number
          evidence_key: string
          id: string
          outcome_evidence: Json
          outcome_status: string
          run_id: string | null
          skill_id: string | null
          snapshot_id: string | null
        }
        Insert: {
          approved_payload?: Json
          context_hash: string
          created_at?: string
          decision_id: string
          decision_revision: number
          evidence_key: string
          id?: string
          outcome_evidence?: Json
          outcome_status?: string
          run_id?: string | null
          skill_id?: string | null
          snapshot_id?: string | null
        }
        Update: {
          approved_payload?: Json
          context_hash?: string
          created_at?: string
          decision_id?: string
          decision_revision?: number
          evidence_key?: string
          id?: string
          outcome_evidence?: Json
          outcome_status?: string
          run_id?: string | null
          skill_id?: string | null
          snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_positive_evidence_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_positive_evidence_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_positive_evidence_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "hq_context_decision_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_probation_policies: {
        Row: {
          active: boolean
          allowed_failures: number
          id: string
          min_confidence: number
          min_verified_runs: number
          policy_key: string
          require_all_outcomes_verified: boolean
        }
        Insert: {
          active?: boolean
          allowed_failures?: number
          id?: string
          min_confidence?: number
          min_verified_runs?: number
          policy_key: string
          require_all_outcomes_verified?: boolean
        }
        Update: {
          active?: boolean
          allowed_failures?: number
          id?: string
          min_confidence?: number
          min_verified_runs?: number
          policy_key?: string
          require_all_outcomes_verified?: boolean
        }
        Relationships: []
      }
      hq_workforce_recovery_actions: {
        Row: {
          after_state: Json
          before_state: Json
          created_at: string
          evidence: Json
          executed_at: string | null
          id: string
          reason: string
          recovery_type: string
          run_id: string
          status: string
          verified_at: string | null
        }
        Insert: {
          after_state?: Json
          before_state?: Json
          created_at?: string
          evidence?: Json
          executed_at?: string | null
          id?: string
          reason: string
          recovery_type: string
          run_id: string
          status?: string
          verified_at?: string | null
        }
        Update: {
          after_state?: Json
          before_state?: Json
          created_at?: string
          evidence?: Json
          executed_at?: string | null
          id?: string
          reason?: string
          recovery_type?: string
          run_id?: string
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_recovery_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_replay_results: {
        Row: {
          created_at: string
          evidence: Json
          execution_match: boolean | null
          historical_run_id: string | null
          id: string
          outcome_match: boolean | null
          passed: boolean
          promotion_id: string
        }
        Insert: {
          created_at?: string
          evidence?: Json
          execution_match?: boolean | null
          historical_run_id?: string | null
          id?: string
          outcome_match?: boolean | null
          passed: boolean
          promotion_id: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          execution_match?: boolean | null
          historical_run_id?: string | null
          id?: string
          outcome_match?: boolean | null
          passed?: boolean
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_replay_results_historical_run_id_fkey"
            columns: ["historical_run_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_replay_results_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_skill_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_roles: {
        Row: {
          active: boolean
          created_at: string
          function_key: string
          key: string
          name: string
          required_competencies: Json
          responsibilities: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          function_key: string
          key: string
          name: string
          required_competencies?: Json
          responsibilities?: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          function_key?: string
          key?: string
          name?: string
          required_competencies?: Json
          responsibilities?: Json
        }
        Relationships: []
      }
      hq_workforce_runs: {
        Row: {
          authority_result: string
          completed_at: string | null
          created_at: string
          execution_evidence: Json
          id: string
          lane_key: string
          skill_id: string | null
          started_at: string | null
          status: string
          trigger_type: string
          work_item_id: string | null
          worker_id: string
        }
        Insert: {
          authority_result?: string
          completed_at?: string | null
          created_at?: string
          execution_evidence?: Json
          id?: string
          lane_key: string
          skill_id?: string | null
          started_at?: string | null
          status?: string
          trigger_type: string
          work_item_id?: string | null
          worker_id: string
        }
        Update: {
          authority_result?: string
          completed_at?: string | null
          created_at?: string
          execution_evidence?: Json
          id?: string
          lane_key?: string
          skill_id?: string | null
          started_at?: string | null
          status?: string
          trigger_type?: string
          work_item_id?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_runs_lane_key_fkey"
            columns: ["lane_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_lanes"
            referencedColumns: ["lane_key"]
          },
          {
            foreignKeyName: "hq_workforce_runs_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_runs_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "hq_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_runs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "hq_workforce_runs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_runtime_authorization_events: {
        Row: {
          autonomy_level: number
          decision: string
          id: number
          occurred_at: string
          reason_code: string
          risk_class: number
          scope_ref: Json
          scope_type: string
          skill_key: string
          task_id: string | null
          worker_key: string
        }
        Insert: {
          autonomy_level: number
          decision: string
          id?: never
          occurred_at?: string
          reason_code: string
          risk_class: number
          scope_ref?: Json
          scope_type: string
          skill_key: string
          task_id?: string | null
          worker_key: string
        }
        Update: {
          autonomy_level?: number
          decision?: string
          id?: never
          occurred_at?: string
          reason_code?: string
          risk_class?: number
          scope_ref?: Json
          scope_type?: string
          skill_key?: string
          task_id?: string | null
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_runtime_authorization_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_task_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_runtime_policies: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          jurisdiction_key: string | null
          max_autonomy_level: number
          max_concurrency: number
          max_executions_per_minute: number
          max_risk_class: number
          policy_key: string
          reason: string
          scope_key: string
          scope_kind: string
          status: string
          tenant_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          jurisdiction_key?: string | null
          max_autonomy_level?: number
          max_concurrency?: number
          max_executions_per_minute?: number
          max_risk_class?: number
          policy_key: string
          reason: string
          scope_key: string
          scope_kind: string
          status?: string
          tenant_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          jurisdiction_key?: string | null
          max_autonomy_level?: number
          max_concurrency?: number
          max_executions_per_minute?: number
          max_risk_class?: number
          policy_key?: string
          reason?: string
          scope_key?: string
          scope_kind?: string
          status?: string
          tenant_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hq_workforce_security_events: {
        Row: {
          attack_vector: string
          event_key: string
          evidence: Json
          id: string
          lane_key: string | null
          occurred_at: string
          status: string
          target_ref: string
          violation_code: string | null
          worker_key: string
        }
        Insert: {
          attack_vector: string
          event_key: string
          evidence?: Json
          id?: string
          lane_key?: string | null
          occurred_at?: string
          status: string
          target_ref: string
          violation_code?: string | null
          worker_key: string
        }
        Update: {
          attack_vector?: string
          event_key?: string
          evidence?: Json
          id?: string
          lane_key?: string | null
          occurred_at?: string
          status?: string
          target_ref?: string
          violation_code?: string | null
          worker_key?: string
        }
        Relationships: []
      }
      hq_workforce_shadow_anomalies: {
        Row: {
          action: string
          anomaly_key: string
          created_at: string
          details: Json
          id: string
          resolved_at: string | null
          severity: string
          trace_id: string | null
        }
        Insert: {
          action: string
          anomaly_key: string
          created_at?: string
          details?: Json
          id?: string
          resolved_at?: string | null
          severity: string
          trace_id?: string | null
        }
        Update: {
          action?: string
          anomaly_key?: string
          created_at?: string
          details?: Json
          id?: string
          resolved_at?: string | null
          severity?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_shadow_anomalies_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_shadow_traces"
            referencedColumns: ["trace_id"]
          },
        ]
      }
      hq_workforce_shadow_candidates: {
        Row: {
          candidate_fingerprint: string
          confidence: number | null
          created_at: string
          duplicate_of: string | null
          id: string
          lane_key: string
          priority: number
          reasoning_summary: string | null
          scope_ref: Json
          scope_type: string
          skill_manifest_id: string | null
          sla_due_at: string | null
          source_work_item_id: string | null
          status: string
          trace_id: string | null
          worker_key: string | null
        }
        Insert: {
          candidate_fingerprint: string
          confidence?: number | null
          created_at?: string
          duplicate_of?: string | null
          id?: string
          lane_key: string
          priority: number
          reasoning_summary?: string | null
          scope_ref?: Json
          scope_type?: string
          skill_manifest_id?: string | null
          sla_due_at?: string | null
          source_work_item_id?: string | null
          status?: string
          trace_id?: string | null
          worker_key?: string | null
        }
        Update: {
          candidate_fingerprint?: string
          confidence?: number | null
          created_at?: string
          duplicate_of?: string | null
          id?: string
          lane_key?: string
          priority?: number
          reasoning_summary?: string | null
          scope_ref?: Json
          scope_type?: string
          skill_manifest_id?: string | null
          sla_due_at?: string | null
          source_work_item_id?: string | null
          status?: string
          trace_id?: string | null
          worker_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_shadow_candidates_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "hq_workforce_shadow_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_shadow_candidates_skill_manifest_id_fkey"
            columns: ["skill_manifest_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_skill_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_shadow_candidates_source_work_item_id_fkey"
            columns: ["source_work_item_id"]
            isOneToOne: false
            referencedRelation: "hq_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_shadow_candidates_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_shadow_traces"
            referencedColumns: ["trace_id"]
          },
        ]
      }
      hq_workforce_shadow_decisions: {
        Row: {
          authority_reason: string
          created_at: string
          decision_key: string
          human_rationale: string | null
          hypothetical_authority_result: string
          id: string
          proposed_action: Json
          required_authority: Json
          reviewed_at: string | null
          reviewed_by: string | null
          state: string
          trace_id: string
          updated_at: string
        }
        Insert: {
          authority_reason: string
          created_at?: string
          decision_key: string
          human_rationale?: string | null
          hypothetical_authority_result: string
          id?: string
          proposed_action: Json
          required_authority?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string
          trace_id: string
          updated_at?: string
        }
        Update: {
          authority_reason?: string
          created_at?: string
          decision_key?: string
          human_rationale?: string | null
          hypothetical_authority_result?: string
          id?: string
          proposed_action?: Json
          required_authority?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string
          trace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_shadow_decisions_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_shadow_traces"
            referencedColumns: ["trace_id"]
          },
        ]
      }
      hq_workforce_shadow_events: {
        Row: {
          event_kind: string
          id: number
          occurred_at: string
          parent_event_id: number | null
          payload: Json
          sequence_no: number
          trace_id: string
        }
        Insert: {
          event_kind: string
          id?: never
          occurred_at?: string
          parent_event_id?: number | null
          payload?: Json
          sequence_no: number
          trace_id: string
        }
        Update: {
          event_kind?: string
          id?: never
          occurred_at?: string
          parent_event_id?: number | null
          payload?: Json
          sequence_no?: number
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_shadow_events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_shadow_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_shadow_events_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_shadow_traces"
            referencedColumns: ["trace_id"]
          },
        ]
      }
      hq_workforce_shadow_resource_usage: {
        Row: {
          amount: number
          id: number
          recorded_at: string
          resource_kind: string
          trace_id: string | null
          unit: string
          window_started_at: string
          worker_key: string | null
        }
        Insert: {
          amount?: number
          id?: never
          recorded_at?: string
          resource_kind: string
          trace_id?: string | null
          unit?: string
          window_started_at: string
          worker_key?: string | null
        }
        Update: {
          amount?: number
          id?: never
          recorded_at?: string
          resource_kind?: string
          trace_id?: string | null
          unit?: string
          window_started_at?: string
          worker_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_shadow_resource_usage_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_shadow_traces"
            referencedColumns: ["trace_id"]
          },
        ]
      }
      hq_workforce_shadow_runs: {
        Row: {
          executed_at: string
          expected_outcome: Json
          id: string
          input_snapshot: Json
          observed_outcome: Json
          passed: boolean
          side_effects_applied: boolean
          tool_contract_id: string
          verifier_key: string
          worker_key: string
        }
        Insert: {
          executed_at?: string
          expected_outcome: Json
          id?: string
          input_snapshot: Json
          observed_outcome: Json
          passed: boolean
          side_effects_applied?: boolean
          tool_contract_id: string
          verifier_key: string
          worker_key: string
        }
        Update: {
          executed_at?: string
          expected_outcome?: Json
          id?: string
          input_snapshot?: Json
          observed_outcome?: Json
          passed?: boolean
          side_effects_applied?: boolean
          tool_contract_id?: string
          verifier_key?: string
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_shadow_runs_tool_contract_id_fkey"
            columns: ["tool_contract_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_tool_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_shadow_runs_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_key"]
          },
          {
            foreignKeyName: "hq_workforce_shadow_runs_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["worker_key"]
          },
        ]
      }
      hq_workforce_shadow_traces: {
        Row: {
          completed_at: string | null
          confidence: number | null
          consequential_action_performed: boolean
          created_at: string
          cycle_key: string
          id: string
          lane_key: string | null
          predicted_outcome: Json
          scope_ref: Json
          scope_type: string
          skill_manifest_id: string | null
          started_at: string
          status: string
          trace_id: string
          worker_key: string
        }
        Insert: {
          completed_at?: string | null
          confidence?: number | null
          consequential_action_performed?: boolean
          created_at?: string
          cycle_key: string
          id?: string
          lane_key?: string | null
          predicted_outcome?: Json
          scope_ref?: Json
          scope_type: string
          skill_manifest_id?: string | null
          started_at?: string
          status?: string
          trace_id?: string
          worker_key: string
        }
        Update: {
          completed_at?: string | null
          confidence?: number | null
          consequential_action_performed?: boolean
          created_at?: string
          cycle_key?: string
          id?: string
          lane_key?: string | null
          predicted_outcome?: Json
          scope_ref?: Json
          scope_type?: string
          skill_manifest_id?: string | null
          started_at?: string
          status?: string
          trace_id?: string
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_shadow_traces_skill_manifest_id_fkey"
            columns: ["skill_manifest_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_skill_manifests"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_skill_manifests: {
        Row: {
          allowed_data_classes: string[]
          allowed_scope_types: string[]
          autonomy_required: number
          certification_status: string
          certified_at: string | null
          compensation_strategy: string
          created_at: string
          escalation_contract: Json
          expected_outcome: Json
          expires_at: string | null
          failure_handling: Json
          id: string
          immutable_version_key: string | null
          input_contract: Json
          max_attempts: number
          max_records_affected: number
          max_runtime_ms: number
          owner_key: string
          preconditions: Json
          purpose: string | null
          requires_human_approval: boolean
          resource_contract: Json
          retry_policy: Json
          risk_class: number
          shadow_capable: boolean
          skill_key: string
          tool_contract_id: string
          verification_contract: Json
          verification_required: boolean
          version: number
        }
        Insert: {
          allowed_data_classes?: string[]
          allowed_scope_types?: string[]
          autonomy_required: number
          certification_status?: string
          certified_at?: string | null
          compensation_strategy?: string
          created_at?: string
          escalation_contract?: Json
          expected_outcome?: Json
          expires_at?: string | null
          failure_handling?: Json
          id?: string
          immutable_version_key?: string | null
          input_contract?: Json
          max_attempts?: number
          max_records_affected?: number
          max_runtime_ms?: number
          owner_key?: string
          preconditions?: Json
          purpose?: string | null
          requires_human_approval?: boolean
          resource_contract?: Json
          retry_policy?: Json
          risk_class: number
          shadow_capable?: boolean
          skill_key: string
          tool_contract_id: string
          verification_contract?: Json
          verification_required?: boolean
          version: number
        }
        Update: {
          allowed_data_classes?: string[]
          allowed_scope_types?: string[]
          autonomy_required?: number
          certification_status?: string
          certified_at?: string | null
          compensation_strategy?: string
          created_at?: string
          escalation_contract?: Json
          expected_outcome?: Json
          expires_at?: string | null
          failure_handling?: Json
          id?: string
          immutable_version_key?: string | null
          input_contract?: Json
          max_attempts?: number
          max_records_affected?: number
          max_runtime_ms?: number
          owner_key?: string
          preconditions?: Json
          purpose?: string | null
          requires_human_approval?: boolean
          resource_contract?: Json
          retry_policy?: Json
          risk_class?: number
          shadow_capable?: boolean
          skill_key?: string
          tool_contract_id?: string
          verification_contract?: Json
          verification_required?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_skill_manifests_tool_contract_id_fkey"
            columns: ["tool_contract_id"]
            isOneToOne: true
            referencedRelation: "hq_workforce_tool_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_skill_promotions: {
        Row: {
          benchmark_evidence: Json
          benchmark_passed: boolean | null
          created_at: string
          from_version: number
          id: string
          learning_candidate_id: string
          probation_evidence: Json
          promotion_key: string
          proposed_skill_id: string | null
          rollback_reason: string | null
          skill_key: string
          status: string
          to_version: number
          updated_at: string
        }
        Insert: {
          benchmark_evidence?: Json
          benchmark_passed?: boolean | null
          created_at?: string
          from_version: number
          id?: string
          learning_candidate_id: string
          probation_evidence?: Json
          promotion_key: string
          proposed_skill_id?: string | null
          rollback_reason?: string | null
          skill_key: string
          status: string
          to_version: number
          updated_at?: string
        }
        Update: {
          benchmark_evidence?: Json
          benchmark_passed?: boolean | null
          created_at?: string
          from_version?: number
          id?: string
          learning_candidate_id?: string
          probation_evidence?: Json
          promotion_key?: string
          proposed_skill_id?: string | null
          rollback_reason?: string | null
          skill_key?: string
          status?: string
          to_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_skill_promotions_learning_candidate_id_fkey"
            columns: ["learning_candidate_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_learning_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_skill_promotions_proposed_skill_id_fkey"
            columns: ["proposed_skill_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_skills: {
        Row: {
          created_at: string
          execution_method: string
          id: string
          lane_key: string | null
          procedure: Json
          recovery: Json
          required_competencies: string[]
          required_context: string[]
          skill_key: string
          status: string
          title: string
          verification: Json
          version: number
        }
        Insert: {
          created_at?: string
          execution_method?: string
          id?: string
          lane_key?: string | null
          procedure?: Json
          recovery?: Json
          required_competencies?: string[]
          required_context?: string[]
          skill_key: string
          status?: string
          title: string
          verification?: Json
          version: number
        }
        Update: {
          created_at?: string
          execution_method?: string
          id?: string
          lane_key?: string | null
          procedure?: Json
          recovery?: Json
          required_competencies?: string[]
          required_context?: string[]
          skill_key?: string
          status?: string
          title?: string
          verification?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_skills_lane_key_fkey"
            columns: ["lane_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_lanes"
            referencedColumns: ["lane_key"]
          },
        ]
      }
      hq_workforce_task_contracts: {
        Row: {
          attempt_count: number
          budget_amount: number
          budget_key: string
          capability_key: string
          completed_at: string | null
          created_at: string
          execution_evidence: Json
          id: string
          idempotency_key: string
          last_error: string | null
          lease_expires_at: string | null
          max_attempts: number
          next_attempt_at: string
          operation: string
          payload: Json
          resource_type: string
          schema_version: number
          scope_ref: Json
          scope_type: string
          started_at: string | null
          status: string
          task_key: string
          tool_contract_id: string
          verification_status: string
          worker_key: string
        }
        Insert: {
          attempt_count?: number
          budget_amount?: number
          budget_key: string
          capability_key: string
          completed_at?: string | null
          created_at?: string
          execution_evidence?: Json
          id?: string
          idempotency_key: string
          last_error?: string | null
          lease_expires_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          operation: string
          payload?: Json
          resource_type: string
          schema_version?: number
          scope_ref?: Json
          scope_type: string
          started_at?: string | null
          status?: string
          task_key: string
          tool_contract_id: string
          verification_status?: string
          worker_key: string
        }
        Update: {
          attempt_count?: number
          budget_amount?: number
          budget_key?: string
          capability_key?: string
          completed_at?: string | null
          created_at?: string
          execution_evidence?: Json
          id?: string
          idempotency_key?: string
          last_error?: string | null
          lease_expires_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          operation?: string
          payload?: Json
          resource_type?: string
          schema_version?: number
          scope_ref?: Json
          scope_type?: string
          started_at?: string | null
          status?: string
          task_key?: string
          tool_contract_id?: string
          verification_status?: string
          worker_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_task_contracts_tool_contract_id_fkey"
            columns: ["tool_contract_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_tool_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_task_contracts_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_key"]
          },
          {
            foreignKeyName: "hq_workforce_task_contracts_worker_key_fkey"
            columns: ["worker_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["worker_key"]
          },
        ]
      }
      hq_workforce_task_verifications: {
        Row: {
          expected_outcome: Json
          id: string
          observed_outcome: Json
          passed: boolean
          task_id: string
          verified_at: string
          verifier_key: string
        }
        Insert: {
          expected_outcome: Json
          id?: string
          observed_outcome: Json
          passed: boolean
          task_id: string
          verified_at?: string
          verifier_key: string
        }
        Update: {
          expected_outcome?: Json
          id?: string
          observed_outcome?: Json
          passed?: boolean
          task_id?: string
          verified_at?: string
          verifier_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_task_verifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "hq_workforce_task_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_tool_contracts: {
        Row: {
          approved_at: string | null
          created_at: string
          handler_key: string
          id: string
          operation: string
          required_capability_key: string
          resource_type: string
          side_effect_class: string
          status: string
          title: string
          tool_key: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          handler_key: string
          id?: string
          operation: string
          required_capability_key: string
          resource_type: string
          side_effect_class: string
          status?: string
          title: string
          tool_key: string
          version: number
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          handler_key?: string
          id?: string
          operation?: string
          required_capability_key?: string
          resource_type?: string
          side_effect_class?: string
          status?: string
          title?: string
          tool_key?: string
          version?: number
        }
        Relationships: []
      }
      hq_workforce_worker_certifications: {
        Row: {
          certification_version: number
          certified_at: string
          checks: Json
          evidence_snapshot_id: string | null
          id: string
          lane_key: string
          passed: boolean
          worker_id: string
        }
        Insert: {
          certification_version?: number
          certified_at?: string
          checks: Json
          evidence_snapshot_id?: string | null
          id?: string
          lane_key: string
          passed: boolean
          worker_id: string
        }
        Update: {
          certification_version?: number
          certified_at?: string
          checks?: Json
          evidence_snapshot_id?: string | null
          id?: string
          lane_key?: string
          passed?: boolean
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_worker_certifications_evidence_snapshot_id_fkey"
            columns: ["evidence_snapshot_id"]
            isOneToOne: false
            referencedRelation: "hq_context_decision_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_worker_certifications_lane_key_fkey"
            columns: ["lane_key"]
            isOneToOne: false
            referencedRelation: "hq_workforce_lanes"
            referencedColumns: ["lane_key"]
          },
          {
            foreignKeyName: "hq_workforce_worker_certifications_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "hq_workforce_worker_certifications_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_worker_skills: {
        Row: {
          assigned_at: string
          certified_at: string | null
          id: string
          skill_id: string
          status: string
          worker_id: string
        }
        Insert: {
          assigned_at?: string
          certified_at?: string | null
          id?: string
          skill_id: string
          status?: string
          worker_id: string
        }
        Update: {
          assigned_at?: string
          certified_at?: string | null
          id?: string
          skill_id?: string
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_workforce_worker_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_workforce_worker_skills_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_worker_performance"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "hq_workforce_worker_skills_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "hq_workforce_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_workforce_workers: {
        Row: {
          approval_boundaries: Json
          competencies: Json
          created_at: string
          department_key: string
          id: string
          job_key: string | null
          kpis: Json
          manager_worker_key: string | null
          mission: string
          paid_ai_allowed: boolean
          permissions: Json
          reasoning_mode: string
          status: string
          title: string
          updated_at: string
          worker_key: string
          worker_kind: string
        }
        Insert: {
          approval_boundaries?: Json
          competencies?: Json
          created_at?: string
          department_key: string
          id?: string
          job_key?: string | null
          kpis?: Json
          manager_worker_key?: string | null
          mission: string
          paid_ai_allowed?: boolean
          permissions?: Json
          reasoning_mode?: string
          status?: string
          title: string
          updated_at?: string
          worker_key: string
          worker_kind: string
        }
        Update: {
          approval_boundaries?: Json
          competencies?: Json
          created_at?: string
          department_key?: string
          id?: string
          job_key?: string | null
          kpis?: Json
          manager_worker_key?: string | null
          mission?: string
          paid_ai_allowed?: boolean
          permissions?: Json
          reasoning_mode?: string
          status?: string
          title?: string
          updated_at?: string
          worker_key?: string
          worker_kind?: string
        }
        Relationships: []
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
            foreignKeyName: "invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
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
      kcse_grade_threshold_profiles: {
        Row: {
          created_at: string
          exam_year: number
          grade: string
          id: string
          max_percentage: number
          min_percentage: number
          source_ref: string | null
          source_type: string
          subject: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          exam_year: number
          grade: string
          id?: string
          max_percentage: number
          min_percentage: number
          source_ref?: string | null
          source_type?: string
          subject?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          exam_year?: number
          grade?: string
          id?: string
          max_percentage?: number
          min_percentage?: number
          source_ref?: string | null
          source_type?: string
          subject?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      kcse_paper_blueprints: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          paper_code: string
          sections: Json
          source_ref: string | null
          source_type: string
          subject: string
          title: string
          total_marks: number
          updated_at: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          id?: string
          paper_code: string
          sections?: Json
          source_ref?: string | null
          source_type?: string
          subject: string
          title: string
          total_marks: number
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          paper_code?: string
          sections?: Json
          source_ref?: string | null
          source_type?: string
          subject?: string
          title?: string
          total_marks?: number
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      kcse_revision_assets: {
        Row: {
          answer: string | null
          asset_type: string
          created_at: string
          id: string
          media_url: string | null
          prompt: string
          source_ref: string | null
          source_type: string
          subject: string
          topic: string | null
          updated_at: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          answer?: string | null
          asset_type: string
          created_at?: string
          id?: string
          media_url?: string | null
          prompt: string
          source_ref?: string | null
          source_type?: string
          subject: string
          topic?: string | null
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          answer?: string | null
          asset_type?: string
          created_at?: string
          id?: string
          media_url?: string | null
          prompt?: string
          source_ref?: string | null
          source_type?: string
          subject?: string
          topic?: string | null
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      kcse_topic_dependencies: {
        Row: {
          created_at: string
          id: string
          prerequisite_topic: string
          source_ref: string | null
          source_type: string
          subject: string
          topic: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          prerequisite_topic: string
          source_ref?: string | null
          source_type?: string
          subject: string
          topic: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          prerequisite_topic?: string
          source_ref?: string | null
          source_type?: string
          subject?: string
          topic?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
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
      learning_resources: {
        Row: {
          canonical_key: string
          chapter_id: string | null
          content_block_id: string | null
          content_id: string | null
          created_at: string
          created_by: string | null
          curriculum_id: string | null
          description: string | null
          grade: string | null
          id: string
          learning_outcomes: string[]
          owner_type: string
          publication_id: string | null
          school_id: string | null
          source_type: string
          status: string
          strand: string | null
          sub_strand_id: string | null
          subject: string | null
          subject_id: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          canonical_key: string
          chapter_id?: string | null
          content_block_id?: string | null
          content_id?: string | null
          created_at?: string
          created_by?: string | null
          curriculum_id?: string | null
          description?: string | null
          grade?: string | null
          id?: string
          learning_outcomes?: string[]
          owner_type?: string
          publication_id?: string | null
          school_id?: string | null
          source_type: string
          status?: string
          strand?: string | null
          sub_strand_id?: string | null
          subject?: string | null
          subject_id?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          canonical_key?: string
          chapter_id?: string | null
          content_block_id?: string | null
          content_id?: string | null
          created_at?: string
          created_by?: string | null
          curriculum_id?: string | null
          description?: string | null
          grade?: string | null
          id?: string
          learning_outcomes?: string[]
          owner_type?: string
          publication_id?: string | null
          school_id?: string | null
          source_type?: string
          status?: string
          strand?: string | null
          sub_strand_id?: string | null
          subject?: string | null
          subject_id?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_resources_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_resources_content_block_id_fkey"
            columns: ["content_block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_resources_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "vibelearn_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_resources_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_resources_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_resources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_resources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_resources_sub_strand_id_fkey"
            columns: ["sub_strand_id"]
            isOneToOne: false
            referencedRelation: "cbc_strands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_resources_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_evidence: {
        Row: {
          class_id: string | null
          created_at: string
          description: string | null
          evidence_type: string
          homework_id: string | null
          id: string
          lesson_id: string | null
          media_url: string | null
          score: number | null
          student_id: string | null
          submission_id: string | null
          teacher_id: string
          teaching_occurrence_id: string | null
          title: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          evidence_type: string
          homework_id?: string | null
          id?: string
          lesson_id?: string | null
          media_url?: string | null
          score?: number | null
          student_id?: string | null
          submission_id?: string | null
          teacher_id: string
          teaching_occurrence_id?: string | null
          title?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          evidence_type?: string
          homework_id?: string | null
          id?: string
          lesson_id?: string | null
          media_url?: string | null
          score?: number | null
          student_id?: string | null
          submission_id?: string | null
          teacher_id?: string
          teaching_occurrence_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_evidence_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "homework_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_teaching_occurrence_id_fkey"
            columns: ["teaching_occurrence_id"]
            isOneToOne: false
            referencedRelation: "teaching_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_evidence_resource_usage: {
        Row: {
          created_at: string
          id: string
          lesson_evidence_id: string
          occurrence_resource_usage_id: string
          resource_id: string
          teacher_id: string
          teaching_occurrence_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_evidence_id: string
          occurrence_resource_usage_id: string
          resource_id: string
          teacher_id: string
          teaching_occurrence_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_evidence_id?: string
          occurrence_resource_usage_id?: string
          resource_id?: string
          teacher_id?: string
          teaching_occurrence_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_evidence_resource_usag_occurrence_resource_usage_id_fkey"
            columns: ["occurrence_resource_usage_id"]
            isOneToOne: false
            referencedRelation: "teaching_occurrence_resource_usage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_resource_usage_lesson_evidence_id_fkey"
            columns: ["lesson_evidence_id"]
            isOneToOne: false
            referencedRelation: "lesson_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_resource_usage_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_resource_usage_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_resource_usage_teaching_occurrence_id_fkey"
            columns: ["teaching_occurrence_id"]
            isOneToOne: false
            referencedRelation: "teaching_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_interventions: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          notes: string | null
          status: string
          strand_id: string | null
          student_id: string
          teacher_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          notes?: string | null
          status?: string
          strand_id?: string | null
          student_id: string
          teacher_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          notes?: string | null
          status?: string
          strand_id?: string | null
          student_id?: string
          teacher_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_interventions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_interventions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_interventions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          challenges: string | null
          class_id: string | null
          created_at: string | null
          homework_id: string | null
          homework_set: string | null
          id: string
          lesson_plan_id: string | null
          participation_score: number | null
          school_id: string | null
          subject_id: string | null
          taught_date: string
          teacher_id: string | null
          updated_at: string | null
          what_was_taught: string | null
        }
        Insert: {
          challenges?: string | null
          class_id?: string | null
          created_at?: string | null
          homework_id?: string | null
          homework_set?: string | null
          id?: string
          lesson_plan_id?: string | null
          participation_score?: number | null
          school_id?: string | null
          subject_id?: string | null
          taught_date?: string
          teacher_id?: string | null
          updated_at?: string | null
          what_was_taught?: string | null
        }
        Update: {
          challenges?: string | null
          class_id?: string | null
          created_at?: string | null
          homework_id?: string | null
          homework_set?: string | null
          id?: string
          lesson_plan_id?: string | null
          participation_score?: number | null
          school_id?: string | null
          subject_id?: string | null
          taught_date?: string
          teacher_id?: string | null
          updated_at?: string | null
          what_was_taught?: string | null
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
            foreignKeyName: "lesson_notes_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
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
            referencedRelation: "school_directory_public"
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
            foreignKeyName: "lesson_notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plan_history: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          lesson_plan_id: string
          school_id: string | null
          snapshot: Json
          status: string
          teacher_id: string
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          created_at?: string
          id?: string
          lesson_plan_id: string
          school_id?: string | null
          snapshot: Json
          status: string
          teacher_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          lesson_plan_id?: string
          school_id?: string | null
          snapshot?: Json
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plan_history_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plans: {
        Row: {
          body: string | null
          class_id: string
          created_at: string
          curriculum_id: string | null
          day_of_week: number
          generated_by: string
          id: string
          previous_lesson_plan_id: string | null
          scheme_id: string | null
          school_id: string | null
          subject_id: string
          taught_date: string
          teacher_id: string
          timetable_slot_id: string
          title: string | null
          topic: string | null
          updated_at: string
          week_start: string
        }
        Insert: {
          body?: string | null
          class_id: string
          created_at?: string
          curriculum_id?: string | null
          day_of_week: number
          generated_by?: string
          id?: string
          previous_lesson_plan_id?: string | null
          scheme_id?: string | null
          school_id?: string | null
          subject_id: string
          taught_date: string
          teacher_id: string
          timetable_slot_id: string
          title?: string | null
          topic?: string | null
          updated_at?: string
          week_start: string
        }
        Update: {
          body?: string | null
          class_id?: string
          created_at?: string
          curriculum_id?: string | null
          day_of_week?: number
          generated_by?: string
          id?: string
          previous_lesson_plan_id?: string | null
          scheme_id?: string | null
          school_id?: string | null
          subject_id?: string
          taught_date?: string
          teacher_id?: string
          timetable_slot_id?: string
          title?: string | null
          topic?: string | null
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_previous_lesson_plan_id_fkey"
            columns: ["previous_lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "scheme_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
            foreignKeyName: "lesson_plans_timetable_slot_id_fkey"
            columns: ["timetable_slot_id"]
            isOneToOne: false
            referencedRelation: "timetable_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_reflections: {
        Row: {
          cbc_assessment_id: string | null
          challenges: string | null
          class_id: string | null
          created_at: string
          id: string
          lesson_id: string | null
          lesson_plan_id: string | null
          next_steps: string | null
          school_id: string | null
          teacher_id: string
          teaching_occurrence_id: string | null
          updated_at: string
          what_worked: string | null
        }
        Insert: {
          cbc_assessment_id?: string | null
          challenges?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          lesson_plan_id?: string | null
          next_steps?: string | null
          school_id?: string | null
          teacher_id: string
          teaching_occurrence_id?: string | null
          updated_at?: string
          what_worked?: string | null
        }
        Update: {
          cbc_assessment_id?: string | null
          challenges?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          lesson_plan_id?: string | null
          next_steps?: string | null
          school_id?: string | null
          teacher_id?: string
          teaching_occurrence_id?: string | null
          updated_at?: string
          what_worked?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_reflections_cbc_assessment_id_fkey"
            columns: ["cbc_assessment_id"]
            isOneToOne: false
            referencedRelation: "cbc_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reflections_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reflections_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reflections_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reflections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reflections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reflections_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reflections_teaching_occurrence_id_fkey"
            columns: ["teaching_occurrence_id"]
            isOneToOne: false
            referencedRelation: "teaching_occurrences"
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
      parent_learning_summaries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          class_id: string | null
          focus_areas: string[]
          generated_at: string
          generated_by: string | null
          id: string
          period_end: string
          period_start: string
          published_at: string | null
          school_id: string | null
          status: string
          strengths: string[]
          student_id: string
          summary: Json
          teacher_comment: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          class_id?: string | null
          focus_areas?: string[]
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end: string
          period_start: string
          published_at?: string | null
          school_id?: string | null
          status?: string
          strengths?: string[]
          student_id: string
          summary?: Json
          teacher_comment?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          class_id?: string | null
          focus_areas?: string[]
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          published_at?: string | null
          school_id?: string | null
          status?: string
          strengths?: string[]
          student_id?: string
          summary?: Json
          teacher_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_learning_summaries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_learning_summaries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_learning_summaries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_learning_summaries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_learning_summary_sources: {
        Row: {
          created_at: string
          id: string
          source_id: string
          source_type: string
          summary_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_id: string
          source_type: string
          summary_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_id?: string
          source_type?: string
          summary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_learning_summary_sources_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "parent_learning_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          delivery_purpose: string | null
          generated_by: string
          id: string
          lesson_plan_id: string | null
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
          delivery_purpose?: string | null
          generated_by?: string
          id?: string
          lesson_plan_id?: string | null
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
          delivery_purpose?: string | null
          generated_by?: string
          id?: string
          lesson_plan_id?: string | null
          school_id?: string
          sent_at?: string
          student_id?: string
          subject?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_messages_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
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
        ]
      }
      parent_student_links: {
        Row: {
          access_level: string | null
          can_pickup: boolean
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
          can_pickup?: boolean
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
          can_pickup?: boolean
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
            foreignKeyName: "parent_student_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
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
      plan_entitlements: {
        Row: {
          created_at: string
          enabled: boolean
          entitlement_key: string
          limits: Json
          plan_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          entitlement_key: string
          limits?: Json
          plan_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          entitlement_key?: string
          limits?: Json
          plan_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          idempotency_key: string | null
          metadata: Json
          occurred_at: string
          school_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          occurred_at?: string
          school_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          occurred_at?: string
          school_id?: string | null
        }
        Relationships: []
      }
      platform_owners: {
        Row: {
          added_by: string
          created_at: string
          note: string | null
          profile_id: string
        }
        Insert: {
          added_by?: string
          created_at?: string
          note?: string | null
          profile_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          note?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_owners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_entitlements: {
        Row: {
          created_at: string
          entitlement_key: string
          granted_until: string | null
          profile_id: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entitlement_key: string
          granted_until?: string | null
          profile_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entitlement_key?: string
          granted_until?: string | null
          profile_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_entitlements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          anonymized_at: string | null
          arrived_at: string | null
          country_code: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          id: string
          is_anonymized: boolean
          parental_consent_at: string | null
          parental_consent_by: string | null
          phone: string | null
          role: string | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          anonymized_at?: string | null
          arrived_at?: string | null
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          id: string
          is_anonymized?: boolean
          parental_consent_at?: string | null
          parental_consent_by?: string | null
          phone?: string | null
          role?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          anonymized_at?: string | null
          arrived_at?: string | null
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          id?: string
          is_anonymized?: boolean
          parental_consent_at?: string | null
          parental_consent_by?: string | null
          phone?: string | null
          role?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
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
      progress_records: {
        Row: {
          challenges: string | null
          class_id: string | null
          created_at: string | null
          homework_set: string | null
          id: string
          lesson_plan_id: string | null
          next_steps: string | null
          participation_score: number | null
          school_id: string | null
          subject_id: string | null
          taught_date: string
          teacher_id: string | null
          teacher_remarks: string | null
          teaching_occurrence_id: string | null
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
          next_steps?: string | null
          participation_score?: number | null
          school_id?: string | null
          subject_id?: string | null
          taught_date?: string
          teacher_id?: string | null
          teacher_remarks?: string | null
          teaching_occurrence_id?: string | null
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
          next_steps?: string | null
          participation_score?: number | null
          school_id?: string | null
          subject_id?: string | null
          taught_date?: string
          teacher_id?: string | null
          teacher_remarks?: string | null
          teaching_occurrence_id?: string | null
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
            referencedRelation: "school_directory_public"
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
            foreignKeyName: "progress_records_teaching_occurrence_id_fkey"
            columns: ["teaching_occurrence_id"]
            isOneToOne: false
            referencedRelation: "teaching_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      project_submissions: {
        Row: {
          created_at: string | null
          feedback: string | null
          id: string
          mark: number | null
          notes: string | null
          photo_url: string | null
          project_id: string
          status: string
          student_id: string | null
          submitted_at: string | null
        }
        Insert: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          mark?: number | null
          notes?: string | null
          photo_url?: string | null
          project_id: string
          status?: string
          student_id?: string | null
          submitted_at?: string | null
        }
        Update: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          mark?: number | null
          notes?: string | null
          photo_url?: string | null
          project_id?: string
          status?: string
          student_id?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          class_id: string | null
          created_at: string | null
          curriculum_id: string | null
          description: string | null
          due_date: string | null
          id: string
          lesson_plan_id: string | null
          school_id: string | null
          start_date: string | null
          status: string
          subject_id: string | null
          teacher_id: string | null
          title: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          curriculum_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lesson_plan_id?: string | null
          school_id?: string | null
          start_date?: string | null
          status?: string
          subject_id?: string | null
          teacher_id?: string | null
          title: string
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          curriculum_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lesson_plan_id?: string | null
          school_id?: string | null
          start_date?: string | null
          status?: string
          subject_id?: string | null
          teacher_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_curriculum_provenance: {
        Row: {
          alignment_status: string
          created_at: string
          created_by: string | null
          curriculum_id: string | null
          curriculum_version: string | null
          evidence: Json
          external_reference: string | null
          external_review_status: string
          framework: string
          id: string
          jurisdiction: string
          publication_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_authority: string
          source_reference: string
          updated_at: string
        }
        Insert: {
          alignment_status?: string
          created_at?: string
          created_by?: string | null
          curriculum_id?: string | null
          curriculum_version?: string | null
          evidence?: Json
          external_reference?: string | null
          external_review_status?: string
          framework?: string
          id?: string
          jurisdiction?: string
          publication_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_authority: string
          source_reference: string
          updated_at?: string
        }
        Update: {
          alignment_status?: string
          created_at?: string
          created_by?: string | null
          curriculum_id?: string | null
          curriculum_version?: string | null
          evidence?: Json
          external_reference?: string | null
          external_review_status?: string
          framework?: string
          id?: string
          jurisdiction?: string
          publication_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_authority?: string
          source_reference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_curriculum_provenance_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_curriculum_provenance_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_release_checks: {
        Row: {
          chapter_id: string | null
          check_code: string
          checked_at: string
          details: Json
          id: string
          publication_id: string
          score: number
          status: string
        }
        Insert: {
          chapter_id?: string | null
          check_code: string
          checked_at?: string
          details?: Json
          id?: string
          publication_id: string
          score?: number
          status: string
        }
        Update: {
          chapter_id?: string | null
          check_code?: string
          checked_at?: string
          details?: Json
          id?: string
          publication_id?: string
          score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_release_checks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_release_checks_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
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
      report_card_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          evidence_version: number | null
          from_status: string | null
          id: string
          metadata: Json
          report_card_id: string
          school_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          evidence_version?: number | null
          from_status?: string | null
          id?: string
          metadata?: Json
          report_card_id: string
          school_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          evidence_version?: number | null
          from_status?: string | null
          id?: string
          metadata?: Json
          report_card_id?: string
          school_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_card_audit_log_report_card_id_fkey"
            columns: ["report_card_id"]
            isOneToOne: false
            referencedRelation: "report_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_card_audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_card_audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      report_card_evidence_snapshots: {
        Row: {
          completeness_issues: Json
          completeness_status: string
          created_at: string
          frozen_at: string | null
          generated_at: string
          generated_by: string
          id: string
          report_card_id: string
          snapshot: Json
          term_end: string
          term_start: string
          version: number
        }
        Insert: {
          completeness_issues?: Json
          completeness_status: string
          created_at?: string
          frozen_at?: string | null
          generated_at?: string
          generated_by: string
          id?: string
          report_card_id: string
          snapshot: Json
          term_end: string
          term_start: string
          version: number
        }
        Update: {
          completeness_issues?: Json
          completeness_status?: string
          created_at?: string
          frozen_at?: string | null
          generated_at?: string
          generated_by?: string
          id?: string
          report_card_id?: string
          snapshot?: Json
          term_end?: string
          term_start?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_card_evidence_snapshots_report_card_id_fkey"
            columns: ["report_card_id"]
            isOneToOne: false
            referencedRelation: "report_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      report_card_subjects: {
        Row: {
          achievement_summary: string | null
          assessment_average: number | null
          created_at: string
          evidence_snapshot: Json
          generated_at: string | null
          generated_comment: string | null
          generated_comment_evidence: Json
          growth_percentage: number | null
          id: string
          intervention_summary: Json
          mastery_average: number | null
          parent_guidance: string | null
          recommended_next_steps: string | null
          report_card_id: string
          strengths_summary: string | null
          strongest_outcomes: Json
          subject_id: string
          support_outcomes: Json
          support_summary: string | null
          teacher_comment: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          achievement_summary?: string | null
          assessment_average?: number | null
          created_at?: string
          evidence_snapshot?: Json
          generated_at?: string | null
          generated_comment?: string | null
          generated_comment_evidence?: Json
          growth_percentage?: number | null
          id?: string
          intervention_summary?: Json
          mastery_average?: number | null
          parent_guidance?: string | null
          recommended_next_steps?: string | null
          report_card_id: string
          strengths_summary?: string | null
          strongest_outcomes?: Json
          subject_id: string
          support_outcomes?: Json
          support_summary?: string | null
          teacher_comment?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          achievement_summary?: string | null
          assessment_average?: number | null
          created_at?: string
          evidence_snapshot?: Json
          generated_at?: string | null
          generated_comment?: string | null
          generated_comment_evidence?: Json
          growth_percentage?: number | null
          id?: string
          intervention_summary?: Json
          mastery_average?: number | null
          parent_guidance?: string | null
          recommended_next_steps?: string | null
          report_card_id?: string
          strengths_summary?: string | null
          strongest_outcomes?: Json
          subject_id?: string
          support_outcomes?: Json
          support_summary?: string | null
          teacher_comment?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_card_subjects_report_card_id_fkey"
            columns: ["report_card_id"]
            isOneToOne: false
            referencedRelation: "report_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_card_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      report_cards: {
        Row: {
          academic_year: number
          approved_at: string | null
          approved_by: string | null
          class_id: string
          completeness_issues: Json
          completeness_status: string
          created_at: string
          evidence_generated_at: string | null
          evidence_version: number
          generated_snapshot: Json
          id: string
          locked_at: string | null
          overall_comment: string | null
          published_at: string | null
          revision: number
          school_id: string
          status: string
          student_id: string
          submitted_at: string | null
          teacher_id: string
          term_id: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_issues: Json
          validation_status: string
        }
        Insert: {
          academic_year: number
          approved_at?: string | null
          approved_by?: string | null
          class_id: string
          completeness_issues?: Json
          completeness_status?: string
          created_at?: string
          evidence_generated_at?: string | null
          evidence_version?: number
          generated_snapshot?: Json
          id?: string
          locked_at?: string | null
          overall_comment?: string | null
          published_at?: string | null
          revision?: number
          school_id: string
          status?: string
          student_id: string
          submitted_at?: string | null
          teacher_id: string
          term_id: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_issues?: Json
          validation_status?: string
        }
        Update: {
          academic_year?: number
          approved_at?: string | null
          approved_by?: string | null
          class_id?: string
          completeness_issues?: Json
          completeness_status?: string
          created_at?: string
          evidence_generated_at?: string | null
          evidence_version?: number
          generated_snapshot?: Json
          id?: string
          locked_at?: string | null
          overall_comment?: string | null
          published_at?: string | null
          revision?: number
          school_id?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          teacher_id?: string
          term_id?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_issues?: Json
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_cards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
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
            foreignKeyName: "report_comparisons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
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
            foreignKeyName: "report_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
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
      scheme_lesson_resource_links: {
        Row: {
          chapter_id: string
          created_at: string
          created_by: string
          exercise_refs: Json
          id: string
          page_end: number | null
          page_start: number | null
          publication_id: string
          resource_id: string
          resource_role: string
          scheme_lesson_id: string
          sequence: number
          updated_at: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          created_by: string
          exercise_refs?: Json
          id?: string
          page_end?: number | null
          page_start?: number | null
          publication_id: string
          resource_id: string
          resource_role: string
          scheme_lesson_id: string
          sequence?: number
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          created_by?: string
          exercise_refs?: Json
          id?: string
          page_end?: number | null
          page_start?: number | null
          publication_id?: string
          resource_id?: string
          resource_role?: string
          scheme_lesson_id?: string
          sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheme_lesson_resource_links_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_lesson_resource_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_lesson_resource_links_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_lesson_resource_links_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_lesson_resource_links_scheme_lesson_id_fkey"
            columns: ["scheme_lesson_id"]
            isOneToOne: false
            referencedRelation: "scheme_of_work"
            referencedColumns: ["id"]
          },
        ]
      }
      scheme_of_work: {
        Row: {
          academic_term_id: string | null
          assessment_methods: string | null
          class_id: string | null
          content_status: string | null
          created_at: string | null
          curriculum_content_id: string | null
          curriculum_content_lesson_index: number | null
          curriculum_id: string | null
          curriculum_type: string
          date: string | null
          day_of_week: string | null
          grade: string
          id: string
          key_inquiry_question: string | null
          learning_experiences: string | null
          learning_resources: string | null
          lesson_number: number | null
          objectives: string | null
          period: number | null
          reference: string | null
          reflection: string | null
          remarks: string | null
          resources: string | null
          rollcall: string | null
          school_id: string
          sequence_number: number | null
          source: string
          status: string | null
          strand: string | null
          sub_strand: string | null
          sub_strand_id: string | null
          subject: string
          subject_id: string
          teacher_id: string | null
          term: number
          topic: string
          updated_at: string | null
          week: number
        }
        Insert: {
          academic_term_id?: string | null
          assessment_methods?: string | null
          class_id?: string | null
          content_status?: string | null
          created_at?: string | null
          curriculum_content_id?: string | null
          curriculum_content_lesson_index?: number | null
          curriculum_id?: string | null
          curriculum_type: string
          date?: string | null
          day_of_week?: string | null
          grade: string
          id?: string
          key_inquiry_question?: string | null
          learning_experiences?: string | null
          learning_resources?: string | null
          lesson_number?: number | null
          objectives?: string | null
          period?: number | null
          reference?: string | null
          reflection?: string | null
          remarks?: string | null
          resources?: string | null
          rollcall?: string | null
          school_id: string
          sequence_number?: number | null
          source?: string
          status?: string | null
          strand?: string | null
          sub_strand?: string | null
          sub_strand_id?: string | null
          subject: string
          subject_id: string
          teacher_id?: string | null
          term: number
          topic: string
          updated_at?: string | null
          week: number
        }
        Update: {
          academic_term_id?: string | null
          assessment_methods?: string | null
          class_id?: string | null
          content_status?: string | null
          created_at?: string | null
          curriculum_content_id?: string | null
          curriculum_content_lesson_index?: number | null
          curriculum_id?: string | null
          curriculum_type?: string
          date?: string | null
          day_of_week?: string | null
          grade?: string
          id?: string
          key_inquiry_question?: string | null
          learning_experiences?: string | null
          learning_resources?: string | null
          lesson_number?: number | null
          objectives?: string | null
          period?: number | null
          reference?: string | null
          reflection?: string | null
          remarks?: string | null
          resources?: string | null
          rollcall?: string | null
          school_id?: string
          sequence_number?: number | null
          source?: string
          status?: string | null
          strand?: string | null
          sub_strand?: string | null
          sub_strand_id?: string | null
          subject?: string
          subject_id?: string
          teacher_id?: string | null
          term?: number
          topic?: string
          updated_at?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "scheme_of_work_academic_term_id_fkey"
            columns: ["academic_term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_of_work_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_of_work_curriculum_content_id_fkey"
            columns: ["curriculum_content_id"]
            isOneToOne: false
            referencedRelation: "curriculum_content"
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
            referencedRelation: "school_directory_public"
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
            foreignKeyName: "scheme_of_work_sub_strand_id_fkey"
            columns: ["sub_strand_id"]
            isOneToOne: false
            referencedRelation: "cbc_strands"
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
        ]
      }
      school_admin_join_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          requester_name: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          requester_name: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          requester_name?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_admin_join_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_admin_join_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_aliases: {
        Row: {
          alias: string
          alias_normalized: string
          confidence: number | null
          created_at: string
          id: string
          school_id: string
          source: string
          source_type: string | null
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          alias: string
          alias_normalized: string
          confidence?: number | null
          created_at?: string
          id?: string
          school_id: string
          source?: string
          source_type?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          alias?: string
          alias_normalized?: string
          confidence?: number | null
          created_at?: string
          id?: string
          school_id?: string
          source?: string
          source_type?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_aliases_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_aliases_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_directory_ingest_batches: {
        Row: {
          checksum: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          published_at: string | null
          record_count: number | null
          source_name: string
          source_observed_at: string | null
          source_url: string | null
          source_version: string | null
          status: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          published_at?: string | null
          record_count?: number | null
          source_name: string
          source_observed_at?: string | null
          source_url?: string | null
          source_version?: string | null
          status?: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          published_at?: string | null
          record_count?: number | null
          source_name?: string
          source_observed_at?: string | null
          source_url?: string | null
          source_version?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_directory_ingest_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_directory_sources: {
        Row: {
          confidence: number | null
          metadata: Json
          observed_at: string
          observed_county: string | null
          observed_lat: number | null
          observed_lng: number | null
          observed_name: string | null
          observed_sub_county: string | null
          school_id: string
          source_name: string
          source_ref: string
          source_url: string | null
        }
        Insert: {
          confidence?: number | null
          metadata?: Json
          observed_at?: string
          observed_county?: string | null
          observed_lat?: number | null
          observed_lng?: number | null
          observed_name?: string | null
          observed_sub_county?: string | null
          school_id: string
          source_name: string
          source_ref: string
          source_url?: string | null
        }
        Update: {
          confidence?: number | null
          metadata?: Json
          observed_at?: string
          observed_county?: string | null
          observed_lat?: number | null
          observed_lng?: number | null
          observed_name?: string | null
          observed_sub_county?: string | null
          school_id?: string
          source_name?: string
          source_ref?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_directory_sources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_directory_sources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_discovery_requests: {
        Row: {
          alternative_name: string | null
          contact_name: string | null
          contact_phone: string | null
          county: string | null
          created_at: string
          id: string
          level: string | null
          name: string
          notes: string | null
          request_type: string
          requested_by: string
          resolved_at: string | null
          school_code: string | null
          status: string
          sub_county: string | null
          submitted_lat: number | null
          submitted_lng: number | null
          ward: string | null
        }
        Insert: {
          alternative_name?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name: string
          notes?: string | null
          request_type?: string
          requested_by: string
          resolved_at?: string | null
          school_code?: string | null
          status?: string
          sub_county?: string | null
          submitted_lat?: number | null
          submitted_lng?: number | null
          ward?: string | null
        }
        Update: {
          alternative_name?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name?: string
          notes?: string | null
          request_type?: string
          requested_by?: string
          resolved_at?: string | null
          school_code?: string | null
          status?: string
          sub_county?: string | null
          submitted_lat?: number | null
          submitted_lng?: number | null
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_discovery_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_identity_candidates: {
        Row: {
          canonical_school_id: string | null
          confidence: number | null
          created_at: string
          directory_school_id: string | null
          id: string
          match_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          canonical_school_id?: string | null
          confidence?: number | null
          created_at?: string
          directory_school_id?: string | null
          id?: string
          match_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          canonical_school_id?: string | null
          confidence?: number | null
          created_at?: string
          directory_school_id?: string | null
          id?: string
          match_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_identity_candidates_canonical_school_id_fkey"
            columns: ["canonical_school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_identity_candidates_canonical_school_id_fkey"
            columns: ["canonical_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_identity_candidates_directory_school_id_fkey"
            columns: ["directory_school_id"]
            isOneToOne: false
            referencedRelation: "schools_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_identity_candidates_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_levels: {
        Row: {
          created_at: string
          level: string
          school_id: string
          source: string
        }
        Insert: {
          created_at?: string
          level: string
          school_id: string
          source?: string
        }
        Update: {
          created_at?: string
          level?: string
          school_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_levels_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_levels_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
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
      school_periods: {
        Row: {
          created_at: string
          end_time: string
          id: string
          kind: string
          label: string
          period_number: number
          school_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          kind?: string
          label: string
          period_number: number
          school_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          kind?: string
          label?: string
          period_number?: number
          school_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_resource_library: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          available_from: string | null
          available_until: string | null
          created_at: string
          department: string | null
          grade: string | null
          id: string
          notes: string | null
          resource_id: string
          school_id: string
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          available_from?: string | null
          available_until?: string | null
          created_at?: string
          department?: string | null
          grade?: string | null
          id?: string
          notes?: string | null
          resource_id: string
          school_id: string
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          available_from?: string | null
          available_until?: string | null
          created_at?: string
          department?: string | null
          grade?: string | null
          id?: string
          notes?: string | null
          resource_id?: string
          school_id?: string
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_resource_library_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_resource_library_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_resource_library_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_resource_library_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          accommodation_type: string | null
          cluster: string | null
          country_code: string
          county: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          directory_source: string | null
          directory_source_ref: string | null
          gender_type: string | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
          knec_code: string | null
          last_verified_at: string | null
          location_precision: string | null
          name: string
          name_normalized: string | null
          nemis_code: string | null
          ownership_type: string | null
          requires_dual_approval: boolean
          school_category: string | null
          school_type: string | null
          status: Database["public"]["Enums"]["school_status"]
          sub_county: string | null
          subdomain: string
          timezone: string
          updated_at: string
          ward: string | null
        }
        Insert: {
          accommodation_type?: string | null
          cluster?: string | null
          country_code: string
          county?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          directory_source?: string | null
          directory_source_ref?: string | null
          gender_type?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          knec_code?: string | null
          last_verified_at?: string | null
          location_precision?: string | null
          name: string
          name_normalized?: string | null
          nemis_code?: string | null
          ownership_type?: string | null
          requires_dual_approval?: boolean
          school_category?: string | null
          school_type?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          sub_county?: string | null
          subdomain: string
          timezone: string
          updated_at?: string
          ward?: string | null
        }
        Update: {
          accommodation_type?: string | null
          cluster?: string | null
          country_code?: string
          county?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          directory_source?: string | null
          directory_source_ref?: string | null
          gender_type?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          knec_code?: string | null
          last_verified_at?: string | null
          location_precision?: string | null
          name?: string
          name_normalized?: string | null
          nemis_code?: string | null
          ownership_type?: string | null
          requires_dual_approval?: boolean
          school_category?: string | null
          school_type?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          sub_county?: string | null
          subdomain?: string
          timezone?: string
          updated_at?: string
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      security_audit_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          outcome: string
          resource_id: string | null
          resource_type: string | null
          risk_score: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          outcome?: string
          resource_id?: string | null
          resource_type?: string | null
          risk_score?: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          outcome?: string
          resource_id?: string | null
          resource_type?: string | null
          risk_score?: number
        }
        Relationships: []
      }
      student_achievement_awards: {
        Row: {
          achievement_slug: string
          awarded_at: string
          evidence: Json
          id: string
          student_id: string
        }
        Insert: {
          achievement_slug: string
          awarded_at?: string
          evidence?: Json
          id?: string
          student_id: string
        }
        Update: {
          achievement_slug?: string
          awarded_at?: string
          evidence?: Json
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_achievement_awards_achievement_slug_fkey"
            columns: ["achievement_slug"]
            isOneToOne: false
            referencedRelation: "student_achievement_definitions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "student_achievement_awards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_achievement_definitions: {
        Row: {
          description: string
          icon: string
          is_active: boolean
          slug: string
          threshold: number
          title: string
        }
        Insert: {
          description: string
          icon?: string
          is_active?: boolean
          slug: string
          threshold?: number
          title: string
        }
        Update: {
          description?: string
          icon?: string
          is_active?: boolean
          slug?: string
          threshold?: number
          title?: string
        }
        Relationships: []
      }
      student_adaptive_learning_sessions: {
        Row: {
          chosen_pace: string
          completed_at: string | null
          created_at: string
          evidence_count_after: number | null
          evidence_count_before: number
          focus_outcome_id: string | null
          forgetting_risk_after: number | null
          forgetting_risk_before: number | null
          id: string
          mastery_after: number | null
          mastery_before: number | null
          mode: string
          plan: Json
          planned_minutes: number
          profile_id: string
          reason: string
          recommended_pace: string
          reflection: string | null
          started_at: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          chosen_pace: string
          completed_at?: string | null
          created_at?: string
          evidence_count_after?: number | null
          evidence_count_before?: number
          focus_outcome_id?: string | null
          forgetting_risk_after?: number | null
          forgetting_risk_before?: number | null
          id?: string
          mastery_after?: number | null
          mastery_before?: number | null
          mode?: string
          plan?: Json
          planned_minutes: number
          profile_id: string
          reason: string
          recommended_pace: string
          reflection?: string | null
          started_at?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          chosen_pace?: string
          completed_at?: string | null
          created_at?: string
          evidence_count_after?: number | null
          evidence_count_before?: number
          focus_outcome_id?: string | null
          forgetting_risk_after?: number | null
          forgetting_risk_before?: number | null
          id?: string
          mastery_after?: number | null
          mastery_before?: number | null
          mode?: string
          plan?: Json
          planned_minutes?: number
          profile_id?: string
          reason?: string
          recommended_pace?: string
          reflection?: string | null
          started_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_adaptive_learning_sessions_focus_outcome_id_fkey"
            columns: ["focus_outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_adaptive_learning_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_adaptive_learning_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_claim_codes: {
        Row: {
          claimed: boolean
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          expires_at: string
          id: string
          parent_claimed_at: string | null
          parent_claimed_by: string | null
          role: string
          student_claimed_at: string | null
          student_claimed_by: string | null
          student_id: string
        }
        Insert: {
          claimed?: boolean
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          parent_claimed_at?: string | null
          parent_claimed_by?: string | null
          role?: string
          student_claimed_at?: string | null
          student_claimed_by?: string | null
          student_id: string
        }
        Update: {
          claimed?: boolean
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          parent_claimed_at?: string | null
          parent_claimed_by?: string | null
          role?: string
          student_claimed_at?: string | null
          student_claimed_by?: string | null
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
            referencedRelation: "school_directory_public"
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
      student_daily_goals: {
        Row: {
          completed_at: string | null
          completed_points: number
          goal_date: string
          student_id: string
          target_points: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_points?: number
          goal_date: string
          student_id: string
          target_points: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_points?: number
          goal_date?: string
          student_id?: string
          target_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_daily_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_exam_readiness_state: {
        Row: {
          confidence_check: number | null
          created_at: string
          daily_revision_minutes: number
          exam_date: string | null
          exam_name: string
          kcse_candidate_opt_in: boolean
          student_id: string
          updated_at: string
        }
        Insert: {
          confidence_check?: number | null
          created_at?: string
          daily_revision_minutes?: number
          exam_date?: string | null
          exam_name?: string
          kcse_candidate_opt_in?: boolean
          student_id: string
          updated_at?: string
        }
        Update: {
          confidence_check?: number | null
          created_at?: string
          daily_revision_minutes?: number
          exam_date?: string | null
          exam_name?: string
          kcse_candidate_opt_in?: boolean
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_generated_practice_questions: {
        Row: {
          answered_at: string | null
          correct_index: number
          created_at: string
          difficulty: string
          explanation: string
          generation_source: string
          hints: Json
          id: string
          options: Json
          outcome_id: string
          prompt: string
          status: string
          student_id: string
          subject_id: string | null
        }
        Insert: {
          answered_at?: string | null
          correct_index: number
          created_at?: string
          difficulty: string
          explanation: string
          generation_source?: string
          hints?: Json
          id?: string
          options: Json
          outcome_id: string
          prompt: string
          status?: string
          student_id: string
          subject_id?: string | null
        }
        Update: {
          answered_at?: string | null
          correct_index?: number
          created_at?: string
          difficulty?: string
          explanation?: string
          generation_source?: string
          hints?: Json
          id?: string
          options?: Json
          outcome_id?: string
          prompt?: string
          status?: string
          student_id?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_generated_practice_questions_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_generated_practice_questions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_generated_practice_questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_home_state: {
        Row: {
          changes_seen_through: string | null
          created_at: string
          kcse_target_grade: string | null
          last_opened_at: string | null
          preferred_session_minutes: number
          preferred_study_time: string
          student_id: string
          subject_targets: Json
          updated_at: string
          weekly_study_minutes: number
        }
        Insert: {
          changes_seen_through?: string | null
          created_at?: string
          kcse_target_grade?: string | null
          last_opened_at?: string | null
          preferred_session_minutes?: number
          preferred_study_time?: string
          student_id: string
          subject_targets?: Json
          updated_at?: string
          weekly_study_minutes?: number
        }
        Update: {
          changes_seen_through?: string | null
          created_at?: string
          kcse_target_grade?: string | null
          last_opened_at?: string | null
          preferred_session_minutes?: number
          preferred_study_time?: string
          student_id?: string
          subject_targets?: Json
          updated_at?: string
          weekly_study_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_home_state_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_kcse_error_classifications: {
        Row: {
          classified_at: string
          error_type: string
          id: string
          mistake_id: string
          note: string | null
          student_id: string
        }
        Insert: {
          classified_at?: string
          error_type: string
          id?: string
          mistake_id: string
          note?: string | null
          student_id: string
        }
        Update: {
          classified_at?: string
          error_type?: string
          id?: string
          mistake_id?: string
          note?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_kcse_error_classifications_mistake_id_fkey"
            columns: ["mistake_id"]
            isOneToOne: false
            referencedRelation: "student_mistake_notebook"
            referencedColumns: ["id"]
          },
        ]
      }
      student_kcse_mock_answers: {
        Row: {
          is_correct: boolean | null
          max_score: number
          question_id: string
          response_ms: number | null
          response_text: string | null
          saved_at: string
          score: number | null
          selected_index: number | null
          session_id: string
        }
        Insert: {
          is_correct?: boolean | null
          max_score?: number
          question_id: string
          response_ms?: number | null
          response_text?: string | null
          saved_at?: string
          score?: number | null
          selected_index?: number | null
          session_id: string
        }
        Update: {
          is_correct?: boolean | null
          max_score?: number
          question_id?: string
          response_ms?: number | null
          response_text?: string | null
          saved_at?: string
          score?: number | null
          selected_index?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_kcse_mock_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "exam_question_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_kcse_mock_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "student_kcse_mock_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_kcse_mock_sessions: {
        Row: {
          active_client_id: string | null
          created_at: string
          duration_minutes: number
          expires_at: string
          id: string
          last_saved_at: string
          max_score: number | null
          paper_code: string
          percentage: number | null
          question_ids: string[]
          score: number | null
          started_at: string
          status: string
          student_id: string
          subject: string
          submitted_at: string | null
          title: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          active_client_id?: string | null
          created_at?: string
          duration_minutes: number
          expires_at: string
          id?: string
          last_saved_at?: string
          max_score?: number | null
          paper_code: string
          percentage?: number | null
          question_ids?: string[]
          score?: number | null
          started_at?: string
          status?: string
          student_id: string
          subject: string
          submitted_at?: string | null
          title: string
          total_marks: number
          updated_at?: string
        }
        Update: {
          active_client_id?: string | null
          created_at?: string
          duration_minutes?: number
          expires_at?: string
          id?: string
          last_saved_at?: string
          max_score?: number | null
          paper_code?: string
          percentage?: number | null
          question_ids?: string[]
          score?: number | null
          started_at?: string
          status?: string
          student_id?: string
          subject?: string
          submitted_at?: string | null
          title?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: []
      }
      student_kcse_retest_schedule: {
        Row: {
          created_at: string
          due_date: string
          id: string
          interval_days: number
          last_attempt_at: string | null
          last_result: boolean | null
          mastery_state: string
          source_mistake_id: string | null
          student_id: string
          subject: string
          successful_retests: number
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          interval_days?: number
          last_attempt_at?: string | null
          last_result?: boolean | null
          mastery_state?: string
          source_mistake_id?: string | null
          student_id: string
          subject: string
          successful_retests?: number
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          interval_days?: number
          last_attempt_at?: string | null
          last_result?: boolean | null
          mastery_state?: string
          source_mistake_id?: string | null
          student_id?: string
          subject?: string
          successful_retests?: number
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_kcse_retest_schedule_source_mistake_id_fkey"
            columns: ["source_mistake_id"]
            isOneToOne: false
            referencedRelation: "student_mistake_notebook"
            referencedColumns: ["id"]
          },
        ]
      }
      student_kcse_subject_confidence: {
        Row: {
          confidence: number
          student_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          confidence: number
          student_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          student_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_learning_events: {
        Row: {
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          source_id: string
          source_type: string
          student_id: string
          subject_id: string | null
          xp_awarded: number
        }
        Insert: {
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          source_id: string
          source_type: string
          student_id: string
          subject_id?: string | null
          xp_awarded: number
        }
        Update: {
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          source_id?: string
          source_type?: string
          student_id?: string
          subject_id?: string | null
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_learning_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_learning_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_learning_generated_assets: {
        Row: {
          asset_type: string
          created_at: string
          expires_at: string
          generator: string
          id: string
          model: string | null
          payload: Json
          quality: Json
          source_version: string
          status: string
          student_id: string
          transformation_id: string
          updated_at: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          expires_at?: string
          generator: string
          id?: string
          model?: string | null
          payload?: Json
          quality?: Json
          source_version: string
          status?: string
          student_id: string
          transformation_id: string
          updated_at?: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          expires_at?: string
          generator?: string
          id?: string
          model?: string | null
          payload?: Json
          quality?: Json
          source_version?: string
          status?: string
          student_id?: string
          transformation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_learning_generated_assets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_learning_generated_assets_transformation_id_fkey"
            columns: ["transformation_id"]
            isOneToOne: false
            referencedRelation: "student_learning_transformations"
            referencedColumns: ["id"]
          },
        ]
      }
      student_learning_recommendations: {
        Row: {
          confidence_score: number
          created_at: string
          id: string
          next_review_at: string | null
          outcome_id: string | null
          priority_score: number
          reason: string
          recommendation_type: string
          source_snapshot: Json
          status: string
          student_id: string
          subject_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          id?: string
          next_review_at?: string | null
          outcome_id?: string | null
          priority_score?: number
          reason: string
          recommendation_type: string
          source_snapshot?: Json
          status?: string
          student_id: string
          subject_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          id?: string
          next_review_at?: string | null
          outcome_id?: string | null
          priority_score?: number
          reason?: string
          recommendation_type?: string
          source_snapshot?: Json
          status?: string
          student_id?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_learning_recommendations_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_learning_recommendations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_learning_recommendations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_learning_streaks: {
        Row: {
          current_streak: number
          grace_tokens: number
          last_active_date: string | null
          longest_streak: number
          student_id: string
          updated_at: string
        }
        Insert: {
          current_streak?: number
          grace_tokens?: number
          last_active_date?: string | null
          longest_streak?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          current_streak?: number
          grace_tokens?: number
          last_active_date?: string | null
          longest_streak?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_learning_streaks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_learning_timeline: {
        Row: {
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          source_id: string | null
          source_type: string
          student_id: string
          subject_id: string | null
          summary: string | null
          title: string
        }
        Insert: {
          event_type: string
          id?: string
          metadata?: Json
          occurred_at: string
          source_id?: string | null
          source_type: string
          student_id: string
          subject_id?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          source_id?: string | null
          source_type?: string
          student_id?: string
          subject_id?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_learning_timeline_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_learning_timeline_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_learning_transformation_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          student_id: string
          transformation_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          student_id: string
          transformation_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          student_id?: string
          transformation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_learning_transformation_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_learning_transformation_events_transformation_id_fkey"
            columns: ["transformation_id"]
            isOneToOne: false
            referencedRelation: "student_learning_transformations"
            referencedColumns: ["id"]
          },
        ]
      }
      student_learning_transformations: {
        Row: {
          chapter_id: string | null
          created_at: string
          expires_at: string
          generator: string
          id: string
          model: string | null
          payload: Json
          personalization_key: string
          publication_id: string | null
          quality: Json
          representation: string
          source_id: string
          source_type: string
          source_version: string
          student_id: string
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          expires_at?: string
          generator?: string
          id?: string
          model?: string | null
          payload: Json
          personalization_key: string
          publication_id?: string | null
          quality?: Json
          representation: string
          source_id: string
          source_type?: string
          source_version: string
          student_id: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          expires_at?: string
          generator?: string
          id?: string
          model?: string | null
          payload?: Json
          personalization_key?: string
          publication_id?: string | null
          quality?: Json
          representation?: string
          source_id?: string
          source_type?: string
          source_version?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_learning_transformations_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_learning_transformations_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_learning_transformations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_mistake_notebook: {
        Row: {
          correct_index: number | null
          exam_question_id: string | null
          explanation_snapshot: string | null
          first_missed_at: string
          generated_question_id: string | null
          hint_snapshot: string | null
          id: string
          last_correct_at: string | null
          last_missed_at: string
          outcome_id: string | null
          prompt_snapshot: string
          repeat_count: number
          resolved_at: string | null
          selected_index: number | null
          source_block_id: string | null
          source_chapter_id: string | null
          source_publication_id: string | null
          status: string
          student_id: string
          subject: string
          topic: string
        }
        Insert: {
          correct_index?: number | null
          exam_question_id?: string | null
          explanation_snapshot?: string | null
          first_missed_at?: string
          generated_question_id?: string | null
          hint_snapshot?: string | null
          id?: string
          last_correct_at?: string | null
          last_missed_at?: string
          outcome_id?: string | null
          prompt_snapshot: string
          repeat_count?: number
          resolved_at?: string | null
          selected_index?: number | null
          source_block_id?: string | null
          source_chapter_id?: string | null
          source_publication_id?: string | null
          status?: string
          student_id: string
          subject: string
          topic: string
        }
        Update: {
          correct_index?: number | null
          exam_question_id?: string | null
          explanation_snapshot?: string | null
          first_missed_at?: string
          generated_question_id?: string | null
          hint_snapshot?: string | null
          id?: string
          last_correct_at?: string | null
          last_missed_at?: string
          outcome_id?: string | null
          prompt_snapshot?: string
          repeat_count?: number
          resolved_at?: string | null
          selected_index?: number | null
          source_block_id?: string | null
          source_chapter_id?: string | null
          source_publication_id?: string | null
          status?: string
          student_id?: string
          subject?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_mistake_notebook_exam_question_id_fkey"
            columns: ["exam_question_id"]
            isOneToOne: false
            referencedRelation: "exam_question_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_mistake_notebook_generated_question_id_fkey"
            columns: ["generated_question_id"]
            isOneToOne: false
            referencedRelation: "student_generated_practice_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_mistake_notebook_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_mistake_notebook_source_block_id_fkey"
            columns: ["source_block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_mistake_notebook_source_chapter_id_fkey"
            columns: ["source_chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_mistake_notebook_source_publication_id_fkey"
            columns: ["source_publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_mistake_notebook_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_outcome_mastery: {
        Row: {
          evidence_count: number
          id: string
          last_evidence_at: string | null
          mastery_level: string
          mastery_score: number | null
          outcome_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          evidence_count?: number
          id?: string
          last_evidence_at?: string | null
          mastery_level?: string
          mastery_score?: number | null
          outcome_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          evidence_count?: number
          id?: string
          last_evidence_at?: string | null
          mastery_level?: string
          mastery_score?: number | null
          outcome_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_outcome_mastery_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_outcome_mastery_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_practice_attempts: {
        Row: {
          attempted_at: string
          correct_index: number
          difficulty: string | null
          exam_question_id: string
          id: string
          is_correct: boolean
          outcome_id: string | null
          response_ms: number | null
          selected_index: number | null
          session_id: string | null
          source: string
          source_block_id: string | null
          source_chapter_id: string | null
          source_publication_id: string | null
          student_id: string
          subject: string
          topic: string
        }
        Insert: {
          attempted_at?: string
          correct_index: number
          difficulty?: string | null
          exam_question_id: string
          id?: string
          is_correct: boolean
          outcome_id?: string | null
          response_ms?: number | null
          selected_index?: number | null
          session_id?: string | null
          source?: string
          source_block_id?: string | null
          source_chapter_id?: string | null
          source_publication_id?: string | null
          student_id: string
          subject: string
          topic: string
        }
        Update: {
          attempted_at?: string
          correct_index?: number
          difficulty?: string | null
          exam_question_id?: string
          id?: string
          is_correct?: boolean
          outcome_id?: string | null
          response_ms?: number | null
          selected_index?: number | null
          session_id?: string | null
          source?: string
          source_block_id?: string | null
          source_chapter_id?: string | null
          source_publication_id?: string | null
          student_id?: string
          subject?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_practice_attempts_exam_question_id_fkey"
            columns: ["exam_question_id"]
            isOneToOne: false
            referencedRelation: "exam_question_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_attempts_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_attempts_source_block_id_fkey"
            columns: ["source_block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_attempts_source_chapter_id_fkey"
            columns: ["source_chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_attempts_source_publication_id_fkey"
            columns: ["source_publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_revision_plan_items: {
        Row: {
          action_url: string
          activity_type: string
          completed_at: string | null
          created_at: string
          id: string
          plan_date: string
          priority: number
          reason: string
          source: Json
          status: string
          student_id: string
          subject: string
          target_minutes: number
          topic: string
          updated_at: string
        }
        Insert: {
          action_url: string
          activity_type: string
          completed_at?: string | null
          created_at?: string
          id?: string
          plan_date: string
          priority?: number
          reason: string
          source?: Json
          status?: string
          student_id: string
          subject: string
          target_minutes: number
          topic: string
          updated_at?: string
        }
        Update: {
          action_url?: string
          activity_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          plan_date?: string
          priority?: number
          reason?: string
          source?: Json
          status?: string
          student_id?: string
          subject?: string
          target_minutes?: number
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_revision_plan_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subject_progress: {
        Row: {
          average_score: number | null
          completed_tasks: number
          mastery_percentage: number | null
          student_id: string
          subject_id: string
          total_tasks: number
          updated_at: string
        }
        Insert: {
          average_score?: number | null
          completed_tasks?: number
          mastery_percentage?: number | null
          student_id: string
          subject_id: string
          total_tasks?: number
          updated_at?: string
        }
        Update: {
          average_score?: number | null
          completed_tasks?: number
          mastery_percentage?: number | null
          student_id?: string
          subject_id?: string
          total_tasks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subject_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_progress_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_task_execution_receipts: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_saved_at: string | null
          launched_at: string | null
          lifecycle: string
          receipt: Json
          released_at: string | null
          returned_at: string | null
          revision_number: number
          source_id: string
          source_type: string
          student_id: string
          submitted_at: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_saved_at?: string | null
          launched_at?: string | null
          lifecycle: string
          receipt?: Json
          released_at?: string | null
          returned_at?: string | null
          revision_number?: number
          source_id: string
          source_type: string
          student_id: string
          submitted_at?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_saved_at?: string | null
          launched_at?: string | null
          lifecycle?: string
          receipt?: Json
          released_at?: string | null
          returned_at?: string | null
          revision_number?: number
          source_id?: string
          source_type?: string
          student_id?: string
          submitted_at?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_task_execution_receipts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_topic_notes: {
        Row: {
          created_at: string
          id: string
          note_text: string
          student_id: string
          subject: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_text: string
          student_id: string
          subject: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note_text?: string
          student_id?: string
          subject?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_topic_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_twin_calibration_events: {
        Row: {
          absolute_error: number | null
          actual_value: number | null
          confidence_score: number
          created_at: string
          id: string
          metadata: Json
          outcome_id: string | null
          predicted_at: string
          predicted_value: number | null
          prediction_type: string
          resolved_at: string | null
          source_id: string | null
          source_type: string
          student_id: string
          subject_id: string | null
        }
        Insert: {
          absolute_error?: number | null
          actual_value?: number | null
          confidence_score?: number
          created_at?: string
          id?: string
          metadata?: Json
          outcome_id?: string | null
          predicted_at?: string
          predicted_value?: number | null
          prediction_type: string
          resolved_at?: string | null
          source_id?: string | null
          source_type: string
          student_id: string
          subject_id?: string | null
        }
        Update: {
          absolute_error?: number | null
          actual_value?: number | null
          confidence_score?: number
          created_at?: string
          id?: string
          metadata?: Json
          outcome_id?: string | null
          predicted_at?: string
          predicted_value?: number | null
          prediction_type?: string
          resolved_at?: string | null
          source_id?: string | null
          source_type?: string
          student_id?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_twin_calibration_events_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_twin_calibration_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_twin_calibration_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_twin_escalations: {
        Row: {
          acknowledged_at: string | null
          category: string
          class_id: string | null
          created_at: string
          id: string
          resolved_at: string | null
          school_id: string | null
          severity: string
          source: string
          status: string
          student_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          category: string
          class_id?: string | null
          created_at?: string
          id?: string
          resolved_at?: string | null
          school_id?: string | null
          severity: string
          source?: string
          status?: string
          student_id: string
        }
        Update: {
          acknowledged_at?: string | null
          category?: string
          class_id?: string | null
          created_at?: string
          id?: string
          resolved_at?: string | null
          school_id?: string | null
          severity?: string
          source?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_twin_escalations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_twin_escalations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_twin_escalations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_twin_escalations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_twin_intervention_effects: {
        Row: {
          attempts: number
          confidence: number
          created_at: string
          effectiveness_score: number
          id: string
          intervention_key: string
          intervention_type: string
          last_observed_at: string | null
          mean_mastery_delta: number | null
          mean_response_ms: number | null
          metadata: Json
          outcome_id: string | null
          student_id: string
          subject_id: string | null
          successes: number
          updated_at: string
        }
        Insert: {
          attempts?: number
          confidence?: number
          created_at?: string
          effectiveness_score?: number
          id?: string
          intervention_key: string
          intervention_type: string
          last_observed_at?: string | null
          mean_mastery_delta?: number | null
          mean_response_ms?: number | null
          metadata?: Json
          outcome_id?: string | null
          student_id: string
          subject_id?: string | null
          successes?: number
          updated_at?: string
        }
        Update: {
          attempts?: number
          confidence?: number
          created_at?: string
          effectiveness_score?: number
          id?: string
          intervention_key?: string
          intervention_type?: string
          last_observed_at?: string | null
          mean_mastery_delta?: number | null
          mean_response_ms?: number | null
          metadata?: Json
          outcome_id?: string | null
          student_id?: string
          subject_id?: string | null
          successes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_twin_intervention_effects_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_twin_intervention_effects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_twin_intervention_effects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_twin_learning_exposures: {
        Row: {
          created_at: string
          evidence_count_after: number | null
          evidence_count_before: number
          exposed_at: string
          id: string
          intervention_key: string
          intervention_type: string
          mastery_after: number | null
          mastery_before: number | null
          mastery_delta: number | null
          metadata: Json
          outcome_id: string | null
          resolved_at: string | null
          response_ms: number | null
          source_id: string | null
          source_type: string
          student_id: string
          successful: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence_count_after?: number | null
          evidence_count_before?: number
          exposed_at?: string
          id?: string
          intervention_key: string
          intervention_type: string
          mastery_after?: number | null
          mastery_before?: number | null
          mastery_delta?: number | null
          metadata?: Json
          outcome_id?: string | null
          resolved_at?: string | null
          response_ms?: number | null
          source_id?: string | null
          source_type?: string
          student_id: string
          successful?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence_count_after?: number | null
          evidence_count_before?: number
          exposed_at?: string
          id?: string
          intervention_key?: string
          intervention_type?: string
          mastery_after?: number | null
          mastery_before?: number | null
          mastery_delta?: number | null
          metadata?: Json
          outcome_id?: string | null
          resolved_at?: string | null
          response_ms?: number | null
          source_id?: string | null
          source_type?: string
          student_id?: string
          successful?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_twin_learning_exposures_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_twin_learning_exposures_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_twin_memory_claims: {
        Row: {
          claim_key: string
          claim_text: string
          confidence: number
          created_at: string
          evidence_count: number
          expires_at: string | null
          first_observed_at: string
          id: string
          importance: number
          last_confirmed_at: string
          learning_impact: number | null
          memory_scope: string
          memory_type: string
          outcome_id: string | null
          permanence: string
          provenance: Json
          relationship_refs: Json
          source_summary: Json
          status: string
          student_id: string
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          claim_key: string
          claim_text: string
          confidence?: number
          created_at?: string
          evidence_count?: number
          expires_at?: string | null
          first_observed_at?: string
          id?: string
          importance?: number
          last_confirmed_at?: string
          learning_impact?: number | null
          memory_scope?: string
          memory_type: string
          outcome_id?: string | null
          permanence?: string
          provenance?: Json
          relationship_refs?: Json
          source_summary?: Json
          status?: string
          student_id: string
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          claim_key?: string
          claim_text?: string
          confidence?: number
          created_at?: string
          evidence_count?: number
          expires_at?: string | null
          first_observed_at?: string
          id?: string
          importance?: number
          last_confirmed_at?: string
          learning_impact?: number | null
          memory_scope?: string
          memory_type?: string
          outcome_id?: string | null
          permanence?: string
          provenance?: Json
          relationship_refs?: Json
          source_summary?: Json
          status?: string
          student_id?: string
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_twin_memory_claims_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "curriculum_learning_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_twin_memory_claims_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_twin_memory_claims_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_twin_private_items: {
        Row: {
          body: string
          created_at: string
          id: string
          item_type: string
          profile_id: string
          source: Json
          status: string
          subject: string | null
          tags: string[]
          title: string | null
          topic: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          item_type: string
          profile_id: string
          source?: Json
          status?: string
          subject?: string | null
          tags?: string[]
          title?: string | null
          topic?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          item_type?: string
          profile_id?: string
          source?: Json
          status?: string
          subject?: string | null
          tags?: string[]
          title?: string | null
          topic?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_twin_private_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_twin_state_snapshots: {
        Row: {
          confidence_score: number
          evidence_count: number
          generated_at: string
          state: Json
          state_version: number
          student_id: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number
          evidence_count?: number
          generated_at?: string
          state?: Json
          state_version?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number
          evidence_count?: number
          generated_at?: string
          state?: Json
          state_version?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_twin_state_snapshots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
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
          self_use_enabled: boolean
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
          self_use_enabled?: boolean
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
          self_use_enabled?: boolean
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
        ]
      }
      subject_weekly_allocations: {
        Row: {
          band: string
          created_at: string
          grade: string
          id: string
          lessons_per_week: number
          source: string
          subject_label: string
        }
        Insert: {
          band: string
          created_at?: string
          grade: string
          id?: string
          lessons_per_week: number
          source?: string
          subject_label: string
        }
        Update: {
          band?: string
          created_at?: string
          grade?: string
          id?: string
          lessons_per_week?: number
          source?: string
          subject_label?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          global_subject_id: string | null
          id: string
          name: string
          school_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          global_subject_id?: string | null
          id?: string
          name: string
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          global_subject_id?: string | null
          id?: string
          name?: string
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_global_subject_id_fkey"
            columns: ["global_subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_criterion_marks: {
        Row: {
          criterion_id: string
          feedback: string | null
          id: string
          score: number
          submission_mark_id: string
        }
        Insert: {
          criterion_id: string
          feedback?: string | null
          id?: string
          score: number
          submission_mark_id: string
        }
        Update: {
          criterion_id?: string
          feedback?: string | null
          id?: string
          score?: number
          submission_mark_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_criterion_marks_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "assessment_rubric_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_criterion_marks_submission_mark_id_fkey"
            columns: ["submission_mark_id"]
            isOneToOne: false
            referencedRelation: "submission_marks"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_marks: {
        Row: {
          created_at: string
          evidence_id: string
          feedback: string | null
          id: string
          marked_at: string | null
          marker_id: string
          max_score: number
          rubric_id: string | null
          score: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence_id: string
          feedback?: string | null
          id?: string
          marked_at?: string | null
          marker_id: string
          max_score: number
          rubric_id?: string | null
          score: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence_id?: string
          feedback?: string | null
          id?: string
          marked_at?: string | null
          marker_id?: string
          max_score?: number
          rubric_id?: string | null
          score?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_marks_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: true
            referencedRelation: "content_submission_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_marks_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "assessment_rubrics"
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
      teacher_classes: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_class_teacher: boolean
          school_id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_class_teacher?: boolean
          school_id: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_class_teacher?: boolean
          school_id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_teacher_classes_class"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
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
      teacher_resource_adoptions: {
        Row: {
          adopted_at: string
          adoption_status: string
          created_at: string
          id: string
          last_used_at: string | null
          notes: string | null
          preferred_role: string
          resource_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          adopted_at?: string
          adoption_status?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          notes?: string | null
          preferred_role?: string
          resource_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          adopted_at?: string
          adoption_status?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          notes?: string | null
          preferred_role?: string
          resource_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_resource_adoptions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_occurrence_resource_usage: {
        Row: {
          class_id: string
          created_at: string
          id: string
          lesson_plan_id: string
          resource_id: string
          resource_link_id: string
          school_id: string
          subject_id: string
          teacher_id: string
          teaching_occurrence_id: string
          used_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          lesson_plan_id: string
          resource_id: string
          resource_link_id: string
          school_id: string
          subject_id: string
          teacher_id: string
          teaching_occurrence_id: string
          used_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          lesson_plan_id?: string
          resource_id?: string
          resource_link_id?: string
          school_id?: string
          subject_id?: string
          teacher_id?: string
          teaching_occurrence_id?: string
          used_at?: string
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
            foreignKeyName: "teaching_occurrence_resource_usage_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
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
            foreignKeyName: "teaching_occurrence_resource_usage_resource_link_id_fkey"
            columns: ["resource_link_id"]
            isOneToOne: false
            referencedRelation: "teaching_resource_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrence_resource_usage_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
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
            foreignKeyName: "teaching_occurrence_resource_usage_teaching_occurrence_id_fkey"
            columns: ["teaching_occurrence_id"]
            isOneToOne: false
            referencedRelation: "teaching_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_occurrences: {
        Row: {
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
        Insert: {
          cancelled_at?: string | null
          cancelled_reason?: string | null
          class_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          lifecycle?: string
          occurrence_date: string
          recovered_from_id?: string | null
          rescheduled_to_date?: string | null
          rescheduled_to_slot_id?: string | null
          school_id: string
          started_at?: string | null
          started_by?: string | null
          subject_id: string
          teacher_id: string
          timetable_slot_id: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_reason?: string | null
          class_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          lifecycle?: string
          occurrence_date?: string
          recovered_from_id?: string | null
          rescheduled_to_date?: string | null
          rescheduled_to_slot_id?: string | null
          school_id?: string
          started_at?: string | null
          started_by?: string | null
          subject_id?: string
          teacher_id?: string
          timetable_slot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_occurrences_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrences_recovered_from_id_fkey"
            columns: ["recovered_from_id"]
            isOneToOne: false
            referencedRelation: "teaching_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrences_rescheduled_to_slot_id_fkey"
            columns: ["rescheduled_to_slot_id"]
            isOneToOne: false
            referencedRelation: "timetable_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrences_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrences_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrences_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrences_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrences_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_occurrences_timetable_slot_id_fkey"
            columns: ["timetable_slot_id"]
            isOneToOne: false
            referencedRelation: "timetable_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_resource_links: {
        Row: {
          chapter_assignment_id: string | null
          created_at: string
          created_by: string
          exam_id: string | null
          exercise_refs: Json
          homework_id: string | null
          id: string
          lesson_plan_id: string | null
          page_end: number | null
          page_start: number | null
          project_id: string | null
          resource_id: string
          scheme_lesson_id: string | null
          section_refs: Json
          sequence: number
          target_type: string
          updated_at: string
          usage_role: string
        }
        Insert: {
          chapter_assignment_id?: string | null
          created_at?: string
          created_by: string
          exam_id?: string | null
          exercise_refs?: Json
          homework_id?: string | null
          id?: string
          lesson_plan_id?: string | null
          page_end?: number | null
          page_start?: number | null
          project_id?: string | null
          resource_id: string
          scheme_lesson_id?: string | null
          section_refs?: Json
          sequence?: number
          target_type: string
          updated_at?: string
          usage_role: string
        }
        Update: {
          chapter_assignment_id?: string | null
          created_at?: string
          created_by?: string
          exam_id?: string | null
          exercise_refs?: Json
          homework_id?: string | null
          id?: string
          lesson_plan_id?: string | null
          page_end?: number | null
          page_start?: number | null
          project_id?: string | null
          resource_id?: string
          scheme_lesson_id?: string | null
          section_refs?: Json
          sequence?: number
          target_type?: string
          updated_at?: string
          usage_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_resource_links_chapter_assignment_id_fkey"
            columns: ["chapter_assignment_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapter_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_resource_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_resource_links_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_resource_links_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_resource_links_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_resource_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_resource_links_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_resource_links_scheme_lesson_id_fkey"
            columns: ["scheme_lesson_id"]
            isOneToOne: false
            referencedRelation: "scheme_of_work"
            referencedColumns: ["id"]
          },
        ]
      }
      term_weeks: {
        Row: {
          created_at: string
          end_date: string
          id: string
          label: string | null
          school_id: string | null
          start_date: string
          term_id: string
          week_number: number
          week_type: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          label?: string | null
          school_id?: string | null
          start_date: string
          term_id: string
          week_number: number
          week_type?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          label?: string | null
          school_id?: string | null
          start_date?: string
          term_id?: string
          week_number?: number
          week_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "term_weeks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_weeks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_weeks_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
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
          period_id: string | null
          room: string | null
          school_id: string
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
          period_id?: string | null
          room?: string | null
          school_id: string
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
          period_id?: string | null
          room?: string | null
          school_id?: string
          start_time?: string
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_timetable_slots_class"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "school_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
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
        ]
      }
      timetable_snapshots: {
        Row: {
          created_at: string
          id: string
          label: string
          school_id: string
          slots: Json
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          school_id: string
          slots: Json
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          school_id?: string
          slots?: Json
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_snapshots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_snapshots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_snapshots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "tpad_appraisals_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_memory: {
        Row: {
          content: string
          created_at: string
          id: string
          subject: string
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          subject?: string
          type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          subject?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twin_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_profile: {
        Row: {
          last_topic: string
          top_subjects: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          last_topic?: string
          top_subjects?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          last_topic?: string
          top_subjects?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twin_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "vc_participants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
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
            foreignKeyName: "vc_threads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
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
      vibe_chapter_assignments: {
        Row: {
          assigned_at: string
          assignment_type: string
          chapter_id: string
          class_id: string
          created_at: string
          due_at: string | null
          id: string
          instructions: string | null
          opens_at: string | null
          publication_id: string
          resource_id: string
          resource_link_id: string | null
          school_id: string
          status: string
          subject_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assignment_type?: string
          chapter_id: string
          class_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          opens_at?: string | null
          publication_id: string
          resource_id: string
          resource_link_id?: string | null
          school_id: string
          status?: string
          subject_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assignment_type?: string
          chapter_id?: string
          class_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          opens_at?: string | null
          publication_id?: string
          resource_id?: string
          resource_link_id?: string | null
          school_id?: string
          status?: string
          subject_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_chapter_assignments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapter_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapter_assignments_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapter_assignments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapter_assignments_resource_link_id_fkey"
            columns: ["resource_link_id"]
            isOneToOne: false
            referencedRelation: "scheme_lesson_resource_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapter_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
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
            foreignKeyName: "vibe_chapter_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapter_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_chapters: {
        Row: {
          alignment_status: string
          blocks: Json
          cbc_strand: string | null
          content_pack_version: number | null
          created_at: string
          curriculum_content_id: string | null
          curriculum_id: string | null
          id: string
          learning_outcomes: string[]
          number: number
          publication_id: string
          published_at: string | null
          reading_time_min: number
          status: string
          sub_strand_id: string | null
          title: string | null
          updated_at: string
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
          word_count: number
        }
        Insert: {
          alignment_status?: string
          blocks?: Json
          cbc_strand?: string | null
          content_pack_version?: number | null
          created_at?: string
          curriculum_content_id?: string | null
          curriculum_id?: string | null
          id?: string
          learning_outcomes?: string[]
          number?: number
          publication_id: string
          published_at?: string | null
          reading_time_min?: number
          status?: string
          sub_strand_id?: string | null
          title?: string | null
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          word_count?: number
        }
        Update: {
          alignment_status?: string
          blocks?: Json
          cbc_strand?: string | null
          content_pack_version?: number | null
          created_at?: string
          curriculum_content_id?: string | null
          curriculum_id?: string | null
          id?: string
          learning_outcomes?: string[]
          number?: number
          publication_id?: string
          published_at?: string | null
          reading_time_min?: number
          status?: string
          sub_strand_id?: string | null
          title?: string | null
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "vibe_chapters_curriculum_content_id_fkey"
            columns: ["curriculum_content_id"]
            isOneToOne: false
            referencedRelation: "curriculum_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapters_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapters_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapters_sub_strand_id_fkey"
            columns: ["sub_strand_id"]
            isOneToOne: false
            referencedRelation: "cbc_strands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_chapters_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          mpesa_amount_kes: number | null
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
          mpesa_amount_kes?: number | null
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
          mpesa_amount_kes?: number | null
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
        ]
      }
      vibe_publication_views: {
        Row: {
          id: string
          publication_id: string
          viewed_at: string
          viewer_id: string | null
        }
        Insert: {
          id?: string
          publication_id: string
          viewed_at?: string
          viewer_id?: string | null
        }
        Update: {
          id?: string
          publication_id?: string
          viewed_at?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vibe_publication_views_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
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
          chapter_count: number
          cover_url: string | null
          created_at: string
          curriculum_framework: string
          description: string | null
          earnings_ksh: number | null
          format: string
          genre: string | null
          id: string
          issue_number: string | null
          language: string | null
          pricing: Json | null
          publication_name: string | null
          published_at: string | null
          series_name: string | null
          series_number: number | null
          status: string
          subtitle: string | null
          tags: string[] | null
          title: string
          total_reads: number | null
          total_vibes: number | null
          updated_at: string
        }
        Insert: {
          author_id: string
          cbc_aligned?: boolean | null
          cbc_grade?: string | null
          cbc_subject?: string | null
          chapter_count?: number
          cover_url?: string | null
          created_at?: string
          curriculum_framework?: string
          description?: string | null
          earnings_ksh?: number | null
          format: string
          genre?: string | null
          id?: string
          issue_number?: string | null
          language?: string | null
          pricing?: Json | null
          publication_name?: string | null
          published_at?: string | null
          series_name?: string | null
          series_number?: number | null
          status?: string
          subtitle?: string | null
          tags?: string[] | null
          title?: string
          total_reads?: number | null
          total_vibes?: number | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          cbc_aligned?: boolean | null
          cbc_grade?: string | null
          cbc_subject?: string | null
          chapter_count?: number
          cover_url?: string | null
          created_at?: string
          curriculum_framework?: string
          description?: string | null
          earnings_ksh?: number | null
          format?: string
          genre?: string | null
          id?: string
          issue_number?: string | null
          language?: string | null
          pricing?: Json | null
          publication_name?: string | null
          published_at?: string | null
          series_name?: string | null
          series_number?: number | null
          status?: string
          subtitle?: string | null
          tags?: string[] | null
          title?: string
          total_reads?: number | null
          total_vibes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      vibe_reading_progress: {
        Row: {
          chapter_id: string
          completed_at: string | null
          created_at: string
          id: string
          last_read_at: string
          progress_percent: number
          publication_id: string
          reading_position: Json | null
          started_at: string
          updated_at: string
          viewer_id: string
        }
        Insert: {
          chapter_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          last_read_at?: string
          progress_percent?: number
          publication_id: string
          reading_position?: Json | null
          started_at?: string
          updated_at?: string
          viewer_id: string
        }
        Update: {
          chapter_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          last_read_at?: string
          progress_percent?: number
          publication_id?: string
          reading_position?: Json | null
          started_at?: string
          updated_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_reading_progress_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_reading_progress_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_reading_progress_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_reading_sessions: {
        Row: {
          active_seconds: number
          chapter_id: string
          client_session_id: string
          completed_at: string | null
          created_at: string
          end_reason: string | null
          ended_at: string | null
          id: string
          last_active_at: string
          max_progress_percent: number
          publication_id: string
          started_at: string
          updated_at: string
          viewer_id: string
        }
        Insert: {
          active_seconds?: number
          chapter_id: string
          client_session_id: string
          completed_at?: string | null
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          last_active_at?: string
          max_progress_percent?: number
          publication_id: string
          started_at?: string
          updated_at?: string
          viewer_id: string
        }
        Update: {
          active_seconds?: number
          chapter_id?: string
          client_session_id?: string
          completed_at?: string | null
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          last_active_at?: string
          max_progress_percent?: number
          publication_id?: string
          started_at?: string
          updated_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_reading_sessions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_reading_sessions_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_reading_sessions_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_workspace_items: {
        Row: {
          chapter_id: string | null
          created_at: string
          id: string
          item_type: string
          payload: Json
          publication_id: string | null
          updated_at: string
          viewer_id: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          id?: string
          item_type: string
          payload?: Json
          publication_id?: string | null
          updated_at?: string
          viewer_id: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          id?: string
          item_type?: string
          payload?: Json
          publication_id?: string | null
          updated_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_workspace_items_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "vibe_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_workspace_items_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_workspace_items_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          url: string | null
          vibe_count: number | null
          vibe_publication_id: string | null
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
          url?: string | null
          vibe_count?: number | null
          vibe_publication_id?: string | null
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
          url?: string | null
          vibe_count?: number | null
          vibe_publication_id?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vibelearn_content_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "vibelearn_content_vibe_publication_id_fkey"
            columns: ["vibe_publication_id"]
            isOneToOne: false
            referencedRelation: "vibe_publications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      content_engine_operational_health: {
        Row: {
          completed_runs: number | null
          enabled_watch_targets: number | null
          last_completed_run: string | null
          learning_events: number | null
          open_health_signals: number | null
          open_proposals: number | null
          pending_actions: number | null
          pending_effectiveness_reviews: number | null
          reading_sessions: number | null
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
      hq_workforce_worker_performance: {
        Row: {
          completed_runs: number | null
          decision_required_runs: number | null
          execution_certified_count: number | null
          failed_runs: number | null
          outcome_verification_rate: number | null
          outcome_verified_count: number | null
          status: string | null
          title: string | null
          total_runs: number | null
          worker_id: string | null
          worker_key: string | null
        }
        Relationships: []
      }
      lesson_evidence_resource_lineage: {
        Row: {
          created_at: string | null
          evidence_title: string | null
          evidence_type: string | null
          lesson_evidence_id: string | null
          lesson_plan_id: string | null
          resource_id: string | null
          resource_title: string | null
          source_type: string | null
          teacher_id: string | null
          teaching_occurrence_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_evidence_lesson_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_resource_usage_lesson_evidence_id_fkey"
            columns: ["lesson_evidence_id"]
            isOneToOne: false
            referencedRelation: "lesson_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_resource_usage_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_resource_usage_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_resource_usage_teaching_occurrence_id_fkey"
            columns: ["teaching_occurrence_id"]
            isOneToOne: false
            referencedRelation: "teaching_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_students: {
        Row: {
          created_at: string | null
          id: string | null
          is_primary: boolean | null
          parent_id: string | null
          relationship: string | null
          school_id: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_primary?: boolean | null
          parent_id?: string | null
          relationship?: string | null
          school_id?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_primary?: boolean | null
          parent_id?: string | null
          relationship?: string | null
          school_id?: string | null
          student_id?: string | null
          updated_at?: string | null
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
            foreignKeyName: "parent_student_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory_public"
            referencedColumns: ["id"]
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
      school_directory_public: {
        Row: {
          accommodation_type: string | null
          county: string | null
          gender_type: string | null
          gps_lat: number | null
          gps_lng: number | null
          id: string | null
          knec_code: string | null
          levels: string[] | null
          name: string | null
          nemis_code: string | null
          ownership_type: string | null
          school_category: string | null
          school_type: string | null
          sub_county: string | null
          ward: string | null
        }
        Insert: {
          accommodation_type?: string | null
          county?: string | null
          gender_type?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string | null
          knec_code?: string | null
          levels?: never
          name?: string | null
          nemis_code?: string | null
          ownership_type?: string | null
          school_category?: string | null
          school_type?: string | null
          sub_county?: string | null
          ward?: string | null
        }
        Update: {
          accommodation_type?: string | null
          county?: string | null
          gender_type?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string | null
          knec_code?: string | null
          levels?: never
          name?: string | null
          nemis_code?: string | null
          ownership_type?: string | null
          school_category?: string | null
          school_type?: string | null
          sub_county?: string | null
          ward?: string | null
        }
        Relationships: []
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
            referencedRelation: "school_directory_public"
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
            referencedRelation: "school_directory_public"
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
      admin_get_classroom_learning_health: {
        Args: { p_school_id: string }
        Returns: Json
      }
      admin_reconcile_vibelearn_textbook_index: {
        Args: { p_publication_id: string }
        Returns: {
          content_id: string
          operation: string
        }[]
      }
      approve_school_admin_join_request: {
        Args: { p_request_id: string; p_review_note?: string }
        Returns: undefined
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
      ce_assign_assessment_to_class: {
        Args: {
          p_assessment_id: string
          p_closes_at?: string
          p_time_limit_minutes?: number
        }
        Returns: Json
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
      ce_create_generated_assessment_from_payload: {
        Args: {
          p_assessment_type: string
          p_chapter_id: string
          p_questions: Json
          p_title: string
        }
        Returns: Json
      }
      ce_create_homework_from_payload: {
        Args: {
          p_chapter_id: string
          p_class_id: string
          p_due_date: string
          p_instructions: string
          p_questions: Json
          p_title: string
        }
        Returns: Json
      }
      ce_create_project_from_payload: {
        Args: {
          p_chapter_id: string
          p_class_id: string
          p_description: string
          p_due_date: string
          p_title: string
        }
        Returns: Json
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
      ce_get_teacher_derivation_context: {
        Args: { p_chapter_id: string }
        Returns: Json
      }
      ce_promote_generated_assessment: {
        Args: { p_class_id: string; p_generated_assessment_id: string }
        Returns: Json
      }
      ce_publish_parent_learning_summary: {
        Args: { p_summary_id: string }
        Returns: undefined
      }
      ce_reconcile_chapter_content_blocks: {
        Args: { p_chapter_id: string }
        Returns: number
      }
      ce_reconcile_ebook_index_internal: {
        Args: { p_publication_id: string }
        Returns: {
          content_id: string
          operation: string
        }[]
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
      ce_run_publication_release_check: {
        Args: { p_publication_id: string }
        Returns: {
          check_code: string
          details: Json
          score: number
          status: string
        }[]
      }
      ce_save_content_derivative: {
        Args: {
          p_audience?: string
          p_body: Json
          p_chapter_id: string
          p_class_id?: string
          p_derivative_type: string
          p_generator?: string
          p_model?: string
          p_quality?: Json
          p_title: string
        }
        Returns: Json
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
      connect_teacher_to_directory_school: {
        Args: { p_directory_id: string; p_level?: string }
        Returns: string
      }
      connect_teacher_to_school: {
        Args: { p_level?: string; p_school_id: string }
        Returns: string
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
      create_school_with_admin: {
        Args: {
          p_county?: string
          p_full_name: string
          p_knec_code?: string
          p_lat?: number
          p_lng?: number
          p_nemis_code?: string
          p_school_name: string
          p_sub_county?: string
          p_subdomain: string
          p_user_id: string
          p_ward?: string
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
      duplicate_active_timetable: {
        Args: { p_effective_from: string }
        Returns: number
      }
      enqueue_unresearched_proposals: { Args: never; Returns: number }
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
      fn_notify_signup_provisioning_failures: {
        Args: never
        Returns: undefined
      }
      funhub_get_student_id: { Args: never; Returns: string }
      generate_daily_occurrences: {
        Args: { p_date?: string }
        Returns: {
          generated: number
          marked_missed: number
        }[]
      }
      generate_term_weeks: { Args: { p_term_id: string }; Returns: undefined }
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
      get_my_onboarding_state: { Args: never; Returns: Json }
      get_my_role: { Args: never; Returns: string }
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
      get_public_vibetextbook_reader: {
        Args: { publication_id_input: string }
        Returns: Json
      }
      get_public_vibetextbook_reader_raw: {
        Args: { publication_id_input: string }
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
      get_vibetextbook_reader_raw: {
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
      has_entitlement: { Args: { p_entitlement_key: string }; Returns: boolean }
      hq_ack_policy: {
        Args: {
          p_policy_key: string
          p_product_key: string
          p_stage?: string
          p_value: Json
        }
        Returns: undefined
      }
      hq_activate_due_decisions: { Args: never; Returns: number }
      hq_activate_worker: {
        Args: { p_worker_id: string }
        Returns: {
          created_at: string
          definition: Json
          department_key: string
          execution_order: string[]
          id: string
          manager_worker_id: string | null
          mission: string
          paid_ai_allowed: boolean
          status: string
          template_key: string | null
          title: string
          updated_at: string
          version: number
          worker_key: string
        }
        SetofOptions: {
          from: "*"
          to: "hq_workers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hq_add_curriculum_outcome: {
        Args: {
          p_bloom_level?: string
          p_curriculum_id: string
          p_outcome_text: string
        }
        Returns: string
      }
      hq_apply_approved_chapter_revision: {
        Args: { p_derivative_id: string; p_reason?: string }
        Returns: Json
      }
      hq_apply_curriculum_intelligence_proposal: {
        Args: { p_proposal_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          chapter_id: string | null
          claim: string | null
          confidence: number
          created_at: string
          current_content: string | null
          curriculum_id: string | null
          curriculum_relevance: string
          derivative_impacts: Json
          editorial_model: string | null
          editorial_patch: Json | null
          editorial_prepared_at: string | null
          editorial_status: string
          engine_run_id: string | null
          generated_at: string
          generated_by: string
          id: string
          outcome_id: string | null
          patch: Json
          proposal_type: string
          proposed_content: string
          publication_id: string | null
          rationale: string
          research_fingerprint: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
          verification_status: string
          volatility: string
          watch_target_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "curriculum_intelligence_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hq_approve_decision: { Args: { p_id: string }; Returns: undefined }
      hq_approve_work_item: { Args: { p_id: string }; Returns: undefined }
      hq_approve_worker_activation: {
        Args: { p_worker_id: string }
        Returns: boolean
      }
      hq_assert_owner: { Args: never; Returns: undefined }
      hq_assert_product_enabled: {
        Args: { p_policy_key: string; p_product_key: string }
        Returns: Json
      }
      hq_billing_overview: { Args: { p_limit?: number }; Returns: Json }
      hq_cancel_decision: {
        Args: { p_id: string; p_reason?: string }
        Returns: undefined
      }
      hq_certify_product_policy: {
        Args: { p_expected: Json; p_policy_key: string; p_product_key: string }
        Returns: Json
      }
      hq_claim_next_editorial_action: {
        Args: { p_action_id?: string }
        Returns: {
          action_type: string
          attempt_count: number
          chapter_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          health_signal_id: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string | null
          output: Json
          priority: number
          proposal_id: string | null
          publication_id: string | null
          rationale: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "curriculum_editorial_actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hq_claim_worker_message: {
        Args: { p_worker_id: string }
        Returns: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          from_worker_id: string
          id: string
          message_type: string
          payload: Json
          priority: string
          status: string
          to_worker_id: string
          work_item_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "hq_worker_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hq_complete_emergency_recovery: {
        Args: {
          p_decision_id: string
          p_incident_id: string
          p_reason?: string
        }
        Returns: Json
      }
      hq_context_capture_company_snapshot: {
        Args: {
          p_actor_key?: string
          p_actor_type?: string
          p_decision_key: string
          p_decision_type: string
          p_reason: string
        }
        Returns: string
      }
      hq_context_resolve: {
        Args: { p_fact_keys?: string[]; p_scope_id: string }
        Returns: {
          computed_at: string
          confidence: number
          fact_definition_id: string
          fact_key: string
          freshness_expires_at: string
          is_fresh: boolean
          value: Json
        }[]
      }
      hq_context_scope_allows: {
        Args: { p_fact_key: string; p_scope_id: string }
        Returns: boolean
      }
      hq_create_amendment: {
        Args: {
          p_effective_at?: string
          p_old_id: string
          p_reason?: string
          p_rule_value?: Json
          p_title?: string
        }
        Returns: string
      }
      hq_create_assessment_question: {
        Args: {
          p_bloom_level?: string
          p_correct_answer?: string
          p_curriculum_id: string
          p_difficulty?: string
          p_explanation?: string
          p_marks?: number
          p_question_text: string
          p_question_type?: string
        }
        Returns: string
      }
      hq_create_decision: {
        Args: {
          p_affected_products: string[]
          p_category: string
          p_decision_type: string
          p_effective_at?: string
          p_reason: string
          p_rule_key: string
          p_rule_value: Json
          p_title: string
        }
        Returns: string
      }
      hq_create_work_item: {
        Args: {
          p_approval_required?: boolean
          p_department: string
          p_due_at?: string
          p_evidence?: Json
          p_priority?: string
          p_route?: string
          p_summary?: string
          p_title: string
        }
        Returns: string
      }
      hq_data_api_product_gate: { Args: never; Returns: undefined }
      hq_decide_moderation_item: {
        Args: {
          p_decision: string
          p_id: string
          p_reason?: string
          p_source: string
        }
        Returns: undefined
      }
      hq_effectiveness_decision: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      hq_emergency_control: {
        Args: {
          p_policy_key: string
          p_product_key: string
          p_reason: string
          p_value: Json
        }
        Returns: Json
      }
      hq_emit_event: {
        Args: {
          p_actor_id: string
          p_actor_role: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_metadata?: Json
          p_school_id: string
        }
        Returns: string
      }
      hq_enqueue_curriculum_intelligence_regeneration: {
        Args: { p_proposal_id: string }
        Returns: number
      }
      hq_evaluate_editorial_effectiveness: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      hq_evaluate_policy: {
        Args: { p_context?: Json; p_policy_key: string; p_product_key: string }
        Returns: Json
      }
      hq_fail_editorial_action: {
        Args: { p_action_id: string; p_error: string }
        Returns: {
          action_type: string
          attempt_count: number
          chapter_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          health_signal_id: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string | null
          output: Json
          priority: number
          proposal_id: string | null
          publication_id: string | null
          rationale: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "curriculum_editorial_actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hq_generate_operational_alerts: { Args: never; Returns: number }
      hq_get_control_health: { Args: never; Returns: Json }
      hq_get_decision_detail: { Args: { p_id: string }; Returns: Json }
      hq_get_goal_progress: { Args: never; Returns: Json }
      hq_get_morning_brief: { Args: never; Returns: Json }
      hq_get_org_summary: { Args: never; Returns: Json }
      hq_get_product_config: {
        Args: { p_config_key: string; p_product_key: string }
        Returns: Json
      }
      hq_get_product_controls: { Args: never; Returns: Json }
      hq_get_snapshot: { Args: never; Returns: Json }
      hq_get_work_health: { Args: never; Returns: Json }
      hq_list_academy_catalog: { Args: never; Returns: Json }
      hq_list_assessment_bank: {
        Args: { p_limit?: number }
        Returns: {
          bloom_level: string
          curriculum_id: string
          difficulty: string
          id: string
          learning_outcome_id: string
          marks: number
          question_text: string
          question_type: string
          review_status: string
          status: string
          updated_at: string
          usage_count: number
        }[]
      }
      hq_list_content_domains: {
        Args: never
        Returns: {
          active: boolean
          created_at: string
          description: string | null
          icon: string | null
          key: string
          name: string
          sort_order: number
          tags: string[]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "hq_content_domains"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      hq_list_curriculum_imports: {
        Args: { p_limit?: number }
        Returns: {
          authority_name: string
          created_at: string
          created_by: string
          curriculum_name: string
          grade: string
          id: string
          source_ref: string
          source_type: string
          source_url: string
          status: string
          subject: string
          updated_at: string
          verified_at: string
          verified_by: string
          version_label: string
        }[]
      }
      hq_list_curriculum_rows: {
        Args: { p_limit?: number }
        Returns: {
          curriculum: string
          grade: string
          id: string
          lesson_context: Json
          periods: number
          reference: string
          strand: string
          sub_strand: string
          subject: string
          term: number
          topic: string
          week: number
        }[]
      }
      hq_list_decisions: {
        Args: { p_limit?: number }
        Returns: {
          affected_products: string[]
          approved_at: string | null
          approved_by: string | null
          category: string
          code: string
          created_at: string
          created_by: string
          decision_type: string
          effective_at: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          reason: string | null
          rollback_of_id: string | null
          rule_key: string | null
          rule_value: Json
          status: string
          supersedes_id: string | null
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "hq_decisions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      hq_list_departments: {
        Args: never
        Returns: {
          critical_count: number
          icon: string
          key: string
          mandate: string
          name: string
          open_count: number
          waiting_approval_count: number
        }[]
      }
      hq_list_funhub_vouchers: {
        Args: { p_include_inactive?: boolean }
        Returns: {
          category: string
          claimed_count: number
          created_at: string
          description: string
          id: string
          is_active: boolean
          remaining: number
          sponsor_name: string
          title: string
          total_pool: number
          xp_cost: number
        }[]
      }
      hq_list_moderation_queue: { Args: { p_limit?: number }; Returns: Json }
      hq_list_notifications: {
        Args: { p_limit?: number }
        Returns: {
          body: string
          category: string
          created_at: string
          id: string
          metadata: Json
          route: string
          severity: string
          status: string
          title: string
        }[]
      }
      hq_list_publication_revisions: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          created_by: string
          id: string
          publication_format: string
          publication_id: string
          publication_title: string
          reason: string
          revision_number: number
        }[]
      }
      hq_list_school_identity_queue: {
        Args: { p_limit?: number; p_status?: string }
        Returns: Json
      }
      hq_list_work_items: {
        Args: { p_department?: string; p_limit?: number }
        Returns: {
          acted_at: string | null
          action_taken: Json
          approval_required: boolean
          created_at: string
          department_key: string
          due_at: string | null
          evidence: Json
          id: string
          owner_id: string | null
          priority: string
          resolved_at: string | null
          route: string | null
          source_id: string | null
          source_type: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          verification_evidence: Json
          verification_status: string
          work_type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "hq_work_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      hq_lock_decision: { Args: { p_id: string }; Returns: undefined }
      hq_mark_curriculum_watch_checked: {
        Args: { p_checked_at?: string; p_watch_target_id: string }
        Returns: undefined
      }
      hq_mark_decision_reviewed: { Args: { p_id: string }; Returns: undefined }
      hq_mark_notification_read: { Args: { p_id: string }; Returns: boolean }
      hq_marketing_overview: { Args: never; Returns: Json }
      hq_metric_catalog: { Args: never; Returns: Json }
      hq_next_decision_code: { Args: never; Returns: string }
      hq_observe_policy: {
        Args: { p_observed: Json; p_policy_key: string; p_product_key: string }
        Returns: Json
      }
      hq_open_incident: {
        Args: {
          p_evidence?: Json
          p_incident_type: string
          p_route?: string
          p_severity: string
          p_summary: string
          p_title: string
        }
        Returns: string
      }
      hq_promote_health_signal_to_action: {
        Args: { p_signal_id: string }
        Returns: {
          action_type: string
          attempt_count: number
          chapter_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          health_signal_id: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string | null
          output: Json
          priority: number
          proposal_id: string | null
          publication_id: string | null
          rationale: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "curriculum_editorial_actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hq_publish_policy_state: {
        Args: { p_decision_id: string }
        Returns: undefined
      }
      hq_refresh_content_health_signals: {
        Args: { p_publication_id?: string }
        Returns: Json
      }
      hq_refresh_teacher_workaround_signals: {
        Args: { p_publication_id?: string }
        Returns: Json
      }
      hq_register_curriculum_source: {
        Args: {
          p_authority_name: string
          p_curriculum_name: string
          p_grade: string
          p_notes?: string
          p_source_ref?: string
          p_source_url?: string
          p_subject: string
          p_version_label?: string
        }
        Returns: string
      }
      hq_requeue_editorial_action: {
        Args: { p_action_id: string }
        Returns: {
          action_type: string
          attempt_count: number
          chapter_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          health_signal_id: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string | null
          output: Json
          priority: number
          proposal_id: string | null
          publication_id: string | null
          rationale: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "curriculum_editorial_actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hq_resolve_incident: {
        Args: { p_id: string; p_reason?: string }
        Returns: undefined
      }
      hq_resolve_notification: { Args: { p_id: string }; Returns: boolean }
      hq_resolve_school_discovery_request: {
        Args: {
          p_action: string
          p_alias?: string
          p_canonical_school_id?: string
          p_note?: string
          p_request_id: string
          p_school_name?: string
        }
        Returns: string
      }
      hq_review_assessment_question: {
        Args: { p_question_id: string; p_review_status: string }
        Returns: undefined
      }
      hq_review_chapter_revision: {
        Args: { p_approve: boolean; p_derivative_id: string; p_note?: string }
        Returns: Json
      }
      hq_review_curriculum_import: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      hq_review_generated_assessment: {
        Args: { p_approve: boolean; p_assessment_id: string; p_note?: string }
        Returns: Json
      }
      hq_review_school_identity_candidate: {
        Args: {
          p_action: string
          p_alias?: string
          p_candidate_id: string
          p_canonical_school_id?: string
          p_note?: string
        }
        Returns: string
      }
      hq_review_teacher_guide: {
        Args: { p_approve: boolean; p_derivative_id: string; p_note?: string }
        Returns: Json
      }
      hq_review_vibelab_spec: {
        Args: { p_approve: boolean; p_derivative_id: string; p_note?: string }
        Returns: Json
      }
      hq_rollback_decision: {
        Args: { p_id: string; p_reason?: string }
        Returns: string
      }
      hq_route_work_items: { Args: never; Returns: number }
      hq_run_company_intelligence: { Args: never; Returns: Json }
      hq_run_publication_release_check: {
        Args: { p_publication_id: string }
        Returns: {
          check_code: string
          details: Json
          score: number
          status: string
        }[]
      }
      hq_security_events: { Args: { p_limit?: number }; Returns: Json }
      hq_set_product_policy: {
        Args: {
          p_policy_key: string
          p_product_key: string
          p_reason: string
          p_value: Json
        }
        Returns: Json
      }
      hq_studio_overview: { Args: never; Returns: Json }
      hq_sync_content_engine_work: {
        Args: { p_publication_id?: string }
        Returns: Json
      }
      hq_system_health: { Args: never; Returns: Json }
      hq_update_curriculum_row: {
        Args: {
          p_common_mistakes?: string
          p_id: string
          p_periods?: number
          p_reference?: string
          p_teaching_tips?: string
          p_topic?: string
        }
        Returns: undefined
      }
      hq_update_draft_decision: {
        Args: {
          p_affected_products: string[]
          p_category: string
          p_decision_type: string
          p_effective_at?: string
          p_id: string
          p_reason: string
          p_rule_key: string
          p_rule_value: Json
          p_title: string
        }
        Returns: undefined
      }
      hq_update_work_item: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      hq_upsert_academy_course: {
        Args: {
          p_badge?: string
          p_description?: string
          p_domain?: string
          p_duration_label?: string
          p_id?: string
          p_institution?: string
          p_level?: string
          p_slug?: string
          p_status?: string
          p_title?: string
          p_weeks_count?: number
        }
        Returns: string
      }
      hq_upsert_academy_module: {
        Args: {
          p_course_id?: string
          p_id?: string
          p_sequence_number?: number
          p_slug?: string
          p_title?: string
          p_weeks_label?: string
        }
        Returns: string
      }
      hq_upsert_academy_topic: {
        Args: {
          p_clinical_tip?: string
          p_common_errors?: string
          p_concept?: string
          p_content_status?: string
          p_id?: string
          p_kenya_context?: string
          p_module_id?: string
          p_sequence_number?: number
          p_slug?: string
          p_subtitle?: string
          p_title?: string
          p_week_number?: number
        }
        Returns: string
      }
      hq_upsert_content_domain: {
        Args: {
          p_active?: boolean
          p_description?: string
          p_icon?: string
          p_key: string
          p_name: string
          p_sort_order?: number
          p_tags?: string[]
        }
        Returns: string
      }
      hq_upsert_funhub_voucher: {
        Args: {
          p_category?: string
          p_description?: string
          p_id?: string
          p_is_active?: boolean
          p_sponsor_name?: string
          p_title?: string
          p_total_pool?: number
          p_xp_cost?: number
        }
        Returns: string
      }
      hq_user_directory: {
        Args: {
          p_limit?: number
          p_role?: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      hq_validate_policy_value: {
        Args: { p_policy_key: string; p_product_key: string; p_value: Json }
        Returns: undefined
      }
      hq_verify_decision_propagation: { Args: { p_id: string }; Returns: Json }
      hq_workforce_assert_capability: {
        Args: {
          p_capability_key: string
          p_operation: string
          p_resource_type: string
          p_worker_key: string
        }
        Returns: string
      }
      hq_workforce_assert_certification: {
        Args: { p_worker_key: string }
        Returns: string
      }
      hq_workforce_assert_identity: {
        Args: { p_worker_key: string }
        Returns: string
      }
      hq_workforce_assert_runtime_task_authorized: {
        Args: { p_task_id: string }
        Returns: Json
      }
      hq_workforce_authoritative_demand_metrics: {
        Args: { p_gap_id: string; p_template_id: string }
        Returns: Json
      }
      hq_workforce_authorize_fact: {
        Args: { p_fact_key: string; p_worker_key: string }
        Returns: {
          scope_id: string
          status: string
          violation_code: string
        }[]
      }
      hq_workforce_authorize_model_call: {
        Args: {
          p_failure_evidence: Json
          p_model_key: string
          p_reason_code: string
          p_task_id: string
          p_token_budget: number
          p_worker_key: string
        }
        Returns: string
      }
      hq_workforce_authorize_skill_target: {
        Args: {
          p_skill_key: string
          p_target_fact_key: string
          p_worker_key: string
        }
        Returns: {
          status: string
          violation_code: string
        }[]
      }
      hq_workforce_authorize_snapshot: {
        Args: { p_snapshot_id: string; p_worker_key: string }
        Returns: {
          status: string
          violation_code: string
        }[]
      }
      hq_workforce_autonomous_factory_heartbeat: {
        Args: { p_limit?: number }
        Returns: Json
      }
      hq_workforce_autonomous_heartbeat: {
        Args: { p_limit?: number }
        Returns: Json
      }
      hq_workforce_bootstrap_reference_operations_worker: {
        Args: { p_worker_key?: string }
        Returns: Json
      }
      hq_workforce_build_decision_inbox: { Args: never; Returns: number }
      hq_workforce_capture_founder_decision: {
        Args: {
          p_corrected?: Json
          p_decision_id: string
          p_event_type: string
          p_proposed: Json
          p_rejection_reason?: string
          p_revision: number
          p_run_id: string
          p_snapshot_id: string
        }
        Returns: Json
      }
      hq_workforce_certify_probation_workers: { Args: never; Returns: number }
      hq_workforce_consume_budget: {
        Args: { p_amount: number; p_budget_id: string }
        Returns: undefined
      }
      hq_workforce_context_health: {
        Args: { p_fact_id: string; p_high_stakes?: boolean }
        Returns: {
          status: string
          violation_code: string
        }[]
      }
      hq_workforce_current_lifecycle_state: {
        Args: { p_worker_key: string }
        Returns: string
      }
      hq_workforce_decide: {
        Args: { p_action: string; p_id: string; p_revision?: string }
        Returns: Json
      }
      hq_workforce_detect_operations_tasks: {
        Args: { p_limit?: number }
        Returns: number
      }
      hq_workforce_detect_reference_operations_tasks: {
        Args: { p_limit?: number; p_worker_key?: string }
        Returns: number
      }
      hq_workforce_diagnose_gap: { Args: { p_gap_id: string }; Returns: string }
      hq_workforce_enqueue_unrouted_work: { Args: never; Returns: number }
      hq_workforce_evaluate_candidate_gaps: { Args: never; Returns: number }
      hq_workforce_execute_safe_queue: { Args: never; Returns: number }
      hq_workforce_execute_shadow_tool: {
        Args: { p_input: Json; p_tool_contract_id: string }
        Returns: Json
      }
      hq_workforce_execute_task_queue: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: number
      }
      hq_workforce_factory_create_shadow_worker: {
        Args: {
          p_capability_key: string
          p_demand_evidence_id: string
          p_diagnosis_id: string
          p_mission: string
          p_operation: string
          p_resource_type: string
          p_scope_ref?: Json
          p_scope_type?: string
          p_title: string
          p_worker_key: string
        }
        Returns: Json
      }
      hq_workforce_factory_cycle: {
        Args: {
          p_capability_key?: string
          p_gap_id: string
          p_metrics: Json
          p_mission: string
          p_operation?: string
          p_resource_type?: string
          p_title: string
          p_worker_key: string
        }
        Returns: Json
      }
      hq_workforce_factory_diagnose: {
        Args: { p_demand_evidence_id: string }
        Returns: string
      }
      hq_workforce_finalize_model_call: {
        Args: { p_invocation_id: string; p_success: boolean }
        Returns: string
      }
      hq_workforce_finalize_skill_probation: {
        Args: {
          p_evidence: Json
          p_execution_passed: boolean
          p_outcome_verified: boolean
          p_promotion_id: string
        }
        Returns: string
      }
      hq_workforce_get_control_room_snapshot: {
        Args: { p_recent_limit?: number }
        Returns: Json
      }
      hq_workforce_issue_certification: {
        Args: {
          p_creation_contract_id: string
          p_required?: number
          p_valid_for?: string
          p_verifier_key: string
          p_worker_key: string
        }
        Returns: string
      }
      hq_workforce_lane_for_work: {
        Args: {
          p_department: string
          p_source_type: string
          p_work_type: string
        }
        Returns: string
      }
      hq_workforce_list_decisions: {
        Args: { p_limit?: number; p_status?: string }
        Returns: {
          created_at: string
          decision_key: string
          evidence_snapshot_id: string
          id: string
          job_key: string
          lane_key: string
          proposed_action: string
          reason: string
          revision: string
          risk: string
          run_id: string
          status: string
          worker_key: string
        }[]
      }
      hq_workforce_monitor_health: { Args: never; Returns: number }
      hq_workforce_observe_demand_sensors: { Args: never; Returns: Json }
      hq_workforce_owner_review_shadow_decision: {
        Args: { p_decision_id: string; p_rationale?: string; p_state: string }
        Returns: {
          authority_reason: string
          created_at: string
          decision_key: string
          human_rationale: string | null
          hypothetical_authority_result: string
          id: string
          proposed_action: Json
          required_authority: Json
          reviewed_at: string | null
          reviewed_by: string | null
          state: string
          trace_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "hq_workforce_shadow_decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hq_workforce_plan_recovery: {
        Args: {
          p_before?: Json
          p_reason: string
          p_run_id: string
          p_type: string
        }
        Returns: string
      }
      hq_workforce_prepare_handoff: {
        Args: {
          p_from_lane: string
          p_handoff_key: string
          p_reason: string
          p_requested_fact_keys: string[]
          p_to_lane: string
          p_work_item_id: string
        }
        Returns: string
      }
      hq_workforce_prepare_skill_promotion: {
        Args: { p_candidate_id: string; p_skill_key: string }
        Returns: string
      }
      hq_workforce_probation_state: {
        Args: {
          p_allowed_failures?: number
          p_failures: number
          p_lowest_confidence: number
          p_min_confidence?: number
          p_min_runs?: number
          p_unverified_outcomes: number
          p_verified_runs: number
        }
        Returns: string
      }
      hq_workforce_qualification_state: {
        Args: {
          p_count: number
          p_has_contradiction: boolean
          p_high_severity: boolean
          p_min?: number
          p_stale: boolean
        }
        Returns: string
      }
      hq_workforce_qualify_factory_workers: {
        Args: { p_limit?: number }
        Returns: Json
      }
      hq_workforce_quantified_diagnosis: {
        Args: { p_gap_id: string; p_metrics: Json }
        Returns: string
      }
      hq_workforce_record_positive_outcome: {
        Args: { p_evidence: Json; p_evidence_id: string; p_status: string }
        Returns: string
      }
      hq_workforce_record_shadow_run: {
        Args: {
          p_expected: Json
          p_input: Json
          p_observed: Json
          p_tool_contract_id: string
          p_verifier_key: string
          p_worker_key: string
        }
        Returns: string
      }
      hq_workforce_record_skill_benchmark: {
        Args: { p_evidence: Json; p_passed: boolean; p_promotion_id: string }
        Returns: string
      }
      hq_workforce_release_budget: {
        Args: { p_amount: number; p_budget_id: string }
        Returns: undefined
      }
      hq_workforce_reserve_budget: {
        Args: { p_amount: number; p_budget_key: string; p_worker_key: string }
        Returns: string
      }
      hq_workforce_revoke_certification: {
        Args: { p_reason: string; p_worker_key: string }
        Returns: number
      }
      hq_workforce_revoke_identity: {
        Args: { p_reason: string; p_worker_key: string }
        Returns: number
      }
      hq_workforce_run_shadow_cycle: {
        Args: { p_cycle_key: string; p_limit?: number }
        Returns: Json
      }
      hq_workforce_scheduled_factory_heartbeat: { Args: never; Returns: Json }
      hq_workforce_scheduled_heartbeat: { Args: never; Returns: Json }
      hq_workforce_seal_demand_evidence: {
        Args: { p_gap_id: string; p_metrics: Json }
        Returns: string
      }
      hq_workforce_shadow_candidate_fingerprint: {
        Args: {
          p_work_item: Database["public"]["Tables"]["hq_work_items"]["Row"]
        }
        Returns: string
      }
      hq_workforce_shadow_evaluate_authority: {
        Args: {
          p_requested_autonomy: number
          p_requested_risk: number
          p_scope_ref: Json
          p_scope_type: string
          p_skill_manifest_id: string
          p_trace_id: string
        }
        Returns: Json
      }
      hq_workforce_shadow_recommend_candidate: {
        Args: { p_candidate_id: string }
        Returns: Json
      }
      hq_workforce_shadow_review_decision: {
        Args: { p_decision_id: string; p_rationale?: string; p_state: string }
        Returns: {
          authority_reason: string
          created_at: string
          decision_key: string
          human_rationale: string | null
          hypothetical_authority_result: string
          id: string
          proposed_action: Json
          required_authority: Json
          reviewed_at: string | null
          reviewed_by: string | null
          state: string
          trace_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "hq_workforce_shadow_decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hq_workforce_skill_certifiable: {
        Args: { p_skill_id: string }
        Returns: boolean
      }
      hq_workforce_suspend_for_remediation: {
        Args: {
          p_creation_contract_id: string
          p_reason: string
          p_worker_key: string
        }
        Returns: string
      }
      hq_workforce_test_context_health: {
        Args: {
          p_fact_confidence: number
          p_fresh: boolean
          p_high_stakes?: boolean
          p_malformed: boolean
          p_source_active: boolean
          p_source_reliability: number
        }
        Returns: {
          status: string
          violation_code: string
        }[]
      }
      hq_workforce_tool_gateway_execute: {
        Args: { p_task_id: string }
        Returns: Json
      }
      hq_workforce_transition_worker: {
        Args: {
          p_creation_contract_id?: string
          p_reason: string
          p_to_state: string
          p_worker_key: string
        }
        Returns: string
      }
      hq_workforce_verify_run: {
        Args: {
          p_actual: Json
          p_evidence: Json
          p_execution_certified: boolean
          p_expected: Json
          p_method: string
          p_run_id: string
          p_verifier_ref?: string
        }
        Returns: string
      }
      hq_workforce_verify_task: {
        Args: { p_task_id: string; p_verifier_key: string }
        Returns: string
      }
      hq_workroom_act: {
        Args: { p_action: string; p_reason: string; p_work_item_id: string }
        Returns: Json
      }
      hq_workroom_add_link: {
        Args: {
          p_label: string
          p_link_type: string
          p_metadata?: Json
          p_url: string
          p_work_item_id: string
        }
        Returns: string
      }
      hq_workroom_add_update: {
        Args: {
          p_body: string
          p_metadata?: Json
          p_update_type: string
          p_work_item_id: string
        }
        Returns: string
      }
      hq_workroom_get_item: { Args: { p_id: string }; Returns: Json }
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
      is_platform_owner: { Args: never; Returns: boolean }
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
      parent_get_classroom_learning_brief: { Args: never; Returns: Json }
      parent_get_student_kcse_brief: {
        Args: { p_student_id: string }
        Returns: Json
      }
      parent_set_student_self_use: {
        Args: { p_enabled: boolean; p_student_id: string }
        Returns: boolean
      }
      publish_publication: {
        Args: { p_publication_id: string }
        Returns: {
          operation: string
          publication_id: string
        }[]
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
      reader_sanitize_blocks: { Args: { p_blocks: Json }; Returns: Json }
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
      record_content_learning_event: {
        Args: {
          p_chapter_id: string
          p_content_block_id: string
          p_duration_ms?: number
          p_event_type: string
          p_metadata?: Json
          p_outcome_id: string
          p_publication_id: string
        }
        Returns: string
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
      record_security_event: {
        Args: {
          p_event_type: string
          p_metadata?: Json
          p_outcome?: string
          p_resource_id?: string
          p_resource_type?: string
          p_risk_score?: number
        }
        Returns: undefined
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
      refresh_reading_health_signals: { Args: never; Returns: number }
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
      restore_timetable_snapshot: {
        Args: { p_effective_from: string; p_snapshot_id: string }
        Returns: number
      }
      run_connected_content_engine: {
        Args: { p_publication_id: string; p_trigger?: string }
        Returns: string
      }
      run_content_intelligence_cycle: {
        Args: { p_trigger?: string }
        Returns: string
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
      school_search_rate_guard: {
        Args: { p_fingerprint?: string }
        Returns: boolean
      }
      search_school_directory: {
        Args: {
          p_county?: string
          p_lat?: number
          p_level?: string
          p_limit?: number
          p_lng?: number
          p_query?: string
          p_sub_county?: string
        }
        Returns: {
          accommodation_type: string
          cluster: string
          county: string
          distance_km: number
          gender_type: string
          gps_lat: number
          gps_lng: number
          id: string
          knec_code: string
          levels: string[]
          match_score: number
          name: string
          nemis_code: string
          ownership_type: string
          school_category: string
          school_type: string
          source: string
          sub_county: string
          ward: string
        }[]
      }
      seed_default_school_periods: { Args: never; Returns: number }
      settle_mpesa_credit: {
        Args: {
          p_checkout_id: string
          p_mpesa_ref: string
          p_paid_amount_kes: number
        }
        Returns: Json
      }
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
      student_answer_adaptive_practice_question: {
        Args: {
          p_question_id: string
          p_response_ms?: number
          p_selected_index: number
        }
        Returns: Json
      }
      student_apply_verified_completion: {
        Args: {
          p_occurred_at?: string
          p_source_id: string
          p_source_type: string
          p_student_id: string
          p_subject_id?: string
        }
        Returns: string
      }
      student_classify_kcse_mistake: {
        Args: { p_error_type: string; p_mistake_id: string; p_note?: string }
        Returns: Json
      }
      student_complete_adaptive_session: {
        Args: { p_reflection?: string; p_session_id: string }
        Returns: Json
      }
      student_create_kcse_mock: {
        Args: { p_client_id?: string; p_paper_code: string; p_subject: string }
        Returns: Json
      }
      student_create_twin_escalation: {
        Args: { p_category: string; p_severity: string }
        Returns: string
      }
      student_explain_twin_choice: {
        Args: { p_outcome_id?: string }
        Returns: Json
      }
      student_generate_adaptive_practice_question: {
        Args: { p_outcome_id?: string }
        Returns: Json
      }
      student_generate_adaptive_revision_plan_v1: {
        Args: { p_days?: number; p_start_date?: string }
        Returns: Json
      }
      student_generate_kcse_revision_plan: {
        Args: { p_days?: number; p_start_date?: string }
        Returns: Json
      }
      student_generate_revision_plan: {
        Args: { p_days?: number; p_start_date?: string }
        Returns: Json
      }
      student_get_adaptive_intervention: {
        Args: { p_outcome_id: string }
        Returns: Json
      }
      student_get_adaptive_learning_path: { Args: never; Returns: Json }
      student_get_adaptive_project_coach: {
        Args: { p_project_title?: string }
        Returns: Json
      }
      student_get_adaptive_reading_coach: { Args: never; Returns: Json }
      student_get_adaptive_reflection_coach: {
        Args: { p_outcome_id?: string }
        Returns: Json
      }
      student_get_adaptive_teaching_turn:
        | { Args: { p_outcome_id: string; p_stage?: number }; Returns: Json }
        | {
            Args: {
              p_learner_reply: string
              p_outcome_id: string
              p_stage: number
            }
            Returns: Json
          }
      student_get_adaptive_tutor_service_summary: { Args: never; Returns: Json }
      student_get_cached_learning_source_transformation: {
        Args: {
          p_representation: string
          p_source_id: string
          p_source_type: string
        }
        Returns: Json
      }
      student_get_cached_learning_transformation: {
        Args: { p_chapter_id: string; p_representation: string }
        Returns: Json
      }
      student_get_evidence_learning_preferences: { Args: never; Returns: Json }
      student_get_exam_readiness_brief: { Args: never; Returns: Json }
      student_get_grounded_chapter_practice: {
        Args: {
          p_chapter_id: string
          p_limit?: number
          p_publication_id: string
        }
        Returns: Json
      }
      student_get_home_os_brief: { Args: never; Returns: Json }
      student_get_kcse_adaptive_practice: {
        Args: { p_limit?: number; p_subject?: string; p_topic?: string }
        Returns: Json
      }
      student_get_kcse_candidate_os: { Args: never; Returns: Json }
      student_get_kcse_mastery_map: { Args: never; Returns: Json }
      student_get_kcse_mock: { Args: { p_session_id: string }; Returns: Json }
      student_get_kcse_progress_history: { Args: never; Returns: Json }
      student_get_kcse_recall_drill: {
        Args: { p_asset_type?: string; p_limit?: number; p_subject?: string }
        Returns: Json
      }
      student_get_kcse_report_card_evidence: { Args: never; Returns: Json }
      student_get_kcse_verified_grade_projection: { Args: never; Returns: Json }
      student_get_learning_companion_snapshot: { Args: never; Returns: Json }
      student_get_learning_generated_assets: {
        Args: { p_transformation_id: string }
        Returns: Json
      }
      student_get_learning_source_context: {
        Args: { p_source_id: string; p_source_type: string }
        Returns: Json
      }
      student_get_learning_transform_context: {
        Args: { p_chapter_id: string }
        Returns: Json
      }
      student_get_multimodal_teaching_sequence: {
        Args: { p_source_id: string; p_source_type: string }
        Returns: Json
      }
      student_get_prerequisite_status: {
        Args: { p_outcome_id: string }
        Returns: Json
      }
      student_get_revision_workspace: {
        Args: { p_subject?: string; p_topic?: string }
        Returns: Json
      }
      student_get_teacher_sync_context: { Args: never; Returns: Json }
      student_get_twin_brain: { Args: never; Returns: Json }
      student_get_twin_brain_cached: { Args: never; Returns: Json }
      student_get_twin_evidence: { Args: never; Returns: Json }
      student_get_twin_learning: { Args: never; Returns: Json }
      student_get_twin_mastery: { Args: never; Returns: Json }
      student_get_twin_memory: { Args: never; Returns: Json }
      student_get_twin_prediction: { Args: never; Returns: Json }
      student_get_twin_priority: { Args: never; Returns: Json }
      student_get_twin_school_context: { Args: never; Returns: Json }
      student_get_twin_state: { Args: never; Returns: Json }
      student_get_twin_state_internal: { Args: never; Returns: Json }
      student_get_twin_tutor_context: { Args: never; Returns: Json }
      student_get_twin_tutor_context_internal: { Args: never; Returns: Json }
      student_get_vibelearn_workstation: { Args: never; Returns: Json }
      student_list_learning_transform_sources: {
        Args: { p_limit?: number }
        Returns: Json
      }
      student_list_my_tasks: { Args: never; Returns: Json }
      student_mark_home_opened: { Args: never; Returns: Json }
      student_mastery_band: { Args: { p_score: number }; Returns: string }
      student_plan_adaptive_session: {
        Args: { p_mode?: string; p_pace_override?: string }
        Returns: Json
      }
      student_recommend_learning_representation: {
        Args: { p_source_id: string; p_source_type: string }
        Returns: Json
      }
      student_record_adaptive_misconception: {
        Args: {
          p_correct_index: number
          p_outcome_id: string
          p_question_id: string
          p_selected_index: number
          p_subject_id: string
        }
        Returns: Json
      }
      student_record_grounded_practice_answer: {
        Args: {
          p_content_block_id: string
          p_response_ms?: number
          p_response_text: string
          p_session_id?: string
        }
        Returns: Json
      }
      student_record_learning_transformation_event: {
        Args: {
          p_event_type: string
          p_metadata?: Json
          p_transformation_id: string
        }
        Returns: Json
      }
      student_record_twin_calibration: {
        Args: {
          p_actual_value: number
          p_confidence_score: number
          p_metadata?: Json
          p_outcome_id?: string
          p_predicted_value: number
          p_prediction_type: string
          p_source_id?: string
          p_source_type?: string
          p_subject_id?: string
        }
        Returns: Json
      }
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
      student_refresh_twin_memory: { Args: never; Returns: Json }
      student_resolve_mistake: { Args: { p_mistake_id: string }; Returns: Json }
      student_resolve_task_launch: {
        Args: { p_task_id: string }
        Returns: Json
      }
      student_resolve_vibelearn_assessment_source: {
        Args: { p_chapter_id: string; p_publication_id: string }
        Returns: Json
      }
      student_save_kcse_mock_answer: {
        Args: {
          p_client_id?: string
          p_question_id: string
          p_response_ms?: number
          p_response_text?: string
          p_selected_index: number
          p_session_id: string
        }
        Returns: Json
      }
      student_save_topic_note: {
        Args: { p_note_text: string; p_subject: string; p_topic: string }
        Returns: Json
      }
      student_schedule_forgetting_revision: { Args: never; Returns: number }
      student_search_kcse: { Args: { p_query: string }; Returns: Json }
      student_start_adaptive_session: {
        Args: { p_session_id: string }
        Returns: Json
      }
      student_store_learning_source_transformation: {
        Args: {
          p_model?: string
          p_payload: Json
          p_personalization_key: string
          p_quality?: Json
          p_representation: string
          p_source_id: string
          p_source_type: string
          p_source_version: string
        }
        Returns: Json
      }
      student_store_learning_transformation: {
        Args: {
          p_chapter_id: string
          p_model?: string
          p_payload: Json
          p_personalization_key: string
          p_quality?: Json
          p_representation: string
          p_source_version: string
        }
        Returns: Json
      }
      student_submit_kcse_mock: {
        Args: { p_client_id?: string; p_session_id: string }
        Returns: Json
      }
      student_sync_task_execution_receipt: {
        Args: { p_task_id: string }
        Returns: Json
      }
      student_twin_core_route: { Args: { p_input: string }; Returns: Json }
      student_twin_save_private_item: {
        Args: {
          p_body: string
          p_item_type: string
          p_subject?: string
          p_tags?: string[]
          p_title?: string
          p_topic?: string
          p_visibility?: string
        }
        Returns: Json
      }
      student_twin_search_private_space: {
        Args: { p_limit?: number; p_query?: string }
        Returns: Json
      }
      student_twin_search_school_records: {
        Args: { p_limit?: number; p_query?: string }
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
      student_update_kcse_profile:
        | {
            Args: {
              p_confidence_check: number
              p_daily_revision_minutes: number
              p_exam_date: string
              p_subject_confidence?: Json
            }
            Returns: Json
          }
        | {
            Args: {
              p_confidence_check: number
              p_daily_revision_minutes: number
              p_exam_date: string
              p_kcse_candidate_opt_in: boolean
              p_subject_confidence: Json
            }
            Returns: Json
          }
      student_update_revision_item_status: {
        Args: { p_item_id: string; p_status: string }
        Returns: Json
      }
      student_upsert_learning_generated_asset: {
        Args: {
          p_asset_type: string
          p_generator?: string
          p_model?: string
          p_payload: Json
          p_quality?: Json
          p_status?: string
          p_transformation_id: string
        }
        Returns: Json
      }
      submit_school_discovery_request: {
        Args: {
          p_alternative_name?: string
          p_contact_name?: string
          p_contact_phone?: string
          p_county?: string
          p_lat?: number
          p_level?: string
          p_lng?: number
          p_name: string
          p_notes?: string
          p_school_code?: string
          p_sub_county?: string
          p_ward?: string
        }
        Returns: string
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
      teacher_generate_shared_claim_code: {
        Args: { p_student_id: string }
        Returns: Json
      }
      teacher_get_student_kcse_brief: {
        Args: { p_student_id: string }
        Returns: Json
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
      twin_record_learning_representation_exposure: {
        Args: {
          p_metadata?: Json
          p_outcome_id: string
          p_representation: string
          p_student_id: string
          p_transformation_id: string
        }
        Returns: Json
      }
      twin_record_verified_calibration: {
        Args: {
          p_actual_value: number
          p_confidence_score: number
          p_metadata?: Json
          p_outcome_id?: string
          p_predicted_value: number
          p_prediction_type: string
          p_source_id?: string
          p_source_type?: string
          p_student_id: string
          p_subject_id?: string
        }
        Returns: string
      }
      twin_record_verified_practice_effect: {
        Args: {
          p_intervention_key: string
          p_intervention_type: string
          p_metadata?: Json
          p_outcome_id: string
          p_profile_id: string
          p_response_ms?: number
          p_success: boolean
        }
        Returns: undefined
      }
      twin_resolve_learning_exposures: {
        Args: { p_outcome_id?: string; p_student_id: string }
        Returns: number
      }
      twin_resolve_learning_representation_outcome: {
        Args: { p_context?: Json; p_student_id: string }
        Returns: string
      }
      unlink_learning_resource: { Args: { p_link_id: string }; Returns: Json }
      unpublish_publication: {
        Args: { p_publication_id: string }
        Returns: {
          operation: string
          publication_id: string
        }[]
      }
      unpublish_textbook: {
        Args: { p_publication_id: string }
        Returns: {
          content_id: string
          operation: string
        }[]
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
  public: {
    Enums: {
      account_status: ["active", "restricted", "suspended", "anonymized"],
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


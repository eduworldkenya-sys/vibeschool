import type { Database, Json } from './database.types'

/**
 * Live-schema additions and contract corrections that are present in production
 * but not yet represented accurately by the checked-in generated snapshot.
 *
 * This is deliberately explicit: it is a typed contract, not an `any` escape
 * hatch. The next generated-types refresh should absorb these differences into
 * database.types.ts and this compatibility layer can then be removed.
 */
type GeneratedPublic = Database['public']
type GeneratedTables = GeneratedPublic['Tables']
type GeneratedFunctions = GeneratedPublic['Functions']

type CurrentStudents = GeneratedTables['students']
type CurrentClaimCodes = GeneratedTables['student_claim_codes']
type CurrentFunctions = Omit<GeneratedFunctions, 'create_child_for_parent'> & {
  create_child_for_parent: {
    Args: {
      p_name: string
      p_dob: string
      p_class_id: string | null
    }
    Returns: string
  }
  parent_set_student_self_use: {
    Args: {
      p_enabled: boolean
      p_student_id: string
    }
    Returns: Json
  }
  teacher_generate_shared_claim_code: {
    Args: {
      p_student_id: string
    }
    Returns: Json
  }
}

type CurrentTables = GeneratedTables & {
  students: CurrentStudents & {
    Row: CurrentStudents['Row'] & {
      self_use_enabled: boolean
    }
    Insert: CurrentStudents['Insert'] & {
      self_use_enabled?: boolean
    }
    Update: CurrentStudents['Update'] & {
      self_use_enabled?: boolean
    }
  }
  student_claim_codes: CurrentClaimCodes & {
    Row: CurrentClaimCodes['Row'] & {
      parent_claimed_at: string | null
      parent_claimed_by: string | null
      student_claimed_at: string | null
      student_claimed_by: string | null
    }
    Insert: CurrentClaimCodes['Insert'] & {
      parent_claimed_at?: string | null
      parent_claimed_by?: string | null
      student_claimed_at?: string | null
      student_claimed_by?: string | null
    }
    Update: CurrentClaimCodes['Update'] & {
      parent_claimed_at?: string | null
      parent_claimed_by?: string | null
      student_claimed_at?: string | null
      student_claimed_by?: string | null
    }
  }
}

export type CurrentDatabase = Omit<Database, 'public'> & {
  public: Omit<GeneratedPublic, 'Tables' | 'Functions'> & {
    Tables: CurrentTables
    Functions: CurrentFunctions
  }
}

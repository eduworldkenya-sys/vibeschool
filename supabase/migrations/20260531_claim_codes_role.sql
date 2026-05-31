-- Add role column to student_claim_codes
ALTER TABLE student_claim_codes ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

-- Add index for role-based queries
CREATE INDEX IF NOT EXISTS idx_student_claim_codes_role ON student_claim_codes(student_id, role, claimed);

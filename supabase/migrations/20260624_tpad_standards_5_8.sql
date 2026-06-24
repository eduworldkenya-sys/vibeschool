-- Add TSC TPAD Standards 5–8 to tpad_appraisals
-- Real TSC performance standards per Kenya TPAD form

ALTER TABLE tpad_appraisals
  ADD COLUMN IF NOT EXISTS standard_5_self integer CHECK (standard_5_self BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS standard_6_self integer CHECK (standard_6_self BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS standard_7_self integer CHECK (standard_7_self BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS standard_8_self integer CHECK (standard_8_self BETWEEN 1 AND 5);

COMMENT ON COLUMN tpad_appraisals.standard_5_self IS 'Extra-Curricular Activities';
COMMENT ON COLUMN tpad_appraisals.standard_6_self IS 'Professional Development';
COMMENT ON COLUMN tpad_appraisals.standard_7_self IS 'Community Involvement';
COMMENT ON COLUMN tpad_appraisals.standard_8_self IS 'Innovative Teaching';

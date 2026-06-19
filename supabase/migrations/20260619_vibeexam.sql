-- VibeExam Supabase Migration — vibeschool.co.ke/exam
-- Run in Supabase SQL Editor → yauqsxggtuxuykcbrtzf

DO $$ BEGIN CREATE TYPE exam_subject AS ENUM ('Mathematics','English','Biology','Chemistry','History','Physics','Geography','Kiswahili','CRE','Business Studies'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE exam_form AS ENUM ('Form 1','Form 2','Form 3','Form 4'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE exam_difficulty AS ENUM ('easy','medium','hard'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS exam_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_token      text,
  subject         exam_subject    NOT NULL,
  form            exam_form       NOT NULL,
  topic           text            NOT NULL,
  difficulty      exam_difficulty NOT NULL,
  total_questions int             NOT NULL CHECK (total_questions BETWEEN 5 AND 30),
  score           int             NOT NULL DEFAULT 0,
  percentage      int             NOT NULL DEFAULT 0,
  knec_grade      text            NOT NULL DEFAULT 'E',
  started_at      timestamptz     NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  created_at      timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exam_sessions_user_id_idx ON exam_sessions(user_id);
CREATE INDEX IF NOT EXISTS exam_sessions_anon_idx    ON exam_sessions(anon_token) WHERE anon_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS exam_sessions_subject_idx ON exam_sessions(subject, form, topic);

CREATE TABLE IF NOT EXISTS exam_question_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid REFERENCES exam_sessions(id) ON DELETE CASCADE NOT NULL,
  question_index  int  NOT NULL,
  question_text   text NOT NULL,
  correct_index   int  NOT NULL,
  selected_index  int,
  is_correct      boolean NOT NULL DEFAULT false,
  time_spent_secs int     NOT NULL DEFAULT 0,
  topic           text    NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exam_question_log_session_idx ON exam_question_log(session_id);

CREATE TABLE IF NOT EXISTS exam_flags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid REFERENCES exam_sessions(id) ON DELETE SET NULL,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  question_text text NOT NULL,
  flag_type     text NOT NULL CHECK (flag_type IN ('error','contest','other')),
  reason        text,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exam_flags_status_idx ON exam_flags(status);

CREATE TABLE IF NOT EXISTS exam_streaks (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak   int  NOT NULL DEFAULT 0,
  longest_streak   int  NOT NULL DEFAULT 0,
  last_active_date date NOT NULL DEFAULT CURRENT_DATE,
  total_exams      int  NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exam_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_question_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_flags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_streaks       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exam_sessions_select ON exam_sessions;
CREATE POLICY exam_sessions_select ON exam_sessions FOR SELECT USING (auth.uid() = user_id OR (user_id IS NULL AND anon_token IS NOT NULL));
DROP POLICY IF EXISTS exam_sessions_insert ON exam_sessions;
CREATE POLICY exam_sessions_insert ON exam_sessions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS exam_sessions_update ON exam_sessions;
CREATE POLICY exam_sessions_update ON exam_sessions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS exam_question_log_select ON exam_question_log;
CREATE POLICY exam_question_log_select ON exam_question_log FOR SELECT USING (session_id IN (SELECT id FROM exam_sessions WHERE auth.uid() = user_id));

DROP POLICY IF EXISTS exam_flags_insert ON exam_flags;
CREATE POLICY exam_flags_insert ON exam_flags FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS exam_streaks_select ON exam_streaks;
CREATE POLICY exam_streaks_select ON exam_streaks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS exam_streaks_upsert ON exam_streaks;
CREATE POLICY exam_streaks_upsert ON exam_streaks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_exam_streak(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_streak  exam_streaks%ROWTYPE;
  v_today   date := CURRENT_DATE;
BEGIN
  SELECT * INTO v_streak FROM exam_streaks WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO exam_streaks(user_id,current_streak,longest_streak,last_active_date,total_exams) VALUES(p_user_id,1,1,v_today,1); RETURN;
  END IF;
  IF v_streak.last_active_date = v_today THEN
    UPDATE exam_streaks SET total_exams=total_exams+1,updated_at=now() WHERE user_id=p_user_id; RETURN;
  END IF;
  IF v_streak.last_active_date = v_today-INTERVAL'1 day' THEN
    UPDATE exam_streaks SET current_streak=current_streak+1,longest_streak=GREATEST(longest_streak,current_streak+1),last_active_date=v_today,total_exams=total_exams+1,updated_at=now() WHERE user_id=p_user_id; RETURN;
  END IF;
  UPDATE exam_streaks SET current_streak=1,last_active_date=v_today,total_exams=total_exams+1,updated_at=now() WHERE user_id=p_user_id;
END; $$;

CREATE OR REPLACE VIEW exam_topic_analytics AS
SELECT subject,form,topic,difficulty,COUNT(*) AS total_attempts,ROUND(AVG(percentage)) AS avg_percentage,ROUND(AVG(CASE WHEN knec_grade IN ('A','A-') THEN 1.0 ELSE 0.0 END)*100) AS pass_rate_pct,MAX(completed_at) AS last_attempt_at
FROM exam_sessions WHERE completed_at IS NOT NULL GROUP BY subject,form,topic,difficulty;

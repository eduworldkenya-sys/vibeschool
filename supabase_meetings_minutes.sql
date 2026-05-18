-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id  uuid REFERENCES meetings(id) ON DELETE CASCADE,
  content     text,
  status      text CHECK (status IN ('draft','review','approved','distributed')) DEFAULT 'draft',
  drafted_by  uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- RLS on all meeting tables
ALTER TABLE meetings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_actions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_minutes      ENABLE ROW LEVEL SECURITY;

-- meetings: school members only
CREATE POLICY "school_meetings" ON meetings FOR ALL
  USING (school_id IN (
    SELECT school_id FROM profiles WHERE id = auth.uid()
  ));

-- agenda items: via parent meeting
CREATE POLICY "school_agenda_items" ON meeting_agenda_items FOR ALL
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE school_id IN (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- attendees: via parent meeting
CREATE POLICY "school_attendees" ON meeting_attendees FOR ALL
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE school_id IN (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- actions: via parent meeting
CREATE POLICY "school_actions" ON meeting_actions FOR ALL
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE school_id IN (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- minutes: via parent meeting
CREATE POLICY "school_minutes" ON meeting_minutes FOR ALL
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE school_id IN (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- Storage bucket (run separately in Supabase dashboard > Storage > New bucket)
-- Name: meeting-files
-- Public: false

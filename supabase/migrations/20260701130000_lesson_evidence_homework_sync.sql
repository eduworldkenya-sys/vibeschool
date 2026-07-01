-- 1. lesson_id becomes optional — homework evidence may not resolve to a lesson
alter table lesson_evidence alter column lesson_id drop not null;

-- 2. Link evidence back to its source homework + submission
alter table lesson_evidence add column if not exists homework_id uuid references homework(id) on delete set null;
alter table lesson_evidence add column if not exists submission_id uuid references homework_submissions(id) on delete cascade;
alter table lesson_evidence add constraint lesson_evidence_submission_id_key unique (submission_id);

-- 3. Intervention gets a real lifecycle
alter table lesson_interventions add column if not exists status text not null default 'open'
  check (status in ('open','in_progress','resolved'));

-- 4. The sync: grading a homework submission auto-logs it as evidence
create or replace function sync_homework_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id   uuid;
  v_teacher_id uuid;
  v_subject    text;
  v_title      text;
  v_lesson_id  uuid;
begin
  if NEW.status = 'marked' and (OLD.status is distinct from 'marked') then
    select class_id, teacher_id, subject, title
      into v_class_id, v_teacher_id, v_subject, v_title
      from homework where id = NEW.homework_id;

    select lp.id into v_lesson_id
      from lesson_plans lp
      join subjects s on s.id = lp.subject_id
      where lp.class_id = v_class_id and s.name = v_subject
      order by lp.created_at desc
      limit 1;

    insert into lesson_evidence (
      lesson_id, class_id, teacher_id, student_id,
      evidence_type, title, description, media_url, score,
      submission_id, homework_id
    ) values (
      v_lesson_id, v_class_id, v_teacher_id, NEW.student_id,
      'homework', v_title, NEW.feedback, NEW.photo_url, NEW.mark,
      NEW.id, NEW.homework_id
    )
    on conflict (submission_id) do update set
      score       = excluded.score,
      description = excluded.description,
      media_url   = excluded.media_url,
      lesson_id   = excluded.lesson_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_homework_evidence on homework_submissions;
create trigger trg_sync_homework_evidence
  after update on homework_submissions
  for each row execute function sync_homework_evidence();

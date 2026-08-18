-- Student = 1 semantic identity closure.
-- Rule: a column named student_id is canonical public.students.id. Account telemetry
-- uses viewer_id/account_user_id explicitly instead of masquerading as learner identity.
-- authorization-test: public.student_topic_notes
-- authorization-test: public.vibelearn_content_saves
-- authorization-test: public.vibelearn_content_views
-- authorization-test: public.vibelearn_searches
-- authorization-test: public.student_schools

-- ---------------------------------------------------------------------------
-- 1. Revision topic notes are durable learner state: canonicalize to students.id.
-- ---------------------------------------------------------------------------
alter table public.student_topic_notes drop constraint if exists student_topic_notes_student_id_fkey;
alter table public.student_topic_notes add constraint student_topic_notes_student_id_fkey
  foreign key(student_id) references public.students(id) on delete cascade;

revoke all privileges on table public.student_topic_notes from anon, authenticated;
grant select,insert,update,delete on table public.student_topic_notes to authenticated;
grant all privileges on table public.student_topic_notes to service_role;

drop policy if exists student_topic_notes_delete_own on public.student_topic_notes;
drop policy if exists student_topic_notes_insert_own on public.student_topic_notes;
drop policy if exists student_topic_notes_select_own on public.student_topic_notes;
drop policy if exists student_topic_notes_update_own on public.student_topic_notes;
create policy student_topic_notes_select_own on public.student_topic_notes for select to authenticated
using (exists(select 1 from public.students s where s.id=student_topic_notes.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));
create policy student_topic_notes_insert_own on public.student_topic_notes for insert to authenticated
with check (exists(select 1 from public.students s where s.id=student_topic_notes.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));
create policy student_topic_notes_update_own on public.student_topic_notes for update to authenticated
using (exists(select 1 from public.students s where s.id=student_topic_notes.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null))
with check (exists(select 1 from public.students s where s.id=student_topic_notes.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));
create policy student_topic_notes_delete_own on public.student_topic_notes for delete to authenticated
using (exists(select 1 from public.students s where s.id=student_topic_notes.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));

-- The save RPC must write the same canonical identity the workspace reads.
do $$
declare v_oid oid:=to_regprocedure('public.student_save_topic_note(text,text,text)'); v_def text;
begin
 if v_oid is null then raise exception 'student_save_topic_note_missing'; end if;
 v_def:=pg_get_functiondef(v_oid);
 if position('v_student uuid:=auth.uid()' in v_def)>0 then
   v_def:=replace(v_def,'v_student uuid:=auth.uid()','v_student uuid:=public.current_student_id()');
   execute v_def;
 elsif position('v_student uuid:=public.current_student_id()' in v_def)=0 then
   raise exception 'student_save_topic_note_identity_drift';
 end if;
end $$;

-- Revision Workspace intentionally spans two identity domains: learner state uses
-- students.id while reading-progress ownership remains account/profile scoped.
do $$
declare v_oid oid:=to_regprocedure('public.student_get_revision_workspace(text,text)'); v_def text;
begin
 if v_oid is null then raise exception 'student_get_revision_workspace_missing'; end if;
 v_def:=pg_get_functiondef(v_oid);
 if position('v_account uuid:=auth.uid()' in v_def)=0 then
   if position('v_student uuid:=public.current_student_id(); v_readiness' in v_def)>0 then
     v_def:=replace(v_def,'v_student uuid:=public.current_student_id(); v_readiness','v_student uuid:=public.current_student_id(); v_account uuid:=auth.uid(); v_readiness');
   else
     raise exception 'revision_workspace_declaration_drift';
   end if;
 end if;
 v_def:=replace(v_def,'from public.vibe_reading_progress where viewer_id=v_student','from public.vibe_reading_progress where viewer_id=v_account');
 execute v_def;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Content views/searches are account telemetry: name the domain truthfully.
-- ---------------------------------------------------------------------------
do $$
begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='vibelearn_content_views' and column_name='student_id') then
   alter table public.vibelearn_content_views rename column student_id to viewer_id;
 end if;
end $$;
alter table public.vibelearn_content_views drop constraint if exists vibelearn_content_views_student_id_fkey;
alter table public.vibelearn_content_views drop constraint if exists vibelearn_content_views_viewer_id_fkey;
alter table public.vibelearn_content_views add constraint vibelearn_content_views_viewer_id_fkey
  foreign key(viewer_id) references auth.users(id) on delete set null;

drop policy if exists "students insert views" on public.vibelearn_content_views;
drop policy if exists vibelearn_content_views_student_read on public.vibelearn_content_views;
drop policy if exists vibelearn_content_views_viewer_insert on public.vibelearn_content_views;
drop policy if exists vibelearn_content_views_viewer_read on public.vibelearn_content_views;
create policy vibelearn_content_views_viewer_insert on public.vibelearn_content_views for insert to authenticated
with check(viewer_id=(select auth.uid()));
create policy vibelearn_content_views_viewer_read on public.vibelearn_content_views for select to authenticated
using(viewer_id=(select auth.uid()));

-- Repair the canonical writer after the semantic column rename.
do $$
declare v_oid oid:=to_regprocedure('public.increment_view_count(uuid,uuid)'); v_def text;
begin
 if v_oid is null then raise exception 'increment_view_count_missing'; end if;
 v_def:=pg_get_functiondef(v_oid);
 v_def:=replace(v_def,'v.student_id = effective_viewer_id','v.viewer_id = effective_viewer_id');
 v_def:=replace(v_def,'vibelearn_content_views(content_id, student_id, viewed_at)','vibelearn_content_views(content_id, viewer_id, viewed_at)');
 execute v_def;
end $$;

do $$
begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='vibelearn_searches' and column_name='student_id') then
   alter table public.vibelearn_searches rename column student_id to viewer_id;
 end if;
end $$;
alter table public.vibelearn_searches drop constraint if exists vibelearn_searches_student_id_fkey;
alter table public.vibelearn_searches drop constraint if exists vibelearn_searches_viewer_id_fkey;
alter table public.vibelearn_searches add constraint vibelearn_searches_viewer_id_fkey
  foreign key(viewer_id) references public.profiles(id) on delete set null;
drop policy if exists vibelearn_searches_owner on public.vibelearn_searches;
drop policy if exists vibelearn_searches_viewer_owner on public.vibelearn_searches;
create policy vibelearn_searches_viewer_owner on public.vibelearn_searches for all to authenticated
using(viewer_id=(select auth.uid())) with check(viewer_id=(select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Production-pretracked legacy learner tables: restore clean-rebuild lineage,
-- then make their student_id semantics canonical.
-- ---------------------------------------------------------------------------
create table if not exists public.vibelearn_content_saves (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.vibelearn_content(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique(content_id,student_id)
);
create index if not exists idx_vcs_content on public.vibelearn_content_saves(content_id);
alter table public.vibelearn_content_saves enable row level security;
revoke all privileges on table public.vibelearn_content_saves from anon,authenticated;
grant select,insert,update,delete on table public.vibelearn_content_saves to authenticated;
grant all privileges on table public.vibelearn_content_saves to service_role;

alter table public.vibelearn_content_saves drop constraint if exists vibelearn_content_saves_student_id_fkey;
alter table public.vibelearn_content_saves add constraint vibelearn_content_saves_student_id_fkey
  foreign key(student_id) references public.students(id) on delete cascade;
drop policy if exists "students manage their saves" on public.vibelearn_content_saves;
drop policy if exists "teacher reads own content saves" on public.vibelearn_content_saves;
drop policy if exists vibelearn_content_saves_student_owner on public.vibelearn_content_saves;
drop policy if exists vibelearn_content_saves_teacher_read on public.vibelearn_content_saves;
create policy vibelearn_content_saves_student_owner on public.vibelearn_content_saves for all to authenticated
using(exists(select 1 from public.students s where s.id=vibelearn_content_saves.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null))
with check(exists(select 1 from public.students s where s.id=vibelearn_content_saves.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));
create policy vibelearn_content_saves_teacher_read on public.vibelearn_content_saves for select to authenticated
using(exists(select 1 from public.vibelearn_content c where c.id=vibelearn_content_saves.content_id and c.submitted_by=(select auth.uid())));

-- access: service-only public.student_schools
create table if not exists public.student_schools (
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  primary key(student_id,school_id)
);
alter table public.student_schools enable row level security;
revoke all privileges on table public.student_schools from anon,authenticated;
grant all privileges on table public.student_schools to service_role;
alter table public.student_schools drop constraint if exists student_schools_student_id_fkey;
alter table public.student_schools add constraint student_schools_student_id_fkey
  foreign key(student_id) references public.students(id) on delete cascade;
drop policy if exists student_schools_locked on public.student_schools;
create policy student_schools_locked on public.student_schools for select to authenticated using(false);

-- ---------------------------------------------------------------------------
-- Fail-closed semantic certification.
-- ---------------------------------------------------------------------------
do $$
declare v_bad integer;
begin
 select count(*) into v_bad
 from pg_constraint c
 join pg_class t on t.oid=c.conrelid
 join pg_namespace n on n.oid=t.relnamespace
 where n.nspname='public' and c.contype='f'
   and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (student_id)%'
   and c.confrelid <> 'public.students'::regclass;
 if v_bad<>0 then raise exception 'student_one_noncanonical_student_id_fk_count:%',v_bad; end if;

 if exists(select 1 from information_schema.columns where table_schema='public' and table_name in ('vibelearn_content_views','vibelearn_searches') and column_name='student_id') then
   raise exception 'account_telemetry_still_mislabeled_student_id';
 end if;
 if position('v_student uuid:=public.current_student_id()' in pg_get_functiondef('public.student_save_topic_note(text,text,text)'::regprocedure))=0 then
   raise exception 'student_save_topic_note_not_canonical';
 end if;
 if position('viewer_id=v_account' in pg_get_functiondef('public.student_get_revision_workspace(text,text)'::regprocedure))=0 then
   raise exception 'revision_workspace_reading_progress_identity_not_account_scoped';
 end if;
 if position('v.viewer_id = effective_viewer_id' in pg_get_functiondef('public.increment_view_count(uuid,uuid)'::regprocedure))=0 then
   raise exception 'increment_view_count_viewer_domain_not_repaired';
 end if;
end $$;

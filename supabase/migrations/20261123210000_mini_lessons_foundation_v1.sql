-- Mini Lessons V1: reversible additive foundation, deliberately no automatic public release.
-- The canonical VibeSchool public profile and follow tables remain authoritative.
-- Apply only after required review, reconstruction and RLS/adversarial verification.
-- authorization-test: public.mini_lessons
--   anon reads approved adult opted-in creators only; owner drafts only; direct approval denied.
-- authorization-test: public.mini_interactions
--   authenticated users may like/save approved Minis as themselves only; cannot edit others.
-- authorization-test: public.mini_learning_signals
--   adult-verified users only; minors and spoofed subject tracking denied.
-- authorization-test: public.mini_comments
--   comments are pending and private by default; public reads only via redacted approved RPC.
-- authorization-test: public.mini_reports
--   one private report per signed-in account per Mini; cross-user disclosure denied.
-- Public discovery hashtags are independent of internal curriculum metadata.
create or replace function public.mini_tags_valid(p_tags text[])
returns boolean language sql immutable set search_path = ''
as $$
  select cardinality(p_tags) between 1 and 5
    and not exists(select 1 from unnest(p_tags) as t(value) where t.value is null
      or t.value !~ '^[a-z][a-z0-9_]{1,29}$');
$$;
revoke all on function public.mini_tags_valid(text[]) from public;

create table if not exists public.mini_lessons (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  creator_label text not null default '',
  title text not null check (char_length(btrim(title)) between 5 and 100),
  body text not null check (char_length(btrim(body)) between 40 and 3000),
  subject text not null check (char_length(btrim(subject)) between 2 and 60),
  tags text[] not null default array['general']::text[] check (public.mini_tags_valid(tags)),
  quiz_question text,
  quiz_options text[] not null default '{}'::text[],
  quiz_correct smallint,
  quiz_explanation text,
  constraint mini_optional_quiz_valid check (
    (quiz_question is null and cardinality(quiz_options)=0 and quiz_correct is null and quiz_explanation is null)
    or (char_length(btrim(quiz_question)) between 10 and 240
      and cardinality(quiz_options) between 2 and 4
      and quiz_correct between 0 and cardinality(quiz_options)-1
      and char_length(btrim(quiz_explanation)) between 10 and 500
      and array_position(quiz_options,null) is null)
  ),
  cover_path text check (cover_path is null or (char_length(cover_path) <= 180 and cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')),
  status text not null default 'pending' check (status in ('draft','pending','approved','rejected','hidden')),
  quality_score smallint not null default 50 check (quality_score between 0 and 100),
  like_count integer not null default 0 check (like_count >= 0),
  save_count integer not null default 0 check (save_count >= 0),
  learned_count integer not null default 0 check (learned_count >= 0),
  moderation_note text,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mini_approved_has_publication_date check (status <> 'approved' or published_at is not null)
);
create index if not exists mini_lessons_discovery_idx on public.mini_lessons(status, published_at desc) where status='approved';
create index if not exists mini_lessons_tags_idx on public.mini_lessons using gin(tags) where status='approved';
create index if not exists mini_lessons_subject_idx on public.mini_lessons(subject, published_at desc) where status='approved';
create index if not exists mini_lessons_creator_idx on public.mini_lessons(creator_id, created_at desc);

create table if not exists public.mini_interactions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mini_id uuid not null references public.mini_lessons(id) on delete cascade,
  kind text not null check (kind in ('like','save')),
  created_at timestamptz not null default now(),
  primary key(user_id,mini_id,kind)
);
create index if not exists mini_interactions_post_idx on public.mini_interactions(mini_id,kind);

create table if not exists public.mini_learning_signals (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mini_id uuid not null references public.mini_lessons(id) on delete cascade,
  signal text not null check (signal in ('understood','not_interested')),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key(user_id,mini_id,signal,occurred_on)
);
create index if not exists mini_learning_signals_post_idx on public.mini_learning_signals(mini_id,signal);

create table if not exists public.mini_comments (
  id uuid primary key default gen_random_uuid(),
  mini_id uuid not null references public.mini_lessons(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 2 and 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected','hidden')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists mini_comments_public_idx on public.mini_comments(mini_id,created_at desc) where status='approved';

create table if not exists public.mini_reports (
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  mini_id uuid not null references public.mini_lessons(id) on delete cascade,
  reason text not null check (reason in ('incorrect','unsafe','spam','copyright','other')),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  primary key(reporter_id,mini_id)
);
create index if not exists mini_reports_post_idx on public.mini_reports(mini_id,created_at desc);

-- Definitive, existing-account source: public profile opt-in and active accounts.
-- Children and accounts with known minor dates of birth are never public creators.
-- No interaction or comment writes from deactivated or anonymized accounts.
create or replace function public.mini_active_account(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.profiles p where p.id=p_user
    and p.account_status::text='active' and not p.is_anonymized);
$$;
revoke all on function public.mini_active_account(uuid) from public;
grant execute on function public.mini_active_account(uuid) to authenticated;

create or replace function public.mini_creator_can_submit(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1
    from public.profiles p
    join public.teacher_profiles t on t.profile_id=p.id
    join public.global_public_profiles gp on gp.profile_id=p.id
    where p.id=p_user
      and p.account_status::text='active'
      and not p.is_anonymized
      and gp.is_public
      and (p.date_of_birth is null or p.date_of_birth <= current_date - interval '18 years')
  );
$$;
create or replace function public.mini_creator_public(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1
    from public.profiles p
    join public.teacher_profiles t on t.profile_id=p.id
    join public.global_public_profiles gp on gp.profile_id=p.id
    where p.id=p_user and p.account_status::text='active'
      and not p.is_anonymized and gp.is_public
      and p.date_of_birth <= current_date - interval '18 years'
  );
$$;
-- Behavioural interests are collected only from adults with confirmed DOB.
create or replace function public.mini_adult_signal_allowed(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.profiles p
    where p.id=p_user and p.account_status::text='active'
    and not p.is_anonymized
    and p.date_of_birth <= current_date - interval '18 years');
$$;
revoke all on function public.mini_creator_can_submit(uuid) from public;
revoke all on function public.mini_creator_public(uuid) from public;
revoke all on function public.mini_adult_signal_allowed(uuid) from public;
grant execute on function public.mini_creator_can_submit(uuid) to anon,authenticated;
grant execute on function public.mini_creator_public(uuid) to anon,authenticated;
grant execute on function public.mini_adult_signal_allowed(uuid) to authenticated;

create or replace function public.mini_before_save()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  -- Always derive public creator display from the canonical opted-in profile.
  select left(coalesce(nullif(btrim(gp.username),''),nullif(btrim(gp.display_name),''),'VibeSchool educator'),60)
  into v_name from public.global_public_profiles gp
  where gp.profile_id = new.creator_id and gp.is_public;
  if v_name is null then raise exception 'Mini creator must have an opted-in public profile'; end if;
  new.creator_label := v_name;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists mini_before_save_trigger on public.mini_lessons;
create trigger mini_before_save_trigger before insert or update on public.mini_lessons
for each row execute function public.mini_before_save();

create or replace function public.mini_update_interaction_counts()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.mini_lessons
    set like_count = like_count + case when new.kind='like' then 1 else 0 end,
        save_count = save_count + case when new.kind='save' then 1 else 0 end
    where id=new.mini_id;
  elsif tg_op = 'DELETE' then
    update public.mini_lessons
    set like_count = greatest(0,like_count - case when old.kind='like' then 1 else 0 end),
        save_count = greatest(0,save_count - case when old.kind='save' then 1 else 0 end)
    where id=old.mini_id;
  end if;
  return null;
end;
$$;
drop trigger if exists mini_interaction_counter on public.mini_interactions;
create trigger mini_interaction_counter after insert or delete on public.mini_interactions
for each row execute function public.mini_update_interaction_counts();

create or replace function public.mini_update_learning_counts()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.signal='understood' then
    update public.mini_lessons set learned_count=learned_count+1 where id=new.mini_id;
  end if;
  return null;
end;
$$;
drop trigger if exists mini_learning_counter on public.mini_learning_signals;
create trigger mini_learning_counter after insert on public.mini_learning_signals
for each row execute function public.mini_update_learning_counts();

alter table public.mini_lessons enable row level security;
alter table public.mini_interactions enable row level security;
alter table public.mini_learning_signals enable row level security;
alter table public.mini_comments enable row level security;
alter table public.mini_reports enable row level security;

revoke all on public.mini_lessons from anon,authenticated;
revoke all on public.mini_interactions from anon,authenticated;
revoke all on public.mini_learning_signals from anon,authenticated;
revoke all on public.mini_comments from anon,authenticated;
revoke all on public.mini_reports from anon,authenticated;

grant select on public.mini_lessons to anon,authenticated;
grant insert(creator_id,title,body,subject,tags,quiz_question,quiz_options,quiz_correct,quiz_explanation,cover_path,status) on public.mini_lessons to authenticated;
grant update(title,body,subject,tags,quiz_question,quiz_options,quiz_correct,quiz_explanation,cover_path,status) on public.mini_lessons to authenticated;
grant delete on public.mini_lessons to authenticated;
-- Column-limited grants forbid forged timestamps, visibility and reviewer state.
grant select,delete on public.mini_interactions to authenticated;
grant insert(user_id,mini_id,kind) on public.mini_interactions to authenticated;
grant select on public.mini_learning_signals to authenticated;
grant insert(user_id,mini_id,signal,occurred_on) on public.mini_learning_signals to authenticated;
grant select on public.mini_comments to authenticated;
grant insert(mini_id,author_id,body,status) on public.mini_comments to authenticated;
grant select on public.mini_reports to authenticated;
grant insert(reporter_id,mini_id,reason,description) on public.mini_reports to authenticated;

create policy mini_public_read on public.mini_lessons
for select to anon,authenticated
using ((status='approved' and public.mini_creator_public(creator_id))
   or ((select auth.uid())=creator_id));
create policy mini_owner_create on public.mini_lessons
for insert to authenticated
with check (creator_id=(select auth.uid()) and status in ('draft','pending')
  and public.mini_creator_can_submit(creator_id)
  and (cover_path is null or split_part(cover_path,'/',1)=creator_id::text));
create policy mini_owner_edit_unpublished on public.mini_lessons
for update to authenticated
using (creator_id=(select auth.uid()) and status in ('draft','pending'))
with check (creator_id=(select auth.uid()) and status in ('draft','pending')
  and public.mini_creator_can_submit(creator_id)
  and (cover_path is null or split_part(cover_path,'/',1)=creator_id::text));
create policy mini_owner_delete_draft on public.mini_lessons
for delete to authenticated
using (creator_id=(select auth.uid()) and status='draft');

create policy mini_interactions_read_own on public.mini_interactions
for select to authenticated using (user_id=(select auth.uid()));
create policy mini_interactions_insert_own on public.mini_interactions
for insert to authenticated with check(
  user_id=(select auth.uid()) and public.mini_active_account(user_id) and exists (
    select 1 from public.mini_lessons m
    where m.id=mini_id and m.status='approved' and public.mini_creator_public(m.creator_id)
  )
);
create policy mini_interactions_delete_own on public.mini_interactions
for delete to authenticated using (user_id=(select auth.uid()));

create policy mini_learning_read_own on public.mini_learning_signals
for select to authenticated using (user_id=(select auth.uid()));
create policy mini_learning_write_adult on public.mini_learning_signals
for insert to authenticated with check (
  user_id=(select auth.uid()) and public.mini_adult_signal_allowed(user_id)
  and occurred_on=current_date
  and exists(select 1 from public.mini_lessons m where m.id=mini_id
    and m.status='approved' and public.mini_creator_public(m.creator_id))
);

-- No anonymous or cross-user comment reading through the Data API.
-- Public moderation-approved comments are exposed only through a redacted RPC.
create policy mini_comments_read_own on public.mini_comments
for select to authenticated using (author_id=(select auth.uid()));
create policy mini_comments_write_pending on public.mini_comments
for insert to authenticated with check(
  author_id=(select auth.uid()) and public.mini_active_account(author_id) and status='pending'
  and exists(select 1 from public.mini_lessons m where m.id=mini_id
    and m.status='approved' and public.mini_creator_public(m.creator_id))
);
create policy mini_reports_read_own on public.mini_reports
for select to authenticated using (reporter_id=(select auth.uid()));
create policy mini_reports_create_own on public.mini_reports
for insert to authenticated with check(
  reporter_id=(select auth.uid()) and public.mini_active_account(reporter_id) and exists(select 1 from public.mini_lessons m
    where m.id=mini_id and m.status='approved' and public.mini_creator_public(m.creator_id))
);

-- Never reveal children/commenter IDs or non-public profiles in public discussions.
create or replace function public.mini_approved_comments(p_mini uuid, p_limit integer default 30)
returns table(id uuid, body text, created_at timestamptz, author_label text)
language sql stable security definer set search_path = ''
as $$
  select c.id,c.body,c.created_at,
    case when p.date_of_birth <= current_date - interval '18 years'
       and gp.is_public and p.account_status::text='active' and not p.is_anonymized
      then left(coalesce(nullif(gp.username,''),nullif(gp.display_name,''),'Reader'),60)
      else 'Reader' end as author_label
  from public.mini_comments c
  join public.profiles p on p.id=c.author_id
  left join public.global_public_profiles gp on gp.profile_id=p.id
  join public.mini_lessons m on m.id=c.mini_id
  where c.mini_id=p_mini and c.status='approved'
    and m.status='approved' and public.mini_creator_public(m.creator_id)
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit,30),1),50);
$$;
revoke all on function public.mini_approved_comments(uuid,integer) from public;
grant execute on function public.mini_approved_comments(uuid,integer) to anon,authenticated;

-- Private covers. Upload does not make unreviewed media available to the public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mini-covers','mini-covers',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy mini_covers_owner_upload on storage.objects
for insert to authenticated
with check (bucket_id='mini-covers'
 and split_part(name,'/',1)=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
 and public.mini_creator_can_submit((select auth.uid())));
create policy mini_covers_read_eligible on storage.objects
for select to anon,authenticated
using (bucket_id='mini-covers' and (
  split_part(name,'/',1)=(select auth.uid())::text
  or exists (
    select 1 from public.mini_lessons m
    where m.cover_path=storage.objects.name and m.status='approved'
      and public.mini_creator_public(m.creator_id)
  )
));
create policy mini_covers_owner_remove_unused on storage.objects
for delete to authenticated
using (bucket_id='mini-covers'
  and split_part(name,'/',1)=(select auth.uid())::text
  and not exists(select 1 from public.mini_lessons m where m.cover_path=storage.objects.name));

comment on table public.mini_lessons is
'Mini Lessons: author submits pending, never self-approves; moderation and publication are separately commissioned.';
comment on table public.mini_learning_signals is
'Explicit feedback only, adult DOB confirmed; no child behavioral profiling. No watch-time optimization.';

-- Mini Lessons review/reliability. This file does NOT commission public publishing.
-- Rate caps apply under concurrent clients; author/reviewer separation is mandatory.
create or replace function public.mini_creator_can_submit(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles p
    join public.global_public_profiles gp on gp.profile_id=p.id
    where p.id=p_user and p.account_status::text='active'
      and not p.is_anonymized and gp.is_public
      and p.date_of_birth <= current_date - interval '18 years'
  );
$$;
revoke all on function public.mini_creator_can_submit(uuid) from public;
grant execute on function public.mini_creator_can_submit(uuid) to anon,authenticated;

-- Any opted-in adult may publish: teacher, parent or independent adult learner.
-- Public exposure still requires an independently checked adult DOB.
create or replace function public.mini_creator_public(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles p
    join public.global_public_profiles gp on gp.profile_id=p.id
    where p.id=p_user and p.account_status::text='active'
      and not p.is_anonymized and gp.is_public
      and p.date_of_birth <= current_date - interval '18 years'
  );
$$;
revoke all on function public.mini_creator_public(uuid) from public;
grant execute on function public.mini_creator_public(uuid) to anon,authenticated;

create or replace function public.mini_rate_limit()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid;
  v_count integer;
  v_max integer;
  v_since timestamptz;
begin
  if tg_table_name='mini_lessons' then
    v_actor := new.creator_id; v_max:=8; v_since:=now()-interval '24 hours';
  elsif tg_table_name='mini_comments' then
    v_actor := new.author_id; v_max:=12; v_since:=now()-interval '1 hour';
  elsif tg_table_name='mini_reports' then
    v_actor := new.reporter_id; v_max:=20; v_since:=now()-interval '24 hours';
  else
    raise exception 'Unknown Mini rate limit context';
  end if;
  -- Serialize competing attempts from one account during this transaction.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || tg_table_name,0));
  if tg_table_name='mini_lessons' then
    select count(*) into v_count from public.mini_lessons
      where creator_id=v_actor and created_at>=v_since;
  elsif tg_table_name='mini_comments' then
    select count(*) into v_count from public.mini_comments
      where author_id=v_actor and created_at>=v_since;
  else
    select count(*) into v_count from public.mini_reports
      where reporter_id=v_actor and created_at>=v_since;
  end if;
  if v_count >= v_max then raise exception 'Mini submission rate limit reached';end if;
  return new;
end;
$$;
drop trigger if exists mini_lessons_rate_guard on public.mini_lessons;
create trigger mini_lessons_rate_guard before insert on public.mini_lessons
for each row execute function public.mini_rate_limit();
drop trigger if exists mini_comments_rate_guard on public.mini_comments;
create trigger mini_comments_rate_guard before insert on public.mini_comments
for each row execute function public.mini_rate_limit();
drop trigger if exists mini_reports_rate_guard on public.mini_reports;
create trigger mini_reports_rate_guard before insert on public.mini_reports
for each row execute function public.mini_rate_limit();

-- Preserve the last safe creator label when a creator makes their profile
-- private after publication. Public visibility still fails closed via RLS.
create or replace function public.mini_before_save()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  select left(coalesce(nullif(btrim(gp.username),''),nullif(btrim(gp.display_name),''),'VibeSchool educator'),60)
  into v_name from public.global_public_profiles gp
  where gp.profile_id=new.creator_id and gp.is_public;
  if v_name is null and tg_op='INSERT'
    then raise exception 'Mini creator must have an opted-in public profile';end if;
  new.creator_label := coalesce(v_name,case when tg_op='UPDATE' then old.creator_label end,'VibeSchool educator');
  new.updated_at := now();
  return new;
end;
$$;

-- Atomic, audited, service-only staff review. Direct authenticated users
-- have no UPDATE grant on status='approved', quality_score or published_at.
create or replace function public.mini_review_item(
  p_actor uuid,
  p_target text,
  p_id uuid,
  p_decision text,
  p_reason text default null,
  p_quality smallint default 50
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_member record;
  v_mini public.mini_lessons%rowtype;
  v_comment public.mini_comments%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  select role,status,permissions,access_expires_at,revoked_at,suspended_at
  into v_member from public.hq_human_members where profile_id=p_actor;
  if not found or v_member.status<>'active'
    or v_member.revoked_at is not null
    or v_member.suspended_at is not null
    or (v_member.access_expires_at is not null and v_member.access_expires_at<=now())
    or not (v_member.role='founder' or 'content.approve'=any(v_member.permissions)) then
    raise exception 'HQ content review authority denied';
  end if;
  if p_decision not in ('approved','rejected','hidden')
     or p_target not in ('mini','comment')
     or p_quality not between 0 and 100 then
    raise exception 'Invalid Mini review decision';
  end if;
  if p_decision in ('rejected','hidden') and char_length(btrim(coalesce(p_reason,'')))<8 then
    raise exception 'Review reason required';
  end if;
  if p_target='mini' then
    select * into v_mini from public.mini_lessons where id=p_id for update;
    if not found then raise exception 'Mini not found';end if;
    if v_mini.creator_id=p_actor then raise exception 'Creator cannot review their own Mini';end if;
    if v_mini.status not in ('pending','approved') then raise exception 'Mini not reviewable';end if;
    if p_decision='approved' and v_mini.status <> 'pending' then raise exception 'Already reviewed';end if;
    if p_decision='approved' then
      if not public.mini_creator_public(v_mini.creator_id) then
        raise exception 'Adult public creator verification required';
      end if;
      if v_mini.cover_path is null or not exists(
        select 1 from storage.objects so where so.bucket_id='mini-covers'
          and so.name=v_mini.cover_path
      ) then raise exception 'Approved Mini needs a verified private cover';end if;
    end if;
    v_before:=jsonb_build_object('status',v_mini.status,'quality_score',v_mini.quality_score);
    update public.mini_lessons set
      status=p_decision,
      quality_score=case when p_decision='approved' then p_quality else quality_score end,
      moderation_note=nullif(btrim(p_reason),''),
      reviewed_at=now(),
      published_at=case when p_decision='approved' then now() else published_at end
    where id=p_id;
  else
    select * into v_comment from public.mini_comments where id=p_id for update;
    if not found then raise exception 'Comment not found';end if;
    if v_comment.author_id=p_actor then raise exception 'Author cannot approve their own comment';end if;
    if v_comment.status not in ('pending','approved') then raise exception 'Comment not reviewable';end if;
    if p_decision='approved' and v_comment.status <> 'pending' then raise exception 'Already reviewed';end if;
    if p_decision='approved' and not exists(
      select 1 from public.mini_lessons m where m.id=v_comment.mini_id
      and m.status='approved' and public.mini_creator_public(m.creator_id)
    ) then raise exception 'The parent Mini is not publicly approved';end if;
    v_before:=jsonb_build_object('status',v_comment.status);
    update public.mini_comments set status=p_decision,reviewed_at=now() where id=p_id;
  end if;
  v_after:=jsonb_build_object('status',p_decision,'target',p_target,'mini_item_id',p_id,'reason',p_reason);
  insert into public.hq_human_audit_log(actor_id,target_id,action,before_state,after_state,source,request_id)
  values(p_actor,case when p_target='mini' then v_mini.creator_id else v_comment.author_id end,
    'mini.'||p_target||'.reviewed',v_before,v_after,'human',gen_random_uuid());
  return v_after;
end;
$$;
revoke all on function public.mini_review_item(uuid,text,uuid,text,text,smallint)
  from public,anon,authenticated;
grant execute on function public.mini_review_item(uuid,text,uuid,text,text,smallint)
  to service_role;

comment on function public.mini_review_item(uuid,text,uuid,text,text,smallint) is
'Only trusted server service role with independently verified active HQ actor may call; records atomic audit. No client approval privilege.';

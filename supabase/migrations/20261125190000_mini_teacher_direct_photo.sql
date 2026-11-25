-- #2128. This migration installs the teacher photo path without activating it.
-- authorization-test: public.mini_lessons — direct drafts stay private, only the trusted release endpoint may publish.
alter table public.mini_lessons add column publication_method text
  check (publication_method is null or publication_method = 'teacher_direct_photo');
alter table public.mini_lessons add constraint mini_teacher_direct_photo_only check (
  publication_method is null or (cover_path is not null and request_id is null
    and audio_path is null)
);

create function public.mini_teacher_photo_eligible(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists (
   select 1 from public.profiles p where p.id=p_user and p.role::text='teacher'
     and p.account_status::text='active' and not p.is_anonymized
     and p.parental_consent_at is null and p.parental_consent_by is null
     and (p.date_of_birth is null or p.date_of_birth <= (current_date - interval '18 years')::date)
     and not exists (select 1 from public.mini_creator_clearances c
       where c.profile_id=p.id and c.revoked_at is not null)
     and (public.mini_verified_adult(p.id) or exists (
       select 1 from public.teacher_profile_verifications v
       where v.profile_id=p.id and v.tsc_status='verified'
         and v.tsc_verified_at <= now() and v.verified_by is not null and v.verified_by <> p.id
     ))
 );
$$;
revoke all on function public.mini_teacher_photo_eligible(uuid) from public,anon,authenticated;
grant execute on function public.mini_teacher_photo_eligible(uuid) to service_role;

create function public.mini_my_teacher_photo_profile()
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
   'eligible',public.mini_teacher_photo_eligible(p.id),
   'isPublic',coalesce(g.is_public,false),
   'username',coalesce(i.username,g.username,''),
   'displayName',coalesce(g.display_name,i.display_name,p.full_name,'')
 )
 from public.profiles p
 left join public.global_public_profiles g on g.profile_id=p.id
 left join public.vs_identities i on i.auth_user_id=p.id
 where p.id=auth.uid();
$$;
revoke all on function public.mini_my_teacher_photo_profile() from public,anon,authenticated;
grant execute on function public.mini_my_teacher_photo_profile() to authenticated;

-- Keep the existing adult rule for every other publishing, request and learning path.
create function public.mini_teacher_photo_public(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select public.mini_teacher_photo_eligible(p_user) and exists (
   select 1 from public.global_public_profiles g where g.profile_id=p_user and g.is_public
 );
$$;
revoke all on function public.mini_teacher_photo_public(uuid) from public,anon,authenticated;
grant execute on function public.mini_teacher_photo_public(uuid) to anon,authenticated,service_role;

-- Feed, photo and engagement all use the same visibility predicate.
create function public.mini_public_version(p_user uuid,p_method text)
returns boolean language sql stable security definer set search_path=''
as $$
 select case when p_method='teacher_direct_photo' then public.mini_teacher_photo_public(p_user)
              when p_method is null then public.mini_creator_public(p_user) else false end;
$$;
revoke all on function public.mini_public_version(uuid,text) from public,anon,authenticated;
grant execute on function public.mini_public_version(uuid,text) to anon,authenticated,service_role;

alter policy mini_public_read on public.mini_lessons
 using ((status='approved' and public.mini_public_version(creator_id,publication_method))
   or creator_id=(select auth.uid()));
alter policy mini_covers_read_eligible on storage.objects
 using (bucket_id='mini-covers' and (split_part(name,'/',1)=(select auth.uid())::text
   or exists (select 1 from public.mini_lessons m where m.cover_path=storage.objects.name
     and m.status='approved' and public.mini_public_version(m.creator_id,m.publication_method))));
alter policy mini_covers_owner_upload on storage.objects
 with check (bucket_id='mini-covers' and split_part(name,'/',1)=(select auth.uid())::text
   and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
   and (public.mini_creator_can_submit((select auth.uid())) or (
     public.mini_teacher_photo_public((select auth.uid())) and exists (
       select 1 from public.mini_lessons m where m.cover_path=storage.objects.name
         and m.creator_id=(select auth.uid()) and m.status='draft'
         and m.publication_method='teacher_direct_photo'
     ))));
-- The composer retries an immutable saved submission using its original ID.
create policy mini_teacher_photo_drafts_immutable on public.mini_lessons
 as restrictive for update to authenticated using (publication_method is null);
alter policy mini_interactions_insert_own on public.mini_interactions
 with check (user_id=(select auth.uid()) and public.mini_active_account(user_id) and exists (
   select 1 from public.mini_lessons m where m.id=mini_id and m.status='approved'
     and public.mini_public_version(m.creator_id,m.publication_method)
 ));

alter policy mini_reports_create_own on public.mini_reports
 with check (reporter_id=(select auth.uid()) and public.mini_active_account(reporter_id) and exists (
   select 1 from public.mini_lessons m where m.id=mini_id and m.status='approved'
     and public.mini_public_version(m.creator_id,m.publication_method)
 ));
alter policy mini_learning_write_adult on public.mini_learning_signals
 with check (user_id=(select auth.uid()) and public.mini_adult_signal_allowed(user_id)
   and occurred_on=current_date and exists (
     select 1 from public.mini_lessons m where m.id=mini_id and m.status='approved'
       and public.mini_public_version(m.creator_id,m.publication_method)
 ));
alter policy mini_comments_write_pending on public.mini_comments
 with check (author_id=(select auth.uid()) and public.mini_active_account(author_id) and status='pending'
   and exists (select 1 from public.mini_lessons m where m.id=mini_id and m.status='approved'
     and public.mini_public_version(m.creator_id,m.publication_method)));

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
    and m.status='approved' and public.mini_public_version(m.creator_id,m.publication_method)
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit,30),1),50);
$$;
revoke all on function public.mini_approved_comments(uuid,integer) from public;
grant execute on function public.mini_approved_comments(uuid,integer) to anon,authenticated;

create function public.mini_save_teacher_photo(
 p_id uuid,p_title text,p_body text,p_subject text,p_tags text[],p_question text,
 p_options text[],p_correct smallint,p_explanation text,p_extension text,p_consent jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid();
 v_path text;
 v_existing public.mini_lessons%rowtype;
 v_username text;
 v_name text;
begin
 if not public.mini_teacher_photo_eligible(v_user) then
   raise exception 'Verified adult teacher account required' using errcode='42501';
 end if;
 if p_id is null or p_extension is null or p_extension not in ('jpg','png','webp') then
   raise exception 'Invalid photo' using errcode='22023';
 end if;
 if exists(select 1 from unnest(p_options) as option where char_length(btrim(option)) not between 1 and 180)
    or concat_ws(' ',p_title,p_body,array_to_string(p_tags,' '),p_question,array_to_string(p_options,' '),p_explanation)
       ~* '(https?://|www\.|[[:alnum:]_.+%-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|(\+?254|0)[17][0-9]{8})' then
   raise exception 'Check the answer choices and remove contact information or external links' using errcode='22023';
 end if;
 v_path:=v_user::text||'/'||p_id::text||'.'||p_extension;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':mini_lessons',0));
 select * into v_existing from public.mini_lessons where id=p_id;
 if found then
   if v_existing.creator_id=v_user and v_existing.publication_method='teacher_direct_photo'
     and v_existing.status in ('draft','approved') and v_existing.cover_path=v_path
     and (v_existing.title,v_existing.body,v_existing.subject,v_existing.tags,v_existing.quiz_question,
          v_existing.quiz_options,v_existing.quiz_correct,v_existing.quiz_explanation)
         is not distinct from (p_title,p_body,p_subject,p_tags,p_question,p_options,p_correct,p_explanation) then
     return p_id;
   end if;
   raise exception 'Submission ID is already in use' using errcode='23505';
 end if;
 if not public.mini_teacher_photo_public(v_user) then
   v_username:=p_consent->>'username';
   v_name:=btrim(p_consent->>'displayName');
   if p_consent->'accepted' is distinct from 'true'::jsonb
      or v_username is null or v_username !~ '^[a-z][a-z0-9_]{2,23}$'
      or v_name is null or char_length(v_name) not between 2 and 80 then
     raise exception 'Public profile consent and name required' using errcode='42501';
   end if;
   insert into public.global_public_profiles(profile_id,username,display_name,is_public)
   values(v_user,v_username,v_name,true)
   on conflict(profile_id) do update set username=excluded.username,display_name=excluded.display_name,is_public=true;
 end if;
 insert into public.mini_lessons(id,creator_id,title,body,subject,tags,quiz_question,quiz_options,
   quiz_correct,quiz_explanation,cover_path,status,publication_method)
 values(p_id,v_user,p_title,p_body,p_subject,p_tags,p_question,p_options,p_correct,p_explanation,
   v_path,'draft','teacher_direct_photo');
 return p_id;
end;
$$;
revoke all on function public.mini_save_teacher_photo(uuid,text,text,text,text[],text,text[],smallint,text,text,jsonb)
 from public,anon,authenticated;
grant execute on function public.mini_save_teacher_photo(uuid,text,text,text,text[],text,text[],smallint,text,text,jsonb)
 to authenticated;

-- This trusted-server transition is version-bound and records provenance on the
-- Mini itself. "approved" is the existing visibility state, not a scan verdict.
create function public.mini_release_teacher_photo(p_actor uuid,p_id uuid,p_version timestamptz,p_cover text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_item public.mini_lessons%rowtype;
begin
 select * into v_item from public.mini_lessons where id=p_id and creator_id=p_actor for update;
 if not found or v_item.publication_method is distinct from 'teacher_direct_photo'
    or not public.mini_teacher_photo_public(p_actor)
    or v_item.cover_path is distinct from p_cover
    or to_jsonb(v_item)->>'slide_deck' is not null then return false; end if;
 if v_item.status='approved' then return true; end if;
 if v_item.status<>'draft' or v_item.updated_at is distinct from p_version
    or not exists (
      select 1 from storage.objects o where o.bucket_id='mini-covers' and o.name=p_cover
    ) then return false; end if;
 update public.mini_lessons set status='approved',published_at=now() where id=p_id;
 return true;
end;
$$;
revoke all on function public.mini_release_teacher_photo(uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.mini_release_teacher_photo(uuid,uuid,timestamptz,text) to service_role;
notify pgrst,'reload schema';

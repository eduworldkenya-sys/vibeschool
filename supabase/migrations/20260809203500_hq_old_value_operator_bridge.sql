-- Restore valuable old-HQ operator capabilities on top of the hardened owner boundary.
-- No learner/teacher RLS is relaxed; HQ uses narrowly scoped SECURITY DEFINER RPCs.

create or replace function public.hq_studio_overview()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare out jsonb;
begin
  perform public.hq_assert_owner();
  select jsonb_build_object(
    'publications', jsonb_build_object(
      'total',(select count(*) from vibe_publications),
      'draft',(select count(*) from vibe_publications where status='draft'),
      'published',(select count(*) from vibe_publications where status='published'),
      'textbooks',(select count(*) from vibe_publications where format='vibetextbook'),
      'ebooks',(select count(*) from vibe_publications where format='ebook')
    ),
    'assessment_bank', jsonb_build_object(
      'questions',(select count(*) from assessment_questions),
      'definitions',(select count(*) from assessment_definitions)
    ),
    'curriculum', jsonb_build_object(
      'rows',(select count(*) from curriculum),
      'imports',(select count(*) from curriculum_imports),
      'outcomes',(select count(*) from curriculum_learning_outcomes)
    ),
    'funhub', jsonb_build_object(
      'active_vouchers',(select count(*) from funhub_vouchers where is_active and deleted_at is null),
      'voucher_pool',(select coalesce(sum(greatest(total_pool-claimed_count,0)),0) from funhub_vouchers where is_active and deleted_at is null),
      'learners_with_xp',(select count(*) from funhub_xp)
    ),
    'moderation', jsonb_build_object(
      'exam_flags',(select count(*) from exam_flags where coalesce(status,'open') not in ('resolved','closed')),
      'open_incidents',(select count(*) from hq_incidents where status not in ('resolved','closed')),
      'assessment_requests',(select count(*) from assessment_moderation_requests where status not in ('approved','rejected','closed'))
    )
  ) into out;
  return out;
end $$;

create or replace function public.hq_list_funhub_vouchers(p_include_inactive boolean default true)
returns table(id uuid,sponsor_name text,title text,description text,category text,xp_cost integer,total_pool integer,claimed_count integer,is_active boolean,remaining integer,created_at timestamptz)
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.hq_assert_owner();
  return query select v.id,v.sponsor_name,v.title,v.description,v.category,v.xp_cost,v.total_pool,v.claimed_count,v.is_active,greatest(v.total_pool-v.claimed_count,0),v.created_at
  from funhub_vouchers v
  where v.deleted_at is null and (p_include_inactive or v.is_active)
  order by v.is_active desc,v.created_at desc;
end $$;

create or replace function public.hq_upsert_funhub_voucher(
  p_id uuid default null,
  p_sponsor_name text default null,
  p_title text default null,
  p_description text default null,
  p_category text default 'physical',
  p_xp_cost integer default 0,
  p_total_pool integer default 0,
  p_is_active boolean default true
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid;
begin
  perform public.hq_assert_owner();
  if nullif(btrim(coalesce(p_sponsor_name,'')),'') is null or nullif(btrim(coalesce(p_title,'')),'') is null then raise exception 'Sponsor and title are required'; end if;
  if p_xp_cost < 0 or p_total_pool < 0 then raise exception 'XP cost and pool must be non-negative'; end if;
  if p_category not in ('physical','digital','experience') then raise exception 'Invalid voucher category'; end if;
  if p_id is null then
    insert into funhub_vouchers(sponsor_name,title,description,category,xp_cost,total_pool,claimed_count,is_active)
    values(btrim(p_sponsor_name),btrim(p_title),nullif(btrim(coalesce(p_description,'')),''),p_category,p_xp_cost,p_total_pool,0,p_is_active)
    returning id into v_id;
  else
    update funhub_vouchers set sponsor_name=btrim(p_sponsor_name),title=btrim(p_title),description=nullif(btrim(coalesce(p_description,'')),''),category=p_category,xp_cost=p_xp_cost,total_pool=greatest(p_total_pool,claimed_count),is_active=p_is_active
    where id=p_id and deleted_at is null returning id into v_id;
    if v_id is null then raise exception 'Voucher not found'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.hq_list_assessment_bank(p_limit integer default 200)
returns table(id uuid,question_text text,question_type text,difficulty text,bloom_level text,marks numeric,status text,review_status text,usage_count integer,curriculum_id uuid,learning_outcome_id uuid,updated_at timestamptz)
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.hq_assert_owner();
  return query select q.id,q.question_text,q.question_type,q.difficulty,q.bloom_level,q.marks,q.status,q.review_status,q.usage_count,q.curriculum_id,q.learning_outcome_id,q.updated_at
  from assessment_questions q order by q.updated_at desc nulls last limit least(greatest(p_limit,1),500);
end $$;

create or replace function public.hq_list_moderation_queue(p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.hq_assert_owner();
  return jsonb_build_object(
    'exam_flags',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,session_id,user_id,question_text,flag_type,reason,status,created_at from exam_flags order by created_at desc limit least(greatest(p_limit,1),500)) x),'[]'::jsonb),
    'incidents',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,incident_type,severity,status,title,summary,route,detected_at,owner_department,verification_status from hq_incidents where status not in ('resolved','closed') order by detected_at desc limit least(greatest(p_limit,1),500)) x),'[]'::jsonb),
    'assessment_requests',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,attempt_id,response_id,requested_by,requested_score,request_reason,status,created_at from assessment_moderation_requests order by created_at desc limit least(greatest(p_limit,1),500)) x),'[]'::jsonb)
  );
end $$;

revoke all on function public.hq_studio_overview() from public,anon;
revoke all on function public.hq_list_funhub_vouchers(boolean) from public,anon;
revoke all on function public.hq_upsert_funhub_voucher(uuid,text,text,text,text,integer,integer,boolean) from public,anon;
revoke all on function public.hq_list_assessment_bank(integer) from public,anon;
revoke all on function public.hq_list_moderation_queue(integer) from public,anon;
grant execute on function public.hq_studio_overview() to authenticated;
grant execute on function public.hq_list_funhub_vouchers(boolean) to authenticated;
grant execute on function public.hq_upsert_funhub_voucher(uuid,text,text,text,text,integer,integer,boolean) to authenticated;
grant execute on function public.hq_list_assessment_bank(integer) to authenticated;
grant execute on function public.hq_list_moderation_queue(integer) to authenticated;

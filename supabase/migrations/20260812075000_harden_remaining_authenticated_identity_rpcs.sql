begin;

create or replace function public.admin_add_student(
  p_name text,
  p_admission_number text,
  p_gender text,
  p_date_of_birth text,
  p_class_id uuid,
  p_school_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_student_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_school_id is null or not public.is_school_admin(p_school_id) then raise exception 'not_authorized'; end if;
  if p_class_id is not null and not exists (select 1 from public.classes where id=p_class_id and school_id=p_school_id) then raise exception 'class_school_mismatch'; end if;

  insert into students(name,admission_number,gender,date_of_birth,class_id,created_by)
  values(p_name,p_admission_number,p_gender,p_date_of_birth::date,p_class_id,auth.uid())
  returning id into v_student_id;

  if p_class_id is not null then
    insert into student_classes(student_id,class_id,school_id,joined_at,is_current)
    values(v_student_id,p_class_id,p_school_id,now(),true)
    on conflict(student_id,class_id) do nothing;
  end if;
  return v_student_id;
end;
$function$;

create or replace function public.teacher_add_student(
  p_name text,
  p_admission_number text default null,
  p_class_id uuid default null,
  p_school_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_student_id uuid; v_code text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_school_id is null then raise exception 'school_required'; end if;
  if not exists (select 1 from public.school_members where school_id=p_school_id and profile_id=auth.uid() and role in ('teacher','admin','owner')) then
    raise exception 'not_authorized';
  end if;
  if p_class_id is not null and not exists (select 1 from public.classes where id=p_class_id and school_id=p_school_id) then
    raise exception 'class_school_mismatch';
  end if;

  insert into students(name,admission_number,class_id,created_by)
  values(p_name,p_admission_number,p_class_id,auth.uid())
  returning id into v_student_id;

  if p_class_id is not null then
    insert into student_classes(student_id,class_id,school_id,is_current,joined_at)
    values(v_student_id,p_class_id,p_school_id,true,now());
  end if;

  v_code := upper(substring(md5(random()::text) from 1 for 6));
  insert into student_claim_codes(student_id,code,claimed,role)
  values(v_student_id,v_code,false,'student');

  return v_student_id;
end;
$function$;

create or replace function public.get_credit_balance(p_teacher_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_total_earned integer; v_total_spent integer; v_balance integer; v_wallet_balance integer; v_transactions jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_teacher_id then raise exception 'unauthorized_identity'; end if;
  select coalesce(sum(case when amount>0 then amount else 0 end),0),coalesce(sum(case when amount<0 then abs(amount) else 0 end),0) into v_total_earned,v_total_spent from vibe_credit_transactions where teacher_id=p_teacher_id;
  select balance into v_wallet_balance from vibe_credits where teacher_id=p_teacher_id;
  v_balance:=coalesce(v_wallet_balance,v_total_earned-v_total_spent);
  select coalesce(jsonb_agg(t order by t.created_at desc),'[]'::jsonb) into v_transactions from (select type,feature,amount,balance_after,mpesa_ref,notes,created_at from vibe_credit_transactions where teacher_id=p_teacher_id order by created_at desc limit 20) t;
  return jsonb_build_object('success',true,'balance',v_balance,'total_earned',v_total_earned,'total_spent',v_total_spent,'recent_transactions',v_transactions);
end;
$function$;

create or replace function public.get_teacher_active_weeks(p_school_id uuid,p_teacher_id uuid)
returns table(term_id uuid,term_number integer,academic_year integer,week_number integer,start_date date,end_date date,week_type text,label text)
language plpgsql stable security definer set search_path=public,extensions,pg_temp
as $function$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if auth.uid() <> p_teacher_id and not public.is_school_admin(p_school_id) then raise exception 'not_authorized'; end if;
  return query
  select term_id,term_number,academic_year,week_number,start_date,end_date,week_type,label
  from (
    select distinct on (tw.term_id,tw.week_number) tw.term_id,at.term as term_number,at.academic_year,tw.week_number,tw.start_date,tw.end_date,tw.week_type,tw.label
    from public.term_weeks tw join public.academic_terms at on at.id=tw.term_id
    where at.school_id=p_school_id and (tw.school_id=p_school_id or tw.school_id is null)
      and (exists(select 1 from public.attendance a where a.school_id=p_school_id and a.teacher_id=p_teacher_id and a.date between tw.start_date and tw.end_date)
        or exists(select 1 from public.lesson_plans lp where lp.school_id=p_school_id and lp.teacher_id=p_teacher_id and lp.week_start between tw.start_date and tw.end_date)
        or exists(select 1 from public.homework hw where hw.school_id=p_school_id and hw.teacher_id=p_teacher_id and hw.created_at::date between tw.start_date and tw.end_date))
    order by tw.term_id,tw.week_number,(tw.school_id is null)
  ) deduped
  order by academic_year,term_number,week_number;
end;
$function$;

create or replace function public.update_exam_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $function$
declare v_streak exam_streaks%rowtype; v_today date:=current_date;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'unauthorized_identity'; end if;
  select * into v_streak from exam_streaks where user_id=p_user_id for update;
  if not found then insert into exam_streaks(user_id,current_streak,longest_streak,last_active_date,total_exams) values(p_user_id,1,1,v_today,1); return; end if;
  if v_streak.last_active_date=v_today then update exam_streaks set total_exams=total_exams+1,updated_at=now() where user_id=p_user_id; return; end if;
  if v_streak.last_active_date=v_today-interval '1 day' then update exam_streaks set current_streak=current_streak+1,longest_streak=greatest(longest_streak,current_streak+1),last_active_date=v_today,total_exams=total_exams+1,updated_at=now() where user_id=p_user_id; return; end if;
  update exam_streaks set current_streak=1,last_active_date=v_today,total_exams=total_exams+1,updated_at=now() where user_id=p_user_id;
end;
$function$;

-- Legacy claim RPC was writing the authenticated user's UUID into student_id,
-- corrupting the claim's target identity. The canonical redeem_student_claim()
-- path is now the only client-callable student claim operation.
revoke execute on function public.redeem_student_claim_code(uuid,text) from public,anon,authenticated;
grant execute on function public.redeem_student_claim_code(uuid,text) to service_role;

create or replace function public.ce_register_learning_resource(
  p_source_type text,
  p_publication_id uuid default null,
  p_chapter_id uuid default null,
  p_content_id uuid default null,
  p_content_block_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_visibility text default 'private',
  p_school_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare caller uuid:=auth.uid(); result_id uuid; resolved_title text; resolved_creator uuid;
begin
  if caller is null and current_user not in ('postgres','service_role') then raise exception 'Authentication required'; end if;
  if p_school_id is not null and current_user not in ('postgres','service_role') then
    if not public.is_school_admin(p_school_id) and not exists(select 1 from public.profiles where id=caller and school_id=p_school_id) then raise exception 'unauthorized_school'; end if;
  end if;
  if p_source_type='publication' then
    select title,author_id into resolved_title,resolved_creator from public.vibe_publications where id=p_publication_id;
  elsif p_source_type='chapter' then
    select coalesce(c.title,p.title),p.author_id into resolved_title,resolved_creator from public.vibe_chapters c join public.vibe_publications p on p.id=c.publication_id where c.id=p_chapter_id and c.publication_id=p_publication_id;
  elsif p_source_type='vibelearn_content' then
    select title,submitted_by into resolved_title,resolved_creator from public.vibelearn_content where id=p_content_id;
  elsif p_source_type='content_block' then
    select coalesce(b.title,b.plain_text,c.title),p.author_id into resolved_title,resolved_creator from public.content_blocks b join public.vibe_chapters c on c.id=b.chapter_id join public.vibe_publications p on p.id=b.publication_id where b.id=p_content_block_id and b.chapter_id=p_chapter_id and b.publication_id=p_publication_id;
  else resolved_title:=p_title; resolved_creator:=caller; end if;
  if resolved_title is null then raise exception 'Resource target does not exist or has no title'; end if;
  if current_user not in ('postgres','service_role') and resolved_creator is distinct from caller then raise exception 'Only the resource owner may register this resource'; end if;
  insert into public.learning_resources(source_type,publication_id,chapter_id,content_id,content_block_id,title,description,status,visibility,owner_type,school_id,created_by,learning_outcomes)
  values(p_source_type,p_publication_id,p_chapter_id,p_content_id,p_content_block_id,coalesce(nullif(btrim(p_title),''),resolved_title),p_description,'active',p_visibility,case when p_source_type in ('publication','chapter','content_block') then 'publisher' else 'creator' end,p_school_id,coalesce(caller,resolved_creator),'{}'::text[])
  on conflict(canonical_key) do update set title=excluded.title,description=excluded.description,status='active',visibility=excluded.visibility,school_id=excluded.school_id,updated_at=now()
  returning id into result_id;
  perform public.ce_reconcile_learning_resource_metadata(result_id);
  return result_id;
end;
$function$;

commit;

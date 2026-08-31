-- Canonical Scheme engine: expand KICD curriculum periods into lesson occurrences,
-- schedule by the authoritative weekly allocation, and bind exact published chapters.

drop index if exists public.scheme_no_duplicate_curriculum_item;
create unique index scheme_no_duplicate_curriculum_item
on public.scheme_of_work(
  teacher_id,class_id,subject_id,academic_term_id,week,curriculum_id,lesson_number
)
where curriculum_id is not null;

create or replace function public.generate_scheme_from_curriculum(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid,
  p_replace_planned boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_class public.classes%rowtype;
  v_subject public.subjects%rowtype;
  v_term public.academic_terms%rowtype;
  v_grade text;
  v_term_weeks integer;
  v_lessons_per_week integer;
  v_capacity integer;
  v_required integer;
  v_generated integer := 0;
  v_linked integer := 0;
  v_preserved integer := 0;
  v_is_admin boolean := false;
  v_teacher_id uuid;
  r record;
  v_scheme_id uuid;
  v_chapter_id uuid;
  v_publication_id uuid;
  v_resource_id uuid;
  v_lesson_title text;
  v_objectives text;
  v_week integer;
  v_period integer;
  v_seq integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok',false,'reason','auth_required');
  end if;

  select * into v_class from public.classes where id=p_class_id;
  if not found then return jsonb_build_object('ok',false,'reason','class_not_found'); end if;

  select * into v_subject from public.subjects where id=p_subject_id;
  if not found then return jsonb_build_object('ok',false,'reason','subject_not_found'); end if;

  select * into v_term from public.academic_terms where id=p_academic_term_id;
  if not found then return jsonb_build_object('ok',false,'reason','academic_term_not_found'); end if;

  if v_term.school_id is distinct from v_class.school_id then
    return jsonb_build_object('ok',false,'reason','term_school_mismatch');
  end if;
  if v_subject.school_id is not null and v_subject.school_id is distinct from v_class.school_id then
    return jsonb_build_object('ok',false,'reason','subject_school_mismatch');
  end if;

  v_is_admin := public.is_school_admin(v_class.school_id);
  v_teacher_id := coalesce(v_class.teacher_id,v_uid);
  if v_uid <> v_teacher_id and not v_is_admin then
    return jsonb_build_object('ok',false,'reason','not_authorized');
  end if;

  v_grade := nullif(btrim(v_class.name),'');
  if v_grade is null then return jsonb_build_object('ok',false,'reason','class_grade_missing'); end if;

  v_term_weeks := greatest(1,ceil(((v_term.end_date-v_term.start_date)+1)::numeric/7.0)::integer);

  select swa.lessons_per_week into v_lessons_per_week
  from public.subject_weekly_allocations swa
  where lower(regexp_replace(swa.grade,'[^a-z0-9]','','g'))=lower(regexp_replace(v_grade,'[^a-z0-9]','','g'))
    and lower(btrim(swa.subject_label))=lower(btrim(v_subject.name))
  order by swa.created_at desc limit 1;

  if coalesce(v_lessons_per_week,0)<=0 then
    return jsonb_build_object('ok',false,'reason','weekly_allocation_missing','grade',v_grade,'subject',v_subject.name);
  end if;

  select coalesce(sum(greatest(coalesce(c.periods,1),1)),0)::integer into v_required
  from public.curriculum c
  where c.term=v_term.term
    and lower(regexp_replace(c.grade,'[^a-z0-9]','','g'))=lower(regexp_replace(v_grade,'[^a-z0-9]','','g'))
    and lower(btrim(c.subject))=lower(btrim(v_subject.name));

  if v_required=0 then
    return jsonb_build_object('ok',false,'reason','curriculum_not_found','grade',v_grade,'subject',v_subject.name,'term',v_term.term);
  end if;

  v_capacity := v_term_weeks*v_lessons_per_week;
  if v_required>v_capacity then
    return jsonb_build_object('ok',false,'reason','curriculum_exceeds_term_capacity','required_lessons',v_required,'capacity',v_capacity,'term_weeks',v_term_weeks,'lessons_per_week',v_lessons_per_week);
  end if;

  select count(*) into v_preserved
  from public.scheme_of_work s
  where s.class_id=p_class_id and s.subject_id=p_subject_id and s.academic_term_id=p_academic_term_id
    and (s.source='custom' or s.status is distinct from 'planned');

  if p_replace_planned then
    delete from public.scheme_of_work s
    where s.class_id=p_class_id and s.subject_id=p_subject_id and s.academic_term_id=p_academic_term_id
      and s.source='curriculum' and s.status='planned';
  end if;

  for r in
    with ordered_curriculum as (
      select c.*,
        row_number() over(order by
          nullif(regexp_replace(split_part(coalesce(c.strand,''),' ',1),'[^0-9.]','','g'),'')::numeric nulls last,
          nullif(regexp_replace(split_part(coalesce(c.sub_strand,''),' ',1),'[^0-9.]','','g'),'')::numeric nulls last,
          c.created_at,c.id) as curriculum_order
      from public.curriculum c
      where c.term=v_term.term
        and lower(regexp_replace(c.grade,'[^a-z0-9]','','g'))=lower(regexp_replace(v_grade,'[^a-z0-9]','','g'))
        and lower(btrim(c.subject))=lower(btrim(v_subject.name))
    ), expanded as (
      select oc.*,gs as lesson_in_item
      from ordered_curriculum oc
      cross join lateral generate_series(1,greatest(coalesce(oc.periods,1),1)) gs
    )
    select e.*,row_number() over(order by curriculum_order,lesson_in_item)::integer as global_seq
    from expanded e order by global_seq
  loop
    v_seq := r.global_seq;
    v_week := ((v_seq-1)/v_lessons_per_week)+1;
    v_period := ((v_seq-1)%v_lessons_per_week)+1;

    select vc.id,vc.publication_id into v_chapter_id,v_publication_id
    from public.vibe_chapters vc
    join public.vibe_publications vp on vp.id=vc.publication_id
    where vc.curriculum_id=r.id and vc.status='published' and vp.status='published' and vp.cbc_aligned=true
    order by vc.updated_at desc limit 1;

    v_lesson_title := null;
    if v_chapter_id is not null then
      select b->>'content' into v_lesson_title
      from public.vibe_chapters vc,
        lateral jsonb_array_elements(case when jsonb_typeof(vc.blocks)='array' then vc.blocks else '[]'::jsonb end) b
      where vc.id=v_chapter_id
        and coalesce((b->'meta'->>'lesson_number')::integer,0)=r.lesson_in_item
        and b->>'type' in ('heading2','heading1','paragraph')
      order by case when b->>'type'='heading2' then 0 when b->>'type'='heading1' then 1 else 2 end
      limit 1;
      if v_lesson_title is not null then
        v_lesson_title := regexp_replace(v_lesson_title,'^Lesson\s+[0-9]+\s*[—:-]\s*','','i');
      end if;
    end if;

    if nullif(btrim(v_lesson_title),'') is null then
      v_lesson_title := coalesce(nullif(btrim(r.sub_strand),''),nullif(btrim(r.strand),''),'Curriculum lesson') || ' — Lesson ' || r.lesson_in_item;
    end if;

    v_objectives := nullif(btrim(r.topic),'');

    insert into public.scheme_of_work(
      school_id,teacher_id,class_id,subject_id,curriculum_id,curriculum_type,grade,subject,term,week,
      period,strand,sub_strand,topic,objectives,resources,reference,status,academic_term_id,source,
      lesson_number,key_inquiry_question,learning_resources,assessment_methods,learning_experiences,
      content_status,sequence_number
    ) values (
      v_class.school_id,v_teacher_id,p_class_id,p_subject_id,r.id,r.curriculum,v_grade,v_subject.name,v_term.term,v_week,
      v_period,r.strand,r.sub_strand,v_lesson_title,v_objectives,
      case when v_chapter_id is not null then 'VibeSchool published chapter' else null end,
      r.reference,'planned',p_academic_term_id,'curriculum',r.lesson_in_item,null,null,null,null,
      case when v_chapter_id is not null then 'linked' else 'curriculum_only' end,v_seq
    )
    on conflict (teacher_id,class_id,subject_id,academic_term_id,week,curriculum_id,lesson_number)
      where curriculum_id is not null
    do update set
      period=excluded.period,strand=excluded.strand,sub_strand=excluded.sub_strand,topic=excluded.topic,
      objectives=excluded.objectives,resources=excluded.resources,reference=excluded.reference,
      sequence_number=excluded.sequence_number,content_status=excluded.content_status,updated_at=now()
    returning id into v_scheme_id;

    v_generated := v_generated+1;

    if v_chapter_id is not null then
      select lr.id into v_resource_id
      from public.learning_resources lr
      where lr.chapter_id=v_chapter_id and lr.status='active'
      order by lr.updated_at desc limit 1;

      insert into public.scheme_lesson_resource_links(
        scheme_lesson_id,publication_id,chapter_id,resource_id,resource_role,sequence,exercise_refs,created_by
      ) values (
        v_scheme_id,v_publication_id,v_chapter_id,v_resource_id,'primary',1,'[]'::jsonb,v_teacher_id
      )
      on conflict (scheme_lesson_id,chapter_id,resource_role)
      do update set publication_id=excluded.publication_id,resource_id=excluded.resource_id,updated_at=now();
      v_linked := v_linked+1;
    end if;

    v_chapter_id := null;
    v_publication_id := null;
    v_resource_id := null;
  end loop;

  return jsonb_build_object(
    'ok',true,'reason',null,'generated_lessons',v_generated,'linked_lessons',v_linked,
    'preserved_non_planned_or_custom',v_preserved,'required_lessons',v_required,
    'term_weeks',v_term_weeks,'lessons_per_week',v_lessons_per_week,'capacity',v_capacity
  );
end;
$$;

grant execute on function public.generate_scheme_from_curriculum(uuid,uuid,uuid,boolean) to authenticated;

create or replace function public.ensure_scheme_from_curriculum(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_class public.classes%rowtype;
  v_subject public.subjects%rowtype;
  v_term public.academic_terms%rowtype;
  v_grade text;
  v_term_weeks integer;
  v_lessons_per_week integer;
  v_required integer;
  v_capacity integer;
  v_structural_mismatch integer := 0;
  v_historical_mismatch integer := 0;
  v_missing_links integer := 0;
  v_result jsonb;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'reason','auth_required'); end if;

  select * into v_class from public.classes where id=p_class_id;
  if not found then return jsonb_build_object('ok',false,'reason','class_not_found'); end if;
  select * into v_subject from public.subjects where id=p_subject_id;
  if not found then return jsonb_build_object('ok',false,'reason','subject_not_found'); end if;
  select * into v_term from public.academic_terms where id=p_academic_term_id;
  if not found then return jsonb_build_object('ok',false,'reason','academic_term_not_found'); end if;

  if v_term.school_id is distinct from v_class.school_id then return jsonb_build_object('ok',false,'reason','term_school_mismatch'); end if;
  if v_subject.school_id is not null and v_subject.school_id is distinct from v_class.school_id then return jsonb_build_object('ok',false,'reason','subject_school_mismatch'); end if;
  if v_uid <> coalesce(v_class.teacher_id,v_uid) and not public.is_school_admin(v_class.school_id) then return jsonb_build_object('ok',false,'reason','not_authorized'); end if;

  v_grade := nullif(btrim(v_class.name),'');
  if v_grade is null then return jsonb_build_object('ok',false,'reason','class_grade_missing'); end if;
  v_term_weeks := greatest(1,ceil(((v_term.end_date-v_term.start_date)+1)::numeric/7.0)::integer);

  select lessons_per_week into v_lessons_per_week
  from public.subject_weekly_allocations
  where lower(regexp_replace(grade,'[^a-z0-9]','','g'))=lower(regexp_replace(v_grade,'[^a-z0-9]','','g'))
    and lower(btrim(subject_label))=lower(btrim(v_subject.name))
  order by created_at desc limit 1;

  if coalesce(v_lessons_per_week,0)<=0 then return jsonb_build_object('ok',false,'reason','weekly_allocation_missing','grade',v_grade,'subject',v_subject.name); end if;

  select coalesce(sum(greatest(coalesce(periods,1),1)),0)::integer into v_required
  from public.curriculum
  where term=v_term.term
    and lower(regexp_replace(grade,'[^a-z0-9]','','g'))=lower(regexp_replace(v_grade,'[^a-z0-9]','','g'))
    and lower(btrim(subject))=lower(btrim(v_subject.name));

  if v_required=0 then return jsonb_build_object('ok',false,'reason','curriculum_not_found','grade',v_grade,'subject',v_subject.name,'term',v_term.term); end if;
  v_capacity := v_term_weeks*v_lessons_per_week;
  if v_required>v_capacity then return jsonb_build_object('ok',false,'reason','curriculum_exceeds_term_capacity','required_lessons',v_required,'capacity',v_capacity,'term_weeks',v_term_weeks,'lessons_per_week',v_lessons_per_week); end if;

  with ordered_curriculum as (
    select c.*,row_number() over(order by
      nullif(regexp_replace(split_part(coalesce(c.strand,''),' ',1),'[^0-9.]','','g'),'')::numeric nulls last,
      nullif(regexp_replace(split_part(coalesce(c.sub_strand,''),' ',1),'[^0-9.]','','g'),'')::numeric nulls last,
      c.created_at,c.id) as curriculum_order
    from public.curriculum c
    where c.term=v_term.term
      and lower(regexp_replace(c.grade,'[^a-z0-9]','','g'))=lower(regexp_replace(v_grade,'[^a-z0-9]','','g'))
      and lower(btrim(c.subject))=lower(btrim(v_subject.name))
  ), expanded as (
    select oc.id as curriculum_id,gs::integer as lesson_number,row_number() over(order by curriculum_order,gs)::integer as seq
    from ordered_curriculum oc cross join lateral generate_series(1,greatest(coalesce(oc.periods,1),1)) gs
  ), expected as (
    select curriculum_id,lesson_number,seq,(((seq-1)/v_lessons_per_week)+1)::integer as week,(((seq-1)%v_lessons_per_week)+1)::integer as period from expanded
  )
  select count(*)::integer into v_structural_mismatch
  from expected e
  left join public.scheme_of_work s
    on s.class_id=p_class_id and s.subject_id=p_subject_id and s.academic_term_id=p_academic_term_id
   and s.curriculum_id=e.curriculum_id and s.lesson_number=e.lesson_number
   and s.week=e.week and coalesce(s.period,e.period)=e.period and s.sequence_number=e.seq
  where s.id is null;

  with ordered_curriculum as (
    select c.*,row_number() over(order by
      nullif(regexp_replace(split_part(coalesce(c.strand,''),' ',1),'[^0-9.]','','g'),'')::numeric nulls last,
      nullif(regexp_replace(split_part(coalesce(c.sub_strand,''),' ',1),'[^0-9.]','','g'),'')::numeric nulls last,
      c.created_at,c.id) as curriculum_order
    from public.curriculum c
    where c.term=v_term.term
      and lower(regexp_replace(c.grade,'[^a-z0-9]','','g'))=lower(regexp_replace(v_grade,'[^a-z0-9]','','g'))
      and lower(btrim(c.subject))=lower(btrim(v_subject.name))
  ), expanded as (
    select oc.id as curriculum_id,gs::integer as lesson_number,row_number() over(order by curriculum_order,gs)::integer as seq
    from ordered_curriculum oc cross join lateral generate_series(1,greatest(coalesce(oc.periods,1),1)) gs
  ), expected as (
    select curriculum_id,lesson_number,seq,(((seq-1)/v_lessons_per_week)+1)::integer as week,(((seq-1)%v_lessons_per_week)+1)::integer as period from expanded
  )
  select count(*)::integer into v_historical_mismatch
  from public.scheme_of_work s
  left join expected e
    on e.curriculum_id=s.curriculum_id and e.lesson_number=s.lesson_number and e.week=s.week and e.seq=s.sequence_number
  where s.class_id=p_class_id and s.subject_id=p_subject_id and s.academic_term_id=p_academic_term_id
    and s.source='curriculum' and s.status<>'planned' and e.curriculum_id is null;

  if v_historical_mismatch>0 then return jsonb_build_object('ok',false,'reason','historical_scheme_structure_mismatch','rows',v_historical_mismatch); end if;

  with exact_chapter as (
    select distinct on (c.id) c.id as curriculum_id,vc.id as chapter_id
    from public.curriculum c
    join public.vibe_chapters vc on vc.curriculum_id=c.id and vc.status='published'
    join public.vibe_publications vp on vp.id=vc.publication_id and vp.status='published' and vp.cbc_aligned=true
    where c.term=v_term.term
      and lower(regexp_replace(c.grade,'[^a-z0-9]','','g'))=lower(regexp_replace(v_grade,'[^a-z0-9]','','g'))
      and lower(btrim(c.subject))=lower(btrim(v_subject.name))
    order by c.id,vc.updated_at desc
  )
  select count(*)::integer into v_missing_links
  from public.scheme_of_work s
  join exact_chapter ec on ec.curriculum_id=s.curriculum_id
  left join public.scheme_lesson_resource_links l on l.scheme_lesson_id=s.id and l.chapter_id=ec.chapter_id and l.resource_role='primary'
  where s.class_id=p_class_id and s.subject_id=p_subject_id and s.academic_term_id=p_academic_term_id
    and s.source='curriculum' and s.week between 1 and v_term_weeks and l.id is null;

  if v_structural_mismatch=0 and v_missing_links=0 then
    return jsonb_build_object('ok',true,'status','healthy','generated_lessons',0,'linked_lessons',0,'required_lessons',v_required,'capacity',v_capacity,'term_weeks',v_term_weeks,'lessons_per_week',v_lessons_per_week);
  end if;

  v_result := public.generate_scheme_from_curriculum(p_class_id,p_subject_id,p_academic_term_id,v_structural_mismatch>0);
  if coalesce((v_result->>'ok')::boolean,false) then
    return v_result || jsonb_build_object('status',case when v_structural_mismatch>0 then 'repaired' else 'relinked' end);
  end if;
  return v_result;
end;
$$;

grant execute on function public.ensure_scheme_from_curriculum(uuid,uuid,uuid) to authenticated;

-- P0 exact learning recovery: read-only learner plan using existing
-- assessment responses, outcome identities, published content and scoring evidence.
-- No parallel question bank, self-reported reading completion or mastery writes.
begin;

create or replace function public.student_get_exact_learning_recovery(
  p_attempt_id uuid default null,
  p_limit integer default 40
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_student uuid;
  v_limit integer := least(greatest(coalesce(p_limit,40),1),80);
  v_cases jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  v_student := public.current_student_id();
  if v_student is null then raise exception 'learner_identity_not_found'; end if;

  -- A supplied attempt must belong to this learner and have released results.
  -- Do not let a caller infer the existence of another learner's attempt.
  if p_attempt_id is not null and not exists (
    select 1 from public.assessment_attempts a
    where a.id=p_attempt_id and a.student_id=v_student and a.result_status='released'
  ) then
    raise exception 'released_attempt_not_found';
  end if;

  with missed as (
    select
      'assessment:'||ar.id::text||':'||coalesce(aio.outcome_id::text,'unlinked') as recovery_key,
      'released_assessment'::text as origin,
      a.id as attempt_id,
      ai.source_block_id,
      null::uuid as source_publication_id,
      ar.id as response_id,
      aio.outcome_id,
      ai.prompt,
      case when (ar.response_value='null'::jsonb or ar.response_value is null)
                   and nullif(btrim(coalesce(ar.response_text,'')),'') is null
           then 'skipped' else 'incorrect' end as reason,
      coalesce(ar.marked_at,a.submitted_at,a.created_at) as missed_at,
      ad.title as context_title
    from public.assessment_attempts a
    join public.assessment_definitions ad on ad.id=a.assessment_id
    join public.assessment_responses ar on ar.attempt_id=a.id
    join public.assessment_items ai on ai.id=ar.assessment_item_id
    left join public.assessment_item_outcomes aio on aio.assessment_item_id=ai.id
    where a.student_id=v_student
      and a.result_status='released'
      and (p_attempt_id is null or a.id=p_attempt_id)
      and ar.status<>'void'
      and ar.final_score is not null and ar.max_score>0
      and ar.final_score<ar.max_score
    union all
    select
      'notebook:'||m.id::text,
      'practice_notebook'::text,
      null::uuid,
      m.source_block_id,
      m.source_publication_id,
      null::uuid,
      m.outcome_id,
      m.prompt_snapshot,
      case when m.exam_question_id is not null and m.selected_index is null then 'skipped' else 'incorrect' end,
      m.last_missed_at,
      m.subject||' · '||m.topic
    from public.student_mistake_notebook m
    where p_attempt_id is null
      and m.student_id=v_student
      and m.status<>'resolved'
  ),
  selected as (
    select * from missed
    order by missed_at desc nulls last, recovery_key
    limit v_limit
  ),
  grounded as (
    select
      m.*,
      o.outcome_text,
      o.outcome_code,
      case
        when o.id is null then 'outcome_unlinked'
        when o.status<>'verified' then 'outcome_not_verified'
        else 'verified'
      end as identity_state,
      case when o.status='verified' then o.id else null end as eligible_outcome
    from selected m
    left join public.curriculum_learning_outcomes o on o.id=m.outcome_id
  ),
  packages as (
    select
      m.*,
      core.source as core_source,
      activity.source as activity_source,
      question.source as reassessment_question,
      coalesce(ev.attempts,0) as reassessment_attempts,
      coalesce(ev.correct_questions,0) as correct_distinct_questions,
      coalesce(ev.correct_days,0) as correct_distinct_days
    from grounded m
    left join lateral (
      select jsonb_build_object(
        'block_id',b.id,'title',coalesce(nullif(b.title,''),'Core explanation'),
        'block_type',b.block_type,
        'url','/read/textbook/'||b.publication_id::text||'?chapter='||b.chapter_id::text||'&block='||b.id::text
      ) as source
      from public.content_block_outcome_links l
      join public.content_blocks b on b.id=l.content_block_id
      join public.vibe_publications p on p.id=b.publication_id and p.status='published'
      join public.vibe_chapters c on c.id=b.chapter_id
        and c.publication_id=b.publication_id and c.status in ('published','locked')
      where l.outcome_id=m.eligible_outcome
        and b.status='published' and b.is_teacher_only=false
        and b.block_type in ('content','paragraph','workedExample','summary','keyPoints','callout')
        and nullif(btrim(coalesce(b.plain_text,'')),'') is not null
        and public.can_viewer_read_chapter(b.chapter_id,v_uid)
      order by case when b.publication_id=m.source_publication_id then 0 else 1 end,
               case b.block_type when 'workedExample' then 0 when 'content' then 1 else 2 end,
               b.sequence,b.id
      limit 1
    ) core on true
    left join lateral (
      select jsonb_build_object(
        'block_id',b.id,'title',coalesce(nullif(b.title,''),'Practice activity'),
        'block_type',b.block_type,
        'url','/read/textbook/'||b.publication_id::text||'?chapter='||b.chapter_id::text||'&block='||b.id::text
      ) as source
      from public.content_block_outcome_links l
      join public.content_blocks b on b.id=l.content_block_id
      join public.vibe_publications p on p.id=b.publication_id and p.status='published'
      join public.vibe_chapters c on c.id=b.chapter_id
        and c.publication_id=b.publication_id and c.status in ('published','locked')
      where l.outcome_id=m.eligible_outcome
        and b.status='published' and b.is_teacher_only=false
        and b.block_type in ('activity','interactive')
        and nullif(btrim(coalesce(b.plain_text,'')),'') is not null
        and public.can_viewer_read_chapter(b.chapter_id,v_uid)
      order by case when b.publication_id=m.source_publication_id then 0 else 1 end,b.sequence,b.id
      limit 1
    ) activity on true
    left join lateral (
      -- A fresh, server-markable, different question for THIS exact outcome.
      -- Never include its answer key in the learner payload.
      select jsonb_build_object(
        'content_block_id',b.id,
        'prompt',btrim(split_part(b.plain_text,'Answer:',1)),
        'outcome_id',m.eligible_outcome
      ) as source
      from public.content_block_outcome_links l
      join public.content_blocks b on b.id=l.content_block_id
      join public.vibe_publications p on p.id=b.publication_id and p.status='published'
      join public.vibe_chapters c on c.id=b.chapter_id
        and c.publication_id=b.publication_id and c.status in ('published','locked')
      where l.outcome_id=m.eligible_outcome
        and b.status='published' and b.is_teacher_only=false
        and b.is_assessable=true and b.block_type='question'
        and b.id is distinct from m.source_block_id
        -- The server scorer chooses the FIRST verified outcome for a block;
        -- only offer this block when that exact authoritative identity agrees.
        and (
          select l2.outcome_id
          from public.content_block_outcome_links l2
          join public.curriculum_learning_outcomes o2
            on o2.id=l2.outcome_id and o2.status='verified'
          where l2.content_block_id=b.id
          order by l2.created_at
          limit 1
        )=m.eligible_outcome
        and position('Answer:' in coalesce(b.plain_text,''))>0
        and nullif(btrim(split_part(b.plain_text,'Answer:',1)),'') is not null
        and nullif(btrim(split_part(b.plain_text,'Answer:',2)),'') is not null
        and public.can_viewer_read_chapter(b.chapter_id,v_uid)
        and not exists (
          select 1 from public.student_learning_events e
          where e.student_id=v_uid and e.source_type='content_block'
            and e.source_id=b.id and e.event_type='practice_answered'
        )
      order by case when b.publication_id=m.source_publication_id then 0 else 1 end,b.sequence,b.id
      limit 1
    ) question on true
    left join lateral (
      -- Only server-scored ledger-backed attempts count. Topic-name matches,
      -- reading clicks, answers on the original item, and prior attempts do not.
      select
        count(distinct e.id)::integer as attempts,
        count(distinct e.source_id) filter (where cel.score=cel.max_score and cel.max_score>0)::integer as correct_questions,
        count(distinct (e.occurred_at at time zone 'Africa/Nairobi')::date)
          filter (where cel.score=cel.max_score and cel.max_score>0)::integer as correct_days
      from public.student_learning_events e
      join public.competency_evidence_ledger cel
        on cel.evidence_source='quiz' and cel.evidence_id=e.id
        and cel.student_id=v_student and cel.outcome_id=m.eligible_outcome
      join public.content_block_outcome_links link
        on link.content_block_id=e.source_id and link.outcome_id=m.eligible_outcome
      where e.student_id=v_uid and e.event_type='practice_answered'
        and e.source_type='content_block'
        and e.occurred_at>m.missed_at
        and e.source_id is distinct from m.source_block_id
        and e.metadata->>'outcome_id'=m.eligible_outcome::text
    ) ev on true
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'recovery_key', recovery_key,
      'origin',origin,
      'attempt_id',attempt_id,
      'reason',reason,
      'prompt',prompt,
      'missed_at',missed_at,
      'context_title',context_title,
      'outcome_id',outcome_id,
      'outcome_code',outcome_code,
      'outcome_text',outcome_text,
      'identity_state',identity_state,
      'core',core_source,
      'activity',activity_source,
      'reassessment',reassessment_question,
      'reassessment_attempts',reassessment_attempts,
      'correct_distinct_questions',correct_distinct_questions,
      'correct_distinct_days',correct_distinct_days,
      'recovery_evidence_met',correct_distinct_questions>=3 and correct_distinct_days>=2
    ) order by missed_at desc nulls last,recovery_key
  ),'[]'::jsonb)
  into v_cases
  from packages;

  return jsonb_build_object(
    'ok',true,
    'cases',v_cases,
    'policy',jsonb_build_object(
      'exact_outcome_only',true,
      'requires_verified_outcome',true,
      'protected_assessment_answers_excluded',true,
      'fresh_question_must_differ',true,
      'requires_server_scored_ledger_evidence',true,
      'recovery_threshold','3 different correct questions across at least 2 days',
      'read_or_activity_click_is_not_completion',true,
      'recovery_evidence_is_not_automatic_mastery',true
    )
  );
end;
$function$;

revoke all on function public.student_get_exact_learning_recovery(uuid,integer)
  from public,anon;
grant execute on function public.student_get_exact_learning_recovery(uuid,integer)
  to authenticated;

-- Skips from canonical Topic Practice must survive navigation or device reload.
-- This records no success, revision, or mastery; the key prevents double credit
-- or duplicate misses after retrying the same HTTP request.
create unique index if not exists student_practice_skips_idempotent_uidx
  on public.student_practice_attempts(student_id,session_id,exam_question_id)
  where source='vibelearn_skip' and session_id is not null;

create or replace function public.student_record_vibelearn_practice_skip(
  p_exam_question_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $skip$
declare
  v_profile uuid := auth.uid();
  v_student uuid;
  q record;
  v_receipt uuid;
  v_outcome uuid;
begin
  if v_profile is null then raise exception 'authentication_required'; end if;
  if p_session_id is null then raise exception 'session_id_required'; end if;
  v_student:=public.current_student_id();
  if v_student is null then raise exception 'learner_identity_not_found'; end if;

  select id,subject::text as subject,topic,difficulty::text as difficulty,
         question,correct_index,explanation,hint
    into q
  from public.exam_question_bank
  where id=p_exam_question_id and status='active'
    and provenance_status in ('teacher_verified','publisher_verified','official_verified');
  if not found then raise exception 'verified_practice_question_not_found'; end if;

  -- Only a single exact, verified outcome link may be attached to this bank
  -- question. Never infer identity from the subject or topic name.
  select min(link.outcome_id)
    into v_outcome
  from public.assessment_items item
  join public.assessment_item_outcomes link on link.assessment_item_id=item.id
  join public.curriculum_learning_outcomes o on o.id=link.outcome_id and o.status='verified'
  where item.source_exam_question_id=q.id and item.status='approved'
  having count(distinct link.outcome_id)=1;

  insert into public.student_practice_attempts(
    student_id,exam_question_id,selected_index,correct_index,is_correct,
    subject,topic,difficulty,session_id,source
  ) values (
    v_student,q.id,null,q.correct_index,false,
    q.subject,q.topic,q.difficulty,p_session_id,'vibelearn_skip'
  )
  on conflict do nothing
  returning id into v_receipt;

  if v_receipt is null then
    return jsonb_build_object('ok',true,'already_recorded',true,'skipped',true);
  end if;

  insert into public.student_mistake_notebook(
    student_id,exam_question_id,subject,topic,prompt_snapshot,
    selected_index,correct_index,explanation_snapshot,hint_snapshot,
    outcome_id,status,first_missed_at,last_missed_at
  ) values (
    v_student,q.id,q.subject,q.topic,q.question,
    null,q.correct_index,q.explanation,q.hint,
    v_outcome,'open',now(),now()
  )
  on conflict(student_id,exam_question_id) do update set
    selected_index=null,
    outcome_id=excluded.outcome_id,
    repeat_count=public.student_mistake_notebook.repeat_count+1,
    status='open',resolved_at=null,last_missed_at=now();

  insert into public.student_learning_events(
    student_id,event_type,source_type,source_id,xp_awarded,occurred_at,metadata
  ) values (
    v_student,'practice_skipped','exam_question',q.id,0,now(),
    jsonb_build_object('session_id',p_session_id,'outcome_id',v_outcome)
  );
  return jsonb_build_object('ok',true,'skipped',true,'already_recorded',false,
                            'outcome_id',v_outcome);
end;
$skip$;

revoke all on function public.student_record_vibelearn_practice_skip(uuid,uuid)
  from public,anon;
grant execute on function public.student_record_vibelearn_practice_skip(uuid,uuid)
  to authenticated;

commit;

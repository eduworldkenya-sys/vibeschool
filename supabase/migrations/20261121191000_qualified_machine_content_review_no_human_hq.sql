-- VibeSchool original content: reviewer identity is separate from a human HQ member.
-- This is a NON-COMMISSIONING migration. No new reviewer account, grant or PASS
-- receipt is minted, and no existing publication/approval is modified.
-- Production worker commissioning and actual independent review remain required.
begin;

create table if not exists public.ce_machine_content_commissions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.vibe_publications(id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  commissioned_by uuid not null references auth.users(id) on delete restrict,
  worker_key text not null check (length(btrim(worker_key))>=12),
  subject_profile text not null check (length(btrim(subject_profile))>=5),
  rubric_key text not null check (length(btrim(rubric_key))>=8),
  stages text[] not null check (
    array_length(stages,1) between 1 and 5 and
    stages <@ array['teacher_guide','assessment','release','curriculum_source','resource_certification']::text[]
  ),
  qualification_evidence jsonb not null check (
    jsonb_typeof(qualification_evidence)='object' and qualification_evidence<>'{}'::jsonb
  ),
  commissioned_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  unique(publication_id,reviewer_user_id,worker_key),
  check(expires_at>commissioned_at and expires_at<=commissioned_at+interval '30 days')
);
create index if not exists ce_machine_content_commissions_active_idx
 on public.ce_machine_content_commissions(publication_id,reviewer_user_id,expires_at)
 where revoked_at is null;

create table if not exists public.ce_machine_content_review_receipts (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.ce_machine_content_commissions(id) on delete restrict,
  stage text not null check(stage in ('teacher_guide','assessment','release','curriculum_source','resource_certification')),
  artifact_id uuid not null,
  content_sha256 text not null check(content_sha256 ~ '^[a-f0-9]{64}$'),
  independent_execution_id text not null check(length(btrim(independent_execution_id))>=12),
  decision text not null check(decision='PASS'),
  quality_score numeric not null check(quality_score>=85 and quality_score<=100),
  hard_blockers jsonb not null check(hard_blockers='[]'::jsonb),
  review_evidence jsonb not null check(
    jsonb_typeof(review_evidence)='object' and
    review_evidence ? 'curriculum_reference' and
    review_evidence ? 'subject_accuracy' and
    review_evidence ? 'assessment_coherence' and
    review_evidence ? 'rights_and_provenance' and
    review_evidence ? 'independence'
  ),
  reviewed_at timestamptz not null default clock_timestamp(),
  unique(commission_id,stage,artifact_id,content_sha256,independent_execution_id)
);
create index if not exists ce_machine_review_receipts_lookup_idx
 on public.ce_machine_content_review_receipts(commission_id,stage,artifact_id,content_sha256,reviewed_at desc);
alter table public.ce_machine_content_commissions enable row level security;
alter table public.ce_machine_content_review_receipts enable row level security;
revoke all on public.ce_machine_content_commissions from public,anon,authenticated,service_role;
revoke all on public.ce_machine_content_review_receipts from public,anon,authenticated,service_role;

create or replace function public.ce_is_human_content_approver(p_actor uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select p_actor is not null and public.hq_profile_is_active(p_actor) and exists (
    select 1 from public.hq_human_members hm
    where hm.profile_id=p_actor and hm.status='active' and hm.revoked_at is null
      and hm.suspended_at is null
      and (hm.access_expires_at is null or hm.access_expires_at>clock_timestamp())
      and hm.role in ('reviewer','partner_admin','hq_admin')
      and 'content.approve'=any(hm.permissions)
 );
$$;
revoke all on function public.ce_is_human_content_approver(uuid) from public,anon,authenticated,service_role;

create or replace function public.ce_machine_assessment_sha256(p_assessment_id uuid)
returns text language sql stable security definer set search_path=''
as $$
 select encode(extensions.digest(convert_to(
  jsonb_build_object('assessment_id',a.id,'version',a.version,'marks',a.total_marks,
    'questions',coalesce((select jsonb_agg(
       jsonb_build_object('id',i.id,'sequence',i.sequence,'prompt',i.prompt,
       'options',i.options,'answer_key',i.answer_key,'marks',i.marks,
       'source_block_id',i.source_block_id,'outcome_id',i.outcome_id)
       order by i.sequence)
       from public.generated_assessment_items i where i.assessment_id=a.id),'[]'::jsonb)
  )::text,'UTF8'),'sha256'),'hex')
 from public.generated_assessments a where a.id=p_assessment_id;
$$;
revoke all on function public.ce_machine_assessment_sha256(uuid) from public,anon,authenticated,service_role;

-- This validates actual independent artifact/version evidence, not a model's
-- unbound "approved" text. A receipt cannot be created by a browser reviewer.
create or replace function public.ce_require_machine_review_receipt(
 p_publication_id uuid,p_stage text,p_artifact_id uuid,p_hash text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_reviewer uuid:=auth.uid(); v_author uuid;
begin
 select author_id into v_author from public.vibe_publications
  where id=p_publication_id and status='draft';
 if v_reviewer is null or v_author is null or v_reviewer=v_author or p_hash !~ '^[a-f0-9]{64}$' then
   raise exception using errcode='42501',message='MACHINE_REVIEW_AUTH_OR_FINGERPRINT_REQUIRED';
 end if;
 if not exists (
  select 1
   from public.ce_machine_content_commissions c
   join public.ce_machine_content_review_receipts e on e.commission_id=c.id
  where c.publication_id=p_publication_id and c.reviewer_user_id=v_reviewer
    and c.revoked_at is null and c.expires_at>clock_timestamp()
    and p_stage=any(c.stages) and e.stage=p_stage and e.artifact_id=p_artifact_id
    and e.content_sha256=p_hash and e.decision='PASS'
    and e.quality_score>=85 and e.hard_blockers='[]'::jsonb
    and e.reviewed_at>=clock_timestamp()-interval '24 hours'
    and e.reviewed_at<=clock_timestamp()
    and e.reviewed_at>=c.commissioned_at and e.reviewed_at<c.expires_at
    and nullif(btrim(c.worker_key),'') is not null
    and nullif(btrim(c.rubric_key),'') is not null
 ) then raise exception using errcode='23514',message='INDEPENDENT_MACHINE_REVIEW_RECEIPT_REQUIRED'; end if;
end $$;
revoke all on function public.ce_require_machine_review_receipt(uuid,text,uuid,text)
 from public,anon,authenticated,service_role;

-- One-time scoped commissioning through a genuine owner session, not HQ UI.
-- A machine reviewer is a real auth.users principal, never a fake human membership.
create or replace function public.ce_commission_machine_content_reviewer(
 p_publication_id uuid,p_reviewer_user_id uuid,p_worker_key text,
 p_subject_profile text,p_rubric_key text,p_stages text[],
 p_qualification_evidence jsonb,p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_owner uuid:=auth.uid(); v_author uuid; v_id uuid;
begin
 if v_owner is null or not public.is_platform_owner() then
   raise exception using errcode='42501',message='MACHINE_REVIEW_COMMISSION_OWNER_AUTH_REQUIRED';
 end if;
 select author_id into v_author from public.vibe_publications
  where id=p_publication_id and status='draft';
 if v_author is null or p_reviewer_user_id=v_author or p_reviewer_user_id=v_owner then
   raise exception 'MACHINE_REVIEW_INDEPENDENT_IDENTITY_REQUIRED';
 end if;
 if not exists(select 1 from auth.users u where u.id=p_reviewer_user_id) then
   raise exception 'MACHINE_REVIEW_REAL_AUTH_IDENTITY_REQUIRED';
 end if;
 if coalesce(jsonb_typeof(p_qualification_evidence),'')<>'object'
    or coalesce(p_qualification_evidence->>'subject_qualification','')=''
    or coalesce(p_qualification_evidence->>'independent_review_protocol','')=''
    or nullif(btrim(p_worker_key),'') is null
    or p_expires_at<=clock_timestamp() or
       p_expires_at>clock_timestamp()+interval '30 days' then
   raise exception 'MACHINE_REVIEW_QUALIFICATION_EVIDENCE_REQUIRED';
 end if;
 if lower(regexp_replace(coalesce(p_subject_profile,''),'\s+','','g')) is distinct from
   (select lower(regexp_replace(coalesce(p.cbc_grade,'')||':'||coalesce(p.cbc_subject,''),'\s+','','g'))
      from public.vibe_publications p where p.id=p_publication_id)
 then raise exception 'MACHINE_REVIEW_SUBJECT_QUALIFICATION_MISMATCH'; end if;
 if p_stages is null or array_length(p_stages,1) is null or
    not (p_stages <@ array['teacher_guide','assessment','release','curriculum_source','resource_certification']::text[]) then
   raise exception 'MACHINE_REVIEW_STAGE_SCOPE_REQUIRED';
 end if;
 insert into public.ce_machine_content_commissions
  (publication_id,reviewer_user_id,commissioned_by,worker_key,subject_profile,
   rubric_key,stages,qualification_evidence,expires_at)
 values(p_publication_id,p_reviewer_user_id,v_owner,p_worker_key,p_subject_profile,
   p_rubric_key,p_stages,p_qualification_evidence,p_expires_at)
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ce_commission_machine_content_reviewer(uuid,uuid,text,text,text,text[],jsonb,timestamptz)
 from public,anon,authenticated,service_role;
grant execute on function public.ce_commission_machine_content_reviewer(uuid,uuid,text,text,text,text[],jsonb,timestamptz)
 to authenticated;

-- Service-side independent critic ingestion, not front-end user writing.
-- The worker must have a separate commissioning record issued by the owner.
create or replace function public.ce_record_machine_content_review(
 p_commission_id uuid,p_stage text,p_artifact_id uuid,p_hash text,
 p_execution_id text,p_quality_score numeric,p_hard_blockers jsonb,p_review_evidence jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$
declare c public.ce_machine_content_commissions%rowtype; v_id uuid;
begin
 select * into c from public.ce_machine_content_commissions
  where id=p_commission_id and revoked_at is null and expires_at>clock_timestamp()
  for share;
 if not found or not(p_stage=any(c.stages)) then
   raise exception 'MACHINE_REVIEW_COMMISSION_MISSING_OR_EXPIRED';
 end if;
 if p_stage='teacher_guide' and not exists(
    select 1 from public.content_derivatives d
    where d.id=p_artifact_id and d.source_publication_id=c.publication_id
       and encode(extensions.digest(convert_to(d.body::text,'UTF8'),'sha256'),'hex')=p_hash
       and d.status='draft'
  ) then raise exception 'MACHINE_REVIEW_TEACHER_GUIDE_HASH_MISMATCH'; end if;
 if p_stage='assessment' and not exists(
    select 1 from public.generated_assessments a
    join public.content_assessment_sources s on s.blueprint_id=a.blueprint_id
    join public.learning_resources r on r.id=s.resource_id
    where a.id=p_artifact_id and r.publication_id=c.publication_id
       and a.status='moderation'
       and public.ce_machine_assessment_sha256(a.id)=p_hash
  ) then raise exception 'MACHINE_REVIEW_ASSESSMENT_HASH_MISMATCH'; end if;
 if p_stage='release' and (p_artifact_id<>c.publication_id or
     public.publication_release_fingerprint(c.publication_id) is distinct from p_hash) then
   raise exception 'MACHINE_REVIEW_EXACT_RELEASE_FINGERPRINT_REQUIRED'; end if;
 if p_stage='curriculum_source' and (
     p_artifact_id is distinct from c.publication_id
     or p_review_evidence->>'verified_host' is distinct from 'kicd.ac.ke'
     or p_review_evidence->>'official_source_sha256' is distinct from p_hash
     or coalesce(p_review_evidence->>'retrieval_method','')=''
     or not exists(
        select 1 from public.vs_curriculum_package_scopes scope
        join public.vibe_publications p on p.id=c.publication_id
        join public.cbc_strands s on s.id=scope.sub_strand_id
        where scope.source_url=p_review_evidence->>'source_url'
          and scope.source_url ~ '^https://kicd[.]ac[.]ke/'
          and s.grade=p.cbc_grade and lower(p.cbc_subject)='mathematics'
     )
   ) then raise exception 'MACHINE_REVIEW_OFFICIAL_SOURCE_EVIDENCE_REQUIRED';
 end if;
 if p_stage='resource_certification' and not exists(
   select 1 from public.learning_resource_versions v
   join public.learning_resources root on root.id=v.resource_id
   where v.id=p_artifact_id and root.publication_id=c.publication_id
     and v.version>0 and v.lifecycle_status='verified'
     and v.rights_status in('cleared','not_applicable')
     and v.content_sha256=p_hash
     and v.verified_at is not null
 ) then raise exception 'MACHINE_REVIEW_RESOURCE_VERSION_PROOF_REQUIRED'; end if;
 if p_stage not in ('teacher_guide','assessment','release','curriculum_source','resource_certification') then
   raise exception 'MACHINE_REVIEW_UNKNOWN_STAGE';
 end if;
 if p_quality_score<85 or p_quality_score>100 or
    p_hard_blockers is distinct from '[]'::jsonb or
    coalesce(p_review_evidence->>'curriculum_reference','')='' or
    coalesce(p_review_evidence->>'subject_accuracy','')='' or
    coalesce(p_review_evidence->>'assessment_coherence','')='' or
    coalesce(p_review_evidence->>'rights_and_provenance','')='' or
    coalesce(p_review_evidence->>'independence','')='' or
    length(coalesce(p_execution_id,''))<12 then
    raise exception 'MACHINE_REVIEW_INDEPENDENT_QUALITY_EVIDENCE_REQUIRED';
 end if;
 insert into public.ce_machine_content_review_receipts
 (commission_id,stage,artifact_id,content_sha256,independent_execution_id,
  quality_score,hard_blockers,review_evidence,decision)
 values(p_commission_id,p_stage,p_artifact_id,p_hash,p_execution_id,
   p_quality_score,p_hard_blockers,p_review_evidence,'PASS')
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ce_record_machine_content_review(uuid,text,uuid,text,text,numeric,jsonb,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.ce_record_machine_content_review(uuid,text,uuid,text,text,numeric,jsonb,jsonb)
 to service_role;
create or replace function public.ce_require_independent_content_approver(
  p_publication_id uuid, p_created_by uuid default null)
returns void language plpgsql security definer set search_path=public,pg_temp
as $content_authority$
declare v_actor uuid:=auth.uid(); v_author uuid;
begin
  if v_actor is null or
    (not public.ce_is_human_content_approver(v_actor) and not exists (
      select 1 from public.ce_machine_content_commissions c
       where c.reviewer_user_id=v_actor and c.publication_id=p_publication_id
         and c.revoked_at is null and c.expires_at>clock_timestamp()
    )) then
    raise exception using errcode='42501',message='CONTENT_APPROVER_AUTH_REQUIRED';
  end if;
  select author_id into v_author from public.vibe_publications
   where id=p_publication_id and status='draft';
  if v_author is null then
    raise exception using errcode='23514',message='REVIEWABLE_DRAFT_PUBLICATION_REQUIRED';
  end if;
  if v_actor=v_author or (p_created_by is not null and v_actor=p_created_by) then
    raise exception using errcode='42501',message='AUTHOR_CANNOT_INDEPENDENTLY_APPROVE';
  end if;
end $content_authority$;

CREATE OR REPLACE FUNCTION public.hq_review_teacher_guide(p_derivative_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare d public.content_derivatives%rowtype; v_work uuid; begin
 -- Scoped, authenticated, independent content reviewer checked after artifact lookup.
 select * into d from public.content_derivatives where id=p_derivative_id for update; if not found then raise exception 'Teacher guide not found'; end if;
 if d.body->>'kind'<>'teacher_guide' then raise exception 'TEACHER_GUIDE_SHAPE_REQUIRED'; end if;
 perform public.ce_require_independent_content_approver(d.source_publication_id,d.created_by);
 if p_approve and not public.ce_is_human_content_approver(auth.uid()) then
   perform public.ce_require_machine_review_receipt(
     d.source_publication_id,'teacher_guide',d.id,
     encode(extensions.digest(convert_to(d.body::text,'UTF8'),'sha256'),'hex')
   );
 end if;
 if not p_approve and not public.ce_is_human_content_approver(auth.uid()) then
   raise exception 'MACHINE_REJECTION_REQUIRES_INDEPENDENT_NEGATIVE_REVIEW';
 end if;
 if p_approve then
   if nullif(btrim(p_note),'') is null then raise exception 'INDEPENDENT_REVIEW_NOTE_REQUIRED'; end if;
   if coalesce((public.content_worker_teacher_guide_self_review(d.body,d.quality)->>'passed')::boolean,false) is distinct from true then
     raise exception 'TEACHER_GUIDE_QUALITY_CHECK_FAILED';
   end if;
   if d.source_chapter_id is null or d.source_resource_id is null or
      not exists (select 1 from public.vibe_chapters c where c.id=d.source_chapter_id and c.publication_id=d.source_publication_id) or
      not exists (select 1 from public.learning_resources r where r.id=d.source_resource_id and r.chapter_id=d.source_chapter_id and r.publication_id=d.source_publication_id)
      then raise exception 'TEACHER_GUIDE_SOURCE_SCOPE_REQUIRED'; end if;
 end if;
 if d.derivative_type<>'teacher_notes' or d.audience<>'teacher' or d.status<>'draft' then raise exception 'Teacher guide is not reviewable'; end if;
 update public.content_derivatives set status=case when p_approve then 'approved' else 'archived' end,quality=coalesce(quality,'{}'::jsonb)||jsonb_build_object('reviewed_by',auth.uid(),'reviewed_at',now(),'review_note',p_note,'approved',p_approve),updated_at=now() where id=p_derivative_id returning * into d;
 update public.hq_work_items set status='resolved',acted_at=now(),resolved_at=now(),owner_id=coalesce(owner_id,auth.uid()),verification_status=case when p_approve then 'verified' else 'not_required' end,action_taken=jsonb_build_object('action',case when p_approve then 'approve_teacher_guide' else 'reject_teacher_guide' end,'derivative_id',p_derivative_id,'note',p_note),verification_evidence=jsonb_build_object('derivative_status',d.status),updated_at=now() where source_type='content_derivative' and source_id=p_derivative_id and status in ('open','in_progress','waiting_approval') returning id into v_work;
 return jsonb_build_object('derivative_id',p_derivative_id,'status',d.status,'hq_work_item_id',v_work);
end $function$;

CREATE OR REPLACE FUNCTION public.hq_review_generated_assessment(p_assessment_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a public.generated_assessments%rowtype; v_items int; v_missing_source int; v_missing_answer int; v_marks numeric; v_work uuid; v_publication uuid; v_pub_count integer; begin
 -- Independent content permission checked against the only linked publication below.
 select * into a from public.generated_assessments where id=p_assessment_id for update; if not found then raise exception 'Assessment not found'; end if;
 select count(distinct r.publication_id),(array_agg(distinct r.publication_id))[1]
 into v_pub_count,v_publication
 from public.content_assessment_sources cas
 join public.learning_resources r on r.id=cas.resource_id
 where cas.blueprint_id=a.blueprint_id;
 if v_pub_count is distinct from 1 or v_publication is null then
   raise exception 'ASSESSMENT_SINGLE_PUBLICATION_SCOPE_REQUIRED';
 end if;
 perform public.ce_require_independent_content_approver(v_publication,a.generated_by);
 if p_approve and not public.ce_is_human_content_approver(auth.uid()) then
   perform public.ce_require_machine_review_receipt(
     v_publication,'assessment',a.id,public.ce_machine_assessment_sha256(a.id)
   );
 end if;
 if not p_approve and not public.ce_is_human_content_approver(auth.uid()) then
   raise exception 'MACHINE_REJECTION_REQUIRES_INDEPENDENT_NEGATIVE_REVIEW';
 end if;
 if p_approve and nullif(btrim(p_note),'') is null then raise exception 'INDEPENDENT_REVIEW_NOTE_REQUIRED'; end if;
 if a.status<>'moderation' then raise exception 'Assessment is not in moderation'; end if;
 select count(*),count(*) filter(where source_block_id is null),count(*) filter(where coalesce(answer_key,'{}'::jsonb)='{}'::jsonb),coalesce(sum(marks),0) into v_items,v_missing_source,v_missing_answer,v_marks from public.generated_assessment_items where assessment_id=p_assessment_id;
 if p_approve and (v_items<6 or v_missing_source>0 or v_missing_answer>0 or v_marks<>a.total_marks) then raise exception 'Assessment moderation gate failed: items %, missing_source %, missing_answer %, item_marks %, assessment_marks %',v_items,v_missing_source,v_missing_answer,v_marks,a.total_marks; end if;
 update public.generated_assessments set status=case when p_approve then 'approved' else 'archived' end,moderated_by=auth.uid(),moderated_at=now(),updated_at=now() where id=p_assessment_id returning * into a;
 if p_approve then update public.content_assessment_blueprints set status='approved',updated_at=now() where id=a.blueprint_id; end if;
 update public.hq_work_items set status='resolved',acted_at=now(),resolved_at=now(),owner_id=coalesce(owner_id,auth.uid()),verification_status=case when p_approve then 'verified' else 'not_required' end,action_taken=jsonb_build_object('action',case when p_approve then 'approve_assessment' else 'reject_assessment' end,'assessment_id',p_assessment_id,'note',p_note),verification_evidence=jsonb_build_object('assessment_status',a.status,'item_count',v_items,'missing_source',v_missing_source,'missing_answer',v_missing_answer,'total_marks',v_marks),updated_at=now() where source_type='generated_assessment' and source_id=p_assessment_id and status in ('open','in_progress','waiting_approval') returning id into v_work;
 return jsonb_build_object('assessment_id',p_assessment_id,'status',a.status,'item_count',v_items,'total_marks',v_marks,'hq_work_item_id',v_work);
end $function$;

CREATE OR REPLACE FUNCTION public.hq_review_publication_release(p_publication_id uuid, p_approve boolean, p_notes text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_fingerprint text;
  v_chapters integer;
  v_checks integer;
  v_failures integer;
begin
  perform public.ce_require_independent_content_approver(p_publication_id,null);
  if p_approve and not public.ce_is_human_content_approver(auth.uid()) then
    perform public.ce_require_machine_review_receipt(
      p_publication_id,'release',p_publication_id,
      public.publication_release_fingerprint(p_publication_id)
    );
  end if;
  if not coalesce(p_approve,false) and not public.ce_is_human_content_approver(auth.uid()) then
    raise exception 'MACHINE_REJECTION_REQUIRES_INDEPENDENT_NEGATIVE_REVIEW';
  end if;
  if coalesce(p_approve,false) and nullif(btrim(p_notes),'') is null then
    raise exception 'INDEPENDENT_REVIEW_NOTE_REQUIRED';
  end if;

  if not exists(select 1 from public.vibe_publications where id=p_publication_id and status='draft') then
    raise exception 'Draft publication required for release review';
  end if;

  if coalesce(p_approve,false) then
    perform 1 from public.hq_run_publication_release_check(p_publication_id);

    select count(*) into v_chapters from public.vibe_chapters where publication_id=p_publication_id;
    select count(*), count(*) filter(where status='fail')
      into v_checks,v_failures
      from public.publication_release_checks
      where publication_id=p_publication_id;

    if v_chapters < 1 or v_checks <> (v_chapters*8 + 2) or v_failures <> 0 then
      raise exception 'publication_release_checks_not_green:chapters=%,checks=%,failures=%',v_chapters,v_checks,v_failures;
    end if;
  end if;

  v_fingerprint:=public.publication_release_fingerprint(p_publication_id);
  if v_fingerprint is null then raise exception 'Publication not found'; end if;

  insert into public.publication_release_approvals(
    publication_id,status,content_fingerprint,reviewed_by,reviewed_at,notes
  ) values (
    p_publication_id,
    case when coalesce(p_approve,false) then 'approved' else 'rejected' end,
    v_fingerprint,v_uid,clock_timestamp(),coalesce(p_notes,'')
  )
  on conflict(publication_id) do update set
    status=excluded.status,
    content_fingerprint=excluded.content_fingerprint,
    reviewed_by=excluded.reviewed_by,
    reviewed_at=excluded.reviewed_at,
    notes=excluded.notes;

  return jsonb_build_object(
    'publication_id',p_publication_id,
    'status',case when coalesce(p_approve,false) then 'approved' else 'rejected' end,
    'content_fingerprint',v_fingerprint,
    'reviewed_by',v_uid
  );
end $function$;



-- Owner can stop a reviewer without visiting HQ.
create or replace function public.ce_revoke_machine_content_reviewer(p_commission_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $
declare v_owner uuid:=auth.uid(); v_changed integer;
begin
 if v_owner is null or not public.is_platform_owner() then
    raise exception 'MACHINE_REVIEW_REVOKE_OWNER_AUTH_REQUIRED';
 end if;
 update public.ce_machine_content_commissions
   set revoked_at=clock_timestamp()
 where id=p_commission_id and commissioned_by=v_owner and revoked_at is null;
 get diagnostics v_changed=row_count;
 return v_changed=1;
end $;
revoke all on function public.ce_revoke_machine_content_reviewer(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.ce_revoke_machine_content_reviewer(uuid) to authenticated;

-- Keep historical human reviewer RPCs/API names working.
-- The following functions are superseded, not the 2026-11-21 migration file.
revoke all on function public.ce_require_independent_content_approver(uuid,uuid)
 from public,anon,authenticated,service_role;
revoke all on function public.hq_review_teacher_guide(uuid,boolean,text)
 from public,anon,service_role;
grant execute on function public.hq_review_teacher_guide(uuid,boolean,text) to authenticated;
revoke all on function public.hq_review_generated_assessment(uuid,boolean,text)
 from public,anon,service_role;
grant execute on function public.hq_review_generated_assessment(uuid,boolean,text) to authenticated;
revoke all on function public.hq_review_publication_release(uuid,boolean,text)
 from public,anon,service_role;
grant execute on function public.hq_review_publication_release(uuid,boolean,text) to authenticated;
commit;

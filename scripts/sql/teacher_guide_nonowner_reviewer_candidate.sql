-- Candidate: genuine independent HQ content.approve reviewer replaces owner check.
-- Does not grant permission, self-approve, publish or override curriculum QA.
create or replace function public.ce_guard_teacher_guide_approval()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $guard$
declare actor uuid:=auth.uid();
begin
 if old.derivative_type<>'teacher_notes' or old.audience<>'teacher'
 or old.body->>'kind'<>'teacher_guide' then return new; end if;
 if old.status='approved' and new.status='approved'
 and (new.body is distinct from old.body
 or new.source_publication_id is distinct from old.source_publication_id
 or new.source_chapter_id is distinct from old.source_chapter_id
 or new.source_resource_id is distinct from old.source_resource_id)
 then raise exception 'APPROVED_TEACHER_GUIDE_IMMUTABLE'; end if;
 if new.status='approved' and old.status<>'approved' then
  if old.status<>'draft' or actor is null or actor=old.created_by
   or not public.hq_profile_is_active(actor)
   or not exists(select 1 from public.hq_human_members hm
     where hm.profile_id=actor and hm.status='active'
     and (hm.access_expires_at is null or hm.access_expires_at>clock_timestamp())
     and hm.role in ('reviewer','partner_admin','hq_admin')
     and 'content.approve'=any(hm.permissions))
  then raise exception 'TEACHER_GUIDE_REVIEWER_REQUIRED' using errcode='42501'; end if;
  if new.body is distinct from old.body or new.created_by is distinct from old.created_by
    or new.source_publication_id is distinct from old.source_publication_id
    or new.source_chapter_id is distinct from old.source_chapter_id
    or new.source_resource_id is distinct from old.source_resource_id
    or new.quality->>'reviewed_by' is distinct from actor::text
    or coalesce((new.quality->>'approved')::boolean,false) is distinct from true
  then raise exception 'TEACHER_GUIDE_REVIEW_PROVENANCE_REQUIRED'; end if;
 end if;
 return new;
end $guard$;
revoke all on function public.ce_guard_teacher_guide_approval() from public,anon,authenticated,service_role;
drop trigger if exists ce_guard_teacher_guide_approval on public.content_derivatives;
create trigger ce_guard_teacher_guide_approval before update on public.content_derivatives
for each row execute function public.ce_guard_teacher_guide_approval();

create or replace function public.hq_review_teacher_guide(p_derivative_id uuid,p_approve boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $review$
declare
 d public.content_derivatives%rowtype;
 v_work uuid;
 actor uuid:=auth.uid();
 review_result jsonb;
begin
 if actor is null or not public.hq_profile_is_active(actor)
  or not exists(select 1 from public.hq_human_members hm where hm.profile_id=actor
    and hm.status='active'
    and (hm.access_expires_at is null or hm.access_expires_at>clock_timestamp())
    and hm.role in ('reviewer','partner_admin','hq_admin')
    and 'content.approve'=any(hm.permissions))
 then raise exception 'CONTENT_APPROVER_AUTH_REQUIRED' using errcode='42501'; end if;
 select * into d from public.content_derivatives where id=p_derivative_id for update;
 if not found then raise exception 'Teacher guide not found'; end if;
 if d.derivative_type<>'teacher_notes' or d.audience<>'teacher'
    or d.body->>'kind'<>'teacher_guide' or d.status<>'draft'
 then raise exception 'Teacher guide is not reviewable'; end if;
 if actor=d.created_by or exists(select 1 from public.vibe_publications vp
      where vp.id=d.source_publication_id and vp.author_id=actor)
 then raise exception 'AUTHOR_CANNOT_INDEPENDENTLY_APPROVE' using errcode='42501'; end if;
 if not exists(select 1 from public.vibe_publications vp
   join public.vibe_chapters vc on vc.publication_id=vp.id
   join public.learning_resources lr on lr.publication_id=vp.id and lr.chapter_id=vc.id
   where vp.id=d.source_publication_id and vp.status='draft' and vp.author_id=d.created_by
     and vc.id=d.source_chapter_id and vc.status='draft' and lr.id=d.source_resource_id)
 then raise exception 'TEACHER_GUIDE_SOURCE_DRIFT'; end if;
 if not exists(select 1 from public.hq_work_items w
   where w.source_type='content_derivative' and w.source_id=d.id
     and w.work_type='teacher_guide_review' and w.status='waiting_approval')
 then raise exception 'TEACHER_GUIDE_REVIEW_REQUEST_REQUIRED'; end if;
 if p_approve then
  if nullif(btrim(p_note),'') is null then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
  review_result:=public.content_worker_teacher_guide_self_review(d.body,d.quality);
  if coalesce((review_result->>'passed')::boolean,false) is distinct from true
  then raise exception 'TEACHER_GUIDE_QUALITY_PENDING'; end if;
  if jsonb_typeof(d.body->'outcome_coverage') is distinct from 'array'
    or jsonb_array_length(d.body->'outcome_coverage')=0
    or exists(select 1 from jsonb_array_elements(d.body->'outcome_coverage') item
       where not exists(select 1 from public.chapter_learning_outcome_links cl
          join public.curriculum_learning_outcomes o on o.id=cl.outcome_id
          join public.content_blocks cb on cb.id=(item->>'source_block_id')::uuid
          where cl.chapter_id=d.source_chapter_id and o.outcome_code=item->>'outcome_code'
            and cb.chapter_id=d.source_chapter_id and cb.publication_id=d.source_publication_id
            and cb.status in ('draft','published')))
  then raise exception 'TEACHER_GUIDE_OUTCOME_TRACE_PENDING'; end if;
 end if;
 update public.content_derivatives set
   status=case when p_approve then 'approved' else 'archived' end,
   quality=coalesce(quality,'{}'::jsonb)||jsonb_build_object(
      'reviewed_by',actor,'reviewed_at',now(),'review_note',p_note,
      'approved',p_approve,'reviewer_permission','content.approve',
      'editorial_review_complete',p_approve,'fresh_structural_review',review_result),
   updated_at=now()
 where id=p_derivative_id returning * into d;
 update public.hq_work_items set
   status='resolved',acted_at=now(),resolved_at=now(),
   owner_id=coalesce(owner_id,actor),
   verification_status=case when p_approve then 'verified' else 'not_required' end,
   action_taken=jsonb_build_object('action',case when p_approve then 'approve_teacher_guide' else 'reject_teacher_guide' end,
       'derivative_id',p_derivative_id,'note',p_note,'reviewer_permission','content.approve'),
   verification_evidence=jsonb_build_object('derivative_status',d.status),
   updated_at=now()
 where source_type='content_derivative' and source_id=p_derivative_id
   and work_type='teacher_guide_review' and status='waiting_approval'
 returning id into v_work;
 return jsonb_build_object('derivative_id',p_derivative_id,'status',d.status,'hq_work_item_id',v_work);
end $review$;
revoke all on function public.hq_review_teacher_guide(uuid,boolean,text) from public,anon;
grant execute on function public.hq_review_teacher_guide(uuid,boolean,text) to authenticated,service_role;

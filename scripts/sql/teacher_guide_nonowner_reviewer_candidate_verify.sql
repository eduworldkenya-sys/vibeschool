-- Rollback-only test. Synthetic auth/users never persist.
do $test$
declare reviewer uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); reason text; result jsonb;
 guide constant uuid:='43ed7077-4078-499d-9d73-da8911aeb6b5';
begin
 if auth.uid() is not null then raise exception 'test_actor_must_be_null'; end if;
 if not exists(select 1 from public.content_derivatives where id=guide and status='draft')
 then raise exception 'real_draft_state_changed'; end if;
 begin
  perform public.hq_review_teacher_guide(guide,true,'No actor denied');
  raise exception 'UNAUTHENTICATED_PASSED';
 exception when others then
  get stacked diagnostics reason=message_text;
  if reason<>'CONTENT_APPROVER_AUTH_REQUIRED' then raise; end if;
 end;
 insert into auth.users(id,raw_user_meta_data) values
 (reviewer,'{"full_name":"ROLLBACK REVIEWER"}'::jsonb),
 (outsider,'{"full_name":"ROLLBACK OUTSIDER"}'::jsonb);
 insert into public.hq_human_members(profile_id,role,status,permissions)
 values(reviewer,'reviewer','active',array['content.approve','hq.view']);
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin perform public.hq_review_teacher_guide(guide,true,'Outsider denied');
  raise exception 'OUTSIDER_PASSED';
 exception when others then
  get stacked diagnostics reason=message_text;
  if reason<>'CONTENT_APPROVER_AUTH_REQUIRED' then raise; end if;
 end;
 begin update public.content_derivatives set status='approved' where id=guide;
  raise exception 'DIRECT_STATUS_PASSED';
 exception when others then
  get stacked diagnostics reason=message_text;
  if reason<>'TEACHER_GUIDE_REVIEWER_REQUIRED' then raise; end if;
 end;
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 begin update public.content_derivatives set status='approved' where id=guide;
  raise exception 'REVIEWER_DIRECT_STATUS_PASSED';
 exception when others then
  get stacked diagnostics reason=message_text;
  if reason<>'TEACHER_GUIDE_REVIEW_PROVENANCE_REQUIRED' then raise; end if;
 end;
 update public.hq_human_members set access_expires_at=clock_timestamp()-interval '1 day' where profile_id=reviewer;
 begin perform public.hq_review_teacher_guide(guide,true,'Expired role denied');
  raise exception 'EXPIRED_ROLE_PASSED';
 exception when others then
  get stacked diagnostics reason=message_text;
  if reason<>'CONTENT_APPROVER_AUTH_REQUIRED' then raise; end if;
 end;
 update public.hq_human_members set access_expires_at=null where profile_id=reviewer;
 begin
  update public.content_derivatives set body=body-'objectives' where id=guide;
  perform public.hq_review_teacher_guide(guide,true,'Bad guide denied');
  raise exception 'STRUCTURAL_GATE_PASSED';
 exception when others then
  get stacked diagnostics reason=message_text;
  if reason<>'TEACHER_GUIDE_QUALITY_PENDING' then raise; end if;
 end;
 result:=public.hq_review_teacher_guide(guide,true,'Independent synthetic reviewer validated guide content in rollback-only test');
 if result->>'status'<>'approved' then raise exception 'EXPECTED_APPROVAL_MISSING'; end if;
 if not exists(select 1 from public.hq_work_items where source_id=guide and status='resolved')
 then raise exception 'AUDIT_WORK_ITEM_MISSING'; end if;
 begin update public.content_derivatives set body=body||'{"tamper":true}'::jsonb where id=guide;
  raise exception 'APPROVED_BODY_MUTABLE';
 exception when others then
  get stacked diagnostics reason=message_text;
  if reason<>'APPROVED_TEACHER_GUIDE_IMMUTABLE' then raise; end if;
 end;
end $test$;
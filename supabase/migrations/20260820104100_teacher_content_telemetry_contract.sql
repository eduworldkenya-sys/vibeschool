-- Teacher content journey telemetry. Extends Task 12 pilot observability allowlist.
begin;

insert into public.pilot_event_contract(
  event_name,journey,stage,success_semantics,authoritative_required,allowed_roles,metadata_keys,activation_role
) values
('teacher.lesson_notes_opened','teacher_content','lesson_notes_opened','Teacher opened an exact lesson-notes workspace',false,array['teacher'],array['content_state'],null),
('teacher.lesson_content_found','teacher_content','content_found','At least one verified curriculum-linked teaching resource was available',false,array['teacher'],array['content_state','resource_count'],null),
('teacher.lesson_resource_opened','teacher_content','resource_opened','Teacher opened a verified linked teaching resource',false,array['teacher'],array['content_state','resource_type'],null),
('teacher.lesson_curriculum_fallback_used','teacher_content','curriculum_fallback','Teacher used a verified exact curriculum fallback because no explicit verified lesson link existed',false,array['teacher'],array['content_state'],null),
('teacher.lesson_content_unavailable','teacher_content','content_unavailable','No verified material existed for the exact lesson identity',false,array['teacher'],array['content_state'],null),
('teacher.lesson_content_entitlement_blocked','teacher_content','entitlement_blocked','Verified material existed but current viewer could not read it',false,array['teacher'],array['content_state'],null),
('teacher.lesson_content_broken','teacher_content','broken_resource','Curriculum identity or resource integrity failed closed',false,array['teacher'],array['content_state','error_code'],null)
on conflict (event_name) do update set
  journey=excluded.journey,
  stage=excluded.stage,
  success_semantics=excluded.success_semantics,
  authoritative_required=excluded.authoritative_required,
  allowed_roles=excluded.allowed_roles,
  metadata_keys=excluded.metadata_keys,
  activation_role=excluded.activation_role,
  active=true,
  updated_at=now();

commit;

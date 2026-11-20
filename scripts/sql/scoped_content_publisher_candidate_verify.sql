-- Regression smoke test; requires the candidate SQL in the same rollback transaction.
do $$
declare actual text; verdict text; target uuid;
begin
 if auth.uid() is not null then raise exception 'test_requires_null_application_actor'; end if;
 if has_function_privilege('anon','public.hq_bind_publication_release_publisher(uuid,uuid,timestamptz)','EXECUTE') or has_function_privilege('service_role','public.hq_bind_publication_release_publisher(uuid,uuid,timestamptz)','EXECUTE') or has_function_privilege('authenticated','public.ce_require_scoped_release_publisher(uuid,boolean)','EXECUTE') then raise exception 'publisher_authority_exposed'; end if;
 begin
  perform public.hq_bind_publication_release_publisher(gen_random_uuid(),gen_random_uuid(),now()+interval '10 minutes');
  raise exception 'unexpected_owner_bind_success';
 exception when others then
  get stacked diagnostics verdict=message_text;
  if verdict<>'authenticated_platform_owner_required' then raise; end if;
 end;
 begin
  perform public.hq_revoke_publication_release_publisher(gen_random_uuid());
  raise exception 'unexpected_owner_revoke_success';
 exception when others then
  get stacked diagnostics verdict=message_text;
  if verdict<>'authenticated_platform_owner_required' then raise; end if;
 end;
 select id into target from public.vibe_publications where format='vibetextbook' and status='draft' limit 1;
 if target is not null then
  begin
   perform public.publish_textbook(target);
   raise exception 'unexpected_publish_success';
  exception when others then
   get stacked diagnostics verdict=message_text;
   if verdict not like 'Not authorized to publish publication %' then raise; end if;
  end;
 end if;
 select pg_get_functiondef('public.publish_textbook(uuid)'::regprocedure) into actual;
 if position('public.publish_publication(p_publication_id)' in actual)=0 or position('update public.vibe_publications' in lower(actual))>0 then raise exception 'legacy_release_not_canonical'; end if;
 if has_function_privilege('authenticated','public.ce_capture_publication_revision_internal(uuid,text,uuid)','EXECUTE') or has_function_privilege('anon','public.ce_capture_publication_revision_internal(uuid,text,uuid)','EXECUTE') or has_function_privilege('service_role','public.ce_capture_publication_revision_internal(uuid,text,uuid)','EXECUTE') then raise exception 'private_revision_helper_exposed'; end if;
 if exists(select 1 from public.publication_release_approvals where delegated_publisher_id is not null) then raise exception 'unintended_commissioning'; end if;
end $$;

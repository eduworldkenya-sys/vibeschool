DO $media$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.success_wishes_media_uploads'::regclass AND relrowsecurity)
  THEN RAISE EXCEPTION 'media upload RLS disabled'; END IF;
 IF has_table_privilege('anon','public.success_wishes_media_uploads','SELECT')
   OR has_table_privilege('authenticated','public.success_wishes_media_uploads','SELECT')
   OR has_table_privilege('authenticated','public.success_wishes_media_uploads','INSERT')
   THEN RAISE EXCEPTION 'media reservation table is exposed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger
   WHERE tgname='success_wishes_media_reservation_guard' AND tgenabled='O')
  THEN RAISE EXCEPTION 'media reservation security guard missing'; END IF;
 IF has_function_privilege('anon','public.success_wishes_guard_media_reservation()','EXECUTE')
   OR has_function_privilege('authenticated','public.success_wishes_guard_media_reservation()','EXECUTE')
  THEN RAISE EXCEPTION 'media reservation guard exposed'; END IF;
 RAISE NOTICE 'Private media reservation gates PASS';
END $media$;

-- Provider-free synthetic proof: unpaid and foreign-sender reservations fail,
-- exactly one valid paid upload may be allocated, and a voice cannot be
-- marked ready without verified bytes/duration matching its private path.
set role service_role;
DO $paid_media$
declare
  recipient uuid;
  sender uuid;
  outsider uuid;
  message_id uuid;
  path text;
  digest text := repeat('f',64);
begin
  select id into recipient from public.success_wishes_inboxes
    where school_id='11111111-1111-4111-8111-111111111111' limit 1;
  select id into sender from public.success_wishes_senders
    where email_digest=repeat('2',64);
  select id into outsider from public.success_wishes_senders
    where email_digest=repeat('1',64);
  if recipient is null or sender is null or outsider is null
    then raise exception 'Synthetic cross-school fixture is incomplete'; end if;

  insert into public.success_wishes_messages(
    inbox_id,sender_id,sender_name,relationship,format,body,
    media_provider,media_asset_id,management_token_hash,idempotency_key,
    payment_status,state,expires_at
  ) values(recipient,sender,'Media guardian','Guardian','voice',null,
    'supabase-private-voice','awaiting-upload',repeat('c',64),
    repeat('d',64),'pending','request',now()+interval '1 day')
  returning id into message_id;
  begin
    insert into public.success_wishes_media_uploads(
      message_id,sender_id,idempotency_key,kind,provider,content_type,bytes_declared
    ) values(message_id,sender,repeat('1',64),'voice','supabase-private-voice','audio/webm',100);
    raise exception 'Unpaid wish received a media reservation';
  exception when check_violation then null;
  end;

  update public.success_wishes_messages set payment_status='paid' where id=message_id;
  begin
    insert into public.success_wishes_media_uploads(
      message_id,sender_id,idempotency_key,kind,provider,content_type,bytes_declared
    ) values(message_id,outsider,repeat('2',64),'voice','supabase-private-voice','audio/webm',100);
    raise exception 'Different verified sender obtained this reservation';
  exception when check_violation then null;
  end;

  insert into public.success_wishes_media_uploads(
    message_id,sender_id,idempotency_key,kind,provider,content_type,bytes_declared
  ) values(message_id,sender,repeat('3',64),'voice','supabase-private-voice','audio/webm',100);
  begin
    insert into public.success_wishes_media_uploads(
      message_id,sender_id,idempotency_key,kind,provider,content_type,bytes_declared
    ) values(message_id,sender,repeat('4',64),'voice','supabase-private-voice','audio/webm',100);
    raise exception 'A second upload could be reserved for one paid wish';
  exception when unique_violation then null;
  end;

  path:=message_id::text||'/00000000-0000-4000-8000-000000000002.webm';
  update public.success_wishes_messages set media_asset_id=path where id=message_id;
  begin
    update public.success_wishes_messages set media_status='ready' where id=message_id;
    raise exception 'Voice bypassed trusted file validation';
  exception when check_violation then null;
  end;
  begin
    insert into public.success_wishes_voice_validations(
      message_id,object_path,mime_type,byte_size,duration_seconds,sha256,validator_version
    ) values(message_id,path,'audio/webm',100,61,digest,'trusted-audio-probe-v1');
    raise exception 'Audio longer than 60s passed validation';
  exception when check_violation then null;
  end;
  insert into public.success_wishes_voice_validations(
    message_id,object_path,mime_type,byte_size,duration_seconds,sha256,validator_version
  ) values(message_id,path,'audio/webm',100,35,digest,'trusted-audio-probe-v1');
  update public.success_wishes_messages set media_status='ready' where id=message_id;
  if not exists(select 1 from public.success_wishes_messages
    where id=message_id and media_status='ready') then
    raise exception 'Verified voice could not become ready';
  end if;
  raise notice 'PAID MEDIA: cross-sender, unpaid, concurrency and trusted-voice checks passed';
end $paid_media$;
reset role;

-- Provision private voice storage only. Does not enable uploads, payments
-- or candidate delivery. Client writes MUST use server-authorised signed URLs.
begin;

do $sw_bucket$
begin
  if to_regclass('storage.buckets') is null then
    raise exception 'supabase_storage_not_installed';
  end if;
  if exists(select 1 from storage.buckets
    where id='success-wishes-private-voice' and public) then
    raise exception 'refusing_to_repurpose_public_voice_bucket';
  end if;
end $sw_bucket$;

insert into storage.buckets (
  id,name,public,file_size_limit,allowed_mime_types
) values (
  'success-wishes-private-voice','success-wishes-private-voice',false,26214400,
  array['audio/webm','audio/mp4','audio/mpeg','audio/ogg']::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- No public or authenticated storage.objects policies are created. Existing
-- global policies remain scoped to their explicitly named buckets. The service
-- role must verify message ownership, quota, payment and expiry before creating
-- a bearer upload or five-minute signed read.
commit;

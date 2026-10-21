do $sw_bucket$
declare b record;
begin
  select * into b from storage.buckets where id='success-wishes-private-voice';
  if not found or b.public is distinct from false
    or b.file_size_limit is distinct from 26214400::bigint
    or b.allowed_mime_types is distinct from array[
      'audio/webm','audio/mp4','audio/mpeg','audio/ogg']::text[] then
    raise exception 'Private voice storage policy is not enforced';
  end if;
  if (select count(*) from storage.buckets
    where id='success-wishes-private-voice')<>1 then
    raise exception 'Private voice migration is not idempotent';
  end if;
end $sw_bucket$;
select 'Success Wishes private voice bucket and storage caps passed' as result;

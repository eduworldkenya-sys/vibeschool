-- View-only KICD Google Drive documents cannot expose their original PDF bytes.
-- Retain each official viewer page plus a canonical JSON hash manifest instead.
-- The bucket remains private and has no browser policies; only the owner-gated
-- curriculum intake service writes these immutable evidence objects.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/json',
  'image/png'
]::text[]
where id = 'curriculum-authority-artifacts';

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'curriculum-authority-artifacts'
      and public = false
      and allowed_mime_types @> array['application/pdf', 'application/json', 'image/png']::text[]
  ) then
    raise exception 'CURRICULUM_AUTHORITY_EVIDENCE_BUCKET_CONTRACT_FAILED';
  end if;
end;
$$;

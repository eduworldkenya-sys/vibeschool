begin;

-- The learner-facing reader must execute only the sanitized public wrapper.
-- The raw implementation can contain authoritative answer material and must
-- never be callable directly by anon/authenticated clients.
revoke all on function public.get_public_vibetextbook_reader_raw(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_vibetextbook_reader_raw(uuid)
  to service_role;

commit;

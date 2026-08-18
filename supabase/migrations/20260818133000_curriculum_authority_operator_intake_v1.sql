begin;

-- Curriculum Authority operator intake v1.
-- Provides a private immutable artifact store for the already-certified authority pipeline.
-- It does not widen browser access to raw authority data and does not promote curriculum.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'curriculum-authority-artifacts',
  'curriculum-authority-artifacts',
  false,
  31457280,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 31457280,
    allowed_mime_types = array['application/pdf']::text[];

-- The Edge Function uses service_role. Browser roles receive no direct storage policy.
-- Existing storage.objects RLS therefore remains fail-closed for this bucket.

comment on table public.curriculum_authority_artifacts is
  'Immutable authoritative-source artifact evidence identified by SHA-256. Artifact bytes are retained in private storage bucket curriculum-authority-artifacts.';

commit;

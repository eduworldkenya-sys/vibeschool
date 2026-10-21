-- Disposable approximation of the Supabase Storage bucket catalog.
-- This fixture is never applied to a hosted project.
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

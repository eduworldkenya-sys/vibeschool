create extension if not exists pg_trgm;
create index if not exists schools_name_trgm_idx on public.schools using gin (name gin_trgm_ops);
create index if not exists schools_name_normalized_idx on public.schools (name_normalized);
create index if not exists schools_county_idx on public.schools (county);
create index if not exists schools_sub_county_idx on public.schools (sub_county);
create index if not exists schools_knec_code_idx on public.schools (knec_code) where knec_code is not null;
create index if not exists schools_nemis_code_idx on public.schools (nemis_code) where nemis_code is not null;
create index if not exists school_aliases_normalized_idx on public.school_aliases (alias_normalized);
-- Function body is maintained in the subsequent unified directory migration.
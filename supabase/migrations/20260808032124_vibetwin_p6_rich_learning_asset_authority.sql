-- P6 Rich Content Generation: learner-scoped generated rich-media assets attached to source-grounded transformations.
-- Live Supabase ledger: 20260808032124

create table if not exists public.student_learning_generated_assets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  transformation_id uuid not null references public.student_learning_transformations(id) on delete cascade,
  asset_type text not null check (asset_type in ('diagram','audio','simulation','timeline','formula_visual')),
  status text not null default 'ready' check (status in ('ready','degraded','failed')),
  payload jsonb not null default '{}'::jsonb,
  source_version text not null,
  generator text not null,
  model text,
  quality jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  unique (student_id, transformation_id, asset_type, source_version)
);

create index if not exists idx_student_learning_generated_assets_student on public.student_learning_generated_assets(student_id, created_at desc);
create index if not exists idx_student_learning_generated_assets_transformation on public.student_learning_generated_assets(transformation_id);

alter table public.student_learning_generated_assets enable row level security;
revoke all on public.student_learning_generated_assets from public, anon, authenticated;

drop function if exists public.student_get_learning_generated_assets(uuid);
create function public.student_get_learning_generated_assets(p_transformation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_allowed boolean;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select s.id into v_student_id from public.students s where s.profile_id=v_uid and s.deleted_at is null limit 1;
  if v_student_id is null then raise exception 'Learner identity not found'; end if;

  select exists(
    select 1 from public.student_learning_transformations t
    where t.id=p_transformation_id and t.student_id=v_student_id
  ) into v_allowed;
  if not v_allowed then raise exception 'Transformation not available'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'asset_type',a.asset_type,'status',a.status,'payload',a.payload,
    'source_version',a.source_version,'generator',a.generator,'model',a.model,
    'quality',a.quality,'created_at',a.created_at,'expires_at',a.expires_at
  ) order by a.asset_type),'[]'::jsonb)
  into v_result
  from public.student_learning_generated_assets a
  where a.student_id=v_student_id and a.transformation_id=p_transformation_id and a.expires_at>now();

  return jsonb_build_object('transformation_id',p_transformation_id,'assets',coalesce(v_result,'[]'::jsonb));
end;
$$;

revoke all on function public.student_get_learning_generated_assets(uuid) from public, anon;
grant execute on function public.student_get_learning_generated_assets(uuid) to authenticated;

create or replace function public.student_upsert_learning_generated_asset(
  p_transformation_id uuid,
  p_asset_type text,
  p_payload jsonb,
  p_status text default 'ready',
  p_generator text default 'deterministic_rich_media_v1',
  p_model text default null,
  p_quality jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_source_version text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_asset_type not in ('diagram','audio','simulation','timeline','formula_visual') then raise exception 'Unsupported asset type'; end if;
  if p_status not in ('ready','degraded','failed') then raise exception 'Unsupported asset status'; end if;
  select s.id into v_student_id from public.students s where s.profile_id=v_uid and s.deleted_at is null limit 1;
  if v_student_id is null then raise exception 'Learner identity not found'; end if;
  select t.source_version into v_source_version from public.student_learning_transformations t where t.id=p_transformation_id and t.student_id=v_student_id;
  if v_source_version is null then raise exception 'Transformation not available'; end if;

  insert into public.student_learning_generated_assets(student_id,transformation_id,asset_type,status,payload,source_version,generator,model,quality)
  values(v_student_id,p_transformation_id,p_asset_type,p_status,coalesce(p_payload,'{}'::jsonb),v_source_version,coalesce(nullif(p_generator,''),'deterministic_rich_media_v1'),p_model,coalesce(p_quality,'{}'::jsonb))
  on conflict(student_id,transformation_id,asset_type,source_version)
  do update set status=excluded.status,payload=excluded.payload,generator=excluded.generator,model=excluded.model,quality=excluded.quality,updated_at=now(),expires_at=now()+interval '30 days'
  returning id into v_id;

  return jsonb_build_object('id',v_id,'asset_type',p_asset_type,'status',p_status,'source_version',v_source_version);
end;
$$;

revoke all on function public.student_upsert_learning_generated_asset(uuid,text,jsonb,text,text,text,jsonb) from public, anon;
grant execute on function public.student_upsert_learning_generated_asset(uuid,text,jsonb,text,text,text,jsonb) to authenticated;

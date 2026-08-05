begin;

create table if not exists public.assessment_sections (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessment_definitions(id) on delete cascade,
  title text not null,
  instructions text,
  display_order integer not null,
  marks numeric not null default 0 check (marks >= 0),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, display_order)
);

alter table public.assessment_items
  add column if not exists section_id uuid references public.assessment_sections(id) on delete set null;

create index if not exists assessment_sections_assessment_id_idx
  on public.assessment_sections(assessment_id, display_order);
create index if not exists assessment_items_section_id_idx
  on public.assessment_items(section_id, order_num);

alter table public.assessment_sections enable row level security;

create or replace function public.exq_list_builder_assessment(p_assessment_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); ad public.assessment_definitions%rowtype; sections jsonb; unsectioned jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id=p_assessment_id;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'title',s.title,'instructions',s.instructions,'display_order',s.display_order,
    'marks',s.marks,'estimated_minutes',s.estimated_minutes,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',ai.id,'question_type',ai.question_type,'prompt',ai.prompt,'marks',ai.marks,
      'difficulty',ai.difficulty,'bloom_level',ai.bloom_level,'order_num',ai.order_num,'status',ai.status
    ) order by ai.order_num) from public.assessment_items ai where ai.section_id=s.id),'[]'::jsonb)
  ) order by s.display_order),'[]'::jsonb) into sections
  from public.assessment_sections s where s.assessment_id=ad.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ai.id,'question_type',ai.question_type,'prompt',ai.prompt,'marks',ai.marks,
    'difficulty',ai.difficulty,'bloom_level',ai.bloom_level,'order_num',ai.order_num,'status',ai.status
  ) order by ai.order_num),'[]'::jsonb) into unsectioned
  from public.assessment_items ai where ai.assessment_id=ad.id and ai.section_id is null;
  return jsonb_build_object('ok',true,'assessment',jsonb_build_object(
    'id',ad.id,'title',ad.title,'description',ad.description,'instructions',ad.instructions,
    'assessment_type',ad.assessment_type,'status',ad.status,'total_marks',ad.total_marks,
    'estimated_minutes',ad.estimated_minutes),'sections',sections,'unsectioned_items',unsectioned);
end;
$$;

create or replace function public.exq_create_section(
  p_assessment_id uuid,p_title text,p_instructions text default null,p_estimated_minutes integer default null
)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); ad public.assessment_definitions%rowtype; next_order integer; result_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id=p_assessment_id for update;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.status not in ('draft','review') then raise exception 'assessment_locked'; end if;
  if btrim(coalesce(p_title,''))='' then raise exception 'section_title_required'; end if;
  select coalesce(max(display_order),0)+1 into next_order from public.assessment_sections where assessment_id=ad.id;
  insert into public.assessment_sections(assessment_id,title,instructions,display_order,estimated_minutes)
  values(ad.id,btrim(p_title),nullif(btrim(coalesce(p_instructions,'')),''),next_order,p_estimated_minutes)
  returning id into result_id;
  return result_id;
end;
$$;

create or replace function public.exq_update_section(
  p_section_id uuid,p_title text,p_instructions text default null,p_estimated_minutes integer default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); section_row public.assessment_sections%rowtype; owner_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into section_row from public.assessment_sections where id=p_section_id;
  if not found then raise exception 'section_not_found'; end if;
  select teacher_id into owner_id from public.assessment_definitions where id=section_row.assessment_id;
  if owner_id is distinct from caller then raise exception 'section_not_owned'; end if;
  if btrim(coalesce(p_title,''))='' then raise exception 'section_title_required'; end if;
  update public.assessment_sections set title=btrim(p_title),
    instructions=nullif(btrim(coalesce(p_instructions,'')),''),estimated_minutes=p_estimated_minutes,updated_at=now()
  where id=p_section_id;
  return jsonb_build_object('ok',true,'section_id',p_section_id);
end;
$$;

create or replace function public.exq_move_item_to_section(
  p_assessment_item_id uuid,p_section_id uuid default null,p_order_num integer default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); item_row public.assessment_items%rowtype; owner_id uuid; resolved_order integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into item_row from public.assessment_items where id=p_assessment_item_id for update;
  if not found then raise exception 'assessment_item_not_found'; end if;
  select teacher_id into owner_id from public.assessment_definitions where id=item_row.assessment_id;
  if owner_id is distinct from caller then raise exception 'assessment_item_not_owned'; end if;
  if p_section_id is not null and not exists(select 1 from public.assessment_sections s
    where s.id=p_section_id and s.assessment_id=item_row.assessment_id) then raise exception 'section_assessment_mismatch'; end if;
  resolved_order:=coalesce(p_order_num,(select coalesce(max(order_num),0)+1 from public.assessment_items ai
    where ai.assessment_id=item_row.assessment_id and ai.section_id is not distinct from p_section_id));
  update public.assessment_items set section_id=p_section_id,order_num=resolved_order,updated_at=now() where id=item_row.id;
  return jsonb_build_object('ok',true,'assessment_item_id',item_row.id,'section_id',p_section_id,'order_num',resolved_order);
end;
$$;

create or replace function public.exq_reorder_sections(p_assessment_id uuid,p_section_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); owner_id uuid; expected_count integer; supplied_count integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select teacher_id into owner_id from public.assessment_definitions where id=p_assessment_id;
  if owner_id is null then raise exception 'assessment_not_found'; end if;
  if owner_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  select count(*) into expected_count from public.assessment_sections where assessment_id=p_assessment_id;
  supplied_count:=coalesce(array_length(p_section_ids,1),0);
  if expected_count<>supplied_count then raise exception 'section_order_incomplete'; end if;
  if exists(select 1 from unnest(p_section_ids) id group by id having count(*)>1) then raise exception 'duplicate_section_id'; end if;
  if exists(select 1 from unnest(p_section_ids) id where not exists(select 1 from public.assessment_sections s
    where s.id=id and s.assessment_id=p_assessment_id)) then raise exception 'section_assessment_mismatch'; end if;
  update public.assessment_sections s set display_order=ordered.position,updated_at=now()
  from (select id,ordinality::integer position from unnest(p_section_ids) with ordinality as u(id,ordinality)) ordered
  where s.id=ordered.id;
  return jsonb_build_object('ok',true,'assessment_id',p_assessment_id,'section_count',supplied_count);
end;
$$;

create or replace function public.exq_delete_section(p_section_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); section_row public.assessment_sections%rowtype; owner_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into section_row from public.assessment_sections where id=p_section_id;
  if not found then raise exception 'section_not_found'; end if;
  select teacher_id into owner_id from public.assessment_definitions where id=section_row.assessment_id;
  if owner_id is distinct from caller then raise exception 'section_not_owned'; end if;
  update public.assessment_items set section_id=null,updated_at=now() where section_id=p_section_id;
  delete from public.assessment_sections where id=p_section_id;
  with ordered as (select id,row_number() over(order by display_order,created_at)::integer next_order
    from public.assessment_sections where assessment_id=section_row.assessment_id)
  update public.assessment_sections s set display_order=ordered.next_order,updated_at=now()
  from ordered where s.id=ordered.id;
  return jsonb_build_object('ok',true,'section_id',p_section_id);
end;
$$;

revoke all on function public.exq_list_builder_assessment(uuid) from public,anon;
revoke all on function public.exq_create_section(uuid,text,text,integer) from public,anon;
revoke all on function public.exq_update_section(uuid,text,text,integer) from public,anon;
revoke all on function public.exq_move_item_to_section(uuid,uuid,integer) from public,anon;
revoke all on function public.exq_reorder_sections(uuid,uuid[]) from public,anon;
revoke all on function public.exq_delete_section(uuid) from public,anon;
grant execute on function public.exq_list_builder_assessment(uuid) to authenticated,service_role;
grant execute on function public.exq_create_section(uuid,text,text,integer) to authenticated,service_role;
grant execute on function public.exq_update_section(uuid,text,text,integer) to authenticated,service_role;
grant execute on function public.exq_move_item_to_section(uuid,uuid,integer) to authenticated,service_role;
grant execute on function public.exq_reorder_sections(uuid,uuid[]) to authenticated,service_role;
grant execute on function public.exq_delete_section(uuid) to authenticated,service_role;

commit;

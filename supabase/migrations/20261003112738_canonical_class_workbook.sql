-- authorization-test: public.teacher_class_workbooks
-- A workbook stores only personal sheet definitions, custom cells and saved views.
-- Attendance, enrolment, marks, homework and mastery remain canonical elsewhere.
begin;
create table public.teacher_class_workbooks (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  document jsonb not null,
  revision integer not null default 1 check(revision>0),
  updated_at timestamptz not null default now(),
  primary key(teacher_id,school_id,class_id),
  check(jsonb_typeof(document)='object' and octet_length(document::text)<=1048576)
);
alter table public.teacher_class_workbooks enable row level security;
revoke all on public.teacher_class_workbooks from public,anon,authenticated;
grant select,insert,update on public.teacher_class_workbooks to authenticated;
grant all on public.teacher_class_workbooks to service_role;
create policy workbook_teacher_own on public.teacher_class_workbooks for all to authenticated
using (
 teacher_id=(select auth.uid())
 and exists(select 1 from public.school_members sm where sm.profile_id=(select auth.uid()) and sm.school_id=teacher_class_workbooks.school_id and sm.role::text='teacher')
 and exists(select 1 from public.teacher_classes tc join public.classes c on c.id=tc.class_id and c.school_id=tc.school_id where tc.teacher_id=(select auth.uid()) and tc.school_id=teacher_class_workbooks.school_id and tc.class_id=teacher_class_workbooks.class_id)
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false))
)
with check (
 teacher_id=(select auth.uid())
 and exists(select 1 from public.school_members sm where sm.profile_id=(select auth.uid()) and sm.school_id=teacher_class_workbooks.school_id and sm.role::text='teacher')
 and exists(select 1 from public.teacher_classes tc join public.classes c on c.id=tc.class_id and c.school_id=tc.school_id where tc.teacher_id=(select auth.uid()) and tc.school_id=teacher_class_workbooks.school_id and tc.class_id=teacher_class_workbooks.class_id)
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false))
);
create function public.validate_teacher_class_workbook() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare s jsonb; c jsonb; row_entry record; cell_entry record; sheet_entry record; v_sheet jsonb; v_col jsonb;
begin
 if tg_op='UPDATE' then
  if (new.teacher_id,new.school_id,new.class_id) is distinct from (old.teacher_id,old.school_id,old.class_id) then raise exception 'workbook_identity_immutable';end if;
  new.revision:=old.revision+1;
 end if;
 new.updated_at:=now();
 if new.document->>'version' is distinct from '1' or jsonb_typeof(new.document->'sheets') is distinct from 'array' or jsonb_typeof(new.document->'views') is distinct from 'array' or jsonb_typeof(new.document->'cells') is distinct from 'object' then raise exception 'invalid_workbook';end if;
 if jsonb_array_length(new.document->'sheets')>30 or jsonb_array_length(new.document->'views')>40 then raise exception 'workbook_limit';end if;
 if exists(select 1 from jsonb_array_elements(new.document->'sheets') x group by x->>'id' having count(*)>1)then raise exception 'duplicate_sheet';end if;
 for s in select value from jsonb_array_elements(new.document->'sheets') loop
  if coalesce(s->>'id','')!~'^[a-zA-Z0-9_-]{1,80}$' or length(coalesce(s->>'title','')) not between 1 and 80 or coalesce(s->>'kind','') not in('roster','attendance','assessments','exams','homework','progress','groups','parents','interventions','custom') or jsonb_typeof(s->'columns') is distinct from 'array' then raise exception 'invalid_sheet';end if;
  if jsonb_array_length(s->'columns')>40 then raise exception 'column_limit';end if;
  if exists(select 1 from jsonb_array_elements(s->'columns') x group by x->>'id' having count(*)>1)then raise exception 'duplicate_column';end if;
  for c in select value from jsonb_array_elements(s->'columns') loop
   if coalesce(c->>'id','')!~'^[a-zA-Z0-9_-]{1,80}$' or length(coalesce(c->>'label','')) not between 1 and 80 or coalesce(c->>'type','') not in('text','number','date','check','formula')then raise exception 'invalid_column';end if;
   if c->>'type'='formula' then
    if coalesce(c->>'operation','') not in('sum','average','difference') or jsonb_typeof(c->'sources') is distinct from 'array' then raise exception 'invalid_formula';end if;
    if jsonb_array_length(c->'sources') not between 1 and 40 or (c->>'operation'='difference' and jsonb_array_length(c->'sources')<>2) then raise exception 'invalid_formula';end if;
    if exists(select 1 from jsonb_array_elements_text(c->'sources') source where not exists(select 1 from jsonb_array_elements(s->'columns') col where col->>'id'=source and col->>'type'='number')) then raise exception 'invalid_formula_source';end if;
   end if;
  end loop;
 end loop;
 for sheet_entry in select * from jsonb_each(new.document->'cells') loop
  select x into v_sheet from jsonb_array_elements(new.document->'sheets') x where x->>'id'=sheet_entry.key;
  if v_sheet is null or jsonb_typeof(sheet_entry.value)<>'object' then raise exception 'invalid_sheet_cells';end if;
  for row_entry in select * from jsonb_each(sheet_entry.value) loop
   if row_entry.key!~'^[0-9a-fA-F-]{36}$' or jsonb_typeof(row_entry.value)<>'object' then raise exception 'invalid_learner_cells';end if;
   -- Retain existing notes for transferred learners; never accept new cells for them.
   if not exists(select 1 from public.student_classes sc join public.students st on st.id=sc.student_id where sc.student_id::text=row_entry.key and sc.school_id=new.school_id and sc.class_id=new.class_id and sc.is_current and st.deleted_at is null) then
    if tg_op<>'UPDATE' or old.document->'cells'->sheet_entry.key->row_entry.key is distinct from row_entry.value then raise exception 'workbook_learner_not_enrolled';end if;
   end if;
   for cell_entry in select * from jsonb_each(row_entry.value) loop
    select x into v_col from jsonb_array_elements(v_sheet->'columns') x where x->>'id'=cell_entry.key;
    if v_col is null or v_col->>'type'='formula' or jsonb_typeof(cell_entry.value) not in('string','number','boolean','null') then raise exception 'invalid_cell';end if;
    if jsonb_typeof(cell_entry.value)<>'null' then
     if (v_col->>'type' in('text','date') and jsonb_typeof(cell_entry.value)<>'string') or (v_col->>'type'='number' and jsonb_typeof(cell_entry.value)<>'number') or (v_col->>'type'='check' and jsonb_typeof(cell_entry.value)<>'boolean') then raise exception 'invalid_cell_type';end if;
     if length(cell_entry.value#>>'{}')>2000 then raise exception 'cell_limit';end if;
     if v_col->>'type'='date' then
      if (cell_entry.value#>>'{}')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_cell_date';end if;
      perform (cell_entry.value#>>'{}')::date;
     end if;
    end if;
   end loop;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function public.validate_teacher_class_workbook() from public,anon,authenticated;
create trigger validate_teacher_class_workbook before insert or update on public.teacher_class_workbooks for each row execute function public.validate_teacher_class_workbook();
create function public.teacher_get_class_workbook(p_school_id uuid,p_class_id uuid) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501';end if;
 if not exists(select 1 from public.teacher_classes tc join public.school_members sm on sm.school_id=tc.school_id and sm.profile_id=tc.teacher_id and sm.role::text='teacher' where tc.teacher_id=auth.uid() and tc.school_id=p_school_id and tc.class_id=p_class_id) then raise exception 'class_not_assigned' using errcode='42501';end if;
 select jsonb_build_object('document',w.document,'revision',w.revision) into result from public.teacher_class_workbooks w where w.teacher_id=auth.uid() and w.school_id=p_school_id and w.class_id=p_class_id;
 return coalesce(result,jsonb_build_object('document',null,'revision',0));
end $$;
create function public.teacher_save_class_workbook(p_school_id uuid,p_class_id uuid,p_expected_revision integer,p_document jsonb) returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare result integer;
begin
 if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501';end if;
 if p_expected_revision=0 then
  insert into public.teacher_class_workbooks(teacher_id,school_id,class_id,document) values(auth.uid(),p_school_id,p_class_id,p_document) on conflict(teacher_id,school_id,class_id) do nothing returning revision into result;
 else
  update public.teacher_class_workbooks w set document=p_document where w.teacher_id=auth.uid() and w.school_id=p_school_id and w.class_id=p_class_id and w.revision=p_expected_revision returning w.revision into result;
 end if;
 if result is null then raise exception 'workbook_conflict' using errcode='40001';end if;
 return result;
end $$;
revoke all on function public.teacher_get_class_workbook(uuid,uuid) from public,anon;
revoke all on function public.teacher_save_class_workbook(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.teacher_get_class_workbook(uuid,uuid) to authenticated;
grant execute on function public.teacher_save_class_workbook(uuid,uuid,integer,jsonb) to authenticated;

-- Atomic, retry-safe group creation reuses the canonical class_groups authority.
create function public.teacher_create_workbook_group(p_school_id uuid,p_class_id uuid,p_name text,p_student_ids uuid[],p_request_id uuid) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501';end if;
 if p_request_id is null or length(trim(coalesce(p_name,''))) not between 1 and 80 or coalesce(cardinality(p_student_ids),0) not between 1 and 1000 then raise exception 'invalid_group';end if;
 if not exists(select 1 from public.teacher_classes tc join public.classes c on c.id=tc.class_id and c.school_id=tc.school_id join public.school_members sm on sm.school_id=tc.school_id and sm.profile_id=tc.teacher_id and sm.role::text='teacher' join public.profiles p on p.id=tc.teacher_id and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false) where tc.teacher_id=auth.uid() and tc.school_id=p_school_id and tc.class_id=p_class_id) then raise exception 'class_not_assigned' using errcode='42501';end if;
 if exists(select 1 from unnest(p_student_ids) student where student is null or not exists(select 1 from public.student_classes sc join public.students s on s.id=sc.student_id and s.deleted_at is null where sc.student_id=student and sc.class_id=p_class_id and sc.school_id=p_school_id and sc.is_current)) then raise exception 'group_learner_not_enrolled';end if;
 insert into public.class_groups(id,class_id,name,color,type)values(p_request_id,p_class_id,trim(p_name),'#244c37','custom') on conflict(id)do nothing returning id into result;
 if result is null then
  if not exists(select 1 from public.class_groups g where g.id=p_request_id and g.class_id=p_class_id and g.name=trim(p_name)) then raise exception 'group_request_conflict';end if;
  if exists(select student from unnest(p_student_ids) student except select m.student_id from public.class_group_members m where m.group_id=p_request_id) or exists(select m.student_id from public.class_group_members m where m.group_id=p_request_id except select student from unnest(p_student_ids) student) then raise exception 'group_request_conflict';end if;
  return p_request_id;
 end if;
 insert into public.class_group_members(group_id,student_id)select result,student from (select distinct unnest(p_student_ids) student) selected;
 return result;
end $$;
revoke all on function public.teacher_create_workbook_group(uuid,uuid,text,uuid[],uuid) from public,anon;
grant execute on function public.teacher_create_workbook_group(uuid,uuid,text,uuid[],uuid) to authenticated;
commit;

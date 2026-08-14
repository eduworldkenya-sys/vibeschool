begin;

drop policy if exists "parent reads fee structures" on public.finance_fee_structures;
create policy "parent reads fee structures" on public.finance_fee_structures
for select to authenticated
using (
  exists (
    select 1
    from public.parent_student_links psl
    join public.student_classes sc on sc.student_id = psl.student_id and sc.school_id = psl.school_id
    where psl.parent_id = auth.uid()
      and coalesce(psl.access_level, 'full') <> 'none'
      and sc.is_current = true
      and sc.class_id = finance_fee_structures.class_id
  )
);

commit;

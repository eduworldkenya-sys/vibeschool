-- KICD Grade 8 Mathematics revised 2024, summary p. x:
-- official 5.1 heading = "Data Presentation and Interpretation".
-- Repair the existing persisted curriculum identity in place.
-- Do not create new sub-strands, rekey outcomes, or rewrite teacher schemes.
begin;

do $check$
declare
  v_sub_strand uuid;
  v_subject uuid;
begin
  select s.id,s.subject_id into v_sub_strand,v_subject
  from public.grade8_mathematics_reader_bindings b
  join public.cbc_strands s on s.id=b.sub_strand_id
  where b.source_ref='VS-CUR-G08-MA-2026#5.1'
    and b.status='active'
    and s.grade='Grade 8'
    and s.name='Data Handling and Probability'
    and s.sub_strand in ('Data Representation and Interpretation','Data Presentation and Interpretation');

  if v_sub_strand is null then
    raise exception 'GRADE8_MATH_KICD_5_1_IDENTITY_MISSING';
  end if;

  if exists (
    select 1 from public.cbc_strands s
    where s.subject_id=v_subject and s.grade='Grade 8'
      and s.name='Data Handling and Probability'
      and s.sub_strand='Data Presentation and Interpretation'
      and s.id<>v_sub_strand
  ) then
    raise exception 'GRADE8_MATH_KICD_5_1_DUPLICATE';
  end if;

  update public.cbc_strands s
  set sub_strand='Data Presentation and Interpretation'
  where s.id=v_sub_strand
    and s.sub_strand='Data Representation and Interpretation';

  if not exists (
    select 1 from public.cbc_strands s
    where s.id=v_sub_strand
      and s.sub_strand='Data Presentation and Interpretation'
  ) then
    raise exception 'GRADE8_MATH_KICD_5_1_RECONCILIATION_FAILED';
  end if;
end;
$check$;
commit;

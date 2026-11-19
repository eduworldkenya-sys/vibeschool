begin;
-- authorization-test: Public school book discovery exposes only global, learner-facing
-- structure labels and row identifiers. No source document, outcomes, manuscript,
-- account, school, teacher, progress or publication data is returned.
create or replace function public.get_school_textbook_shell_metadata(p_grade text,p_subject text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
with allowed as (
 select p_grade as grade
 where p_grade in ('Playgroup','PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12','Form 1','Form 2','Form 3','Form 4')
), registered as (
 select a.subject_name from public.grade_subject_authority a join allowed g on g.grade=a.grade
 where a.effective_from<=current_date and (a.effective_to is null or a.effective_to>=current_date)
), mapped as (
 select distinct s.id,s.name from public.subjects s join public.cbc_strands c on c.subject_id=s.id
 join allowed g on g.grade=c.grade
 where s.school_id is null
), matching as (
 select m.id from mapped m
 where p_subject is not null and length(p_subject)<=160
 and public.curriculum_textbook_subject_key(m.name)=public.curriculum_textbook_subject_key(p_subject)
), selected as (
 select c.id,c.name,c.sub_strand,c.strand_order,c.sub_strand_order,
 case when c.source_ref ~ '^VS-CUR-[A-Z0-9-]+#[0-9]+-[A-Z]+$' then c.source_ref else null end as source_ref
 from public.cbc_strands c join allowed g on g.grade=c.grade
 where c.subject_id in (select id from matching) and (select count(*) from matching)=1
)
select jsonb_build_object(
 'subjects',case when p_subject is null then coalesce((select jsonb_agg(n.subject_name order by n.subject_name) from
 (select subject_name from registered union select name from mapped) n),'[]'::jsonb) else '[]'::jsonb end,
 'rows',case when p_subject is not null then coalesce((select jsonb_agg(jsonb_build_object(
 'id',id,'name',name,'sub_strand',sub_strand,'strand_order',strand_order,'sub_strand_order',sub_strand_order,'source_ref',source_ref)
 order by strand_order nulls last,sub_strand_order nulls last,name,sub_strand,id) from selected),'[]'::jsonb) else '[]'::jsonb end
);
$$;
revoke all on function public.get_school_textbook_shell_metadata(text,text) from public,anon,authenticated;
grant execute on function public.get_school_textbook_shell_metadata(text,text) to anon,authenticated;
comment on function public.get_school_textbook_shell_metadata(text,text) is 'Read-only school shell metadata. Explicit school grades and global subjects only, no draft/publication/body/teacher or learner data. Underlying table privileges unchanged.';
notify pgrst,'reload schema';
commit;

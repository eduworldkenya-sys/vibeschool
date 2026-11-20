-- Reuse the owner-issued QA entitlement for published public practice only.
-- No new entitlement, school/class membership, private exam policy or result access.
create or replace function public.exq_public_practice_eligible(p_grade text)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
select auth.uid() is not null and p_grade is not null and exists (
  select 1 from public.students s where s.profile_id=auth.uid() and s.deleted_at is null
    and (
      exists(select 1 from public.independent_learner_identities ili
        where ili.user_id=auth.uid() and lower(btrim(ili.grade_label))=lower(btrim(p_grade)))
      or exists(select 1 from public.student_classes sc join public.classes c on c.id=sc.class_id
        where sc.student_id=s.id and sc.is_current=true
        and lower(btrim(c.name))=lower(btrim(p_grade)))
      or (
        lower(btrim(p_grade)) ~ '^(grade ([1-9]|1[0-2])|form [1-4])$'
        and exists(select 1 from public.profiles p join public.profile_entitlements e on e.profile_id=p.id
          where p.id=auth.uid() and p.role='student' and p.account_status='active'
            and not p.is_anonymized and e.entitlement_key='qa_universal_learner'
            and e.source='owner_qa' and (e.granted_until is null or e.granted_until>now()))
        and (select count(*) from public.students z where z.profile_id=auth.uid() and z.deleted_at is null)=1
      )
    )
) $function$;

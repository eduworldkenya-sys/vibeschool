create or replace function public.refresh_auth_identity_reconciliation()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_scan timestamptz := clock_timestamp();
  v_open integer;
begin
  insert into public.auth_identity_reconciliation_findings(
    finding_key,user_id,reason_code,classification,severity,repairability,evidence,last_seen_at,resolved_at
  )
  select 'AUTH_PROFILE_MISSING:'||u.id,u.id,'AUTH_PROFILE_MISSING','recoverable_partial_provisioning','P1','automatic_neutral',
         jsonb_build_object('created_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,
           'providers',coalesce((select jsonb_agg(i.provider order by i.provider) from auth.identities i where i.user_id=u.id),'[]'::jsonb)),
         v_scan,null
  from auth.users u left join public.profiles p on p.id=u.id
  where p.id is null
  on conflict(finding_key) do update set classification=excluded.classification,severity=excluded.severity,
    repairability=excluded.repairability,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at,resolved_at=null;

  insert into public.auth_identity_reconciliation_findings(
    finding_key,user_id,reason_code,classification,severity,repairability,evidence,last_seen_at,resolved_at
  )
  select 'STUDENT_DOMAIN_MISSING:'||p.id,p.id,'STUDENT_DOMAIN_MISSING','orphaned_domain_relation','P1','manual_proof_required',
         jsonb_build_object('account_status',p.account_status::text,'profile_school_id',p.school_id),v_scan,null
  from public.profiles p
  left join public.students s on s.profile_id=p.id and s.deleted_at is null
  where p.role='student' and p.account_status::text='active' and not p.is_anonymized and s.id is null
  on conflict(finding_key) do update set classification=excluded.classification,severity=excluded.severity,
    repairability=excluded.repairability,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at,resolved_at=null;

  insert into public.auth_identity_reconciliation_findings(
    finding_key,user_id,reason_code,classification,severity,repairability,evidence,last_seen_at,resolved_at
  )
  select 'ADMIN_MEMBERSHIP_MISSING:'||p.id,p.id,'ADMIN_MEMBERSHIP_MISSING',
         case when p.account_status::text='active' and not p.is_anonymized then 'invalid_authority_state' else 'legacy_historical_state' end,
         case when p.account_status::text='active' and not p.is_anonymized then 'P0' else 'P1' end,
         'manual_proof_required',
         jsonb_build_object('account_status',p.account_status::text,'is_anonymized',p.is_anonymized,'profile_school_id',p.school_id),v_scan,null
  from public.profiles p
  where p.role='admin' and not exists(
    select 1 from public.school_members sm where sm.profile_id=p.id and sm.role::text in ('admin','owner')
  )
  on conflict(finding_key) do update set classification=excluded.classification,severity=excluded.severity,
    repairability=excluded.repairability,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at,resolved_at=null;

  insert into public.auth_identity_reconciliation_findings(
    finding_key,user_id,reason_code,classification,severity,repairability,evidence,last_seen_at,resolved_at
  )
  select 'TEACHER_LIFECYCLE_INCOMPLETE:'||p.id,p.id,'TEACHER_LIFECYCLE_INCOMPLETE',
         case
           when p.school_id is null and not exists(select 1 from public.teacher_classes tc where tc.teacher_id=p.id)
             then 'valid_onboarding_incomplete'
           else 'manual_review_required'
         end,
         case
           when p.school_id is null and not exists(select 1 from public.teacher_classes tc where tc.teacher_id=p.id)
             then 'INFO' else 'P1' end,
         case
           when p.school_id is null and not exists(select 1 from public.teacher_classes tc where tc.teacher_id=p.id)
             then 'none' else 'manual_proof_required' end,
         jsonb_build_object(
           'profile_school_id',p.school_id,
           'has_teacher_profile',exists(select 1 from public.teacher_profiles tp where tp.profile_id=p.id),
           'has_teacher_membership',exists(select 1 from public.school_members sm where sm.profile_id=p.id and sm.role::text='teacher'),
           'has_teacher_classes',exists(select 1 from public.teacher_classes tc where tc.teacher_id=p.id),
           'has_lesson_history',exists(select 1 from public.lesson_plans lp where lp.teacher_id=p.id)
         ),v_scan,null
  from public.profiles p
  where p.role='teacher' and p.account_status::text='active' and not p.is_anonymized
    and not exists(select 1 from public.teacher_profiles tp where tp.profile_id=p.id)
    and not exists(select 1 from public.school_members sm where sm.profile_id=p.id and sm.role::text='teacher')
  on conflict(finding_key) do update set classification=excluded.classification,severity=excluded.severity,
    repairability=excluded.repairability,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at,resolved_at=null;

  insert into public.auth_identity_reconciliation_findings(
    finding_key,user_id,reason_code,classification,severity,repairability,evidence,last_seen_at,resolved_at
  )
  select 'PARENT_LIFECYCLE_UNLINKED:'||p.id,p.id,'PARENT_LIFECYCLE_UNLINKED',
         case
           when p.school_id is null and not exists(select 1 from public.parent_profiles pp where pp.profile_id=p.id)
             then 'valid_awaiting_child_link'
           else 'manual_review_required'
         end,
         case
           when p.school_id is null and not exists(select 1 from public.parent_profiles pp where pp.profile_id=p.id)
             then 'INFO' else 'P1' end,
         case
           when p.school_id is null and not exists(select 1 from public.parent_profiles pp where pp.profile_id=p.id)
             then 'none' else 'manual_proof_required' end,
         jsonb_build_object(
           'profile_school_id',p.school_id,
           'has_parent_profile',exists(select 1 from public.parent_profiles pp where pp.profile_id=p.id),
           'has_child_link',exists(select 1 from public.parent_student_links psl where psl.parent_id=p.id)
         ),v_scan,null
  from public.profiles p
  where p.role='parent' and p.account_status::text='active' and not p.is_anonymized
    and not exists(select 1 from public.parent_student_links psl where psl.parent_id=p.id)
  on conflict(finding_key) do update set classification=excluded.classification,severity=excluded.severity,
    repairability=excluded.repairability,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at,resolved_at=null;

  with linked as (
    select i.user_id,count(*) identity_count,count(distinct i.provider) provider_count,
           array_agg(i.provider order by i.provider) providers
    from auth.identities i group by i.user_id having count(*)>1
  )
  insert into public.auth_identity_reconciliation_findings(
    finding_key,user_id,reason_code,classification,severity,repairability,evidence,last_seen_at,resolved_at
  )
  select 'MULTI_PROVIDER_IDENTITY:'||l.user_id,l.user_id,'MULTI_PROVIDER_IDENTITY',
         case when l.identity_count=2 and l.provider_count=2 and l.providers=array['email','google']::text[]
              then 'valid_linked_identity' else 'manual_review_required' end,
         case when l.identity_count=2 and l.provider_count=2 and l.providers=array['email','google']::text[] then 'INFO' else 'P1' end,
         case when l.identity_count=2 and l.provider_count=2 and l.providers=array['email','google']::text[] then 'none' else 'manual_proof_required' end,
         jsonb_build_object('providers',l.providers,'identity_count',l.identity_count),v_scan,null
  from linked l
  on conflict(finding_key) do update set classification=excluded.classification,severity=excluded.severity,
    repairability=excluded.repairability,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at,resolved_at=null;

  update public.auth_identity_reconciliation_findings
  set resolved_at=v_scan
  where resolved_at is null and last_seen_at < v_scan;

  select count(*) into v_open from public.auth_identity_reconciliation_findings where resolved_at is null;
  return jsonb_build_object('scan_started_at',v_scan,'open_findings',v_open);
end;
$function$;

revoke all on function public.refresh_auth_identity_reconciliation() from public, anon, authenticated;
grant execute on function public.refresh_auth_identity_reconciliation() to service_role;

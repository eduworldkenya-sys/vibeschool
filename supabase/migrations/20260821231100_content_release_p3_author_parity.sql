-- Release-gate P3 author-version parity forward repair. Non-activating.
create or replace function public.content_convergence_release_identity_current(p_version_id uuid,p_p2_id uuid,p_p3_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select p2.author_worker_key=v.worker_key and p3.author_worker_key=v.worker_key and p2.author_worker_version=p3.author_worker_version
    and exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=v.worker_key and a.worker_version=p2.author_worker_version and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp())
    and exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=p2.evaluator_worker_key and a.worker_version=p2.evaluator_worker_version and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp())
    and exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=p3.evaluator_worker_key and a.worker_version=p3.evaluator_worker_version and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp())
  from public.content_convergence_versions v join public.content_convergence_evaluation_identities p2 on p2.evaluation_id=p_p2_id join public.content_convergence_evaluation_identities p3 on p3.evaluation_id=p_p3_id where v.id=p_version_id
$$;
revoke all on function public.content_convergence_release_identity_current(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.content_convergence_release_identity_current(uuid,uuid,uuid) to service_role;

create or replace function public.content_convergence_enforce_release_identity_parity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.decision='RELEASE_CANDIDATE' and not coalesce(public.content_convergence_release_identity_current(new.version_id,(new.evidence_packet->>'p2_evaluation_id')::uuid,(new.evidence_packet->>'p3_evaluation_id')::uuid),false) then raise exception 'RELEASE_IDENTITY_PARITY_REQUIRED'; end if;
  return new;
end $$;
create trigger content_convergence_release_identity_parity before insert or update on public.content_convergence_release_decisions for each row execute function public.content_convergence_enforce_release_identity_parity();
revoke all on function public.content_convergence_enforce_release_identity_parity() from public,anon,authenticated,service_role;

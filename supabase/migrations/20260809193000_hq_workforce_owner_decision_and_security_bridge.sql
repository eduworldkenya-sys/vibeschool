-- HQ Workforce OS: owner decision bridge and workforce-specific advisor hardening.
-- Authentication is delegated to hq_assert_owner(); no anonymous access is granted.

create or replace function public.hq_workforce_list_decisions(p_status text default 'actionable', p_limit integer default 100)
returns table(id uuid,decision_key text,worker_key text,lane_key text,job_key text,proposed_action text,reason text,risk text,status text,revision text,run_id uuid,evidence_snapshot_id uuid,created_at timestamptz)
language plpgsql security definer set search_path=public as $$ begin
 perform public.hq_assert_owner();
 return query
 select d.id,d.decision_key,w.worker_key,d.lane_key,d.job_key,d.proposed_action,d.reason,d.risk,d.status,d.revision,d.run_id,d.evidence_snapshot_id,d.created_at
 from public.hq_workforce_decisions d left join public.hq_workforce_workers w on w.id=d.worker_id
 where p_status is null or (p_status='actionable' and d.status in ('pending','revision_requested')) or d.status=p_status
 order by case d.risk when 'critical' then 4 when 'high' then 3 when 'normal' then 2 else 1 end desc,d.created_at asc
 limit least(greatest(coalesce(p_limit,100),1),500);
end $$;

create or replace function public.hq_workforce_decide(p_id uuid,p_action text,p_revision text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.hq_workforce_decisions%rowtype; r public.hq_workforce_runs%rowtype; event_result jsonb; next_status text; proposed jsonb; corrected jsonb; v_revision integer;
begin
 perform public.hq_assert_owner();
 if p_action not in ('approve','revise','reject','skip') then raise exception 'Invalid decision action'; end if;
 select * into d from public.hq_workforce_decisions where id=p_id for update;
 if not found then raise exception 'Decision not found'; end if;
 if d.status not in ('pending','revision_requested') then raise exception 'Decision already resolved'; end if;
 select * into r from public.hq_workforce_runs where id=d.run_id;
 if not found then raise exception 'Decision run missing'; end if;
 select coalesce(max(e.decision_revision),0)+1 into v_revision from public.hq_workforce_correction_events e where e.decision_id=d.id;
 proposed:=jsonb_build_object('proposed_action',d.proposed_action,'job_key',d.job_key,'reason',d.reason,'risk',d.risk);
 corrected:=case when p_revision is null then null else proposed||jsonb_build_object('founder_revision_note',p_revision) end;
 if p_action='approve' then
   event_result:=public.hq_workforce_capture_founder_decision(d.id,v_revision,'approve',d.evidence_snapshot_id,d.run_id,proposed,corrected,null); next_status:='approved';
 elsif p_action='revise' then
   if p_revision is null or btrim(p_revision)='' then raise exception 'Revision text required'; end if;
   event_result:=public.hq_workforce_capture_founder_decision(d.id,v_revision,'revise',d.evidence_snapshot_id,d.run_id,proposed,corrected,null); next_status:='revision_requested';
 elsif p_action='reject' then
   if p_revision is null or btrim(p_revision)='' then raise exception 'Rejection reason required'; end if;
   event_result:=public.hq_workforce_capture_founder_decision(d.id,v_revision,'reject',d.evidence_snapshot_id,d.run_id,proposed,null,p_revision); next_status:='rejected';
 else
   next_status:='skipped'; event_result:=jsonb_build_object('event_type','skip','candidate_created',false);
 end if;
 update public.hq_workforce_decisions set status=next_status,revision=p_revision,decided_by=auth.uid(),decided_at=now() where id=d.id;
 return jsonb_build_object('decision_id',d.id,'status',next_status,'decision_revision',v_revision,'learning',event_result);
end $$;

revoke all on function public.hq_workforce_list_decisions(text,integer) from public,anon;
revoke all on function public.hq_workforce_decide(uuid,text,text) from public,anon;
grant execute on function public.hq_workforce_list_decisions(text,integer) to authenticated;
grant execute on function public.hq_workforce_decide(uuid,text,text) to authenticated;

alter view public.hq_workforce_worker_performance set (security_invoker = true);

create or replace function public.hq_context_snapshots_immutable() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin raise exception 'HQ context decision snapshots are immutable'; end; $$;
create or replace function public.hq_context_provenance_immutable() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin raise exception 'HQ context provenance is immutable'; end; $$;
create or replace function public.hq_workforce_lane_for_work(p_department text,p_work_type text,p_source_type text) returns text language sql immutable set search_path=public,pg_temp as $$ select case when p_department in ('security','auth') or coalesce(p_work_type,'') ilike '%security%' then 'security' when p_department in ('support','customer-support') or coalesce(p_work_type,'') ilike any(array['%support%','%sla%']) then 'support-operations' when p_department in ('school-success','schools','success') or coalesce(p_work_type,'') ilike any(array['%school-success%','%school_risk%','%adoption%']) then 'school-success' when p_department in ('finance','billing','payments') or coalesce(p_work_type,'') ilike any(array['%finance%','%payment%','%reconciliation%']) then 'finance-operations' when p_department in ('publishing','vibepress') or coalesce(p_work_type,'') ilike any(array['%release%','%publishing%','%publication%']) then 'publishing-operations' when p_department in ('hr','workforce') or coalesce(p_work_type,'') ilike any(array['%workforce%','%capacity_gap%','%skill_gap%']) then 'workforce-intelligence' when p_department in ('content','curriculum') or coalesce(p_work_type,'') ilike any(array['%curriculum%','%content%']) then 'curriculum-intelligence' when p_department in ('growth','marketing','sales') or coalesce(p_work_type,'') ilike any(array['%growth%','%conversion%','%retention%']) then 'growth' when p_department in ('product','quality') or coalesce(p_work_type,'') ilike any(array['%quality%','%regression%','%bug%','%verification%']) then 'product-quality' else 'operations' end; $$;
create or replace function public.hq_workforce_test_context_health(p_fresh boolean,p_fact_confidence numeric,p_source_reliability numeric,p_source_active boolean,p_malformed boolean,p_high_stakes boolean default true) returns table(status text,violation_code text) language plpgsql immutable set search_path=public,pg_temp as $$ begin if p_malformed then return query select 'deny'::text,'MALFORMED_CONTEXT'::text; return; end if; if not p_fresh then return query select 'deny'::text,'STALE_CONTEXT'::text; return; end if; if p_source_active is distinct from true then return query select 'deny'::text,'SOURCE_INACTIVE'::text; return; end if; if p_source_reliability is null then return query select 'deny'::text,'SOURCE_RELIABILITY_UNKNOWN'::text; return; end if; if p_high_stakes and least(coalesce(p_fact_confidence,0),p_source_reliability)<0.70 then return query select 'escalate'::text,'LOW_CONFIDENCE_HIGH_STAKES'::text; return; end if; return query select 'allow'::text,null::text; end $$;
create or replace function public.hq_workforce_qualification_state(p_count integer,p_has_contradiction boolean,p_stale boolean,p_high_severity boolean,p_min integer default 3) returns text language sql immutable set search_path=public,pg_temp as $$ select case when p_has_contradiction then 'contradicted' when p_stale then 'expired' when p_high_severity then 'qualified_for_compilation' when p_count>=p_min then 'qualified_for_compilation' else 'qualifying' end $$;
create or replace function public.hq_workforce_probation_state(p_verified_runs integer,p_failures integer,p_lowest_confidence numeric,p_unverified_outcomes integer,p_min_runs integer default 3,p_allowed_failures integer default 0,p_min_confidence numeric default .70) returns text language sql immutable set search_path=public,pg_temp as $$ select case when p_failures>p_allowed_failures or coalesce(p_lowest_confidence,0)<p_min_confidence or p_unverified_outcomes>0 then 'rollback' when p_verified_runs>=p_min_runs then 'promote' else 'probation' end $$;

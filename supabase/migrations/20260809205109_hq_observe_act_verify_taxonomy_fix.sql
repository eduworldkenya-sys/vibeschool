insert into public.hq_product_event_contract(event_type,product_key,category,department_key,severity,creates_work,creates_incident,decision_required,verification_event_type,max_unverified_minutes)
values
 ('lesson_plan.created','teacher','teaching','customer','info',false,false,false,null,120),
 ('publication.created','vibebooks','publishing','content','info',false,false,false,null,1440),
 ('publication.updated','vibebooks','publishing','content','info',false,false,false,null,1440),
 ('user.signup','platform','growth','growth','info',false,false,false,null,1440)
on conflict(event_type) do update set product_key=excluded.product_key,category=excluded.category,department_key=excluded.department_key,severity=excluded.severity,creates_work=excluded.creates_work,creates_incident=excluded.creates_incident,decision_required=excluded.decision_required,verification_event_type=excluded.verification_event_type,max_unverified_minutes=excluded.max_unverified_minutes,active=true,updated_at=now();

create or replace function public.hq_reconcile_product_event_verifications()
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; n_verified int:=0; n_escalated int:=0; v_match uuid; v_source_entity uuid; v_homework text;
begin
 for r in select t.*,c.verification_event_type,c.max_unverified_minutes from public.hq_product_event_trace t join public.hq_product_event_contract c on c.event_type=t.event_type where t.state in ('awaiting_verification','routed','actioned') and c.verification_event_type is not null loop
   select entity_id into v_source_entity from public.platform_events where id=r.event_id;
   v_homework:=case when r.event_type='homework.created' then v_source_entity::text else null end;
   select e.id into v_match from public.platform_events e
   where e.event_type=r.verification_event_type and e.occurred_at>=r.created_at
     and (r.evidence->>'school_id' is null or e.school_id::text=r.evidence->>'school_id')
     and (v_homework is null or e.metadata->>'homework_id'=v_homework)
   order by e.occurred_at asc limit 1;
   if v_match is not null then
     update public.hq_product_event_trace set state='verified',verification_event_id=v_match,verified_at=now(),updated_at=now(),evidence=evidence||jsonb_build_object('verification_event_id',v_match,'correlation_basis',case when v_homework is not null then 'homework_id' else 'event_type_time_school' end) where event_id=r.event_id;
     n_verified:=n_verified+1;
   elsif r.created_at < now()-make_interval(mins=>greatest(5,r.max_unverified_minutes)) and r.state<>'escalated' then
     update public.hq_product_event_trace set state='escalated',escalated_at=now(),updated_at=now(),evidence=evidence||jsonb_build_object('escalation_reason','verification_timeout') where event_id=r.event_id;
     insert into public.hq_notifications(event_id,category,severity,title,body,route,status,metadata) values(r.event_id,'operations','warning','Product outcome verification overdue',format('%s has not produced expected verification event %s',r.event_type,r.verification_event_type),'/hq','unread',jsonb_build_object('correlation_id',r.correlation_id,'event_id',r.event_id,'expected_event_type',r.verification_event_type));
     n_escalated:=n_escalated+1;
   end if;
 end loop;
 return jsonb_build_object('verified',n_verified,'escalated',n_escalated);
end $$;
revoke all on function public.hq_reconcile_product_event_verifications() from public,anon,authenticated;
grant execute on function public.hq_reconcile_product_event_verifications() to service_role;

do $$ declare r record; begin for r in select t.event_id from public.hq_product_event_trace t join public.hq_product_event_contract c on c.event_type=t.event_type where t.state='ignored' and c.active loop delete from public.hq_product_event_trace where event_id=r.event_id; perform public.hq_trace_product_event(r.event_id); end loop; end $$;
select public.hq_reconcile_product_event_verifications();

-- Pathways RPC authority on current main.

begin;

create or replace function public.student_get_pathway_passport()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $function$
  select coalesce((select jsonb_build_object('student_id',pp.student_id,'pathway_id',p.id,'pathway_slug',p.slug,'pathway_name',p.name,'summary',p.plain_language_summary,'evidence_type',pp.evidence_type,'evidence_snapshot',pp.evidence_snapshot,'rule_version',pp.rule_version,'adopted_at',pp.adopted_at,'reviewed_at',pp.reviewed_at,'updated_at',pp.updated_at)
  from public.student_pathway_passports pp join public.students s on s.id=pp.student_id and s.deleted_at is null join public.pathways p on p.id=pp.adopted_pathway_id where s.profile_id=auth.uid() limit 1),'null'::jsonb);
$function$;
revoke all on function public.student_get_pathway_passport() from public,anon,authenticated;
grant execute on function public.student_get_pathway_passport() to authenticated;

create or replace function public.student_adopt_pathway_quick_check(p_pathway_slug text,p_answers jsonb,p_scores jsonb,p_rule_version text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare caller uuid:=auth.uid(); learner public.students%rowtype; chosen public.pathways%rowtype; decision public.student_pathway_decisions%rowtype; fingerprint text; replayed boolean:=false;
begin
 if caller is null then raise exception 'not_authenticated'; end if;
 select * into learner from public.students where profile_id=caller and deleted_at is null order by created_at limit 1;
 if not found then raise exception 'learner_identity_not_found'; end if;
 select * into chosen from public.pathways where slug=lower(trim(p_pathway_slug)) and status='published' limit 1;
 if not found then raise exception 'published_pathway_not_found'; end if;
 if p_rule_version is null or length(trim(p_rule_version))=0 or length(p_rule_version)>80 then raise exception 'invalid_rule_version'; end if;
 if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>128 then raise exception 'invalid_idempotency_key'; end if;
 if pg_column_size(coalesce(p_answers,'{}'::jsonb))>16384 or pg_column_size(coalesce(p_scores,'{}'::jsonb))>4096 then raise exception 'payload_too_large'; end if;
 fingerprint:=encode(extensions.digest(convert_to(jsonb_build_object('pathway_slug',chosen.slug,'answers',coalesce(p_answers,'{}'::jsonb),'scores',coalesce(p_scores,'{}'::jsonb),'rule_version',trim(p_rule_version))::text,'UTF8'),'sha256'),'hex');
 select * into decision from public.student_pathway_decisions where student_id=learner.id and idempotency_key=p_idempotency_key for update;
 if found then replayed:=true; if decision.input_fingerprint<>fingerprint or decision.pathway_id<>chosen.id then raise exception 'idempotency_replay_mismatch'; end if;
 else insert into public.student_pathway_decisions(student_id,pathway_id,decision_type,evidence_snapshot,input_fingerprint,rule_version,idempotency_key,created_by) values(learner.id,chosen.id,'quick_check_saved',jsonb_build_object('evidence_class','learner_supplied_quick_check','answers',coalesce(p_answers,'{}'::jsonb),'scores',coalesce(p_scores,'{}'::jsonb),'disclaimer','Early VibeSchool guidance; not an official placement decision.'),fingerprint,trim(p_rule_version),p_idempotency_key,caller) returning * into decision; end if;
 insert into public.student_pathway_passports(student_id,adopted_pathway_id,source_decision_id,evidence_type,evidence_snapshot,rule_version,adopted_at,updated_at) values(learner.id,chosen.id,decision.id,'quick_check',jsonb_build_object('evidence_class','learner_supplied_quick_check','scores',coalesce(p_scores,'{}'::jsonb)),trim(p_rule_version),decision.created_at,now()) on conflict(student_id) do update set adopted_pathway_id=excluded.adopted_pathway_id,source_decision_id=excluded.source_decision_id,evidence_type=excluded.evidence_type,evidence_snapshot=excluded.evidence_snapshot,rule_version=excluded.rule_version,adopted_at=excluded.adopted_at,updated_at=now();
 return jsonb_build_object('ok',true,'student_id',learner.id,'pathway_slug',chosen.slug,'pathway_name',chosen.name,'decision_id',decision.id,'saved_at',decision.created_at,'replayed',replayed);
end;$function$;
revoke all on function public.student_adopt_pathway_quick_check(text,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.student_adopt_pathway_quick_check(text,jsonb,jsonb,text,text) to authenticated;

create or replace function public.parent_save_pathway_draft(p_pathway_slug text,p_answers jsonb,p_scores jsonb,p_rule_version text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare caller uuid:=auth.uid(); chosen public.pathways%rowtype; existing public.parent_pathway_drafts%rowtype; fingerprint text;
begin
 if caller is null then raise exception 'not_authenticated'; end if;
 if not exists(select 1 from public.profiles p where p.id=caller and p.role='parent') then raise exception 'parent_role_required'; end if;
 select * into chosen from public.pathways where slug=lower(trim(p_pathway_slug)) and status='published' limit 1; if not found then raise exception 'published_pathway_not_found'; end if;
 if p_rule_version is null or length(trim(p_rule_version))=0 or length(p_rule_version)>80 then raise exception 'invalid_rule_version'; end if;
 if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>128 then raise exception 'invalid_idempotency_key'; end if;
 if pg_column_size(coalesce(p_answers,'{}'::jsonb))>16384 or pg_column_size(coalesce(p_scores,'{}'::jsonb))>4096 then raise exception 'payload_too_large'; end if;
 fingerprint:=encode(extensions.digest(convert_to(jsonb_build_object('pathway_slug',chosen.slug,'answers',coalesce(p_answers,'{}'::jsonb),'scores',coalesce(p_scores,'{}'::jsonb),'rule_version',trim(p_rule_version))::text,'UTF8'),'sha256'),'hex');
 select * into existing from public.parent_pathway_drafts where parent_profile_id=caller and idempotency_key=p_idempotency_key for update;
 if found then if existing.input_fingerprint<>fingerprint or existing.pathway_id<>chosen.id then raise exception 'idempotency_replay_mismatch'; end if; return jsonb_build_object('ok',true,'draft_id',existing.id,'pathway_slug',chosen.slug,'pathway_name',chosen.name,'saved_at',existing.created_at,'replayed',true); end if;
 insert into public.parent_pathway_drafts(parent_profile_id,pathway_id,evidence_snapshot,rule_version,input_fingerprint,idempotency_key) values(caller,chosen.id,jsonb_build_object('evidence_class','family_pathways_draft','answers',coalesce(p_answers,'{}'::jsonb),'scores',coalesce(p_scores,'{}'::jsonb),'notice','Parent-owned planning draft; not a learner Pathway Passport.'),trim(p_rule_version),fingerprint,p_idempotency_key) returning * into existing;
 return jsonb_build_object('ok',true,'draft_id',existing.id,'pathway_slug',chosen.slug,'pathway_name',chosen.name,'saved_at',existing.created_at,'replayed',false);
end;$function$;
revoke all on function public.parent_save_pathway_draft(text,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.parent_save_pathway_draft(text,jsonb,jsonb,text,text) to authenticated;

create or replace function public.pathways_ingest_source_observation(p_source_id uuid,p_observation_kind text,p_external_record_id text,p_external_parent_id text,p_observed_label text,p_observed_payload jsonb,p_evidence_url text,p_observed_at timestamptz default now())
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_id uuid; v_hash text;
begin
 if p_source_id is null or not exists(select 1 from public.pathway_sources s where s.id=p_source_id and s.status='active') then raise exception 'active_pathway_source_required'; end if;
 if p_observation_kind not in('pathway','track','subject_combination','career_link','school_offering') then raise exception 'invalid_observation_kind'; end if;
 if p_external_record_id is null or length(trim(p_external_record_id))=0 or length(p_external_record_id)>500 then raise exception 'invalid_external_record_id'; end if;
 if p_observed_label is null or length(trim(p_observed_label))=0 or length(p_observed_label)>1000 then raise exception 'invalid_observed_label'; end if;
 if pg_column_size(coalesce(p_observed_payload,'{}'::jsonb))>262144 then raise exception 'observation_payload_too_large'; end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('kind',p_observation_kind,'external_record_id',trim(p_external_record_id),'external_parent_id',nullif(trim(coalesce(p_external_parent_id,'')),''),'label',trim(p_observed_label),'payload',coalesce(p_observed_payload,'{}'::jsonb),'evidence_url',nullif(trim(coalesce(p_evidence_url,'')),'') )::text,'UTF8'),'sha256'),'hex');
 insert into public.pathway_source_observations(source_id,observation_kind,external_record_id,external_parent_id,observed_label,observed_payload,evidence_url,observed_at,content_hash) values(p_source_id,p_observation_kind,trim(p_external_record_id),nullif(trim(coalesce(p_external_parent_id,'')),''),trim(p_observed_label),coalesce(p_observed_payload,'{}'::jsonb),nullif(trim(coalesce(p_evidence_url,'')),''),coalesce(p_observed_at,now()),v_hash) on conflict(source_id,observation_kind,external_record_id,content_hash) do update set observed_at=greatest(public.pathway_source_observations.observed_at,excluded.observed_at) returning id into v_id;
 return v_id;
end;$function$;
revoke all on function public.pathways_ingest_source_observation(uuid,text,text,text,text,jsonb,text,timestamptz) from public,anon,authenticated;
grant execute on function public.pathways_ingest_source_observation(uuid,text,text,text,text,jsonb,text,timestamptz) to service_role;

create or replace function public.pathways_search_public_schools(p_query text default null,p_county text default null,p_pathway_slug text default null,p_combination_slug text default null,p_limit integer default 30)
returns table(school_id uuid,school_name text,county text,sub_county text,school_category text,ownership_type text,gender_type text,accommodation_type text,knec_code text,pathway_slug text,pathway_name text,combination_slug text,combination_name text,offering_verified_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $function$
 select d.id,d.name,d.county,d.sub_county,d.school_category,d.ownership_type,d.gender_type,d.accommodation_type,d.knec_code,p.slug,p.name,c.slug,c.display_name,o.verified_at
 from public.school_directory_public d
 left join public.pathway_school_offerings o on o.school_id=d.id and o.offering_status='verified' and o.verified_at is not null
 left join public.pathways p on p.id=o.pathway_id and p.status='published'
 left join public.pathway_subject_combinations c on c.id=o.combination_id and c.status='published'
 where (p_query is null or d.name ilike '%'||trim(p_query)||'%') and (p_county is null or d.county ilike trim(p_county)) and (p_pathway_slug is null or p.slug=lower(trim(p_pathway_slug))) and (p_combination_slug is null or c.slug=lower(trim(p_combination_slug)))
 order by d.name asc limit greatest(1,least(coalesce(p_limit,30),100));
$function$;
revoke all on function public.pathways_search_public_schools(text,text,text,text,integer) from public,authenticated;
grant execute on function public.pathways_search_public_schools(text,text,text,text,integer) to anon,authenticated;

create or replace function public.parent_get_linked_pathway_passports()
returns table(student_id uuid,student_name text,pathway_slug text,pathway_name text,evidence_type text,updated_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $function$
 select s.id,s.full_name,p.slug,p.name,pp.evidence_type,pp.updated_at from public.parent_student_links l join public.students s on s.id=l.student_id and s.deleted_at is null join public.student_pathway_passports pp on pp.student_id=s.id join public.pathways p on p.id=pp.adopted_pathway_id where l.parent_id=auth.uid();
$function$;
revoke all on function public.parent_get_linked_pathway_passports() from public,anon,authenticated;
grant execute on function public.parent_get_linked_pathway_passports() to authenticated;

create or replace function public.teacher_get_assigned_pathway_passports()
returns table(student_id uuid,student_name text,class_id uuid,pathway_slug text,pathway_name text,evidence_type text,updated_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $function$
 select s.id,s.full_name,s.class_id,p.slug,p.name,pp.evidence_type,pp.updated_at from public.teacher_classes tc join public.students s on s.class_id=tc.class_id and s.deleted_at is null join public.student_pathway_passports pp on pp.student_id=s.id join public.pathways p on p.id=pp.adopted_pathway_id where tc.teacher_id=auth.uid();
$function$;
revoke all on function public.teacher_get_assigned_pathway_passports() from public,anon,authenticated;
grant execute on function public.teacher_get_assigned_pathway_passports() to authenticated;

commit;

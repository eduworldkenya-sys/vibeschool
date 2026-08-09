-- Complete Curriculum Intelligence signal sources and operator recovery.

create unique index if not exists uq_content_health_active_chapter_signal on public.curriculum_content_health_signals(publication_id,chapter_id,signal_type) where outcome_id is null and chapter_id is not null and status in ('open','watching','proposal_created');

create or replace function public.hq_refresh_teacher_workaround_signals(p_publication_id uuid default null)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare n int:=0;begin
 if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 insert into public.curriculum_content_health_signals(publication_id,chapter_id,signal_type,severity,score,evidence_count,evidence,status,last_detected_at,updated_at)
 select vc.publication_id,vc.id,'teacher_workaround',case when count(distinct d.created_by)>=5 then 'high' else 'medium' end,least(1,count(distinct d.created_by)::numeric/8),count(*)::int,
 jsonb_build_object('teachers',count(distinct d.created_by),'derivatives',count(*),'types',jsonb_agg(distinct d.derivative_type),'source','content_derivatives'),'open',now(),now()
 from public.content_derivatives d join public.vibe_chapters vc on vc.id=d.source_chapter_id
 where d.created_by is not null and d.created_at>=now()-interval '30 days' and d.derivative_type in ('teacher_notes','assessment','project_brief','lesson_notes') and (p_publication_id is null or vc.publication_id=p_publication_id)
 group by vc.publication_id,vc.id having count(distinct d.created_by)>=3
 on conflict(publication_id,chapter_id,signal_type) where outcome_id is null and chapter_id is not null and status in ('open','watching','proposal_created') do update set severity=excluded.severity,score=excluded.score,evidence_count=excluded.evidence_count,evidence=excluded.evidence,last_detected_at=now(),updated_at=now();
 get diagnostics n=row_count;return jsonb_build_object('teacher_workaround',n,'refreshed_at',now());end $$;
revoke all on function public.hq_refresh_teacher_workaround_signals(uuid) from public,anon;grant execute on function public.hq_refresh_teacher_workaround_signals(uuid) to authenticated;

create or replace function public.curriculum_intelligence_proposal_to_health_signal()
returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
declare st text;sev text;begin
 if new.chapter_id is null then return new; end if;
 st:=case when new.curriculum_relevance='C0' then 'curriculum_change' when new.proposal_type in ('correction','enrichment','new_content') then 'research_change' else null end;
 if st is null then return new; end if;
 sev:=case when new.curriculum_relevance in ('C0','C1') then 'high' when new.curriculum_relevance='C2' then 'medium' else 'low' end;
 insert into public.curriculum_content_health_signals(publication_id,chapter_id,signal_type,severity,score,evidence_count,evidence,status,last_detected_at,updated_at)
 values(new.publication_id,new.chapter_id,st,sev,greatest(0,least(1,coalesce(new.confidence,0))),coalesce((select count(*) from public.curriculum_intelligence_sources s where s.proposal_id=new.id),0),jsonb_build_object('proposal_id',new.id,'verification_status',new.verification_status,'curriculum_relevance',new.curriculum_relevance,'source','curriculum_intelligence_proposals'),'open',now(),now())
 on conflict(publication_id,chapter_id,signal_type) where outcome_id is null and chapter_id is not null and status in ('open','watching','proposal_created') do update set severity=excluded.severity,score=greatest(public.curriculum_content_health_signals.score,excluded.score),evidence=excluded.evidence,last_detected_at=now(),updated_at=now();
 return new;end $$;
drop trigger if exists trg_curriculum_intelligence_proposal_health on public.curriculum_intelligence_proposals;
create trigger trg_curriculum_intelligence_proposal_health after insert on public.curriculum_intelligence_proposals for each row execute function public.curriculum_intelligence_proposal_to_health_signal();
revoke all on function public.curriculum_intelligence_proposal_to_health_signal() from public,anon,authenticated;

create or replace function public.curriculum_rights_to_health_signal()
returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
declare p record;begin
 if new.proposal_id is null or new.rights_class not in ('unknown_review_required','do_not_reproduce') then return new; end if;
 select publication_id,chapter_id into p from public.curriculum_intelligence_proposals where id=new.proposal_id;
 if p.chapter_id is null then return new; end if;
 insert into public.curriculum_content_health_signals(publication_id,chapter_id,signal_type,severity,score,evidence_count,evidence,status,last_detected_at,updated_at)
 values(p.publication_id,p.chapter_id,'rights_review',case when new.rights_class='do_not_reproduce' then 'high' else 'medium' end,case when new.rights_class='do_not_reproduce' then 1 else .6 end,1,jsonb_build_object('rights_id',new.id,'source_url',new.source_url,'rights_class',new.rights_class),'open',now(),now())
 on conflict(publication_id,chapter_id,signal_type) where outcome_id is null and chapter_id is not null and status in ('open','watching','proposal_created') do update set severity=excluded.severity,score=greatest(public.curriculum_content_health_signals.score,excluded.score),evidence=excluded.evidence,last_detected_at=now(),updated_at=now();
 return new;end $$;
drop trigger if exists trg_curriculum_rights_health on public.curriculum_content_rights;
create trigger trg_curriculum_rights_health after insert or update of rights_class on public.curriculum_content_rights for each row execute function public.curriculum_rights_to_health_signal();
revoke all on function public.curriculum_rights_to_health_signal() from public,anon,authenticated;

create or replace function public.hq_requeue_editorial_action(p_action_id uuid)
returns public.curriculum_editorial_actions
language plpgsql security definer set search_path='public','pg_temp' as $$
declare a public.curriculum_editorial_actions%rowtype;
begin
 if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 update public.curriculum_editorial_actions set status='queued',attempt_count=0,last_error=null,locked_at=null,locked_by=null,next_attempt_at=null,completed_at=null,updated_at=now()
 where id=p_action_id and status in ('failed','dead_letter') returning * into a;
 if not found then raise exception 'Action is not failed/dead-letter or not found'; end if;
 return a;
end $$;
revoke all on function public.hq_requeue_editorial_action(uuid) from public,anon;
grant execute on function public.hq_requeue_editorial_action(uuid) to authenticated;

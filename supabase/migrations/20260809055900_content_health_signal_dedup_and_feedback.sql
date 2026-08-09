create unique index if not exists uq_content_health_active_outcome_signal
on public.curriculum_content_health_signals(publication_id, chapter_id, outcome_id, signal_type)
where outcome_id is not null and status in ('open','watching','proposal_created');

create or replace function public.hq_refresh_content_health_signals(p_publication_id uuid default null)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_updated int:=0; v_inserted int:=0;
begin
 if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 with agg as (
   select cb.publication_id,cb.chapter_id,som.outcome_id,
          case when avg(som.mastery_score)<0.35 then 'high' else 'medium' end::text severity,
          greatest(0,least(1,1-avg(som.mastery_score)))::numeric score,
          count(*)::int evidence_count,
          jsonb_build_object('average_mastery',round(avg(som.mastery_score)::numeric,3),'learners',count(distinct som.student_id),'source','student_outcome_mastery') evidence
   from public.student_outcome_mastery som
   join public.content_block_outcome_links l on l.outcome_id=som.outcome_id
   join public.content_blocks cb on cb.id=l.content_block_id
   where som.evidence_count>0 and (p_publication_id is null or cb.publication_id=p_publication_id)
   group by cb.publication_id,cb.chapter_id,som.outcome_id
   having count(distinct som.student_id)>=5 and avg(som.mastery_score)<0.55
 ), upd as (
   update public.curriculum_content_health_signals s set severity=a.severity,score=a.score,evidence_count=a.evidence_count,evidence=a.evidence,last_detected_at=now(),updated_at=now()
   from agg a where s.publication_id=a.publication_id and s.chapter_id=a.chapter_id and s.outcome_id=a.outcome_id and s.signal_type='low_mastery' and s.status in ('open','watching','proposal_created') returning s.id
 ), ins as (
   insert into public.curriculum_content_health_signals(publication_id,chapter_id,outcome_id,signal_type,severity,score,evidence_count,evidence,status,last_detected_at,updated_at)
   select a.publication_id,a.chapter_id,a.outcome_id,'low_mastery',a.severity,a.score,a.evidence_count,a.evidence,'open',now(),now()
   from agg a where not exists(select 1 from public.curriculum_content_health_signals s where s.publication_id=a.publication_id and s.chapter_id=a.chapter_id and s.outcome_id=a.outcome_id and s.signal_type='low_mastery' and s.status in ('open','watching','proposal_created')) returning id
 ) select (select count(*) from upd),(select count(*) from ins) into v_updated,v_inserted;
 return jsonb_build_object('low_mastery_signals_updated',v_updated,'low_mastery_signals_created',v_inserted,'refreshed_at',now());
end; $$;
revoke all on function public.hq_refresh_content_health_signals(uuid) from public,anon;
grant execute on function public.hq_refresh_content_health_signals(uuid) to authenticated;
create table if not exists public.curriculum_content_health_signals (
 id uuid primary key default gen_random_uuid(),
 publication_id uuid references public.vibe_publications(id) on delete cascade,
 chapter_id uuid references public.vibe_chapters(id) on delete cascade,
 content_block_id uuid references public.content_blocks(id) on delete cascade,
 outcome_id uuid references public.curriculum_learning_outcomes(id) on delete set null,
 signal_type text not null check (signal_type in ('learner_confusion','low_mastery','teacher_workaround','low_usage','assessment_failure','stale_fact','research_change','curriculum_change','rights_review','editorial_quality')),
 severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
 score numeric not null default 0 check (score>=0 and score<=1),
 evidence_count integer not null default 0,
 evidence jsonb not null default '{}'::jsonb,
 status text not null default 'open' check (status in ('open','watching','proposal_created','dismissed','resolved')),
 first_detected_at timestamptz not null default now(),
 last_detected_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists idx_curriculum_content_health_open on public.curriculum_content_health_signals(status,severity,last_detected_at desc);
create index if not exists idx_curriculum_content_health_chapter on public.curriculum_content_health_signals(chapter_id,signal_type);
alter table public.curriculum_content_health_signals enable row level security;
drop policy if exists "hq owners manage curriculum content health" on public.curriculum_content_health_signals;
create policy "hq owners manage curriculum content health" on public.curriculum_content_health_signals for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
revoke all on table public.curriculum_content_health_signals from anon;
grant select,insert,update,delete on table public.curriculum_content_health_signals to authenticated;

create table if not exists public.curriculum_content_rights (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid references public.curriculum_intelligence_proposals(id) on delete cascade,
 source_url text not null,
 source_domain text,
 rights_class text not null check (rights_class in ('official_public_source','public_domain','open_license','attribution_required','factual_reference_only','unknown_review_required','do_not_reproduce')),
 license_name text,
 attribution_text text,
 can_quote boolean not null default false,
 can_adapt boolean not null default false,
 can_reproduce_media boolean not null default false,
 notes text,
 reviewed_by uuid,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(proposal_id,source_url)
);
alter table public.curriculum_content_rights enable row level security;
drop policy if exists "hq owners manage curriculum content rights" on public.curriculum_content_rights;
create policy "hq owners manage curriculum content rights" on public.curriculum_content_rights for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
revoke all on table public.curriculum_content_rights from anon;
grant select,insert,update,delete on table public.curriculum_content_rights to authenticated;

create table if not exists public.curriculum_editorial_actions (
 id uuid primary key default gen_random_uuid(),
 health_signal_id uuid references public.curriculum_content_health_signals(id) on delete cascade,
 publication_id uuid references public.vibe_publications(id) on delete cascade,
 chapter_id uuid references public.vibe_chapters(id) on delete cascade,
 action_type text not null check (action_type in ('investigate','rewrite_explanation','add_example','add_activity','add_vibelab','expand_assessment','refresh_teacher_guide','fact_check','rights_review','no_change')),
 rationale text not null,
 status text not null default 'queued' check (status in ('queued','in_progress','proposal_created','approved','rejected','completed')),
 priority integer not null default 50 check (priority between 0 and 100),
 created_by text not null default 'content_health_engine',
 proposal_id uuid references public.curriculum_intelligence_proposals(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.curriculum_editorial_actions enable row level security;
drop policy if exists "hq owners manage curriculum editorial actions" on public.curriculum_editorial_actions;
create policy "hq owners manage curriculum editorial actions" on public.curriculum_editorial_actions for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
revoke all on table public.curriculum_editorial_actions from anon;
grant select,insert,update,delete on table public.curriculum_editorial_actions to authenticated;

create or replace function public.hq_refresh_content_health_signals(p_publication_id uuid default null)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_low_mastery int:=0;
begin
 if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 insert into public.curriculum_content_health_signals(publication_id,chapter_id,outcome_id,signal_type,severity,score,evidence_count,evidence,status,last_detected_at,updated_at)
 select cb.publication_id,cb.chapter_id,som.outcome_id,'low_mastery',case when avg(som.mastery_score)<0.35 then 'high' else 'medium' end,greatest(0,least(1,1-avg(som.mastery_score)))::numeric,count(*)::int,jsonb_build_object('average_mastery',round(avg(som.mastery_score)::numeric,3),'learners',count(distinct som.student_id),'source','student_outcome_mastery'),'open',now(),now()
 from public.student_outcome_mastery som join public.content_block_outcome_links l on l.outcome_id=som.outcome_id join public.content_blocks cb on cb.id=l.content_block_id
 where som.evidence_count>0 and (p_publication_id is null or cb.publication_id=p_publication_id)
 group by cb.publication_id,cb.chapter_id,som.outcome_id having count(distinct som.student_id)>=5 and avg(som.mastery_score)<0.55;
 get diagnostics v_low_mastery=row_count;
 return jsonb_build_object('low_mastery_signals_created',v_low_mastery,'refreshed_at',now());
end; $$;
revoke all on function public.hq_refresh_content_health_signals(uuid) from public,anon;
grant execute on function public.hq_refresh_content_health_signals(uuid) to authenticated;

create or replace function public.hq_promote_health_signal_to_action(p_signal_id uuid)
returns public.curriculum_editorial_actions language plpgsql security definer set search_path='public','pg_temp' as $$
declare s public.curriculum_content_health_signals%rowtype; a public.curriculum_editorial_actions%rowtype; action text; prio int;
begin
 if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 select * into s from public.curriculum_content_health_signals where id=p_signal_id for update;
 if not found then raise exception 'Health signal not found'; end if;
 action := case s.signal_type when 'low_mastery' then 'rewrite_explanation' when 'learner_confusion' then 'add_example' when 'assessment_failure' then 'expand_assessment' when 'teacher_workaround' then 'refresh_teacher_guide' when 'stale_fact' then 'fact_check' when 'research_change' then 'fact_check' when 'curriculum_change' then 'investigate' when 'rights_review' then 'rights_review' when 'editorial_quality' then 'rewrite_explanation' else 'investigate' end;
 prio := case s.severity when 'critical' then 100 when 'high' then 85 when 'medium' then 60 else 35 end;
 insert into public.curriculum_editorial_actions(health_signal_id,publication_id,chapter_id,action_type,rationale,priority)
 values(s.id,s.publication_id,s.chapter_id,action,format('Content health signal %s (%s, score %s, evidence %s) requires editorial review.',s.signal_type,s.severity,s.score,s.evidence_count),prio) returning * into a;
 update public.curriculum_content_health_signals set status='proposal_created',updated_at=now() where id=s.id;
 return a;
end; $$;
revoke all on function public.hq_promote_health_signal_to_action(uuid) from public,anon;
grant execute on function public.hq_promote_health_signal_to_action(uuid) to authenticated;
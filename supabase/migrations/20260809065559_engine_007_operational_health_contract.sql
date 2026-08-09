drop view if exists public.content_engine_operational_health;
create view public.content_engine_operational_health with(security_invoker=true) as select
 (select count(*) from curriculum_intelligence_watch_targets where enabled) enabled_watch_targets,
 (select count(*) from curriculum_intelligence_runs where status='completed') completed_runs,
 (select count(*) from curriculum_content_health_signals where status='open') open_health_signals,
 (select count(*) from curriculum_intelligence_proposals where status='pending_review') open_proposals,
 (select count(*) from curriculum_editorial_actions where status in ('queued','pending','running')) pending_actions,
 (select count(*) from curriculum_editorial_effectiveness where evaluated_at is null) pending_effectiveness_reviews,
 (select count(*) from content_learning_events) learning_events,
 (select count(*) from vibe_reading_sessions) reading_sessions,
 (select max(completed_at) from curriculum_intelligence_runs where status='completed') last_completed_run;
revoke all on public.content_engine_operational_health from anon,authenticated;
grant select on public.content_engine_operational_health to service_role;
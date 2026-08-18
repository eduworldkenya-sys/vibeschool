-- Content Factory throughput closure contract.
-- Run after the migration in disposable/local Supabase.
\set ON_ERROR_STOP on
begin;
do $$
declare v_def text; v_count int;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='hq_apply_approved_chapter_revision' limit 1;
  if v_def is null then raise exception 'hq_apply_approved_chapter_revision missing'; end if;
  if v_def ilike '%content_blocks.metadata%' or v_def ilike '%status,metadata)%' then raise exception 'revision apply still references invalid content_blocks.metadata'; end if;
  if v_def not ilike '%blocks=coalesce(blocks%' or v_def not ilike '%ce_sync_block_learning_resources%' then raise exception 'revision apply is not canonical chapter-block based'; end if;

  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ce_prepare_release_repair_drafts' limit 1;
  if v_def ilike '%worked biological reasoning%' then raise exception 'cross-subject biology wording remains'; end if;
  if v_def not ilike '%ce_repair_release_structure%' or v_def not ilike '%ce_prepare_source_grounded_teacher_guides%' then raise exception 'repair preparation is incomplete'; end if;

  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='run_governed_publication_intelligence' limit 1;
  if v_def not ilike '%ce_prepare_release_repair_drafts%' or v_def not ilike '%hq_sync_content_engine_work%' then raise exception 'governed orchestration is not connected to repair/HQ sync'; end if;

  select count(*) into v_count from information_schema.columns where table_schema='public' and table_name='content_blocks' and column_name='metadata';
  if v_count<>0 then raise exception 'unexpected content_blocks.metadata schema drift'; end if;

  if exists(select 1 from information_schema.routine_privileges rp where rp.specific_schema='public' and rp.routine_name in ('ce_plan_release_remediation','ce_repair_release_structure','ce_prepare_source_grounded_teacher_guides','ce_prepare_release_repair_drafts','run_governed_publication_intelligence') and rp.grantee in ('anon','authenticated') and rp.privilege_type='EXECUTE') then raise exception 'internal Content Factory RPC exposed'; end if;
end $$;
rollback;

-- EXQ-008D — Report validation and academic audit authority.
-- Production-equivalent repository migration.

alter table public.report_cards
  add column if not exists validation_status text not null default 'not_validated',
  add column if not exists validation_issues jsonb not null default '[]'::jsonb,
  add column if not exists validated_at timestamptz null,
  add column if not exists validated_by uuid null references auth.users(id) on delete set null;

alter table public.report_cards
  drop constraint if exists report_cards_validation_status_chk,
  add constraint report_cards_validation_status_chk
    check (validation_status in ('not_validated','warnings','blocked','passed','frozen'));

create table if not exists public.report_card_audit_log (
  id uuid primary key default gen_random_uuid(),
  report_card_id uuid not null references public.report_cards(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  from_status text null,
  to_status text null,
  evidence_version integer null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint report_card_audit_log_action_chk check (action in ('created','evidence_generated','narrative_generated','validated','submitted','returned','approved','published','locked'))
);

create index if not exists report_card_audit_log_report_idx on public.report_card_audit_log(report_card_id,created_at desc);
create index if not exists report_card_audit_log_school_idx on public.report_card_audit_log(school_id,created_at desc);
alter table public.report_card_audit_log enable row level security;

drop policy if exists report_card_audit_log_read on public.report_card_audit_log;
create policy report_card_audit_log_read on public.report_card_audit_log for select to authenticated
using (exists(select 1 from public.report_cards rc where rc.id=report_card_audit_log.report_card_id and (rc.teacher_id=(select auth.uid()) or exists(select 1 from public.school_members sm where sm.school_id=rc.school_id and sm.profile_id=(select auth.uid()) and sm.role in ('owner','admin')))));

-- Canonical function bodies are maintained in production and must remain SECURITY DEFINER with fixed search_path.
revoke all on function public.exq_validate_report_card(uuid) from public,anon;
revoke all on function public.exq_submit_report_card(uuid,text) from public,anon;
revoke all on function public.exq_review_report_card(uuid,text,text) from public,anon;
grant execute on function public.exq_validate_report_card(uuid) to authenticated,service_role;
grant execute on function public.exq_submit_report_card(uuid,text) to authenticated,service_role;
grant execute on function public.exq_review_report_card(uuid,text,text) to authenticated,service_role;

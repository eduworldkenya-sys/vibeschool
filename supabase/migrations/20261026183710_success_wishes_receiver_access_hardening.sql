-- CLI-created receiver hardening migration, sequenced after the applied 143000 dependency.
-- access: service-only public.success_wish_consent_events
-- authorization-test: public.success_wish_consent_events
alter table public.success_wish_receiver_challenges drop constraint success_wish_receiver_challenges_purpose_check;
alter table public.success_wish_receiver_challenges add constraint success_wish_receiver_challenges_purpose_check
 check(purpose in ('recovery','consent_adult','consent_guardian','withdraw_adult','withdraw_guardian'));
alter table public.success_wish_sms_deliveries drop constraint success_wish_sms_deliveries_purpose_check;
alter table public.success_wish_sms_deliveries add constraint success_wish_sms_deliveries_purpose_check
 check(purpose in ('card','request','recovery','consent_adult','consent_guardian','withdraw_adult','withdraw_guardian'));
create table public.success_wish_consent_events (
 id uuid primary key default gen_random_uuid(),
 receiver_id uuid not null references public.success_wish_receivers(id) on delete restrict,
 challenge_id uuid not null unique,
 action text not null check(action in ('grant','withdraw')),
 consent_role text not null check(consent_role in ('adult','guardian')),
 notice_version text not null,
 authority_method text not null default 'registered_contact_otp',
 created_at timestamptz not null default now()
);
alter table public.success_wish_consent_events enable row level security;
revoke all on public.success_wish_consent_events from public,anon,authenticated,service_role;
grant select,insert on public.success_wish_consent_events to service_role;
create or replace function public.success_wish_consume_receiver_challenge(
 p_challenge uuid,p_receiver uuid,p_digest text,p_purpose text
) returns boolean language plpgsql security invoker set search_path=public as $$
declare was_valid boolean;
begin
 if p_purpose not in ('recovery','consent_adult','consent_guardian','withdraw_adult','withdraw_guardian') then return false; end if;
 update public.success_wish_receiver_challenges set attempts=attempts+1,
 consumed_at=case when code_hash=p_digest then now() else null end
 where id=p_challenge and receiver_id=p_receiver and purpose=p_purpose
 and consumed_at is null and expires_at>now() and attempts<5
 returning consumed_at is not null into was_valid;
 return coalesce(was_valid,false);
end $$;
create function public.success_wish_record_receiver_consent(
 p_receiver uuid,p_challenge uuid,p_digest text,p_action text,p_role text,p_notice text
) returns boolean language plpgsql security invoker set search_path='' as $$
declare person record; purpose text;
begin
 if p_action not in ('grant','withdraw') or p_role not in ('adult','guardian')
 or p_notice is distinct from 'receiver-2026-10-26-v1' then return false; end if;
 select * into person from public.success_wish_receivers where id=p_receiver for update;
 if person.id is null or person.consent_route is distinct from p_role
 or (p_action='grant' and person.consent_status<>'pending')
 or (p_action='withdraw' and person.consent_status<>'verified') then return false; end if;
 purpose:=(case when p_action='grant' then 'consent_' else 'withdraw_' end)||p_role;
 if not public.success_wish_consume_receiver_challenge(p_challenge,p_receiver,p_digest,purpose) then return false; end if;
 insert into public.success_wish_consent_events(receiver_id,challenge_id,action,consent_role,notice_version)
 values(p_receiver,p_challenge,p_action,p_role,p_notice);
 update public.success_wish_receivers set consent_status=case when p_action='grant' then 'verified' else 'revoked' end,
 consent_verified_at=case when p_action='grant' then now() else consent_verified_at end where id=p_receiver;
 if p_action='withdraw' then
  delete from public.success_wish_receiver_sessions where receiver_id=p_receiver;
  delete from public.success_wish_card_sessions where card_id in(select id from public.success_wish_cards where receiver_id=p_receiver);
 end if;
 return true;
end $$;
revoke all on function public.success_wish_record_receiver_consent(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.success_wish_record_receiver_consent(uuid,uuid,text,text,text,text) to service_role;
revoke all on function public.success_wish_consume_receiver_challenge(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.success_wish_consume_receiver_challenge(uuid,uuid,text,text) to service_role;

-- access: service-only public.success_wish_privacy_actions
-- authorization-test: public.success_wish_privacy_actions
create table public.success_wish_privacy_actions (
 id uuid primary key default gen_random_uuid(),
 receiver_id uuid not null references public.success_wish_receivers(id) on delete restrict,
 school_id uuid not null references public.schools(id),
 staff_id uuid not null references auth.users(id),
 target_id uuid not null,
 target_kind text not null check(target_kind in ('report','request')),
 status text not null,
 evidence_reference text not null check(char_length(btrim(evidence_reference)) between 10 and 160),
 created_at timestamptz not null default now()
);
alter table public.success_wish_privacy_actions enable row level security;
revoke all on public.success_wish_privacy_actions from public,anon,authenticated,service_role;
grant select,insert on public.success_wish_privacy_actions to service_role;
create function public.success_wish_review_privacy_case(
 p_school uuid,p_staff uuid,p_target uuid,p_kind text,p_status text,p_reference text
) returns boolean language plpgsql security invoker set search_path='' as $$
declare rid uuid; old_status text;
begin
 if p_reference is null or char_length(btrim(p_reference)) not between 10 and 160 or not exists(
 select 1 from public.school_members m join public.profiles pr on pr.id=m.profile_id
 where m.school_id=p_school and m.profile_id=p_staff and m.role='admin'
 and pr.account_status='active' and pr.is_anonymized=false) then return false; end if;
 if p_kind='report' and p_status in ('under_review','resolved') then
 select receiver_id,status into rid,old_status from public.success_wish_receiver_reports where id=p_target for update;
 elsif p_kind='request' and p_status in ('reviewing','completed','rejected') then
 select receiver_id,status into rid,old_status from public.success_wish_data_requests where id=p_target for update;
 else return false; end if;
 if rid is null or not exists(select 1 from public.success_wish_receiver_provisioning_audit where receiver_id=rid and school_id=p_school)
 or (p_kind='report' and (old_status='resolved' or (p_status='resolved' and old_status<>'under_review')))
 or (p_kind='request' and (old_status in ('completed','rejected') or (p_status in ('completed','rejected') and old_status<>'reviewing')))
 then return false; end if;
 if p_kind='report' then update public.success_wish_receiver_reports set status=p_status where id=p_target;
 else update public.success_wish_data_requests set status=p_status,
 resolved_at=case when p_status in ('completed','rejected') then now() else null end where id=p_target; end if;
 insert into public.success_wish_privacy_actions(receiver_id,school_id,staff_id,target_id,target_kind,status,evidence_reference)
 values(rid,p_school,p_staff,p_target,p_kind,p_status,btrim(p_reference));
 return true;
end $$;
revoke all on function public.success_wish_review_privacy_case(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.success_wish_review_privacy_case(uuid,uuid,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';

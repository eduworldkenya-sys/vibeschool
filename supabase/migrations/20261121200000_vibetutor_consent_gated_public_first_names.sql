-- Optional public FIRST NAME disclosure for VibeTutor learner requests.
-- An anonymous request listing is not permission to publish a child's name.
-- Explicit independently verified parent/guardian name-publication consent is
-- needed per request. No cohort backfill or automated opt-in is performed.
begin;
create table if not exists public.vibetutor_request_public_first_name_consents (
  request_id uuid primary key references public.vibetutor_requests(id) on delete cascade,
  guardian_consent_evidence_ref text not null check (
    char_length(btrim(guardian_consent_evidence_ref)) between 20 and 250
  ),
  verified_by uuid not null references public.profiles(id),
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint vibetutor_public_first_name_consent_revoke_check
    check (revoked_at is null or revoked_at >= verified_at)
);
alter table public.vibetutor_request_public_first_name_consents enable row level security;
revoke all on public.vibetutor_request_public_first_name_consents from public, anon, authenticated;
grant select, insert, update, delete on public.vibetutor_request_public_first_name_consents to service_role;
-- No policies to anon/authenticated, and no public mutation RPC.
-- The existing security-definer public projection conditionally uses
-- these private, independently verified records.

create or replace view public.vibetutor_open_requests with (security_invoker=false, security_barrier=true) as
select r.id, case when consent.request_id is not null and consent.revoked_at is null
 and btrim(r.learner_label) ~ '^[[:alpha:]][[:alpha:] ''-]{1,59}$'
 then split_part(btrim(r.learner_label),' ',1)
 else coalesce(nullif(r.levels[1],''),'Learner') || ' tuition request'
 end::text as learner_label, null::text as note,
 r.levels, r.subjects, r.teaching_mode, r.area, r.budget_kes, r.available_days, r.dayparts,
 date_trunc('day', r.created_at) as created_at
from public.vibetutor_requests r join public.profiles p on p.id=r.requester_id
left join public.vibetutor_request_public_first_name_consents consent
  on consent.request_id = r.id and consent.revoked_at is null
where r.status='open' and r.public_preview and r.source in ('vibetutor','hq_import_20261120_f','hq_import_20261120_m') and p.role::text in ('parent','teacher')
 and r.area = any(array['Nairobi','Mombasa','Nakuru','Eldoret','Kisumu','Thika','Ruiru','Kitengela','Ongata Rongai','Kiambu','Machakos','Meru','Nyeri','Kakamega','Kisii','Naivasha','Bungoma','Kericho','Embu','Online (anywhere)']::text[])
 and r.levels <@ array['Grade 1–3','Grade 4–6','Grade 7–9','Grade 10–12','Form 1–4','University','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Form 3']::text[] and cardinality(r.levels)>0 and cardinality(r.levels)<=1
 and r.subjects <@ array['English','Kiswahili','Mathematical Activities','Environmental Activities','Creative Activities','Christian Religious Education','Islamic Religious Education','Hindu Religious Education','Indigenous Languages','Mathematics','Science & Technology','Social Studies','Agriculture','Creative Arts','Religious Education','Integrated Science','Pre-Technical Studies','Biology','Chemistry','Physics','Geography','History','Business Studies','Computer Studies','Statistics','Computer Science','Economics','Accounting','Engineering']::text[] and cardinality(r.subjects)>0 and cardinality(r.subjects)<=6
 and r.available_days <@ array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[]
 and r.dayparts <@ array['morning','afternoon','evening','night']::text[]
 and (r.budget_kes is null or r.budget_kes between 1 and 100000);

;
revoke all on public.vibetutor_open_requests from public, anon, authenticated;
grant select on public.vibetutor_open_requests to anon, authenticated;
commit;

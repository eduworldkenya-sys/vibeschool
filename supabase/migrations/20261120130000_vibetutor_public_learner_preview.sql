-- Public discovery uses only explicitly opted-in parent requests; no private child data.
begin;
alter table public.vibetutor_requests add column if not exists public_preview boolean not null default false;
create or replace view public.vibetutor_open_requests with (security_invoker=false, security_barrier=true) as
select r.id, ('Learner-' || left(r.id::text, 6))::text as learner_label, null::text as note,
 r.levels, r.subjects, r.teaching_mode, r.area, r.budget_kes, r.available_days, r.dayparts,
 date_trunc('day', r.created_at) as created_at
from public.vibetutor_requests r join public.profiles p on p.id=r.requester_id
where r.status='open' and r.public_preview and p.role::text='parent'
 and r.area = any(array['Nairobi','Mombasa','Nakuru','Eldoret','Kisumu','Thika','Ruiru','Kitengela','Ongata Rongai','Kiambu','Machakos','Meru','Nyeri','Kakamega','Kisii','Naivasha','Bungoma','Kericho','Embu','Online (anywhere)']::text[])
 and r.levels <@ array['Grade 1–3','Grade 4–6','Grade 7–9','Grade 10–12','Form 1–4','University']::text[] and cardinality(r.levels)>0 and cardinality(r.levels)<=1
 and r.subjects <@ array['English','Kiswahili','Mathematical Activities','Environmental Activities','Creative Activities','Christian Religious Education','Islamic Religious Education','Hindu Religious Education','Indigenous Languages','Mathematics','Science & Technology','Social Studies','Agriculture','Creative Arts','Religious Education','Integrated Science','Pre-Technical Studies','Biology','Chemistry','Physics','Geography','History','Business Studies','Computer Studies','Statistics','Computer Science','Economics','Accounting','Engineering']::text[] and cardinality(r.subjects)>0 and cardinality(r.subjects)<=6
 and r.available_days <@ array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[]
 and r.dayparts <@ array['morning','afternoon','evening','night']::text[]
 and (r.budget_kes is null or r.budget_kes between 1 and 100000);
revoke all on public.vibetutor_open_requests from public, anon, authenticated;
grant select on public.vibetutor_open_requests to anon, authenticated;
-- Existing owner-only base-table RLS remains unchanged.
commit;

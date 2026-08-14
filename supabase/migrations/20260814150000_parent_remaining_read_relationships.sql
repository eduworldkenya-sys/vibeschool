begin;

drop policy if exists "parent owns skill evidence" on public.child_skill_evidence;
drop policy if exists finance_invoices_parent on public.finance_invoices;
drop policy if exists finance_payments_parent on public.finance_payments;
drop policy if exists student_profiles_parent_read on public.student_profiles;
drop policy if exists "parent reads audit log" on public.child_audit_log;

create policy parent_skill_evidence_current_link on public.child_skill_evidence for all to authenticated
using (exists (select 1 from public.child_skills cs join public.parent_student_links psl on psl.student_id=cs.student_id where cs.id=child_skill_evidence.skill_id and cs.parent_id=auth.uid() and psl.parent_id=auth.uid() and coalesce(psl.access_level,'full') <> 'none'))
with check (exists (select 1 from public.child_skills cs join public.parent_student_links psl on psl.student_id=cs.student_id where cs.id=child_skill_evidence.skill_id and cs.parent_id=auth.uid() and psl.parent_id=auth.uid() and coalesce(psl.access_level,'full') = 'full'));

create policy finance_invoices_parent_current_link on public.finance_invoices for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.student_id=finance_invoices.student_id and psl.parent_id=auth.uid() and coalesce(psl.access_level,'full') <> 'none'));

create policy finance_payments_parent_current_link on public.finance_payments for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.student_id=finance_payments.student_id and psl.parent_id=auth.uid() and coalesce(psl.access_level,'full') <> 'none'));

create policy student_profiles_parent_current_link on public.student_profiles for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.student_id=student_profiles.profile_id and psl.parent_id=auth.uid() and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_audit_log_current_link on public.child_audit_log for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.student_id=child_audit_log.student_id and psl.parent_id=auth.uid() and coalesce(psl.access_level,'full') <> 'none'));

commit;

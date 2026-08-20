-- Remove scoped HQ human roles from the legacy broad-owner bridge.
-- Founder/Partner Admin/HQ Admin retain broad operator compatibility; scoped roles do not.
delete from public.platform_owners p
using public.hq_human_members h
where p.profile_id = h.profile_id
  and p.note = 'hq_partner_admin'
  and h.role not in ('founder','partner_admin','hq_admin');

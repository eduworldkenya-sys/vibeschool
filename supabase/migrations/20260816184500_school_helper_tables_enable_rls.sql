-- School Engine helper-table RLS closure.
--
-- These relations are internal helper tables. Client roles already have all
-- direct privileges revoked and bounded SECURITY DEFINER RPCs expose the safe
-- projection. Enable RLS as an additional fail-closed boundary so future grant
-- drift cannot accidentally expose helper rows.

alter table public.school_levels enable row level security;
alter table public.school_aliases enable row level security;
alter table public.school_directory_sources enable row level security;

comment on table public.school_levels is
'Internal School Engine helper relation. Direct client access is forbidden; use bounded school-directory RPCs.';

comment on table public.school_aliases is
'Internal School Engine verified-alias relation. Direct client access is forbidden; use bounded verified-alias/search RPCs.';

comment on table public.school_directory_sources is
'Internal School Engine source metadata relation. Direct client access is forbidden; source governance is server/service-role controlled.';

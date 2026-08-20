-- Task 9 Founder OS exact-head SQL contract.
begin;

select public.hq_founder_os_snapshot(10) is not null as founder_snapshot_available;
select public.hq_workforce_runtime_readiness() is not null as runtime_readiness_available;

-- Founder OS must remain observation-only and must not itself activate Worker runtime.
select not runtime_execution_enabled as runtime_off,
       runtime_autonomy_level = 0 as autonomy_l0,
       runtime_max_risk = 0 as risk_r0
from public.hq_workforce_engine_contract
where singleton = true;

rollback;

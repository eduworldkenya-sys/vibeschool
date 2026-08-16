-- Worker Engine engine-contract control-plane hardening.
-- Forward-only: do not rewrite historical migrations.
--
-- The engine contract controls runtime activation, anomaly pause, autonomy/risk
-- ceilings, heartbeat, Factory and Shadow state. Possession of service_role must
-- not be sufficient to alter these safety controls.

revoke all on table public.hq_workforce_engine_contract from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.hq_workforce_engine_contract from service_role;
grant select on table public.hq_workforce_engine_contract to service_role;

comment on table public.hq_workforce_engine_contract is
  'Worker Engine safety control-plane state. Direct service-role DML is revoked; runtime/heartbeat/Factory/Shadow activation and safety-stop changes require a separately governed operator path.';

-- Cover the Operations R2 canary evidence foreign key reported by the production advisor.
-- No runtime policy, capability grant, allowlist change, or activation is introduced.
create index if not exists hq_workforce_operations_r2_canary_runs_shadow_run_idx
  on public.hq_workforce_operations_r2_canary_runs(shadow_run_id);

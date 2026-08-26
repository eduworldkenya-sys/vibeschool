# Chemistry local lease admission incident — 2026-08-26

Production AUTHOR execution for Introduction to Chemistry failed after claim with `CYBORG_ADMISSION_FAILED:permission denied for table chemistry_worker_stage_attempts`.

Root cause: the shared Cyborg service helper may intentionally target a configured remote control-plane Supabase URL. Chemistry stage leases, however, are local execution authority owned by the application project. Cyborg admission was asserting the local Chemistry lease through the generic control-plane RPC helper, allowing an optional cross-project control-plane override to resolve the lease against the wrong database/role boundary.

Repair: `cyborg-admission` now asserts Chemistry stage leases through a dedicated `localRpc` backed only by the function runtime's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Generic Cyborg mission/capability state continues to use the configured control-plane RPC boundary. Validation fails if Chemistry lease assertion is routed through the generic control-plane helper again.

Safety: runtime remains OFF, shadow remains OFF, scheduler remains OFF, Global Stop remains ON, and no publication authority is changed.

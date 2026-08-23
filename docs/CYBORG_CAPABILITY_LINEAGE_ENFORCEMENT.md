# Cyborg Capability + Lineage Enforcement

Target invariant: **no Cyborg admission = no VibeSchool model call**.

Implemented in this candidate:
- short-lived HMAC capability bound to mission/provider/model/operation;
- fail-closed missing/expired/forged/mismatched capability validation;
- approved application entrypoint mints capability internally immediately before provider invocation;
- persistent model-invocation lineage table with unique capability JTI replay barrier;
- service-role-only claim/complete RPCs and RLS;
- server AI routes moved to capability-enforced entrypoint;
- CI contract proving capability, lineage and route invariants.

Still required before final certification:
- reconcile the Supabase `twin-chat` Edge provider path into the same signed capability + persistent lineage contract;
- provision `CYBORG_CAPABILITY_SECRET` (>=32 chars) only in governed server/Edge execution environments;
- verify provider credentials are absent from non-gateway execution surfaces;
- run exact-head CI and adversarial runtime proof (missing, forged, expired, provider/model/mission mismatch, replay, valid call).

This change is non-activating. It does not enable Worker Engine runtime, publishing, payments, schedulers, or consequential authority.

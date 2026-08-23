# Cyborg capability threat model

Blocked by design: missing capability, forged signature, expiry, mission mismatch, provider mismatch, model mismatch, and persistent JTI replay. Provider failure is recorded after a successful claim. Lineage admission occurs before the provider adapter executes.

Residual certification blocker: `supabase/functions/twin-chat` still owns its Groq provider call and must be reconciled to equivalent signed-capability + lineage claim semantics before the universal claim can be certified. Production also requires secret provisioning and post-deploy verification.

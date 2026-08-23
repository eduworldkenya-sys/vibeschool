# Cyborg capability rollout

1. Merge only after exact-head CI passes.
2. Apply lineage migration before enabling capability-enforced provider traffic.
3. Provision a strong `CYBORG_CAPABILITY_SECRET` to approved gateway runtimes only.
4. Reconcile Twin Edge/Groq to the same capability and lineage contract.
5. Verify direct provider credentials are absent from non-gateway surfaces.
6. Run adversarial runtime probes: missing, forged, expired, mission/provider/model mismatch, replay, provider failure, valid success.
7. Query lineage and prove 100% of sampled model responses have mission + capability JTI + terminal invocation status.
8. Certify only after all steps pass.

Rollback must fail closed: disable model invocation rather than restoring an ungoverned direct provider path.

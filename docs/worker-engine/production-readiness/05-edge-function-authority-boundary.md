# Worker Engine Production Readiness — Edge Function Authority Boundary

Status: P0 authority-plane evidence
Scope: live production Supabase Edge Functions inspected read-only on 2026-08-16
Production changes: none

## Invariant

Possession of `service_role` inside an Edge Function is infrastructure privilege, not Worker Engine authority. No Edge Function may become a consequential Worker Engine executor merely because it can bypass RLS. A future Worker Engine invocation that causes consequential business mutation must enter through the canonical R1.4 authority/execution gateway and carry the canonical execution lineage.

## Production observations

### Not Worker Engine execution gateways

The currently deployed product functions `swift-processor`, `generate-lesson-plan`, `twin-chat`, `learning-transform`, `content-assessment-generate`, `content-material-generate`, `mpesa-stk-push`, and `mpesa-callback` operate product-specific flows. They do not currently call `hq_workforce_tool_gateway_execute`, `hq_workforce_execute_task_queue`, `hq_workforce_autonomous_heartbeat`, or the R1.4 consequential gateway.

Disposition: **KEEP OUTSIDE WORKER ENGINE**, with a permanent rule that Worker Engine automation must not invoke their privileged mutation paths directly unless those operations are explicitly registered as governed resources/capabilities.

### Owner-gated content intelligence functions with service-role clients

`curriculum-intelligence-research`, `curriculum-intelligence-editorial`, `curriculum-intelligence-regenerate`, and `curriculum-intelligence-health-action` authenticate a user, require platform-owner status, then instantiate a service-role client for content-engine work.

These functions are not presently Worker Engine runtime gateways, but they are important future authority boundaries because they can mutate content-intelligence state while bypassing RLS after the owner check.

Disposition: **BRIDGE / GOVERN AS EXTERNAL PRIVILEGED RESOURCES** before any Worker Engine capability may invoke them. Worker Engine authority must never be inferred from the Edge Function's possession of `service_role`.

Required bridge contract:

1. registered resource identity and operation allowlist;
2. canonical capability + authority grant bound to exact scope;
3. canonical execution/trace ID propagated into the operation;
4. precondition and idempotency evidence before mutation;
5. postcondition verification after mutation;
6. cost/resource evidence where an external model/search provider is used;
7. no direct Worker Engine scheduler call into the Edge Function;
8. owner UI invocation and Worker Engine invocation remain distinguishable in evidence.

### `smooth-function`

The deployed sample function explicitly supports a `secret` auth mode that bypasses RLS but currently only returns a greeting and performs no business mutation.

Disposition: **QUARANTINE / REMOVE FROM WORKER ENGINE TRUST MODEL**. It must never be considered a governed Worker Engine resource merely because it demonstrates secret-mode access. If unused, retire separately under product/infrastructure cleanup; do not couple that cleanup to R1.4 activation.

## P0 conclusion

No deployed Edge Function inspected in this pass currently provides a direct path into the legacy Worker Engine runtime tool gateway or task executor. This reduces the immediate bypass surface.

However, several deployed functions hold `service_role` and perform privileged product/content mutations. Therefore the production-readiness invariant must be stronger than “no Edge Function calls the Worker Engine today”:

> A Worker Engine capability may not adopt an existing privileged Edge Function as a tool unless that function is represented as a governed resource and the call is bound to canonical authority, scope, execution identity, verification, and cost evidence.

This prevents a future implementation from accidentally turning an existing service-role function into an alternative mutation gateway.

## Certification assertions to add

- fail if Worker Engine code directly invokes a production Edge Function that is not in the governed resource registry;
- fail if a governed external resource lacks an operation allowlist;
- fail if a consequential external-resource invocation lacks canonical execution identity;
- fail if service-role possession is treated as authority;
- fail if an external-resource mutation can complete without postcondition verification;
- fail if model/search cost-bearing calls cannot be attributed to the execution.

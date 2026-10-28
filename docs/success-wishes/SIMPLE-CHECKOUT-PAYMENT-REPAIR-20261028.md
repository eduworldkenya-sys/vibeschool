# Simple checkout and service authentication repair

Mission: CYBORG-20261028120833-e5b553. Base: e65078926fb09e62a2803fb543d349e844b3076a.
Owner request: simplify checkout and make real payment available. No operator-initiated STK or charge is included.

## Incident and scope

The production order was saved, but its payment function invocation returned HTTP 401 before a payment claim. The order remained created, with no provider checkout ID, callback, or settlement. Enabling flags had proved availability configuration, not working payment transport. That earlier stronger interpretation is invalidated.

The previous transport sent only a Bearer credential and required byte equality with the function's provisioned service credential. The fix sends the service credential in both supported headers, retains exact canonical-secret authentication, and independently validates alternate legacy service JWTs at the same project's Data API rather than trusting decoded claims. Gateway versus exact-key rejection is not asserted solely from the historical 401.

The fixed read-only authentication probe uses only `mpesa_runtime_control?select=singleton&singleton=eq.true`, a five-second timeout, no redirects/cache, strict one-row response, and no fallback to admin credentials. Production inspection found RLS enabled, no policies and no SELECT grant for anon/authenticated; only postgres/service_role have SELECT. This ACL is now part of the authentication boundary. Any change to it invalidates this assurance. The legacy function gateway check is replaced by handler authentication; no public/user authorization or database grants are added.

## User journey

- A readable card, recipient name, total, payer field and one Pay KSh 50 action.
- The explicit Pay action saves the immutable order, then requests payment; no automatic charge on page load.
- A masked payer and Edit action appear on a saved unclaimed order.
- Long references, recovery key, delivery address and restart stay within Order details.
- Pending payment hides Pay and exposes Check status.
- Unknown transport persists a private uncertainty marker before the request; created snapshots, polling and reload cannot unlock Pay, Edit or another checkout while that request may still be running.
- Only a completed authorization rejection plus an unclaimed order exposes Try again. Unknown/5xx results remain status-only.
- Settlement and private gift issuance retain the existing independent callback/query checks.

## Verification and rollback

Contract tests cover service/user denials, malformed/expired/forged credentials, protected-probe errors, duplicate claims, ambiguous STK, immutable orders, timeout-before-claim, masking, and paid delivery. A negative control disabling authorization is caught by the provider regression. Browser scenarios cover 320, 360, 390, 412, 768 and 1280 pixels, including safe retry, uncertain-created reload, pending status and verified private-link rendering. Fixtures are synthetic and never call Safaricom.

GET `/api/success-wishes/checkout` is a rate-limited, read-only readiness probe: it requires service enabled and both authoritative payment switches, authenticates the website-to-function path, checks the exact approved merchant routing and credential presence, and requests a Safaricom OAuth token. It never claims an order, sends STK, creates callback data or marks an order settled. A ready result does not prove a correct STK passkey or a settled KSh 50 payment.

Rollback: disable the dedicated `success_wishes_enabled` switch to stop new wish claims while preserving reconciliation; revert the application/function change together and restore the previous function's `verify_jwt=true`. Do not revert to a body without its own authentication while leaving the gateway check disabled. Do not retry or reset ambiguous existing attempts. No migration or data rewrite is needed.

## Remaining production proof

After release, verify the exact deployed revision, readiness response, anonymous/user denials, and the original order's unchanged state. The owner must initiate the real KSh 50 trial through the UI; actual STK acceptance, receiving Till, receipt, independently verified settlement and accessible private gift still require genuine provider evidence. Code/UI assurance must not be presented as financial settlement certification.

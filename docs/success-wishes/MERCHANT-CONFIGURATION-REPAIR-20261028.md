# Dedicated checkout merchant configuration

Base: bb3c08955c9da49ff2e95c4f953c5de5a832a870. Mission: CYBORG-20261028160320-3c35ae.

The simplified checkout was integrated by PR #870 and production subsequently received the isolated free-text backend in PR #871. Preserve both.

The live readiness request passed the repaired service-authentication boundary but failed merchant validation. A bounded health-only diagnostic found all three shared credential fields present and all four shared merchant-routing comparisons false. Only static field names/match booleans and allowlisted errors were logged. The diagnostic was immediately removed; original function source was restored and compared byte-for-byte, with the same deployment artifact digest. No order, STK, merchant secret or shared activation setting changed.

Vercel has dedicated SUCCESS_WISHES_MPESA_* production settings. The isolated Edge Function was instead reading the shared MPESA_* namespace. That is the proven configuration-provenance mismatch; it is not proof that either credential set is accepted by Safaricom.

## Repair

The existing server gateway constructs a request-local merchant envelope only from its seven dedicated server environment settings. It rejects missing, oversized or wrong routing before making an outbound request. No customer merchant input is forwarded. A completed local preflight rejection can safely offer a retry; unknown transport or function failures remain status-only.

The existing authenticated, same-project Edge Function validates the approved production/961580/949529/CustomerBuyGoodsOnline tuple and three bounded nonempty credential strings. Only an absent envelope permits the existing strictly checked legacy configuration; a supplied null, empty or incorrect envelope fails closed. Configuration is passed explicitly through health, OAuth, STK and reconciliation, never stored in module state, database records, logs, public responses or caches. Provider URLs are fixed. No shared secret, merchant setting, RLS/grant or runtime flag changes.

## Verification and recovery

Regressions cover server-owned envelope construction despite forged client fields, missing dedicated credential preflight, invalid supplied configuration denial before OAuth/claim/STK, compatibility with independently configured legacy callers, request-local concurrent credentials, private health responses, duplicate payment claims and independent settlement checks. The existing mobile checkout and free pilot remain unchanged.

Deploy the new function first: it accepts both valid legacy callers and the new validated envelope. Then release only the exact reviewed application candidate after protected checks pass. Read-only live GET /api/success-wishes/checkout must return ready:true before directing the owner to Pay. Health requests OAuth only; it proves neither STK passkey validity nor a successful KSh 50 settlement and private-gift delivery.

Rollback application first, then restore the prior exact function source/configuration. Preserve existing uncertain orders and do not resend STK. Disabling the dedicated success_wishes_enabled control contains new wish claims without changing shared merchant configuration. Genuine settlement certification remains pending owner-controlled provider evidence.

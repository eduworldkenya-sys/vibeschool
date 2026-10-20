# Media and payment integration

## Media

`lib/success-wishes/media.ts` is a server-only Cloudflare Stream adapter. It does not create accounts, provision paid capacity or enable the feature. Runtime readiness is false without both server environment variables:

- `SUCCESS_WISHES_CLOUDFLARE_ACCOUNT_ID`
- `SUCCESS_WISHES_CLOUDFLARE_API_TOKEN` (account-scoped Stream permissions; never NEXT_PUBLIC)

The application must authorise the message owner and reserve quota before calling `createDirectUpload(messageId)`. Persist the returned UID before giving its one-time bearer upload URL to the sender. A timeout can leave an allocated provider asset; do not blindly retry allocation. Reconcile using the message ID metadata and provider inventory.

Direct upload enforces 60 seconds, private playback, a 15-minute upload expiry and provider deletion after 60 days. This initial basic POST upload supports a fresh retry after interruption, not resumable transport. Stream recommends tus for unreliable connections; that remains a release limitation until implemented and tested.

`getStatus(uid)` checks the UID, privacy flag, duration and processing state. Client claims never establish media readiness. `createPlayback(uid)` rechecks provider state then issues a five-minute token with downloads disabled. The route must verify inbox access and message availability on every request, return `Cache-Control: no-store`, and avoid logging tokens. Already issued tokens remain usable until expiry; revoking an inbox does not instantly revoke them. Early removal must call provider deletion and verify its result.

Application deletion/expiry must also remove media before closing its cleanup task. Retain failed cleanup as a retryable operation. Scheduled provider deletion is a backstop, not a replacement for application deletion. Limits on bytes, allocation counts and global budget must be enforced before issuing upload URLs. No autonomous cleanup schedule has been commissioned by this adapter.

Cloudflare Stream is intended here for video. Standalone voice delivery requires an independently verified private audio-storage path; this adapter does not claim audio-only compatibility.

Official references checked 2026-10-20:

- https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
- https://developers.cloudflare.com/api/resources/stream/subresources/direct_upload/methods/create/
- https://developers.cloudflare.com/api/resources/stream/methods/get/
- https://developers.cloudflare.com/api/resources/stream/subresources/token/methods/create/
- https://developers.cloudflare.com/api/resources/stream/methods/delete/

## Payments

Reuse the canonical commerce lifecycle in `supabase/functions/learning-product-stk-push/index.ts`, its callback and `commerce_payment_attempts`. Preserve `mpesa_runtime_control` and its default-off activation guard. Existing checkout requires an authenticated purchaser, a learning-product offer and entitlement fulfilment. Guest Success Wishes purchase is not yet supported by that contract.

Do not add an independent receipt table or consider an entered M-Pesa reference proof of payment. A future canonical extension needs guest ownership, server-controlled pricing, durable order-to-message association, provider callback verification, idempotency, reconciliation, refunds and paid-but-undelivered recovery. It needs independent assurance before activation.

No payment initiation, paid media upload, credentials provisioning or production configuration was performed by this work. Provider readiness and production delivery remain unverified.

## Adapter verification

Run `node --import ./scripts/register-typescript.mjs --test lib/success-wishes/media.test.ts`.
These tests inject provider responses. They prove adapter validation and request contracts, not a live upload, actual playback, account permissions or billing correctness.

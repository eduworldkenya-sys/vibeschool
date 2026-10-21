# Success Wishes — phone, candidate opening, voice and video rollout

Status: **development branch only; not commissioned for live traffic**.
No learner data or fake payment result may be used to bypass the release gates.

## Existing delivery contracts

1. Sender uses a verified Kenyan phone number, receives an SMS OTP, and redeems
   the six-digit code for a 24-hour hashed server session. Phone numbers and OTPs
   are not persisted in plaintext; sender identity digests are domain-separated
   from the legacy email channel. Provider responses must report one successful
   SMS recipient. Rate limits, OTP expiry, one-time redemption and code-attempt
   caps remain enforced.
2. Parent selects an opted-in school, correctly matches a learner's school
   admission number and name, and sends a sponsored text request. Sending must
   NOT reveal whether a named candidate exists. No paid entitlement is claimed.
3. Candidate opens the inbox with a school-issued one-candidate access code,
   active current enrollment, unexpired session and participating school.
   Message body and all media playback capabilities stay hidden until candidate
   acceptance. Hide, report, block and sign-out must be verifiable and scoped
   to the correct inbox.
4. Voice notes may be recorded locally with microphone permission or uploaded
   as a 25 MiB file. An independent trusted audio probe must verify actual
   stored bytes, 60-second duration, codec, audio-only streams and SHA-256
   *before* the database can mark media ready. Never trust browser duration.
5. Video may be recorded/selected locally up to 50 MiB, then uploaded through a
   durable sender-owned Cloudflare Stream direct-upload capability. Only
   privately hosted, signed-URL-only, provider-verified videos of at most
   60 seconds can be marked ready. The accepted candidate obtains a
   short-lived playback token, not the upload bearer capability.
6. Media uploads require a valid paid message created by separately verified
   settlement. The payment workstream is **deferred**, not treated as real
   settlement. A manual reference cannot authorize a new paid message.

## Preview commissioning — operational requirements

These are variable *names*, not current settings. Configure via protected Vercel
Preview secrets scoped to the intended branch before enabling any real sending:

- `SUCCESS_WISHES_SENDER_VERIFICATION_ENABLED=true`
- `SUCCESS_WISHES_VERIFICATION_SECRET` — newly generated, >=32 bytes of high-entropy server-only material
- `SUCCESS_WISHES_AT_USERNAME`, `SUCCESS_WISHES_AT_API_KEY` — Africa's Talking SMS provider credentials
- `SUCCESS_WISHES_AT_MODE=sandbox` — **preview only**; for real Kenyan SMS use separately commissioned `live`
- `SUCCESS_WISHES_AT_SENDER_ID` — optional, if the provider has approved a sender ID
- `SUCCESS_WISHES_ENABLED=true` — only after phone OTP, recipient access, opt-in, abuse and tenant-isolation checks pass
- `SUCCESS_WISHES_STAFF_SETUP_ENABLED=true` — only for an approved school-admin setup pilot

Media depends on additional operational proof:

- `SUCCESS_WISHES_CLOUDFLARE_ACCOUNT_ID`, `SUCCESS_WISHES_CLOUDFLARE_API_TOKEN` — scoped private Cloudflare Stream account
- `SUCCESS_WISHES_AUDIO_PROBE_ENABLED=true`, `SUCCESS_WISHES_FFPROBE_BINARY=/absolute/verified/path` — only where a trusted executable is installed and available in the deployed runtime
- `SUCCESS_WISHES_MEDIA_UPLOAD_ENABLED=true`, `SUCCESS_WISHES_MEDIA_CERTIFIED=true` — **last**, only after private storage, signed upload/download, duration inspection, revocation, cleanup, Android browser and independent QA pass

Keep `mpesa_runtime_control.initiation_enabled=false` and
`SUCCESS_WISHES_PAYMENTS_ENABLED=false` until the payments workstream is actually reconciled.

## Test and release gate

- Disposable PostgreSQL fixtures: sender isolation, staff consent, 2-school
  access, recipient acceptance and block/report behavior.
- Unit/contract tests: SMS parser/provider failures, sender fingerprint,
  unaccepted inbox/body safety, microphone preview, private voice/video
  adapter, provider timeouts, upload ownership, verification and cleanup.
- Preview HTTP checks: disabled service returns a non-disclosing response;
  preview text-test route is synthetic and must not be mistaken for real delivery.
- **Real controlled sandbox school test**: authorised school administrator opts
  in, issues a fictional student access code, parent verifies a controlled
  phone, sends a text wish, student opens and accepts it, then hides, blocks,
  and signs out. Verify no cross-school or shared-device access.
- **Real media test**: verified paid test entitlement, actual private recording,
  independently verified duration/format, candidate acceptance, signed stream,
  expiry, withdrawal and revocation, and retention cleanup.
- Exact-HEAD CI, successful Vercel preview, independent security/child-privacy
  sign-off and explicit commissioning required before production flags or merge.

**Current external constraints:** SMS credentials, Cloudflare account/token,
deployed FFprobe runtime, opted-in school/candidate fixtures, and real payment
settlement evidence have not been verified. The repository does not authorize
inventing any of these. Keep the service default-off when evidence is absent.

# Database contract

`schema.sql` is a proposed schema, not an executable release migration. It has not
been applied. The active Teacher OS mission leases `supabase/migrations` and
`supabase/tests`; reconcile that ownership before generating a tracked migration.
No production database, payment or media activation is included.

## Identity and access

Use `schools.id` and `students.id`. Current school enrollment comes from
`student_classes`, joined to `classes` with matching school. Directory IDs are
never recipient school IDs. Each school explicitly opts in; defaults disable the
service and sponsorship. An administrator issues an inbox before messages can be
matched. Duplicate admissions fail closed rather than choosing a learner.
Classes are joined using their canonical ID/school contract; the tracked classes
schema has no `deleted_at` column. Do not invent that predicate. Current enrollment
and non-deleted students/schools supply the supported lifecycle checks.
Retention is configurable from 1 to 365 days (default 60), capped by the school
campaign expiry. The server must use the same bounds. Withdrawn or expired text
messages may clear their body; other text states require nonempty content.

All seven tables enable RLS and revoke direct anonymous and authenticated access.
Only trusted server code uses service-role table privileges. The authenticated
staff RPC issues/reset codes and writes an audit event; it never reads message
content. Existing student account authentication may resolve `current_student_id()`
server-side, but must also validate the inbox's current school and expiry.
The reset predicate uses the canonical `profiles.account_status` enum and
`profiles.is_anonymized boolean not null default false`, defined in the tracked
baseline. Missing/inactive/anonymized profiles fail closed. This catalog shape
was checked in repository SQL, not against a live database.

An access code is 16 random bytes represented as 32 uppercase hexadecimal
characters. Its stored hash is SHA256 of `success-wishes:inbox:` followed by the
uppercase trimmed code. It is returned once, never logged. Session and sender
management tokens must have at least 128 random bits; store only SHA256 hashes.
The server compares hashes without timing-dependent string comparisons.

Each request validates inbox expiry, school participation, current enrollment,
session expiry and equality of session/inbox `access_epoch`. Reset increments the
epoch and deletes guest sessions atomically. Recheck the epoch before issuing any
playback token; keep media playback tokens short-lived. An already issued token
may remain usable until its expiry unless the provider supports revocation.

## Server obligations

- Rate-limit before recipient matching, unlocks, issuance, uploads and submission.
  `success_wishes_take_attempt` is an atomic fixed-window limiter. Use hashed,
  purpose-scoped keys and a stable configured window/limit per key. This prevents
  local-process resets and concurrent requests bypassing a counter.
- Expose only participating school names/location, never a learner directory or
  different public responses for unknown admission numbers versus wrong names.
- `success_wishes_match_recipient` returns only a pre-issued inbox UUID to server
  code. Never return that identifier as proof that a student exists to strangers.
- Sender management permits withdrawal/status only for that submission. It never
  grants inbox read access. Idempotency keys must also be bound to the sender's
  secret; replay must not disclose another sender's management token or message.
- New messages are requests. Only the recipient accepts them. Text sponsorship
  requires the current school's explicit `sponsored_text=true`; otherwise payment
  remains pending until a real provider callback is verified. Never release media
  or accept a message merely because a browser supplies a paid flag.
- Protected playback checks accepted state, paid/sponsored status, media readiness,
  expiry and current access on every request. Raw provider asset IDs are not links.
- Reporting changes state to `reported`; blocking hides the selected message.
  Use the service-only `success_wishes_message_action` RPC after verifying inbox
  access. It locks the message and commits report, state and audit together.
  Accept requires funded status and media readiness; blocking/reporting remain
  possible for unpaid requests so payment never prevents abuse reporting.
  Cross-message sender blocking needs a verified stable sender identity and is not
  supplied by a freely editable sender name.
- Validate provider callbacks and asset ownership; enforce media duration/size
  after processing as well as before upload. Reconcile failures without payment
  duplication. Do not configure media submission while provider access is missing.
- No cache of private responses. Use secure HttpOnly SameSite cookies, bounded
  inactivity, CSRF/origin checks for cookie-authenticated mutations and explicit
  shared-device sign-out. Do not persist private message bodies in local storage.

## Release and recovery

Before migration: verify pgcrypto schema and current canonical catalog, use the
Supabase CLI to generate a migration, inspect grants/RLS, reconstruct locally,
and independently test tenant isolation, concurrency, epoch reset, expiry,
recipient ambiguity and callback replay. Granting service-role access is not proof
of authorization; route tests must exercise every privileged boundary.

Run a bounded deletion job for expired media, messages, sessions and rate-limit
windows. Delete provider assets before clearing identifiers; retain failed cleanup
references for retry. Do not retain message bodies in audit records. Publish the
retention period before accepting messages. These jobs are proposed, not active.
`success_wishes_cleanup(p_limit)` expires and clears text bodies, removes expired
sessions and removes counters older than the maximum one-day window, at most
`p_limit` of each per call. Media assets require a separately verified provider
deletion worker; this RPC does not claim physical media deletion.

Rollback disables the school setting and public submission first, revokes guest
sessions and stops payment/media release. Preserve paid order references for
reconciliation. Do not drop tables containing messages or overwrite canonical
learner data as a rollback shortcut.

# Success Wishes recipient access design

Status: design proposal for the text-only proof. It is not an implemented or certified delivery path. The school-gated inbox in the existing backend does not satisfy this design and must not be treated as its substitute.

## Address and identity

A wish has an independently generated `wish_id`. Its display address contains the candidate's name and exam year, with school as an optional label. Those values help the sender check the card; they are not credentials and are not used to search or authenticate a candidate. Do not publish a candidate directory or search results for private wishes.

Two synthetic recipients may have the exact same address:

| Synthetic wish | Candidate | School label | Exam year | Private invitation |
| --- | --- | --- | --- | --- |
| Wish A | John Mwangi | Gilgil Township | 2026 | Independently generated secret A |
| Wish B | John Mwangi | Gilgil Township | 2026 | Independently generated secret B |

The database identity is the wish ID, never the name/school/year tuple. Both rows and both secrets must remain separate. If the sender cannot tell which real-world John they mean, VibeSchool cannot infer it from these fields. The sender must check with the intended person or a trusted contact before sharing the invitation.

## Proposed invitation and claim

1. The server creates a random 256-bit invitation secret for each wish and stores only its cryptographic hash alongside the wish ID, expiry and revocation state. It returns the raw secret once as a VibeSchool invitation link. The message body is not put in the URL.
2. Put the secret in the URL fragment so browsers do not send it in the HTTP request or `Referer`. The claim page reads it, immediately removes it from the address bar, disables analytics on that route, and exchanges it over a same-origin, no-store POST. Logs must never include the raw secret or wish body.
3. The candidate sees the wish's name, optional school and exam year, then chooses to accept or reject. These labels support a human check but do not establish that the reader is the named real-world person. The invitation is a bearer capability: anyone who obtains it before claim may attempt to claim it.
4. On acceptance, consume the invitation atomically, create a candidate-chosen recovery secret (or equivalent strong credential), store only its hash, and establish a short-lived `HttpOnly`, `Secure`, `SameSite=Strict` session. The sender must not receive the candidate's recovery secret.
5. Returning on the same browser uses the session. Returning on another browser requires the candidate's recovery secret; there is no public name-based lookup or school fallback. Sign-out revokes the current session and clears its cookie. A shared-device warning should tell the candidate to sign out and not leave the recovery secret on that device.
6. The candidate can reject/report a wish. The sender can withdraw it using the existing one-time management capability. A revoked or expired invitation and a wrong secret return the same generic response. Token attempts are rate-limited. Expiry and retention are shown before real release.

The invitation identifies one saved wish, not the reader's real-world identity. If a wrong John receives and claims the link, name, school and exam year cannot correct that mistake. Sending through a trusted channel and candidate confirmation reduce the risk; they do not prove identity. This limitation must remain visible in product copy.

## Required verification before delivery can be called working

- Use two rows for the duplicate John Mwangi addresses above; assert separate wish IDs, separately generated hashes and distinct invitation secrets.
- Claim A and read the exact message. Try A's invitation and recovery secret against B; both must fail without revealing that B exists.
- Verify a consumed, expired or revoked invitation cannot be claimed; the candidate's valid session survives refresh; sign-out revokes that session; a valid recovery secret can reopen only its own wish on another browser.
- Exercise wrong/invalid tokens, expiry boundaries, duplicate claim races, retry/idempotency, rate limits, malformed input and generic failure responses against the real migration and API.
- Confirm no candidate list/search endpoint is exposed, and no school, admission number, school approval or school-issued code is needed for this independent link journey.
- Test shared-device sign-out at mobile and desktop sizes, and inspect browser history, referrers, logs, analytics, response caching and token redaction.
- Review age/guardian consent, abuse reporting, retention and recovery policy before any real minor or paid wish is accepted.

## Current boundary

The current database journey links messages to a school inbox and canonical student enrollment, and candidate access uses a school-issued code. The production database catalog has no Success Wishes schema. The separate test database has the older school-gated schema. No hosted project was changed in this work. A local Postgres/Supabase test runtime is not installed in this workspace, so a new invitation schema or API cannot yet be safely implemented and verified here. Until a local isolated database is available and the tests above pass, the private invitation journey remains unimplemented and sending must remain off.

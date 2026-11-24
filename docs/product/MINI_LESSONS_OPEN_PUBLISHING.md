# Mini Lessons — Open Creator Publishing

## Product decision (24 November 2026)

Mini Lessons is an **open educational creator and discovery platform**, similar to consumer social publishing. There is **no HQ editorial-approval queue** for routine Mini Lessons, student requests or comments. Existing VibeSchool usernames, profiles and accounts are reused. `Open platform` is a product-access decision, **not** a license to make the private VibeSchool source repository public.

The contributor journey is:

**Create → automated safety check → appear in Mini Lessons → social learning and discovery.**

Students can request explanations; more than one eligible explainer may publish a Mini Lesson answering a request. There is no winner-takes-all approval contest. Users may report unsafe material; repeated independent reports trigger an automatic visibility hold. The reporter's identity is private.

## Safeguards that remain mandatory

- Each submission is authenticated, bound to its actual profile, subject to rate limits and kept private until safety screening passes. Photo contents and text (including optional questions) are screened, not just a caption.
- The server-side safety service must fail closed on unavailable providers, invalid verdicts and uncertain safety classifications. Failed items are not published and must be retried or revised.
- Student requests never publicly disclose the requesting learner's profile. Public requests are projected only through the existing anonymizing RPC. No public children-identifying profile creation is introduced.
- Public creator age eligibility is **separate** from editorial content approval. Current verified-adult requirements are preserved, pending a separately verified self-service assurance method. Do not substitute user-editable DOB for proof of age.
- Direct clients cannot approve content; the service role remains backend-only and is restricted by an explicit off-by-default publishing flag. The automatic scanner records a private decision trail and has bounded lease attempts.
- Safety reports can automatically hide posts. The system still needs an appropriate appeal, copyright and abuse-response process; removing HQ editorial approval does not remove responsibility for safety.
- No personalized behavioural profiling of minors. Hashtag discovery and child-safe ranking remain.
- The canonical owner/publishing activation authority stays separate from content moderation. A Git merge and migration cannot enable publishing on their own.

## Retired interfaces

`/hq/minis` redirects to Explore. `/api/hq/minis/review` returns 410. The HQ navigation item is removed. Historical review functions and tables remain in the database for audit/recovery but are not used for ordinary publication.

## Release controls

1. `NEXT_PUBLIC_MINI_LESSONS_BACKEND_ENABLED=true` selects the live data feed. It defaults off.
2. `MINI_LESSONS_OPEN_PUBLISHING_ENABLED=true` permits server-side safety checks and publications. It defaults off. The only eligible private service may assign approved status after screening.
3. `GEMINI_API_KEY` must be available on the server; `MINI_SAFETY_MODEL` can configure a reviewed classifier version. Missing/failed screening keeps items private.
4. Apply the additive `20261124230000_mini_open_creator_safety_scans.sql` migration **only after** separate production RLS, abuse, privacy and operational verification.
5. Do not activate until owner-bound commissioning, age-eligibility self-service, real-image safety trials, privacy notices, negative-case testing and a public content takedown/appeal path are verified.

## Evidence

The branch's exact-head CI must pass `scripts/test-mini-open-publishing-contract.mjs`, the original Mini Lesson/request contracts (with the new workflow expectations), full typecheck/build, SQL reconstruction and browser verification. No historical CI result authorizes release of a changed commit.

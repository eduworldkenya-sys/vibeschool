# VibeSchool Google OAuth production contract

## Invariants

1. Google OAuth returns to `/auth/callback` on the same browser origin that initiated PKCE.
2. `intent` and `role` query parameters are routing hints, never authorization.
3. Existing database profile/onboarding state always wins over a requested role.
4. A sign-in callback with no established VibeSchool profile fails closed and sends the user to deliberate account setup; it cannot silently create a teacher/parent role.
5. A signup callback may route a genuinely new identity to first-access onboarding, where authoritative product state is created.
6. `next` accepts only same-origin relative paths and is honored only when database onboarding state is `ready`.
7. Provider cancellation, malformed callbacks, missing code and PKCE exchange failures return to login with bounded error codes and no sensitive provider error text.
8. OAuth callback responses are private/no-store and do not leak callback URLs through referrers.

## Google Cloud production configuration (manual external gate)

The Google consent screen shown to users is controlled by Google Cloud, not VibeSchool CSS.

Configure the OAuth application as **VibeSchool** with:

- App name: `VibeSchool`
- VibeSchool logo
- Authorized domain: `vibeschool.co.ke`
- Application home page: `https://vibeschool.co.ke`
- Privacy policy: `https://vibeschool.co.ke/legal/privacy`
- Terms: `https://vibeschool.co.ke/legal/terms`
- A monitored VibeSchool support/developer contact

The Google OAuth client must authorize the Supabase Google callback URL for the production project. With the current Supabase project domain this is:

`https://yauqsxggtuxuykcbrtzf.supabase.co/auth/v1/callback`

Do not substitute the application `/auth/callback` URL for Google's Supabase callback. Google returns to Supabase first; Supabase then returns the browser to the application `redirectTo` URL.

If a Supabase custom auth domain is introduced later, update the Google authorized redirect URI in the same controlled release and verify PKCE before removing the old URI.

## Supabase production configuration (manual external gate)

- Google provider enabled with the intended production Google client ID/secret.
- Site URL uses the chosen canonical VibeSchool production origin.
- Redirect allow-list contains the exact production VibeSchool `/auth/callback` origin(s) intentionally supported.
- Do not add wildcard attacker-controlled domains.
- Keep both `www` and apex only if both are deliberately supported through the whole PKCE flow; otherwise canonicalize before OAuth begins.

## Acceptance matrix

Must pass before merge/release:

- Existing teacher: Google sign-in -> existing teacher onboarding/dashboard.
- Existing parent: Google sign-in -> existing parent state/dashboard.
- Existing global learner: Google sign-in -> existing global state/dashboard.
- Existing account enters through wrong role URL -> database role wins; no role mutation.
- New Google identity enters sign-in -> fails closed to account setup; no privileged profile created.
- New Google identity enters teacher signup -> teacher first-access onboarding only.
- New Google identity enters parent signup -> parent first-access onboarding only.
- Google consent cancelled -> bounded login error.
- Missing/malformed callback parameters -> bounded login error.
- Replayed/expired PKCE code -> exchange failure; no partial product-state mutation.
- `next=https://evil.example` and `next=//evil.example` -> rejected.
- Refresh after successful callback -> normal authenticated destination; no duplicate onboarding records.
- Mobile/PWA and production browser flow retain session cookies.
- Consent screen visibly identifies VibeSchool, not only the raw Supabase project hostname.

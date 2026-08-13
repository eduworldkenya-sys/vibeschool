# VibeSchool Auth Journey Unification

Status: repair branch only; main untouched.

Canonical rule: after authentication, routing authority is `get_my_onboarding_state()`. Middleware must prevent protected-dashboard entry when onboarding is incomplete. The polished dark/gold authentication UI remains the canonical visual experience.

Known follow-up: `app/page.tsx` still contains legacy client-side `get_my_role()` destination logic and must be retired before promotion so password and Google authentication share one routing contract.

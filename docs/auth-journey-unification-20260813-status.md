# Auth Journey Repair Status

Branch: `agent/auth-journey-unification-20260813b`

Current exact-head work is isolated from `main`. Middleware uses `get_my_onboarding_state()` as the authoritative protected-route resolver. Client-side legacy routing remains a pre-merge blocker and must be retired before promotion.

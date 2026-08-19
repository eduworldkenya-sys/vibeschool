# VibeSchool Task 6 — Final Candidate Addendum

This addendum records the final pre-certification scope added after the main Task 6 handover.

## Final child-hub closure

A final read-only audit of `app/parent/child/[id]/page.tsx` found a pilot P1: the visible **View Homework** control only displayed `Homework coming soon` even though the Parent product already had homework data. The same legacy child hub also displayed an encouragement send control without persistence and a call-school placeholder toast.

The child hub has therefore been reduced to real, supportable family actions:

- Homework -> `/parent/child/[id]/homework`
- Released results -> `/parent/assessments?studentId=[id]`
- Learning/progress -> `/parent/child/[id]/growth`
- Child-scoped communication -> `/parent/child/[id]/messages`
- Profile and Finance remain real child-scoped destinations.

The new child Homework page first reads the canonical learner through Parent RLS, then reads class homework and only that learner's submissions. Guessed/revoked learner deep links fail before homework is resolved. Network failure clears the result and explicitly refuses to substitute cached sibling data.

The Parent Core Journey Contract now permanently rejects the old homework placeholder and non-functional encouragement action, and requires real child-scoped homework/message/result routes plus the deep-link RLS gate.

## Candidate freeze

Branch: `cert/parent-core-journey-task6-20260819`

PR: `#285`

This document commit is the final intended code/documentation change before exact-head certification. Resolve the resulting commit SHA from the branch and certify that exact SHA against the then-current `main`.

No production schema mutation or Vercel deployment is authorized by this addendum. The existing merge rule remains: exact-head gates first, then ordered production schema promotion and privacy attacks, then merge once, intended final deployment, and production Parent E2E.

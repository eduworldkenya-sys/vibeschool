# School Identity Frontend Contract

## Rule
Frontend school pickers consume trusted canonical school identities. Discovery/candidate records are not trusted entities.

## Required behavior
- Search returns canonical `school_id`, display name, county/sub-county and level context.
- A school missing from canonical search must not be silently invented client-side.
- User-submitted missing-school requests enter discovery/candidate flow.
- Review/pending/rejected identities never appear as trusted selectable schools.
- Selection persists the stable canonical school ID, not a display name.
- Existing onboarding flows remain compatible with the canonical ID contract.

## UX
If a requested school is absent, provide a clear `Can't find my school` path. Capture the user's entered name and available location/context as discovery evidence. Do not force a parent or teacher to choose an incorrect similarly named school.

## Trust model
The UI should prefer an accurate empty state over a plausible but wrong school. Search ranking can improve discovery, but identity authority remains server-side.

# Teacher-school governed authority — senior convergence review

## Non-negotiable invariants
- School selection is evidence for a claim, never membership authority.
- Only an approved claim may create `school_members` teacher authority.
- Approval requires platform-owner authority or administrator authority over the resolved canonical school.
- Directory identity may retain both directory provenance and a reviewed canonical school mapping.
- Existing mature school discovery, ambiguity handling, missing-school reporting and location-assisted search must not regress.
- Existing canonical auth state remains owner of login routing; pending claims are handled by the onboarding route without replacing the auth state machine.

## Repaired defects from the first attempt
1. Restored the current-main school discovery journey instead of replacing it with a compressed rewrite.
2. Changed the persisted claim target invariant from exactly-one to at-least-one because reviewed directory claims legitimately retain directory provenance plus canonical school identity.
3. Reject null education levels in compatibility wrappers.
4. Require reviewed identity candidates with accepted status before canonical directory resolution.
5. Keep membership creation exclusively inside the approved-review branch.
6. Added regression contracts for legacy wrapper privilege escalation, UI preservation, pending routing, reviewer authority and directory/canonical dual identity.

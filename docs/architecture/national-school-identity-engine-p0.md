# VibeSchool National School Identity Engine — P0 Protection

Status: ACTIVE
Priority: P0
Date: 2026-08-15

## Objective

Protect the existing VibeSchool product while the National School Identity Engine expands school coverage. No identity-engine work may weaken onboarding, school search, canonical-school integrity, or database security.

## P0 invariants

1. Canonical `schools` remain the only trusted school identity layer exposed by product search.
2. Directory records are discovery evidence, not canonical identities.
3. Identity candidates are internal reconciliation state and are never a frontend source.
4. No unverified candidate may be silently promoted to canonical.
5. Existing onboarding and school relationships must remain compatible with the canonical school model.
6. Every identity decision must retain provenance/evidence.
7. Public/anonymous clients must not receive write authority over school identity data.
8. Existing RLS and SECURITY INVOKER/DEFINER boundaries must not be weakened as a shortcut.
9. All production changes must be reversible and verified against live state.

## Production baseline verified

- Supabase production project: `yauqsxggtuxuykcbrtzf`
- Canonical `schools`: RLS enabled.
- `schools_directory`: RLS enabled.
- `school_identity_candidates`: RLS currently disabled, but the table has no public SELECT/INSERT/UPDATE/DELETE grants; candidate data therefore remains inaccessible through normal API table access. This remains a follow-up hardening item if direct table access is ever required.
- Existing canonical and directory RLS policies were inspected before changes.

## P0 hardening applied

Migration: `p0_harden_school_identity_public_writes`

Anonymous write privileges were explicitly revoked from:

- `schools`
- `schools_directory`
- `school_identity_candidates`

Candidate-table direct mutation privileges were also removed from `authenticated`; reconciliation must occur through controlled server-side paths rather than client table writes.

## Product contract

Frontend school discovery must resolve through the trusted search/read layer. It must not query `school_identity_candidates` directly and must not treat raw `schools_directory` rows as canonical schools.

## Exit criteria

P0 is complete when:

- canonical school search remains functional;
- onboarding remains functional;
- anonymous clients cannot mutate school identity data;
- candidates remain isolated from frontend trust paths;
- identity-engine promotions are auditable and reversible;
- production security checks show no regression attributable to the identity engine.

## Next P0/P1 boundary

After protection is verified, proceed to P1: establish and reconcile the authoritative national school universe. Do not mass-promote the existing discovery population before the identity rules are proven.

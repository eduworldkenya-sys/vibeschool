# Pathways reconstruction authority — 2026-08-16

This branch reconstructs Pathways on top of the current VibeSchool mainline after Auth & Onboarding hardening and School Engine ingestion hardening.

## Authority rule

Pathways consumes canonical authentication, identity, role and onboarding state. It does not own OAuth callback handling, session establishment, role assignment, profile authority or onboarding routing.

## Pathways-owned scope

- anonymous acquisition and Quick Check
- explicit uncertain/no-result behavior
- learner-owned Pathway decisions and passport state
- source provenance and authoritative observations
- verified pathway truth
- canonical-school offering claims
- public school discovery limited to verified offering evidence

## Idempotency rule

An idempotency key represents one semantic learner decision. Replaying the same key with the same pathway, rule version and evidence is permitted. Reusing that key for a changed pathway or changed evidence fails closed.

## Production rule

No Pathways migration is deployed from this branch until exact-head certification passes and the reconstruction is merged through the controlled release process.

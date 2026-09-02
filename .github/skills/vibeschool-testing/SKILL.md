---
name: vibeschool-testing
description: Risk-based verification and regression testing discipline for VibeSchool engineering changes.
---
# Testing
Select tests from blast radius, not habit. Use targeted unit/contract/integration tests plus typecheck, lint and build as applicable. Database/auth changes require positive and negative authorization proof; concurrency paths require duplicate/race/idempotency checks; user journeys require loading/empty/error/success coverage. New regression tests must prove they fail under a safe reproduction of the protected defect. Do not weaken assertions or skip failing gates to create green CI.

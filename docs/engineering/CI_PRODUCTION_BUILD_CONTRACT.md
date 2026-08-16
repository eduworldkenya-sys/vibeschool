# CI Production Build Contract

VibeSchool has one authoritative CI definition for producing a Next.js production build:

`.github/actions/production-build-contract/action.yml`

## Authority boundary

The canonical action owns:

- Node.js runtime version
- dependency installation
- build memory limit
- Next.js telemetry setting
- public Supabase build-time configuration
- the production build command

Feature, security, browser, and domain certification workflows may run their own prebuild invariants, but they must not independently redefine the production build environment.

## Certification rule

A workflow that needs a production build must consume:

`./.github/actions/production-build-contract`

Direct `npm run build`, `next build`, or `npx next build` commands in `.github/workflows` are prohibited.

`scripts/test-ci-production-build-contract.mjs` enforces this boundary and verifies that the known build consumers remain attached to the canonical action.

## Failure classification

A domain contract failure means that domain invariant failed.

A canonical build action failure means the shared application build contract failed.

A CI build-contract drift failure means workflow configuration attempted to create a competing definition of production-build truth.

This separation prevents a specialized gate from reporting an authentication, PWA, or other domain regression merely because its private CI runtime drifted away from the repository-wide build environment.

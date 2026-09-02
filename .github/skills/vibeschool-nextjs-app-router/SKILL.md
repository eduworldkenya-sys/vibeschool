---
name: vibeschool-nextjs-app-router
description: Next.js App Router implementation guardrails for VibeSchool server/client boundaries, routing, data fetching and production behavior.
---
# Next.js App Router
Respect current Next.js version and repository conventions before applying framework advice. Preserve server/client boundaries, async route contracts, metadata/canonical rendering, auth isolation, error/loading states and cache semantics. Keep secrets/service-role credentials server-only. Prefer server rendering for public crawlable content and trusted server boundaries for privileged operations. Validate route params/search params, hydration/client-only behavior, production build and mobile rendering. Do not introduce a second auth/session client or route authority path without a governed architecture decision.

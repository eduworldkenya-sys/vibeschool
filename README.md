# Vibeschool

Vibeschool is a connected education platform for teaching, learning, practice and progress.

## Product entry

The public experience is intentionally small:

- `/` — fast product gateway
- `/global` — explore learning without an account
- `/auth` — sign in or create an account
- `/about` — what Vibeschool is
- `/contact` — support and enquiries
- `/legal/privacy` — privacy policy
- `/legal/terms` — terms of service

The goal is to move a visitor into learning or teaching with minimal reading and minimal navigation.

## Core product surfaces

### Learners

- Learn and read educational content
- Complete assigned tasks and practice
- Review results, mistakes and progress
- Receive adaptive recommendations and Twin support

### Teachers

- Work from curriculum and schemes of work
- Plan and deliver lessons
- Assign and assess learner work
- Use evidence and Twin support to understand what needs attention next

## Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Supabase Auth and PostgreSQL
- Progressive Web App service worker

## Development

```bash
npm install
npm run dev
```

Quality gate:

```bash
npm run validate
```

`npm run validate` runs TypeScript checking, linting and a production build.

## Environment

The application expects the Supabase environment variables used by `lib/supabase` and server-side integrations. Do not commit secrets or service-role keys.

## Offline behaviour

The service worker caches only public routes and static assets. Authenticated application routes and `/api/*` requests are deliberately excluded to avoid caching personalised or sensitive data.

When the public site cannot be reached, navigation falls back to `public/offline.html`.

## Design principles

- Product first, not marketing first
- One clear next action per surface
- Mobile-first responsive layouts
- Accessible keyboard focus and touch targets
- Minimal client JavaScript on public pages
- No authenticated data in public offline caches

## Repository workflow

Develop changes on a branch from `main`. Before merging, run the full validation command and review the changed-file scope. Keep database changes migration-led and verify Supabase RLS when schema or policy behaviour changes.

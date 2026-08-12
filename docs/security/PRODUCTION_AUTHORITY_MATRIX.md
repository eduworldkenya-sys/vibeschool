# VibeSchool — Production Authority & Security Matrix

**Status:** Canonical engineering control document
**Scope:** Production Supabase authorization boundaries and public discovery
**Rule:** RLS, grants, RPC authorization, application authorization, and publication lifecycle must agree.

## 1. Security boundary

VibeSchool has two fundamentally different data surfaces:

1. **Public educational discovery** — deliberately published educational resources.
2. **Private Education Operating System** — learner, teacher, parent, school, assessment, HQ, and operational data.

Crawler directives are not security controls. Database RLS and server/application authorization remain authoritative.

## 2. Public publication contract

A course is publicly discoverable only when:

- `courses.status = 'live'`
- the course contains at least one module
- at least one topic in the course is `published`

A topic is publicly discoverable only when:

- `topics.content_status = 'published'`
- its module belongs to a live course

The publication invariant is enforced by database triggers. Discovery code must fail closed when the relationship cannot be resolved.

## 3. Direct Data API boundary

The public learning tables are intentionally constrained:

| Surface | Public rule |
|---|---|
| `courses` | live rows only |
| `modules` | modules belonging to live courses only |
| `topics` | published topics belonging to live courses only |
| `quiz_questions` | no generic anonymous/authenticated table-read surface |
| learner progress | private to learner authorization |
| private/HQ tables | no generic anon/authenticated table access |

## 4. Privileged RPC rule

`SECURITY DEFINER` is not itself an authorization decision. Every privileged function must be classified as one of:

- authenticated role-gated operation;
- public read/telemetry operation with explicit input validation;
- internal/service operation that must not be executable by `anon` or ordinary `authenticated` callers.

Functions that operate on learner, teacher, parent, school, assessment, financial, HQ, or private VibeTwin data must derive authorization from the authenticated identity and/or explicit role/school relationship rather than trusting caller-supplied ownership identifiers.

## 5. Verified public reader boundary

`get_public_vibetextbook_reader(uuid)` is intentionally executable by `anon` because it is the public reader boundary.

Its raw helper `get_public_vibetextbook_reader_raw(uuid)` and sanitizer `reader_sanitize_blocks(jsonb)` are **not executable by `anon` or `authenticated`**.

The raw reader itself restricts results to published VibeTextbook publications and published chapters, applies pricing/free-chapter rules, and passes readable blocks through the public reader sanitizer.

## 6. Private RPC boundary

The production catalog contains many `SECURITY DEFINER` functions executable by `authenticated`. This is not treated as a blanket vulnerability. Each function is an application authorization boundary and must be reviewed against its caller role and data scope.

The current production grant inspection found:

- `anon` execution is absent for the authenticated application RPC catalog except the intentionally public VibeTextbook reader boundary.
- `authenticated` execution is present for the application RPC catalog and therefore requires function-level authorization review.
- tables with RLS enabled and zero policies are not directly readable/writable by `anon` or `authenticated` through the Data API; such tables must be accessed only through explicitly authorized RPC/service paths.

## 7. Non-negotiable invariants

1. No private learner/school/HQ record enters public discovery metadata.
2. No unpublished educational content enters the sitemap.
3. No assessment answer-bearing table is exposed as a generic public read surface.
4. No `SECURITY DEFINER` function is considered safe merely because it is callable only by `authenticated`.
5. Public reader functions return only intentionally public/sanitized content.
6. A production verification claim requires runtime evidence; source inspection alone is insufficient.

## 8. Release gate

Before production release, verify the same authority chain in source, migration history, live database catalog, generated routes, and actual production HTTP responses.

`IMPLEMENTED` is not `VERIFIED`. `VERIFIED` is not `CERTIFIED` until the production boundary has been exercised successfully.

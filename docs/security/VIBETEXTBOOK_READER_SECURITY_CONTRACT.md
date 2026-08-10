# VibeTextbook reader security contract

Status: proposed by issue #41 hardening branch. This contract becomes active only when the migration is promoted and applied.

## Public anonymous reader

Signed-out visitors may read published VibeTextbooks without creating an account.

The anonymous API is `public.get_public_vibetextbook_reader(uuid)`. It is `SECURITY INVOKER`, so the caller remains bound by table grants and RLS.

It may return only:

- explicitly allowlisted public publication metadata;
- chapters whose status is `published` and whose parent publication is published;
- chapter bodies for free/donation books and configured freemium sample chapters;
- learner-facing curriculum metadata already safe for public display.

It must never return:

- draft, unpublished, or archived publications;
- locked chapter rows or their bodies;
- author IDs, revenue, moderation, or internal workflow fields;
- reading progress, bookmarks, saved state, or another user's identity;
- content derivatives, teacher notes, assessment answer keys, or internal research artifacts.

A missing, draft, unpublished, archived, or wrong-format publication returns the same `not_found` result to avoid existence disclosure.

## Authenticated reader

Signed-in viewers use `public.get_vibetextbook_reader(uuid)`.

This function is `SECURITY DEFINER` only because it must evaluate caller-scoped entitlements and author preview against rows hidden by RLS. It:

- derives identity only from `auth.uid()`;
- is executable only by `authenticated` and `service_role`;
- uses an empty fixed `search_path` and schema-qualified objects;
- exposes an explicit publication-field allowlist;
- returns only the calling viewer's progress and bookmarks;
- permits draft preview only when `auth.uid() = author_id`;
- delegates chapter access to the canonical entitlement function.

The function does not query `content_derivatives`, generated assessment answer keys, teacher guides, or other staff-only sources.

## Role matrix

| Viewer | Published free | Freemium sample | Freemium locked | Paid/school locked | Own draft | Other draft |
|---|---:|---:|---:|---:|---:|---:|
| Signed out | Read | Read | Denied | Denied | Hidden | Hidden |
| Signed-in learner | Read | Read | Entitlement decision | Entitlement decision | Hidden | Hidden |
| Author | Read | Read | Read own | Read own | Preview own | Hidden |
| Service role | Operational only | Operational only | Operational only | Operational only | Operational only | Operational only |

## Required release evidence

Before promotion:

1. The migration must compile in a rollback-only transaction against the target database.
2. `scripts/sql/verify_issue_41_reader_security.sql` must report PASS (or an explained fixture SKIP) for every check.
3. TypeScript, lint, and production build gates must pass.
4. Browser verification must cover signed-out published reading, signed-in progress, author draft preview, and locked-chapter behavior.
5. Supabase Security Advisor must no longer report anonymous execution of `get_vibetextbook_reader(uuid)`.
6. Any remaining advisor warning must have an object-specific justification and owner.

# Mission 243 — Batch 4 P4 Evidence

## E-017 — Sitemap authority correction

**Finding:** The previous sitemap contained only static site URLs. It did not project published VibeTextbook resources from the database publication authority.

**Repair:** `app/sitemap.ts` now queries `vibe_publications` for `status='published'` and `format='vibetextbook'` and emits `/read/textbook/{id}` URLs. Unpublished records cannot enter the dynamic publication portion of the sitemap. Query/configuration failure fails safe by returning only the fixed public informational URLs.

**Status:** VERIFIED at source-contract level; HTTP/production execution remains P8/P9 evidence.

## E-018 — Reader canonical/metadata correction

**Finding:** `app/read/textbook/[publicationId]/page.tsx` is a client component and the route layout previously supplied no publication-aware metadata.

**Repair:** `app/read/textbook/[publicationId]/layout.tsx` now generates metadata from a database row that must satisfy both `format='vibetextbook'` and `status='published'`. Published readers receive title, description, canonical URL, Open Graph, published/modified timestamps, and index/follow directives. Missing/unpublished records fail closed to `noindex,follow`.

**Status:** VERIFIED at source-contract level; HTTP/production execution remains P8/P9 evidence.

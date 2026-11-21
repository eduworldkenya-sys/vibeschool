# Grade 4 Mathematics official source binary retrieval — verified blockage

Date: 2026-11-14 (Nairobi). Scope: source evidence, no curriculum promotion.

## Actual experiments

1. GitHub Actions CI run `43642109349` fetched the historical official KICD PDF URL `https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf` and received **HTTP 404**. This URL is indexed by web text search, but an indexed/cached extract is not reproducible source bytes.
2. KICD's current [Grade Four Designs](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/) page explicitly embeds its Mathematics section as `https://drive.google.com/file/d/1o5tDq16yC0Jj1h6zb9mo3dsxtjqXUk4G/preview`. This is KICD-owned source navigation, but neither the file's bytes nor equivalence to the historical URL has been independently proven.
3. CI job `43642392020` attempted `https://drive.google.com/uc?export=download&id=1o5tDq16yC0Jj1h6zb9mo3dsxtjqXUk4G`; the response did **not** begin with the required PDF signature. The read-only validation failed closed with `SOURCE_IDENTITY_BLOCKED`, not a fabricated SHA-256. The Google Drive response may be an HTML viewer, a permission challenge or another document; **its cause is not yet verified**, so do not assume byte equivalence.
4. The first attempt to change source origin had a Python syntax defect caught by CI; subsequent commits repaired that defect. The latest cited failed run is a genuine non-PDF response, not a Python syntax exception.

## Next legitimate authority pathway

- Read the canonical `supabase/functions/curriculum-authority-intake/index.ts` implementation, which already knows how to handle Google Drive previews and approved artifact-host redirects.
- Use an authenticated existing intake call for **the exact KICD-linked Drive preview**, with the current source edition and regular-primary audience, then verify immutable actual bytes, digest, observed pages and hierarchy. Do not use a guessed SHA-256 or replace the regular curriculum with its separate physical-impairment-adapted Grade 4 design.
- The user owns VibeSchool but ownership as chat text is not a platform-owner JWT. Do not impersonate that credential or bypass source approval. The source gate is truly blocked with this connector-only session.
- Continue independent maths/pedagogy checks of already drafted packages in parallel; do not mistake green GitHub editorial CI for a certified, learner-visible canonical resource.

**Evidence labels**: `PUBLIC_SOURCE_TEXT_OBSERVED`; `KICD_LINKED_DRIVE_PREVIEW_IDENTIFIED`; `PDF_BYTES_UNAVAILABLE`; `SHA256_UNAVAILABLE`; `CANONICAL_APPROVAL_NOT_PERFORMED`; `PUBLISH_BLOCKED`.

No copyrighted PDF was uploaded to GitHub. No source registry, curriculum outcome, resource, exam or learner data was mutated.

## 15 November continuation — exact existing intake parity and tested boundary

The source-download script was changed to use the **same direct Google Drive usercontent URL form** as VibeSchool's existing `curriculum-authority-intake/index.ts` (commit `694ddc52`). GitHub Actions run `43642726447` retrieved `text/html`, **1,820 bytes**, not `%PDF-`; it exited 4 with `SOURCE_NOT_PDF` and did not calculate a false PDF hash. This is direct evidence that direct-download transport is not usable from this CI runner.

The *existing* Edge Function has a supported fallback, `fetchGoogleDriveViewerEvidence()`, that obtains the Drive viewer manifest, page count, and individually hashed PNG pages and stores a separate `google_drive_viewer_page_bundle_v1` artifact. That artifact is **not byte-identical to the original PDF**; the Edge Function already records `source_byte_identical: false` for a viewer bundle. This functionality requires a real, previously approved source ID and an authenticated platform-owner request. It cannot be replaced by a public CI download or a service-role SQL mutation.

**Recovery is now narrow and verified:** use the existing owner-authenticated source intake on the exact KICD-catalogue-linked `/file/d/…/preview` URL, let the canonical function handle non-PDF transport through its viewer fallback, and retain the correct evidence-kind distinction. Do not add another downloader, scraper, independent curriculum-authority table, or falsely green source proof. Source approval and snapshot promotion remain separate protected actions.

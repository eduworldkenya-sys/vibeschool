# VibeSchool Visual Learning Library — Canonical Asset Contract

**Purpose:** Create and reuse diagrams, images, illustrations, charts, maps, fraction models, number lines and instructional visuals across the same canonical content and lesson tools. Avoid hardcoded lesson-specific image URLs or competing media registries.

## Architecture

- **Identity:** `public.learning_resources`, using `asset_kind = 'visual_aid'`, `source_type = 'platform_authored'`, stable `canonical_key` and real `cbc_strands` curriculum linkage. No new asset identity table.
- **Version:** `public.learning_resource_versions` with an exact immutable candidate/certified payload. Capture alt text, caption, visual type, labels, intended placement, original curriculum sub-strand, and referenced file.
- **Image file:** existing **private** Supabase Storage bucket `vibe-publication-drafts`, under `visual-library/<uuid>.<png|jpg|webp|gif>`. Reuse VibeSchool's Supabase Storage, not an image repository in application code.
- **Public access:** `GET /api/visual-library/[id]` resolves only a resource with `asset_kind = visual_aid`, `status = active`, `visibility = public`, `owner_type = platform`, and a `certified` version. The server issues a short-lived signed image URL from the private bucket.
- **Authoring:** `/hq/content/visuals` via authenticated HQ API. Founder or active HQ member with `content.approve` can **save a private candidate**, not certify one. Every request revalidates the user token server-side. Source selection uses the existing global-subject `cbc_strands` map, which works without a previously published `learning_resources` wrapper.
- **Learner / teacher browse:** `/learn/visuals` shows certified public visuals only; the Teacher Teaching Library links there.
- **Lesson embedding:** put `[visual:<canonical-resource-uuid>]` in a certified lesson body. `VisualRichText` resolves that token through the public certified-only endpoint, so the **same image can appear in several lessons** without copying file paths or uploading a duplicate.
- **Education linkage:** grade, global subject, actual `cbc_strands.id`, topic key, purpose, placement and intended labels. A visual is a **resource**, not an alternative curriculum authority.

## Visual-production workflow

1. **Outcome and instruction:** decide whether the learner benefits from a visual; no compulsory visuals for every lesson.
2. **Brief:** identify type, educational purpose, exact visible features, labels, caption, alt description and where it is used (explanation, worked example, activity, exercise, assessment or Teacher Guide).
3. **Create and upload:** generate/draw or source a suitable PNG/JPG/WebP/GIF, up to 5 MB. On the HQ page select the real grade/subject/sub-strand, enter metadata, upload to private draft storage. **A brief is not a completed image.**
4. **Check and correct:** check subject accuracy, clarity, legibility, correct labels, age suitability and meaningful accessibility description. Fix material weaknesses.
5. **Existing certification:** pass the relevant Content Engine quality/release process. HQ upload **does not approve or publish**. Promotion requires the existing authorized pipeline to establish a certified version and suitable public root state. Do not manufacture `certification_evidence` or bypass immutable-version rules.
6. **Reuse:** link the canonical ID via `[visual:UUID]` in an eligible certified lesson. Use the same ID in notes, teacher guidance, practice or another lesson where it helps the same learning purpose.
7. **Verify:** check the actual reading surface, image rendering, alt text and captions, empty/unavailable states and small mobile screens. A merged Git PR proves only repository code status, not image uploads or live publication.

## Data contract

Version payload shape:

```json
{
  "schema": "vibeschool.visual.v1",
  "visual_type": "fraction_model",
  "alt_text": "Three equally sized rectangles showing one half, two quarters and four eighths shaded.",
  "caption": "These fractions represent equal parts of the same whole.",
  "labels": ["1/2", "2/4", "4/8"],
  "placements": ["worked_example"],
  "topic_key": "equivalent-fractions",
  "source_strand_id": "<existing cbc_strands UUID>",
  "storage": {
    "bucket": "vibe-publication-drafts",
    "path": "visual-library/<unique-uuid>.png",
    "mime": "image/png",
    "bytes": 12000
  }
}
```

These placeholder IDs and bytes are an **example of structure**, not a statement that a visual has been uploaded.

## Security and failure cases

- Private drafts never appear in public list/lookup APIs. Images are in private storage; HQ gets temporary signed previews.
- Public lookup checks **both** root visibility and certified version, not a user-supplied `published=true` flag.
- HQ uploads require a verified bearer session and content permission; the service-role key is server-only.
- Accept recognized PNG, JPEG, GIF or WebP **file signatures**, and verify they match the declared MIME. Reject SVG/HTML uploads and files above 5 MB. Never use a user-supplied storage path.
- A deterministic canonical key rejects duplicate asset identities. A partial upload is compensated by removing its draft object and incomplete resource root.
- Empty grades and unavailable assets show clear user-facing states.
- Keep the original `learning_resources` RLS and immutable certified-version protections. No auto-publishing trigger or separate visual-certification authority.

## Rollout / evidence boundaries

1. Merge code and additive `visual_aid` constraint migration only after required exact-head checks pass.
2. Apply the tracked database migration through VibeSchool's governed deployment route; do **not** change production database ad hoc to make a screen look live.
3. Verify the HQ screen with a real authorized session and upload a test image against a mapped CBC sub-strand. Check duplicate, invalid MIME/size, failed upload cleanup and tenant-permission denial.
4. Verify drafts stay private and public galleries stay empty until governed certification, then verify a genuinely certified sample on the learner reader with a `[visual:UUID]` token.
5. Record post-deployment test results separately; never claim the release process or image publishing works merely from a successful build.

This design implements the [Content Production Standard](./CONTENT_PRODUCTION_STANDARD.md) and [ChatGPT-Led Operating Model](./CONTENT_OPERATING_MODEL.md), reusing the existing canonical learning asset architecture.

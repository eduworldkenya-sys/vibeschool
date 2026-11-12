# VibeSchool Visual Learning Library — Canonical Asset Contract

**Start-here educational workflow:** [Single Canonical Content Generation Playbook](./CONTENT_GENERATION.md) governs when to inspect, reuse, create and verify a visual during one outcome-production pass. **This document remains the technical authority** for actual visual identity, private storage, versioning, access, release and certified reader references; the playbook does not grant upload, publishing or certification capabilities.

**Purpose:** Create and reuse diagrams, images, illustrations, charts, maps, fraction models, number lines and instructional visuals across the same canonical content and lesson tools. Avoid hardcoded lesson-specific image URLs or competing media registries.

## Architecture

- **Identity:** `public.learning_resources`, using `asset_kind = 'visual_aid'`, `source_type = 'platform_authored'`, stable `canonical_key` and real `cbc_strands` curriculum linkage. No new asset identity table.
- **Version:** `public.learning_resource_versions` with an exact immutable candidate/certified payload. Capture alt text, caption, visual type, labels, intended placement, original curriculum sub-strand, and referenced file.
- **Image file:** existing **private** Supabase Storage bucket `vibe-publication-drafts`, under `visual-library/<uuid>.<png|jpg|webp|gif>`. Reuse VibeSchool's Supabase Storage, not an image repository in application code.
- **Public access:** `GET /api/visual-library/[id]` resolves only a resource with `asset_kind = visual_aid`, `status = active`, `visibility = public`, `owner_type = platform`, and a `certified` version. The server issues a short-lived signed image URL from the private bucket.
- **Primary production operator — ChatGPT:** The owner requests a grade, subject or lesson **in conversation**. ChatGPT handles visual specification, creation when image tools are available, metadata, curriculum linkage, integration and verification using connected tools that actually support each operation. The owner is **not** expected to operate HQ manually. This is an interactive, tool-limited workflow, not a permanent background workforce or automatic grant of publishing power.
- **Optional administrative UI:** `/hq/content/visuals` remains for authenticated HQ staff; it is not a prerequisite to ChatGPT-led educational production. The existing HQ API requires a verified session and content permission and currently saves **private candidates**, not certified materials. Do not bypass that authorization simply because the operator is ChatGPT.
- **Learner / teacher browse:** `/learn/visuals` shows certified public visuals only; the Teacher Teaching Library links there.
- **Lesson embedding:** put `[visual:<canonical-resource-uuid>]` in a certified lesson body. `VisualRichText` resolves that token through the public certified-only endpoint, so the **same image can appear in several lessons** without copying file paths or uploading a duplicate.
- **Education linkage:** grade, global subject, actual `cbc_strands.id`, topic key, purpose, placement and intended labels. A visual is a **resource**, not an alternative curriculum authority.

## Canonical operator decision — chat first, HQ optional (12 November 2026)

**VibeSchool is run by a solo owner. Routine visual production must not be gated by owner visits to HQ, uploads, menus, content forms or repeated approvals.** ChatGPT is the primary **interactive content-production assistant**, performing visual preparation and coordination in the owner's current conversation.

### What the chat owns for each requested subject or lesson

1. **Curriculum preflight:** verify the requested VibeSchool strand, sub-strand and outcomes against the current applicable KICD design. Repair mismatches through authorized canonical workflows first.
2. **Instructional visual selection:** decide which diagrams, photos, charts, number lines, illustrated procedures or models help learning; do not force images into every lesson.
3. **Create the deliverable:** write a precise brief and **produce the actual image where an image creation tool is available**. Check labels, mathematical/scientific accuracy, age suitability, legibility, alternative text and caption; correct defects.
4. **Use the canonical library:** inspect existing visual assets to reuse suitable IDs. Where a new asset is required, use an **available authenticated, audit-trailed upload/integration operation** against canonical `learning_resources` and `learning_resource_versions` identities. Store the image in VibeSchool storage and link the real curriculum sub-strand. No parallel tables, hardcoded lesson URLs or fabricated asset IDs.
5. **Verify actual state:** confirm the asset exists, its private draft is not publicly readable, release conditions are met and `[visual:UUID]` renders in the learner/teacher reader. Confirm the same ID can be reused without duplication.
6. **Report scope and blockers:** give completed asset references, linked learning outcomes, actual status and evidence; continue with requested content work. Do not hand routine HQ tasks back to the owner.

**Tool availability is not assumed:** In a chat without access to an authenticated **binary image upload/storage action**, ChatGPT can produce and check an image plus its complete visual manifest, but **must not claim it is stored, certified or live**. Record `ASSET_CREATED_NOT_STORED` and the exact missing connector/operation, or `VISUAL_PLANNED` if only a brief exists. The next technical task is to add or expose a scoped **operator-safe asset intake** through the existing authenticated infrastructure, not to require the owner to click HQ or weaken access controls. GitHub changes, Supabase schema tools and a generated chat image alone do not prove successful storage.

**Role of HQ:** optional dashboard and human fallback, not a prerequisite to creating educational content. Existing source-of-truth and release gates still govern final activation.

### Status vocabulary (use evidence, never aspiration)

| State | Evidence needed |
| --- | --- |
| `VISUAL_PLANNED` | Outcome-linked brief, type, purpose, labels and placement exist |
| `ASSET_CREATED_NOT_STORED` | Real image produced and checked, but no verified VibeSchool storage reference |
| `PRIVATE_CANDIDATE_STORED` | Actual private object, canonical resource ID and candidate version read back |
| `CONTENT_REVIEWED` | Required quality evidence and authorized review step completed |
| `RELEASED_CERTIFIED` | Certified version and public resource state verified through existing release authority |
| `LEARNER_VISIBLE` | Public reader renders the image, caption and accessible description |

The owner supplies the **educational priority**, not each operational click. This policy does not create a background bot, silently authorize publishing or assert the current chat can access every external platform action.

## Visual-production workflow

1. **Outcome and instruction:** decide whether the learner benefits from a visual; no compulsory visuals for every lesson.
2. **Brief:** identify type, educational purpose, exact visible features, labels, caption, alt description and where it is used (explanation, worked example, activity, exercise, assessment or Teacher Guide).
3. **Create and store through the chat-operated workflow:** generate/draw or obtain a suitable PNG/JPG/WebP/GIF, up to 5 MB. The ChatGPT operator supplies grade/subject/real CBC sub-strand and metadata through an actually available authenticated library integration. HQ entry is **optional**, not an owner obligation. Where binary upload capability is missing, report `ASSET_CREATED_NOT_STORED` and do not claim the image was uploaded. **A brief is not a completed image.**
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
3. Verify the **operator-accessible authenticated intake** where supported; the existing HQ screen is a separate optional UI test. Upload a test image against a mapped CBC sub-strand and check duplicates, invalid MIME/size, failed-upload cleanup and unauthorized access. If no connected upload action exists, mark this test blocked rather than assigning it to the owner.
4. Verify drafts stay private and public galleries stay empty until governed certification, then verify a genuinely certified sample on the learner reader with a `[visual:UUID]` token.
5. Record post-deployment test results separately; never claim the release process or image publishing works merely from a successful build.

This design implements the [Content Production Standard](./CONTENT_PRODUCTION_STANDARD.md) and [ChatGPT-Led Operating Model](./CONTENT_OPERATING_MODEL.md), reusing the existing canonical learning asset architecture.

## P1 implementation — scoped authenticated operator intake and version-pinned reuse

- **Operator upload:** `POST /api/operator/visual-library` is a multipart candidate-only operation using `Authorization: Bearer <VIBESCHOOL_VISUAL_INTAKE_TOKEN>`. The token is a dedicated server-only secret of at least 32 unpredictable characters, configured via the deployment secret store; absent or invalid credentials fail closed. Do not use the Supabase service-role key as the operator bearer token or put this token in client code, issue comments or chat. HTTPS only.
- **Search before creating:** `GET /api/operator/visual-library?grade=4&sourceStrandId=<real-cbc-strands-id>&topicKey=time` returns **only active/public/certified** canonical visuals, with root ID, exact certified version ID, SHA-256 payload fingerprint, type, source context, labels, caption, alt text and available placements. No draft storage paths or private previews are exposed. Reuse these IDs before generating another visual.
- **Candidate request:** send `file` (PNG/JPEG/WebP/GIF, <=5MB, signature checked) with `title`, `topicKey`, `description`, `altText`, `caption`, comma-separated `labels`, `visualType` (including `clock_face`, `number_line` and `diagram`), `placement`, and verified `sourceStrandId`. Sub-strand is resolved against global curriculum/subject records. Include an `X-Request-Id` for traceability. A duplicate canonical key returns 409 with its existing root ID; it never silently overwrites.
- **Storage and audit:** the shared HQ/operator intake writes a private file under the existing draft bucket plus `learning_resources` and candidate `learning_resource_versions`; provenance captures human/operator origin, actual curriculum ID, actor when available, request ID and the image file SHA-256. Failed intake attempts compensate the draft object and incomplete root. Do not treat candidate creation as certified content.
- **Certified references:** the preferred token is `[visual:RESOURCE_UUID@CERTIFIED_VERSION_UUID]`. A legacy `[visual:RESOURCE_UUID]` still resolves the current certified version but is not exact-pinned. Both pass the existing public resource and certified-version check. The reader exposes the certified caption and alt text. Store the exact `resourceVersionId` alongside root ID in the outcome-package manifest, teacher lesson/resource link or other version-aware consumer as appropriate.
- **No new registry or release engine:** the operator capability deliberately cannot review, certify, activate public roots, retire, edit or delete assets. Promotion remains governed by the established release system. Material changes to labels, captions, alt text or the image require a new version and re-certification, not mutation of an immutable certified version.
- **Deployment gate:** this route remains unusable until the dedicated token is configured in the deployed server environment and deployment/migration are complete. Connector access to call the authenticated multipart endpoint must also exist before a ChatGPT chat can perform binary upload. Code merge alone does not prove live operator accessibility. Test 401/403, valid candidate write, duplicate idempotency, private read denial, certified lookup, pinned-reader success, wrong-version denial and expiry/retirement before announcing production completion.


# Teaching Library — Optional Canonical Resource Links

**Status:** Teacher OS presentation contract. No new canonical data authority, compulsory lesson checklist, database table, worker, or publication path.

## Educational rule

Every one of the 15 Teaching Library components is **optional**. A strand, sub-strand, outcome, Scheme lesson or lesson plan may have any subset of the types, including zero. Select components for their instructional value; do not fill missing types with placeholders, recycled questions or fabricated materials merely to show all categories as populated.

A missing optional component **must not** block curriculum browsing, Scheme preparation, Lesson Plan, Teach Mode, attendance, assessment creation or delivery.

## Where resources live

- `learning_resources` remains the canonical reusable resource root, with `learning_resource_versions` as its immutable version authority.
- `teaching_resource_links` is the canonical contextual link; `scheme_lesson_resource_links` remains an existing compatible bridge.
- `resources` remains the existing teacher-private, class-scoped supplementary library. It is not a replacement for canonical content.
- The Teacher OS `/teacher/resources` page is a **read-only discovery view** for canonical links plus the pre-existing create/manage surface for teacher-private resources.
- No content gets automatically published or validated by being listed in a Teaching Library slot.

## How components are linked

`lib/teaching/libraryStructure.ts` defines stable groups, slots, and `teachingLibrarySlotForResource`. The helper uses explicit canonical metadata only:

1. `learning_resources.material_variant` when it is an exact recognized type (e.g. `diagram`, `demonstration`, `experiment`, `discussion`, `educational_game`, `reflection`, `assignment`, `exam`).
2. Otherwise `asset_kind` for unambiguous types already supported in the canonical schema (`learner_notes`, `teacher_notes`, `worked_example`, `project`, `homework`, `quiz`, `revision`, `remedial`, `enrichment`).
3. Otherwise an explicit Scheme usage role (`homework`, `project_brief`, `revision_source`, `remedial`, `enrichment`), or a clearly remedial/enrichment purpose.
4. If none proves a component type, the resource stays in the existing Scheme section and is not counted against any type. **Titles, generic `assessment`, `worksheet`, `exercise`, `practical`, and untyped content blocks must not be guessed into a slot.**

A canonical item is shown only if the teacher is already authorized to load its Scheme link and the resource is `active` and `public`. The interface uses an existing chapter reader when possible or opens its Scheme context. The same resource can appear in several Scheme lessons without creating another canonical resource. The view suppresses duplicates per class/subject.

The Scheme view and teacher-saved resources are retained for material that cannot be categorized. A current instructional week or timetable occurrence is **not** required to discover linked resources; the separate `Ready this week` section still uses term/week context.

## Content production handoff

When publishing future original content, use the existing content-authoring and certification workflow, preserve actual outcome and version references, and set the correct `asset_kind` / `material_variant` for the component that is genuinely present. Avoid invented headings and `required: true` resource-count rules. Published or read-accessible status must be established by the existing release process, not by this UI.

A resource that lacks metadata may be reviewed and classified at its canonical source by an authorized content author; do not inject heuristic titles or write duplicate resources in Teacher OS.

## Verification

`npm run test:teaching-library` covers all 15 optional slots, category filtering, explicit known metadata, unknown kinds remaining unclassified, blank searches, and the two canonical Scheme bridge references. Existing `scripts/teacher-resource-os-contract.test.mjs` and full application checks must also continue to pass.

**Scope of this change:** linkage and non-blocking discovery, not automatically filling empty lesson components or publishing additional content.

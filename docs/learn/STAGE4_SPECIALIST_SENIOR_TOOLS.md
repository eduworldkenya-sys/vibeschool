# Stage 4 — Specialist Senior School Teaching Tools

**Decision (13 November 2026):** Register fourteen specialist families (the original six plus eight additional families) for incremental delivery. They are **planned, not active**. This change does not claim that a specialist simulator or coding runtime exists, nor does it commission any learner-facing product.

## Single architecture

`Curriculum Map → Scheme of Work (when relevant) → certified learning resource version → Universal Learn Reader → optional TeachingToolShelf → existing practice and assessment systems`.

- The canonical executable allowlist remains `TEACHING_TOOL_CATALOG` and `resolveTeachingTools` in `lib/learn/teachingToolCatalog.ts`.
- Planned families are recorded in `SPECIALIST_TOOL_ROADMAP` **inside that same module**, outside `TeachingToolId`. A planned ID cannot render, be selected by a topic, or be admitted as lesson-authored metadata.
- The existing `teachingToolContentBridge.mjs` must bind any future specialist data to an already-authorized, version-pinned resource and visible section. The reader must keep safe readable content when a specialist tool is absent or unsupported.
- Reuse the current visual library, subject models, lesson/scheme authority and assessment engine. No new store, duplicate renderer, marks, exam attempts, curriculum identity or automatic publication.
- Senior School is the primary future use case, **not an exclusive grade gate**: choose tools by verified outcome, suitability and content readiness, not grade labels alone.

## Delivery sequence

| Family ID | Priority | First useful experience | Reuse before new code | Required release evidence |
| --- | --- | --- | --- | --- |
| `business-records` | First | Learner enters an *authored fictional* transaction and checks an income/expense ledger, closing cash and arithmetic | `data-chart`, `writing-planner` | Accurate balancing, currency/units, realistic mistakes and accessible mobile controls; no real financial account data |
| `advanced-mathematics` | First | Explore a curriculum-verified function, table and plotted points with explained domain/range | `number-line`, `data-chart`, `unit-converter` | Precision, negative values, discontinuities and graph accessibility verified; no invented solutions |
| `coding-workspace` | Later | Read and edit lesson-authored code with explicit test cases | `practical-steps`, `evidence-notes` | Isolated execution or safe nonexecuting mode; time/memory/network restrictions; no arbitrary untrusted eval or credential access |
| `technical-simulations` | Later | Verified, bounded circuit/forces/design model with reset and stated assumptions | `visual-explorer`, `practical-steps` | Independently checked model and constraints, realistic limitations and physical-safety warnings; never imply a real-world safety certification |
| `advanced-science` | Later | Hypothesis, variables, labelled graph and modelled results from an approved investigation | `experiment-variables`, `data-chart`, `observation-journal` | Scientific correctness, measurement units, uncertainty, safe experiments, differentiated explanation, clear simulated-vs-observed distinction |
| `performance-interfaces` | Later | Follow a score/rubric, practise, and reflect on music, drama, movement or design | `audio-learning`, `drawing-pad`, `evidence-notes` | Accessible non-recording option, author-approved rubric, media consent/privacy and no unapproved recordings or scoring |

| `spreadsheet-data-lab` | First | An authorised dataset with tables, formula checks, statistics and labelled graphs | `data-chart`, `writing-planner` | Correct cell references, error feedback, rounding, negative and missing values; no spreadsheet macros or external data access |
| `geography-gis-explorer` | First | Maps, scales, coordinates, climate graphs and population patterns from approved geographic sources | `map-explorer`, `data-chart`, `visual-explorer` | Grounded map identity, provenance and projections; accessible alternative, no invented geographic precision |
| `agriculture-virtual-farm` | First | Plan a fictional farm, planting distances, crop cycles and yield calculations with real-world limitations | `observation-journal`, `data-chart`, `practical-steps` | Locally relevant agronomy, unit conversions, conditions and uncertainty; never present estimates as farm advice |
| `technical-drawing-studio` | Later | Guided scale drawings, angles, dimensions, accessible 2D plans and simple models | `drawing-pad`, `visual-explorer`, `unit-converter` | Precise scale/geometry checks, clear units, keyboard alternatives and no design-safety approval claim |
| `home-science-lab` | Later | Meal planning, food groups, quantities and household budget exercises | `unit-converter`, `practical-steps`, `observation-journal` | Age-appropriate inclusive nutrition, verified food safety and allergen context; no clinical dietary advice |
| `media-production-studio` | Later | Storyboarding, shot lists and authorised visual-sequence planning | `writing-planner`, `drawing-pad`, `visual-explorer` | Media provenance, permission for assets, privacy and no uncontrolled uploading or public publication |
| `language-debate-studio` | Later | Build an argument, prepare speeches and reflect using supplied criteria | `reading-comprehension`, `writing-planner`, `audio-learning` | Evidence quality, civil engagement, no compulsory voice capture and accessible text-only route |
| `community-project-portfolio` | First | Plan a project, track milestones and reflect on supplied evidence | `evidence-notes`, `practical-steps`, `timeline-explorer` | Consent for identifiable people, teacher/learner boundaries, no new storage or grading authority |

## Shared practical-learning components (one engine, no duplication)

The **Practical Learning Engine** is a composition pattern for the existing `UniversalLearnReader`, `TeachingToolShelf`, `TEACHING_TOOL_CATALOG` and `teachingToolContentBridge.mjs`, **not** a new service, database, runtime, permissions or publication mechanism.

Reuse the available bounded components for measurement and conversion, charts/tables, observations, drawing, guided steps, visual maps, timelines and evidence notes. New specialist components must use the same authorised lesson/version binding and explicitly validated input types. Content authors choose tools against the **actual** curriculum outcome and released content; no tool is auto-enabled from a subject name.

Release the highest-reuse designs first: existing business records and advanced mathematics, followed by spreadsheet/data, geography/GIS, agriculture and community-project portfolio. The other eight remain deferred until their approved content and safety tests are ready. Prioritisation applies to **design and curriculum readiness**, not automatic activation or a guarantee of implementation.

## Activation criteria (per tool, not per family)

1. Confirm the exact Senior School learning outcome, subject pathway and appropriately authorised content release. Missing or draft content **does not** enable a tool.
2. Add a versioned, subject-appropriate **active** ID to the existing `TEACHING_TOOL_CATALOG`, with bounded, sanitized, lesson-authored inputs in the existing resolver and content adapter. Do not convert a planned family ID into an active tool without this work.
3. Implement in the existing `TeachingToolShelf` with proper keyboard, touch, screen-reader, low-bandwidth and print/text fallbacks. Preserve the original lesson body and visuals under existing admission controls.
4. Test both correct and malicious/invalid inputs, wrong subject, missing version/outcome/content, stale bindings, mobile and teacher/independent/school learner journeys. For calculations, simulation and code, verify domain-specific numerical/scientific correctness and isolation.
5. Run `npm run test:outcome-delivery`, `npm run test:teaching-library`, `npm run typecheck`, `npm run build`, exact-head required PR CI and real reader smoke tests; merge only after the repository governance gates. Production and user-visible activation are separate checks.

## Non-goals of this registration

No executable code sandbox; no electronics or laboratory simulation; no camera/microphone collection; no learner transaction persistence; no assessment/grades; no automatic tool exposure; no schema migration; no runtime commissioning. Stage 1–3 learning tools and Grade 4 Time must behave exactly as before.

**Operating rule:** Finish the common reader, broad Mathematics/Languages/Science and practical early-years tooling before full Senior School specialist development. Business records and advanced mathematics remain first design-and-content candidates, with spreadsheet/data, geography/GIS, agriculture and community projects added to the priority group. All fourteen specialist families remain inactive.

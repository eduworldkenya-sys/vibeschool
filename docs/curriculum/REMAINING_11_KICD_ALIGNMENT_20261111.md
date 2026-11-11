# Remaining 11 KICD curriculum maps — reconciliation evidence

**Date:** 11 November 2026  
**Authority:** Kenya Institute of Curriculum Development (KICD), revised 2024 curriculum designs  
**Scope:** Grade 4 (4 subjects), Grade 6 (3), Grade 8 (3), Grade 9 English (1)  
**Machine-readable record:** [kicd-remaining-maps-audit.json](../../content/curriculum/kicd-remaining-maps-audit.json)  
**Canonical learning-content policy:** [CONTENT_PRODUCTION_STANDARD.md](./CONTENT_PRODUCTION_STANDARD.md) and [CONTENT_PACKAGE_TEMPLATE.md](./CONTENT_PACKAGE_TEMPLATE.md)

## Verified facts versus unverified claims

**Source-structural verification is not specific-outcome verification.** KICD source listings, themes, sub-strand codes and suggested lesson counts can be checked without establishing that independently written VibeSchool learning outcomes convey every specific KICD learning requirement. The database's `creator_claimed` source type is correct for existing authored material. None of these 11 subjects is entitled to `official`/`verified` outcomes merely by having a source URL.

| Grade | Subject | Existing curriculum source scope | KICD outcome verification |
| --- | --- | --- | --- |
| 4 | Mathematics | 19 planning units, 150 lesson suggestions, 110 VibeSchool outcome formulations | Pending per-outcome source crosswalk |
| 4 | English | 13 themes, 52 planning units, 156 authored outcomes | Pending theme-and-skill outcome crosswalk |
| 4 | Kiswahili | 11 themes, 52 structural topics; no separately authored canonical outcome set in this index | **Index only**; 120 printed vs 121 itemised source periods unresolved |
| 4 | Indigenous Languages | 9 themes, 27 source-themed units + 1 VibeSchool cross-strand showcase; 84 authored outcomes | Pending source and competent local-language alignment |
| 6 | Mathematics | **Official KICD p. xii:** 16 sub-strands, 150 suggested lessons. Existing 97 original outcomes | **Structure cross-checked**; outcomes not certified |
| 6 | English | 13 themes, 10 recurring skills, 42 original outcomes | Pending theme-specific outcome crosswalk |
| 6 | Kiswahili | 53 source-index units, 159 original outcomes; 115 itemised source periods + 5 explicit VibeSchool review periods | **Source discrepancy preserved**; outcomes not certified |
| 8 | Mathematics | **Official KICD p. x:** 16 sub-strands, 150 suggested lessons; 75 original outcomes | **Structure cross-checked**; outcomes not certified |
| 8 | English | 15 themes, 75 planned skill units, 150 original outcomes | Pending outcome and focus reconciliation |
| 8 | Kiswahili | **Official KICD pp. xvi–xx:** 60 topic headings, 120 source-indexed lessons | **Index only**; no verified outcome set |
| 9 | English | 15 themes, 75 indexed skills, 150 suggested lessons | **Index only**; no verified outcome set |

## Confirmed adjustments in this change

1. **Grade 8 Mathematics, 5.1:** the revised KICD summary says **Data Presentation and Interpretation**, not **Data Representation and Interpretation**. Correct the canonical reader catalogue and update the same persisted `cbc_strands` identity in place using a migration. Keep the stable binding ID, outcome IDs, teacher scheme ownership and history intact.
2. **Grade 6 Kiswahili:** the source index totals **115** individual lessons although the published aggregate states **120**. VibeSchool's existing five review periods remain *optional VibeSchool supplementary planning*, not five new KICD outcomes or official topic allocations. Mark each of those five individual draft lessons explicitly.
3. **Grade 4 Indigenous Languages:** the 6-lesson cross-strand **showcase** is a VibeSchool planning supplement, not a KICD fourth strand or a KICD-named outcome. Mark the six individual draft lessons explicitly.
4. Add automated source-structure and supplementary-pacing regression tests for all eleven maps. A test passing proves the catalogue matches the asserted structural contract, **not** that each authored outcome has been compared with KICD's source page.

## Source-by-source material still required for full alignment

For **each source sub-strand**: record KICD revision and locator (section and page); individually compare **every specific learning outcome** against the corresponding VibeSchool outcome; identify missing or extraneous concepts, age/grade scope, skill progression, experiences and assessment intent; correct the original VibeSchool outcome as necessary; run Scheme-to-Lesson Plan and learner read-back checks.

For **English**, repeat per theme rather than trusting a single generic listening/reading/writing skill description across the year. For **Kiswahili**, distinguish actual KICD requirements from headings and explicitly resolve printed-sum discrepancies without inventing official lesson allocations. For **Indigenous Languages**, original pedagogy must also be checked for the selected Kenyan language's orthography, forms and fluent usage.

Record each outcome's **source page/section and coverage disposition** in a canonical package ledger. Only when the source-to-outcome inventory is complete, the discrepancies are resolved and evidence is in the repository may the subject be promoted from *structural reference* to *outcome-verified*. This must be done by the content production team/assistant, not by asking the owner to manually check hundreds of outcomes. No new Cyborg pipeline, owner sign-off ceremony or alternative content store is needed.

## Preservation and release boundaries

- Do **not** rewrite existing teacher-owned Schemes or Lesson Plans when a global curriculum title changes.
- Keep curriculum and school calendar separate. A suggested annual allocation is not a school-specific timetable.
- Unverified curriculum maps may remain readable as **KICD-referenced VibeSchool drafts**, but never imply full official outcome certification.
- The structural audit and source-name migration do not publish new certified learner content.

## Primary KICD sources

- [Grade 6 Mathematics revised 2024](https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-6-Mathematics-Revised.pdf), summary p. xii.
- [Grade 8 Mathematics revised 2024](https://kicd.ac.ke/wp-content/uploads/2024/06/Mathematics-Grade-8-Design-Formatted-April-2024.pdf), summary p. x.
- [Grade 8 Kiswahili revised 2024](https://kicd.ac.ke/wp-content/uploads/2024/09/GRADE-8-KISWAHILI.pdf), summary pp. xvi–xx.
- All other primary-source links are recorded in the [machine-readable audit manifest](../../content/curriculum/kicd-remaining-maps-audit.json).

**Completion status:** Source-structural audit and identified corrections only; full source-to-outcome reconciliation of all 11 remains **open**. Do not report this as 11 verified subjects.

# Grade 4 Mathematics — one-source / ten-outcome protected authority handoff

**14 November 2026 · READ-ONLY SOURCE-OBSERVATION CANDIDATE.**

## Action completed

1. Independently inspected publicly exposed text of KICD's *Grade 4 Mathematics Curriculum Design*, revised 2024, https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf (64 PDF pages). Printed pp. 4–5 (PDF indices 12–13) contain Numbers 1.2 Addition outcomes (a–e) and eight suggested lessons. Printed pp. 6–7 (PDF indices 14–15) contain Numbers 1.3 Subtraction outcomes (a–e) and eight suggested lessons.
2. Built the 10-entry, original-paraphrase crosswalk `content/curriculum/production/grade4-math-numbers-source-crosswalk.v1.observed.json`, linking all 16 proposed editorial lesson IDs exactly once. The document deliberately does **not** invent a promoted outcome UUID, PDF content SHA, source ID or approval state.
3. Added deterministic `scripts/test-grade4-math-source-observation-crosswalk.mjs` and a scoped PR CI workflow. Added `scripts/sql/g4_math_official_source_readonly_preflight.sql` for repeatable production truth checks without any write.
4. Read current production Supabase on this date: **0** registered Grade 4 Mathematics sources, **0** promoted snapshots, **0** officially verified outcomes in the checked curriculum chain; **12** active/public Mathematics resources for other scopes. These numbers are a live snapshot, not permanent truth.
5. Reviewed `docs/curriculum/OUTCOME_PACKAGE_ASSEMBLY_CONTRACT.md`: actual canonical package manifests require real outcome UUIDs, exact certified resource-version IDs, source gate pass and a trusted package audit. The editorial crosswalk is **not** a package manifest and is never learner-visible by itself.

## Single source → many outcomes

`KICD 2024 Grade 4 Mathematics PDF → authenticated source registration → private artifact SHA-256 retention → one snapshot with the ten source observations → source/hierarchy reconciliation → authenticated owner promotion → real curriculum IDs → existing learning_resources / versions → independent QA → authorised publication → learner readback.`

This does not invent another content library, another assessment engine, an HQ bypass, or an automated privileged approval endpoint. The source and the real 10 outcome IDs may be reused by the addition and subtraction manuscript branches after the legitimate gate succeeds.

## What remains truly blocked

The existing `supabase/functions/curriculum-authority-intake/index.ts` permits source artifact fetch under tightly allowlisted hosts, but registering the authority and promoting outcomes require an authenticated platform owner. The connected Supabase SQL interface can read schema but **must not impersonate the authenticated operator**. Even a real source-observation crosswalk alone is not independent curriculum certification.

Further release work: review editorial mathematics and diagrams independently, map exact outcomes to immutable candidate versions and approved question IDs, apply `cla_audit_outcome_package` with trusted service context, certify through the established contract, and verify Learn/Practice/Feedback/Revision/Progress with an authenticated learner session.

## Candidate PR lineage

- **#1698** Addition 1.2(a)
- **#1693** Addition 1.2(b–e) plus 4 draft SVG aids
- **#1694** Subtraction 1.3(a–e)
- **#1701** 16-lesson editorial sequence

All are distinct editorial candidates. Merging an editorial file is not authorization to publish and does not make it a certified resource.

## Source limitations

The KICD official PDF text was returned through the publicly accessible PDF page. Web screenshot attempts failed with cache misses, and a separate download of source PDF bytes failed. **No independent page-image inspection, immutable source SHA-256, source artifact upload, or official promotion was claimed.** Preserve these limits in future chat handoffs.

## Important source edition safeguard (verified 14 November 2026)

KICD also hosts `https://kicd.ac.ke/wp-content/uploads/2024/09/GRADE-4-MATHEMATICS.pdf`, which is **Mathematics Grade 4 for learners with physical impairment**, revised 2024. That is an **adapted curriculum design**, not the same authority as the regular Grade 4 Mathematics source used for these generic learner packages (`https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf`). Both say “Grade 4 Mathematics” and “Revised 2024”, so name/year-only matching would be unsafe. The adapted design has a different strand organisation and needs its own scope/authority reconciliation if VibeSchool chooses to produce adapted content. Do not assume the adapted source is invalid or less important; it is simply distinct.

The crosswalk now pins the expected audience and excludes that separate KICD URL for the regular-grade batch. The deterministic test fails if the audience distinction or explicit adapted-source exclusion disappears. Official KICD source texts inspected; neither PDF's bytes nor immutable source SHA-256 were downloaded or registered during this audit, so source approval remains blocked.

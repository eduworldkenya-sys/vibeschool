# Content-as-Code — canonical source-to-version preflight

Whole Numbers is the pilot for the existing editor and release architecture. The versioned editorial JSON is the authored source, not a bypass or frontend bundle. The manifest identifies the exact source blob, resource IDs, sub-strand, expected outcome and version counts. The compiler projects the existing six private canonical component payloads and emits an optional **read-only** SQL readback.

```sh
node --test scripts/test-content-as-code.mjs
node scripts/compile-content-as-code.mjs content/curriculum/production/grade4-mathematics-whole-numbers-1.1.content-manifest.json --sql
```

Execute the generated SQL only in authorized database tooling. It checks the exact stored JSONB plus PostgreSQL SHA-256 and exact version IDs. It cannot certify source, authorize release or return a live learner view. Never publish generated SQL or protected answer payloads to the browser. Existing canonical storage, curriculum authority, package gates, proof of rights, independent verification and protected release mechanism remain mandatory. The next integration is #1840; do not create a second publisher or automatic bypass. Source capture remains incomplete: the official Grade 4 page identifies a Google viewer as an alternate delivery location, but its artifact equivalence to the already cited February 2024 regular PDF is not yet verified. September 2024 physical-impairment design is a different source.

Evidence 20 Nov 2026: all six v2 stored payloads matched their exact source-projected JSONB and recomputed database hashes in live read-only SQL. All remain private candidates with rights pending, not learner-visible. The manifest pins these exact existing rows; do not make new duplicates.

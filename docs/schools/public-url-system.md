School URLs: PR 1096

All active canonical schools and open national directory records receive persistent, unique slugs tied to exact source UUIDs. Name collisions receive county and then full identity suffixes. Names changing do not rename URLs. New records are allocated automatically. This does not merge or verify directory identities.

Reviewed requested URLs:
- gilgiltownship -> canonical c51ec2ae-5b70-4f69-887d-54eb9f312db7, Gilgil Township, Nakuru/Gilgil.
- municipality-mariakani-primary -> directory 3bdac02b-99cb-4342-a969-3a060300858e, 2005 Municipality Mariakani Pri Sch, Laikipia. Historical identity cross-check: https://shulezote.co.ke/school/2005-municipality-mariakani-pri-sch/ and https://primaryschool.co.ke/laikipia/nyahururu/laikipia-west/2005-municipality-mariakani-10171/. Not the Kilifi or Nairobi Mariakani schools. Current verification status remains unchanged.
- Reviewed Gilgil aliases: directory 88d921f6-2be1-4abb-ab1b-af82283f07a9 (same name, county, subcounty and primary level) and a8c3cce5-21f1-4594-8684-7a175a74fb56 (historical primary name, county, coordinates matching https://data.afro.co.ke/schools/gilgil-township-pri-sch/). Special unit remains separate.

Old /schools/UUID, /schools/UUID/section and /schools/directory/UUID links redirect permanently; directory links no longer depend on a name query parameter. Unknown schools and sections return 404. Lookup outages raise a retryable error instead of inventing a 404. Canonical metadata follows each individual school URL.

Production database coverage after allocation: 28,865 URLs, 2 reviewed aliases, zero missing canonical records, zero missing directory records, zero duplicate slugs. No original school records, claims, verification status, tenant grants or existing RPCs were modified.

Security: registry RLS enabled with no public table grants/policies. Only bounded read RPCs exposed; allocator, trigger helper and private projection cannot be executed by anonymous/authenticated callers. No service credentials used by rendering.

Rollback: restore prior application deployment; leave additive URL registry, public read functions and allocation triggers intact so newly shared links are not reassigned. Do not delete registry rows or reallocate existing slugs. Identity corrections require a reviewed forward migration, preserving old slug aliases rather than matching names at runtime.

Regression: scripts/test-school-urls.mjs reconstructs all three additive migrations in isolated PostgreSQL, covering exact source mapping, collisions, stable renames, automatic allocation, inactive/unknown records, multiple selectors, anonymous RPC access and denied registry/allocator access. A permissive negative control proves permission regression detection. scripts/schools-public-browser-smoke.cjs tests 320/360/390/412/768/1280 widths, search-to-profile, section navigation, Mariakani location, legacy links and 404s. CI tests the candidate locally against public read-only production data; run the same browser script with VIBESCHOOL_ORIGIN=https://vibeschool.co.ke for final production certification.

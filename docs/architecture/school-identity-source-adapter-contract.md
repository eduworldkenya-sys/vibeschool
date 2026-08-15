# School Identity Source Adapter Contract

Every external school dataset must be ingested through a source adapter with:

- stable `source_name`
- snapshot timestamp/label
- source record identifier when available
- raw source name
- normalized identity name
- county/sub-county
- school level/type
- latitude/longitude when available
- KNEC/NEMIS/MOE identifiers when available
- source URL/provenance
- source authority tier

Adapters are discovery inputs. They must not write directly to the trusted `schools` table. Reconciliation owns promotion.

## Idempotency
A repeated snapshot of the same source record must resolve to the same candidate identity rather than creating duplicate candidates.

## Authority
Adapters preserve the source's authority tier. A lower-tier source can increase discovery coverage but cannot overwrite a higher-authority canonical attribute without an explicit reconciliation decision.

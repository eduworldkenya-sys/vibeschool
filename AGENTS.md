# VibeSchool Agent Entry Rules

## Mandatory engine-system specification

Before any AI agent, automation, developer, or other actor interacts with autonomous engines, workers, departments, authority registries, provisioning, Governance, or HQ control-plane design, it MUST read:

**`docs/ENGINES.md`**

`docs/ENGINES.md` is the authoritative specification for the VibeSchool Autonomous Organisation engine system. Proposals affecting engine authority, identity, provisioning, worker lifecycle, lanes, governance, telemetry, recovery, privacy, economics, or Principal control MUST cite the applicable sections of that document.

### Specification-first rule

No actor may treat implementation capability as constitutional authority. If code, configuration, or an existing operational behaviour conflicts with `docs/ENGINES.md`, the conflict MUST be surfaced and resolved through the document's change-governance process before authority is expanded or silently altered.

### Current phase

This branch is **specification-only**. Do not introduce production engine implementation, autonomous provisioning, authority changes, or production control-plane behaviour until the maturity gates in `docs/ENGINES.md` have been reviewed and approved.

# Cyborg secret isolation boundary

Production invariant:

1. `CYBORG_CAPABILITY_SECRET` is available only to Cyborg gateway execution surfaces and must be at least 32 characters.
2. Provider credentials (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, Google model credentials) are available only to approved Cyborg provider adapters/gateway surfaces.
3. Client bundles, generic API routes, workers, schedulers and browser code must not receive provider credentials.
4. Provider invocation without a signed mission/provider/model-bound capability fails closed.
5. Every capability JTI is claimed exactly once in `cyborg_model_invocations`; replay fails closed.

Deployment secret relocation is an operational configuration step and must be verified independently after code merge. Never copy provider secrets into repository files, logs, CI output or lineage rows.

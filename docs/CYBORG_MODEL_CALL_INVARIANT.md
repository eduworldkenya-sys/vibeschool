# No Cyborg = no model call

A VibeSchool model invocation is valid only when all are true: a mission id exists; a short-lived signed capability is bound to that mission/provider/model; its JTI is atomically claimed once in persistent lineage; provider execution occurs only after the claim; completion is recorded; and CI detects direct provider surfaces outside approved Cyborg gateways.

Responses should expose the mission id and capability JTI where appropriate so operational evidence can trace `conversation -> mission -> capability -> model invocation`.

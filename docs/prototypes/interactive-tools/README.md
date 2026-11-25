# Interactive Teaching Tools Studio — prototype

Tracks #2107. Open studio.html locally in a browser. This is a non-production design and interaction reference containing all 167 catalogue entries, not a new classroom or runtime. Do not expose this file as a public app route or claim full educational fidelity.

Previous local smoke testing: 167 tools at each of 360, 768 and 1280 CSS pixels (501 checks), plus five direct interaction/navigation tests. These are prior local prototype results, not exact-head repository CI. Direct manipulation has been tested for ruler, clock and counters; complex tools including maps, anatomy, chemistry and simulations remain simplified. The prototype is not synchronized with live lessons or persisted, and has no classroom role authorization.

Integration must extend existing LiveSlideProtocol, LiveAdjustableDiagram, shared Teaching Kit, existing authorized classroom state and server payload validators. Reuse existing Learn tools instead of duplication. Require per-tool correctness, touchscreen/keyboard accessibility, teacher/learner isolation, late join/reconnect, responsive device tests, exact-head CI and post-merge verification. No database or deployment changes are included here.

The local checkout was blocked by DNS; this draft preserves source through the GitHub connector, but governed mission execution/scope lease and full verification remain outstanding. Keep this PR draft until native integration and all applicable gates are satisfied.

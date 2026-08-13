# Mission 243 — Batch 5 Reader Authority Evidence

## E-019 — Direct content-block bypass

**Finding:** Production policy `content_blocks_public_read` allowed `{anon,authenticated}` to SELECT any block where the block and parent publication were published. The canonical public reader RPC, however, explicitly sanitizes blocks and applies paid/freemium chapter rules. Direct table access therefore bypassed the reader's authority layer.

The underlying content-block migration also explicitly granted `SELECT` to `anon`.

**Impact:** A direct public table query could bypass `reader_sanitize_blocks()`, teacher-only block handling, and the freemium chapter-body decision.

**Repair:** `20260813060000_p1_reader_content_block_authority_hardening.sql` drops the public-read policy and revokes direct anonymous SELECT. No replacement public table-read policy is created. The public reader RPC remains the canonical public content path.

**Acceptance test:** anonymous direct `content_blocks` read is denied; published public reading succeeds through `get_public_vibetextbook_reader()`; author workflows retain their existing authenticated author policy.

**Status:** VERIFYING — migration prepared and committed; production execution and runtime HTTP verification remain P8/P9 gates.

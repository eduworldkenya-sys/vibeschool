---
name: vibeschool-test-the-test
description: Prove new VibeSchool regression tests actually detect the failure they claim to protect.
---
# Test the Test
For each new or materially changed regression test, use a safe negative control, failing fixture, mutation or equivalent demonstration that the test fails when the protected behavior is broken. Reject decorative tests that remain green under the defect. Restore the correct implementation and prove the same test passes. Keep the proof scoped and non-destructive.

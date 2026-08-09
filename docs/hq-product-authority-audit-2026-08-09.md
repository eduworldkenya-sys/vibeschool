// HQ product authority integration audit — 2026-08-09
// Enforced product boundaries in this batch:
// 1. Student / Twin: twin.enabled and student.free_daily_twin_sessions are enforced server-side by student_consume_twin_session(text) and twin-chat.
// 2. VibeBooks / VibeLearn publication: publication.release_enabled is enforced inside publish_publication() / publish_textbook().
// Registered but not yet tied to a live mutable business boundary because no safe existing command was identified in this audit:
// - platform.maintenance_mode
// - vibelabs.enabled
// Teacher, Parent, School Admin and Billing currently have no registered policy in hq_policy_registry requiring migration in this batch. They remain outside HQ authority until a concrete business policy is registered and a real enforcement point is identified.
// Rule: do not invent a policy or add UI-only enforcement merely to claim coverage.

#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DELIVERY = (ROOT / 'lib/teaching/lessonDelivery.ts').read_text(encoding='utf-8')
PARENT = (ROOT / 'lib/teaching/lessonParentDelivery.ts').read_text(encoding='utf-8')
MIGRATION = (ROOT / 'supabase/migrations/20260903233000_lesson_plan_delivery_state_hardening.sql').read_text(encoding='utf-8')


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)
    print(f'PASS: {message}')


def main() -> int:
    require('class LessonDeliveryError' in DELIVERY, 'delivery exposes structured errors')
    require("'not_ready'" in DELIVERY and 'readiness.reasons' in DELIVERY, 'readiness blockers remain structured')
    require('lessonDeliveryErrorMessage' in DELIVERY, 'teacher-facing delivery message mapper exists')
    require("'publish_lesson_plan_to_students'" in DELIVERY, 'learner publication uses atomic RPC')
    require(".from('notifications')" not in DELIVERY, 'client no longer performs partial notification write')
    require('recipientCount' in DELIVERY, 'delivery returns recipient counts')
    require("'no_parent_recipients'" in DELIVERY, 'zero-parent outcome is explicit failure')
    require('deliveryResult.shared' in DELIVERY, 'parent share checks durable shared outcome')
    require('shared: boolean' in PARENT, 'parent RPC result exposes shared truth')
    require("raw.shared !== (recipientCount > 0)" in PARENT, 'parent result rejects inconsistent shared claims')

    require('add column if not exists parent_shared_at timestamptz' in MIGRATION, 'parent sharing has independent durable timestamp')
    require('student_recipient_count integer not null default 0' in MIGRATION, 'learner delivery count is durable')
    require('parent_recipient_count integer not null default 0' in MIGRATION, 'parent delivery count is durable')
    require('lesson_plan_guard_delivery_transition' in MIGRATION, 'delivered plans cannot silently revert to draft')
    require('lesson_plan_delivery_status_only_draft_rollback_denied' in MIGRATION, 'status-only rollback is denied')
    require('new.body is not distinct from old.body' in MIGRATION, 'real content revision is distinguished from status rollback')
    require('new.parent_shared_at := null' in MIGRATION, 'revision clears stale parent delivery evidence')
    require('publish_lesson_plan_to_students' in MIGRATION, 'database owns learner publication transaction')
    require('for update;' in MIGRATION, 'delivery locks exact lesson row while mutating consequences')
    require('from public.student_classes sc' in MIGRATION, 'recipient resolution uses canonical enrollment')
    require('sc.is_current = true' in MIGRATION, 'recipient resolution excludes historical enrollment')
    require("on conflict (user_id, type, related_id) do nothing" in MIGRATION, 'learner notification retry is idempotent')
    require("if v_recipient_count > 0 then" in MIGRATION, 'parent share state requires a real recipient')
    require("parent_shared_at = clock_timestamp()" in MIGRATION, 'successful parent delivery stamps channel fact')
    require("'shared', v_recipient_count > 0" in MIGRATION, 'parent RPC reports truthful shared outcome')
    require('revoke all on function public.publish_lesson_plan_to_students' in MIGRATION, 'learner publication RPC denies public/anon')
    require('grant execute on function public.publish_lesson_plan_to_students' in MIGRATION, 'learner publication RPC is authenticated-only')

    print('Lesson delivery state hardening contract tests PASSED')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / 'app/teacher/results/page.tsx').read_text()
ui = (root / 'components/teacher/AssessmentIntelligenceConsole.tsx').read_text()
sql = (root / 'supabase/migrations/20260820093000_teacher_assessment_intelligence_console.sql').read_text()

checks = {
    'console wired into results': 'AssessmentIntelligenceConsole' in page and "'Intelligence'" in page,
    'canonical intelligence rpc': 'teacher_get_assessment_intelligence' in sql and 'returns jsonb' in sql,
    'teacher authorization': 'auth.uid()' in sql and 'teacher_assignment_required' in sql and 'teacher_classes' in sql,
    'function execution restricted': 'revoke all on function' in sql and 'grant execute' in sql and 'to authenticated' in sql,
    'aggregate evidence truth contract': "'exam_scope', 'aggregate'" in sql and 'Outcome claims are withheld' in sql,
    'outcome evidence distinguished': "'outcome_scope'" in sql and 'longitudinal_subject' in sql,
    'completion intelligence': "'completion'" in sql and 'v_roster_count' in sql,
    'history and movement': "'historical_trajectory'" in sql and "'learner_movements'" in sql,
    'performance segmentation': 'at_risk_declining' in sql and 'recovering' in sql and 'strong_improving' in sql,
    'attention queue': "'attention_items'" in sql and "'recommended_actions'" in sql,
    'intervention feedback': "'intervention_effects'" in sql and 'baseline_mastery_score' in sql and 'followup_mastery_score' in sql,
    'command centre UX': 'Assessment intelligence' in ui and 'Class mean' in ui and 'Need attention' in ui,
    'trajectory visual': 'Class trajectory' in ui and 'Sparkline' in ui,
    'learner matrix': 'Performance × direction' in ui and 'MovementMatrix' in ui,
    'learner drilldown': 'Learner intelligence' in ui and 'role="dialog"' in ui,
    'curriculum truthfulness': 'No topic-level claim is being made.' in ui and 'does not infer topic weakness' in ui,
    'decision centre': 'Teacher decision centre' in ui and 'Plan reteaching' not in ui,
    'mobile responsive primitives': 'overflowX: "auto"' in ui and 'minmax(280px,1fr)' in ui,
}

# The SQL owns action labels, so make sure the product actions live in the canonical contract.
checks['action labels in projection'] = all(label in sql for label in [
    'Complete marks', 'Review learners needing support', 'Plan reteaching', 'Review report cards'
])

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(('PASS' if ok else 'FAIL') + ' - ' + name)

if failed:
    raise SystemExit('Teacher assessment intelligence contract failed: ' + ', '.join(failed))

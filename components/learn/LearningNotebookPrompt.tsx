import { getNotebookGuidance, type NotebookStage } from '@/lib/learning/notebookGuidance'

/**
 * Reusable, optional writing / active-learning invitation for content consumers.
 * No state, no learner tracking, no simulated completion or score.
 */
export default function LearningNotebookPrompt({
  subject,
  stage,
  compact = false,
}: {
  subject?: string | null
  stage: NotebookStage
  compact?: boolean
}) {
  const guidance = getNotebookGuidance(subject, stage)
  return (
    <aside
      aria-label="Learning notebook guidance"
      style={{
        border: '1px solid #d5e2d9',
        borderRadius: 12,
        background: '#f7faf8',
        padding: compact ? '10px 12px' : '14px 16px',
        color: '#234839',
        margin: '12px 0',
        lineHeight: 1.55,
      }}
    >
      <strong style={{ fontSize: 14 }}>
        {stage === 'teacher' ? 'Encourage learners to show their work' : 'Try it in your exercise book'}
      </strong>
      <p style={{ fontSize: 13, margin: '5px 0 0' }}>
        {guidance.invitation} {guidance.task}
      </p>
      {!compact && (
        <p style={{ fontSize: 12, margin: '8px 0 0', color: '#4f685a' }}>
          {guidance.alternative}
        </p>
      )}
    </aside>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { trackPublicEvent } from '@/lib/publicTelemetry'
import styles from './PublicProductSandbox.module.css'

type Role = 'teacher' | 'learner' | 'family' | 'leader'
type EvidenceKey = 'identify' | 'explain' | 'apply'

type DemoLearner = {
  id: string
  label: string
  present: boolean
  participated: boolean
  evidence: Record<EvidenceKey, boolean>
}

const stages = [
  { key: 'plan', label: 'Plan', eyebrow: '01 · PLAN' },
  { key: 'teach', label: 'Teach', eyebrow: '02 · TEACH' },
  { key: 'evidence', label: 'Evidence', eyebrow: '03 · EVIDENCE' },
  { key: 'assess', label: 'Assess', eyebrow: '04 · ASSESS' },
  { key: 'understand', label: 'Understand', eyebrow: '05 · UNDERSTAND' },
  { key: 'next', label: 'Next action', eyebrow: '06 · NEXT ACTION' },
] as const

const evidenceCriteria: { key: EvidenceKey; short: string; label: string }[] = [
  { key: 'identify', short: 'Identify', label: 'Identifies relevant cell structures from the learning task' },
  { key: 'explain', short: 'Explain', label: 'Explains how a structure supports a function' },
  { key: 'apply', short: 'Apply', label: 'Uses the idea in a new example or comparison' },
]

const initialLearners: DemoLearner[] = [
  { id: 'learner-a', label: 'Learner A', present: false, participated: false, evidence: { identify: false, explain: false, apply: false } },
  { id: 'learner-b', label: 'Learner B', present: false, participated: false, evidence: { identify: false, explain: false, apply: false } },
  { id: 'learner-c', label: 'Learner C', present: false, participated: false, evidence: { identify: false, explain: false, apply: false } },
]

const roleLabels: Record<Role, string> = {
  teacher: 'Teacher',
  learner: 'Learner',
  family: 'Family',
  leader: 'School leader',
}

function evidenceCount(learner: DemoLearner) {
  return evidenceCriteria.reduce((sum, criterion) => sum + Number(learner.evidence[criterion.key]), 0)
}

function learnerEvidenceState(learner: DemoLearner) {
  if (!learner.present) return { label: 'No lesson evidence', explanation: 'Absence is not treated as evidence of learning.' }
  const count = evidenceCount(learner)
  if (count === 3) return { label: 'Strong evidence coverage', explanation: 'All three demonstration criteria have observable evidence.' }
  if (count === 2) return { label: 'Developing evidence coverage', explanation: 'Two criteria have evidence; one still needs confirmation.' }
  if (count === 1) return { label: 'Limited evidence coverage', explanation: 'One criterion has evidence; more observation is needed.' }
  return { label: 'Evidence not yet captured', explanation: 'The learner was present, but no criterion has been evidenced yet.' }
}

export function PublicProductSandbox() {
  const [stageIndex, setStageIndex] = useState(0)
  const [role, setRole] = useState<Role>('teacher')
  const [learners, setLearners] = useState<DemoLearner[]>(initialLearners)

  useEffect(() => {
    trackPublicEvent('public_sandbox_open', '/sandbox')
  }, [])

  const presentLearners = useMemo(() => learners.filter((learner) => learner.present), [learners])
  const evidenceTotal = useMemo(() => learners.reduce((sum, learner) => sum + evidenceCount(learner), 0), [learners])
  const possibleEvidence = presentLearners.length * evidenceCriteria.length

  const criterionTotals = useMemo(() => evidenceCriteria.map((criterion) => ({
    ...criterion,
    observed: presentLearners.filter((learner) => learner.evidence[criterion.key]).length,
  })), [presentLearners])

  const lowestCriterion = useMemo(() => {
    if (!criterionTotals.length) return null
    return [...criterionTotals].sort((a, b) => a.observed - b.observed)[0]
  }, [criterionTotals])

  const focusLearner = learners[1]
  const focusState = learnerEvidenceState(focusLearner)
  const stage = stages[stageIndex]

  const updateLearner = (id: string, patch: Partial<DemoLearner>) => {
    setLearners((current) => current.map((learner) => learner.id === id ? { ...learner, ...patch } : learner))
  }

  const toggleEvidence = (id: string, key: EvidenceKey) => {
    setLearners((current) => current.map((learner) => learner.id === id
      ? { ...learner, evidence: { ...learner.evidence, [key]: !learner.evidence[key] } }
      : learner))
  }

  const moveStage = (index: number) => {
    setStageIndex(index)
    trackPublicEvent(index === stages.length - 1 ? 'public_sandbox_complete' : 'public_sandbox_progress', '/sandbox')
  }

  const nextStage = () => moveStage(Math.min(stages.length - 1, stageIndex + 1))
  const previousStage = () => moveStage(Math.max(0, stageIndex - 1))

  const changeRole = (nextRole: Role) => {
    setRole(nextRole)
    trackPublicEvent('public_sandbox_role', '/sandbox')
  }

  const reset = () => {
    setLearners(initialLearners)
    setRole('teacher')
    setStageIndex(0)
  }

  const recommendation = (() => {
    if (!presentLearners.length) return 'Mark attendance first. VibeSchool should not infer learning from a lesson that has no observed learner participation.'
    if (!lowestCriterion) return 'Capture evidence before recommending a learning response.'
    if (lowestCriterion.observed === presentLearners.length) return 'Evidence is complete across the demonstration criteria. Use the next lesson for extension, transfer or a fresh learning outcome.'
    if (lowestCriterion.key === 'identify') return 'Revisit visual identification with a short guided example before asking learners to explain function.'
    if (lowestCriterion.key === 'explain') return 'Use a compare-and-explain activity focused on how structure supports function, then capture one fresh explanation per learner.'
    return 'Give a new example and ask learners to transfer the idea independently before closing the learning loop.'
  })()

  const renderStage = () => {
    if (stage.key === 'plan') {
      return <div className={styles.stageGrid}>
        <article className={styles.primaryCard}>
          <p className={styles.cardEyebrow}>CURRICULUM-ANCHORED DEMONSTRATION</p>
          <h2>Plan one Grade 10 Biology lesson as part of a connected learning record.</h2>
          <dl className={styles.planList}>
            <div><dt>Learning area</dt><dd>Grade 10 Biology</dd></div>
            <div><dt>Demonstration focus</dt><dd>Cell structure and function</dd></div>
            <div><dt>Learning intention</dt><dd>Relate observed cell structures to the functions they support.</dd></div>
          </dl>
          <div className={styles.criteriaBlock}>
            <strong>Success evidence we will look for</strong>
            <ol>{evidenceCriteria.map((criterion) => <li key={criterion.key}>{criterion.label}</li>)}</ol>
          </div>
          <p className={styles.boundary}>This is safe demonstration content. It shows VibeSchool's workflow logic; it is not presented as a verbatim KICD curriculum statement.</p>
        </article>
        <aside className={styles.signalCard}>
          <span>Why this matters</span>
          <h3>The lesson starts with a learning intention, not an empty document.</h3>
          <p>Planning creates the reference point that teaching, evidence, assessment and the next action can continue to use.</p>
        </aside>
      </div>
    }

    if (stage.key === 'teach') {
      return <div className={styles.stageGrid}>
        <article className={styles.primaryCard}>
          <p className={styles.cardEyebrow}>CLASSROOM ACTIVITY</p>
          <h2>Record what actually happened in the lesson.</h2>
          <div className={styles.learnerRows}>
            {learners.map((learner) => <div className={styles.learnerRow} key={learner.id}>
              <div><strong>{learner.label}</strong><span>Safe demo identity</span></div>
              <label><input type="checkbox" checked={learner.present} onChange={(event) => updateLearner(learner.id, {
                present: event.target.checked,
                participated: event.target.checked ? learner.participated : false,
                evidence: event.target.checked ? learner.evidence : { identify: false, explain: false, apply: false },
              })}/> Present</label>
              <label><input type="checkbox" checked={learner.participated} disabled={!learner.present} onChange={(event) => updateLearner(learner.id, { participated: event.target.checked })}/> Participated</label>
            </div>)}
          </div>
          <p className={styles.boundary}>Attendance and participation are context. They are not converted into mastery or a learning score.</p>
        </article>
        <aside className={styles.signalCard}>
          <span>Live classroom signal</span>
          <strong className={styles.bigNumber}>{presentLearners.length}/{learners.length}</strong>
          <p>demo learners marked present</p>
          <strong>{learners.filter((learner) => learner.participated).length}</strong>
          <p>participation observations</p>
        </aside>
      </div>
    }

    if (stage.key === 'evidence') {
      return <div className={styles.stageGrid}>
        <article className={styles.primaryCard}>
          <p className={styles.cardEyebrow}>OBSERVABLE LEARNING EVIDENCE</p>
          <h2>Capture what each present learner demonstrated.</h2>
          <div className={styles.evidenceMatrix}>
            {learners.map((learner) => <section key={learner.id} className={!learner.present ? styles.dimmedLearner : undefined}>
              <div className={styles.matrixHeading}><strong>{learner.label}</strong><span>{learner.present ? 'Present' : 'No lesson evidence'}</span></div>
              {evidenceCriteria.map((criterion) => <label key={criterion.key}>
                <input type="checkbox" disabled={!learner.present} checked={learner.evidence[criterion.key]} onChange={() => toggleEvidence(learner.id, criterion.key)}/>
                <span><b>{criterion.short}</b>{criterion.label}</span>
              </label>)}
            </section>)}
          </div>
        </article>
        <aside className={styles.signalCard}>
          <span>Evidence coverage</span>
          <strong className={styles.bigNumber}>{evidenceTotal}/{possibleEvidence || 0}</strong>
          <p>possible demonstration observations captured for present learners</p>
          <p className={styles.boundary}>No score is invented when evidence is missing.</p>
        </aside>
      </div>
    }

    if (stage.key === 'assess') {
      return <div className={styles.stageGrid}>
        <article className={styles.primaryCard}>
          <p className={styles.cardEyebrow}>EVIDENCE-BOUND ASSESSMENT</p>
          <h2>Turn observations into a transparent evidence summary.</h2>
          <div className={styles.assessmentList}>
            {learners.map((learner) => {
              const state = learnerEvidenceState(learner)
              return <div key={learner.id}>
                <span>{learner.label}</span>
                <strong>{state.label}</strong>
                <p>{state.explanation}</p>
                <small>{evidenceCount(learner)} of 3 demonstration criteria evidenced</small>
              </div>
            })}
          </div>
          <p className={styles.boundary}>This sandbox deliberately reports evidence coverage rather than pretending a short demonstration proves full mastery.</p>
        </article>
        <aside className={styles.signalCard}>
          <span>Assessment principle</span>
          <h3>Evidence first. Interpretation second.</h3>
          <p>A consequential learning claim should be traceable to what was observed, not generated from attendance, activity counts or hidden AI confidence.</p>
        </aside>
      </div>
    }

    if (stage.key === 'understand') {
      return <div className={styles.stageGrid}>
        <article className={styles.primaryCard}>
          <p className={styles.cardEyebrow}>CLASS UNDERSTANDING</p>
          <h2>See the gap without losing the evidence behind it.</h2>
          <div className={styles.criterionBars}>
            {criterionTotals.map((criterion) => {
              const denominator = presentLearners.length || 1
              const percent = Math.round((criterion.observed / denominator) * 100)
              return <div key={criterion.key}>
                <div><strong>{criterion.short}</strong><span>{criterion.observed}/{presentLearners.length} present learners</span></div>
                <progress max="100" value={percent} aria-label={`${criterion.short} evidence coverage ${percent}%`}>{percent}%</progress>
              </div>
            })}
          </div>
          <div className={styles.gapCallout}>
            <span>Current evidence gap</span>
            <strong>{presentLearners.length ? (lowestCriterion?.label ?? 'Capture evidence') : 'No classroom evidence yet'}</strong>
            <p>{presentLearners.length ? 'This is the least-observed criterion in the current demonstration state.' : 'Return to Teach and mark attendance before interpreting learning.'}</p>
          </div>
        </article>
        <aside className={styles.signalCard}>
          <span>Interpretation boundary</span>
          <h3>VibeSchool can say what the evidence currently supports—and what it does not.</h3>
          <p>Missing evidence remains visible. That prevents false certainty and makes the next teaching decision easier to defend.</p>
        </aside>
      </div>
    }

    return <div className={styles.stageGrid}>
      <article className={styles.primaryCard}>
        <p className={styles.cardEyebrow}>NEXT ACTION</p>
        <h2>Close the loop with a response tied to the weakest evidence.</h2>
        <div className={styles.nextAction}>
          <span>Recommended demonstration response</span>
          <strong>{recommendation}</strong>
          <p>After the response, the next evidence capture should show whether the gap narrowed. That creates a learning history instead of a one-off dashboard statistic.</p>
        </div>
        <div className={styles.loop}>
          {['Plan', 'Teach', 'Evidence', 'Assess', 'Understand', 'Next action'].map((item, index) => <span key={item} className={index === stageIndex ? styles.loopActive : undefined}>{item}</span>)}
        </div>
      </article>
      <aside className={styles.signalCard}>
        <span>Connected record</span>
        <h3>One learning story survived from intention to response.</h3>
        <p>The next cycle can begin from what this cycle established rather than resetting to disconnected documents and dashboards.</p>
      </aside>
    </div>
  }

  const renderRoleLens = () => {
    if (role === 'teacher') return <>
      <span>Teacher lens</span>
      <h3>What should I do next in the classroom?</h3>
      <p>{recommendation}</p>
      <small>The teacher sees learner-level evidence because it is needed for teaching and assessment.</small>
    </>

    if (role === 'learner') return <>
      <span>Learner lens · {focusLearner.label}</span>
      <h3>{focusState.label}</h3>
      <p>{focusLearner.present ? `Your current demonstration evidence shows ${evidenceCount(focusLearner)} of 3 criteria. The next activity should help you produce clearer evidence where it is missing.` : 'You were not marked present in this demonstration, so VibeSchool does not invent a learning judgement.'}</p>
      <small>The learner sees their own learning context and next step, not another learner's record.</small>
    </>

    if (role === 'family') return <>
      <span>Family lens · {focusLearner.label}</span>
      <h3>How is my child doing, where is the difficulty, and what happens next?</h3>
      <p>{focusLearner.present ? `${focusState.label}. The school has evidence for ${evidenceCount(focusLearner)} of 3 demonstration criteria. ${recommendation}` : 'There is no lesson evidence for this demonstration because the learner is not marked present.'}</p>
      <small>The family view explains relevant progress without exposing private teacher workspace or other learners.</small>
    </>

    return <>
      <span>School leader lens</span>
      <h3>What educational signal should leadership act on?</h3>
      <p>{presentLearners.length ? `${evidenceTotal} of ${possibleEvidence} possible observations are captured. The weakest current criterion is ${lowestCriterion?.short ?? 'not yet known'}. The recommended instructional response is visible before leadership interprets a result.` : 'No classroom evidence has been captured yet, so leadership should not infer a teaching or learner-performance problem.'}</p>
      <small>Leadership sees the causal chain—curriculum → teaching → participation → evidence → response—rather than only an aggregate score.</small>
    </>
  }

  return <section className={styles.sandbox} aria-labelledby="sandbox-title">
    <div className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>PUBLIC REAL-PRODUCT SANDBOX</p>
        <h1 id="sandbox-title">Use VibeSchool before you sign in.</h1>
        <p>Run one safe demonstration lesson through the real VibeSchool product logic: plan what should be learned, record what happened, capture evidence, interpret only what the evidence supports, and decide the next action.</p>
        <div className={styles.heroBadges}><span>No login</span><span>No production learner data</span><span>No screenshots</span><span>Client-only demo state</span></div>
      </div>
      <aside>
        <strong>What this proves</strong>
        <p>VibeSchool's differentiation is the connection between educational events—not the number of modules on a feature list.</p>
        <Link href="/institutions">See the school adoption path →</Link>
      </aside>
    </div>

    <div className={styles.workspace}>
      <nav className={styles.stageNav} aria-label="Sandbox learning loop">
        {stages.map((item, index) => <button key={item.key} type="button" onClick={() => moveStage(index)} aria-current={index === stageIndex ? 'step' : undefined} className={index === stageIndex ? styles.activeStage : undefined}>
          <small>{String(index + 1).padStart(2, '0')}</small><span>{item.label}</span>
        </button>)}
      </nav>

      <div className={styles.stageHeader}>
        <div><p>{stage.eyebrow}</p><strong>VibeSchool demonstration workspace</strong></div>
        <button type="button" onClick={reset}>Reset demo</button>
      </div>

      {renderStage()}

      <div className={styles.controls}>
        <button type="button" onClick={previousStage} disabled={stageIndex === 0}>← Previous</button>
        <span>{stageIndex + 1} of {stages.length}</span>
        <button type="button" onClick={nextStage} disabled={stageIndex === stages.length - 1}>Continue →</button>
      </div>
    </div>

    <section className={styles.roleSection} aria-labelledby="role-lens-title">
      <div className={styles.roleIntro}>
        <p className={styles.eyebrow}>ONE TRUTH · DIFFERENT AUTHORITY</p>
        <h2 id="role-lens-title">Change role. Notice that the evidence does not change—only the authorised view does.</h2>
      </div>
      <div className={styles.roleButtons} role="group" aria-label="Choose a role lens">
        {(Object.keys(roleLabels) as Role[]).map((item) => <button key={item} type="button" onClick={() => changeRole(item)} aria-pressed={role === item} className={role === item ? styles.activeRole : undefined}>{roleLabels[item]}</button>)}
      </div>
      <article className={styles.roleCard}>{renderRoleLens()}</article>
    </section>

    <section className={styles.truthStrip} aria-label="Sandbox truth boundary">
      <strong>Demonstration boundary</strong>
      <p>All learner labels and observations on this page are fabricated demo state created in your browser. Nothing here is a claim about a real learner, school, KICD wording, pilot outcome or production usage. The workflow mirrors VibeSchool's connected product architecture while keeping production data out of the public experience.</p>
    </section>
  </section>
}

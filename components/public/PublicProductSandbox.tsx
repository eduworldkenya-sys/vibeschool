'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, BookOpenText, Check, RotateCcw } from 'lucide-react'
import { trackPublicEvent } from '@/lib/publicTelemetry'
import { PublicHeader } from './PublicHeader'
import { PublicFooter } from './PublicFooter'
import styles from './PublicProductSandbox.module.css'

type Role = 'teacher' | 'learner' | 'family' | 'leader'
type Answer = '6' | '8' | '10'

const options: Answer[] = ['6', '8', '10']

// A focused subset of the canonical public navigation, not a second sandbox shell.
const sandboxNavigation: ReadonlyArray<readonly [string, string]> = [
  ['/sandbox', 'Experience'],
  ['/learn', 'Learn'],
  ['/product', 'Product'],
  ['/evidence', 'Learning evidence'],
]

const roleLabels: Record<Role, string> = {
  teacher: 'Teacher',
  learner: 'Learner',
  family: 'Family',
  leader: 'School leader',
}

export function PublicProductSandbox() {
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [role, setRole] = useState<Role>('teacher')

  useEffect(() => { trackPublicEvent('public_sandbox_open', '/sandbox') }, [])

  const answered = answer !== null
  const correct = answer === '8'

  const choose = (choice: Answer) => {
    setAnswer(choice)
    trackPublicEvent(choice === '8' ? 'public_sandbox_complete' : 'public_sandbox_progress', '/sandbox')
  }

  const changeRole = (nextRole: Role) => {
    setRole(nextRole)
    trackPublicEvent('public_sandbox_role', '/sandbox')
  }

  const reset = () => {
    setAnswer(null)
    setRole('teacher')
  }

  const nextAction = !answered
    ? 'Answer the question to see an evidence-based next step.'
    : correct
      ? 'Try another ratio with larger quantities to check whether the method transfers.'
      : 'Return to the ratio 3:2. Find the scale factor from 3 to 12, then multiply 2 by the same factor.'

  const roleMessage: Record<Role, { heading: string; body: string }> = {
    teacher: {
      heading: answered ? (correct ? 'Ready for a second check' : 'Revisit the scale factor') : 'Start with a visible response',
      body: answered
        ? (correct ? 'The selected answer is correct. One question is evidence of this response, not proof of mastery. Follow with a different example.'
          : 'The selected answer is incorrect. Use a quick worked comparison before another question.')
        : 'Choose an answer. The lesson then connects the response to an appropriate follow-up activity.',
    },
    learner: {
      heading: answered ? (correct ? 'Your method worked here' : 'Try scaling both quantities') : 'Practice one idea at a time',
      body: answered
        ? (correct ? 'You found 8 blue counters. Keep the same method when the numbers change.'
          : 'Three red counters go with two blue counters. Twelve red counters are four groups of three, so the blue counters must also be four groups.')
        : 'Study the example, answer the question and see how the numbers fit together.',
    },
    family: {
      heading: answered ? 'One practice response recorded' : 'See what the learner is practising',
      body: answered
        ? (correct ? 'This sample answer is correct. A single response does not establish the learner’s overall performance.'
          : 'This sample answer needs another attempt. The next activity should practise the scaling method.')
        : 'This is an illustrative activity, not a real child’s record or report.',
    },
    leader: {
      heading: answered ? 'One observed sample response' : 'Do not infer school performance',
      body: answered
        ? 'A single synthetic answer cannot show class attainment, teacher effectiveness or curriculum coverage. More authorised evidence would be required.'
        : 'The sample lesson has no submitted response. There is no learning result to interpret.',
    },
  }

  return (
    <div className={styles.experience}>
      <PublicHeader product="Experience" navigation={sandboxNavigation} />

      <main id="main-content" className={styles.main}>
        <div className={styles.introduction}>
          <div className={styles.introductionText}>
            <p className={styles.eyebrow}>VIBESCHOOL EXPERIENCE <span aria-hidden="true">/</span> GRADE 8 MATHEMATICS</p>
            <h1 id="experience-heading">One lesson. Everything connected.</h1>
            <p className={styles.lead}>See a concept, try a question and get a useful next step. All on one screen.</p>
          </div>
          <span className={styles.demoLabel}>Interactive learning sample</span>
        </div>

        <div className={styles.workspace}>
          <div className={styles.workspaceBar}>
            <div className={styles.courseTitle}><BookOpenText size={19} aria-hidden="true" /><span>Mathematics <span className={styles.courseSeparator}>/</span> Ratios</span></div>
            <button type="button" className={styles.reset} onClick={reset}><RotateCcw size={15} aria-hidden="true" /> Reset demo</button>
          </div>

          <div className={styles.columns}>
            <article className={styles.lesson} aria-label="Sample Grade 8 Mathematics lesson">
              <div className={styles.lessonMeta}><span className={styles.miniLabel}>LEARN</span><span>01 / CONCEPT</span></div>
              <h2>Ratios describe a relationship.</h2>
              <p>A ratio compares quantities in a fixed order. When one quantity changes, use the same scale factor for the other.</p>
              <div className={styles.example}>
                <div className={styles.exampleHeading}><span>Worked example</span><span>4 : 3</span></div>
                <p>For every <strong>4 exercise books</strong>, there are <strong>3 covers</strong>.</p>
                <div className={styles.exampleNumbers} aria-label="4 books to 3 covers becomes 8 books to 6 covers">
                  <div><span>4 books</span><strong>4</strong></div>
                  <span className={styles.scaleFactor}>× 2</span>
                  <div><span>8 books</span><strong>8</strong></div>
                  <div className={styles.verticalRule} aria-hidden="true" />
                  <div><span>3 covers</span><strong>3</strong></div>
                  <span className={styles.scaleFactor}>× 2</span>
                  <div><span>6 covers</span><strong>6</strong></div>
                </div>
                <p className={styles.exampleFootnote}>Both quantities double. The ratio stays the same.</p>
              </div>

              <div className={styles.practice}>
                <div className={styles.lessonMeta}><span className={styles.miniLabel}>TRY IT</span><span>02 / PRACTICE</span></div>
                <h3>There are 3 red counters for every 2 blue counters. If there are 12 red counters, how many are blue?</h3>
                <div className={styles.answers} role="group" aria-label="Choose the number of blue counters">
                  {options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={answer === option ? styles.selectedAnswer : undefined}
                      aria-pressed={answer === option}
                      onClick={() => choose(option)}
                    >
                      <span>{option} blue counters</span>
                      {answer === option ? <Check size={18} aria-hidden="true" /> : <span className={styles.answerCircle} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </div>
            </article>

            <aside className={styles.insight} aria-label="Connected lesson feedback">
              <p className={styles.miniLabel}>CONNECTED LEARNING</p>
              <h2>From an answer to a next step.</h2>
              <div className={styles.flow} aria-label="Curriculum aligned sample, teaching content, practice and feedback">
                <span>Learning goal</span><span aria-hidden="true">→</span><span>Content</span><span aria-hidden="true">→</span><span>Practice</span>
              </div>
              <div className={styles.result} aria-live="polite" aria-atomic="true">
                <span className={styles.resultEyebrow}>ASSESSMENT EVIDENCE</span>
                <strong className={answered ? (correct ? styles.correct : styles.retry) : styles.pending}>
                  {!answered ? 'Your answer appears here' : correct ? 'Correct: 8 blue counters' : 'Not quite. Try the scale factor.'}
                </strong>
                <p>{!answered
                  ? 'Select an answer to see how VibeSchool responds.'
                  : '12 ÷ 3 = 4 groups. There are 2 blue counters in each group, so 2 × 4 = 8.'}</p>
              </div>
              <div className={styles.action}>
                <span className={styles.resultEyebrow}>NEXT TEACHING ACTION</span>
                <p>{nextAction}</p>
              </div>
              <div className={styles.roleLens}>
                <p className={styles.resultEyebrow}>ONE RECORD · DIFFERENT VIEW</p>
                <div className={styles.roleButtons} role="group" aria-label="View this example by role">
                  {(Object.keys(roleLabels) as Role[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={role === item ? styles.activeRole : undefined}
                      aria-pressed={role === item}
                      onClick={() => changeRole(item)}
                    >{roleLabels[item]}</button>
                  ))}
                </div>
                <div className={styles.roleContent} aria-live="polite">
                  <strong>{roleMessage[role].heading}</strong>
                  <p>{roleMessage[role].body}</p>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className={styles.after}>
          <div>
            <strong>Teaching that stays connected.</strong>
            <p>One example of how content, practice and evidence can inform the next action.</p>
          </div>
          <Link className={styles.continueAction} href="/learn?grade=Grade+8&subject=Mathematics">
            Explore Grade 8 Mathematics <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <p className={styles.disclosure}><strong>Demonstration boundary.</strong> Client-only demo state. No production learner data. This is VibeSchool-authored example content, not a verbatim KICD curriculum extract. One answer is not a mastery judgement. No real learner or school records are accessed.</p>
      </main>
      <PublicFooter focused />
    </div>
  )
}

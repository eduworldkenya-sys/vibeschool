'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, CalendarClock, Check, ClipboardCheck, Clock3, GraduationCap, RefreshCw, School, Users } from 'lucide-react'
import styles from './ProductShowcase.module.css'

type Role = 'teacher' | 'learner' | 'parent' | 'school'
type LearnerView = 'learn' | 'practice' | 'revise'

const teacherStages = [
  { label: 'Curriculum', eyebrow: '01 / INTENTION', title: 'Begin with the learning intention.', description: 'Sample Grade 4 Mathematics: calculate elapsed time in hours and minutes. The verified curriculum record must be used in an actual lesson.', points: ['Learning intention', 'Scheme and lesson context'] },
  { label: 'Prepare', eyebrow: '02 / PREPARATION', title: 'Bring teaching materials together.', description: 'Keep notes, a worked example, a diagram and an exercise attached to the same teaching context.', points: ['Lesson notes and examples', 'Time illustration', 'Practice question'] },
  { label: 'Teach', eyebrow: '03 / CLASSROOM', title: 'Explain the concept clearly.', description: 'Use the clock example to show how one time interval can be broken into manageable steps.', points: ['8:30 to 9:30 = 60 minutes', '9:30 to 10:00 = 30 minutes'] },
  { label: 'Assess', eyebrow: '04 / EVIDENCE', title: 'Ask what the learner understands.', description: 'A response is evidence for one question. It does not automatically establish topic mastery.', points: ['One illustrative response', 'Immediate explanation and feedback'] },
  { label: 'Next', eyebrow: '05 / FOLLOW-UP', title: 'Make the next action useful.', description: 'The next practice activity should respond to the evidence, without losing the learning context.', points: ['Retry with support when needed', 'Try a new example when ready'] },
] as const

const roleLabels: Record<Role, { heading: string; intro: string; status: string }> = {
  teacher: { heading: 'Teach with the whole journey in view.', intro: 'Trace one lesson from intention to teaching, evidence and next action.', status: 'Instructional continuity under pilot validation' },
  learner: { heading: 'Understand it. Try it. Keep going.', intro: 'See the lesson, try a question and get an explanation on the same topic.', status: 'Public learning available; full continuity under validation' },
  parent: { heading: 'Know how to support learning.', intro: 'See how an authorised family view could explain what was learned and what to practise.', status: 'Family summary workflow under validation' },
  school: { heading: 'Keep academic context connected.', intro: 'Connect curriculum intentions, classroom activity and evidence for better oversight.', status: 'School-wide learning visibility under validation' },
}

const roleItems: { role: Role; label: string; Icon: typeof GraduationCap }[] = [
  { role: 'teacher', label: 'Teacher', Icon: GraduationCap },
  { role: 'learner', label: 'Learner', Icon: BookOpen },
  { role: 'parent', label: 'Parent', Icon: Users },
  { role: 'school', label: 'School', Icon: School },
]

function SampleClock() {
  return <svg className={styles.clock} viewBox="0 0 160 160" role="img" aria-label="Illustrative analogue clock showing 8:30">
    <circle cx="80" cy="80" r="74" fill="#fffaf0" stroke="#e9d9a8" strokeWidth="2" />
    <circle cx="80" cy="80" r="62" fill="none" stroke="#efe7d5" strokeWidth="1" />
    {[0,1,2,3,4,5,6,7,8,9,10,11].map(n => {
      const a = n * Math.PI / 6
      return <line key={n} x1={80 + Math.sin(a)*63} y1={80 - Math.cos(a)*63} x2={80 + Math.sin(a)*69} y2={80 - Math.cos(a)*69} stroke="#b5a67f" strokeWidth="2" />
    })}
    <g fill="#4b4231" fontFamily="system-ui" fontSize="13" fontWeight="700" textAnchor="middle">
      <text x="80" y="31">12</text><text x="130" y="85">3</text><text x="80" y="136">6</text><text x="30" y="85">9</text>
    </g>
    <line x1="80" y1="80" x2="43" y2="69" stroke="#3e3625" strokeWidth="6" strokeLinecap="round" />
    <line x1="80" y1="80" x2="80" y2="126" stroke="#9e7821" strokeWidth="4" strokeLinecap="round" />
    <circle cx="80" cy="80" r="5" fill="#3e3625" />
  </svg>
}

export function ProductShowcase() {
  const [role, setRole] = useState<Role>('teacher')
  const [teacherStage, setTeacherStage] = useState(0)
  const [learnerView, setLearnerView] = useState<LearnerView>('learn')
  const [answer, setAnswer] = useState<number | null>(null)
  const activeRole = roleLabels[role]
  const stage = teacherStages[teacherStage]
  const correct = answer === 90
  const nextAction = answer === null
    ? 'Choose an answer in the learner preview to see a relevant follow-up.'
    : correct
      ? 'One correct response: try a different time interval to check whether the method transfers.'
      : 'This response needs support: revisit the worked example, then retry with a new question.'

  function selectRole(next: Role) {
    setRole(next)
    if (next === 'learner') setLearnerView('learn')
  }

  function tryAsLearner() {
    setRole('learner')
    setLearnerView('practice')
  }

  return <div className={styles.root}>
    <section className={styles.hero} aria-labelledby="product-hero-heading">
      <div className={styles.wrap}>
        <div className={styles.heroGrid}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>THE VIBESCHOOL PLATFORM · BUILT FOR KENYA</p>
            <h1 id="product-hero-heading">Every lesson has a <em>next.</em></h1>
            <p className={styles.heroLead}>From the curriculum to the classroom, from practice to progress. One connected education journey for the people who make learning happen.</p>
            <div className={styles.actions}>
              <a href="#vibeschool-experience" className={styles.heroPrimary}>Explore the platform <ArrowRight size={17} aria-hidden="true" /></a>
              <Link href="/sandbox" className={styles.heroSecondary}>Try the interactive experience <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
            <p className={styles.trustLine}><span aria-hidden="true" className={styles.trustDot} /> Real VibeSchool destinations · Clearly labelled illustrative demonstrations</p>
          </div>
          <div className={styles.heroVisual} aria-label="Illustration of a Grade 4 mathematics learning journey">
            <span className={styles.visualEyebrow}>ONE TOPIC · ONE CONTINUING JOURNEY</span>
            <div className={styles.visualWindow}>
              <div className={styles.visualTop}><span>VibeSchool / Mathematics</span><span>Grade 4</span></div>
              <div className={styles.visualBody}>
                <p className={styles.cardEyebrow}>ILLUSTRATIVE LESSON</p>
                <h2>Time &amp; Duration</h2>
                <p>Learn the concept. Practice with feedback.</p>
                <div className={styles.visualProgress}><i /><i /><i /><i /></div>
                <div className={styles.visualItems}>
                  <span><BookOpen size={16} aria-hidden="true" /> Lesson and examples <Check size={15} aria-hidden="true" /></span>
                  <span><Clock3 size={16} aria-hidden="true" /> Time interval exercise <ArrowRight size={15} aria-hidden="true" /></span>
                </div>
              </div>
            </div>
            <div className={styles.visualNote}><strong>One learning intention</strong><span>Many connected experiences</span></div>
          </div>
        </div>
        <div className={styles.heroFeatures} aria-label="VibeSchool learning model">
          <span><b>01</b> Curriculum-aware</span><span><b>02</b> Teacher and learner</span><span><b>03</b> Practice and evidence</span><span><b>04</b> Next action</span>
        </div>
      </div>
    </section>

    <section className={styles.experienceSection} id="vibeschool-experience" aria-labelledby="experience-heading">
      <div className={styles.wrap}>
        <div className={styles.sectionHeading}>
          <p className={styles.sectionEyebrow}>EXPERIENCE VIBESCHOOL</p>
          <h2 id="experience-heading">Do not just read about it.<br />See the connection.</h2>
          <p>Select a role and explore the same illustrative Grade 4 Mathematics example from a different perspective.</p>
        </div>
        <div className={styles.roles} role="group" aria-label="Choose a VibeSchool experience">
          {roleItems.map(({role: id,label,Icon}) => <button type="button" key={id} aria-pressed={role === id} className={styles.roleButton} onClick={() => selectRole(id)}>
            <Icon size={18} aria-hidden="true" /> {label}
          </button>)}
        </div>
        <div className={styles.workspace}>
          <div className={styles.workspaceSide}>
            <div className={styles.workspaceBrand}><span className={styles.brandMonogram}>V</span> VibeSchool</div>
            <p className={styles.workspaceLabel}>PRODUCT EXPERIENCE</p>
            <p className={styles.workspaceTitle}>{activeRole.heading}</p>
            <p className={styles.workspaceIntro}>{activeRole.intro}</p>
            <div className={styles.workspaceStatus}>{activeRole.status}</div>
            <Link href="/sandbox" className={styles.workspaceLink}>Open real public sandbox <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          <div className={styles.workspaceScreen}>
            <div className={styles.screenBar}>
              <strong>{role === 'teacher' ? 'Lesson journey' : role === 'learner' ? 'My learning' : role === 'parent' ? 'Family learning' : 'School overview'}</strong>
              <span>Illustrative preview — no private data</span>
            </div>
            {role === 'teacher' && <div className={styles.screenBody}>
              <p className={styles.cardEyebrow}>GRADE 4 MATHEMATICS · TIME</p>
              <h3>One lesson. Fully connected.</h3>
              <div className={styles.stageButtons} role="group" aria-label="Explore the teaching journey">
                {teacherStages.map((item,i) => <button type="button" key={item.label} className={styles.stageButton} aria-pressed={teacherStage === i} onClick={() => setTeacherStage(i)}><span>{String(i+1).padStart(2,'0')}</span>{' '}{item.label}</button>)}
              </div>
              <div className={styles.lessonCard} aria-live="polite">
                <p className={styles.cardEyebrow}>{stage.eyebrow}</p>
                <h4>{stage.title}</h4>
                <p>{stage.description}</p>
                {teacherStage === 2 && <div className={styles.clockRow}><SampleClock /><div><strong>8:30 → 10:00</strong><p>60 + 30 = 90 minutes</p></div></div>}
                <div className={styles.lessonRows}>
                  {stage.points.map(point => <div key={point} className={styles.lessonRow}><Check size={15} aria-hidden="true" /><span>{point}</span></div>)}
                </div>
                {teacherStage === 3 && <button type="button" className={styles.inlineAction} onClick={tryAsLearner}>Try the sample question <ArrowRight size={15} aria-hidden="true" /></button>}
                {teacherStage === 4 && <p className={styles.nextAction}>{nextAction}</p>}
              </div>
              <p className={styles.screenFootnote}>This is a demonstration, not a certified KICD outcome, real timetable record or live lesson.</p>
            </div>}
            {role === 'learner' && <div className={styles.screenBody}>
              <p className={styles.cardEyebrow}>MY LEARNING · GRADE 4</p>
              <h3>Time &amp; Duration</h3>
              <div className={styles.subTabs} role="group" aria-label="Learner demonstration tools">
                {(['learn','practice','revise'] as const).map(view => <button type="button" key={view} aria-pressed={learnerView === view} onClick={() => setLearnerView(view)}>{view === 'learn' ? 'Learn' : view === 'practice' ? 'Practice' : 'Revision'}</button>)}
              </div>
              {learnerView === 'learn' && <div className={styles.lessonCard}>
                <p className={styles.cardEyebrow}>WORKED EXAMPLE</p><h4>Calculate elapsed time.</h4>
                <div className={styles.clockRow}><SampleClock /><div><strong>8:30 → 10:00</strong><p>8:30 to 9:30 is 60 minutes.<br />9:30 to 10:00 is 30 minutes.</p></div></div>
                <p className={styles.nextAction}>Total: 60 + 30 = 90 minutes.</p>
                <button type="button" className={styles.inlineAction} onClick={() => setLearnerView('practice')}>Try a question <ArrowRight size={15} aria-hidden="true" /></button>
              </div>}
              {learnerView === 'practice' && <div className={styles.lessonCard}>
                <p className={styles.cardEyebrow}>SAMPLE PRACTICE · ONE QUESTION</p><h4>How many minutes pass between 8:30 and 10:00?</h4>
                <div className={styles.answers}>{[45,90,120,150].map(value => <button type="button" key={value} aria-pressed={answer === value} className={answer === value ? (correct ? styles.answerCorrect : styles.answerIncorrect) : styles.answer} onClick={() => setAnswer(value)}>{value} minutes</button>)}</div>
                <p className={styles.feedback} aria-live="polite">{answer === null ? 'Choose an answer for immediate feedback.' : correct ? 'Correct! 60 minutes plus 30 minutes makes 90 minutes.' : 'Try again. Count 60 minutes to 9:30, then 30 more minutes to 10:00. Total: 90 minutes.'}</p>
                <div className={styles.feedbackControls}><button type="button" className={styles.reset} onClick={() => setAnswer(null)}><RefreshCw size={14} aria-hidden="true" /> Reset</button><button type="button" className={styles.inlineAction} onClick={() => setLearnerView('revise')}>Open revision <ArrowRight size={15} aria-hidden="true" /></button></div>
              </div>}
              {learnerView === 'revise' && <div className={styles.lessonCard}>
                <p className={styles.cardEyebrow}>REVISION</p><h4>Break one interval into smaller steps.</h4>
                <div className={styles.lessonRows}><div className={styles.lessonRow}><Clock3 size={15} aria-hidden="true" />8:30 → 9:30 = 60 minutes</div><div className={styles.lessonRow}><Clock3 size={15} aria-hidden="true" />9:30 → 10:00 = 30 minutes</div></div>
                <p className={styles.nextAction}>1 hour 30 minutes = 90 minutes.</p>
                <button type="button" className={styles.inlineAction} onClick={() => setLearnerView('practice')}>Retry the question <ArrowRight size={15} aria-hidden="true" /></button>
              </div>}
              <p className={styles.screenFootnote}>Browser-only sample responses are not saved to a learner record.</p>
            </div>}
            {role === 'parent' && <div className={styles.screenBody}>
              <p className={styles.cardEyebrow}>FAMILY VIEW · ILLUSTRATIVE</p><h3>Support the next learning step.</h3>
              <div className={styles.familyGrid}>
                <div className={styles.summaryCard}><CalendarClock size={23} aria-hidden="true" /><strong>Current topic</strong><span>Time &amp; Duration</span></div>
                <div className={styles.summaryCard}><BookOpen size={23} aria-hidden="true" /><strong>At-home support</strong><span>Practise time intervals</span></div>
              </div>
              <div className={styles.lessonCard}><p className={styles.cardEyebrow}>TRY THIS AT HOME</p><h4>A simple everyday question</h4><p>If a journey begins at 8:30 a.m. and ends at 10:00 a.m., how long does it take?</p><p className={styles.nextAction}>1 hour 30 minutes. Family access to a real learner's data requires an authorised relationship.</p></div>
            </div>}
            {role === 'school' && <div className={styles.screenBody}>
              <p className={styles.cardEyebrow}>SCHOOL LEADERSHIP · CONCEPT</p><h3>Follow teaching with evidence.</h3>
              <div className={styles.lessonCard}>
                <p>School-level decisions need the context behind a result, not just a number on a dashboard.</p>
                <div className={styles.lessonRows}>
                  <div className={styles.lessonRow}><BookOpen size={15} aria-hidden="true" />Curriculum intention → lesson preparation</div>
                  <div className={styles.lessonRow}><GraduationCap size={15} aria-hidden="true" />Lesson delivery → learner response</div>
                  <div className={styles.lessonRow}><ClipboardCheck size={15} aria-hidden="true" />Evidence → assessment and next action</div>
                </div>
                <p className={styles.nextAction}>This demo contains no class results, school statistics or private student records.</p>
                <Link href="/institutions" className={styles.inlineAction}>Explore the institutional platform <ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
            </div>}
          </div>
        </div>
        <div className={styles.demoDisclosure}><span>LIVE PLATFORM ENTRY</span><p>These previews explain how VibeSchool is designed to connect learning. For the existing interactive public product demonstration, open the VibeSchool sandbox.</p><Link href="/sandbox">Experience VibeSchool <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </div>
    </section>

    <section className={styles.flowSection} aria-labelledby="flow-heading">
      <div className={styles.wrap}>
        <div><p className={styles.sectionEyebrow}>THE VIBESCHOOL DIFFERENCE</p><h2 id="flow-heading">Not another collection of disconnected tools.</h2><p>One learning intention can travel from a teacher's preparation to a learner's response and the next educational decision.</p><Link href="/evidence" className={styles.flowLink}>Learn about evidence and trust <ArrowRight size={16} aria-hidden="true" /></Link></div>
        <ol className={styles.flowList}>
          <li><span>01</span><div><strong>Plan</strong><small>Curriculum, scheme and lesson preparation</small></div></li>
          <li><span>02</span><div><strong>Teach</strong><small>Classroom activity, explanation and resources</small></div></li>
          <li><span>03</span><div><strong>Assess</strong><small>Responses, feedback and educational evidence</small></div></li>
          <li><span>04</span><div><strong>Continue</strong><small>Revision, support and the next learning step</small></div></li>
        </ol>
      </div>
    </section>

    <section className={styles.services} aria-labelledby="services-heading">
      <div className={styles.wrap}>
        <p className={styles.sectionEyebrow}>DISCOVER THE ECOSYSTEM</p>
        <h2 id="services-heading">More than the classroom.</h2>
        <p className={styles.servicesIntro}>Explore specialized services without merging their different workflows into one crowded marketplace.</p>
        <div className={styles.serviceGrid}>
          <Link href="/vibetutor" className={styles.serviceCard}><Users size={23} aria-hidden="true" /><h3>VibeTutor</h3><p>Discover tutors and tuition requests.</p><span>Explore VibeTutor <ArrowRight size={15} aria-hidden="true" /></span></Link>
          <Link href="/teacher" className={styles.serviceCard}><GraduationCap size={23} aria-hidden="true" /><h3>Teaching opportunities</h3><p>Discover teaching tools and professional pathways.</p><span>Explore teachers <ArrowRight size={15} aria-hidden="true" /></span></Link>
          <Link href="/schools" className={styles.serviceCard}><School size={23} aria-hidden="true" /><h3>Schools &amp; Pathways</h3><p>Find schools and explore future learning routes.</p><span>Explore schools <ArrowRight size={15} aria-hidden="true" /></span></Link>
        </div>
        <p className={styles.pathwaysNote}>Exploring the next stage of school? <Link href="/pathways">Explore Senior School Pathways <ArrowRight size={15} aria-hidden="true" /></Link></p>
      </div>
    </section>
  </div>
}

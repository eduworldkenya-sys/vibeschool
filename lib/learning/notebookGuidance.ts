/**
 * Outcome-aware, low-resource learner writing guidance.
 * This is presentation guidance, not a new learner record, assessment or mastery engine.
 */
export type NotebookStage = 'learn' | 'practice' | 'revision' | 'recovery' | 'teacher'

export type NotebookGuidance = Readonly<{
  invitation: string
  task: string
  alternative: string
}>

export function getNotebookGuidance(subject: string | null | undefined, stage: NotebookStage): NotebookGuidance {
  const name = (subject ?? '').trim().toLowerCase()
  const maths = /mathematics|maths|numeracy/.test(name)
  const languages = /english|kiswahili|language|literacy|indigenous/.test(name)
  const sciences = /science|agriculture|environment|health/.test(name)
  const practical = /creative|art|sport|physical|music|movement|drama/.test(name)

  const invitation = stage === 'teacher'
    ? 'Invite learners to show their thinking when the learning outcome calls for it.'
    : stage === 'revision'
      ? 'Try to remember and work independently before looking at the explanation.'
      : stage === 'recovery'
        ? 'After reviewing the explanation, try a new example and correct your earlier mistake.'
        : stage === 'practice'
          ? 'Try the question yourself before checking the answer.'
          : 'Pause after the example and try a similar task yourself.'

  const task = maths
    ? 'Use an exercise book or scrap paper to show each calculation step, explain your method, include units where needed and check your answer.'
    : languages
      ? 'Write a sentence, short response or explanation in your own words. Read it again and improve its meaning, spelling or punctuation as appropriate.'
      : sciences
        ? 'Record an observation, a labelled drawing or a short explanation, and say what your evidence shows.'
        : practical
          ? 'Make, draw, perform or demonstrate the skill first. Sketch or write a short reflection only when that helps this activity.'
          : 'Write a short explanation, draw a diagram or record the steps you used, where this helps you learn.'

  const alternative = 'No special equipment is needed. If writing is difficult or inappropriate, say the answer aloud, use objects, draw, type or demonstrate the skill. A notebook action is never automatically counted as marks, completion or mastery.'
  return { invitation, task, alternative }
}

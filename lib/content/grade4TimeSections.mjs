/**
 * Presentation-only map for the already certified Grade 4 Mathematics / Time
 * lesson-text format. Never edits the stored payload, invents questions or
 * infers that a student has completed a lesson.
 *
 * Unknown lines and section headings are preserved verbatim in their original
 * order; only the published display heading and the I CAN line are promoted
 * into the reader's accessible title and learning-goal area.
 */

export const TIME_SECTION_LABELS = Object.freeze({
  "LET'S LEARN": { id: 'understand', title: 'Understand the idea', hint: 'Read and think about the explanation.', tone: 'learn' },
  'WORKED EXAMPLE': { id: 'example', title: 'Worked example', hint: 'Follow each step to see how the answer is found.', tone: 'example' },
  'EXPLORE • TRY IT': { id: 'explore', title: 'Explore and try it', hint: 'Use simple materials and try the activity.', tone: 'explore' },
  'PRACTISE TOGETHER': { id: 'guided', title: 'Practise together', hint: 'Work through these questions with the shown explanations.', tone: 'practice' },
  'EXERCISE • TRY YOURSELF': { id: 'exercise', title: 'Try it yourself', hint: 'Write your answers before opening the feedback.', tone: 'practice' },
  'CHECK YOUR LEARNING': { id: 'check', title: 'Check your understanding', hint: 'Try the questions without looking at the answers.', tone: 'practice' },
  'ANSWERS & HELPFUL FEEDBACK': { id: 'feedback', title: 'Answers and helpful feedback', hint: 'Compare your answers and understand why.', tone: 'feedback' },
  'IF YOU NEED HELP': { id: 'support', title: 'Need more help?', hint: 'Try a simpler way of thinking about the idea.', tone: 'support' },
  'TRY A CHALLENGE': { id: 'challenge', title: 'Stretch yourself', hint: 'Take the idea a little further.', tone: 'challenge' },
  REFLECT: { id: 'reflect', title: 'Think about what you learned', hint: 'Explain the important idea in your own words.', tone: 'reflect' },
})

/** @param {string} contentText */
export function parseGrade4TimeLessonSections(contentText) {
  const text = typeof contentText === 'string' ? contentText.replace(/\r\n?/g, '\n') : ''
  const lines = text.split('\n')
  /** @type {{ id: string, title: string, hint: string, tone: string, body: string }[]} */
  const sections = []
  let title = ''
  let goal = ''
  let current = { id: 'opening', title: 'Start here', hint: '', tone: 'learn', lines: /** @type {string[]} */ ([]) }
  function flush() {
    const body = current.lines.join('\n').trim()
    if (body) sections.push({ id: current.id, title: current.title, hint: current.hint, tone: current.tone, body })
  }

  for (const originalLine of lines) {
    const line = originalLine.trim()
    const publishedTitle = /^LESSON\s+\d+\s+•\s+(.+)$/i.exec(line)
    if (publishedTitle && !title && !current.lines.some(x => x.trim())) {
      title = publishedTitle[1].trim()
      continue
    }
    if (/^I CAN:\s*/i.test(line) && !goal && current.id === 'opening') {
      goal = line.replace(/^I CAN:\s*/i, '').trim()
      continue
    }
    const definition = TIME_SECTION_LABELS[line]
    if (definition) {
      flush()
      current = { ...definition, lines: [] }
      continue
    }
    current.lines.push(originalLine)
  }
  flush()
  return { title, goal, sections }
}

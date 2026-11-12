/**
 * Read-only presentation adapter for the already released Grade 4 Time
 * manuscripts. E/Q question IDs are only used internally to join each
 * published question with its published Answer/Why lines. No new answers,
 * exam-bank questions, scores, attempts or mastery records are generated.
 */

const ITEM = /^VS-G04-MA-TIME-L(?:0[1-9]|10)-([GEQ])(\d+):\s*(.+)$/;

/** @param {string} body */
export function parseTimeQuestionEntries(body) {
  if (typeof body !== 'string') return [];
  /** @type {{id:string,kind:string,prompt:string}[]} */
  const entries = [];
  let current = null;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const match = ITEM.exec(line);
    if (match) {
      if (current) entries.push(current);
      current = { id: line.slice(0, line.indexOf(':')), kind: match[1], prompt: match[3] };
    } else if (current && line) {
      // Multiple-line published question prompts are preserved.
      current.prompt += '\n' + raw.trim();
    }
  }
  if (current) entries.push(current);
  return entries;
}

/** @param {string} body */
export function parseTimeAnswerEntries(body) {
  if (typeof body !== 'string') return [];
  const entries = [];
  let current = null;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const match = ITEM.exec(line);
    if (match) {
      if (current) entries.push(current);
      current = { id: line.slice(0, line.indexOf(':')), answer: '', why: '' };
    } else if (current && /^Answer:\s*/i.test(line)) {
      current.answer = line.replace(/^Answer:\s*/i, '').trim();
    } else if (current && /^Why:\s*/i.test(line)) {
      current.why = line.replace(/^Why:\s*/i, '').trim();
    } else if (current && line) {
      // Unrecognised published content is not consumed or silently discarded:
      // the full manuscript feedback section remains available separately.
    }
  }
  if (current) entries.push(current);
  return entries;
}

/**
 * @param {{id: string, body: string}[]} sections
 * @returns {{exercise: Array<{id:string,kind:string,prompt:string,answer:string,why:string}>, check: Array<{id:string,kind:string,prompt:string,answer:string,why:string}>}}
 */
export function buildTimeQuestionCards(sections) {
  const feedback = sections.find(section => section.id === 'feedback')?.body ?? '';
  const answers = parseTimeAnswerEntries(feedback);
  const counts = new Map();
  for (const entry of answers) counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  const unique = new Map(answers.filter(entry => counts.get(entry.id) === 1).map(entry => [entry.id, entry]));

  function forSection(sectionId, kind) {
    const original = sections.find(section => section.id === sectionId)?.body ?? '';
    const entries = parseTimeQuestionEntries(original);
    // A single published question is valid. Missing stable IDs are never
    // guessed; caller can retain the original section as a text fallback.
    if (!entries.length) return [];
    const distinct = new Set(entries.map(entry => entry.id));
    if (distinct.size !== entries.length || entries.some(entry => entry.kind !== kind)) return [];
    return entries.map(entry => {
      const feedback = unique.get(entry.id);
      return { ...entry, answer: feedback?.answer ?? '', why: feedback?.why ?? '' };
    });
  }
  return { exercise: forSection('exercise', 'E'), check: forSection('check', 'Q') };
}

/** Progressive, general study prompts only; never new source facts or grades. */
export function timeStudyHint(lessonNumber, level) {
  if (level === 1) return 'Look back at the worked example. What did the learner do first?';
  if (lessonNumber === 1) return 'Think about where the event belongs in the day: before or after midday.';
  if (lessonNumber === 2) return 'Read the long hand in groups of five minutes, then read the short hand.';
  if (lessonNumber === 4) return 'Group every complete hour into 60 minutes, then count any extra minutes.';
  return 'Use the lesson explanation or a drawing to work through one small step at a time.';
}

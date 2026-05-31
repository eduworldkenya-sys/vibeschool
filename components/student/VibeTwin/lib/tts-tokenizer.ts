// components/student/VibeTwin/lib/tts-tokenizer.ts
// Zero lookbehind — safe on Android WebView 4+, Safari < 16.4, all browsers

const ABBREV_PLACEHOLDER = '|||'

const ABBREVIATIONS = [
  'e.g.', 'i.e.', 'dr.', 'mr.', 'mrs.', 'ms.',
  'st.', 'vs.', 'etc.', 'prof.', 'jr.', 'sr.',
]

export function tokenizeSentences(text: string): string[] {
  if (!text.trim()) return []

  // Step 1: protect known abbreviations by replacing dots with placeholder
  let protected_ = text
  for (const abbr of ABBREVIATIONS) {
    const safe = abbr.replace('.', ABBREV_PLACEHOLDER)
    protected_ = protected_.split(abbr).join(safe)
  }

  // Step 2: split on sentence-ending punctuation followed by whitespace
  // Capturing group preserves the punctuation character
  const raw = protected_.split(/([.!?])\s+/)

  // Step 3: reassemble — split with capturing group gives:
  // [text, punct, text, punct, ...]
  const sentences: string[] = []
  for (let i = 0; i < raw.length; i += 2) {
    const body  = raw[i]     ?? ''
    const punct = raw[i + 1] ?? ''
    const sentence = (body + punct).trim()
    if (sentence) {
      // Step 4: restore abbreviation dots
      sentences.push(sentence.split(ABBREV_PLACEHOLDER).join('.'))
    }
  }

  // Fallback — if nothing split, return original text as single sentence
  return sentences.length > 0 ? sentences : [text]
}

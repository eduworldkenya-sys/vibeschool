// components/student/VibeTwin/lib/intent.ts
import type { VibeIntent } from '../types'

// Each intent is a separate named pattern — independently testable
// No broken ^$ anchors inside alternation groups
const INTENT_PATTERNS: Array<{ intent: VibeIntent; pattern: RegExp }> = [
  {
    intent: 'CONVERSATIONAL',
    pattern: /^(hi|hey|hello|sup|hola)$|\b(how are you|you okay|you good|are you fine|who are you|what are you|what can you do|thank you|thanks|asante|goodbye|see you|bye)\b/i,
  },
  {
    intent: 'NEWS',
    pattern: /\b(news|today|happened|latest|headline|breaking)\b/i,
  },
  {
    intent: 'QUESTION',
    pattern: /\b(what is|explain|who is|how does|define|tell me about)\b/i,
  },
  {
    intent: 'READ',
    pattern: /\b(read me|listen|play|open|read it)\b/i,
  },
  {
    intent: 'LESSON',
    pattern: /\b(lesson|notes|form|kcse|kcpe|subject|topic|study)\b/i,
  },
]

export function classifyIntent(text: string): VibeIntent {
  const t = text.trim()
  for (const { intent, pattern } of INTENT_PATTERNS) {
    if (pattern.test(t)) return intent
  }
  return 'GENERAL'
}

// Stop-word set — O(1) lookup, extensible
const STOP_WORDS = new Set([
  'what', 'is', 'explain', 'who', 'how', 'does', 'define',
  'tell', 'me', 'about', 'lesson', 'on', 'notes', 'study',
  'for', 'the', 'a', 'an', 'and', 'of', 'in', 'to', 'i',
  'my', 'can', 'you', 'do', 'are', 'was', 'were', 'be',
])

export function extractTopic(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w))

  return words.slice(0, 4).join(' ') || 'general'
}

// Conversational replies — zero API cost, instant
export function conversationalReply(query: string, userName: string): string {
  const t = query.toLowerCase()
  if (/\b(how are you|you okay|you good|are you fine)\b/i.test(t))
    return `Vibing and ready to learn! What topic are we exploring today, ${userName}?`
  if (/^(hi|hey|hello|sup|hola)$/i.test(t))
    return `Hey ${userName}! Ask me about news, lessons, science, history — anything. What are we learning?`
  if (/\b(who are you|what are you|what can you do)\b/i.test(t))
    return `I am Vibe Twin — your learning companion. Ask me news, questions, or say "open biology notes" and I will find it for you.`
  if (/\b(thank you|thanks|asante)\b/i.test(t))
    return `Anytime, ${userName}! Keep vibing. What else do you want to know?`
  if (/\b(bye|goodbye|see you)\b/i.test(t))
    return `Stay curious, ${userName}. Come back when you are ready to learn more. ✦`
  return `Vibe, ${userName}. Try asking me something like "what is climate change" or "Kenya news today".`
}

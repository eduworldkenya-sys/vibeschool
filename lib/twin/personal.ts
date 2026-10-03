import type { TwinRole } from './core'

export type TwinIntent =
  | { kind: 'search'; query: string }
  | { kind: 'navigate'; query: string }
  | { kind: 'mark'; student: string; subject: string; exam: string; score: number }
  | { kind: 'memory' | 'forget' | 'predict' | 'continue' | 'help' }
  | { kind: 'preference'; enabled?: boolean; collective?: boolean }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'domain'; query: string }

export interface TwinLink { id: string; title: string; detail: string; route: string; kind: string }
export interface TwinObservation {
  id: string; role: TwinRole; scope_id: string; route: string; action: string;
  previous_action: string | null; created_at: string
}
export interface TwinSettings { enabled: boolean; collective: boolean }
export interface TwinPrediction {
  title: string; route: string; evidence: string[]; confidence: 'limited' | 'supported';
  source: 'personal' | 'school'; expiresAt: string
}

export const normalizeTwinText = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
export function safeTwinRoute(route: string, role: TwinRole): boolean {
  if (!route.startsWith('/') || route.startsWith('//') || /[\\\r\n]/.test(route)) return false
  try {
    const decoded = decodeURIComponent(route.split(/[?#]/)[0])
    if (decoded.includes('\\') || decoded.split('/').some(part => part === '.' || part === '..')) return false
    const url = new URL(route, 'https://vibeschool.co.ke')
    return url.origin === 'https://vibeschool.co.ke' && (url.pathname === `/${role}` || url.pathname.startsWith(`/${role}/`))
  } catch { return false }
}

const wordScores: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
}
function scoreNumber(value: string): number {
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value)
  const parts = value.replaceAll('-', ' ').split(' ')
  if (parts.length === 1) return wordScores[parts[0]] ?? NaN
  if (parts.length === 2 && (wordScores[parts[0]] ?? 0) >= 20 && (wordScores[parts[0]] ?? 101) < 100 && (wordScores[parts[1]] ?? 10) < 10) return wordScores[parts[0]] + wordScores[parts[1]]
  return NaN
}

/** Interpretation never grants authority or executes a write. Unsupported writes fail closed. */
export function interpretTwinCommand(input: string): TwinIntent {
  const q = normalizeTwinText(input)
  if (!q || q.length > 500) return { kind: 'unsupported', reason: 'Use a request between 1 and 500 characters.' }
  if (/^(?:help|what can you do|what can twin do|how does twin work)[?]?$/.test(q)) return { kind: 'help' }
  if (/^(?:my memory|show (?:my |your )?memory|what do you remember|what have you learned)[?]?$/.test(q)) return { kind: 'memory' }
  if (/^(?:forget my activity|clear my twin memory|forget everything)[?]?$/.test(q)) return { kind: 'forget' }
  if (/^(?:pause|stop|disable) (?:twin )?(?:learning|memory|tracking)$/.test(q)) return { kind: 'preference', enabled: false }
  if (/^(?:resume|enable|start) (?:twin )?(?:learning|memory|tracking)$/.test(q)) return { kind: 'preference', enabled: true }
  if (/^(?:enable|disable) collective learning$/.test(q)) return { kind: 'preference', collective: q.startsWith('enable') }
  if (/^(?:predict|what next|suggest next|my patterns|what should i do next)[?]?$/.test(q)) return { kind: 'predict' }
  if (/^(?:continue|continue where i stopped|resume my work|open that again)[?]?$/.test(q)) return { kind: 'continue' }
  // "Add 40 marks" sets an absolute score; the review explicitly says "set", never increments.
  const first = q.match(/^(?:add|record|set|give|save) ([\w.-]+(?: (?!marks?\b)[\w-]+)?) (?:marks? )?(?:to|for) (.+?) (?:in|for) (.+?) (cat(?: \d+)?|exam|test|assessment|midterm|end term)(?: (.+))?$/)
  const second = q.match(/^(?:give|set|record|save) (.+?) (\d+(?:\.\d+)?|[a-z-]+) (?:marks? )?(?:in|for) (.+?) (cat(?: \d+)?|exam|test|assessment|midterm|end term)(?: (.+))?$/)
  if (first || second) {
    const m = first ?? second!
    const score = scoreNumber(first ? m[1] : m[2])
    if (!Number.isFinite(score) || score < 0 || score > 100) return { kind: 'unsupported', reason: 'Enter a score from 0 to 100. The current markbook uses a maximum of 100.' }
    return { kind: 'mark', score, student: first ? m[2] : m[1], subject: m[3].replace(/^(?:my|the) /, ''), exam: `${m[4]}${m[5] ? ` ${m[5]}` : ''}` }
  }
  if (/^(?:add|record|set|give|save|change|move|delete|remove|send|assign|publish|complete|start|create)\b/.test(q)) return { kind: 'unsupported', reason: 'I need a supported, clear command before changing a record. I can record an individual CAT/exam score, or open the right tool for attendance, homework, groups, lessons and reports.' }
  const open = q.match(/^(?:open|go to|take me to|show me|find|search(?: for)?|look for) (.+)$/)
  if (open) return { kind: /^(?:open|go to|take me to)/.test(q) ? 'navigate' : 'search', query: open[1] }
  return { kind: 'domain', query: q }
}

export function matchTwinLinks(query: string, links: TwinLink[]): TwinLink[] {
  const aliases: Record<string, string> = { maths: 'mathematics', math: 'mathematics', kids: 'students', learners: 'students', roster: 'class list', marks: 'results', cat: 'exam', tr: 'teacher' }
  const tokens = normalizeTwinText(query).split(' ').filter(t => !['my','the','a','an','me','please'].includes(t)).map(t => aliases[t] ?? t)
  return links.map(link => {
    const title = normalizeTwinText(link.title)
    const haystack = normalizeTwinText(`${link.title} ${link.detail} ${link.kind}`).split(' ').map(t => aliases[t] ?? t).join(' ')
    const exact = title === normalizeTwinText(query)
    return { link, score: exact ? 100 : tokens.filter(t => haystack.includes(t)).length / Math.max(tokens.length, 1) }
  }).filter(x => x.score >= 0.65).sort((a,b) => b.score-a.score || a.link.title.localeCompare(b.link.title)).slice(0,20).map(x => x.link)
}

export function predictTwinNext(observations: TwinObservation[], role: TwinRole, scopeId: string, now = new Date()): TwinPrediction[] {
  const cutoff = now.getTime() - 30 * 86400000
  const rows = observations.filter(x => x.role === role && x.scope_id === scopeId && safeTwinRoute(x.route, role) && new Date(x.created_at).getTime() >= cutoff && new Date(x.created_at).getTime() <= now.getTime())
  const latest = rows[0]
  if (!latest) return []
  const transitions = rows.filter(x => x.previous_action === latest.action && x.action !== latest.action && x.action !== 'dismissed')
  const counts = new Map<string, TwinObservation[]>()
  for (const row of transitions) counts.set(row.route, [...(counts.get(row.route) ?? []), row])
  return Array.from(counts.entries()).filter(([,samples]) => samples.length >= 3).sort((a,b) => b[1].length-a[1].length).slice(0,3).map(([route,samples]) => ({
    title: `You often open ${samples[0].action.replaceAll('_',' ')} after ${latest.action.replaceAll('_',' ')}`,
    route, confidence: samples.length >= 5 && samples.length / Math.max(transitions.length,1) >= .7 ? 'supported' : 'limited', source: 'personal',
    evidence: [`${samples.length} of ${transitions.length} recorded next actions in this role and scope during the last 30 days.`, 'Observed activity is a preference signal, not proof of learning or performance.'],
    expiresAt: new Date(now.getTime()+30*60000).toISOString(),
  }))
}

export function twinScreenAction(path: string): string {
  const parts = path.split('/').filter(Boolean)
  const screen = parts[1] ?? 'home'
  return ['attendance','results','assessment','homework','timetable','scheme','classhub','students','lessonplan','teach','resources','reports'].includes(screen) ? screen : 'home'
}

export interface TwinScoreEvidence { studentId:string;classId:string;subjectId:string;score:number;isAbsent:boolean;examId:string;examOrder:number }
export interface TwinLearningSignal { studentId:string;classId:string;subjectId:string;kind:'declining_scores'|'low_score';evidence:string[] }
/** Support signals describe recorded evidence; they never label a learner or invent a failure probability. */
export function deriveTwinLearningSignals(scores:TwinScoreEvidence[],threshold=40):TwinLearningSignal[] {
  const groups=new Map<string,TwinScoreEvidence[]>()
  for(const score of scores){
    if(score.isAbsent||!Number.isFinite(score.score)||score.score<0||score.score>100)continue
    const key=`${score.classId}:${score.studentId}:${score.subjectId}`
    groups.set(key,[...(groups.get(key)??[]),score])
  }
  return Array.from(groups.values()).flatMap<TwinLearningSignal>(group=>{
    const recent=Array.from(new Map(group.sort((a,b)=>b.examOrder-a.examOrder).map(s=>[s.examId,s])).values()).slice(0,3)
    const latest=recent[0]
    if(!latest)return[]
    if(recent.length===3 && recent[0].score<recent[1].score && recent[1].score<recent[2].score)return[{studentId:latest.studentId,classId:latest.classId,subjectId:latest.subjectId,kind:'declining_scores',evidence:[`Recorded scores: ${recent.slice().reverse().map(s=>`${s.score}/100`).join(' → ')} across three assessments.`, 'This trend is a reason to review support, not a forecast that the learner will fail.']}]
    if(latest.score<threshold)return[{studentId:latest.studentId,classId:latest.classId,subjectId:latest.subjectId,kind:'low_score',evidence:[`Latest recorded score: ${latest.score}/100; the requested threshold is ${threshold}/100.`,recent.length<3?'There are fewer than three scored assessments; no trend is inferred.':'No sustained decline is inferred from these assessments.']}]
    return[]
  })
}

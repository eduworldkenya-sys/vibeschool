export type NarrationVoiceLike = {
  name: string
  lang: string
  default?: boolean
  localService?: boolean
}

const SUBSCRIPTS: Record<string,string> = {
  '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9',
}

function expandChemicalToken(token:string):string {
  const normalized = token.split('').map(ch => SUBSCRIPTS[ch] ?? ch).join('')
  return normalized.replace(/([A-Z][a-z]?)(\d*)/g,(_,symbol:string,count:string)=>`${symbol}${count ? ` ${count}` : ''} `).replace(/\s+/g,' ').trim()
}

export function normalizeNarrationText(input:string):string {
  let value = input
    .replace(/<[^>]+>/g,' ')
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g,ch=>SUBSCRIPTS[ch] ?? ch)
    .replace(/(\d+(?:\.\d+)?)\s*°\s*C\b/gi,'$1 degrees Celsius')
    .replace(/(\d+(?:\.\d+)?)\s*%/g,'$1 percent')
    .replace(/→|⟶|⇒/g,' yields ')
    .replace(/⇌|↔/g,' is in equilibrium with ')
    .replace(/\s\+\s/g,' plus ')
    .replace(/\s=\s/g,' equals ')

  value = value.replace(/\b(?:[A-Z][a-z]?\d*){2,}\b/g,match=>expandChemicalToken(match))
  return value.replace(/\s+/g,' ').trim()
}

export function chunkNarrationText(input:string,maxChars=620):string[] {
  const text = normalizeNarrationText(input)
  if (!text) return []
  const sentences = text.split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean)
  const chunks:string[]=[]
  let current=''
  for (const sentence of sentences.length ? sentences : [text]) {
    if (sentence.length > maxChars) {
      if (current) { chunks.push(current); current='' }
      for (let i=0;i<sentence.length;i+=maxChars) chunks.push(sentence.slice(i,i+maxChars).trim())
      continue
    }
    const candidate = current ? `${current} ${sentence}` : sentence
    if (candidate.length > maxChars && current) { chunks.push(current); current=sentence }
    else current=candidate
  }
  if (current) chunks.push(current)
  return chunks
}

function voiceQuality(name:string):number {
  const n=name.toLowerCase()
  if (/natural|neural|enhanced|premium/.test(n)) return 40
  if (/google|microsoft|samsung/.test(n)) return 18
  return 0
}

export function scoreNarrationVoice(voice:NarrationVoiceLike):number {
  const lang=(voice.lang||'').toLowerCase()
  let score=voiceQuality(voice.name||'')
  if (lang==='en-ke') score+=100
  else if (lang.startsWith('en-ke')) score+=92
  else if (lang==='en-za') score+=72
  else if (lang.startsWith('en-')) score+=55
  else if (lang==='en') score+=45
  if (voice.localService) score+=5
  if (voice.default) score+=2
  return score
}

export function chooseNarrationVoice<T extends NarrationVoiceLike>(voices:T[],preferredName?:string|null):T|null {
  if (!voices.length) return null
  if (preferredName) {
    const preferred=voices.find(v=>v.name===preferredName)
    if (preferred && scoreNarrationVoice(preferred) >= 45) return preferred
  }
  return [...voices].sort((a,b)=>scoreNarrationVoice(b)-scoreNarrationVoice(a))[0] ?? null
}

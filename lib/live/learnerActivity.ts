/**
 * Client-only presentation helpers for learner activity. The authenticated
 * classroom RPC remains the sole authority for questions, responses and notes.
 */
export type LiveAnswerChoice = {letter:string; text:string; value:string}

/** Only turn explicit A. / B) / C: options into accessible radio answers.
 * Numbered explanations and ordinary lesson paragraphs remain free text.
 */
export function liveAnswerChoices(body:string):LiveAnswerChoice[]{
  if(typeof body!=='string'||body.length>4000)return []
  const matches=body.split(/\r?\n/).map(line=>line.match(/^\s*([A-Fa-f])[.):]\s*(\S.{0,139})\s*$/)).filter((match):match is RegExpMatchArray=>match!==null)
  if(matches.length<2||matches.length>6)return []
  const letters=matches.map(match=>match[1].toUpperCase())
  if(letters.some((letter,index)=>letter!==String.fromCharCode(65+index)))return []
  return matches.map((match,index)=>({letter:letters[index],text:match[2].trim(),value:letters[index]+'. '+match[2].trim()}))
}

/** Move private working into the existing 8,000-character notes field.
 * No browser storage, classroom broadcast or separate resource authority.
 */
export function addWorkToPrivateNotes(notes:string,work:string):string|null{
  const working=work.trim()
  if(!working||working.length>2000)return null
  const original=notes.trim()
  const combined=(original?original+'\n\n':'')+'Working:\n'+working
  return combined.length<=8000?combined:null
}

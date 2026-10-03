import { openPersonalTwinSession, prepareTwinMark, confirmPersonalTwinMark, type MarkProposal } from './service'
import { interpretTwinCommand } from './personal'
export interface TeacherTwinActionProposal { action:MarkProposal;summary:string;confirmationLabel:string }
export async function proposeTeacherTwinAction(input:string):Promise<TeacherTwinActionProposal|null> {
  const intent=interpretTwinCommand(input)
  if(intent.kind!=='mark')return null
  const result=await prepareTwinMark(await openPersonalTwinSession('teacher'),intent)
  if(!result.proposal)throw new Error(result.text)
  return {action:result.proposal,summary:result.text,confirmationLabel:`Save ${intent.score}/100`}
}
export async function executeTeacherTwinAction(action:MarkProposal):Promise<string> {
  return (await confirmPersonalTwinMark(action)).text
}

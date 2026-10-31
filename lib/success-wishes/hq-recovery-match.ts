import {hashSecret,equalHash} from './security'
import {nameKey} from './receiver-pin'

/** Untrusted recovery enquiries never authorize access; this is an HQ-only suggestion. */
export type RecoveryReview = {
 id:string; exam_year:string; phone_digest:string; name_digest:string; status:string
}
export type RecoveryReceiver = {
 id:string; display_name:string; school_label:string|null; phone_e164:string
 pin_exam_year:string|null; pin_hash:string|null; consent_status:string|null
}
export type RecoveryCandidate = {
 id:string; name:string; school:string; examYear:string; maskedPhone:string
}
const maskPhone=(phone:string)=>phone.length>=4?'•••• '+phone.slice(-4):'Hidden'
export function matchingRecoveryCandidates(review:RecoveryReview,receivers:RecoveryReceiver[]):RecoveryCandidate[]{
 if(review.status!=='pending'&&review.status!=='reviewing')return []
 return receivers.filter(r=>
  !!r.pin_hash && r.consent_status!=='revoked' &&
  r.pin_exam_year===review.exam_year &&
  equalHash(hashSecret('success-wishes:recovery-review:phone:'+r.phone_e164),review.phone_digest) &&
  equalHash(hashSecret('success-wishes:recovery-review:name:'+nameKey(r.display_name)),review.name_digest)
 ).map(r=>({
  id:r.id,name:r.display_name,school:r.school_label||'School not supplied',
  examYear:r.pin_exam_year!,maskedPhone:maskPhone(r.phone_e164)
 }))
}

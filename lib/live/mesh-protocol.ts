export type MeshState = {role:'teacher'|'learner';epoch:number;peerPresent:boolean;offer:string|null;answer:string|null;speaking:boolean;fallback:boolean;expiresAt:string;learnerStudentId:string|null};
export function audioSdp(sdp:unknown):sdp is string {
  if(typeof sdp!=='string'||sdp.length>24000||!/^v=0\r?\n/.test(sdp))return false;
  const lines=sdp.split(/\r?\n/),media=lines.filter(x=>/^m=/i.test(x));
  return media.length===1&&/^m=audio \d+ UDP\/TLS\/RTP\/SAVPF /i.test(media[0])&&lines.some(x=>x.startsWith('a=fingerprint:'))&&!lines.some(x=>x.startsWith('a=rtpmap:')&&/\b(?:H264|VP8|VP9|AV1)\//i.test(x));
}
export function validateMeshState(x:unknown,teacher:boolean,now=Date.now()):MeshState {
  if(!x||typeof x!=='object')throw Error('Invalid voice authorization');
  const s=x as Partial<MeshState>;
  if(s.role!==(teacher?'teacher':'learner')||!Number.isSafeInteger(s.epoch)||Number(s.epoch)<0||typeof s.peerPresent!=='boolean'||typeof s.speaking!=='boolean'||typeof s.fallback!=='boolean'||(s.fallback&&(s.peerPresent||s.speaking||s.offer!==null||s.answer!==null||s.learnerStudentId!==null))||!(s.learnerStudentId===null||(teacher&&typeof s.learnerStudentId==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s.learnerStudentId)))||typeof s.expiresAt!=='string'||!Number.isFinite(Date.parse(s.expiresAt))||Date.parse(s.expiresAt)<=now||!(s.offer===null||audioSdp(s.offer))||!(s.answer===null||audioSdp(s.answer))||(teacher?s.offer!==null:s.answer!==null))throw Error('Invalid voice authorization');
  return s as MeshState;
}
export function gatherIce(pc:RTCPeerConnection,signal:AbortSignal):Promise<void>{
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(Error('Connection closed'));return;}
    if(pc.iceGatheringState==='complete'){resolve();return;}
    const cleanup=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',check);signal.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();reject(Error('Connection closed'));};
    const check=()=>{if(pc.iceGatheringState==='complete'){cleanup();resolve();}};
    const timer=setTimeout(()=>{cleanup();reject(Error('Network discovery timed out'));},8000);
    pc.addEventListener('icegatheringstatechange',check);signal.addEventListener('abort',abort,{once:true});check();
  });
}

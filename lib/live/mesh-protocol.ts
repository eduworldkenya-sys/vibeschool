export type MeshPeer = {
  studentId: string
  epoch: number
  speaking: boolean
  offer: string | null
  answer: string | null
}

export type MeshState = {
  role: 'teacher' | 'learner'
  peers: MeshPeer[]
  fallback: boolean
  expiresAt: string
}

export const MAX_MESH_LEARNERS = 8
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export function audioSdp(sdp:unknown):sdp is string {
  if(typeof sdp!=='string'||sdp.length>24000||!/^v=0\r?\n/.test(sdp))return false;
  const lines=sdp.split(/\r?\n/),media=lines.filter(x=>/^m=/i.test(x));
  return media.length===1&&/^m=audio \d+ UDP\/TLS\/RTP\/SAVPF /i.test(media[0])&&lines.some(x=>x.startsWith('a=fingerprint:'))&&!lines.some(x=>x.startsWith('a=rtpmap:')&&/\b(?:H264|VP8|VP9|AV1)\//i.test(x));
}
export function validateMeshState(x:unknown,teacher:boolean,now=Date.now()):MeshState {
  if(!x||typeof x!=='object')throw Error('Invalid voice authorization');
  const s = x as Partial<MeshState>
  if (s.role !== (teacher ? 'teacher' : 'learner') || typeof s.fallback !== 'boolean'
    || typeof s.expiresAt !== 'string' || !Number.isFinite(Date.parse(s.expiresAt)) || Date.parse(s.expiresAt) <= now
    || !Array.isArray(s.peers) || s.peers.length > (teacher ? MAX_MESH_LEARNERS : 1)
    || (s.fallback && s.peers.length !== 0)) throw Error('Invalid voice authorization')

  const ids = new Set<string>()
  let speaker = false
  for (const peer of s.peers) {
    if (!peer || typeof peer.studentId !== 'string' || !UUID.test(peer.studentId)
      || ids.has(peer.studentId) || !Number.isSafeInteger(peer.epoch) || peer.epoch < 0
      || typeof peer.speaking !== 'boolean' || (speaker && peer.speaking)
      || !(peer.offer === null || audioSdp(peer.offer)) || !(peer.answer === null || audioSdp(peer.answer))
      || (teacher ? peer.offer !== null : peer.answer !== null)) throw Error('Invalid voice peer')
    ids.add(peer.studentId)
    speaker ||= peer.speaking
  }
  return { role: s.role, peers: s.peers, fallback: s.fallback, expiresAt: s.expiresAt }
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

/** A bounded request signal using widely supported AbortController APIs.
 * Disposing after every request removes timers and parent listeners. */
export function meshRequestSignal(parents:readonly AbortSignal[],timeoutMs:number){
  const controller=new AbortController()
  const abort=()=>controller.abort()
  for(const parent of parents){
    if(parent.aborted){abort();break}
    parent.addEventListener('abort',abort,{once:true})
  }
  const timer=setTimeout(abort,timeoutMs)
  return {signal:controller.signal,dispose:()=>{
    clearTimeout(timer)
    for(const parent of parents)parent.removeEventListener('abort',abort)
  }}
}

export function meshFailureMessage(error:{code?:string;message?:string}){
  if(error.code==='42501'&&error.message==='mesh_lease_lost')
    return 'Audio authorization expired. Retry audio to reconnect.'
  if(error.code==='42501')
    return 'Direct audio is not authorized for this session. Check classroom audio availability.'
  if(error.code==='P0001'&&error.message==='mesh_device_busy')
    return 'Audio is active on another device or tab. Close it, then retry audio.'
  if(error.code==='53000'&&error.message==='mesh_full')
    return 'Classroom audio is full. Retry when a seat is free.'
  return 'Direct audio connection failed. Check your internet connection and retry.'
}

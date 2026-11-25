export const MINI_VOICE_SECONDS = 60
export const MINI_VOICE_INPUT_BYTES = 15 * 1024 * 1024
export const MINI_VOICE_RATE = 16000

// Canonical mono PCM WAV makes imported and recorded formats consistent.
export async function prepareMiniVoice(input: Blob): Promise<File> {
  if (!input.size || input.size > MINI_VOICE_INPUT_BYTES) throw Error('Choose audio under 15 MB.')
  const ctx = new AudioContext()
  try {
    const decoded = await ctx.decodeAudioData(await input.arrayBuffer())
    if (!Number.isFinite(decoded.duration) || decoded.duration < 1 || decoded.duration > MINI_VOICE_SECONDS)
      throw Error('Use a voice clip between 1 and 60 seconds.')
    const length = Math.ceil(decoded.duration * MINI_VOICE_RATE)
    const offline = new OfflineAudioContext(1, length, MINI_VOICE_RATE)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    const samples = (await offline.startRendering()).getChannelData(0)
    const bytes = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(bytes)
    const text = (offset: number, value: string) => {
      for (let i=0;i<value.length;i++) view.setUint8(offset+i,value.charCodeAt(i))
    }
    text(0,'RIFF'); view.setUint32(4,bytes.byteLength-8,true); text(8,'WAVE')
    text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true)
    view.setUint16(22,1,true);view.setUint32(24,MINI_VOICE_RATE,true)
    view.setUint32(28,MINI_VOICE_RATE*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true)
    text(36,'data');view.setUint32(40,samples.length*2,true)
    for(let i=0;i<samples.length;i++) {
      const s=Math.max(-1,Math.min(1,samples[i]))
      view.setInt16(44+i*2,s<0?s*32768:s*32767,true)
    }
    return new File([bytes],'voice.wav',{type:'audio/wav'})
  } finally { await ctx.close().catch(()=>undefined) }
}

export function validateMiniVoice(bytes: Uint8Array): number {
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  const tag=(p:number)=>String.fromCharCode(...bytes.subarray(p,p+4))
  if(bytes.length<32044||bytes.length>1920044||tag(0)!=='RIFF'||tag(8)!=='WAVE'||tag(12)!=='fmt '||tag(36)!=='data'||
    v.getUint32(4,true)!==bytes.length-8||v.getUint32(16,true)!==16||v.getUint16(20,true)!==1||
    v.getUint16(22,true)!==1||v.getUint32(24,true)!==16000||v.getUint32(28,true)!==32000||
    v.getUint16(32,true)!==2||v.getUint16(34,true)!==16||v.getUint32(40,true)!==bytes.length-44||(bytes.length-44)%2)
    throw Error('Invalid voice audio.')
  return (bytes.length-44)/32000
}

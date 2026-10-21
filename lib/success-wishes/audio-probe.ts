import {createHash,randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import {writeFile,unlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {validVoiceUpload,VOICE_MAX_SECONDS} from './voice'

export type AudioProbeResult={durationSeconds:number;sha256:string;byteSize:number;mimeType:string}
type Stream={codec_type?:unknown;codec_name?:unknown;duration?:unknown}
type Report={format?:{format_name?:unknown;duration?:unknown};streams?:Stream[]}
const SUPPORTED:Record<string,{format:RegExp;codecs:string[]}>={
 'audio/webm':{format:/matroska|webm/i,codecs:['opus','vorbis']},
 'audio/mp4':{format:/mov|mp4|m4a|3gp/i,codecs:['aac','alac']},
 'audio/mpeg':{format:/mp3/i,codecs:['mp3']},
 'audio/ogg':{format:/ogg/i,codecs:['opus','vorbis']},
}
export function parseTrustedAudioProbe(mime:string,bytes:Uint8Array,value:unknown):AudioProbeResult{
 validVoiceUpload(mime,bytes.byteLength)
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid audio inspection result.')
 const report=value as Report
 const format=report.format
 const streams=report.streams
 const known=SUPPORTED[mime]
 if(!format||!Array.isArray(streams)||streams.length!==1
   ||typeof format.format_name!=='string'||!known.format.test(format.format_name)
   ||streams[0]?.codec_type!=='audio'||typeof streams[0]?.codec_name!=='string'
   ||!known.codecs.includes(streams[0].codec_name))
   throw Error('Recording format or codec is not supported.')
 const duration=Number(format.duration??streams[0].duration)
 if(!Number.isFinite(duration)||duration<=0||duration>VOICE_MAX_SECONDS)
   throw Error('Recording must be 60 seconds or shorter.')
 return {
   durationSeconds:duration,
   sha256:createHash('sha256').update(bytes).digest('hex'),
   byteSize:bytes.byteLength,mimeType:mime,
 }
}
export function trustedAudioProbeReady(env:Record<string,string|undefined>=process.env):boolean{
 return env.SUCCESS_WISHES_AUDIO_PROBE_ENABLED==='true'
  &&typeof env.SUCCESS_WISHES_FFPROBE_BINARY==='string'
  &&env.SUCCESS_WISHES_FFPROBE_BINARY.startsWith('/')
}
export async function inspectPrivateAudio(options:{
 bytes:Uint8Array;mime:string;env?:Record<string,string|undefined>
 probe?:(path:string)=>Promise<unknown>
}):Promise<AudioProbeResult>{
 validVoiceUpload(options.mime,options.bytes.byteLength)
 const env=options.env??process.env
 if(!trustedAudioProbeReady(env)&&!options.probe)throw Error('Trusted audio inspector is not configured.')
 const path=join(tmpdir(),'vs-private-audio-'+randomUUID())
 await writeFile(path,options.bytes,{flag:'wx',mode:0o600})
 try{
   const report=options.probe?await options.probe(path)
     :await runProbe(env.SUCCESS_WISHES_FFPROBE_BINARY!,path)
   return parseTrustedAudioProbe(options.mime,options.bytes,report)
 }finally{await unlink(path).catch(()=>{})}
}
async function runProbe(binary:string,path:string):Promise<unknown>{
 return new Promise((resolve,reject)=>{
   const p=spawn(binary,['-v','error','-probesize','5242880','-analyzeduration','10000000',
     '-show_entries','format=format_name,duration:stream=codec_type,codec_name,duration',
     '-of','json',path],{shell:false,stdio:['ignore','pipe','ignore'],timeout:12000})
   let output='';let over=false;let done=false
   const finish=(error?:Error,value?:unknown)=>{if(done)return;done=true;error?reject(error):resolve(value)}
   p.stdout.setEncoding('utf8')
   p.stdout.on('data',(chunk:string)=>{output+=chunk;if(output.length>65536){over=true;p.kill('SIGKILL')}})
   p.on('error',()=>finish(Error('Trusted audio inspection is unavailable.')))
   p.on('close',(code)=>{
     if(over||code!==0)return finish(Error('Trusted audio inspection failed.'))
     try{finish(undefined,JSON.parse(output))}catch{finish(Error('Trusted audio inspection returned invalid data.'))}
   })
 })
}

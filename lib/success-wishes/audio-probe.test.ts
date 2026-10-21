import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectPrivateAudio,parseTrustedAudioProbe,trustedAudioProbeReady} from './audio-probe'
const bytes=new Uint8Array(256).fill(7)
const webm={format:{format_name:'matroska,webm',duration:'41.532'},streams:[{codec_type:'audio',codec_name:'opus'}]}
test('inspector requires an explicitly enabled absolute binary path',()=>{
 assert.equal(trustedAudioProbeReady({}),false)
 assert.equal(trustedAudioProbeReady({SUCCESS_WISHES_AUDIO_PROBE_ENABLED:'true',SUCCESS_WISHES_FFPROBE_BINARY:'ffprobe'}),false)
 assert.equal(trustedAudioProbeReady({SUCCESS_WISHES_AUDIO_PROBE_ENABLED:'true',SUCCESS_WISHES_FFPROBE_BINARY:'/usr/bin/ffprobe'}),true)
})
test('verified recording hashes actual media bytes and enforces trusted codec and duration',async()=>{
 const expected=parseTrustedAudioProbe('audio/webm',bytes,webm)
 assert.equal(expected.durationSeconds,41.532)
 assert.equal(expected.sha256.length,64)
 assert.deepEqual(await inspectPrivateAudio({bytes,mime:'audio/webm',probe:async()=>webm}),expected)
})
test('never accepts client supplied duration, video streams, invalid codecs or excessive media',()=>{
 for(const report of [
  {...webm,format:{...webm.format,duration:'60.001'}},
  {...webm,streams:[...webm.streams,{codec_type:'video',codec_name:'h264'}]},
  {...webm,streams:[{codec_type:'audio',codec_name:'mp3'}]},
  {...webm,format:{format_name:'mp3',duration:20}},
  {...webm,format:{format_name:'webm'}},
  {...webm,format:{format_name:'webm',duration:'Infinity'}},
 ])assert.throws(()=>parseTrustedAudioProbe('audio/webm',bytes,report))
 assert.throws(()=>parseTrustedAudioProbe('audio/wav',bytes,webm))
})
test('missing configured executable keeps inspection closed',async()=>{
 await assert.rejects(inspectPrivateAudio({mime:'audio/webm',bytes,env:{}}),/not configured/)
})

import assert from 'node:assert/strict'
import {test} from 'node:test'
import {meshRequestSignal,meshFailureMessage} from './mesh-protocol.ts'

test('signaling is canceled if the room or peer is closed',()=>{
 const room=new AbortController(),peer=new AbortController()
 const request=meshRequestSignal([room.signal,peer.signal],10000)
 assert.equal(request.signal.aborted,false)
 peer.abort()
 assert.equal(request.signal.aborted,true)
 request.dispose()
 const closed=meshRequestSignal([peer.signal],10000)
 assert.equal(closed.signal.aborted,true)
 closed.dispose()
})
test('signaling deadline is bounded even without parent signals',async()=>{
 const request=meshRequestSignal([],5)
 try{
  await new Promise(resolve=>request.signal.addEventListener('abort',resolve,{once:true}))
  assert.equal(request.signal.aborted,true)
 }finally{request.dispose()}
})
test('completed request releases parent listeners and its deadline',async()=>{
 const room=new AbortController()
 const request=meshRequestSignal([room.signal],5)
 request.dispose()
 room.abort()
 await new Promise(resolve=>setTimeout(resolve,15))
 assert.equal(request.signal.aborted,false)
})
test('authorization and conflicting device errors stay actionable without leaking raw database errors',()=>{
 assert.match(meshFailureMessage({code:'42501',message:'mesh_lease_lost'}),/authorization expired/)
 assert.match(meshFailureMessage({code:'42501',message:'private database detail'}),/not authorized/)
 assert.match(meshFailureMessage({code:'P0001',message:'mesh_device_busy'}),/another device/)
 assert.match(meshFailureMessage({code:'53000',message:'mesh_full'}),/full/)
 assert.doesNotMatch(meshFailureMessage({message:'private database detail'}),/private database detail/)
})

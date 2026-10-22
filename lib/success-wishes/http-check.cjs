const {spawn}=require('node:child_process');const fs=require('node:fs');const assert=require('node:assert/strict');
;(async()=>{
const output=fs.openSync('/tmp/success-http-server.log','w');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3091'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',SUCCESS_WISHES_ENABLED:'false',SUCCESS_WISHES_STAFF_SETUP_ENABLED:'false'},stdio:['ignore',output,output]});
try{
let ready=false;for(let n=0;n<40;n++){try{const r=await fetch('http://localhost:3091/api/success-wishes/config');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}assert(ready,'server not ready');
const base='http://localhost:3091',checks=[];
const config=await fetch(base+'/api/success-wishes/config');assert.equal((await config.json()).enabled,false);assert.match(config.headers.get('cache-control'),/no-store/);checks.push('unconfigured service unavailable and no-store');
const schools=await fetch(base+'/api/success-wishes/schools?q=Alliance');assert.deepEqual(await schools.json(),{schools:[],available:false});checks.push('no school records disclosed while disabled');
const staffCandidates=await fetch(base+'/api/success-wishes/candidates?schoolId=00000000-0000-4000-8000-000000000001&q=Test');assert.equal(staffCandidates.status,503);checks.push('school candidate directory closed while disabled');
const participation=await fetch(base+'/api/success-wishes/participation?schoolId=00000000-0000-4000-8000-000000000001');assert.equal(participation.status,503);checks.push('school participation API closed while disabled');
const mySchools=await fetch(base+'/api/success-wishes/my-schools');assert.equal(mySchools.status,503);checks.push('private school membership directory closed while disabled');
const reports=await fetch(base+'/api/success-wishes/reports?schoolId=00000000-0000-4000-8000-000000000001');assert.equal(reports.status,503);checks.push('private school reports closed while disabled');
const inbox=await fetch(base+'/api/success-wishes/inbox');assert.equal(inbox.status,401);checks.push('anonymous inbox rejected');
const video=await fetch(base+'/api/success-wishes/media/playback?messageId=00000000-0000-4000-8000-000000000001');assert.equal(video.status,503);checks.push('disabled video emergency stop rejects anonymous playback');

const voice=await fetch(base+'/api/success-wishes/media/voice-playback?messageId=00000000-0000-4000-8000-000000000001');assert.equal(voice.status,503);checks.push('disabled voice emergency stop rejects anonymous playback');
const synthetic={messageId:'00000000-0000-4000-8000-000000000001',senderProof:'a'.repeat(64),requestKey:'b'.repeat(64),kind:'voice',contentType:'audio/webm',bytes:2000};
for(const path of ['/api/success-wishes/media/reserve','/api/success-wishes/media/finalize','/api/success-wishes/media/voice-verify']){
  const response=await fetch(base+path,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(synthetic)});
  assert.equal(response.status,503, path+' must be disabled without provider certification');
  checks.push(path+' fails closed');
}
const cleanup=await fetch(base+'/api/success-wishes/media/cleanup');assert.equal(cleanup.status,401);checks.push('media cleanup rejects unauthorised requests');

const verify=await fetch(base+'/api/success-wishes/verify-sender',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({email:'synthetic@example.invalid'})});assert.equal(verify.status,503);checks.push('sender verification cannot issue email while disabled');
const redeem=await fetch(base+'/api/success-wishes/verify-sender',{method:'PATCH',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({email:'synthetic@example.invalid',code:'000000'})});assert.equal(redeem.status,503);checks.push('sender token redemption closed while disabled');
const foreign=await fetch(base+'/api/success-wishes/messages',{method:'POST',headers:{origin:'https://foreign.example','content-type':'application/json'},body:'{}'});assert.equal(foreign.status,403);checks.push('foreign origin submission rejected');
const oversized=await fetch(base+'/api/success-wishes/messages',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({text:'x'.repeat(17000)})});assert.equal(oversized.status,413);checks.push('oversized request rejected');
const malformed=await fetch(base+'/api/success-wishes/session',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:'{'});assert.equal(malformed.status,400);checks.push('malformed session request rejected');
const logout=await fetch(base+'/api/success-wishes/session',{method:'DELETE',headers:{origin:base}});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/i);checks.push('signout clears guest cookie');
const cardPage=await fetch(base+'/success-wishes');const cardHtml=await cardPage.text();assert.equal(cardPage.status,200);assert(cardHtml.includes('A little encouragement.'));checks.push('public card studio renders');
const page=await fetch(base+'/success-wishes/private');const html=await page.text();assert.equal(page.status,200);assert(html.includes('Let them know you believe.'));assert.match(page.headers.get('cache-control'),/no-store/);checks.push('guarded private page renders with no-store');
process.stdout.write(JSON.stringify({mode:'real HTTP; service disabled; no DB/provider mocks',checks},null,2)+'\n');
}finally{child.kill('SIGTERM');fs.closeSync(output)}
})().catch(e=>{process.stderr.write(String(e)+"\n");process.exitCode=1})

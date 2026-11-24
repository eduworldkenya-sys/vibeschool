import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const path='app/api/identity/children/reset-password/route.ts'
const source=readFileSync(path,'utf8')
const migration=readFileSync('supabase/migrations/20261124110000_managed_learner_password_recovery.sql','utf8')
const ui=readFileSync('app/account/setup/ManagedLearners.tsx','utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText
const CHILD='6c37bc13-d3b7-4518-95b9-92a1664b33d0'
const USER='39bc1251-dc1a-459c-95a0-23011a09d5b0'

async function attempt({enabled=true,origin=true,signedIn=true,verified=true,
  roleDenied=false,rateLimited=false,authWriteError=false,
  confirmReset=true,identityId=CHILD,
}={}) {
  const operations=[]
  const db={
    auth:{getUser:async()=>{operations.push('getUser');return signedIn
      ? {data:{user:{email_confirmed_at:verified?'yes':null}},error:null}
      : {data:{user:null},error:null}}},
    rpc:async(name,args)=>{
      assert.equal(name,'vs_authorize_managed_password_reset')
      assert.equal(args.p_identity_id,CHILD)
      operations.push('guardian-owned-reset-authority')
      if(roleDenied)return{data:null,error:{code:'42501'}}
      if(rateLimited)return{data:null,error:{code:'54000'}}
      return{data:USER,error:null}
    },
  }
  const admin={auth:{admin:{
    updateUserById:async (id,input)=>{
      operations.push('reset-Auth-password')
      assert.equal(id,USER)
      assert.ok(input.password.length>20)
      return authWriteError?{data:null,error:{message:'error'}}
        :{data:{user:{id:USER}},error:null}
    },
  }}}
  const exports={}
  runInNewContext(compiled,{
    exports,
    process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-test'}},
    require(name){
      if(name==='node:crypto')return{randomBytes:()=>({toString:()=> 'a-long-random-one-time-password'})}
      if(name==='next/server')return{NextResponse:{json:(payload,opts)=>({payload,status:opts.status,headers:opts.headers})}}
      if(name==='@supabase/supabase-js')return{createClient:()=>admin}
      if(name==='@/lib/identity/server')return{identityClient:async()=>db}
      if(name==='@/lib/identity/origin')return{validSameOriginMutation:()=>origin}
      if(name==='@/lib/identity/features')return{unifiedIdentityEnabled:enabled}
      throw Error('Unrecognized dependency: '+name)
    },
  })
  const response=await exports.POST({
    headers:{get:()=>null},
    json:async()=>({identityId,confirmReset}),
  })
  return{response,operations}
}

test('verified guardian resets only their linked child through a checked RPC',async()=>{
  const {response,operations}=await attempt()
  assert.equal(response.status,200)
  assert.equal(response.payload.reset,true)
  assert.ok(response.payload.password.length>20)
  assert.deepEqual(operations,['getUser','guardian-owned-reset-authority','reset-Auth-password'])
  assert.equal(response.headers['Cache-Control'],'private, no-store')
  assert.equal(response.headers['Referrer-Policy'],'no-referrer')
})

test('feature off, bad origin, missing consent and invalid child identifier block before DB writes',async()=>{
  for(const input of [
    {enabled:false},{origin:false},{confirmReset:false},{identityId:'unauthorized'},
  ]){
    const {response,operations}=await attempt(input)
    assert.ok([400,403,503].includes(response.status))
    assert.deepEqual(operations,[])
  }
})

test('sign-in and email verification are required',async()=>{
  for(const input of [{signedIn:false},{verified:false}]){
    const {response,operations}=await attempt(input)
    assert.equal(response.status,401)
    assert.deepEqual(operations,['getUser'])
  }
})

test('wrong guardian and revoked family link never reset child password',async()=>{
  const {response,operations}=await attempt({roleDenied:true})
  assert.equal(response.status,403)
  assert.ok(!operations.includes('reset-Auth-password'))
  assert.equal(response.payload.password,undefined)
})

test('repeat reset attempt is rate-limited before any Auth change',async()=>{
  const {response,operations}=await attempt({rateLimited:true})
  assert.equal(response.status,429)
  assert.ok(!operations.includes('reset-Auth-password'))
})

test('failed Auth write does not claim a working new credential',async()=>{
  const {response,operations}=await attempt({authWriteError:true})
  assert.equal(response.status,503)
  assert.ok(operations.includes('reset-Auth-password'))
  assert.equal(response.payload.password,undefined)
})

test('database locks the linked child and enforces bounded reset attempts',()=>{
  assert.match(migration,/for update/)
  assert.match(migration,/vs_my_managed_student_login\(p_identity_id\)/)
  assert.match(migration,/v_record.status<>'linked'/)
  assert.match(migration,/15 minutes/)
  assert.match(migration,/24 hours/)
  assert.match(migration,/v_window_count>=5/)
  assert.match(migration,/grant execute on function public.vs_authorize_managed_password_reset/)
  assert.doesNotMatch(migration,/\bdrop table\b|\btruncate\b|\bdelete from students\b/i)
  assert.match(ui,/Reset learner password/)
  assert.match(ui,/Confirm reset/)
  assert.match(ui,/await activate\(\{/)
  assert.match(ui,/createdGrade/)
  assert.match(ui,/Create learner account/)
  assert.match(ui,/If activation fails, the saved child remains available/)
})

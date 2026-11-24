import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source=readFileSync('app/api/identity/children/activate/route.ts','utf8')
const sql=readFileSync('supabase/migrations/20261124090000_managed_learner_school_optional_activation.sql','utf8')
const login=readFileSync('app/login/[role]/page.tsx','utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText
const CHILD='218c6e09-42b0-4de0-8d8c-dcaa98c84493'

async function run({enabled=true,origin=true,authenticated=true,confirmed=true,
  owned=true,linked=false,rpcError=false,createError=false,body={
    identityId:CHILD,grade:'Grade 4',confirmGuardian:true,
  }}={}) {
  const events=[]
  const db={
    auth:{getUser:async()=>{
      events.push('session-checked')
      return authenticated?{data:{user:{id:'guardian',email_confirmed_at:confirmed?'date':null}},error:null}
        :{data:{user:null},error:null}
    }},
    rpc:async(name,args)=>{
      events.push(name)
      if(name==='vs_list_my_identities')return{data:{
        self:{id:'guardian-identity'},
        managed_learners:owned?[{id:CHILD,username:'brian254',display_name:'Brian',
          status:linked?'linked':'managed'}]:[],
      },error:null}
      if(name==='vs_activate_managed_student'){
        assert.equal(args.p_identity_id,CHILD)
        assert.equal(args.p_child_auth_user_id,'new-child-id')
        assert.equal(args.p_grade,'Grade 4')
        return rpcError?{data:null,error:{code:'42501'}}:
          {data:{student_id:'student-001',username:'brian254'},error:null}
      }
      throw Error('Unexpected RPC '+name)
    },
  }
  const admin={auth:{admin:{
    createUser:async details=>{
      events.push('child-auth-created')
      assert.equal(details.email,'brian254@vs.internal')
      assert.equal(details.email_confirm,true)
      assert.ok(details.password.length>=16)
      return createError?{data:{user:null},error:{message:'conflict'}}:
        {data:{user:{id:'new-child-id'}},error:null}
    },
    deleteUser:async id=>{events.push('rollback-child-auth');assert.equal(id,'new-child-id');return{error:null}},
  }}}
  const exports={}
  const env={
    NEXT_PUBLIC_UNIFIED_IDENTITY_ENABLED:enabled?'true':'false',
    NEXT_PUBLIC_SUPABASE_URL:'https://supabase.test',
    SUPABASE_SERVICE_ROLE_KEY:'secret-test',
  }
  runInNewContext(compiled,{
    exports,process:{env},
    require(name){
      if(name==='node:crypto')return{randomBytes:()=>({toString:()=> 'some-long-unique-password'})}
      if(name==='next/server')return{NextResponse:{json:(payload,opts)=>({payload,status:opts.status,headers:opts.headers})}}
      if(name==='@supabase/supabase-js')return{createClient:()=>admin}
      if(name==='@/lib/identity/server')return{identityClient:async()=>db}
      if(name==='@/lib/identity/features')return{unifiedIdentityEnabled:enabled}
      if(name==='@/lib/identity/origin')return{validSameOriginMutation:()=>origin}
      throw Error('Unrecognized server dependency '+name)
    },
  })
  const request={
    headers:{get:key=>key==='content-length'?'200':null},
    json:async()=>body,
  }
  const response=await exports.POST(request)
  return{events,response}
}

test('a school-free guardian-created child obtains a distinct, private learner login',async()=>{
  const {events,response}=await run()
  assert.equal(response.status,201)
  assert.equal(response.payload.loginId,'brian254')
  assert.equal(response.payload.studentId,'student-001')
  assert.ok(response.payload.password.length>=16)
  assert.deepEqual(events,[
    'session-checked','vs_list_my_identities','child-auth-created','vs_activate_managed_student',
  ])
  assert.equal(response.headers['Cache-Control'],'private, no-store')
})

test('inactive feature and wrong origin never touch authentication',async()=>{
  for(const options of [{enabled:false},{origin:false}]){
    const {response,events}=await run(options)
    assert.ok([403,503].includes(response.status))
    assert.deepEqual(events,[])
  }
})

test('unverified session and guardian declaration cannot provision a child',async()=>{
  for(const options of [{authenticated:false},{confirmed:false},
    {body:{identityId:CHILD,grade:'Grade 4',confirmGuardian:false}}]){
    const {response,events}=await run(options)
    assert.ok([400,401].includes(response.status))
    assert.ok(!events.includes('child-auth-created'))
  }
})

test('other households and already-linked children cannot receive new credentials',async()=>{
  for(const options of [{owned:false},{linked:true}]){
    const {response,events}=await run(options)
    assert.equal(response.status,403)
    assert.ok(!events.includes('child-auth-created'))
  }
})

test('failed database transaction deletes the unused Auth account and leaks no credentials',async()=>{
  const {response,events}=await run({rpcError:true})
  assert.equal(response.status,409)
  assert.ok(events.includes('rollback-child-auth'))
  assert.equal(response.payload.password,undefined)
})

test('existing internal login identifier cannot be silently overwritten',async()=>{
  const {response,events}=await run({createError:true})
  assert.equal(response.status,409)
  assert.ok(!events.includes('vs_activate_managed_student'))
})

test('SQL enforces no-school Student ownership and guardian isolation',()=>{
  assert.match(sql,/v_auth->>'account_status' is distinct from 'active'/)
  assert.match(sql,/coalesce\(v_auth->>'role',''\) not in \('parent','teacher'\)/)
  assert.match(sql,/guardian.auth_user_id=v_guardian/)
  assert.match(sql,/for update of l/)
  assert.match(sql,/p_grade not in/)
  assert.match(sql,/where u.id=p_child_auth_user_id and lower\(u.email\)=v_email/)
  assert.match(sql,/insert into public.students\(profile_id,name,class_id,created_by\)/)
  assert.match(sql,/values\(p_child_auth_user_id,v_child.display_name,null,v_guardian\)/)
  assert.match(sql,/insert into public.parent_student_links/)
  assert.match(sql,/where child.auth_user_id=\(select auth.uid\(\)\)/)
  assert.match(sql,/grant execute on function public.vs_activate_managed_student/)
  assert.equal((sql.match(/\$\$;/g)||[]).length,4)
  assert.ok(sql.trim().endsWith('commit;'))
})

test('school PIN and managed-child password use one canonical learner login',()=>{
  assert.match(login,/learnerLoginEmail\(identifier, schoolCode\)/)
  assert.match(login,/PIN or password/)
  assert.doesNotMatch(login,/setPassword\(config.email \? e.target.value : e.target.value.replace/)
})

test('adult independent learning has no school or guardian dependency',()=>{
  const provisioning=readFileSync('supabase/migrations/20261124091000_independent_adult_provisioning_guard.sql','utf8')
  const api=readFileSync('app/api/learner/independent/grade/route.ts','utf8')
  const email=readFileSync('app/signup/student/email/actions.ts','utf8')
  assert.match(provisioning,/v_identity.age_band is distinct from 'adult'/)
  assert.match(provisioning,/if v_count=1 then/)
  assert.match(provisioning,/return v_student_id;/)
  assert.match(api,/payload\?\.ageBand !== 'adult'/)
  assert.match(api,/identity.age_band === 'under_18'/)
  assert.match(email,/form.get\('age_band'\) !== 'adult'/)
  assert.match(email,/age_band: 'adult'/)
  assert.doesNotMatch(provisioning,/parent_student_links/)
})

test('verified parent or teacher can add a child without claiming a public username',()=>{
  const migration=readFileSync('supabase/migrations/20261124092000_managed_guardian_username_optional.sql','utf8')
  const setup=readFileSync('app/account/setup/UsernameSetupForm.tsx','utf8')
  assert.match(migration,/insert into public.vs_identities\(auth_user_id,kind\)/)
  assert.match(migration,/on conflict\(auth_user_id\) do nothing/)
  assert.match(migration,/guardian_confirmed is distinct from true/)
  assert.match(migration,/coalesce\(v_access->>'role',''\) not in \('parent','teacher'\)/)
  assert.doesNotMatch(migration,/Set up username first/)
  assert.match(setup,/Skip for now/)
})

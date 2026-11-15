import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const routeSource = readFileSync('app/api/learner/independent/home/route.ts', 'utf8')
const page = readFileSync('app/student/qa/page.tsx', 'utf8')
const context = readFileSync('lib/student-context.tsx', 'utf8')
const layout = readFileSync('app/student/layout.tsx', 'utf8')
const compiled = ts.transpileModule(routeSource, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}}).outputText

test('QA is opt-in, scoped, and cannot grant enrollment, school records or scored access', () => {
  assert.match(routeSource, /qaClient\.from\('profile_entitlements'\)/)
  assert.doesNotMatch(routeSource, /admin\.from\('profile_entitlements'\)/)
  assert.match(routeSource, /global: \{ headers: \{ Authorization: bearer \} \}/)
  assert.match(routeSource, /qaGrant\.source === 'owner_qa'/)
  assert.match(routeSource, /!qaError && !!qaGrant/)
  assert.match(routeSource, /profile\.account_status === 'active'/)
  assert.match(context, /home\.universalTest === true/)
  assert.match(layout, /universalTest=\{identity\?\.universalTest === true\}/)
  assert.match(page, /LEARNING_LEVELS/)
  assert.match(page, /resolveLearningSelection/)
  assert.match(page, /Demo Teacher 01/)
  assert.match(page, /not actual enrollment/)
  assert.match(page, /Cross-level graded practice is/)
  assert.doesNotMatch(page, /\.from\(['"](?:students|student_classes|teacher_classes)['"]\)/)
  assert.doesNotMatch(page, /recordVibeLearnPracticeAnswer|submitAttempt|\.insert\(|\.update\(|\.delete\(/)
  assert.doesNotMatch(page, /topic-practice\?grade=/)
})

const fakeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
function response(data, error=null) { return {data,error} }
function mockQuery(result) {
  return {select(){return this},eq(){return this},is(){return this},
    maybeSingle(){return Promise.resolve(result)},
    limit(){return Promise.resolve(result)}}
}
async function getHome({grant={entitlement_key:'qa_universal_learner',source:'owner_qa',granted_until:null},
  accountStatus='active',role='student',students=1,verified=true,qaError=null,
  anonKey=true, bearer=true}={}) {
  const calls=[]
  const user={id:fakeId,email_confirmed_at:verified?'2026-11-01T11:00:00Z':null,user_metadata:{}}
  const admin={
    auth:{getUser:async token=>{calls.push('auth'); assert.equal(token,'fixture-jwt');return response({user})}},
    from(name){
      calls.push('service:'+name)
      assert.notEqual(name,'profile_entitlements','service_role has no SELECT entitlement grant')
      if(name==='profiles') return mockQuery(response({
        role,full_name:'QA Learner',account_status:accountStatus,is_anonymized:false}))
      if(name==='independent_learner_identities')return mockQuery(response(null))
      if(name==='students')return mockQuery(response(
        Array.from({length:students},(_,i)=>({id:'student-'+i,class_id:'class-A',name:'QA Learner'}))))
      throw Error('Unexpected admin query '+name)
    },
  }
  const learner={
    from(name){
      calls.push('learner:'+name)
      assert.equal(name,'profile_entitlements')
      return mockQuery(response(grant,qaError))
    },
  }
  const exports={}
  runInNewContext(compiled,{
    exports,console,Date,process:{env:{
      NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY:'service-fixture',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:anonKey?'anon-fixture':'',
    }},
    require(name){
      if(name==='next/server')return {NextResponse:{json:(body,opts)=>({body,status:opts?.status??200})}}
      if(name==='@supabase/supabase-js')return {createClient:(_url,key,opts)=>{
        if(key==='service-fixture')return admin
        assert.equal(key,'anon-fixture')
        assert.equal(opts.global.headers.Authorization,'Bearer fixture-jwt')
        calls.push('bearer-rls')
        return learner
      }}
      if(name==='@/lib/student/learner-welcome')return {learnerDisplayName:(name)=>name}
      throw Error('Unexpected module '+name)
    },
  })
  const req={headers:{get(name){assert.equal(name,'authorization');return bearer?'Bearer fixture-jwt':''}}}
  const result=await exports.GET(req)
  return {result,calls}
}

test('verified, owner-granted Test1-style learner gets the navigator but no new school scope',async()=>{
  const {result,calls}=await getHome()
  assert.equal(result.status,200)
  assert.equal(result.body.kind,'other')
  assert.equal(result.body.universalTest,true)
  assert(calls.includes('learner:profile_entitlements'))
  assert(calls.includes('bearer-rls'))
  assert(!calls.some(value=>value==='service:profile_entitlements'))
})

test('revocation, spoofing, expiry, verification errors and role mismatch all fail closed',async()=>{
  for(const opts of [
    {grant:null},{grant:{source:'user',granted_until:null}},
    {grant:{source:'owner_qa',granted_until:'2001-01-01T00:00:00Z'}},
    {verified:false},{accountStatus:'restricted'}, {role:'teacher'},
    {students:0},{students:2},{qaError:{message:'RLS unavailable'}},{anonKey:false},
  ]){
    const {result}=await getHome(opts)
    assert.equal(result.status,200)
    assert.equal(result.body.kind,'other')
    assert.equal(result.body.universalTest,false)
  }
})

test('missing bearer refuses access before any privileged client is created',async()=>{
  const {result,calls}=await getHome({bearer:false})
  assert.equal(result.status,401)
  assert.equal(result.body.error,'Sign in first')
  assert.deepEqual(calls,[])
})

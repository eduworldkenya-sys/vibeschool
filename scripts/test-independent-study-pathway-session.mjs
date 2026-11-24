import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync('app/api/learner/independent/grade/route.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText
const emailActions = readFileSync('app/signup/student/email/actions.ts', 'utf8')

// The post-secondary preference intentionally has no service-role table grants.
// Its SELECT and INSERT must always use the signed-in learner's RLS session.
assert.match(source, /pathwayClient\.from\('learner_education_paths'\)/)
assert.doesNotMatch(source, /admin\.from\('learner_education_paths'\)/)
assert.match(emailActions, /client\.from\('learner_education_paths'\)/)
assert.doesNotMatch(emailActions, /admin\.from\('learner_education_paths'\)/)

const token = 'verified-token'
const userId = 'e8113d7e-3d0e-4cde-a8d8-e61a433d7192'
const user = { id:userId, email_confirmed_at:'2026-11-15T08:00:00Z', user_metadata:{} }
const chain = (value={error:null}) => {
  const result = {
    eq(){return this},
    is(){return this},
    then(resolve,reject){return Promise.resolve(value).then(resolve,reject)},
  }
  return result
}

async function attempt({existing=null,readError=null,insertError=null,level='professional',choice='CPA',bearer=true,enabled=true,ageBand='adult',identityAge='unconfirmed',dateOfBirth=null}={}) {
  const operations=[]
  const admin={
    auth:{getUser:async tokenValue=>{operations.push('verified-jwt');assert.equal(tokenValue,token);return {data:{user},error:null}}},
    from(table) {
      assert.notEqual(table,'learner_education_paths','service_role must not access the user-owned preference table')
      if(table==='profiles') return {
        select:()=>({eq:()=>({maybeSingle:async()=>({data:{
          role:null,full_name:'Jane Doe',account_status:'active',is_anonymized:false,date_of_birth:dateOfBirth,
        },error:null})})}),
        update:()=>chain(),
      }
      if(table==='independent_learner_identities') return {
        select:()=>({eq:()=>({maybeSingle:async()=>({data:{
          account_state:'restricted',learner_email_verified_at:'2026-11-15T08:00:00Z',grade_label:null,age_band:identityAge,
        },error:null})})}),
        update:()=>{operations.push('grade-saved');return chain()},
      }
      if(table==='students') return {update:()=>{operations.push('student-name-saved');return chain()}}
      throw Error('Unexpected admin table: '+table)
    },
    rpc:async(name,args)=>{
      assert.equal(name,'ensure_independent_learner_student')
      assert.equal(args.p_user_id,userId)
      operations.push('student-provisioned')
      return {data:'student-id',error:null}
    },
  }
  const learner={
    from(table) {
      assert.equal(table,'learner_education_paths')
      operations.push('learner-rls-pathway-query')
      return {
        select:()=>({eq:(_,id)=>{assert.equal(id,userId);return {maybeSingle:async()=>({data:existing,error:readError})}}}),
        insert:async row=>{
          operations.push('learner-rls-pathway-insert')
          assert.equal(row.user_id,userId)
          assert.equal(row.qualification_code,'CPA')
          assert.equal(row.programme_family,'professional_studies')
          return {error:insertError}
        },
      }
    },
  }
  const exports={}
  runInNewContext(compiled, {
    exports,process:{env:{
      INDEPENDENT_LEARNER_PUBLIC_GOOGLE_ENABLED:'true',
      NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:'anon-fixture',
      SUPABASE_SERVICE_ROLE_KEY:'service-fixture',
    }},
    require(name) {
      if(name==='next/server') return {NextResponse:{json:(payload,options)=>({payload,status:options?.status??200})}}
      if(name==='@supabase/supabase-js') return {createClient:(_url,key,config)=>{
        if(key==='service-fixture')return admin
        assert.equal(key,'anon-fixture')
        assert.equal(config.global.headers.Authorization,'Bearer '+token)
        operations.push('learner-scoped-client')
        return learner
      }}
      if(name==='@/lib/learner/independent-grade')return {validLearnerGrade:()=>false}
      if(name==='@/lib/learner/learning-levels')return {resolveRegistrationLearningSelection:(l,c)=>enabled&&l==='professional'&&c==='CPA'?
        {gradeLabel:'Professional Studies',pathway:{programme_family:'professional_studies',qualification_code:'CPA',examining_body:'KASNEB'}}:null}
      if(name==='@/lib/student/learner-welcome')return {learnerDisplayName:(name,old)=>name||old}
      throw Error('Unexpected route dependency: '+name)
    },
  })
  const request={
    headers:{get:name=>name==='authorization' && bearer?'Bearer '+token:null},
    json:async()=>({level,choice,name:'Jane Doe',ageBand}),
  }
  const response=await exports.POST(request)
  return {response,operations}
}

const blocked=await attempt({enabled:false})
assert.equal(blocked.response.status,400)
assert.deepEqual(blocked.operations,[],'muted CPA request rejects before auth or writes')
const success=await attempt()
assert.equal(success.response.status,200)
assert.equal(success.response.payload.destination,'/student/college')
assert.ok(success.operations.indexOf('verified-jwt')<success.operations.indexOf('learner-rls-pathway-query'))
assert.ok(success.operations.includes('learner-rls-pathway-insert'))
const existing={education_stage:'post_secondary',programme_family:'professional_studies',qualification_code:'CPA'}
const resume=await attempt({existing})
assert.equal(resume.response.status,200)
assert.ok(!resume.operations.includes('learner-rls-pathway-insert'),'do not duplicate existing CPA pathway')
const conflict=await attempt({existing:{...existing,qualification_code:'CS'}})
assert.equal(conflict.response.status,409)
assert.ok(!conflict.operations.includes('grade-saved'),'existing CS pathway must not be overwritten')
const dbFailure=await attempt({readError:{code:'42501',message:'not authorized'}})
assert.equal(dbFailure.response.status,503)
assert.ok(!dbFailure.operations.includes('grade-saved'),'failed pathway read must not partly register the learner')
const noAuth=await attempt({bearer:false})
assert.equal(noAuth.response.status,401)
assert.equal(noAuth.operations.length,0)
console.log('PASS: CPA signup uses only verified JWT + owner-scoped pathway RLS; rejects conflicts and partial writes')

const minorChoice=await attempt({ageBand:'under_18'})
assert.equal(minorChoice.response.status,403,'minor never provisions through the independent adult route')
assert.equal(minorChoice.operations.length,0)
const missingAge=await attempt({ageBand:null})
assert.equal(missingAge.response.status,403)
const previouslyKnownMinor=await attempt({identityAge:'under_18'})
assert.equal(previouslyKnownMinor.response.status,403)
assert.ok(!previouslyKnownMinor.operations.includes('student-provisioned'))
const knownMinorBirth=await attempt({dateOfBirth:'2015-10-10'})
assert.equal(knownMinorBirth.response.status,403)
assert.ok(!knownMinorBirth.operations.includes('student-provisioned'))

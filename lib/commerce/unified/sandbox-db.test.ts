import test from 'node:test'
import assert from 'node:assert/strict'
import {validateIsolatedSandboxDatabaseUrl as validate} from './sandbox-db.ts'

const testRef='ufqjgyzspavamdpkdxmc'
const db=`postgresql://postgres:dummy-secret@db.${testRef}.supabase.co:5432/postgres`
const pool=`postgresql://postgres.${testRef}:dummy-secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`

test('accepts isolated Supabase direct URL, including required SSL query',()=>{
  assert.deepEqual(validate(db,testRef),{ok:true})
  assert.deepEqual(validate(db+'?sslmode=require',testRef),{ok:true})
  assert.deepEqual(validate(db+'?sslmode=verify-full',testRef),{ok:true})
  assert.deepEqual(validate(pool,testRef),{ok:true})
  assert.deepEqual(validate(pool+'?sslmode=require',testRef),{ok:true})
})

test('rejects any other Supabase project or unsafe hostname',()=>{
  assert.equal(validate(db,'yauqsxggtuxuykcbrtzf').ok,false)
  assert.equal(validate(db.replace(testRef,'yauqsxggtuxuykcbrtzf'),testRef).ok,false)
  assert.equal(validate('postgresql://postgres:secret@db.'+testRef+'.supabase.co.attacker.tld/postgres',testRef).ok,false)
  assert.equal(validate(pool.replace('postgres.'+testRef,'postgres.yauqsxggtuxuykcbrtzf'),testRef).ok,false)
})

test('rejects missing password, wrong db name, unsupported parameters and wrong role',()=>{
  assert.deepEqual(validate(db.replace('dummy-secret',''),testRef),{ok:false,reason:'missing_password'})
  assert.deepEqual(validate(db.replace(':5432/postgres',':5432/test'),testRef),{ok:false,reason:'wrong_database_name'})
  assert.deepEqual(validate(db+'?sslmode=disable',testRef),{ok:false,reason:'unsupported_parameters'})
  assert.deepEqual(validate(db+'?sslmode=require&foo=bar',testRef),{ok:false,reason:'unsupported_parameters'})
  assert.deepEqual(validate(db+'?sslmode=require&sslmode=require',testRef),{ok:false,reason:'unsupported_parameters'})
  assert.deepEqual(validate(db.replace('postgres:dummy','guest:dummy'),testRef),{ok:false,reason:'wrong_database_user'})
  assert.deepEqual(validate(db+'#fragment',testRef),{ok:false,reason:'url_fragment'})
})

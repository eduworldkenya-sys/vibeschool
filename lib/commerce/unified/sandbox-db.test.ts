import test from 'node:test'
import assert from 'node:assert/strict'
import {validateIsolatedSandboxDatabaseUrl as validate} from './sandbox-db'

const testRef='ufqjgyzspavamdpkdxmc'
const db=`postgresql://postgres:dummy-secret@db.${testRef}.supabase.co:5432/postgres`
const pool=`postgresql://postgres.${testRef}:dummy-secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`

test('allows built-in Supabase URL query options but never forwards them',()=>{
  for(const url of [
    db,db+'?sslmode=require',db+'?sslmode=verify-full',
    db+'?sslmode=disable&options=somevalue&application_name=yourapp',
    pool,pool+'?sslmode=require&pgbouncer=true&connect_timeout=10',
  ]){
    const outcome=validate(url,testRef)
    assert.deepEqual(outcome,{ok:true,connectionString:url.split('?')[0]})
  }
})

test('removes all query-based credential or routing overrides',()=>{
  const injected=db+'?host=attacker.invalid&user=postgres&password=other&sslmode=disable'
  const outcome=validate(injected,testRef)
  assert.deepEqual(outcome,{ok:true,connectionString:db})
})

test('rejects any other Supabase project or unsafe hostname',()=>{
  assert.equal(validate(db,'yauqsxggtuxuykcbrtzf').ok,false)
  assert.equal(validate(db.replace(testRef,'yauqsxggtuxuykcbrtzf'),testRef).ok,false)
  assert.equal(validate('postgresql://postgres:secret@db.'+testRef+'.supabase.co.attacker.tld/postgres',testRef).ok,false)
  assert.equal(validate(pool.replace('postgres.'+testRef,'postgres.yauqsxggtuxuykcbrtzf'),testRef).ok,false)
  assert.equal(validate(db.replace('postgres:dummy','guest:dummy'),testRef).ok,false)
})

test('rejects missing password, wrong db name, URL fragment and unsafe port',()=>{
  assert.deepEqual(validate(db.replace('dummy-secret',''),testRef),{ok:false,reason:'missing_password'})
  assert.deepEqual(validate(db.replace(':5432/postgres',':5432/test'),testRef),{ok:false,reason:'wrong_database_name'})
  assert.deepEqual(validate(db.replace(':5432/',':1111/'),testRef),{ok:false,reason:'unsupported_port'})
  assert.deepEqual(validate(db+'#fragment',testRef),{ok:false,reason:'url_fragment'})
})

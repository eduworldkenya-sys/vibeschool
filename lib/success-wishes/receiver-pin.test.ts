import test from 'node:test'
import assert from 'node:assert/strict'
import {derive,protectPin,verifyPin,validSecret,nameKey} from './receiver-pin'
const env={SUPABASE_SERVICE_ROLE_KEY:'synthetic-private-pepper-at-least-32-chars'}
test('four-digit PINs are salted and peppered; malformed or guessed PINs fail',()=>{const a=protectPin('0123',undefined,env),b=protectPin('0123',undefined,env);assert.notEqual(a,b);assert.match(a,/^[a-f0-9]{32}:[a-f0-9]{64}$/);assert(verifyPin('0123',a,env));assert(!verifyPin('9999',a,env));assert(!verifyPin('0123',a,{SUPABASE_SERVICE_ROLE_KEY:'another-private-pepper-at-least-32'}));for(const value of ['123','12345','abcd',1234,null])assert.throws(()=>protectPin(value,undefined,env))})
test('capability purposes and reset nonces are distinct and retries are deterministic',()=>{assert.notEqual(derive('setup-recovery:a',env),derive('reset:a:b',env));assert.equal(derive('reset:a:b',env),derive('reset:a:b',env));assert.notEqual(derive('reset:a:b',env),derive('reset:a:c',env));assert(validSecret('a'.repeat(64)));assert(!validSecret('1234'));assert.equal(nameKey('  Charles   Mwangi '),'charles mwangi')})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('public/sw.js','utf8')
const studio = fs.readFileSync('app/marketing-studio/page.tsx','utf8')
const panel = fs.readFileSync('components/pwa/OfflineGamesPack.tsx','utf8')
const offline = fs.readFileSync('public/offline.html','utf8')

test('offline pack is opt-in, constrained to safe public games', () => {
  for (const route of ['/marketing-studio','/spin-studio','/coin-studio','/pendulum-studio','/games-studio']) assert.ok(source.includes("'"+route+"'"))
  assert.match(source,/credentials: 'omit'/)
  assert.match(source,/OFFLINE_GAMES_READY/)
  assert.match(source,/PREPARE_OFFLINE_GAMES/)
  assert.match(panel,/Save games for offline/)
  assert.match(studio,/<OfflineGamesPack\/>/)
  assert.match(offline,/Downloaded games/)
})
test('worker does not cache authenticated endpoints, RSC or personalized pages', () => {
  assert.match(source,/url\.pathname\.startsWith\('\/auth\/'\)/)
  assert.match(source,/url\.pathname\.startsWith\('\/api\/'\)/)
  assert.match(source,/request\.mode === 'navigate'/)
  assert.match(source,/SAFE_PUBLIC_PATHS\.has\(url\.pathname\) && !url\.search/)
  assert.doesNotMatch(source,/student['"]\s*,/)
  assert.doesNotMatch(source,/teacher['"]\s*,/)
  assert.doesNotMatch(source,/parent['"]\s*,/)
})
test('offline fallback serves saved game HTML and never caches private page', async () => {
  const listeners = {}
  const storage = new Map()
  const cache = {
    match: async key => storage.get(typeof key==='string'?key:key.url),
    put: async (key,value) => { storage.set(typeof key==='string'?key:key.url,value) },
  }
  const caches = { open: async () => cache, match: async key => cache.match(key), keys: async () => [] }
  const origin='https://vibeschool.co.ke'
  const response=(body,type='text/html')=>({
    ok:true,type:'basic',headers:{get:k=>k==='content-type'?type:null},
    clone(){return response(body,type)},
    text:async()=>body
  })
  let available=true
  const context={
    URL, Response,
    self:{ location:{ origin }, clients:{claim:async()=>{}}, addEventListener:(type,handler)=>{listeners[type]=handler}, skipWaiting(){} },
    caches,
    fetch:async request=>{if(!available)throw new Error('offline');return response('<html>PUBLIC</html>')},
  }
  vm.runInNewContext(source,context)
  const request=(path)=>({url:origin+path,mode:'navigate',method:'GET'})
  const navigate=async path=>{
    let pending
    const work=[]
    listeners.fetch({request:request(path),respondWith:p=>{pending=p},waitUntil:p=>{work.push(p)}})
    const result=pending?await pending:null
    await Promise.all(work)
    return result
  }
  assert.equal((await navigate('/spin-studio')).ok,true)
  assert.equal(storage.has('/spin-studio'),true)
  available=false
  const cached=await navigate('/spin-studio')
  assert.equal(await cached.text(),'<html>PUBLIC</html>')
  assert.equal(storage.has('/student'),false)
  const privateResult=await navigate('/student')
  assert.notEqual(privateResult, cached) // Private page cannot receive cached game HTML.
  assert.equal(storage.has('/student'),false)
})

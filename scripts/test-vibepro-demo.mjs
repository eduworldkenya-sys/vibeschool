import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Script, createContext as vmCreateContext, runInContext as vmRunInContext } from 'node:vm'

const root = resolve(import.meta.dirname, '..')
const html = readFileSync(resolve(root, 'public/vibepro/demo.html'), 'utf8')
const route = readFileSync(resolve(root, 'app/vibepro/page.tsx'), 'utf8')

test('VibePro route exposes the self-contained suite preview without financial backend access', () => {
  assert.match(route, /redirect\('\/vibepro\/demo\.html'\)/)
  assert.match(route, /index: false, follow: false/)
  assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/)
  assert.match(html, /vibepro-demo-v2/)
  assert.match(html, /ApexPlaster · Demo/)
  assert.match(html, /Gilowinc · Demo/)
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i)
  assert.doesNotMatch(html, /\bfetch\s*\(|\bXMLHttpRequest\b|\bnavigator\.sendBeacon\b|\bWebSocket\s*\(|\bEventSource\s*\(/)
  assert.doesNotMatch(html, /\beval\s*\(|new\s+Function\s*\(/)
})

test('VibePro browser application is syntactically valid and has working module handlers', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  assert.equal(scripts.length, 1, 'preview should remain self-contained')
  assert.doesNotThrow(() => new Script(scripts[0][1], { filename: 'vibepro-demo.js' }))
  for (const section of [
    'Sales & Invoices', 'Bills & Expenses', 'Banking', 'Inventory',
    'General Ledger', 'Reports', 'Point of Sale', 'Manufacturing',
    'Payroll', 'CRM', 'Fleet', 'Helpdesk', 'Quality',
    'Audit', 'M-PESA', 'eTIMS',
  ]) {
    assert.ok(html.toLowerCase().includes(section.toLowerCase()), 'missing module: ' + section)
  }
  assert.match(html, /function renderPanel\(/)
  assert.match(html, /function submitPro\(/)
  assert.match(html, /function persist\(/)
  assert.match(html, /reset-demo/)
})

test('VibePro preview is isolated from VibeSchool identity and network services', () => {
  const nextConfig = readFileSync(resolve(root, 'next.config.js'), 'utf8')
  assert.match(nextConfig, /source: '\/vibepro\/demo\.html'/)
  assert.match(nextConfig, /sandbox allow-scripts allow-downloads allow-modals/)
  assert.doesNotMatch(nextConfig, /sandbox[^"\n]*allow-same-origin/)
  assert.match(nextConfig, /connect-src 'none'/)
  assert.match(nextConfig, /form-action 'none'/)
})

test('VibePro department catalog offers 27 unique configurable company functions', () => {
  const marker = html.match(/\/\* VibePro Company OS: canonical department catalog and connected, fictional workflows \*\/([\s\S]*?)\/\* End VibePro company department extension \*\//)
  assert.ok(marker, 'department implementation must exist in the integrated demo');
  assert.doesNotThrow(() => new Script(marker[1], { filename: 'vibepro-company-departments.js' }))
  const { createContext, runInContext } = awaitVm()
  const sandbox = {
    document: { addEventListener() {} }, proPage() { return '' }, team() { return '' },
    PAGES: [], NAV: [], ICONS: {}, PRO_ICONS: {},
    id: (() => { let n = 0; return () => 'test-' + (++n) })(),
    auditLog(c, action, detail) { c.audit ??= []; c.audit.push({ action, detail }) },
    demoRole: 'Alex M. · Owner',
    structuredClone,
  }
  createContext(sandbox)
  runInContext(marker[1], sandbox)
  const list = runInContext('DEPARTMENT_CATALOG.map(x=>x[0])', sandbox)
  assert.equal(list.length, 27)
  assert.equal(new Set(list).size, 27)
  for (const name of [
    'Internal Audit & Risk','Research & Development','Business Development',
    'Facilities & Maintenance','Health, Safety & Environment','Security',
    'Quality Assurance','Field Services','Corporate Communications',
    'Asset Management','Treasury','Data & Business Intelligence',
  ]) {
    assert.ok(runInContext('DEPARTMENT_CATALOG.some(x=>x[1]===' + JSON.stringify(name) + ')', sandbox), name)
  }
  assert.equal(sandbox.NAV.some(x=>x[0]==='departments'), true)
  assert.equal(sandbox.PAGES.some(x=>x[0]==='departments'), true)
})

test('Department creation, assignments, handovers, merge and per-company separation work in memory', () => {
  const marker = html.match(/\/\* VibePro Company OS: canonical department catalog and connected, fictional workflows \*\/([\s\S]*?)\/\* End VibePro company department extension \*\//)
  assert.ok(marker)
  const { createContext, runInContext } = awaitVm()
  const sandbox = {
    document: { addEventListener() {} }, proPage() { return '' }, team() { return '' },
    PAGES: [], NAV: [], ICONS: {}, PRO_ICONS: {},
    id: (() => { let n=0; return ()=>'dept-'+(++n) })(),
    auditLog(c, action, detail) { c.audit ??= []; c.audit.push({ action, detail }) },
    demoRole:'Alex M. · Owner', structuredClone,
  }
  createContext(sandbox)
  runInContext(marker[1],sandbox)
  const a={ name:'ApexPlaster · Demo', team:[{id:'t1',name:'Jean K.'},{id:'t2',name:'Alex M.'}] }
  const b={ name:'Gilowinc · Demo',team:[{id:'t1',name:'Jean K.'}] }
  Object.assign(sandbox,{a,b})
  runInContext('ensureDepartments(a);ensureDepartments(b)',sandbox)
  assert.equal(a.departments.length,27)
  assert.equal(b.departments.length,27)
  assert.ok(a.departmentWork.length>0)
  assert.equal(b.departmentWork.length,0)
  const first=runInContext("performDepartmentForm(a,'sub',{name:'Site Support',group:'Custom',parent:'field-services'});departmentFocus",sandbox)
  assert.ok(first.startsWith('custom-'))
  assert.equal(a.departments.find(d=>d.id===first).parentId,'field-services')
  runInContext("performDepartmentForm(a,'assign',{id:'field-services',employee:'t1'})",sandbox)
  assert.equal(a.departmentAssignments.t1,'field-services')
  assert.throws(()=>runInContext("performDepartmentForm(a,'create',{name:'Site Support',group:'Custom',parent:''})",sandbox),/already exists/)
  runInContext("performDepartmentForm(a,'new-work',{id:'field-services',title:'Inspect delivery site',priority:'Urgent',assignee:'t1'})",sandbox)
  assert.ok(a.departmentWork.some(w=>w.title==='Inspect delivery site'))
  const work=a.departmentWork.find(w=>w.title==='Inspect delivery site')
  assert.equal(work.departmentId,'field-services')
  sandbox.workId=work.id
  runInContext("performDepartmentForm(a,'handover',{id:workId,target:'treasury'})",sandbox)
  assert.equal(work.departmentId,'treasury')
  assert.equal(work.assignedTo,'')
  assert.ok(work.history.some(s=>s.includes('Handed over')))
  sandbox.newId=first
  assert.throws(()=>runInContext("performDepartmentForm(a,'merge',{source:'field-services',target:newId})",sandbox),/child/)
  runInContext("performDepartmentForm(a,'merge',{source:newId,target:'field-services'})",sandbox)
  assert.equal(a.departments.find(d=>d.id===first).mergedInto,'field-services')
  assert.equal(b.departments.length,27,'another company must not be mutated')
  assert.equal(b.departmentWork.length,0)
  assert.throws(()=>runInContext("performDepartmentForm(a,'new-work',{id:'field-services',title:'',priority:'Normal',assignee:''})",sandbox),/3–120/)
})

function awaitVm() { return { createContext: vmCreateContext, runInContext: vmRunInContext } }

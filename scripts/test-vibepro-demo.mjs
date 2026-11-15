import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Script } from 'node:vm'

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

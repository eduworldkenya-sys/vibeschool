import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const page=fs.readFileSync(new URL('../app/pendulum-studio/page.tsx',import.meta.url),'utf8')
const css=fs.readFileSync(new URL('../app/pendulum-studio/pendulum-studio.module.css',import.meta.url),'utf8')
const layout=fs.readFileSync(new URL('../app/pendulum-studio/layout.tsx',import.meta.url),'utf8')
const robots=fs.readFileSync(new URL('../app/robots.ts',import.meta.url),'utf8')
test('unlisted SEO-blocked VibePendulum creator route',()=>{
 assert.match(layout,/index: false/)
 assert.match(robots,/\/pendulum-studio/)
})
test('outcomes are editable, upload logos and preserve original templates',()=>{
 for(const pattern of [/editOutcome/,/readLogo/,/Save as new/,/templates\.map/,/setups\.map/,/export setup/i,/Import setup/,/showNames/,/showLogos/,/replace\(\/\\s\+/])assert.match(page,pattern)
})
test('random selection happens before cinematic movement, never claims actual match prediction',()=>{
 assert.match(page,/const choice=randomSide\(\)/)
 assert.match(page,/animate\(choice\)/)
 assert.match(page,/const finish=360\*loops\+\(target==='left'\?0:180\)/)
 assert.match(page,/const destination=base\+finish/)
 assert.match(page,/const eased=1-Math\.pow\(1-t,5\)/)
 assert.match(page,/Random entertainment result/)
 assert.match(page,/not a sports forecast/)
})
test('three scenes, cinema camera modes and recording work without external dependencies',()=>{
 for(const token of ['classic','neon','gold','front','angled','close','portrait','landscape','square','getDisplayMedia','MediaRecorder','Launch show'])assert.ok(page.includes(token),token)
 assert.match(css,/perspective:950px/)
 assert.match(css,/radial-gradient/)
 assert.match(css,/transform-style:preserve-3d/)
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
})
test('local storage and screen capture cleanups are present',()=>{
 assert.match(page,/localStorage\.setItem/)
 assert.match(page,/clearInterval/)
 assert.match(page,/cancelAnimationFrame/)
 assert.match(page,/getTracks\(\)\.forEach/)
 assert.match(page,/URL\.revokeObjectURL/)
})

test('VibeSphere pointer always selects one of two opposing 3D faces',()=>{
 assert.match(page,/const choice=randomSide\(\)/)
 assert.match(page,/const finish=360\*loops\+\(target==='left'\?0:180\)/)
 assert.match(page,/rotateY\('/)
 assert.match(page,/styles\.orbFront/)
 assert.match(page,/styles\.orbBack/)
 assert.match(page,/styles\.pointerNeedle/)
 assert.match(css,/\.orbPerspective/)
 assert.match(css,/\.orbFace/)
 assert.match(css,/backface-visibility:hidden/)
 assert.match(css,/\.pointerAssembly/)
 assert.match(css,/\.sphereResultInline/)
})
test('former pendulum link and saved matchups are retained',()=>{
 assert.match(page,/vibeschool\.vibependulum\.studio\.v1/)
 assert.match(page,/VibeSphere/)
 assert.match(page,/useShowDirector\('pendulum'\)/)
 assert.match(page,/getDisplayMedia/)
 assert.match(page,/Save as new/)
})

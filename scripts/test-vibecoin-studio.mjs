import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('../app/coin-studio/page.tsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../app/coin-studio/coin-studio.module.css', import.meta.url), 'utf8')
const layout = fs.readFileSync(new URL('../app/coin-studio/layout.tsx', import.meta.url), 'utf8')
const director = fs.readFileSync(new URL('../components/games/ShowDirector.tsx', import.meta.url), 'utf8')
const robots = fs.readFileSync(new URL('../app/robots.ts', import.meta.url), 'utf8')

test('coin studio is original, unlisted and uses the shared director', () => {
  assert.match(layout,/index: false/)
  assert.match(robots,/coin-studio/)
  assert.match(page,/useShowDirector\('coin'\)/)
  assert.match(director,/\| 'coin'/)
  assert.match(page,/DirectorControls/)
})
test('fair two-sided random draw is independent of animations', () => {
  assert.match(page,/crypto\.getRandomValues/)
  assert.match(page,/bytes\[0\] % 2 === 0/)
  assert.match(page,/const choice = randomSide\(\)/)
  assert.match(page,/choice === 'heads' \? 0 : 180/)
  assert.doesNotMatch(page,/Math\.random\(\) < \.5 \? 'tails'/)
})
test('coin flip renders both backface-hidden 3D faces with camera and accessibility options', () => {
  assert.match(css,/transform-style:preserve-3d/)
  assert.match(css,/backface-visibility:hidden/)
  assert.match(css,/rotateX\(180deg\)/)
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
  assert.match(page,/requestAnimationFrame/)
  assert.match(page,/current\.automatic/)
  assert.match(page,/phase==='ready'/)
  assert.match(page,/current\.showSafeArea/)
})
test('creator production workflow offers editing, templates, recording, export, and share', () => {
  for (const snippet of ['Football rivalry','Learning challenge','downloadSetup','importSetup','getDisplayMedia','MediaRecorder','Copy studio URL','Copy video caption','coin-studio','showMode','showLogos','backgroundImage']) {
    assert.ok(page.includes(snippet), 'Missing '+snippet)
  }
  assert.match(page,/url\.searchParams\.set\('a'/)
  assert.match(page,/url\.searchParams\.set\('b'/)
  assert.match(page,/current\.batch/)
})

test('a toss alternates visible faces and performs a finite landing', () => {
  assert.match(page,/const desiredFace = choice === 'heads' \? 0 : 180/)
  assert.match(page,/const alignment = \(desiredFace/)
  assert.match(page,/targetAngle = rotation \+ turns \* 360 \+ alignment/)
  assert.doesNotMatch(page,/setRotation\(0\); setFlipKey/)
  assert.doesNotMatch(css,/\.coin\{[^}]*filter:drop-shadow/)
  assert.match(css,/\.coin\{[^}]*transform-style:preserve-3d/)
  assert.match(css,/\.tossTrajectory\.tossing\{animation:coinFlight var\(--flight-duration,4s\)[^}]* 1 both\}/)
  assert.match(css,/@keyframes coinFlight\{[^}]*86%\{transform:translateY\(0\)/)
  assert.match(css,/93%\{transform:translateY\(-5%\)/)
  assert.match(css,/100%\{transform:translateY\(0\)/)
  assert.match(page,/current\.duration \* 1000 \+ 350/)
})

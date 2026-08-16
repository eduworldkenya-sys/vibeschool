#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowsDir = path.join(root, '.github', 'workflows');
const actionPath = path.join(root, '.github', 'actions', 'production-build-contract', 'action.yml');

const fail = (message) => {
  console.error(`CI production-build contract violation: ${message}`);
  process.exitCode = 1;
};

if (!fs.existsSync(actionPath)) {
  fail('canonical action .github/actions/production-build-contract/action.yml is missing');
  process.exit();
}

const action = fs.readFileSync(actionPath, 'utf8');
const requiredActionFragments = [
  'node-version: 20',
  'npm ci',
  'NODE_OPTIONS: --max-old-space-size=6144',
  'NEXT_TELEMETRY_DISABLED: "1"',
  'NEXT_PUBLIC_SUPABASE_URL:',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY:',
  'npm run build',
];

for (const fragment of requiredActionFragments) {
  if (!action.includes(fragment)) {
    fail(`canonical action lost required fragment: ${fragment}`);
  }
}

const workflowFiles = fs
  .readdirSync(workflowsDir)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));

const directBuildPattern = /(?:npm\s+run\s+build|npx\s+next\s+build|(?:^|\s)next\s+build)(?:\s|$)/m;
const buildConsumers = [];

for (const file of workflowFiles) {
  const fullPath = path.join(workflowsDir, file);
  const content = fs.readFileSync(fullPath, 'utf8');

  if (directBuildPattern.test(content)) {
    fail(`${file} defines a production build directly; use ./.github/actions/production-build-contract`);
  }

  if (content.includes('./.github/actions/production-build-contract')) {
    buildConsumers.push(file);
  }
}

const requiredConsumers = [
  'auth-onboarding-hardening.yml',
  'typescript-build-gate.yml',
  'pwa-browser-gate.yml',
];

for (const file of requiredConsumers) {
  if (!buildConsumers.includes(file)) {
    fail(`${file} must consume the canonical production-build action`);
  }
}

if (!process.exitCode) {
  console.log('CI production-build contract: PASS');
  console.log(`Canonical consumers: ${buildConsumers.sort().join(', ')}`);
}

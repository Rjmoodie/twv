#!/usr/bin/env node
/**
 * Type gate.
 *
 * `tsc --noEmit` against the ROOT tsconfig checks nothing: tsconfig.json sets
 * "files": [] and only lists project references, which tsc ignores without
 * --build. That made `npm run typecheck` -- and the CI step calling it -- exit
 * 0 unconditionally, which is how a missing Button import reached production
 * as a ReferenceError. This runs the check against the real project config.
 *
 * This gate used to fail only on the subset of errors that survive bundling
 * and throw at runtime (TS2304/TS2552/TS2307), reporting the rest as a
 * tolerated backlog, because there were 216 of them and no way to land a
 * change without stepping over the noise.
 *
 * That backlog is now zero, so the gate fails on everything. Do not reintroduce
 * an allowance: the cheapest moment to fix a type error is the one where you
 * wrote it, and the previous backlog hid two real defects -- a debounce whose
 * `.cancel()` did not exist and threw on every cleanup, and a chart module
 * whose eleven components all read properties off a lazy import that has none.
 */
import { spawnSync } from 'node:child_process';

const run = spawnSync(
  'npx',
  ['tsc', '-p', 'tsconfig.app.json', '--noEmit', '--pretty', 'false'],
  { encoding: 'utf8', shell: process.platform === 'win32' },
);

const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
const errors = output.split('\n').filter((line) => /error TS\d+:/.test(line));

if (errors.length) {
  console.error(`\nType gate failed: ${errors.length} error(s).\n`);
  for (const line of errors) console.error(`  ${line.trim()}`);
  console.error('');
  process.exit(1);
}

console.log('Type gate passed: 0 type errors.');

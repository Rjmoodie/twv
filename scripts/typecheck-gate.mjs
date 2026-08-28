#!/usr/bin/env node
/**
 * Type gate.
 *
 * `tsc --noEmit` against the ROOT tsconfig checks nothing: tsconfig.json sets
 * "files": [] and only lists project references, which tsc ignores without
 * --build. That made `npm run typecheck` -- and the CI step calling it -- exit
 * 0 unconditionally, which is how a missing Button import reached production
 * as a ReferenceError.
 *
 * This runs the check against the real project config and fails on the errors
 * that become runtime faults, while reporting the remaining backlog. Use
 * `npm run typecheck:full` to see every error.
 */
import { spawnSync } from 'node:child_process';

// Free identifiers survive bundling and throw at runtime.
const FATAL = new Set(['TS2304', 'TS2552']);

const run = spawnSync(
  'npx',
  ['tsc', '-p', 'tsconfig.app.json', '--noEmit', '--pretty', 'false'],
  { encoding: 'utf8', shell: process.platform === 'win32' },
);

const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
const errors = output.split('\n').filter((line) => /error TS\d+:/.test(line));

const fatal = errors.filter((line) => FATAL.has(line.match(/error (TS\d+):/)[1]));

if (fatal.length) {
  console.error(`\nType gate failed: ${fatal.length} unresolved identifier(s).`);
  console.error('These compile but throw at runtime.\n');
  for (const line of fatal) console.error(`  ${line.trim()}`);
  console.error('');
  process.exit(1);
}

const counts = new Map();
for (const line of errors) {
  const code = line.match(/error (TS\d+):/)[1];
  counts.set(code, (counts.get(code) ?? 0) + 1);
}

console.log('Type gate passed: no unresolved identifiers.');
if (errors.length) {
  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([code, n]) => `${code}×${n}`)
    .join('  ');
  console.log(`Pre-existing backlog: ${errors.length} error(s) -- ${summary}`);
  console.log('Run `npm run typecheck:full` for the full list.');
}

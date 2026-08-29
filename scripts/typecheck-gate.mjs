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
//
// TS2307 -- an import that resolves to nothing -- belongs here for the same
// reason, and was added after a directory rename left `App.tsx` importing a
// page that no longer existed. The gate passed, because the identifier was
// bound; the module behind it simply was not there. A static import fails the
// build, but a lazy `import()` inside a route only fails when a user navigates
// to it, which is the worst place to find out.
const FATAL = new Set(['TS2304', 'TS2552', 'TS2307']);

const run = spawnSync(
  'npx',
  ['tsc', '-p', 'tsconfig.app.json', '--noEmit', '--pretty', 'false'],
  { encoding: 'utf8', shell: process.platform === 'win32' },
);

const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
const errors = output.split('\n').filter((line) => /error TS\d+:/.test(line));

const fatal = errors.filter((line) => FATAL.has(line.match(/error (TS\d+):/)[1]));

if (fatal.length) {
  console.error(`\nType gate failed: ${fatal.length} unresolved reference(s).`);
  console.error('An unresolved identifier or module reaches runtime as a throw.\n');
  for (const line of fatal) console.error(`  ${line.trim()}`);
  console.error('');
  process.exit(1);
}

const counts = new Map();
for (const line of errors) {
  const code = line.match(/error (TS\d+):/)[1];
  counts.set(code, (counts.get(code) ?? 0) + 1);
}

console.log('Type gate passed: no unresolved identifiers or modules.');
if (errors.length) {
  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([code, n]) => `${code}×${n}`)
    .join('  ');
  console.log(`Pre-existing backlog: ${errors.length} error(s) -- ${summary}`);
  console.log('Run `npm run typecheck:full` for the full list.');
}

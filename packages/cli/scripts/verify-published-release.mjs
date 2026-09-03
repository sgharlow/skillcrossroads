#!/usr/bin/env node
/**
 * Verify a PUBLISHED release by fetching it from the registry and running it.
 *
 * 🔴 THE BUG THIS EXISTS FOR. skillcrossroads@0.11.3 was published with a `dist/` built
 * before the version refactor, so the tarball's package.json said 0.11.3 while the bundled
 * CLI printed 0.11.1. A marketplace reviewer found it with one command; nothing in this
 * repo could have, and it is worth being precise about why:
 *
 *   - The SOURCE was correct. `cli.ts` resolves the version from package.json at runtime,
 *     and a fresh bundle reports the right number.
 *   - `dist/` is gitignored, so there was no committed artifact to drift.
 *   - `prepublishOnly` rebuilds the bundle, so in principle the stale dist was impossible.
 *
 * Every check that reads this repo therefore passes while the registry serves something
 * else. A guard comparing the local build against local package.json is worse than
 * useless — it is a tautology that reports OK, because the built artifact READS that same
 * package.json at runtime. (Written, tested, and deleted on 2026-09-03 for exactly that.)
 *
 * The only thing that can catch this class is the artifact a user actually downloads. So
 * this script asks the registry, not the working tree.
 *
 *   node scripts/verify-published-release.mjs            # verifies the local version
 *   node scripts/verify-published-release.mjs 0.11.4     # verifies an explicit version
 */
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const PKG_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = require(join(PKG_ROOT, 'package.json'));
const name = pkg.name;
const version = process.argv[2] ?? pkg.version;

const work = mkdtempSync(join(tmpdir(), 'verify-published-'));
const fail = (msg) => {
  console.error(`verify-published: FAIL — ${msg}`);
  rmSync(work, { recursive: true, force: true });
  process.exit(1);
};

try {
  console.log(`verify-published: fetching ${name}@${version} from the registry...`);
  execFileSync('npm', ['pack', `${name}@${version}`, '--silent'], { cwd: work, stdio: 'inherit', shell: process.platform === 'win32' });

  const tgz = `${name}-${version}.tgz`;
  if (!existsSync(join(work, tgz))) fail(`registry did not return ${tgz}`);
  execFileSync('tar', ['-xzf', tgz], { cwd: work, stdio: 'inherit' });

  const root = join(work, 'package');
  const published = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  // 1. The tarball must claim the version we asked for.
  if (published.version !== version) {
    fail(`tarball package.json says ${published.version}, expected ${version}`);
  }

  // 2. THE 0.11.3 CHECK: the binary a user runs must agree with the package it came in.
  const entry = join(root, published.bin?.[name] ?? published.bin ?? 'dist/cli.js');
  const reported = execFileSync(process.execPath, [entry, '--version'], { encoding: 'utf8' })
    .trim()
    .split(/\s+/)
    .pop();
  if (reported !== version) {
    fail(
      `the published binary reports ${reported} but the package is ${version}.\n` +
        `  This is the 0.11.3 defect: a stale dist/ was packed. Rebuild and republish.`,
    );
  }

  // 3. Reviewers must be able to tie the tarball back to its public source.
  if (!published.repository) fail('published package.json has no repository field');

  console.log(
    `verify-published: OK — ${name}@${version} reports ${reported}, ` +
      `repository ${typeof published.repository === 'string' ? published.repository : published.repository.url}`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}

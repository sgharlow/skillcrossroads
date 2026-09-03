#!/usr/bin/env node
/**
 * Assert that a PACKED tarball is safe to publish, from outside the repo.
 *
 *   node scripts/assert-publishable.mjs <path-to-extracted-package-dir>
 *
 * 🔴 WHY THIS RUNS OUTSIDE THE REPO. `dist/` is a gitignored, mutable local artifact and
 * `npm pack` ships whatever happens to be in it. Two different builds land there:
 *
 *   npm run build   → tsc output    — 22 KB, imports picocolors and @beacon/core
 *   npm run bundle  → esbuild       — ~480 KB, self-contained, shebang
 *
 * `bin` points at dist/cli.js either way, so packing after the wrong one produces a package
 * that installs fine and crashes on first use with ERR_MODULE_NOT_FOUND. That state was
 * reproduced by accident on 2026-09-03, which is the evidence that it is easy to hit — the
 * same class that shipped 0.11.3 with a stale dist.
 *
 * The trap is that it is nearly invisible from inside the repo: Node resolves bare imports
 * by walking UP the directory tree, so an extracted package sitting anywhere under the
 * workspace finds the repo's own node_modules and runs perfectly. Verifying from within
 * packages/cli would have passed on a broken tarball. Only somewhere with no node_modules
 * above it tells the truth, which is what the caller must pass in.
 */
import { execFileSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const pkgDir = resolve(process.argv[2] ?? '.');
const fail = (msg) => {
  console.error(`assert-publishable: FAIL — ${msg}`);
  process.exit(1);
};

const manifestPath = join(pkgDir, 'package.json');
if (!existsSync(manifestPath)) fail(`no package.json at ${pkgDir}`);
const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));

const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[pkg.name];
if (!binRel) fail('package.json declares no bin entry');
const bin = join(pkgDir, binRel);
if (!existsSync(bin)) fail(`bin ${binRel} is missing from the tarball`);

// 1. Self-contained: the bundle may import node: builtins and nothing else. A bare
//    specifier means the tsc output was packed instead of the esbuild bundle.
const src = readFileSync(bin, 'utf8');
const bare = [...src.matchAll(/^\s*import[^\n]*?from\s*['"]([^'"]+)['"]/gm)]
  .map((m) => m[1])
  .filter((s) => !s.startsWith('node:') && !s.startsWith('.'));
if (bare.length) {
  fail(
    `the published bundle is not self-contained — bare imports: ${[...new Set(bare)].join(', ')}\n` +
      `  This is the tsc output, not the esbuild bundle. Run \`npm run bundle\` and repack.`,
  );
}

// 2. No install-time code execution.
for (const hook of ['preinstall', 'install', 'postinstall']) {
  if (pkg.scripts?.[hook]) fail(`package.json defines a ${hook} lifecycle script`);
}

// 3. Zero runtime dependencies — the bundle inlines everything.
const deps = Object.keys(pkg.dependencies ?? {});
if (deps.length) fail(`expected zero runtime dependencies, found: ${deps.join(', ')}`);

// 4. Traceable back to source.
if (!pkg.repository) fail('published package.json has no repository field');

// 5. The binary runs here, with nothing around it, and agrees about its own version.
const reported = execFileSync(process.execPath, [bin, '--version'], { encoding: 'utf8' })
  .trim()
  .split(/\s+/)
  .pop();
if (reported !== pkg.version) {
  fail(`the packed binary reports ${reported} but the package is ${pkg.version} — stale dist/`);
}

console.log(
  `assert-publishable: OK — ${pkg.name}@${pkg.version} is self-contained, ` +
    `has no install hooks, no runtime deps, names its repository, and reports ${reported}.`,
);

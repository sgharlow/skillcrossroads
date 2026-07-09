// Bundle the CLI into a single self-contained ESM file for npm publish.
// @beacon/core is a private workspace package (never published) — bundling inlines it so the
// published package has zero runtime deps. The banner provides the shebang (line 1) plus a
// createRequire shim, because some bundled deps do a dynamic `require()` that esbuild's ESM output
// would otherwise stub out with a throwing shim.
import { build } from "esbuild";

await build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/cli.js",
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire as __cr } from 'node:module';\nconst require = __cr(import.meta.url);",
  },
});

console.error("bundled → dist/cli.js");

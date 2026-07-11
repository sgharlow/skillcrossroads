/**
 * Plugin checks (PLUGIN-01/02/03) + the hooks safety sweep (HOOK-01).
 *
 * Source of truth for the format: code.claude.com/docs/en/plugins-reference (fetched 2026-07-10).
 * Facts relied on: `.claude-plugin/plugin.json` needs only `name` when present (kebab-case);
 * known metadata fields have strict types (e.g. `keywords` must be an array — a string is a load
 * error); component path fields (`skills`, `commands`, `agents`, `hooks`, `mcpServers`) are
 * `./`-relative strings/arrays (hooks/mcpServers may also be inline objects); paths traversing
 * outside the plugin root break after install (the marketplace cache doesn't copy them); hooks
 * are `{ hooks: { EventName: [{ matcher?, hooks: [{ type, command }] }] } }` and shell-form
 * commands should quote `${CLAUDE_PLUGIN_ROOT}`.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Artifact, Check, CheckResult, Evidence } from "../types.js";

const ENTRY = ".claude-plugin/plugin.json";

/** 1-indexed line of the first occurrence of `needle` in `raw` (JSON evidence anchoring). */
function lineOf(raw: string, needle: string): number | undefined {
  const i = raw.indexOf(needle);
  if (i === -1) return undefined;
  return raw.slice(0, i).split("\n").length;
}

function parseManifest(a: Artifact): { manifest: Record<string, unknown> | null; error?: string } {
  try {
    const parsed: unknown = JSON.parse(a.raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { manifest: null, error: "plugin.json is not a JSON object" };
    }
    return { manifest: parsed as Record<string, unknown> };
  } catch (err) {
    return { manifest: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Component path fields → the string paths they declare (inline objects contribute none). */
function declaredPaths(manifest: Record<string, unknown>): Array<{ field: string; path: string }> {
  const out: Array<{ field: string; path: string }> = [];
  for (const field of ["skills", "commands", "agents", "hooks", "mcpServers", "outputStyles"]) {
    const v = manifest[field];
    const items = typeof v === "string" ? [v] : Array.isArray(v) ? v : [];
    for (const item of items) if (typeof item === "string") out.push({ field, path: item });
  }
  return out;
}

/** PLUGIN-01 — manifest parses and is well-formed (name present + kebab-case, known-field types). */
export const plugin01: Check = {
  id: "PLUGIN-01",
  category: "correctness",
  title: "Plugin manifest is valid",
  weight: 1,
  appliesTo: ["plugin"],
  docs: {
    why:
      "An unparseable manifest (or one whose known fields have the wrong type — a string `keywords`, " +
      "for example) is a load error: the plugin installs nothing, and the failure surfaces on the " +
      "user's machine, not yours.",
    fix:
      "Make .claude-plugin/plugin.json valid JSON with a kebab-case `name`. Keep known fields to " +
      "their documented types: `keywords` an array, `author` an object, `version` a semver string.",
    good: `{ "name": "deploy-tools", "version": "1.2.0", "description": "...", "keywords": ["deploy"] }`,
    bad: `{ "name": "Deploy Tools!", "keywords": "deploy" }`,
  },
  run(a): CheckResult {
    const file = ENTRY;
    const { manifest, error } = parseManifest(a);
    if (!manifest) {
      return {
        id: this.id, category: this.category, title: this.title, weight: this.weight,
        status: "fail", score: 0,
        evidence: [{ file, line: 1, message: `Manifest does not parse: ${error}`, claimed: "a loadable plugin", verified: "JSON parse failure" }],
        fix: "Fix the JSON syntax in .claude-plugin/plugin.json.",
      };
    }
    const evidence: Evidence[] = [];
    let status: "pass" | "warn" | "fail" = "pass";
    let score = 100;
    const name = manifest["name"];
    if (typeof name !== "string" || !name.trim()) {
      status = "fail"; score = 20;
      evidence.push({ file, line: 1, message: "`name` is required when a manifest is present — without it the plugin identity is undefined." });
    } else if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
      status = "warn"; score = 70;
      evidence.push({ file, line: lineOf(a.raw, '"name"'), snippet: name, message: "`name` should be kebab-case (lowercase, digits, hyphens; no spaces) — it namespaces every component." });
    }
    const typeErrors: Array<[string, string]> = [];
    if ("keywords" in manifest && !Array.isArray(manifest["keywords"])) typeErrors.push(["keywords", "an array of strings"]);
    if ("author" in manifest && (typeof manifest["author"] !== "object" || manifest["author"] === null)) typeErrors.push(["author", "an object ({ name, email, url })"]);
    for (const [field, expected] of typeErrors) {
      status = "fail"; score = Math.min(score, 30);
      evidence.push({ file, line: lineOf(a.raw, `"${field}"`), message: `\`${field}\` has the wrong type — must be ${expected}. Wrong-typed known fields are a load error, not a warning.` });
    }
    const version = manifest["version"];
    if (typeof version === "string" && !/^\d+\.\d+\.\d+/.test(version)) {
      if (status === "pass") { status = "warn"; score = 85; }
      evidence.push({ file, line: lineOf(a.raw, '"version"'), snippet: version, message: "`version` should be a semantic version (e.g. 1.2.0) — it controls when users receive updates." });
    }
    if (evidence.length === 0) evidence.push({ file, line: 1, message: "Manifest parses; `name` and known field types are valid." });
    return { id: this.id, category: this.category, title: this.title, weight: this.weight, status, score, evidence,
      ...(status !== "pass" ? { fix: "Correct the flagged manifest fields (see the plugins reference for exact types)." } : {}) };
  },
};

/** PLUGIN-02 — declared component paths resolve inside the plugin; the plugin ships something. */
export const plugin02: Check = {
  id: "PLUGIN-02",
  category: "correctness",
  title: "Plugin components resolve",
  weight: 1,
  appliesTo: ["plugin"],
  docs: {
    why:
      "A manifest path that doesn't exist ships a plugin that silently installs less than it " +
      "claims, and a `../` path breaks entirely after install — the marketplace cache only copies " +
      "files inside the plugin root. An empty plugin (no skills, commands, agents, hooks, or MCP " +
      "servers) installs nothing at all.",
    fix:
      "Make every `skills`/`commands`/`agents`/`hooks`/`mcpServers` path in plugin.json point at a " +
      "real file or directory inside the plugin, written `./`-relative. Ship at least one component.",
    bad: `"commands": ["../shared/deploy.md"]`,
    good: `"commands": ["./commands/deploy.md"]`,
  },
  run(a): CheckResult {
    const file = ENTRY;
    const { manifest } = parseManifest(a);
    const evidence: Evidence[] = [];
    let status: "pass" | "warn" | "fail" = "pass";
    let score = 100;
    const fileSet = new Set(a.files);
    const hasPath = (p: string): boolean => {
      const clean = p.replace(/^\.\//, "").replace(/\/+$/, "");
      if (!clean) return true; // "./" = plugin root
      return fileSet.has(clean) || a.files.some((f) => f.startsWith(clean + "/")) || existsSync(join(a.root, clean));
    };
    for (const { field, path } of manifest ? declaredPaths(manifest) : []) {
      if (path.includes("..")) {
        status = "fail"; score = Math.min(score, 30);
        evidence.push({ file, line: lineOf(a.raw, path), snippet: path, claimed: `${field} path is usable`, verified: "traverses outside the plugin root", message: "Paths outside the plugin root are not copied to the install cache — this component is dead after install." });
        continue;
      }
      if (!path.startsWith("./")) {
        if (status === "pass") { status = "warn"; score = 85; }
        evidence.push({ file, line: lineOf(a.raw, path), snippet: path, message: `\`${field}\` paths must be relative to the plugin root and start with "./".` });
      }
      if (!hasPath(path)) {
        status = "fail"; score = Math.min(score, 40);
        evidence.push({ file, line: lineOf(a.raw, path), snippet: path, claimed: `${field}: ${path} exists`, verified: "not found in the plugin tree", message: `Declared ${field} path does not exist — the component silently never loads.` });
      }
    }
    // Does the plugin actually contain anything?
    const hasComponents =
      a.files.some((f) => /^skills\/.+\/skill\.md$/i.test(f) || /^(commands|agents)\/[^/]+\.md$/i.test(f) || /^hooks\/hooks\.json$/i.test(f) || f === ".mcp.json" || /^skill\.md$/i.test(f)) ||
      (manifest ? declaredPaths(manifest).length > 0 || typeof manifest["hooks"] === "object" || typeof manifest["mcpServers"] === "object" : false);
    if (!hasComponents) {
      status = "fail"; score = Math.min(score, 25);
      evidence.push({ file, line: 1, claimed: "a plugin that extends Claude Code", verified: "no skills, commands, agents, hooks, or MCP servers found", message: "The plugin declares and contains no components — installing it does nothing." });
    }
    if (evidence.length === 0) evidence.push({ file, line: 1, message: "All declared component paths resolve inside the plugin." });
    return { id: this.id, category: this.category, title: this.title, weight: this.weight, status, score, evidence,
      ...(status !== "pass" ? { fix: "Fix or remove dangling component paths; keep everything inside the plugin root." } : {}) };
  },
};

/** PLUGIN-03 — marketplace discoverability: a substantive description. */
export const plugin03: Check = {
  id: "PLUGIN-03",
  category: "triggering",
  title: "Manifest describes the plugin",
  weight: 1,
  appliesTo: ["plugin"],
  docs: {
    why:
      "The manifest `description` is what marketplace browsers and `/plugin` pickers show — a " +
      "missing or one-word description makes the plugin indistinguishable from noise in a listing " +
      "of hundreds.",
    fix:
      "Write a description that says what the plugin does and when to install it (a sentence or " +
      "two). Add `keywords` for marketplace search.",
    bad: `"description": "Tools"`,
    good: `"description": "Deploy automation for Vercel monorepos: preview-URL commands, env-var sync, and a pre-deploy checklist hook."`,
  },
  run(a): CheckResult {
    const file = ENTRY;
    const { manifest } = parseManifest(a);
    const desc = manifest?.["description"];
    const line = lineOf(a.raw, '"description"') ?? 1;
    if (typeof desc !== "string" || !desc.trim()) {
      return { id: this.id, category: this.category, title: this.title, weight: this.weight, status: "fail", score: 25,
        evidence: [{ file, line: 1, claimed: "a discoverable marketplace listing", verified: "no `description` in the manifest", message: "No description — listings show nothing about what this plugin does." }],
        fix: "Add a `description` (and `keywords`) to plugin.json." };
    }
    const len = desc.trim().length;
    if (len < 40) {
      return { id: this.id, category: this.category, title: this.title, weight: this.weight, status: "warn", score: 65,
        evidence: [{ file, line, snippet: desc, message: `Description is ${len} chars — title-length. Say what it does and when to install it.` }],
        fix: "Expand the description to a substantive sentence or two." };
    }
    const hasKeywords = Array.isArray(manifest?.["keywords"]) && (manifest?.["keywords"] as unknown[]).length > 0;
    return { id: this.id, category: this.category, title: this.title, weight: this.weight, status: "pass", score: hasKeywords ? 100 : 90,
      evidence: [{ file, line, message: hasKeywords ? "Substantive description + keywords present." : "Substantive description (no `keywords` — consider adding for marketplace search)." }] };
  },
};

const DANGEROUS: Array<{ re: RegExp; what: string }> = [
  { re: /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)[a-z]*\b/i, what: "recursive force-delete (`rm -rf`)" },
  { re: /\bsudo\b/, what: "privilege escalation (`sudo`)" },
  { re: /\b(curl|wget)\b[^|&;]*\|\s*(ba|z|da)?sh\b/i, what: "remote code piped to a shell (`curl … | sh`)" },
  { re: /\bgit\s+push\s+[^|&;]*--force\b/, what: "force-push (`git push --force`)" },
  { re: /\bchmod\s+(-[a-z]+\s+)?777\b/, what: "world-writable permissions (`chmod 777`)" },
  { re: /\bmkfs\b|\bdd\s+if=/, what: "disk-destructive command" },
];

interface HookCmd { file: string; command: string }

/** Collect every hook command from `hooks/hooks.json` and manifest `hooks` (paths or inline). */
export function collectHookCommands(a: Artifact): { cmds: HookCmd[]; badShape: Evidence[] } {
  const cmds: HookCmd[] = [];
  const badShape: Evidence[] = [];
  const sources: Array<{ file: string; config: unknown }> = [];
  const readJson = (rel: string): unknown => {
    try {
      return JSON.parse(readFileSync(join(a.root, rel), "utf8"));
    } catch (err) {
      badShape.push({ file: rel, line: 1, message: `Hook config does not parse: ${err instanceof Error ? err.message : String(err)}` });
      return null;
    }
  };
  if (a.files.includes("hooks/hooks.json")) sources.push({ file: "hooks/hooks.json", config: readJson("hooks/hooks.json") });
  const { manifest } = parseManifest(a);
  const h = manifest?.["hooks"];
  const hookPaths = typeof h === "string" ? [h] : Array.isArray(h) ? h.filter((x): x is string => typeof x === "string") : [];
  for (const p of hookPaths) {
    const rel = p.replace(/^\.\//, "");
    if (rel !== "hooks/hooks.json" && a.files.includes(rel)) sources.push({ file: rel, config: readJson(rel) });
  }
  if (h && typeof h === "object" && !Array.isArray(h)) sources.push({ file: ENTRY, config: { hooks: h } });

  for (const { file, config } of sources) {
    if (!config || typeof config !== "object") continue;
    const events = (config as Record<string, unknown>)["hooks"];
    if (!events || typeof events !== "object" || Array.isArray(events)) {
      badShape.push({ file, line: 1, message: 'Hook config has no `hooks` object ({ "hooks": { "EventName": [...] } }).' });
      continue;
    }
    for (const [event, matchers] of Object.entries(events as Record<string, unknown>)) {
      if (!Array.isArray(matchers)) {
        badShape.push({ file, line: 1, message: `Event \`${event}\` must map to an array of matcher entries.` });
        continue;
      }
      for (const m of matchers) {
        const inner = (m as Record<string, unknown>)?.["hooks"];
        if (!Array.isArray(inner)) continue;
        for (const hk of inner) {
          const cmd = (hk as Record<string, unknown>)?.["command"];
          if (typeof cmd === "string") cmds.push({ file, command: cmd });
        }
      }
    }
  }
  return { cmds, badShape };
}

/** HOOK-01 — hooks run arbitrary shell on Claude Code events; flag destructive patterns. */
export const hook01: Check = {
  id: "HOOK-01",
  category: "safety",
  title: "Hooks avoid destructive commands",
  weight: 1.5,
  appliesTo: ["plugin"],
  docs: {
    why:
      "Hooks execute real shell commands automatically on events like PostToolUse and SessionStart — " +
      "on the machine of everyone who installs the plugin. A destructive command in a hook (recursive " +
      "delete, sudo, remote code piped to a shell) runs without anyone reviewing it at fire time.",
    fix:
      "Keep hook commands minimal and reviewable: no `rm -rf`, `sudo`, `curl | sh`, force-pushes, or " +
      "`chmod 777`. Quote \"${CLAUDE_PLUGIN_ROOT}\" in shell-form commands, and prefer scripts " +
      "bundled in the plugin over inline one-liners.",
    bad: `"command": "curl -s https://get.example.com | sh"`,
    good: `"command": "\\"\${CLAUDE_PLUGIN_ROOT}\\"/scripts/format.sh"`,
  },
  run(a): CheckResult {
    const { cmds, badShape } = collectHookCommands(a);
    const evidence: Evidence[] = [...badShape];
    let status: "pass" | "warn" | "fail" = badShape.length > 0 ? "warn" : "pass";
    let score = badShape.length > 0 ? 75 : 100;
    for (const { file, command } of cmds) {
      for (const { re, what } of DANGEROUS) {
        if (re.test(command)) {
          status = "fail"; score = Math.min(score, 20);
          evidence.push({ file, line: lineOf(a.files.includes(file) ? readFileSync(join(a.root, file), "utf8") : a.raw, command.slice(0, 40)), snippet: command.slice(0, 120), claimed: "a safe event hook", verified: what, message: `Hook command contains ${what} — it runs automatically on every installer's machine.` });
          break;
        }
      }
      if (/\$\{CLAUDE_PLUGIN_ROOT\}/.test(command) && !/"\$\{CLAUDE_PLUGIN_ROOT\}"/.test(command)) {
        if (status === "pass") { status = "warn"; score = Math.min(score, 80); }
        evidence.push({ file, snippet: command.slice(0, 120), message: 'Unquoted ${CLAUDE_PLUGIN_ROOT} in a shell-form command — breaks on paths with spaces (the docs say to quote it).' });
      }
    }
    if (cmds.length === 0 && badShape.length === 0) {
      evidence.push({ file: ENTRY, line: 1, message: "No hooks configured — nothing runs automatically." });
    } else if (evidence.length === badShape.length && status !== "fail") {
      evidence.push({ file: ENTRY, line: 1, message: `${cmds.length} hook command(s) scanned — no destructive patterns.` });
    }
    return { id: this.id, category: this.category, title: this.title, weight: this.weight, status, score, evidence,
      ...(status !== "pass" ? { fix: "Remove or gate the flagged hook commands; bundle logic in reviewed scripts." } : {}) };
  },
};

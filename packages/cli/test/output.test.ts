import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { audit, type AuditResult, type ModelClient } from "@beacon/core";
import { sanitizeText, emitSingle, emitSuggestions } from "../src/output.js";

const SITE = "https://skillcrossroads.com";
// dangling-ref has a real STRUCT-05 failure, so it produces findings to suggest against.
const DANGLING_REF = resolve("packages/core/test/fixtures/skills/dangling-ref");

let dir: string;
let out: string;
let err: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sc-output-"));
  out = "";
  err = "";
  vi.spyOn(process.stdout, "write").mockImplementation((s: string | Uint8Array) => ((out += String(s)), true));
  vi.spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => ((err += String(s)), true));
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

/** A capturing stream for emitSuggestions' `out` parameter. */
function captureStream(): { stream: NodeJS.WriteStream; text: () => string } {
  let buf = "";
  return {
    stream: { write: (s: string) => ((buf += s), true) } as unknown as NodeJS.WriteStream,
    text: () => buf,
  };
}

describe("sanitizeText — model output over untrusted artifacts must not drive the terminal", () => {
  it("strips ESC[ CSI sequences (colors, cursor moves) and the single-byte \\x9b CSI", () => {
    expect(sanitizeText("\x1b[31mEVIL\x1b[0m")).toBe("EVIL");
    expect(sanitizeText("\x1b[2J\x1b[Hwiped")).toBe("wiped");
    expect(sanitizeText("\x9b31mEVIL\x9b0m")).toBe("EVIL");
  });

  it("strips other ESC-introduced sequences and bare control chars including DEL", () => {
    expect(sanitizeText("\x1b]0;title\x07text")).toBe("0;titletext"); // OSC intro + BEL
    expect(sanitizeText("a\x00b\x08c\x0bd\x7fe")).toBe("abcde");
  });

  it("keeps newlines, tabs, and ordinary text untouched", () => {
    expect(sanitizeText("line one\n\tindented — ok")).toBe("line one\n\tindented — ok");
  });
});

describe("emitSuggestions — sanitizes suggestion text before printing", () => {
  const result = audit(DANGLING_REF) as AuditResult;

  it("strips ANSI/control chars from summary, current, proposed, and steps", async () => {
    const model: ModelClient = {
      name: "stub",
      generateStructured: async () => ({
        suggestions: [
          {
            checkId: "STRUCT-05",
            summary: "fix \x1b[31mEVIL\x1b[0m ref",
            current: "bad\x9b31m text",
            proposed: "good\x07 text",
          },
          { checkId: "STRUCT-05", summary: "steps too", steps: ["do \x1b[2J\x1b[Hthis"] },
        ],
      }),
    };
    const cap = captureStream();
    await emitSuggestions(result, { model }, 3, cap.stream);
    const text = cap.text();
    expect(text).toContain("EVIL"); // content survives…
    expect(text).not.toContain("\x1b[31m"); // …the escape sequences do not
    expect(text).not.toContain("\x9b");
    expect(text).not.toContain("\x07");
    expect(text).not.toContain("\x1b[2J");
    expect(text).toContain("do this");
  });

  it("reuses precomputed suggestions without calling the model again", async () => {
    let calls = 0;
    const model: ModelClient = {
      name: "stub",
      generateStructured: async () => (calls++, { suggestions: [] }),
    };
    const cap = captureStream();
    await emitSuggestions(result, { model }, 3, cap.stream, [
      { checkId: "STRUCT-05", summary: "precomputed \x1b[31mfix\x1b[0m" },
    ]);
    expect(calls).toBe(0);
    expect(cap.text()).toContain("precomputed fix");
  });
});

describe("emitSingle — the --html artifact includes the suggestions section", () => {
  it("passes suggestions through to renderHtml (regression: --suggest --html dropped them)", () => {
    const result = audit(DANGLING_REF) as AuditResult;
    const htmlPath = join(dir, "card.html");
    emitSingle(result, {
      markdown: false,
      html: htmlPath,
      badge: undefined,
      siteUrl: SITE,
      suggestions: [{ checkId: "STRUCT-05", summary: "Remove the dangling converter.md reference" }],
    });
    const html = readFileSync(htmlPath, "utf8");
    expect(html).toContain("Suggested fixes");
    expect(html).toContain("Remove the dangling converter.md reference");
  });

  it("writes no suggestions section when none are supplied", () => {
    const result = audit(DANGLING_REF) as AuditResult;
    const htmlPath = join(dir, "plain.html");
    emitSingle(result, { markdown: false, html: htmlPath, badge: undefined, siteUrl: SITE });
    expect(readFileSync(htmlPath, "utf8")).not.toContain("Suggested fixes");
  });
});

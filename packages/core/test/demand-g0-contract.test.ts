import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import * as gate from "../src/demand/g0-gate.js";

/**
 * One definition, two readers. PROJECT.yaml's G0-launch gate lists its pass arms once
 * (`pass_arms`); the code mirrors it as G0_PASS_ARMS. If either side changes alone, this fails —
 * the 2026-10-19 drift (code passing on referred scans + paid subs, which the target never named)
 * cannot recur silently.
 */
const PROJECT_YAML = fileURLToPath(new URL("../../../PROJECT.yaml", import.meta.url));

function g0LaunchGate(): Record<string, unknown> {
  const doc = parse(readFileSync(PROJECT_YAML, "utf8")) as { gates?: Array<Record<string, unknown>> };
  const g = (doc.gates ?? []).find((x) => x.id === "G0-launch");
  if (!g) throw new Error("PROJECT.yaml has no G0-launch gate");
  return g;
}

describe("G0 pass arms — PROJECT.yaml and g0-gate.ts agree", () => {
  it("PROJECT.yaml G0-launch pass_arms deep-equals G0_PASS_ARMS", () => {
    expect(g0LaunchGate().pass_arms).toEqual([...((gate as any).G0_PASS_ARMS ?? [])]);
    expect((gate as any).G0_PASS_ARMS).toBeDefined();
  });

  it("every unmeasured arm is a pass arm, and measured + unmeasured cover them all", () => {
    const pass = [...((gate as any).G0_PASS_ARMS ?? [])] as string[];
    const unmeasured = [...((gate as any).G0_UNMEASURED_ARMS ?? [])] as string[];
    const measured = [...((gate as any).G0_MEASURED_ARMS ?? [])] as string[];
    expect(unmeasured.length).toBeGreaterThan(0);
    for (const a of unmeasured) expect(pass).toContain(a);
    expect([...measured, ...unmeasured].sort()).toEqual([...pass].sort());
  });

  it("G0-launch carries a measured_by date", () => {
    const v = g0LaunchGate().measured_by;
    const iso = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FOOTER_LINKS } from "../components/SiteNav";
import { metadata as termsMetadata } from "../app/terms/page";
import { TEAM, TEAM_COMING } from "../app/pricing/tiers";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(WEB, rel), "utf8");
const TERMS = "app/terms/page.tsx";

/** Rendered prose: comments out, whitespace collapsed. */
const prose = (rel: string) =>
  read(rel)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\s+/g, " ");

describe("/terms exists and is reachable", () => {
  it("the footer (homepage + every SiteFooter page) links Terms next to Privacy", () => {
    const hrefs = FOOTER_LINKS.map((l) => l.href);
    expect(hrefs).toContain("/terms");
    expect(hrefs).toContain("/privacy");
  });

  it("every internal footer link resolves to an app route", () => {
    const missing = FOOTER_LINKS.map((l) => l.href)
      .filter((h) => h.startsWith("/"))
      .filter((h) => !["page.tsx", "route.ts"].some((f) => existsSync(join(WEB, "app", h, f))));
    expect(missing, "footer links pointing at routes that 404").toEqual([]);
  });

  it("declares its canonical URL", () => {
    expect(termsMetadata.alternates?.canonical).toBe("/terms");
  });

  it("the pricing page points subscribers at the Terms", () => {
    expect(read("app/pricing/page.tsx")).toContain('href="/terms"');
  });

  it("is in the sitemap", () => {
    expect(read("app/sitemap.ts")).toContain("/terms");
  });
});

describe("/terms states what the code does", () => {
  it("names the same trial length the checkout route actually sets", () => {
    const m = /trial_period_days:\s*(\d+)/.exec(read("app/api/checkout/route.ts"));
    expect(m, "checkout no longer sets trial_period_days — re-check the Terms' trial wording").not.toBeNull();
    expect(prose(TERMS)).toContain(`${m![1]}-day free trial`);
  });

  it("uses the same contact address as /privacy", () => {
    const addr = (rel: string) =>
      /CONTACT_EMAIL = "([^"]+)"/.exec(read(rel))?.[1] ?? /mailto:([^"`?${}]+)/.exec(read(rel))?.[1];
    expect(addr(TERMS)).toBeDefined();
    expect(addr(TERMS)).toBe(addr("app/privacy/page.tsx"));
  });

  it("states the 30-day money-back guarantee (Steve, 2026-09-28) and that refunds are manual", () => {
    const terms = prose(TERMS);
    expect(terms).toMatch(/30-day money-back guarantee/);
    expect(terms).toMatch(/within 30 days of a charge/);
    expect(terms).toMatch(/issued by hand through Stripe, not automatically/);
  });

  it("does not promise an uptime SLA", () => {
    expect(prose(TERMS)).toMatch(/no uptime guarantee/i);
    expect(prose(TERMS)).not.toMatch(/\b99(\.\d+)?%/);
  });
});

describe("/terms reports its own revision date honestly", () => {
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const declared = (() => {
    const m = /UPDATED = "(\d{1,2}) (\w+) (\d{4})"/.exec(read(TERMS));
    if (!m || MONTHS.indexOf(m[2]) < 0) return null;
    return new Date(Date.UTC(Number(m[3]), MONTHS.indexOf(m[2]), Number(m[1])));
  })();

  it("declares UPDATED = 'D Month YYYY'", () => {
    expect(declared).not.toBeNull();
  });

  it("is not older than the file's last commit", () => {
    let committed: Date | null = null;
    try {
      const d = execFileSync("git", ["log", "-1", "--format=%cs", "--", join(WEB, TERMS)], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      committed = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00Z`) : null;
    } catch {
      committed = null; // no git (source export) — skip, don't fail
    }
    if (!declared || !committed) return;
    expect(
      declared.getTime() >= committed.getTime(),
      "Move UPDATED in the same commit as the edit to /terms",
    ).toBe(true);
  });
});

describe("/pricing: nothing unbuilt reads as included in Team", () => {
  it("Team has no check-marked items — seats, org rules and a team dashboard are not built (ROADMAP Deferred)", () => {
    expect(TEAM).toEqual([]);
  });

  it("the unbuilt Team features are shown as coming, not dropped silently", () => {
    const text = TEAM_COMING.join(" ").toLowerCase();
    expect(text).toContain("seats");
    expect(text).toContain("custom rules");
    expect(text).toContain("dashboard");
  });

  it("the homepage Team card says the same thing", () => {
    const home = prose("app/page.tsx");
    expect(home).toMatch(/Team<\/h3> <p>Coming, not built yet/);
  });
});

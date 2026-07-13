import { describe, it, expect } from "vitest";
import { metadata as layoutMetadata } from "../app/layout";
import { metadata as homeMetadata } from "../app/page";
import { metadata as pricingMetadata } from "../app/pricing/page";
import { metadata as reportMetadata } from "../app/report/page";
import { metadata as reportAgentsMetadata } from "../app/report-agents/page";

function asString(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

describe("site layout metadata", () => {
  it("describes all five graded artifact kinds", () => {
    const description = asString(layoutMetadata.description);
    expect(description).toContain("skills");
    expect(description).toContain("agents");
    expect(description).toContain("slash commands");
    expect(description).toContain("MCP configs");
    expect(description).toContain("plugins");
  });
});

describe("/ and /pricing canonical URLs", () => {
  it("home page declares a canonical URL", () => {
    expect(homeMetadata.alternates?.canonical).toBe("/");
  });

  it("pricing page declares a canonical URL", () => {
    expect(pricingMetadata.alternates?.canonical).toBe("/pricing");
  });
});

describe("/report page metadata", () => {
  it("openGraph.url points at /report, not the homepage", () => {
    const url = asString(reportMetadata.openGraph?.url);
    expect(url).toContain("/report");
    expect(url).not.toBe("/");
    expect(url).not.toBe("https://skillcrossroads.com");
  });

  it("description mentions the report's headline stat", () => {
    const description = asString(reportMetadata.description);
    expect(description).toContain("73%");
    expect(description.toLowerCase()).toContain("trigger");
  });

  it("has a canonical URL and a twitter card", () => {
    expect(reportMetadata.alternates?.canonical).toBe("/report");
    expect(reportMetadata.twitter?.card).toBe("summary_large_image");
  });

  it("title uses absolute form to bypass layout template", () => {
    expect(reportMetadata.title).toBeDefined();
    expect(typeof reportMetadata.title).toBe("object");
    const titleObj = reportMetadata.title as { absolute: string };
    expect(titleObj.absolute).toBe("State of Claude Code Skills — Skill Crossroads");
  });
});

describe("/report-agents page metadata", () => {
  it("openGraph.url points at /report-agents, not the homepage", () => {
    const url = asString(reportAgentsMetadata.openGraph?.url);
    expect(url).toContain("/report-agents");
    expect(url).not.toBe("/");
    expect(url).not.toBe("https://skillcrossroads.com");
  });

  it("description mentions the report's headline stat", () => {
    const description = asString(reportAgentsMetadata.description);
    expect(description).toContain("43%");
    expect(description.toLowerCase()).toContain("tools");
  });

  it("has a canonical URL and a twitter card", () => {
    expect(reportAgentsMetadata.alternates?.canonical).toBe("/report-agents");
    expect(reportAgentsMetadata.twitter?.card).toBe("summary_large_image");
  });

  it("title uses absolute form to bypass layout template", () => {
    expect(reportAgentsMetadata.title).toBeDefined();
    expect(typeof reportAgentsMetadata.title).toBe("object");
    const titleObj = reportAgentsMetadata.title as { absolute: string };
    expect(titleObj.absolute).toBe("State of Claude Code Agents & Commands — Skill Crossroads");
  });
});

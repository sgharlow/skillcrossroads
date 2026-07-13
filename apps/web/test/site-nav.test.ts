import { describe, it, expect } from "vitest";
import { NAV_LINKS, FOOTER_LINKS } from "../components/SiteNav";

// Asserts against the exported data array rather than rendering the component: SiteNav.tsx's JSX
// requires a React-JSX-aware transform this workspace's vitest config doesn't set up for .tsx
// (out of scope here — nav content is fully determined by NAV_LINKS/FOOTER_LINKS, which the
// component maps verbatim into both the desktop nav and the mobile menu).
describe("SiteNav — Reports is a top-nav item, not footer-only", () => {
  it("NAV_LINKS (rendered in both the desktop nav and the mobile menu) includes Reports -> /report", () => {
    expect(NAV_LINKS).toContainEqual({ href: "/report", label: "Reports" });
  });

  it("Reports keeps its place alongside the other primary destinations, not just appended", () => {
    const hrefs = NAV_LINKS.map((l) => l.href);
    expect(hrefs).toEqual(["/guide", "/gallery", "/report", "/pricing", "/account"]);
  });

  it("the footer still carries Report + Agents report too (footer-only was the original bug, not a regression to reintroduce)", () => {
    const hrefs = FOOTER_LINKS.map((l) => l.href);
    expect(hrefs).toContain("/report");
    expect(hrefs).toContain("/report-agents");
  });
});

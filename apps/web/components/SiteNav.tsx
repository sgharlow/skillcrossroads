import type { ReactElement } from "react";
import { Signpost } from "@/components/CrossroadsBadge";

/**
 * The ONE authoritative site navigation + footer. Every non-scorecard page renders these instead
 * of a hand-rolled header — the per-page copies had already drifted (only the homepage linked
 * /guide; /paste had no nav at all; the dashboard used a different brand treatment). Scorecard
 * pages (`/s/...`, `/scorecard`) stay deliberately self-contained: they are the shareable,
 * committed-dark artifact, not part of the marketing shell.
 *
 * Scoped class names (`site-*`) so the embedded styles never collide with a page's local CSS.
 */

/** Exported (not just used locally) so tests can assert nav contents without rendering JSX. */
export const NAV_LINKS = [
  { href: "/guide", label: "Guide" },
  { href: "/gallery", label: "Gallery" },
  { href: "/report", label: "Reports" },
  { href: "/pricing", label: "Pricing" },
  { href: "/account", label: "Account" },
] as const;

export const FOOTER_LINKS = [
  { href: "/guide", label: "Guide" },
  { href: "/scorecard", label: "Sample scorecard" },
  { href: "/gallery", label: "Gallery" },
  { href: "/pricing", label: "Pricing" },
  { href: "/report", label: "Report" },
  { href: "/report-agents", label: "Agents report" },
  { href: "/docs/checks", label: "Check reference" },
  { href: "/docs/code-handling", label: "Your code & privacy" },
  { href: "/dashboard", label: "Ecosystem stats" },
  { href: "https://github.com/sgharlow/skillcrossroads", label: "GitHub" },
] as const;

const GITHUB_URL = "https://github.com/sgharlow/skillcrossroads";

/** Top navigation. Pass the page's own path as `current` for aria-current highlighting. */
export function SiteNav({ current }: { current?: string }): ReactElement {
  const links = NAV_LINKS.map((l) => (
    <a key={l.href} href={l.href} aria-current={current === l.href ? "page" : undefined}>
      {l.label}
    </a>
  ));
  return (
    <header className="site-nav">
      <a className="site-brand" href="/">
        <Signpost size={22} />
        <span>Skill Crossroads</span>
      </a>
      <nav className="site-links" aria-label="Site">
        {links}
        <a href={GITHUB_URL}>GitHub</a>
        <a className="site-cta" href="/#scan">Scan a skill</a>
      </nav>
      <details className="site-menu">
        <summary aria-label="Open menu">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </summary>
        <nav aria-label="Site">
          {links}
          <a href={GITHUB_URL}>GitHub</a>
          <a className="site-cta" href="/#scan">Scan a skill</a>
        </nav>
      </details>
      <style>{`
        .site-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative;margin-bottom:26px;padding-top:2px}
        .site-brand{display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:17px;text-decoration:none;color:var(--fg)}
        .site-links{display:flex;gap:16px;align-items:center}
        .site-links a{color:var(--faint);font-size:13.5px;text-decoration:none}
        .site-links a:hover{color:var(--fg)}
        .site-links a[aria-current="page"]{color:var(--fg);font-weight:700}
        .site-nav .site-cta{background:var(--accent);color:var(--accent-ink);font-weight:600;border-radius:9px;padding:8px 14px;font-size:14px}
        .site-nav .site-cta:hover{background:var(--accent-hover);color:var(--accent-ink)}
        .site-nav a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
        .site-menu{display:none}
        @media(max-width:719px){
          .site-links{display:none}
          .site-menu{display:block}
          .site-menu summary{list-style:none;cursor:pointer;display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--line);border-radius:9px;color:var(--fg)}
          .site-menu summary::-webkit-details-marker{display:none}
          .site-menu[open] summary{background:var(--surface)}
          .site-menu nav{position:absolute;right:0;top:calc(100% + 8px);z-index:20;display:flex;flex-direction:column;gap:2px;min-width:190px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:8px;box-shadow:0 12px 30px -12px rgba(11,18,32,.5)}
          .site-menu nav a{color:var(--fg);text-decoration:none;font-size:14.5px;padding:9px 12px;border-radius:8px}
          .site-menu nav a:hover{background:var(--surface-2)}
          .site-menu nav a[aria-current="page"]{font-weight:700}
          .site-menu nav .site-cta{margin-top:6px;text-align:center}
        }
      `}</style>
    </header>
  );
}

/** Compact shared footer: the canonical link set + the tagline. */
export function SiteFooter(): ReactElement {
  return (
    <footer className="site-foot">
      <div className="site-foot-links">
        {FOOTER_LINKS.map((l) => (
          <a key={l.href} href={l.href}>{l.label}</a>
        ))}
      </div>
      <p className="site-foot-line">
        Know before you ship. The signpost for Claude Code skills, agents, slash commands, MCP
        configs, and plugins.
      </p>
      <style>{`
        .site-foot{margin-top:48px;padding-top:22px;border-top:1px solid var(--line)}
        .site-foot-links{display:flex;flex-wrap:wrap;gap:8px 18px;margin-bottom:12px}
        .site-foot-links a{color:var(--faint);font-size:13px;text-decoration:none}
        .site-foot-links a:hover{color:var(--fg)}
        .site-foot-links a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
        .site-foot-line{color:var(--faint);font-size:12.5px}
      `}</style>
    </footer>
  );
}

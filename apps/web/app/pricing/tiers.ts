/** Tier feature lists for /pricing — kept out of page.tsx so tests can import them (Next.js rejects
 * non-standard exports from a page module). */
export const FREE = ["CLI + public repo scans", "Full deterministic rubric", "CI GitHub Action + PR gating", "Triggering & exact tokens (your own key)", "Local HTML report + SVG badge"];
export const PRO = ["Everything in Free", "Private-repo scanning", "Managed LLM — no key needed", "Hosted scorecards + always-fresh badges", "Score history"];
/**
 * Team is a contact-us willingness-to-pay probe (ROADMAP.md "Deferred": Team tier build-out — org
 * rules, seats, shared dashboard — is triggered by the first real Team inquiry). None of it is
 * built: entitlements are one boolean per GitHub login. So every Team line renders as "coming",
 * never with a check mark — nothing unbuilt may read as included.
 */
export const TEAM: string[] = [];
export const TEAM_COMING = ["Seats for your team (5 included)", "Org-wide custom rules", "Shared team dashboard"];

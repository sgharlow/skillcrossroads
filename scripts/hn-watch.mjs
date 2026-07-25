#!/usr/bin/env node
/**
 * Show HN thread watcher — skillcrossroads G0 launch.
 *
 *   node hn-watch.mjs find                  # locate the post (auto-detect, no URL needed)
 *   node hn-watch.mjs watch [storyId]       # one poll: points, rank, NEW comments since last run
 *   node hn-watch.mjs watch <id> --reset    # forget seen-state and re-report everything
 *
 * Uses the HN Algolia API (public, no auth) + the official Firebase API for front-page rank.
 * State in hn-watch-state.json next to this file. Read-only; posts nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(HERE, "..", ".hn-watch-state.json"); // gitignored: local watch state
const ALGOLIA = "https://hn.algolia.com/api/v1";
const FIREBASE = "https://hacker-news.firebaseio.com/v0";

// The launch targets. Match on any of these so a title tweak doesn't break detection.
const NEEDLES = ["skillcrossroads", "skill crossroads"];
const URL_HINT = "skillcrossroads.com";

const j = async (u) => {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json();
};
const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return {}; } };
const saveState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 1));
const ago = (ts) => {
  const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h${m % 60}m ago`;
};

/** Find the story without needing a URL: search stories, then confirm by url/title. */
async function find() {
  const seen = new Map();
  for (const q of [...NEEDLES, URL_HINT]) {
    const r = await j(`${ALGOLIA}/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=20`);
    for (const h of r.hits || []) {
      const hay = `${h.title || ""} ${h.url || ""}`.toLowerCase();
      if (NEEDLES.some((n) => hay.includes(n)) || hay.includes(URL_HINT)) seen.set(h.objectID, h);
    }
  }
  const hits = [...seen.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (!hits.length) { console.log("No matching HN story yet."); return null; }
  console.log(`Found ${hits.length} matching stor${hits.length > 1 ? "ies" : "y"}:`);
  for (const h of hits) {
    console.log(`  id=${h.objectID}  ${h.points ?? 0}pts  ${h.num_comments ?? 0}c  ${ago(h.created_at)}`);
    console.log(`    "${h.title}"`);
    console.log(`    https://news.ycombinator.com/item?id=${h.objectID}`);
  }
  return hits[0].objectID;
}

/** Flatten Algolia's nested comment tree. */
function flatten(node, out = [], depth = 0) {
  for (const c of node.children || []) {
    if (c.text || c.author) out.push({ id: c.id, author: c.author, text: c.text || "", created_at: c.created_at, depth });
    flatten(c, out, depth + 1);
  }
  return out;
}

const clean = (html) =>
  html.replace(/<p>/g, "\n").replace(/<[^>]+>/g, "")
      .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
      .replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/\s+\n/g, "\n").trim();

async function watch(storyId, reset) {
  if (!storyId) { storyId = await find(); if (!storyId) return; }
  const item = await j(`${ALGOLIA}/items/${storyId}`);
  const comments = flatten(item).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Front-page rank (Firebase topstories is the real ordering; Algolia has no rank).
  let rank = null;
  try {
    const top = await j(`${FIREBASE}/topstories.json`);
    const i = top.indexOf(Number(storyId));
    rank = i >= 0 ? i + 1 : null;
  } catch { /* rank is nice-to-have */ }

  const st = loadState();
  const prev = reset ? {} : (st[storyId] || {});
  const seen = new Set(prev.seenComments || []);
  const fresh = comments.filter((c) => !seen.has(c.id));

  console.log(`\n=== Show HN watch — story ${storyId} @ ${new Date().toISOString().slice(11, 19)}Z`);
  console.log(`    "${item.title}"`);
  console.log(`    https://news.ycombinator.com/item?id=${storyId}`);
  console.log(`    ${item.points ?? 0} points` +
    (prev.points != null ? ` (${item.points - prev.points >= 0 ? "+" : ""}${item.points - prev.points} since last check)` : "") +
    `  ·  ${comments.length} comments` +
    (prev.commentCount != null ? ` (+${comments.length - prev.commentCount})` : "") +
    `  ·  front page rank: ${rank ?? "not in top 500"}`);
  console.log(`    posted ${ago(item.created_at)}`);

  if (!fresh.length) {
    console.log(`\n    No new comments since last check.`);
  } else {
    console.log(`\n--- ${fresh.length} NEW COMMENT${fresh.length > 1 ? "S" : ""} (oldest first) ---`);
    for (const c of fresh) {
      console.log(`\n  [${c.author}] ${ago(c.created_at)}${c.depth ? `  (reply depth ${c.depth})` : "  (top-level)"}`);
      console.log(`  https://news.ycombinator.com/item?id=${c.id}`);
      const body = clean(c.text);
      console.log("  " + body.split("\n").filter(Boolean).join("\n  ").slice(0, 1200));
    }
  }
  st[storyId] = { points: item.points ?? 0, commentCount: comments.length, seenComments: comments.map((c) => c.id), lastCheck: new Date().toISOString() };
  saveState(st);
}

const [cmd, arg] = process.argv.slice(2);
const reset = process.argv.includes("--reset");
if (cmd === "find") await find();
else if (cmd === "watch") await watch(arg && !arg.startsWith("--") ? arg : null, reset);
else { console.log("usage: hn-watch.mjs find | watch [storyId] [--reset]"); process.exit(1); }

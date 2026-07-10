"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Opt a public skill (or repo) into the gallery, then refresh the list. */
export default function OptInForm() {
  const router = useRouter();
  const [repo, setRepo] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = repo.trim().replace(/^https?:\/\/github\.com\//i, "");
    if (value.split("/").length < 2) {
      setState("error");
      setMsg("Enter owner/repo or owner/repo/path/to/skill.");
      return;
    }
    setState("loading");
    setMsg("");
    try {
      const res = await fetch("/api/gallery/opt-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo: value }),
      });
      const data = (await res.json()) as { added?: number; error?: string };
      if (data.added) {
        setState("idle");
        // Land the user on their scorecard — that's where the badge-embed snippet + "scan your own"
        // CTA live (the viral primitive). Refreshing the list would hide the badge behind a lookup.
        router.push(`/s/${value}`);
      } else {
        setState("error");
        setMsg(data.error ?? "Could not add.");
      }
    } catch {
      setState("error");
      setMsg("Network error.");
    }
  }

  return (
    <form onSubmit={submit} className="optin">
      <input
        aria-label="GitHub repo or skill"
        placeholder="owner/repo/path/to/skill"
        value={repo}
        onChange={(e) => setRepo(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
      />
      <button type="submit" disabled={state === "loading"}>
        {state === "loading" ? "Scoring…" : "Add to gallery"}
      </button>
      {state === "error" && <span className="err">{msg}</span>}
      <style>{`
        .optin{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .optin input{flex:1 1 240px;min-width:0;background:var(--ink2);border:1px solid var(--ink3);color:var(--foam);
          border-radius:9px;padding:10px 13px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px}
        .optin input:focus{outline:none;border-color:var(--beam)}
        .optin button{background:var(--beam);color:#0b1220;font-weight:700;border:0;border-radius:9px;padding:10px 18px;cursor:pointer}
        .optin button:disabled{opacity:.6;cursor:default}
        .optin .err{color:#ff6b6b;font-size:12.5px;flex-basis:100%}
      `}</style>
    </form>
  );
}

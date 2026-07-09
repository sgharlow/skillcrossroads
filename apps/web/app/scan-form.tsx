"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Landing-page input: turns "owner/repo" (or a GitHub URL) into a /s/... scorecard route. */
export default function ScanForm() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const slug = value
      .trim()
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\.git$/, "")
      .replace(/^\/+|\/+$/g, "");
    if (slug.split("/").length >= 2) router.push(`/s/${slug}`);
  }

  return (
    <form onSubmit={go} className="scan">
      <input
        aria-label="GitHub repo"
        placeholder="owner/repo  (e.g. anthropics/skills)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
      />
      <button type="submit">Scan</button>
      <style>{`
        .scan{display:flex;gap:10px;max-width:520px;margin:28px auto 0;flex-wrap:wrap}
        .scan input{flex:1 1 260px;min-width:0;background:var(--ink2);border:1px solid var(--ink3);color:var(--foam);
          border-radius:10px;padding:13px 15px;font-size:15px;font-family:ui-monospace,Menlo,Consolas,monospace}
        .scan input:focus{outline:none;border-color:var(--beam)}
        .scan button{background:var(--beam);color:#0b1220;font-weight:700;border:0;border-radius:10px;
          padding:13px 22px;font-size:15px;cursor:pointer}
        .scan button:hover{filter:brightness(1.08)}
      `}</style>
    </form>
  );
}

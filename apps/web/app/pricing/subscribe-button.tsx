"use client";

import { useState } from "react";

/** Starts a Pro checkout: POST /api/checkout, then redirect to the Stripe-hosted page. */
export default function SubscribeButton() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function subscribe() {
    setState("loading");
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string; signIn?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      // Signed-out: the API hands back the GitHub sign-in URL — follow it instead of stranding
      // the buyer at error text (they return to /pricing after the OAuth round-trip).
      if (data.signIn) {
        window.location.href = data.signIn;
        return;
      }
      setState("error");
      setMsg(data.error ?? "Checkout unavailable.");
    } catch {
      setState("error");
      setMsg("Network error.");
    }
  }

  return (
    <>
      <button className="cta" onClick={subscribe} disabled={state === "loading"}>
        {state === "loading" ? "Starting…" : "Start 14-day trial"}
      </button>
      {state === "error" && <p className="err">{msg}</p>}
      <style>{`
        .cta{width:100%;background:var(--beam);color:#0b1220;font-weight:700;border:0;border-radius:10px;padding:12px;font-size:15px;cursor:pointer}
        .cta:hover{filter:brightness(1.08)}.cta:disabled{opacity:.6;cursor:default}
        .err{color:#ff6b6b;font-size:12.5px;margin-top:8px}
      `}</style>
    </>
  );
}

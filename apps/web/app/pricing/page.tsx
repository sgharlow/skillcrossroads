import type { Metadata } from "next";
import SubscribeButton from "./subscribe-button";
import { FREE, PRO, TEAM, TEAM_COMING } from "./tiers";
import { SiteNav, SiteFooter } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Pricing",
  alternates: { canonical: "/pricing" },
};

function Tier({ name, price, per, items, coming = [], note, cta }: { name: string; price: string; per: string; items: string[]; coming?: string[]; note?: string; cta: React.ReactNode }) {
  return (
    <div className="tier">
      <h3>{name}</h3>
      <p className="price">
        {price}
        <span className="per">{per}</span>
      </p>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
        {coming.map((i) => (
          <li key={i} className="coming">
            {i} <span className="tag">coming</span>
          </li>
        ))}
      </ul>
      {note && <p className="note">{note}</p>}
      <div className="cta-slot">{cta}</div>
    </div>
  );
}

export default function Pricing() {
  return (
    <main className="wrap">
      <SiteNav current="/pricing" />

      <section className="head">
        <h1>Free to prove your skills. Pay to keep them private.</h1>
        <p>The CLI and public scans are free forever — that&apos;s the point. Pro is private repos, managed checks, and hosted reports.</p>
      </section>

      <section className="grid">
        <Tier name="Free" price="$0" per="" items={FREE} cta={<a className="ghost" href="/">Get started</a>} />
        <Tier name="Pro" price="$19" per="/mo" items={PRO} cta={<SubscribeButton />} />
        <Tier name="Team" price="$99" per="/mo" items={TEAM} coming={TEAM_COMING} note="Not built yet — built with the first team that asks. Tell us what your team needs." cta={<a className="ghost" href="mailto:hello@skillcrossroads.com?subject=Skill%20Crossroads%20Team">Contact us</a>} />
      </section>

      <p className="foot">14-day free trial on Pro · cancel anytime · secured by Stripe</p>
      <p className="foot terms">
        Subscribing means agreeing to the <a href="/terms">Terms of Service</a> — including how the
        trial, renewal and cancellation work.
      </p>

      <SiteFooter />

      <style>{`
        .wrap{max-width:960px;margin:0 auto;padding:26px 20px 60px}
        .head{text-align:center;padding:40px 0 30px}
        .head h1{font-size:clamp(26px,4.5vw,40px);font-weight:800;letter-spacing:-.02em;margin-bottom:12px}
        .head p{color:var(--fog);max-width:560px;margin:0 auto}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-items:start}
        .tier{background:var(--ink2);border:1px solid var(--ink3);border-radius:16px;padding:24px}
        .tier:nth-child(2){border-color:var(--beam);box-shadow:0 0 0 1px #ffc24b55}
        .tier h3{font-size:17px;margin-bottom:6px}
        .price{font-size:34px;font-weight:800;margin-bottom:16px}
        .per{font-size:14px;color:var(--fog);font-weight:500;margin-left:4px}
        ul{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:20px}
        li{color:var(--foam);font-size:14px;padding-left:22px;position:relative}
        li::before{content:"✓";position:absolute;left:0;color:var(--aqua);font-weight:700}
        li.coming{color:var(--fog)}
        li.coming::before{content:"○";color:var(--fog);font-weight:400}
        .tag{font-size:11px;text-transform:uppercase;letter-spacing:.06em;border:1px solid var(--ink3);border-radius:6px;padding:1px 6px;margin-left:4px;color:var(--fog)}
        .note{color:var(--fog);font-size:13px;margin:-8px 0 16px}
        .cta-slot{min-height:44px}
        .ghost{display:block;text-align:center;border:1px solid var(--ink3);border-radius:10px;padding:12px;color:var(--foam);text-decoration:none;font-weight:600}
        .ghost:hover{border-color:var(--beam)}
        .foot{text-align:center;color:var(--fog);font-size:13px;margin-top:26px}
        .foot.terms{margin-top:8px}
        .foot a{color:var(--foam)}
        @media(max-width:720px){.grid{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}

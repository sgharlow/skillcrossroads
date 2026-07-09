export const metadata = { title: "Crossroads Pro — welcome" };
// Rendered on-demand (not statically prerendered). A purely-static leaf under the
// page-less `/pro` segment trips Vercel's @vercel/next route→output mapping
// ("Unable to find lambda for route: /pro/success"); rendering it dynamically
// creates the lambda the builder expects. It's also a post-checkout landing page,
// so on-demand rendering is the natural choice.
export const dynamic = "force-dynamic";

export default function ProSuccess() {
  return (
    <main className="wrap">
      <div className="card">
        <span className="lamp" aria-hidden />
        <h1>Welcome to Crossroads Pro.</h1>
        <p>
          Your 14-day trial is live. Private-repo scanning and managed checks are enabled — no API key needed. Manage
          your subscription anytime from the Stripe customer portal.
        </p>
        <a className="cta" href="/">
          Scan a skill →
        </a>
      </div>
      <style>{`
        .wrap{max-width:520px;margin:0 auto;padding:80px 20px;text-align:center}
        .card{background:var(--ink2);border:1px solid var(--ink3);border-radius:16px;padding:40px 30px}
        .lamp{display:inline-block;width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 50% 40%,var(--beam),#b9791f);box-shadow:0 0 22px #ffc24b99;margin-bottom:18px}
        h1{font-size:26px;font-weight:800;margin-bottom:12px}
        p{color:var(--fog);margin-bottom:24px}
        .cta{display:inline-block;background:var(--beam);color:#0b1220;font-weight:700;border-radius:10px;padding:12px 22px;text-decoration:none}
      `}</style>
    </main>
  );
}

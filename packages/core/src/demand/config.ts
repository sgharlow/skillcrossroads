/** Demand-readout configuration, derived once from environment variables. */
export interface DemandConfig {
  /** Lowercased GitHub logins to exclude from external counts (owner dogfooding). */
  ownerLogins: Set<string>;
  /** ISO date (YYYY-MM-DD) of the launch; null ⇒ pre-launch, gate inactive. */
  launchDate: string | null;
  /** Number of launch posts made so far (part of the pivot threshold). */
  launchPosts: number;
  /** Window (days) for the daily trend and badge leading indicators. */
  trendDays: number;
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Read demand config from an environment map (`process.env` in prod, a literal in tests). */
export function readDemandConfig(env: Record<string, string | undefined>): DemandConfig {
  const ownerLogins = new Set(
    (env.OWNER_LOGINS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const launchRaw = (env.LAUNCH_DATE ?? "").trim();
  let launchDate: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(launchRaw)) {
    const d = new Date(launchRaw + "T00:00:00Z");
    if (!Number.isNaN(d.getTime()) && d.toISOString().startsWith(launchRaw)) {
      launchDate = launchRaw;
    }
  }
  return {
    ownerLogins,
    launchDate,
    launchPosts: positiveInt(env.LAUNCH_POSTS, 0),
    trendDays: positiveInt(env.DEMAND_TREND_DAYS, 30),
  };
}

// Cloudflare Web Analytics reader.
//
// Web Analytics (RUM) data is exposed through Cloudflare's GraphQL Analytics
// API under the account-scoped `rumPageloadEventsAdaptiveGroups` dataset. We
// pull a 30-day window plus the prior 30 for a trend, grouped a few ways for
// the dashboard, and estimate true counts from the adaptive sample.
//
// ⚠️  The exact dataset field/filter names below should be validated once
//     against the live API with a real token (see README → Analytics API).
//     Everything here is written defensively so a schema mismatch degrades to
//     an empty/friendly dashboard rather than a crash.

import type { AnalyticsKey } from "./roster";

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

export interface MetricRow {
  label: string;
  visits: number;
}

export interface AnalyticsSummary {
  rangeDays: number;
  visits: number;
  prevVisits: number;
  pageviews: number;
  /** Daily visits for the current window, oldest → newest. */
  series: { date: string; visits: number }[];
  topPages: MetricRow[];
  referrers: MetricRow[];
  countries: MetricRow[];
  devices: MetricRow[];
  /** True when data is present; false means "nothing collected yet / query failed". */
  hasData: boolean;
}

interface Env {
  CF_ANALYTICS_TOKEN: string;
  CF_ACCOUNT_ID: string;
  MAINSTAY_SITE_TAG: string;
}

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function emptySummary(days: number): AnalyticsSummary {
  return {
    rangeDays: days,
    visits: 0,
    prevVisits: 0,
    pageviews: 0,
    series: [],
    topPages: [],
    referrers: [],
    countries: [],
    devices: [],
    hasData: false,
  };
}

// Adaptive-sampling estimate: each group carries a sampleInterval (1-in-N), so
// the true value ≈ Σ metric × sampleInterval.
interface Group {
  count: number;
  avg?: { sampleInterval?: number };
  sum?: { visits?: number };
  dimensions?: Record<string, string>;
}

function estVisits(groups: Group[]): number {
  return Math.round(
    groups.reduce(
      (t, g) => t + (g.sum?.visits ?? 0) * (g.avg?.sampleInterval ?? 1),
      0
    )
  );
}
function estViews(groups: Group[]): number {
  return Math.round(
    groups.reduce((t, g) => t + g.count * (g.avg?.sampleInterval ?? 1), 0)
  );
}

/** Roll dimension groups up into a labeled, sorted, top-N metric list. */
function rollup(groups: Group[], dim: string, limit = 6): MetricRow[] {
  const byLabel = new Map<string, number>();
  for (const g of groups) {
    const label = g.dimensions?.[dim] ?? "—";
    byLabel.set(
      label,
      (byLabel.get(label) ?? 0) + (g.sum?.visits ?? 0) * (g.avg?.sampleInterval ?? 1)
    );
  }
  return [...byLabel.entries()]
    .map(([label, visits]) => ({ label, visits: Math.round(visits) }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, limit);
}

/**
 * The filter shared by every block: the window, the Web Analytics site, and —
 * for subpath clients — a path prefix under the shared site.
 */
function baseFilter(
  analytics: AnalyticsKey,
  env: Env,
  start: string,
  end: string
): Record<string, unknown> {
  const siteTag =
    analytics.kind === "siteTag" ? analytics.siteTag : env.MAINSTAY_SITE_TAG;
  const filter: Record<string, unknown> = {
    date_geq: start,
    date_leq: end,
    siteTag,
  };
  if (analytics.kind === "path") {
    filter.requestPath_like = `${analytics.pathPrefix}%`;
  }
  return filter;
}

const GROUP_FIELDS = `
  count
  avg { sampleInterval }
  sum { visits }
`;

export async function getAnalytics(
  env: Env,
  analytics: AnalyticsKey,
  days = 30
): Promise<AnalyticsSummary> {
  const end = isoDay(0);
  const start = isoDay(-days);
  const prevStart = isoDay(-days * 2);
  const prevEnd = isoDay(-days - 1);

  const cur = baseFilter(analytics, env, start, end);
  const prev = baseFilter(analytics, env, prevStart, prevEnd);

  const query = `
    query Dashboard($account: string!, $cur: RumPageloadEventsAdaptiveGroupsFilter_InputObject!, $prev: RumPageloadEventsAdaptiveGroupsFilter_InputObject!) {
      viewer {
        accounts(filter: { accountTag: $account }) {
          byDate: rumPageloadEventsAdaptiveGroups(filter: $cur, limit: 1000, orderBy: [date_ASC]) {
            ${GROUP_FIELDS}
            dimensions { date }
          }
          previous: rumPageloadEventsAdaptiveGroups(filter: $prev, limit: 1000) {
            ${GROUP_FIELDS}
          }
          pages: rumPageloadEventsAdaptiveGroups(filter: $cur, limit: 100, orderBy: [count_DESC]) {
            ${GROUP_FIELDS}
            dimensions { requestPath }
          }
          referrers: rumPageloadEventsAdaptiveGroups(filter: $cur, limit: 100, orderBy: [count_DESC]) {
            ${GROUP_FIELDS}
            dimensions { refererHost }
          }
          countries: rumPageloadEventsAdaptiveGroups(filter: $cur, limit: 100, orderBy: [count_DESC]) {
            ${GROUP_FIELDS}
            dimensions { countryName }
          }
          devices: rumPageloadEventsAdaptiveGroups(filter: $cur, limit: 100, orderBy: [count_DESC]) {
            ${GROUP_FIELDS}
            dimensions { deviceType }
          }
        }
      }
    }
  `;

  let json: any;
  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { account: env.CF_ACCOUNT_ID, cur, prev },
      }),
    });
    json = await res.json();
    if (!res.ok || json?.errors) {
      console.error("[analytics] GraphQL error:", JSON.stringify(json?.errors ?? res.status));
      return emptySummary(days);
    }
  } catch (err) {
    console.error("[analytics] fetch failed:", err);
    return emptySummary(days);
  }

  const account = json?.data?.viewer?.accounts?.[0];
  if (!account) return emptySummary(days);

  const byDate: Group[] = account.byDate ?? [];
  const previous: Group[] = account.previous ?? [];

  const series = byDate.map((g) => ({
    date: g.dimensions?.date ?? "",
    visits: Math.round((g.sum?.visits ?? 0) * (g.avg?.sampleInterval ?? 1)),
  }));

  return {
    rangeDays: days,
    visits: estVisits(byDate),
    prevVisits: estVisits(previous),
    pageviews: estViews(byDate),
    series,
    topPages: rollup(account.pages ?? [], "requestPath"),
    referrers: rollup(account.referrers ?? [], "refererHost"),
    countries: rollup(account.countries ?? [], "countryName"),
    devices: rollup(account.devices ?? [], "deviceType"),
    hasData: byDate.length > 0 || estVisits(byDate) > 0,
  };
}

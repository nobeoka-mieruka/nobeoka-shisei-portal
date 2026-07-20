/**
 * Cloudflare Web Analytics（RUMビーコン）の累計表示回数を返すエンドポイント。
 * Cloudflare APIトークンはここでのみ使用し、レスポンスには含めない。
 * G-GHQCETJ7FN（gtag.js、src/lib/analytics.ts）とは別の仕組みで、この関数とは無関係。
 */

interface Env {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_SITE_TAG: string;
}

interface SiteStatsPayload {
  totalPageViews: number;
  source: "cloudflare";
  updatedAt: string;
}

const CACHE_TTL_SECONDS = 60 * 60; // 1時間
const FALLBACK_TTL_SECONDS = 60 * 60 * 24; // 直前の正常値を保持しておく期間（24時間）
const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

// Cloudflare Web AnalyticsのRUMデータ保持期間（約6ヶ月）の近似値。
// 「サイト開設以来の真の累計」ではなく「取得可能な最も古い日付からの合計」であることに注意。
const LOOKBACK_DAYS = 186;
// GraphQL Analytics APIは1クエリあたりの日付範囲が31日までのため、区間を分割する。
const CHUNK_DAYS = 31;

type SiteStatsFailureStage =
  | "missing_env"
  | "token_error"
  | "graphql_error"
  | "invalid_dataset"
  | "site_not_found"
  | "rate_limited"
  | "unexpected_response";

class SiteStatsError extends Error {
  stage: SiteStatsFailureStage;

  constructor(stage: SiteStatsFailureStage, message: string) {
    super(message);
    this.stage = stage;
  }
}

function logFailure(err: unknown): void {
  if (err instanceof SiteStatsError) {
    console.error(`[site-stats] failed at stage=${err.stage}: ${err.message}`);
    return;
  }
  console.error(`[site-stats] failed at stage=unknown: ${err instanceof Error ? err.message : String(err)}`);
}

function assertConfigured(env: Env): void {
  const missing = (
    [
      ["CLOUDFLARE_ACCOUNT_ID", env.CLOUDFLARE_ACCOUNT_ID],
      ["CLOUDFLARE_API_TOKEN", env.CLOUDFLARE_API_TOKEN],
      ["CLOUDFLARE_SITE_TAG", env.CLOUDFLARE_SITE_TAG],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new SiteStatsError("missing_env", `missing environment variables: ${missing.join(", ")}`);
  }
}

interface DateRangeChunk {
  start: string;
  end: string;
}

/** 直近LOOKBACK_DAYS日を、CHUNK_DAYSごとの連続した区間に分割する（古い順）。 */
function buildDateRangeChunks(): DateRangeChunk[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const chunks: DateRangeChunk[] = [];

  for (let daysAgoEnd = LOOKBACK_DAYS; daysAgoEnd > 0; daysAgoEnd -= CHUNK_DAYS) {
    const daysAgoStart = Math.max(daysAgoEnd - CHUNK_DAYS, 0);
    chunks.push({
      start: new Date(now - daysAgoEnd * dayMs).toISOString(),
      end: new Date(now - daysAgoStart * dayMs).toISOString(),
    });
  }
  return chunks;
}

function buildGraphQlQuery(siteTag: string, chunks: DateRangeChunk[]): string {
  const aliases = chunks
    .map((chunk, i) => {
      const filter = `{ AND: [ { datetime_geq: "${chunk.start}", datetime_leq: "${chunk.end}" }, { OR: [ { siteTag: "${siteTag}" } ] } ] }`;
      return `c${i}: rumPageloadEventsAdaptiveGroups(filter: ${filter}, limit: 1) { count }`;
    })
    .join("\n      ");

  return `
    query SiteStatsTotalPageViews($accountTag: string) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          ${aliases}
        }
      }
    }
  `;
}

interface GraphQlAccountResult {
  [alias: string]: { count?: number } | undefined;
}

interface GraphQlResponseBody {
  data?: { viewer?: { accounts?: GraphQlAccountResult[] } };
  errors?: { message?: string }[];
}

function classifyAndThrow(status: number, body: GraphQlResponseBody | undefined): never {
  const messages = (body?.errors ?? []).map((e) => e.message ?? "").join(" | ");

  if (status === 429 || /rate.?limit/i.test(messages)) {
    throw new SiteStatsError("rate_limited", `Cloudflare API rate limited (status=${status})`);
  }
  if (status === 401 || status === 403 || /authenticat|authoriz|forbidden|invalid api token|permission/i.test(messages)) {
    throw new SiteStatsError("token_error", `Cloudflare API auth failed (status=${status}, messages=${messages})`);
  }
  if (messages && /cannot query field|unknown (argument|type|field)|schema|rumPageloadEventsAdaptiveGroups/i.test(messages)) {
    throw new SiteStatsError("invalid_dataset", `Cloudflare GraphQL schema mismatch (status=${status}, messages=${messages})`);
  }
  if (messages) {
    throw new SiteStatsError("graphql_error", `Cloudflare GraphQL API returned errors (status=${status}, messages=${messages})`);
  }
  throw new SiteStatsError("graphql_error", `Cloudflare GraphQL API request failed (status=${status})`);
}

async function fetchCloudflareStats(env: Env): Promise<SiteStatsPayload> {
  const chunks = buildDateRangeChunks();
  const query = buildGraphQlQuery(env.CLOUDFLARE_SITE_TAG, chunks);

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { accountTag: env.CLOUDFLARE_ACCOUNT_ID },
    }),
  });

  let body: GraphQlResponseBody | undefined;
  try {
    body = (await res.json()) as GraphQlResponseBody;
  } catch {
    throw new SiteStatsError("unexpected_response", `Cloudflare API response was not valid JSON (status=${res.status})`);
  }

  if (!res.ok || (body.errors && body.errors.length > 0)) {
    classifyAndThrow(res.status, body);
  }

  const accounts = body.data?.viewer?.accounts;
  if (!accounts || accounts.length === 0) {
    throw new SiteStatsError("site_not_found", "Cloudflare GraphQL API returned no accounts for the given accountTag");
  }

  const account = accounts[0];
  let totalPageViews = 0;
  for (let i = 0; i < chunks.length; i++) {
    const count = account[`c${i}`]?.count;
    if (typeof count !== "number" || !Number.isFinite(count)) {
      throw new SiteStatsError("unexpected_response", `missing or non-numeric count for chunk c${i}`);
    }
    totalPageViews += count;
  }

  return {
    totalPageViews,
    source: "cloudflare",
    updatedAt: new Date().toISOString(),
  };
}

function jsonResponse(body: unknown, status: number, cacheControl?: string): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cacheControl) headers["Cache-Control"] = cacheControl;
  return new Response(JSON.stringify(body), { status, headers });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const url = new URL(request.url);
  const cache = caches.default;
  const liveCacheKey = new Request(`${url.origin}${url.pathname}?variant=live`);
  const fallbackCacheKey = new Request(`${url.origin}${url.pathname}?variant=fallback`);

  const cached = await cache.match(liveCacheKey);
  if (cached) return cached;

  try {
    assertConfigured(env);
    const stats = await fetchCloudflareStats(env);
    const response = jsonResponse(stats, 200, `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`);
    const fallbackResponse = jsonResponse(stats, 200, `public, max-age=${FALLBACK_TTL_SECONDS}, s-maxage=${FALLBACK_TTL_SECONDS}`);
    waitUntil(Promise.all([cache.put(liveCacheKey, response.clone()), cache.put(fallbackCacheKey, fallbackResponse)]));
    return response;
  } catch (err) {
    logFailure(err);
    const fallback = await cache.match(fallbackCacheKey);
    if (fallback) return fallback;
    // ブラウザには秘密情報や詳細なエラー内容を返さない。
    return jsonResponse({ error: "site-stats unavailable" }, 503);
  }
};

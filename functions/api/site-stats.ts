/**
 * Cloudflare Web Analytics（RUMビーコン）の累計・本日の表示回数を返すエンドポイント。
 * Cloudflare APIトークンはここでのみ使用し、レスポンス・ログには含めない。
 * G-GHQCETJ7FN（gtag.js、src/lib/analytics.ts）とは別の仕組みで、この関数とは無関係。
 *
 * レスポンスは常にHTTP 200＋JSONで返す（環境変数未設定・Cloudflare API障害時も503にしない）。
 * フロントエンドは常にJSONをパースし、`ok`フィールドで成功/失敗を判定する。
 */

interface Env {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_SITE_TAG: string;
}

interface SiteStatsSuccessPayload {
  ok: true;
  totalViews: number;
  todayViews: number;
  updatedAt: string;
  source: "cloudflare";
}

type SiteStatsFailureStatus = "configuration_required" | "temporarily_unavailable";

interface SiteStatsFailurePayload {
  ok: false;
  status: SiteStatsFailureStatus;
  message: string;
}

type SiteStatsPayload = SiteStatsSuccessPayload | SiteStatsFailurePayload;

const CACHE_TTL_SECONDS = 60 * 60; // 成功時：1時間キャッシュ
const FALLBACK_TTL_SECONDS = 60 * 60 * 24; // 直前の正常値を保持しておく期間（24時間）
const ERROR_CACHE_TTL_SECONDS = 60; // 一時的エラー時、Cloudflare APIへの過剰アクセスを防ぐための短時間キャッシュ
const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

// Cloudflare Web AnalyticsのRUMデータ保持期間（約6ヶ月）の近似値。
// 「サイト開設以来の真の累計」ではなく「取得可能な最も古い日付からの合計」であることに注意。
const LOOKBACK_DAYS = 186;
// GraphQL Analytics APIは1クエリあたりの日付範囲が31日までのため、区間を分割する。
const CHUNK_DAYS = 31;

type SiteStatsFailureStage =
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

const LOG_MAX_CHARS = 4000;

/** Cloudflare Pages Functionsのログ行が長大になりすぎないよう切り詰める。 */
function truncateForLog(text: string): string {
  return text.length > LOG_MAX_CHARS ? `${text.slice(0, LOG_MAX_CHARS)}...(truncated)` : text;
}

/** APIトークンやAccount IDの値を含めず、原因の切り分けに必要な情報だけをログへ出す。 */
function logFailure(err: unknown): void {
  if (err instanceof SiteStatsError) {
    console.error(`[site-stats] failed at stage=${err.stage}: ${err.message}`);
    return;
  }
  console.error(`[site-stats] failed at stage=unknown: ${err instanceof Error ? err.message : String(err)}`);
}

function getMissingEnvNames(env: Env): string[] {
  return (
    [
      ["CLOUDFLARE_ACCOUNT_ID", env.CLOUDFLARE_ACCOUNT_ID],
      ["CLOUDFLARE_API_TOKEN", env.CLOUDFLARE_API_TOKEN],
      ["CLOUDFLARE_SITE_TAG", env.CLOUDFLARE_SITE_TAG],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

interface DateRangeChunk {
  start: string;
  end: string;
}

/** 直近LOOKBACK_DAYS日を、CHUNK_DAYSごとの連続した区間に分割する（古い順）。 */
function buildDateRangeChunks(now: number): DateRangeChunk[] {
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

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 日本時間（JST）の当日0時から現在時刻までの範囲を返す。 */
function buildTodayRange(now: number): DateRangeChunk {
  const jstNow = new Date(now + JST_OFFSET_MS);
  const jstMidnightAsUtc = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate(), 0, 0, 0);
  return {
    start: new Date(jstMidnightAsUtc - JST_OFFSET_MS).toISOString(),
    end: new Date(now).toISOString(),
  };
}

function buildGraphQlQuery(siteTag: string, chunks: DateRangeChunk[], todayRange: DateRangeChunk): string {
  const rangeFilter = (range: DateRangeChunk) =>
    `{ AND: [ { datetime_geq: "${range.start}", datetime_leq: "${range.end}" }, { OR: [ { siteTag: "${siteTag}" } ] } ] }`;

  const chunkAliases = chunks
    .map((chunk, i) => `c${i}: rumPageloadEventsAdaptiveGroups(filter: ${rangeFilter(chunk)}, limit: 1) { count }`)
    .join("\n      ");
  const todayAlias = `today: rumPageloadEventsAdaptiveGroups(filter: ${rangeFilter(todayRange)}, limit: 1) { count }`;

  return `
    query SiteStatsPageViews($accountTag: string) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          ${chunkAliases}
          ${todayAlias}
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

interface CloudflareStats {
  totalViews: number;
  todayViews: number;
  updatedAt: string;
}

async function fetchCloudflareStats(env: Env): Promise<CloudflareStats> {
  const now = Date.now();
  const chunks = buildDateRangeChunks(now);
  const todayRange = buildTodayRange(now);
  const query = buildGraphQlQuery(env.CLOUDFLARE_SITE_TAG, chunks, todayRange);

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

  const rawText = await res.text();
  let body: GraphQlResponseBody;
  try {
    body = JSON.parse(rawText) as GraphQlResponseBody;
  } catch {
    console.error(
      `[site-stats] Cloudflare API returned non-JSON response — status=${res.status} body=${truncateForLog(rawText)}`,
    );
    throw new SiteStatsError("unexpected_response", `Cloudflare API response was not valid JSON (status=${res.status})`);
  }

  if (!res.ok || (body.errors && body.errors.length > 0)) {
    // 原因切り分け用の詳細ログ。APIトークン・Account IDは含めない
    // （queryにはsiteTagのみ埋め込まれており、これは公開情報。accountTagはGraphQL変数側にあり、ここには出力していない）。
    console.error(
      `[site-stats] Cloudflare GraphQL API error — status=${res.status} body=${truncateForLog(JSON.stringify(body))} query=${truncateForLog(query.trim())}`,
    );
    classifyAndThrow(res.status, body);
  }

  const accounts = body.data?.viewer?.accounts;
  if (!accounts || accounts.length === 0) {
    console.error(
      `[site-stats] Cloudflare GraphQL API returned no accounts — status=${res.status} body=${truncateForLog(JSON.stringify(body))}`,
    );
    throw new SiteStatsError("site_not_found", "Cloudflare GraphQL API returned no accounts for the given accountTag");
  }

  const account = accounts[0];
  const readCount = (alias: string): number => {
    const count = account[alias]?.count;
    if (typeof count !== "number" || !Number.isFinite(count)) {
      console.error(
        `[site-stats] Cloudflare GraphQL API missing count for alias=${alias} — status=${res.status} body=${truncateForLog(JSON.stringify(body))}`,
      );
      throw new SiteStatsError("unexpected_response", `missing or non-numeric count for alias ${alias}`);
    }
    return count;
  };

  let totalViews = 0;
  for (let i = 0; i < chunks.length; i++) totalViews += readCount(`c${i}`);
  const todayViews = readCount("today");

  return { totalViews, todayViews, updatedAt: new Date(now).toISOString() };
}

function jsonResponse(body: SiteStatsPayload, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cacheControl },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const url = new URL(request.url);
  const cache = caches.default;
  const liveCacheKey = new Request(`${url.origin}${url.pathname}?variant=live`);
  const fallbackCacheKey = new Request(`${url.origin}${url.pathname}?variant=fallback`);

  // 環境変数が未設定の場合はCloudflare APIを呼ばず、キャッシュもせずに安全な状態を返す。
  // 設定完了後すぐに反映されるよう、この状態はエッジキャッシュしない。
  const missingEnv = getMissingEnvNames(env);
  if (missingEnv.length > 0) {
    console.warn(`[site-stats] configuration_required: missing ${missingEnv.join(", ")}`);
    return jsonResponse(
      { ok: false, status: "configuration_required", message: "アクセス解析の設定を確認しています。" },
      200,
      "no-store",
    );
  }

  const cached = await cache.match(liveCacheKey);
  if (cached) return cached;

  try {
    const stats = await fetchCloudflareStats(env);
    const payload: SiteStatsSuccessPayload = {
      ok: true,
      totalViews: stats.totalViews,
      todayViews: stats.todayViews,
      updatedAt: stats.updatedAt,
      source: "cloudflare",
    };
    const response = jsonResponse(payload, 200, `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`);
    const fallbackResponse = jsonResponse(
      payload,
      200,
      `public, max-age=${FALLBACK_TTL_SECONDS}, s-maxage=${FALLBACK_TTL_SECONDS}`,
    );
    waitUntil(Promise.all([cache.put(liveCacheKey, response.clone()), cache.put(fallbackCacheKey, fallbackResponse.clone())]));
    return response;
  } catch (err) {
    logFailure(err);

    // 直前の正常値がキャッシュに残っている場合だけ、それを安全にフォールバック表示する
    // （架空の初期値は使わない）。
    const fallback = await cache.match(fallbackCacheKey);
    if (fallback) return fallback;

    const errorResponse = jsonResponse(
      { ok: false, status: "temporarily_unavailable", message: "アクセス数を一時的に取得できません。" },
      200,
      `public, max-age=${ERROR_CACHE_TTL_SECONDS}, s-maxage=${ERROR_CACHE_TTL_SECONDS}`,
    );
    // Cloudflare APIへの過剰アクセスを防ぐため、失敗レスポンス自体も短時間だけキャッシュする。
    waitUntil(cache.put(liveCacheKey, errorResponse.clone()));
    return errorResponse;
  }
};

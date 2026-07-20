/**
 * Cloudflare Web Analytics（RUMビーコン）の集計期間内アクセス数・本日の表示回数を返すエンドポイント。
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
  // 任意。Web Analyticsの計測開始日（例: "2026-07-12"）。
  // 未設定でも正常に動作する。MAX_LOOKBACK_DAYSより古い日付を指定した場合は自動的に切り詰める。
  CLOUDFLARE_ANALYTICS_START_DATE?: string;
}

// ?debug=1 リクエスト時のみレスポンスへ付与する診断情報。APIトークン・Account ID・Site Tag・IPアドレスは含めない。
interface SiteStatsDebugInfo {
  codeVersion: string;
  cacheHit: boolean;
  fallbackUsed: boolean;
  graphQLRequested: boolean;
  requestedStart: string | null;
  requestedEnd: string | null;
  lookbackDays: number | null;
  errorStage: SiteStatsFailureStage | null;
  errorCodes: string | null;
  // 成功時のみ。alias（c0～c5、today）ごとの実際の値の形と、集計に使った件数。
  aliasShapes?: Record<string, string>;
  chunkCounts?: Record<string, number>;
  // 成功時のみ。設定済みsiteTagでフィルタせず、実際にイベントが存在するsiteTag上位（件数降順）。
  // 設定値が実データと一致しているかを確認するための調査用。
  siteTagDiagnostics?: SiteTagDiagnosticsResult;
}

interface SiteStatsSuccessPayload {
  ok: true;
  totalViews: number;
  todayViews: number;
  updatedAt: string;
  source: "cloudflare";
  // 集計対象の日数（最大MAX_LOOKBACK_DAYS）。フロントエンドの表示文言（「直近n日間」等）に使用する。
  windowDays: number;
  // 集計対象期間の開始日（YYYY-MM-DD、UTC基準）。
  rangeStartDate: string;
  debug?: SiteStatsDebugInfo;
}

type SiteStatsFailureStatus = "configuration_required" | "temporarily_unavailable";

interface SiteStatsFailurePayload {
  ok: false;
  status: SiteStatsFailureStatus;
  message: string;
  debug?: SiteStatsDebugInfo;
}

type SiteStatsPayload = SiteStatsSuccessPayload | SiteStatsFailurePayload;

const CACHE_TTL_SECONDS = 60 * 60; // 成功時：1時間キャッシュ
const FALLBACK_TTL_SECONDS = 60 * 60 * 24; // 直前の正常値を保持しておく期間（24時間）
const ERROR_CACHE_TTL_SECONDS = 60; // 一時的エラー時、Cloudflare APIへの過剰アクセスを防ぐための短時間キャッシュ
const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

// Cloudflare Web AnalyticsのRUMデータ保持期間には上限がある。
// 実測では「account cannot request data older than 26w2d（≒184日）」というquotaエラーが確認されており、
// 「6か月前」のカレンダー計算（月の日数のばらつきで186日相当になり得る）は使わず、
// 上限変更に備えた安全余裕を持たせて180日を最大取得期間とする。
// 「累計」ではなく「取得可能な期間内の合計」である点に注意（フロントエンド表示時の注記も参照）。
const MAX_LOOKBACK_DAYS = 180;
// GraphQL Analytics APIは1クエリあたりの日付範囲に上限があるため区間を分割する。180 = 30日 × 6区間。
const CHUNK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// quotaエラー修正（180日ウィンドウ化）後のコードであることをデバッグレスポンスから確認するための固定文字列。
// このロジックを変更した場合は値も更新する。
const CODE_VERSION = "cloudflare-analytics-180d-v4-cache-key-bust";

type SiteStatsFailureStage =
  | "token_error"
  | "graphql_error"
  | "invalid_dataset"
  | "site_not_found"
  | "rate_limited"
  | "quota_exceeded"
  | "unexpected_response";

class SiteStatsError extends Error {
  stage: SiteStatsFailureStage;
  // デバッグレスポンス用の付帯情報。fetchCloudflareStats内でキャッチ時に付与する。
  requestedStart?: string;
  requestedEnd?: string;
  lookbackDays?: number;
  errorCodes?: string;

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

/**
 * CloudflareのGraphQL APIが返すエラーメッセージ自体にAccount ID・APIトークンの値が
 * 埋め込まれているケースがあるため、ログ・デバッグレスポンスへ出す前に必ず除去する。
 * siteTagは秘密情報として扱わないため対象外（診断機能上、意図的に表示する）。
 */
function redactSecrets(text: string, env: Env): string {
  let result = text;
  if (env.CLOUDFLARE_ACCOUNT_ID) {
    result = result.split(env.CLOUDFLARE_ACCOUNT_ID).join("[account-id]");
  }
  if (env.CLOUDFLARE_API_TOKEN) {
    result = result.split(env.CLOUDFLARE_API_TOKEN).join("[api-token]");
  }
  return result;
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

interface LookbackResolution {
  days: number;
  // CLOUDFLARE_ANALYTICS_START_DATEがMAX_LOOKBACK_DAYSより古く、安全な範囲へ切り詰めた場合true。
  clampedFromEnv: boolean;
  // CLOUDFLARE_ANALYTICS_START_DATEの形式が不正、または未来日付だった場合true（MAX_LOOKBACK_DAYSへフォールバック）。
  envDateInvalid: boolean;
}

/**
 * 取得開始日を決定する。
 * CLOUDFLARE_ANALYTICS_START_DATE未設定時はMAX_LOOKBACK_DAYS（180日）を使用する。
 * 設定時は「現在からその日数」と180日の小さい方を採用し、180日より古くならないようclampする。
 */
function resolveLookbackDays(env: Env, now: number): LookbackResolution {
  const raw = env.CLOUDFLARE_ANALYTICS_START_DATE;
  if (!raw) {
    return { days: MAX_LOOKBACK_DAYS, clampedFromEnv: false, envDateInvalid: false };
  }

  const startTime = new Date(raw).getTime();
  if (Number.isNaN(startTime)) {
    console.warn(`[site-stats] invalid CLOUDFLARE_ANALYTICS_START_DATE="${raw}" — falling back to ${MAX_LOOKBACK_DAYS} days`);
    return { days: MAX_LOOKBACK_DAYS, clampedFromEnv: false, envDateInvalid: true };
  }

  const daysSinceStart = Math.ceil((now - startTime) / DAY_MS);
  if (daysSinceStart <= 0) {
    console.warn(
      `[site-stats] CLOUDFLARE_ANALYTICS_START_DATE="${raw}" is not in the past — falling back to ${MAX_LOOKBACK_DAYS} days`,
    );
    return { days: MAX_LOOKBACK_DAYS, clampedFromEnv: false, envDateInvalid: true };
  }

  if (daysSinceStart > MAX_LOOKBACK_DAYS) {
    return { days: MAX_LOOKBACK_DAYS, clampedFromEnv: true, envDateInvalid: false };
  }

  return { days: daysSinceStart, clampedFromEnv: false, envDateInvalid: false };
}

interface DateRangeChunk {
  start: string;
  end: string;
}

/** 直近lookbackDays日を、maxChunkDaysごとの連続した区間に分割する（古い順、重複・欠落なし）。 */
function buildDateRangeChunks(now: number, lookbackDays: number, maxChunkDays: number): DateRangeChunk[] {
  const chunks: DateRangeChunk[] = [];

  for (let daysAgoEnd = lookbackDays; daysAgoEnd > 0; daysAgoEnd -= maxChunkDays) {
    const daysAgoStart = Math.max(daysAgoEnd - maxChunkDays, 0);
    chunks.push({
      start: new Date(now - daysAgoEnd * DAY_MS).toISOString(),
      end: new Date(now - daysAgoStart * DAY_MS).toISOString(),
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

// rumPageloadEventsAdaptiveGroupsはAdaptiveGroups系データセットのため、limit:1でも値は配列で返る
// （例: { count: 123 }ではなく[{ count: 123 }]）。将来の形状変化にも耐えられるようunknownで受ける。
interface GraphQlAccountResult {
  [alias: string]: unknown;
}

interface GraphQlErrorEntry {
  message?: string;
  code?: number;
}

interface GraphQlResponseBody {
  data?: { viewer?: { accounts?: GraphQlAccountResult[] } };
  errors?: GraphQlErrorEntry[];
}

function classifyAndThrow(status: number, body: GraphQlResponseBody | undefined, env: Env): never {
  const messages = redactSecrets((body?.errors ?? []).map((e) => e.message ?? "").join(" | "), env);

  if (status === 429 || /rate.?limit/i.test(messages)) {
    throw new SiteStatsError("rate_limited", `Cloudflare API rate limited (status=${status})`);
  }
  if (status === 401 || status === 403 || /authenticat|authoriz|forbidden|invalid api token|permission/i.test(messages)) {
    throw new SiteStatsError("token_error", `Cloudflare API auth failed (status=${status}, messages=${messages})`);
  }
  if (/cannot request data older than|retention/i.test(messages)) {
    throw new SiteStatsError("quota_exceeded", `Cloudflare API retention window exceeded (status=${status}, messages=${messages})`);
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
  windowDays: number;
  rangeStartDate: string;
  requestedStart: string;
  requestedEnd: string;
  aliasShapes?: Record<string, string>;
  chunkCounts?: Record<string, number>;
}

/** AdaptiveGroupsの配列（例: [{ count: 123 }, ...]）内のcountを合計する。不正な要素があればnullを返す。 */
function sumArrayCounts(items: unknown[]): number | null {
  let sum = 0;
  for (const item of items) {
    if (item === null || typeof item !== "object") return null;
    const count = (item as { count?: unknown }).count;
    if (typeof count !== "number" || !Number.isFinite(count)) return null;
    sum += count;
  }
  return sum;
}

/** デバッグログ用に、aliasの値の形（配列/オブジェクト/その他）を秘密情報を含まない形で要約する。 */
function describeAliasValue(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    const first: unknown = value[0];
    return {
      isArray: true,
      length: value.length,
      firstItemKeys: first && typeof first === "object" ? Object.keys(first as object) : null,
    };
  }
  if (value && typeof value === "object") {
    return { isArray: false, keys: Object.keys(value as object) };
  }
  return { isArray: false, valueType: typeof value };
}

async function fetchCloudflareStats(env: Env, debugRequested: boolean): Promise<CloudflareStats> {
  const now = Date.now();
  const lookback = resolveLookbackDays(env, now);
  const chunks = buildDateRangeChunks(now, lookback.days, CHUNK_DAYS);
  const todayRange = buildTodayRange(now);
  const query = buildGraphQlQuery(env.CLOUDFLARE_SITE_TAG, chunks, todayRange);

  const requestedStart = chunks[0]?.start ?? todayRange.start;
  const requestedEnd = todayRange.end;
  let errorCodesForDebug: string | undefined;

  try {
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
        `[site-stats] Cloudflare API returned non-JSON response — status=${res.status} body=${truncateForLog(redactSecrets(rawText, env))}`,
      );
      throw new SiteStatsError("unexpected_response", `Cloudflare API response was not valid JSON (status=${res.status})`);
    }

    if (!res.ok || (body.errors && body.errors.length > 0)) {
      errorCodesForDebug = (body.errors ?? []).map((e) => e.code).filter((c) => c !== undefined).join(",") || undefined;
      // 原因切り分け用の詳細ログ。APIトークン・Account ID・Site Tagは含めない
      // （queryにはsiteTagが埋め込まれているが、このログには出力していない。accountTagはGraphQL変数側にあり、同様に出力していない）。
      console.error(
        `[site-stats] Cloudflare GraphQL API error — status=${res.status} errorCodes=${errorCodesForDebug ?? "n/a"} ` +
          `requestedStart=${requestedStart} requestedEnd=${requestedEnd} ` +
          `lookbackDays=${lookback.days} clampedFromEnv=${lookback.clampedFromEnv} envDateInvalid=${lookback.envDateInvalid} ` +
          `body=${truncateForLog(redactSecrets(JSON.stringify(body), env))}`,
      );
      classifyAndThrow(res.status, body, env);
    }

    const accounts = body.data?.viewer?.accounts;
    if (!accounts || accounts.length === 0) {
      console.error(
        `[site-stats] Cloudflare GraphQL API returned no accounts — status=${res.status} body=${truncateForLog(redactSecrets(JSON.stringify(body), env))}`,
      );
      throw new SiteStatsError("site_not_found", "Cloudflare GraphQL API returned no accounts for the given accountTag");
    }

    const account = accounts[0];

    if (debugRequested) {
      const shapeDump: Record<string, unknown> = {};
      for (const key of Object.keys(account)) {
        shapeDump[key] = describeAliasValue(account[key]);
      }
      console.log(`[site-stats] debug alias shapes: ${truncateForLog(JSON.stringify({ aliases: shapeDump }))}`);
    }

    const aliasShapes: Record<string, string> = {};
    const chunkCounts: Record<string, number> = {};

    // rumPageloadEventsAdaptiveGroupsはAdaptiveGroups系のため、limit:1でも配列（例: [{ count: 123 }]）で返る。
    // 既存互換のためオブジェクト形式（{ count: 123 }）にも対応する。
    const readCount = (alias: string): number => {
      const value = account[alias];
      aliasShapes[alias] = Array.isArray(value)
        ? "array"
        : value === null
          ? "null"
          : typeof value === "object"
            ? "object"
            : typeof value;

      if (Array.isArray(value)) {
        // 該当期間にアクセスがない場合は空配列で返るため、0件として扱う。
        if (value.length === 0) {
          chunkCounts[alias] = 0;
          return 0;
        }
        const sum = sumArrayCounts(value);
        if (sum === null) {
          console.warn(
            `[site-stats] Cloudflare GraphQL API alias=${alias} array contains invalid item(s) — value=${truncateForLog(redactSecrets(JSON.stringify(value), env))}`,
          );
          console.error(
            `[site-stats] Cloudflare GraphQL API invalid array item for alias=${alias} — status=${res.status} body=${truncateForLog(redactSecrets(JSON.stringify(body), env))}`,
          );
          throw new SiteStatsError("unexpected_response", `invalid array item for alias ${alias}`);
        }
        chunkCounts[alias] = sum;
        return sum;
      }

      if (value && typeof value === "object") {
        const count = (value as { count?: unknown }).count;
        if (typeof count === "number" && Number.isFinite(count)) {
          chunkCounts[alias] = count;
          return count;
        }
      }

      console.error(
        `[site-stats] Cloudflare GraphQL API missing or invalid shape for alias=${alias} — status=${res.status} body=${truncateForLog(redactSecrets(JSON.stringify(body), env))}`,
      );
      throw new SiteStatsError("unexpected_response", `missing or invalid shape for alias ${alias}`);
    };

    let totalViews = 0;
    for (let i = 0; i < chunks.length; i++) totalViews += readCount(`c${i}`);
    const todayViews = readCount("today");

    return {
      totalViews,
      todayViews,
      updatedAt: new Date(now).toISOString(),
      windowDays: lookback.days,
      rangeStartDate: requestedStart.slice(0, 10),
      requestedStart,
      requestedEnd,
      aliasShapes: debugRequested ? aliasShapes : undefined,
      chunkCounts: debugRequested ? chunkCounts : undefined,
    };
  } catch (err) {
    // デバッグレスポンス（?debug=1）用に、失敗時の要求範囲・区分をエラーオブジェクトへ付与する。
    if (err instanceof SiteStatsError) {
      err.requestedStart = requestedStart;
      err.requestedEnd = requestedEnd;
      err.lookbackDays = lookback.days;
      err.errorCodes = errorCodesForDebug;
    }
    throw err;
  }
}

type SiteTagDiagnosticsStatus =
  | "configured_tag_found"
  | "configured_tag_not_found"
  | "no_events_found"
  | "query_failed";

interface SiteTagDiagnosticsResult {
  status: SiteTagDiagnosticsStatus;
  configuredTagFound: boolean;
  configuredTagCount: number | null;
  // 実際にイベントが存在するsiteTag上位（件数降順、最大5件）。siteTagはRUMビーコンのトークンで、
  // 本番HTMLに`<script data-cf-beacon>`として公開されている値のため秘密情報ではない。
  topSiteTags?: { siteTag: string | null; count: number }[];
  // 実際に問い合わせた30日区間（古い区間から探索した場合は複数になる）。
  queriedWindows?: { start: string; end: string }[];
  // debug=1専用。設定済みsiteTagと、実際に最も件数が多いsiteTag（前後空白・大文字小文字の差異が
  // ないか比較しやすいよう、正規化前の値をそのまま返す）。
  configuredSiteTag?: string;
  actualSiteTag?: string | null;
  error?: string;
}

// Cloudflareの1回あたりの最大取得期間（実測で13w2d≒93日程度）を大きく下回る30日単位で問い合わせる。
const SITE_TAG_DIAGNOSTIC_WINDOW_DAYS = 30;
// 直近30日が空の場合のみ、その前・さらに前の30日区間まで遡る（最大3区間＝合計90日）。
const SITE_TAG_DIAGNOSTIC_MAX_WINDOWS = 3;

interface SiteTagWindowQueryResult {
  rows?: { siteTag: string | null; count: number }[];
  error?: string;
}

/** 30日以内の単一区間について、実際にイベントが存在するsiteTagを件数降順で取得する。 */
async function queryTopSiteTagsForWindow(env: Env, start: string, end: string): Promise<SiteTagWindowQueryResult> {
  const query = `
    query SiteStatsSiteTagDiscovery($accountTag: string) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          topSiteTags: rumPageloadEventsAdaptiveGroups(
            filter: { datetime_geq: "${start}", datetime_leq: "${end}" }
            limit: 5
            orderBy: [count_DESC]
          ) {
            count
            dimensions {
              siteTag
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { accountTag: env.CLOUDFLARE_ACCOUNT_ID } }),
    });
    const rawText = await res.text();

    let body: {
      data?: { viewer?: { accounts?: { topSiteTags?: unknown }[] } };
      errors?: GraphQlErrorEntry[];
    };
    try {
      body = JSON.parse(rawText) as typeof body;
    } catch {
      return { error: `non-JSON response (status=${res.status})` };
    }

    if (!res.ok || (body.errors && body.errors.length > 0)) {
      const messages =
        redactSecrets((body.errors ?? []).map((e) => e.message ?? "").join(" | "), env) || `request failed (status=${res.status})`;
      console.warn(
        `[site-stats] debug siteTag discovery query failed — window=${start}..${end} status=${res.status} messages=${truncateForLog(messages)}`,
      );
      return { error: messages };
    }

    const rows = body.data?.viewer?.accounts?.[0]?.topSiteTags;
    if (!Array.isArray(rows)) {
      return { error: "unexpected response shape for topSiteTags" };
    }

    return {
      rows: rows.map((row) => {
        const r = row as { count?: unknown; dimensions?: { siteTag?: unknown } };
        return {
          siteTag: typeof r.dimensions?.siteTag === "string" ? r.dimensions.siteTag : null,
          count: typeof r.count === "number" && Number.isFinite(r.count) ? r.count : 0,
        };
      }),
    };
  } catch (err) {
    return { error: redactSecrets(err instanceof Error ? err.message : String(err), env) };
  }
}

/**
 * ?debug=1専用の追加調査。設定済みCLOUDFLARE_SITE_TAGでフィルタせず、
 * 直近30日→その前30日→さらに前30日の順（最大90日）で、実際にイベントが存在するsiteTagを探索する。
 * 各区間は独立した30日以内のGraphQLクエリで、直近区間が空の場合のみ遡る。
 * 本処理が失敗しても本来のtotalViews/todayViews取得には影響させない（常に例外を投げない）。
 */
async function fetchSiteTagDiagnostics(env: Env, referenceEndIso: string): Promise<SiteTagDiagnosticsResult> {
  const endMs = new Date(referenceEndIso).getTime();
  const queriedWindows: { start: string; end: string }[] = [];
  let queryError: string | undefined;
  let foundRows: { siteTag: string | null; count: number }[] | undefined;

  for (let i = 0; i < SITE_TAG_DIAGNOSTIC_MAX_WINDOWS; i++) {
    const windowEndMs = endMs - i * SITE_TAG_DIAGNOSTIC_WINDOW_DAYS * DAY_MS;
    const windowStartMs = windowEndMs - SITE_TAG_DIAGNOSTIC_WINDOW_DAYS * DAY_MS;
    const windowEndIso = new Date(windowEndMs).toISOString();
    const windowStartIso = new Date(windowStartMs).toISOString();
    queriedWindows.push({ start: windowStartIso.slice(0, 10), end: windowEndIso.slice(0, 10) });

    const result = await queryTopSiteTagsForWindow(env, windowStartIso, windowEndIso);
    if (result.error) {
      queryError = result.error;
      break;
    }
    if (result.rows && result.rows.length > 0) {
      foundRows = result.rows;
      break;
    }
    // topSiteTagsが空だった場合のみ、より古い30日区間へフォールバックする。
  }

  if (queryError) {
    return {
      status: "query_failed",
      configuredTagFound: false,
      configuredTagCount: null,
      queriedWindows,
      configuredSiteTag: env.CLOUDFLARE_SITE_TAG,
      error: queryError,
    };
  }

  if (!foundRows || foundRows.length === 0) {
    return {
      status: "no_events_found",
      configuredTagFound: false,
      configuredTagCount: null,
      topSiteTags: [],
      queriedWindows,
      configuredSiteTag: env.CLOUDFLARE_SITE_TAG,
      actualSiteTag: null,
    };
  }

  // 同一siteTagが複数行で返るケースに備え、siteTag単位でcountを合算する。
  const aggregated = new Map<string | null, number>();
  for (const row of foundRows) {
    aggregated.set(row.siteTag, (aggregated.get(row.siteTag) ?? 0) + row.count);
  }
  const topSiteTags = Array.from(aggregated.entries())
    .map(([siteTag, count]) => ({ siteTag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 前後の空白・大文字小文字の違いだけで不一致にならないよう正規化して比較する
  // （Cloudflareダッシュボードからのコピペで混入しやすいため）。
  const configured = env.CLOUDFLARE_SITE_TAG.trim().toLowerCase();
  const configuredEntry = topSiteTags.find((t) => (t.siteTag ?? "").trim().toLowerCase() === configured);

  return {
    status: configuredEntry ? "configured_tag_found" : "configured_tag_not_found",
    configuredTagFound: Boolean(configuredEntry),
    configuredTagCount: configuredEntry ? configuredEntry.count : null,
    topSiteTags,
    queriedWindows,
    configuredSiteTag: env.CLOUDFLARE_SITE_TAG,
    actualSiteTag: topSiteTags[0]?.siteTag ?? null,
  };
}

function jsonResponse(body: SiteStatsPayload, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cacheControl },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const url = new URL(request.url);
  // ?debug=1 または ?nocache=<任意値> が付いている場合は、キャッシュ（live/fallbackとも）を完全に迂回し、
  // 毎回Cloudflare GraphQL APIへ実際に問い合わせる。診断用レスポンス自体もキャッシュへ書き込まない。
  const debugRequested = url.searchParams.has("debug");
  const bypassCache = debugRequested || url.searchParams.has("nocache");
  const cache = caches.default;
  // キャッシュキーにCODE_VERSIONを含めることで、集計ロジックを修正してCODE_VERSIONを上げるたびに
  // 古い（修正前のデータに基づく）キャッシュ済みレスポンスを自動的に無効化する
  // （過去に例あり：siteTag修正後も、修正前にキャッシュされた0件レスポンスが最大1時間残り続けた）。
  const liveCacheKey = new Request(`${url.origin}${url.pathname}?variant=live&v=${CODE_VERSION}`);
  const fallbackCacheKey = new Request(`${url.origin}${url.pathname}?variant=fallback&v=${CODE_VERSION}`);

  // 環境変数が未設定の場合はCloudflare APIを呼ばず、キャッシュもせずに安全な状態を返す。
  // 設定完了後すぐに反映されるよう、この状態はエッジキャッシュしない。
  const missingEnv = getMissingEnvNames(env);
  if (missingEnv.length > 0) {
    console.warn(`[site-stats] configuration_required: missing ${missingEnv.join(", ")}`);
    return jsonResponse(
      {
        ok: false,
        status: "configuration_required",
        message: "アクセス解析の設定を確認しています。",
        ...(debugRequested
          ? {
              debug: {
                codeVersion: CODE_VERSION,
                cacheHit: false,
                fallbackUsed: false,
                graphQLRequested: false,
                requestedStart: null,
                requestedEnd: null,
                lookbackDays: null,
                errorStage: null,
                errorCodes: null,
              },
            }
          : {}),
      },
      200,
      "no-store",
    );
  }

  if (!bypassCache) {
    const cached = await cache.match(liveCacheKey);
    if (cached) return cached;
  }

  try {
    const stats = await fetchCloudflareStats(env, debugRequested);
    const siteTagDiagnostics = debugRequested
      ? await fetchSiteTagDiagnostics(env, stats.requestedEnd)
      : undefined;
    const payload: SiteStatsSuccessPayload = {
      ok: true,
      totalViews: stats.totalViews,
      todayViews: stats.todayViews,
      updatedAt: stats.updatedAt,
      source: "cloudflare",
      windowDays: stats.windowDays,
      rangeStartDate: stats.rangeStartDate,
      ...(debugRequested
        ? {
            debug: {
              codeVersion: CODE_VERSION,
              cacheHit: false,
              fallbackUsed: false,
              graphQLRequested: true,
              requestedStart: stats.requestedStart,
              requestedEnd: stats.requestedEnd,
              lookbackDays: stats.windowDays,
              errorStage: null,
              errorCodes: null,
              aliasShapes: stats.aliasShapes,
              chunkCounts: stats.chunkCounts,
              siteTagDiagnostics,
            },
          }
        : {}),
    };

    if (bypassCache) {
      return jsonResponse(payload, 200, "no-store");
    }

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

    const debugInfo: SiteStatsDebugInfo | undefined = debugRequested
      ? {
          codeVersion: CODE_VERSION,
          cacheHit: false,
          fallbackUsed: false,
          graphQLRequested: true,
          requestedStart: err instanceof SiteStatsError ? (err.requestedStart ?? null) : null,
          requestedEnd: err instanceof SiteStatsError ? (err.requestedEnd ?? null) : null,
          lookbackDays: err instanceof SiteStatsError ? (err.lookbackDays ?? null) : null,
          errorStage: err instanceof SiteStatsError ? err.stage : null,
          errorCodes: err instanceof SiteStatsError ? (err.errorCodes ?? null) : null,
        }
      : undefined;

    // 直前の正常値がキャッシュに残っている場合だけ、それを安全にフォールバック表示する
    // （架空の初期値は使わない）。debug/nocache指定時はフォールバックも使わず、常に実際の失敗を返す。
    if (!bypassCache) {
      const fallback = await cache.match(fallbackCacheKey);
      if (fallback) return fallback;
    }

    const errorResponse = jsonResponse(
      {
        ok: false,
        status: "temporarily_unavailable",
        message: "アクセス数を一時的に取得できません。",
        ...(debugInfo ? { debug: debugInfo } : {}),
      },
      200,
      bypassCache ? "no-store" : `public, max-age=${ERROR_CACHE_TTL_SECONDS}, s-maxage=${ERROR_CACHE_TTL_SECONDS}`,
    );
    // Cloudflare APIへの過剰アクセスを防ぐため、失敗レスポンス自体も短時間だけキャッシュする
    // （bypassCache時はキャッシュへ書き込まない）。
    if (!bypassCache) {
      waitUntil(cache.put(liveCacheKey, errorResponse.clone()));
    }
    return errorResponse;
  }
};

/**
 * GA4の累計表示回数（screenPageViews）を返すエンドポイント。
 * サービスアカウントの秘密鍵はここでのみ使用し、レスポンスには含めない。
 * GA_PROPERTY_ID はGoogle Analytics Data APIの数値プロパティID（測定ID "G-XXXX" とは別物）。
 */

interface Env {
  GA_PROPERTY_ID: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
}

interface SiteStatsPayload {
  totalPageViews: number;
}

// 計測開始日より確実に前になる日付。累計値を取りこぼさないための起点。
const TOTAL_START_DATE = "2020-01-01";

const CACHE_TTL_SECONDS = 60 * 60; // 1時間
const FALLBACK_TTL_SECONDS = 60 * 60 * 24; // 直前の正常値を保持しておく期間（24時間）
const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function textToBase64Url(text: string): string {
  return base64UrlEncode(new TextEncoder().encode(text));
}

/** GOOGLE_PRIVATE_KEYが "\n" ではなく "\\n" として保存されている場合にも対応する。 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  const base64 = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

type SiteStatsFailureStage =
  | "missing_env"
  | "invalid_property_id"
  | "access_token_error"
  | "analytics_api_error"
  | "permission_denied";

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
      ["GA_PROPERTY_ID", env.GA_PROPERTY_ID],
      ["GOOGLE_SERVICE_ACCOUNT_EMAIL", env.GOOGLE_SERVICE_ACCOUNT_EMAIL],
      ["GOOGLE_PRIVATE_KEY", env.GOOGLE_PRIVATE_KEY],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new SiteStatsError("missing_env", `missing environment variables: ${missing.join(", ")}`);
  }

  // 測定ID（G-XXXXXXXXXX）が誤って設定されていないか確認する。
  // Data APIのプロパティIDは数字のみ。
  if (!/^\d+$/.test(env.GA_PROPERTY_ID)) {
    throw new SiteStatsError(
      "invalid_property_id",
      "GA_PROPERTY_ID must be numeric (the GA4 Data API property id, not the G-XXXX measurement id)",
    );
  }
}

async function getAccessToken(env: Env): Promise<string> {
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "pkcs8",
      pemToArrayBuffer(env.GOOGLE_PRIVATE_KEY),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    throw new SiteStatsError("access_token_error", "failed to import GOOGLE_PRIVATE_KEY");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: GA_SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  const unsigned = `${textToBase64Url(JSON.stringify(header))}.${textToBase64Url(JSON.stringify(claims))}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64UrlEncode(signature)}`;

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new SiteStatsError("access_token_error", `token endpoint returned ${tokenRes.status}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new SiteStatsError("access_token_error", "token response missing access_token");
  }
  return tokenJson.access_token;
}

async function fetchTotalPageViews(env: Env): Promise<number> {
  const accessToken = await getAccessToken(env);

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${env.GA_PROPERTY_ID}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: TOTAL_START_DATE, endDate: "today" }],
        metrics: [{ name: "screenPageViews" }],
      }),
    },
  );

  if (!res.ok) {
    let googleStatus = "";
    try {
      const errJson = (await res.json()) as { error?: { status?: string } };
      googleStatus = errJson.error?.status ?? "";
    } catch {
      // レスポンスがJSONでない場合は無視する
    }

    if (res.status === 403 || googleStatus === "PERMISSION_DENIED") {
      throw new SiteStatsError(
        "permission_denied",
        `Analytics Data API denied access (status=${res.status}, google_status=${googleStatus})`,
      );
    }
    if (res.status === 400 || res.status === 404 || googleStatus === "INVALID_ARGUMENT" || googleStatus === "NOT_FOUND") {
      throw new SiteStatsError(
        "invalid_property_id",
        `Analytics Data API rejected the property id (status=${res.status}, google_status=${googleStatus})`,
      );
    }
    throw new SiteStatsError(
      "analytics_api_error",
      `Analytics Data API request failed (status=${res.status}, google_status=${googleStatus})`,
    );
  }

  const json = (await res.json()) as { rows?: { metricValues?: { value?: string }[] }[] };
  return Number(json.rows?.[0]?.metricValues?.[0]?.value ?? 0);
}

async function fetchGa4Stats(env: Env): Promise<SiteStatsPayload> {
  const totalPageViews = await fetchTotalPageViews(env);
  return { totalPageViews };
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
    const stats = await fetchGa4Stats(env);
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

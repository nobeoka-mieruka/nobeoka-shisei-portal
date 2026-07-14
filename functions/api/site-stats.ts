/**
 * GA4のサイト利用状況（過去30日間の訪問者数・ページビュー等）を返すエンドポイント。
 * サービスアカウントの秘密鍵はここでのみ使用し、レスポンスには含めない。
 */

interface Env {
  GA4_PROPERTY_ID: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: string;
}

interface SiteStatsPayload {
  period: { from: string; to: string };
  visitors: number;
  pageViews: number;
  pagesPerVisitor: number;
  updatedAt: string;
}

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

async function getAccessToken(env: Env): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

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
    throw new Error(`token request failed: ${tokenRes.status}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("token response missing access_token");
  }
  return tokenJson.access_token;
}

/** JSTの日付（YYYY-MM-DD）を、UTC基準の日付からのオフセット日数で計算する。 */
function jstDateString(daysAgoFromToday: number): string {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jstNow.setUTCDate(jstNow.getUTCDate() - daysAgoFromToday);
  return jstNow.toISOString().slice(0, 10);
}

async function fetchGa4Stats(env: Env): Promise<SiteStatsPayload> {
  const accessToken = await getAccessToken(env);

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
        metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`GA4 Data API request failed: ${res.status}`);
  }

  const json = (await res.json()) as {
    rows?: { metricValues?: { value?: string }[] }[];
  };

  const row = json.rows?.[0];
  const visitors = Number(row?.metricValues?.[0]?.value ?? 0);
  const pageViews = Number(row?.metricValues?.[1]?.value ?? 0);
  const pagesPerVisitor = visitors > 0 ? Math.round((pageViews / visitors) * 10) / 10 : 0;

  return {
    period: { from: jstDateString(30), to: jstDateString(1) },
    visitors,
    pageViews,
    pagesPerVisitor,
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

  if (!env.GA4_PROPERTY_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    const fallback = await cache.match(fallbackCacheKey);
    if (fallback) return fallback;
    return jsonResponse({ error: "site-stats is not configured" }, 503);
  }

  try {
    const stats = await fetchGa4Stats(env);
    const response = jsonResponse(stats, 200, `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`);
    const fallbackResponse = jsonResponse(stats, 200, `public, max-age=${FALLBACK_TTL_SECONDS}, s-maxage=${FALLBACK_TTL_SECONDS}`);
    waitUntil(Promise.all([cache.put(liveCacheKey, response.clone()), cache.put(fallbackCacheKey, fallbackResponse)]));
    return response;
  } catch (err) {
    const fallback = await cache.match(fallbackCacheKey);
    if (fallback) return fallback;
    return jsonResponse({ error: err instanceof Error ? err.message : "unknown error" }, 502);
  }
};

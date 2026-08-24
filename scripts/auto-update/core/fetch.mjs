/**
 * 自動更新パイプライン共通の取得ヘルパー（Workstream A：共通コア）。
 * timeout・retry（指数バックオフ）・同一ホストへのrate limit・ドメイン許可リスト検証を
 * すべてのUpdater（B：一般質問／C：議案／D：財政・人口）で共通利用する。
 *
 * 【重要】このファイルは実際の取得ロジックを持つ既存の本番スクリプト
 * （scripts/fetch-nobeoka-council-documents.mjs等）を置き換えるものではない。
 * 新規Updater（一般質問・財政・人口）がゼロから書く取得処理の「土台」として使う。
 */

/** 同一ホストへの最短リクエスト間隔（ミリ秒）。延岡市公式サーバーへの負荷対策。 */
const MIN_REQUEST_INTERVAL_MS = 1500;
const lastRequestAtByHost = new Map();

/** targetの取得を許可するホスト一覧。Updaterごとに必要なホストだけを渡すこと。 */
export function assertAllowedHost(url, allowedHosts) {
  const host = new URL(url).host;
  if (!allowedHosts.has(host)) {
    throw new Error(`許可されていないホストへのアクセスです: ${host}（対象: ${url}）`);
  }
  return host;
}

async function waitForRateLimit(host) {
  const last = lastRequestAtByHost.get(host);
  if (last !== undefined) {
    const elapsed = Date.now() - last;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
  }
  lastRequestAtByHost.set(host, Date.now());
}

/**
 * timeout・指数バックオフ付きretry・同一ホストへのrate limitを備えたfetch。
 * 404はリトライしない（存在しないものは何度取得しても存在しない）。
 * 429/5xx/timeoutはリトライ対象とする。
 *
 * @param {string} url
 * @param {{ allowedHosts: Set<string>, timeoutMs?: number, maxRetries?: number, userAgent?: string }} options
 */
export async function fetchWithRetry(url, options) {
  const { allowedHosts, timeoutMs = 15000, maxRetries = 3, userAgent = "Nobeoka-Shisei-Portal/1.0 (auto-update; read-only; dry-run)" } = options;
  const host = assertAllowedHost(url, allowedHosts);

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await waitForRateLimit(host);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": userAgent } });
      clearTimeout(timeout);
      if (res.status === 404) {
        // 404は恒久的な状態である可能性が高く、リトライしても無駄なため即座に返す。
        return res;
      }
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
          continue;
        }
        return res; // リトライ尽きた場合は最後のレスポンスをそのまま返し、呼び出し側に判断を委ねる。
      }
      return res;
    } catch (e) {
      clearTimeout(timeout);
      lastError = e;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
        continue;
      }
    }
  }
  throw lastError ?? new Error(`取得に失敗しました: ${url}`);
}

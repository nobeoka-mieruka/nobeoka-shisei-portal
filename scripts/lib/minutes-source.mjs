/**
 * 延岡市議会「会議録検索システム」（https://www.kensakusystem.jp/nobeoka/）から
 * 公式会議録本文を取得するための低レベル関数群。
 *
 * 2026年8月の調査で、以下が実際のHTTPレスポンスと照合して確認できた（推測ではない）：
 * - ドメインは www. 付き（www.kensakusystem.jp）でアクセスする。www無しはTLS証明書の
 *   ホスト名不一致でハンドシェイクに失敗する環境がある。
 * - 全ページ Shift_JIS（メタタグ上はcharset=Shift_JIS／HTTPヘッダはcharset=shift-jis）。
 *   UTF-8として扱うと文字化けする。
 * - Cookie・セッション状態は不要。全リクエストがCookieなしで成功する（GET/POSTとも）。
 * - <meta name="robots" content="follow,index"> が設定されており、クロール自体は許可されている。
 * - 会期の選択は See.exe への「木構造」ナビゲーション（POSTフォーム、treedepthを
 *   段階的に指定）で行う。1階層目（年）→2階層目（定例会・臨時会名）の2回のPOSTで、
 *   本会議日ごとの fileName（例: "R080216A" = 令和8年2月16日）が判明する。
 * - r_Speakers.exe に fileName を渡すと、その本会議日の発言が「発言順・発言者付き」で
 *   すべて列挙される（No.1, No.2, ... と、各発言の開始位置=downloadPos）。
 * - GetText3.exe に fileName と開始位置(pos)を渡すと、その発言セグメントの本文だけが
 *   返る（他の発言者の発言は混入しない）。
 * - 質問と答弁は、r_Speakers.exeが返す発言順序（No.順）どおりに対応している
 *   （例: 議員の発言の直後に市長・部長等の発言が続く）。
 *
 * 未確認・today's TODO：
 * - See.exeの木構造ナビゲーション（年→会期の2階層）の自動化（本モジュールでは
 *   fileNameを既知として渡す前提の関数のみ実装。年→会期の自動探索は今後の課題）。
 * - キーワード検索（Search2.exe）は未調査。
 * - 議員名の表記ゆれ（敬称の有無、姓名の間のスペース等）の正規化ルールは今後精査する。
 */
import iconv from "iconv-lite";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://www.kensakusystem.jp/nobeoka";

// ローカルHTMLキャッシュ（.gitignore対象）。同一URL・同一POST bodyの再取得を防ぐ。
// 会議録は既に確定した過去日程分のみを扱うため、内容が変わることはない前提でキャッシュする。
const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", ".cache", "minutes");

function cacheKeyFor(url, init) {
  const method = init?.method ?? "GET";
  const body = init?.body ?? "";
  return createHash("sha256").update(`${method}\n${url}\n${body}`).digest("hex");
}

function readCache(key) {
  const file = join(CACHE_DIR, `${key}.json`);
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    return { status: raw.status, contentType: raw.contentType, buf: Buffer.from(raw.bufBase64, "base64") };
  } catch {
    return null;
  }
}

function writeCache(key, result) {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(
      join(CACHE_DIR, `${key}.json`),
      JSON.stringify({ status: result.status, contentType: result.contentType, bufBase64: result.buf.toString("base64") }),
      "utf8"
    );
  } catch {
    // キャッシュ書き込み失敗は致命的ではないため無視して続行する
  }
}
const USER_AGENT = "Mozilla/5.0 (compatible; NobeokaShiseiPortalBot/1.0; +https://nobeoka-shisei-portal.pages.dev/about)";

/**
 * 適応型の同時実行数制御。
 * - 同時実行数は 3→4→5 と段階的にのみ引き上げる（各段階で10件連続成功したら次段階へ）。
 * - 429・403 が1件でも出たら、直ちに同時実行数を1へ緊急引き下げる（段階を最初からやり直す）。
 * - 5xxまたはタイムアウトが連続2件出たら、同時実行数を3へ引き下げる。
 * - 応答時間が直近平均の3倍を超えた場合も、同時実行数を3へ引き下げる。
 * - リクエストの「発行間隔」にも下限（DISPATCH_INTERVAL_MS、既定500ms）を設け、
 *   バースト（複数件が同時刻に発火）しないようにする。
 */
const MIN_MAX_CONCURRENCY = 1;
const STEP_UP_THRESHOLD = 10; // この件数だけ連続成功したら次の並列段階へ引き上げる
const DISPATCH_INTERVAL_MS = 500; // ワーカー間の最低発行間隔
const DISPATCH_JITTER_MS = 150; // リクエスト開始時刻を少しずつずらすためのランダム幅
const RESPONSE_TIME_WINDOW = 30; // 平均応答時間を算出する直近件数
const SLOW_RESPONSE_MULTIPLIER = 3; // 直近平均のこの倍数を超えたら遅延とみなす
const BACKOFF_DELAYS_MS = [2000, 5000, 10000]; // 再試行間隔（最大3回）
const RETRIES = 3;

const FAILED_URLS_FILE = join(CACHE_DIR, "..", "failed-urls.json");

// 同時実行数の制御設定。既定は3→4→5の段階的引き上げ。
// configureConcurrency()で挙動を変更できる（例: 検証目的で10並列固定にする、など）。
const concurrencyConfig = {
  levels: [3, 4, 5], // 段階的に上げていく並列数の候補
  autoStepUp: true, // 連続成功による自動引き上げを行うか
  rateLimitDropLevel: MIN_MAX_CONCURRENCY, // 429/403検知時の引き下げ先
  rateLimitDropThreshold: 1, // この回数だけ429/403が出たら引き下げる（1=即時）
  errorDropLevel: 3, // 5xx/タイムアウト・応答遅延検知時の引き下げ先
};
let consecutiveRateLimitHits = 0;

let concurrencyLevelIndex = 0; // concurrencyConfig.levelsのインデックス
let maxConcurrency = concurrencyConfig.levels[0];
let activeCount = 0;
let lastDispatchAt = 0;
let consecutiveSuccessesAtLevel = 0;
let consecutiveServerErrors = 0;

/**
 * 同時実行数制御の挙動を変更する。
 * @param {{levels?: number[], start?: number, autoStepUp?: boolean, rateLimitDropLevel?: number, rateLimitDropThreshold?: number, errorDropLevel?: number}} options
 */
export function configureConcurrency(options = {}) {
  if (options.levels) concurrencyConfig.levels = options.levels;
  if (typeof options.autoStepUp === "boolean") concurrencyConfig.autoStepUp = options.autoStepUp;
  if (typeof options.rateLimitDropLevel === "number") concurrencyConfig.rateLimitDropLevel = options.rateLimitDropLevel;
  if (typeof options.rateLimitDropThreshold === "number") concurrencyConfig.rateLimitDropThreshold = options.rateLimitDropThreshold;
  if (typeof options.errorDropLevel === "number") concurrencyConfig.errorDropLevel = options.errorDropLevel;
  concurrencyLevelIndex = 0;
  maxConcurrency = options.start ?? concurrencyConfig.levels[0];
  consecutiveSuccessesAtLevel = 0;
  consecutiveServerErrors = 0;
  consecutiveRateLimitHits = 0;
  console.log(
    `[minutes-source] 並列数設定を変更: 開始=${maxConcurrency} 候補段階=[${concurrencyConfig.levels.join(",")}] ` +
      `自動引き上げ=${concurrencyConfig.autoStepUp} 429/403引き下げ先=${concurrencyConfig.rateLimitDropLevel}(${concurrencyConfig.rateLimitDropThreshold}件で発動) エラー引き下げ先=${concurrencyConfig.errorDropLevel}`
  );
}

/**
 * 検証目的で、開始時点から並列数10で実行するモードに切り替える。
 * 429・タイムアウトが複数回発生した場合は自動的に並列数5へ引き下げ、
 * エラーが収まっても10へは自動復帰しない（このバッチの残りは5で継続する）。
 */
export function enableTenParallelTestMode() {
  configureConcurrency({
    levels: [10],
    start: 10,
    autoStepUp: false,
    rateLimitDropLevel: 5,
    rateLimitDropThreshold: 2,
    errorDropLevel: 5,
  });
}

const stats = {
  completed: 0,
  success: 0,
  errors: 0,
  count429: 0,
  count403: 0,
  count5xx: 0,
  responseTimes: [],
};

function currentAvgResponseMs() {
  if (stats.responseTimes.length === 0) return null;
  const sum = stats.responseTimes.reduce((a, b) => a + b, 0);
  return sum / stats.responseTimes.length;
}

function recordResponseTime(ms) {
  stats.responseTimes.push(ms);
  if (stats.responseTimes.length > RESPONSE_TIME_WINDOW) stats.responseTimes.shift();
}

function dropConcurrencyTo(level) {
  const idx = concurrencyConfig.levels.indexOf(level);
  concurrencyLevelIndex = idx >= 0 ? idx : 0;
  maxConcurrency = level;
  consecutiveSuccessesAtLevel = 0;
}

function printStatus(currentSessionLabel) {
  const avg = currentAvgResponseMs();
  console.log(
    `[minutes-source] 状況: 並列数=${maxConcurrency} 完了=${stats.completed} 成功=${stats.success} エラー=${stats.errors} ` +
      `429=${stats.count429} 403=${stats.count403} 5xx=${stats.count5xx} 平均応答=${avg ? Math.round(avg) + "ms" : "-"}` +
      (currentSessionLabel ? ` 対象=${currentSessionLabel}` : "")
  );
}

function registerRequestStart() {
  return Date.now();
}

function registerSuccess(startedAt) {
  const elapsedMs = Date.now() - startedAt;
  const avgBefore = currentAvgResponseMs();
  stats.completed++;
  stats.success++;
  consecutiveServerErrors = 0;
  consecutiveRateLimitHits = 0;

  if (avgBefore !== null && elapsedMs > avgBefore * SLOW_RESPONSE_MULTIPLIER) {
    console.warn(`[minutes-source] 応答遅延検出（${Math.round(elapsedMs)}ms、平常時平均の${SLOW_RESPONSE_MULTIPLIER}倍超）。並列数を${concurrencyConfig.errorDropLevel}へ引き下げます。`);
    dropConcurrencyTo(Math.min(concurrencyConfig.errorDropLevel, maxConcurrency));
  } else {
    consecutiveSuccessesAtLevel++;
    if (concurrencyConfig.autoStepUp && consecutiveSuccessesAtLevel >= STEP_UP_THRESHOLD && concurrencyLevelIndex < concurrencyConfig.levels.length - 1) {
      concurrencyLevelIndex++;
      maxConcurrency = concurrencyConfig.levels[concurrencyLevelIndex];
      consecutiveSuccessesAtLevel = 0;
      console.log(`[minutes-source] ${STEP_UP_THRESHOLD}件連続成功のため並列数を${maxConcurrency}へ引き上げます。`);
    }
  }
  recordResponseTime(elapsedMs);
  if (stats.completed % 5 === 0) printStatus();
}

function registerRateLimitError(status) {
  if (status === 429) stats.count429++;
  if (status === 403) stats.count403++;
  stats.completed++;
  stats.errors++;
  consecutiveServerErrors = 0;
  consecutiveRateLimitHits++;
  if (consecutiveRateLimitHits >= concurrencyConfig.rateLimitDropThreshold) {
    console.warn(`[minutes-source] HTTP ${status} を${consecutiveRateLimitHits}件検出。並列数を${concurrencyConfig.rateLimitDropLevel}へ緊急引き下げます。`);
    dropConcurrencyTo(concurrencyConfig.rateLimitDropLevel);
    consecutiveRateLimitHits = 0;
  }
  printStatus();
}

function registerServerError(isTimeout) {
  stats.completed++;
  stats.errors++;
  if (!isTimeout) stats.count5xx++;
  consecutiveServerErrors++;
  if (consecutiveServerErrors >= 2) {
    console.warn(`[minutes-source] 5xx/タイムアウトが連続2件検出。並列数を${concurrencyConfig.errorDropLevel}へ引き下げます。`);
    dropConcurrencyTo(Math.min(concurrencyConfig.errorDropLevel, maxConcurrency));
    consecutiveServerErrors = 0;
  }
  printStatus();
}

function persistFailedUrl(url, reason) {
  let list = [];
  try {
    if (existsSync(FAILED_URLS_FILE)) list = JSON.parse(readFileSync(FAILED_URLS_FILE, "utf8"));
  } catch {
    list = [];
  }
  list.push({ url, reason, at: new Date().toISOString() });
  try {
    writeFileSync(FAILED_URLS_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch {
    // 失敗URLの記録に失敗しても致命的ではないため無視する
  }
}

/** 同時実行スロットと最小発行間隔の両方が空くまで待つ。 */
async function acquireSlot() {
  for (;;) {
    const now = Date.now();
    const sinceLast = now - lastDispatchAt;
    if (activeCount < maxConcurrency && sinceLast >= DISPATCH_INTERVAL_MS) {
      lastDispatchAt = Date.now();
      activeCount++;
      return;
    }
    const wait = Math.max(50, DISPATCH_INTERVAL_MS - sinceLast);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

function releaseSlot() {
  activeCount = Math.max(0, activeCount - 1);
}

/** Shift_JIS文字列をパーセントエンコードする（バイト単位、大文字16進）。URLのクエリ部分の構築に使う。 */
function sjisPercentEncode(str) {
  const buf = iconv.encode(str, "Shift_JIS");
  let out = "";
  for (const b of buf) {
    if ((b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b === 0x2d || b === 0x2e || b === 0x5f || b === 0x7e) {
      out += String.fromCharCode(b);
    } else {
      out += `%${b.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return out;
}

async function fetchWithRetry(url, init, retries = RETRIES) {
  const cacheKey = cacheKeyFor(url, init);
  const cached = readCache(cacheKey);
  if (cached) return cached;

  // 同時に発行される複数リクエストの開始時刻を少しずつずらし、バーストを避ける。
  await new Promise((r) => setTimeout(r, Math.random() * DISPATCH_JITTER_MS));

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await acquireSlot();
    const startedAt = registerRequestStart();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      let res;
      try {
        res = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: { "User-Agent": USER_AGENT, ...(init?.headers ?? {}) },
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const isRateLimitStatus = res.status === 429 || res.status === 403;
      const isServerErrorStatus = res.status >= 500;
      if (isRateLimitStatus) {
        registerRateLimitError(res.status);
        const retryAfterSec = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : BACKOFF_DELAYS_MS[Math.min(attempt, BACKOFF_DELAYS_MS.length - 1)];
        await new Promise((r) => setTimeout(r, backoff));
        throw new Error(`HTTP ${res.status}`);
      }
      if (isServerErrorStatus) {
        registerServerError(false);
        await new Promise((r) => setTimeout(r, BACKOFF_DELAYS_MS[Math.min(attempt, BACKOFF_DELAYS_MS.length - 1)]));
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const buf = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "";
      registerSuccess(startedAt);
      const result = { status: res.status, contentType, buf };
      writeCache(cacheKey, result);
      return result;
    } catch (e) {
      lastError = e;
      const isKnownHttpError = /HTTP (429|403|5\d\d)/.test(String(e?.message));
      if (!isKnownHttpError) {
        // タイムアウト（AbortError）などステータス起因でないエラーも、5xxと同様の速度低下対象とする
        registerServerError(true);
        await new Promise((r) => setTimeout(r, BACKOFF_DELAYS_MS[Math.min(attempt, BACKOFF_DELAYS_MS.length - 1)]));
      }
    } finally {
      releaseSlot();
    }
  }
  persistFailedUrl(url, String(lastError?.message ?? lastError));
  throw lastError;
}

/** 直近取得の統計情報を返す（呼び出し側での進捗表示用）。 */
export function getFetchStats() {
  return { ...stats, maxConcurrency, avgResponseMs: currentAvgResponseMs() };
}

/** これまでに全リトライを使い切って失敗したURL一覧を返す（再処理用）。 */
export function getFailedUrls() {
  try {
    if (existsSync(FAILED_URLS_FILE)) return JSON.parse(readFileSync(FAILED_URLS_FILE, "utf8"));
  } catch {
    // 読み込み失敗時は空配列を返す
  }
  return [];
}

/** 失敗URL一覧をクリアする（再処理が完了した後などに使う）。 */
export function clearFailedUrls() {
  try {
    writeFileSync(FAILED_URLS_FILE, "[]", "utf8");
  } catch {
    // 致命的ではないため無視する
  }
}

function decodeSjis(buf) {
  const text = iconv.decode(buf, "Shift_JIS");
  return text;
}

/** 文字化け（デコード失敗）の簡易検査。置換文字や制御文字の異常な多さで判定する。 */
export function looksGarbled(text) {
  if (!text) return true;
  const replacementCount = (text.match(/�/g) ?? []).length;
  if (replacementCount > 0) return true;
  const hasJapanese = /[぀-ヿ一-鿿]/.test(text);
  return !hasJapanese;
}

/**
 * 指定した会期（年＋会期名の完全一致）の、本会議日一覧を取得する。
 * See.exeの木構造ナビゲーション（年→会期の2階層POST）を自動化したもの。
 * @param {{code: string, year: string, sessionLabel: string}} params
 *   year例: "令和 8年"（全角スペース区切りに注意。公式サイトの表記に合わせる）
 *   sessionLabel例: "令和 8年 第24回定例会 "（末尾の全角/半角スペースも公式サイトの実際の値に合わせる）
 */
export async function listMeetingDays({ code, sessionLabel }) {
  const body = `Code=${code}&treedepth=${sjisPercentEncode(sessionLabel)}&page=&fileName=`;
  const { buf } = await fetchWithRetry(`${BASE}/cgi-bin3/See.exe`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const html = decodeSjis(buf);
  const days = [];
  const re = /ResultFrame\.exe\?Code=([^&]+)&fileName=([^&]+)&startPos=0"[\s\S]*?>（([^）]+)）</g;
  let m;
  while ((m = re.exec(html))) {
    days.push({ code: m[1], fileName: m[2], label: `（${m[3]}）` });
  }
  return days;
}

async function postTreedepth(code, treedepth) {
  const body = `Code=${code}&treedepth=${sjisPercentEncode(treedepth)}&page=&fileName=`;
  const { buf } = await fetchWithRetry(`${BASE}/cgi-bin3/See.exe`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return decodeSjis(buf);
}

/** See.exeのHTMLから、左サイドバーの「年（またはグループ）」タブ一覧を取得する。 */
function parseYearTabs(html) {
  const re = /treedepth\.value='([^']+)'"><IMG SRC="[^"]*" BORDER="0" ALT="([^"]*)">/g;
  const tabs = [];
  let m;
  while ((m = re.exec(html))) tabs.push({ treedepth: m[1], altLabel: m[2] });
  return tabs;
}

// Phase56（2026-08）で平成対応を追加。令和のロジック・定数値は一切変更していない
// （REIWA_START_YEAR=2018はPhase45-47以前から変わらず、令和分岐の計算式・返り値も従来どおり）。
// 元号の判定は常に「元号の文字列そのもの」（令和／平成という文字、または西暦年からどちらの
// 元号レンジに属するか）で行い、年の数値だけでは判定しない（同じ数値が令和にも平成にも
// なり得るため）。
const REIWA_START_YEAR = 2018; // 令和1年 = 2019年（西暦 = 2018 + 元号年）
const HEISEI_START_YEAR = 1988; // 平成1年 = 1989年（西暦 = 1988 + 元号年）

// See.exeのタブ表示は元号ごとに書式が異なることを実データで確認済み（Phase56、curl検証）：
// - 令和：個別年は全角スペース入り「令和 8年」（「令和元年」のみ例外でスペースなし）
// - 平成：個別年は常にスペースなし「平成26年」「平成31年」（「平成元年」も同形式と推定。
//   実データ確認は「平成24年」以降のみ。root See.exeの最古タブが「平成12年～平成14年」の
//   ため、平成元年〜平成11年の個別タブは今回の調査では存在確認できていない）
const ERA_CONFIG = {
  令和: {
    startYear: REIWA_START_YEAR,
    label: (eraNum) => (eraNum === 1 ? "令和元年" : `令和 ${eraNum}年`),
  },
  平成: {
    startYear: HEISEI_START_YEAR,
    label: (eraNum) => (eraNum === 1 ? "平成元年" : `平成${eraNum}年`),
  },
};

/**
 * "令和 8年" → {fromYear: 2026, toYear: 2026}、"令和 5年～令和 7年" → {fromYear: 2023, toYear: 2025}、
 * "平成27年～平成29年" → {fromYear: 2015, toYear: 2017}、"平成30年～令和元年" → {fromYear: 2018, toYear: 2019}
 * （元号をまたぐグループタブにも対応。実データで確認済み＝Phase56）。
 */
function parseYearRange(altLabel) {
  const matches = [...altLabel.matchAll(/(令和|平成)\s*(元|\d+)年/g)];
  if (matches.length === 0) return null;
  const years = matches.map((m) => {
    const eraNum = m[2] === "元" ? 1 : Number(m[2]);
    return ERA_CONFIG[m[1]].startYear + eraNum;
  });
  return { fromYear: Math.min(...years), toYear: Math.max(...years) };
}

/**
 * 指定した西暦年に対応する、See.exeの「年」treedepth値を解決する（サイドバーのタブを実際に
 * 解析して求める。値を推測で組み立てない）。
 * 令和5年〜令和8年の範囲で動作確認済み（既存）。平成12年（2000年）〜平成29年（2017年）の範囲は
 * Phase56で追加実データ確認済み（平成25年・平成17年を実際にcurlで解決）。元号の判定は西暦年が
 * 2019年以上か否かで行う（2019年は令和元年として扱う。既存の令和ロジックの挙動を変更していない）。
 * @param {{code: string, year: number}} params
 */
export async function resolveYearTreedepth({ code, year }) {
  const eraName = year >= REIWA_START_YEAR + 1 ? "令和" : "平成";
  const config = ERA_CONFIG[eraName];
  const eraNum = year - config.startYear;
  const targetLabel = config.label(eraNum);

  const rootHtml = await fetchWithRetry(`${BASE}/cgi-bin3/See.exe?Code=${code}`, {}).then(({ buf }) => decodeSjis(buf));
  let tabs = parseYearTabs(rootHtml);

  const direct = tabs.find((t) => t.altLabel === targetLabel);
  if (direct) return direct.treedepth;

  for (const t of tabs) {
    const range = parseYearRange(t.altLabel);
    if (range && year >= range.fromYear && year <= range.toYear) {
      const groupHtml = await postTreedepth(code, t.treedepth);
      const innerTabs = parseYearTabs(groupHtml);
      const innerMatch = innerTabs.find((it) => it.altLabel === targetLabel);
      if (innerMatch) return innerMatch.treedepth;
      if (t.treedepth === targetLabel) return t.treedepth;
    }
  }
  throw new Error(`年 ${year} に対応するタブが見つかりませんでした（令和5年〜令和8年、平成12年〜平成29年の範囲で確認済み）`);
}

/**
 * 会期ラベル（例: "令和 7年 第15回臨時会"）から、回次・区分を抽出する。
 * Phase138で発見：延岡市議会会議録検索システムは1桁の回次を「第 8回」のように
 * 全角/半角スペースで桁埋めして表示するため、従来の`第(\d+)回`では「第」と数字の間に
 * 空白があるラベル（1〜9回のうち桁埋めされたもの）を取りこぼしていた（sessionNumber/
 * sessionTypeがundefinedのまま返り、呼び出し側で会期を特定できなくなる不具合）。
 * 空白の有無を許容するよう修正した。
 */
function parseSessionLabel(label) {
  const m = label.match(/第\s*(\d+)回(定例会|臨時会)/);
  return m ? { sessionNumber: `第${m[1]}回`, sessionType: m[2] } : { sessionNumber: undefined, sessionType: undefined };
}

/**
 * 会議ファイル名（例: "R080216A" → 令和8年2月16日、"H250611A" → 平成25年6月11日）を
 * ISO形式の日付へ変換する。令和（Rプレフィックス）・平成（Hプレフィックス）に対応
 * （平成対応はPhase56で追加。令和の分岐・返り値は変更していない）。
 */
export function fileNameToIsoDate(fileName) {
  const reiwaMatch = fileName.match(/^R(\d{2})(\d{2})(\d{2})[A-Z]$/);
  if (reiwaMatch) {
    const [, eraYearStr, monthStr, dayStr] = reiwaMatch;
    const year = REIWA_START_YEAR + Number(eraYearStr);
    return `${year}-${monthStr}-${dayStr}`;
  }
  const heiseiMatch = fileName.match(/^H(\d{2})(\d{2})(\d{2})[A-Z]$/);
  if (heiseiMatch) {
    const [, eraYearStr, monthStr, dayStr] = heiseiMatch;
    const year = HEISEI_START_YEAR + Number(eraYearStr);
    return `${year}-${monthStr}-${dayStr}`;
  }
  return undefined;
}

/**
 * 指定した西暦年の、会期（定例会・臨時会）一覧を取得する。
 * @param {{code: string, year: number}} params
 * @returns {Promise<{treedepth: string, label: string, sessionNumber?: string, sessionType?: string}[]>}
 */
export async function listSessionsForYear({ code, year }) {
  const yearTreedepth = await resolveYearTreedepth({ code, year });
  const html = await postTreedepth(code, yearTreedepth);
  const re = /treedepth\.value='([^']+)'"><IMG SRC="\/nobeoka\/image\/(?:r|down)\.gif"[^>]*>([^<]*)<\/A>/g;
  const sessions = [];
  let m;
  while ((m = re.exec(html))) {
    const label = m[2].trim();
    sessions.push({ treedepth: m[1], label, ...parseSessionLabel(label) });
  }
  return sessions;
}

/**
 * 指定した本会議日（fileName）の、発言セグメント一覧（発言順・発言者・開始位置）を取得する。
 * 本文そのものは含まない（プレビュー抜粋のみ）。本文はfetchSegmentText()で別途取得する。
 * @param {{code: string, fileName: string}} params
 * @returns {Promise<{meetingTitle: string, segments: {order: number, pos: number, speakerLabel: string}[]}>}
 */
export async function listSpeakerSegments({ code, fileName }) {
  const url = `${BASE}/cgi-bin3/r_Speakers.exe?${code}/${fileName}/0/0//10/1/3:0/654/1//0/0/0`;
  const { buf } = await fetchWithRetry(url, {});
  const html = decodeSjis(buf);
  // r_Speakers.exeの<title>は固定文言（"会議録の閲覧と検索"）で会議名を含まないため使わない。
  // 会議名が必要な場合はfetchMeetingTitle()、またはfetchSegmentText()が返すtitleを使うこと。

  const segments = [];
  const re = /downloadPos"\s*value="(\d+)"[\s\S]{0,400}?r_TextFrame\.exe\?[^"]*\/(\d+)\/0\/\/10\/1\/654\/\/0\/0\/0"\s*TARGET="TEXTW"><font class="TEXT5">([^<]*)<font>/g;
  let m;
  let order = 0;
  while ((m = re.exec(html))) {
    order++;
    segments.push({ order, pos: Number(m[2]), speakerLabel: m[3].trim() });
  }
  return { segments };
}

/**
 * 本会議日（fileName）の正式な会議名（例: "令和 8年第24回定例会（第1号 2月16日）"）を取得する。
 * ResultFrame.exeの<TITLE>から取得する（この値は正確であることを確認済み）。
 */
export async function fetchMeetingTitle({ code, fileName }) {
  const url = `${BASE}/cgi-bin3/ResultFrame.exe?Code=${code}&fileName=${fileName}&startPos=0`;
  const { buf } = await fetchWithRetry(url, {});
  const html = decodeSjis(buf);
  const titleMatch = html.match(/<TITLE>([\s\S]*?)<\/TITLE>/i);
  return titleMatch ? titleMatch[1].trim() : "";
}

/**
 * GetText3.exeが返す生HTML（Shift_JISデコード後の文字列）から、本文とタイトルを抽出する。
 * ヘッダー・フッター・script・style・br要素の変換など、HTML本文抽出（正規化）の中心ロジック。
 * @param {string} html デコード済みHTML文字列
 * @returns {{text: string, title: string}}
 */
export function parseSegmentTextHtml(html) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  // タイトルは「会議名 発言者ラベル」の形式。会議名部分を除いた末尾を発言者ラベルとして推定する
  // （呼び出し側でlistSpeakerSegments()のspeakerLabelと突き合わせて確認することを推奨）。
  const title = titleMatch ? titleMatch[1].trim() : "";

  const bodyMatch = html.match(/<FONT class="TEXT2">([\s\S]*?)<\/FONT>/i);
  const raw = bodyMatch ? bodyMatch[1] : "";
  const text = raw
    .replace(/<BR>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, title };
}

/**
 * 発言セグメント1件分の本文を取得する（fetch + parseSegmentTextHtml）。
 * @param {{code: string, fileName: string, pos: number}} params
 * @returns {Promise<{text: string, title: string, fetchedAt: string, sourceUrl: string, rawHtml: string}>}
 */
export async function fetchSegmentText({ code, fileName, pos }) {
  const sourceUrl = `${BASE}/cgi-bin3/GetText3.exe?${code}/${fileName}/${pos}/10/1//0/0`;
  const { buf } = await fetchWithRetry(sourceUrl, {});
  const rawHtml = decodeSjis(buf);
  const { text, title } = parseSegmentTextHtml(rawHtml);
  return { text, title, fetchedAt: new Date().toISOString(), sourceUrl, rawHtml };
}

/**
 * 発言者ラベル（例: "前田遼君" "市長（三浦久知君）"）から、種別と（判別できれば）氏名を推定する。
 * 議員かどうかの確定にはmembers.jsonとの突き合わせが必要（このモジュールでは行わない）。
 */
export function classifySpeakerLabel(label) {
  // "助役"はPhase56で追加（平成期の会議録で副市長制導入以前に使われていた役職名。
  // Phase45-47で平成17年＝2005年の会議録に実例を確認済み。"official"区分として扱う）。
  const officialTitles = ["市長", "副市長", "教育長", "選挙管理委員会委員長", "監査委員", "助役"];
  for (const title of officialTitles) {
    if (label.startsWith(title)) return { speakerType: title === "市長" ? "mayor" : "official", title };
  }
  if (/部長|課長|局長|次長|事務局長/.test(label)) return { speakerType: "official", title: label.replace(/（.*/, "") };
  if (label.startsWith("議長") || label.startsWith("副議長")) return { speakerType: "chair", title: label.replace(/（.*/, "") };
  return { speakerType: "member", title: undefined };
}

/**
 * 発言者ラベル（会議録上の表記）を正規化し、比較しやすい形（敬称・空白除去）にする。
 * 例："前田遼君"／"前田 遼君"／"前田 遼議員"／"○番（前田遼君）" → いずれも"前田遼"。
 */
function normalizeSpeakerName(label) {
  let s = label.trim();
  // "○番（前田遼君）"のように、役職名を伴わない丸括弧内の氏名は中身を優先する
  // （市長・部長等の役職ラベルはclassifySpeakerLabelで別処理するため、ここでは対象外）。
  const isOfficialLabel = /^(市長|副市長|教育長|議長|副議長|.*部長|.*課長|.*局長|.*委員長|.*管理者|.*事務局長)/.test(s);
  if (!isOfficialLabel) {
    const parenMatch = s.match(/[（(]([^）)]+)[）)]/);
    if (parenMatch) s = parenMatch[1];
  }
  return s
    .replace(/^\d+番/, "")
    .replace(/(君|議員|さん|氏)$/g, "")
    .replace(/\s+/g, "");
}

/**
 * 発言者ラベルを既存議員データ（members.json）とマッチングする。
 * 氏名の完全一致（敬称・空白を除去した上で）でのみ確定させ、部分一致・あいまい一致では
 * 確定しない（同姓同名や誤認識のリスクを避けるため）。一致しない場合はundefinedを返し、
 * 呼び出し側でsummaryStatus: "speaker-identification-pending"とすること。
 *
 * 未対応：旧姓・異体字（例: 髙/高、﨑/崎）の表記ゆれ。将来、必要になった時点で
 * 個別の議員データに「別表記」を追加する形で拡張する想定。
 *
 * @param {string} label 会議録上の発言者ラベル
 * @param {{id: string, name: string}[]} members members.jsonの配列
 * @returns {{memberId: string, confidence: "exact"} | undefined}
 */
export function matchSpeakerToMember(label, members) {
  const normalizedLabel = normalizeSpeakerName(label);
  if (!normalizedLabel) return undefined;

  const candidates = members.filter((m) => m.name.replace(/\s+/g, "") === normalizedLabel);
  if (candidates.length === 1) return { memberId: candidates[0].id, confidence: "exact" };
  // 同姓同名など複数該当、または該当なしの場合は確定しない。
  return undefined;
}

/**
 * @deprecated 未実装のスタブ。councilSpeechSummaries.jsonへの本格的な組み込み（sessionId/memberIdから
 * 実際のfileName・発言位置を特定する処理）は今後の課題。現時点ではlistMeetingDays/listSpeakerSegments/
 * fetchSegmentTextを直接使うこと（scripts/fetch-nobeoka-speaker-minutes.mjs参照）。
 */
export async function fetchMinutesForSpeech(input) {
  if (!input?.sessionId || !input?.memberId) {
    throw new Error("fetchMinutesForSpeech: sessionId と memberId は必須です");
  }
  return {
    sourceType: "official-minutes-html",
    sourceUrl: input.officialSearchUrl ?? "",
    fetchedAt: null,
    rawTextPath: null,
    normalizedTextPath: null,
    status: "not-fetched",
  };
}

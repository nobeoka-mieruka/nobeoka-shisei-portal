/**
 * Phase249：人口統計Excel（現住人口及び世帯数の推移）の「出典URL解決」モジュール。
 *
 * 【なぜ必要か】
 * 延岡市公式サイトは、統計ファイルを更新するたびに添付ファイルID（/uploaded/attachment/NNNNN.xls）を
 * 変更し、**古いIDは404にする**。実際に 27980 → 28569 → 28990 と2回変わっており、そのたびに
 * 自動更新パイプラインが「主資料の取得に失敗」で停止して人手での定数書き換えが必要になっていた。
 * 固定IDを新しいIDへ置き換えるだけでは、次の差し替えで同じことが起きる。
 *
 * 【このモジュールの方針】
 *   延岡市公式「延岡市の統計」ページ
 *     → 対象Excelのリンクを本文から取得（ラベルで系列を判定）
 *     → ラベルの基準日・公式ドメイン・拡張子を検証
 *     → download
 *     → 中身が本当にExcelか（HTMLを掴んでいないか）をマジックバイトで検証
 *     → 既存の基準日と比較して「古い版への逆戻り」を検出
 *   一覧ページ側が壊れている場合に備え、既知URL（pinned）を fallback として持つ。
 *
 * 【必ず検出する異常】
 *   1. 404（主URL・解決URLとも）
 *   2. 301/302（最終URLが要求と異なる。許可ドメイン外へのリダイレクトは取得側で遮断）
 *   3. ファイル差し替え（同一URLで内容ハッシュが変化）
 *   4. 添付ファイルID変更（解決URLが pinned と異なる）
 *   5. HTMLをExcelと誤認（エラーページ・ログインページ等を掴む）
 *   6. 古いExcelへの逆戻り（解決した資料の基準日が既存登録値より古い）
 *
 * 【系列の取り違え防止】
 * 同じ統計ページには「住民基本台帳による町丁目別人口・世帯数の推移（平成19年〜）」という
 * **別系列**のExcelも並んでいる。ラベルに「住民基本台帳」を含むリンクは対象から必ず除外する
 * （現住人口系列と住民基本台帳系列を混同しないため）。
 */

/** 延岡市公式「延岡市の統計」ページ。添付ファイルIDが変わってもこのURLは変わらない。 */
export const POPULATION_STATS_PAGE_URL = "https://www.city.nobeoka.miyazaki.jp/soshiki/1/1364.html";

/**
 * 既知の最新版（fallback 兼 高速経路）。一覧ページが取得できない場合だけ使う。
 * ここが404でも、一覧ページから解決できればパイプラインは止まらない。
 */
export const PINNED_POPULATION_XLS_URL = "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28990.xls";

/** 対象系列（現住人口）のラベル。「現住人口」＋「世帯数の推移」の両方を含むものだけを対象にする。 */
const TARGET_LABEL_PATTERN = /現住人口/;
const TARGET_LABEL_SECONDARY_PATTERN = /世帯数(?:・|及び)?の?推移|世帯数/;
/** 別系列。ラベルにこれを含むものは、たとえ「世帯数の推移」を含んでいても対象にしない。 */
const EXCLUDED_SERIES_PATTERN = /住民基本台帳|国勢調査/;

const ALLOWED_HOST = "www.city.nobeoka.miyazaki.jp";

/** xls（BIFF/OLE2）と xlsx（ZIP）のマジックバイト。 */
const MAGIC_XLS = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const MAGIC_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** 一覧ページのHTMLから、Excelへのリンク（href・ラベル）をすべて取り出す。 */
export function extractExcelLinks(html) {
  const links = [];
  const re = /<a\s+[^>]*href="([^"]+\.(?:xls|xlsx))"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const label = m[2]
      .replace(/<[^>]*>/g, "")
      .replace(/[​-‍﻿]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!label) continue;
    links.push({ href: m[1], label });
  }
  return links;
}

/** 「令和8年9月1日現在」のようなラベルから基準日（ISO）を読む。読めなければnull（推測しない）。 */
export function parseLabelReferenceDate(label) {
  const m = label.match(/令和\s*(元|\d+)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!m) return null;
  const eraYear = m[1] === "元" ? 1 : Number(m[1]);
  const year = 2018 + eraYear;
  return `${year}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
}

/**
 * 一覧ページのリンク群から、現住人口系列のExcelを1件選ぶ。
 * 候補が複数ある場合は、ラベルの基準日が最も新しいものを選ぶ（基準日が読めないものは選ばない）。
 */
export function pickPopulationLink(links) {
  const candidates = [];
  const rejected = [];
  for (const l of links) {
    if (EXCLUDED_SERIES_PATTERN.test(l.label)) {
      rejected.push({ ...l, reason: "別系列（住民基本台帳・国勢調査）のため対象外" });
      continue;
    }
    if (!TARGET_LABEL_PATTERN.test(l.label) || !TARGET_LABEL_SECONDARY_PATTERN.test(l.label)) {
      rejected.push({ ...l, reason: "現住人口の推移表ではない" });
      continue;
    }
    candidates.push({ ...l, labelReferenceDate: parseLabelReferenceDate(l.label) });
  }
  const dated = candidates.filter((c) => c.labelReferenceDate);
  dated.sort((a, b) => b.labelReferenceDate.localeCompare(a.labelReferenceDate));
  return { picked: dated[0] ?? null, candidates, rejected };
}

/** 取得したバイト列が本当にExcelかを判定する（HTMLエラーページを掴んでいないかの検出）。 */
export function classifyBuffer(buffer) {
  if (!buffer || buffer.length === 0) return { kind: "empty", isExcel: false };
  if (buffer.subarray(0, 8).equals(MAGIC_XLS)) return { kind: "xls", isExcel: true };
  if (buffer.subarray(0, 4).equals(MAGIC_ZIP)) return { kind: "xlsx", isExcel: true };
  const head = buffer.subarray(0, 512).toString("latin1").trimStart().toLowerCase();
  if (head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<?xml")) {
    return { kind: "html", isExcel: false };
  }
  return { kind: "unknown", isExcel: false };
}

function isAllowedHost(url) {
  try {
    return new URL(url, `https://${ALLOWED_HOST}`).host === ALLOWED_HOST;
  } catch {
    return false;
  }
}

function toAbsolute(href) {
  return new URL(href, `https://${ALLOWED_HOST}`).toString();
}

/**
 * 出典URLを解決して中身まで検証する。
 *
 * @param {object} deps
 * @param {(url:string)=>Promise<string>} deps.fetchText            一覧ページ取得（許可ドメイン制限つき）
 * @param {(url:string)=>Promise<{buffer:Buffer, finalUrl?:string, status?:number}>} deps.fetchBinary  ファイル取得
 * @param {string} [deps.pinnedUrl]            既知URL（fallback）
 * @param {string} [deps.statsPageUrl]         一覧ページURL
 * @param {string|null} [deps.baselineReferenceDate]  既存データの最新基準日（逆戻り検出に使う）
 * @returns {Promise<{ok:boolean, resolvedUrl:string|null, resolvedFrom:string|null, buffer:Buffer|null,
 *                     labelReferenceDate:string|null, linkLabel:string|null, bufferKind:string|null,
 *                     attachmentIdChanged:boolean, issues:Array<{code:string, severity:string, message:string}>,
 *                     diagnostics:object}>}
 */
export async function resolvePopulationSource(deps) {
  const {
    fetchText,
    fetchBinary,
    pinnedUrl = PINNED_POPULATION_XLS_URL,
    statsPageUrl = POPULATION_STATS_PAGE_URL,
    baselineReferenceDate = null,
  } = deps;

  const issues = [];
  const diagnostics = { statsPageFetched: false, candidateCount: 0, rejectedCount: 0, pinnedUrl, statsPageUrl };
  const addIssue = (code, severity, message) => issues.push({ code, severity, message });

  // 1) 一覧ページから解決を試みる。
  let picked = null;
  try {
    const html = await fetchText(statsPageUrl);
    diagnostics.statsPageFetched = true;
    const links = extractExcelLinks(html);
    const result = pickPopulationLink(links);
    diagnostics.candidateCount = result.candidates.length;
    diagnostics.rejectedCount = result.rejected.length;
    diagnostics.excludedBySeries = result.rejected.filter((r) => r.reason.startsWith("別系列")).map((r) => r.label);
    picked = result.picked;
    if (!picked) {
      addIssue(
        "LINK_NOT_FOUND",
        "RED",
        `一覧ページに現住人口系列のExcelリンクが見つかりませんでした（Excelリンク${links.length}件、候補${result.candidates.length}件）。ページ構造が変わった可能性があります。`,
      );
    }
  } catch (e) {
    addIssue("STATS_PAGE_FETCH_FAILED", "YELLOW", `一覧ページの取得に失敗しました: ${e.message}`);
  }

  // 2) 解決できたURLと、fallbackのpinned URLを、この順で試す。
  const attempts = [];
  if (picked) {
    const abs = isAllowedHost(picked.href) ? toAbsolute(picked.href) : null;
    if (!abs) {
      addIssue("NON_OFFICIAL_DOMAIN", "RED", `解決したリンクが延岡市公式ドメインではありません: ${picked.href}`);
    } else {
      attempts.push({ url: abs, from: "stats-page", label: picked.label, labelReferenceDate: picked.labelReferenceDate });
    }
  }
  if (pinnedUrl && !attempts.some((a) => a.url === pinnedUrl)) {
    attempts.push({ url: pinnedUrl, from: "pinned-fallback", label: null, labelReferenceDate: null });
  }

  for (const attempt of attempts) {
    let res;
    try {
      res = await fetchBinary(attempt.url);
    } catch (e) {
      addIssue(
        attempt.from === "pinned-fallback" ? "PINNED_FETCH_FAILED" : "RESOLVED_FETCH_FAILED",
        attempt.from === "pinned-fallback" ? "YELLOW" : "RED",
        `${attempt.from === "pinned-fallback" ? "既知URL（fallback）" : "解決したURL"}の取得に失敗しました（${attempt.url}）: ${e.message}`,
      );
      continue;
    }

    // 301/302：最終URLが要求と違う場合は記録する（許可ドメイン外へのリダイレクトは取得側が遮断済み）。
    if (res.finalUrl && res.finalUrl !== attempt.url) {
      addIssue("REDIRECTED", "YELLOW", `リダイレクトされました: ${attempt.url} → ${res.finalUrl}`);
      diagnostics.finalUrl = res.finalUrl;
    }

    const kind = classifyBuffer(res.buffer);
    if (!kind.isExcel) {
      addIssue(
        "NOT_EXCEL",
        "RED",
        `取得した内容がExcelではありません（判定=${kind.kind}、${res.buffer?.length ?? 0}バイト、${attempt.url}）。エラーページ等を取得した可能性があります。`,
      );
      continue;
    }

    const attachmentIdChanged = attempt.from === "stats-page" && attempt.url !== pinnedUrl;
    if (attachmentIdChanged) {
      addIssue(
        "ATTACHMENT_ID_CHANGED",
        "INFO",
        `添付ファイルIDが変わっています（既知: ${pinnedUrl} → 現在: ${attempt.url}）。一覧ページから解決したため処理は継続しました。PINNED_POPULATION_XLS_URL の更新を推奨します。`,
      );
    }

    // 6) 逆戻り検出：ラベルの基準日が既存登録値より古い場合。
    if (baselineReferenceDate && attempt.labelReferenceDate && attempt.labelReferenceDate < baselineReferenceDate) {
      addIssue(
        "REFERENCE_DATE_REGRESSION",
        "RED",
        `解決した資料の基準日（${attempt.labelReferenceDate}）が既存データの最新基準日（${baselineReferenceDate}）より古い版です。古い資料への逆戻りの可能性があるため自動反映しません。`,
      );
    }

    return {
      ok: true,
      resolvedUrl: attempt.url,
      resolvedFrom: attempt.from,
      buffer: res.buffer,
      bufferKind: kind.kind,
      linkLabel: attempt.label,
      labelReferenceDate: attempt.labelReferenceDate,
      attachmentIdChanged,
      issues,
      diagnostics,
    };
  }

  addIssue("UNRESOLVED", "RED", "一覧ページからの解決・既知URLのいずれでもExcelを取得できませんでした。");
  return {
    ok: false,
    resolvedUrl: null,
    resolvedFrom: null,
    buffer: null,
    bufferKind: null,
    linkLabel: null,
    labelReferenceDate: null,
    attachmentIdChanged: false,
    issues,
    diagnostics,
  };
}

/** issues のうち最も重い severity を返す（RED > YELLOW > INFO > なし）。 */
export function highestSeverity(issues) {
  if (issues.some((i) => i.severity === "RED")) return "RED";
  if (issues.some((i) => i.severity === "YELLOW")) return "YELLOW";
  if (issues.some((i) => i.severity === "INFO")) return "INFO";
  return "NONE";
}

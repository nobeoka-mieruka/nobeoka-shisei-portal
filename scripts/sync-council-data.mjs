/**
 * 延岡市議会 公式資料 5日ごと自動巡回のメインスクリプト。
 *
 * 対象範囲（2026-08-04時点、公式サイトを実地調査して確認した内容）：
 *   - 会議日程                         : /site/gikai/6758.html  （PDFリンク一覧）
 *   - 意見書・決議                     : /site/gikai/19435.html （PDFリンク一覧、議決日付き）
 *   - 委員会活動報告書                 : /site/gikai/43039.html （PDFリンク一覧）
 *   - 一般質問 質問通告一覧            : /site/gikai/1416.html → 最新会期の通告一覧ページ
 *                                         （氏名・所属会派・質問方式・PDFの表）
 *   - 議員名簿                         : /site/gikai/1455.html （変更検知のみ。自動反映はしない）
 *
 * 公式サイトを実地調査した結果、次は「対象資料なし」または「未確認」として扱う
 * （推測でデータ構造を作らない）：
 *   - 質問主意書・答弁書 : 延岡市議会にはその名称の制度・公開資料が確認できなかった。
 *     一般質問は本会議での口頸質問（質問通告一覧・会議録）のみが公式資料として存在する。
 *   - 委員会会議録（本会議以外） : 会議録検索システム（kensakusystem.jp）で本会議コードは
 *     確認済みだが、委員会分のコードは未特定。誤ったコードで取得しないよう、今回は対象外。
 *   - 請願・陳情の個別一覧・審査結果 : /site/gikai/1429.html は制度説明・様式提供のみで、
 *     個別の請願・陳情一覧や審査結果の公開ページは確認できなかった（審議結果PDFに含まれる
 *     範囲のみ、既存のfetch-nobeoka-council-documents.mjsが扱う）。
 *
 * 差分取得・重複防止：
 *   資料の同一性は「種別＋原文URL」を基本キーとし、ファイルはSHA-256ハッシュで内容比較する。
 *   URLだけでの重複判定はしない（同一ファイルの再ダウンロードは行わず、ハッシュが変わった
 *   場合のみ「更新」として扱う）。
 *
 * 削除検知：
 *   一覧から見つからなくなった資料は、連続2回以上見つからない場合のみ
 *   「公式サイトから削除された可能性」とする。1回目は「要確認」に留め、データは削除しない。
 *
 * 使い方：
 *   node scripts/sync-council-data.mjs --dry-run           既存データを変更せず確認のみ
 *   node scripts/sync-council-data.mjs --force              120時間ゲートを無視して実行
 *   node scripts/sync-council-data.mjs --last-success=<ISO> 外部（GitHub Actions実行履歴等）
 *                                                            から前回正常実行日時を渡す
 *   node scripts/sync-council-data.mjs --mark-success        取得後にvalidate:data・typecheck・
 *                                                            lint・buildがすべて成功した場合のみ、
 *                                                            呼び出し側（GitHub Actions）から実行し、
 *                                                            ローカル状態ファイルのlastSuccessfulRunAt
 *                                                            を更新する（このスクリプト自身は
 *                                                            成功したかどうかを判断しない）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWED_HOSTS, fetchCitySiteText, fetchCitySiteWithMeta, resolveUrl, sha256OfBuffer, stats as fetchStats } from "./lib/city-site-fetch.mjs";
import { extractPdfText } from "./lib/pdf-text.mjs";
import { matchSpeakerToMember } from "./lib/minutes-source.mjs";
import { appendHistory, loadLocalState, saveLocalState, shouldRun } from "./lib/sync-state.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isForce = args.includes("--force");
const lastSuccessArg = args.find((a) => a.startsWith("--last-success="))?.split("=")[1];

const watchedPath = join(root, "src", "data", "councilWatchedDocuments.json");
const membersPath = join(root, "src", "data", "members.json");
const reportsDir = join(root, "reports");
const reportPath = join(reportsDir, "sync-council-data-report.json");

/** 一覧ページから <a href="*.pdf|*.docx"> を汎用抽出する（見出し構造の有無に依存しない）。 */
function parseGenericPdfListing(html) {
  const entries = [];
  const re = /<a\s+href="([^"]+\.(?:pdf|docx?))"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const [, href, rawText] = m;
    const linkText = rawText.replace(/<[^>]+>/g, "").replace(/[​-‍﻿]/g, "").trim();
    if (!linkText) continue;
    // 直前100文字以内に「令和N年M月D日」があれば議決日等として拾う（ベストエフォート、無くても可）。
    const precedingWindow = html.slice(Math.max(0, m.index - 120), m.index);
    const dateMatch = precedingWindow.match(/令和(?:元|\d+)年\d{1,2}月\d{1,2}日(?![^<]*<\/a>)/g);
    const decidedDate = dateMatch ? dateMatch[dateMatch.length - 1] : null;
    entries.push({ href, linkText, decidedDate });
  }
  return entries;
}

function extractMainBody(html) {
  const start = html.indexOf('id="main_body"');
  const end = html.indexOf('id="section_footer"');
  if (start === -1 || end === -1 || end <= start) return html;
  return html.slice(start, end);
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** "第26回延岡市議会(令和8年6月定例会)" + 月日 → "2026-06-23"（令和年が読み取れない場合はnull）。 */
function deriveQuestionDate(sessionTitle, month, day) {
  const m = sessionTitle?.match(/令和(\d+)年/);
  if (!m) return null;
  const year = Number(m[1]) + 2018;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MAX_STORED_TEXT_CHARS = 6000;

/**
 * @param {string} sourceUrl
 * @param {{includeText?: boolean}} [options] includeText: 質問通告書PDF等、本文プレビューを
 *   保存したいカテゴリでのみtrueにする（他カテゴリでのJSON肥大化を避けるため既定false）。
 */
async function downloadAndAssess(sourceUrl, options = {}) {
  const meta = await fetchCitySiteWithMeta(sourceUrl);
  const { buffer } = meta;
  const fileHash = sha256OfBuffer(buffer);
  let ocrRequired = null;
  let totalChars = null;
  let extractedText = null;
  if (/\.pdf$/i.test(sourceUrl)) {
    const tmpPath = join(root, "scripts", ".cache", "sync-pdf-check.pdf");
    mkdirSync(dirname(tmpPath), { recursive: true });
    writeFileSync(tmpPath, buffer);
    try {
      const extracted = await extractPdfText(tmpPath);
      ocrRequired = extracted.ocrRequired;
      totalChars = extracted.totalChars;
      if (options.includeText && !ocrRequired) {
        extractedText = extracted.pages
          .map((p) => p.rawText)
          .join("\n")
          .trim()
          .slice(0, MAX_STORED_TEXT_CHARS);
      }
    } catch (e) {
      console.warn(`[sync-council-data] PDFテキスト抽出に失敗（OCR要否を判定できず）: ${sourceUrl} - ${e.message}`);
    }
  }
  return {
    buffer,
    fileHash,
    ocrRequired,
    totalChars,
    extractedText,
    etag: meta.etag,
    lastModified: meta.lastModified,
    contentLength: meta.contentLength,
  };
}

/** 種別＋原文URLを基本キーに、既存レコードを探す。 */
function findRecord(records, category, sourceUrl) {
  return records.find((r) => r.category === category && r.sourceUrl === sourceUrl);
}

async function syncGenericListing({ category, categoryLabel, pageUrl, records, report }) {
  console.log(`[sync-council-data] ${categoryLabel} を確認します: ${pageUrl}`);
  let html;
  try {
    html = await fetchCitySiteText(pageUrl);
  } catch (e) {
    console.error(`[sync-council-data] ${categoryLabel} の一覧ページ取得に失敗しました: ${e.message}`);
    report.categories.push({ category, categoryLabel, pageUrl, status: "fetch-error", error: e.message });
    return;
  }
  const body = extractMainBody(html);
  const entries = parseGenericPdfListing(body);
  const seenUrls = new Set();
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  for (const entry of entries) {
    const sourceUrl = resolveUrl(entry.href);
    seenUrls.add(sourceUrl);
    const existing = findRecord(records, category, sourceUrl);

    if (existing && existing.status === "removed-suspected" ) {
      existing.status = "published";
    }

    try {
      if (existing) {
        existing.missingStreak = 0;
        existing.lastCheckedAt = todayIso();
        existing.title = entry.linkText;
        if (entry.decidedDate) existing.decidedDate = entry.decidedDate;
        if (isDryRun) {
          unchangedCount++;
          continue;
        }
        const { fileHash, ocrRequired } = await downloadAndAssess(sourceUrl);
        if (fileHash !== existing.fileHash) {
          existing.fileHash = fileHash;
          existing.ocrStatus = ocrRequired ? "OCR確認待ち" : "text-extracted";
          existing.updatedAt = todayIso();
          updatedCount++;
        } else {
          unchangedCount++;
        }
      } else {
        newCount++;
        if (isDryRun) continue;
        const { fileHash, ocrRequired } = await downloadAndAssess(sourceUrl);
        records.push({
          id: `${category}-${sha256OfBuffer(Buffer.from(sourceUrl)).slice(0, 12)}`,
          category,
          title: entry.linkText,
          decidedDate: entry.decidedDate ?? null,
          sourceUrl,
          sourcePageUrl: pageUrl,
          fileHash,
          ocrStatus: ocrRequired ? "OCR確認待ち" : "text-extracted",
          status: "published",
          isOfficial: true,
          firstDetectedAt: todayIso(),
          lastCheckedAt: todayIso(),
          updatedAt: null,
          missingStreak: 0,
        });
      }
    } catch (e) {
      errorCount++;
      console.error(`[sync-council-data] ${categoryLabel} の資料取得に失敗（スキップ）: ${sourceUrl} - ${e.message}`);
    }
  }

  // 削除検知（一覧に見つからなかった既存資料）。連続2回以上見つからない場合のみ「削除された可能性」。
  let removedSuspectedCount = 0;
  let urlChangeSuspectedCount = 0;
  if (!isDryRun) {
    for (const r of records) {
      if (r.category !== category) continue;
      if (seenUrls.has(r.sourceUrl)) continue;
      if (r.status === "removed-confirmed-suspected") continue;
      r.missingStreak = (r.missingStreak ?? 0) + 1;
      r.lastCheckedAt = todayIso();
      if (r.missingStreak >= 2) {
        r.status = "removed-confirmed-suspected";
        removedSuspectedCount++;
      } else {
        r.status = "url-change-suspected";
        urlChangeSuspectedCount++;
      }
    }
  }

  report.categories.push({
    category,
    categoryLabel,
    pageUrl,
    status: "ok",
    detected: entries.length,
    new: newCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    removedSuspected: removedSuspectedCount,
    urlChangeSuspected: urlChangeSuspectedCount,
    errors: errorCount,
  });
  console.log(
    `[sync-council-data] ${categoryLabel}: 検出=${entries.length} 新規=${newCount} 更新=${updatedCount} 変更なし=${unchangedCount} 削除疑い=${removedSuspectedCount} エラー=${errorCount}`
  );
}

/**
 * 一般質問 質問通告一覧（1416.html → 最新会期の通告一覧ページ）を確認する。
 *
 * 1416.htmlは同一URLのまま内容（対象会期・PDFリンク等）が入れ替わるページのため、
 * URLの一致だけで「取得済み」と判定しない。ページタイトル・更新日・対象会期・本文
 * ハッシュ・PDFのETag/Last-Modified/Content-Length/SHA-256のいずれかが変化した場合を
 * 「更新」として検出する。新しい会期を検出した場合は、既存の会期の記録を上書きせず、
 * 新しい会期のレコード（sourceUrlが異なるため自然に別レコードとなる）として追加する。
 */
async function syncQuestionNotices({ records, report, members }) {
  const indexUrl = "https://www.city.nobeoka.miyazaki.jp/site/gikai/1416.html";
  console.log(`[sync-council-data] 一般質問 質問通告一覧 を確認します: ${indexUrl}`);
  let indexHtml;
  try {
    indexHtml = await fetchCitySiteText(indexUrl);
  } catch (e) {
    console.error(`[sync-council-data] 質問通告一覧の入口ページ取得に失敗しました: ${e.message}`);
    report.categories.push({ category: "question-notice", categoryLabel: "一般質問 質問通告一覧", pageUrl: indexUrl, status: "fetch-error", error: e.message });
    return;
  }
  const body = extractMainBody(indexHtml);
  const indexTitleMatch = indexHtml.match(/<h1>([^<]*)<\/h1>/);
  const indexTitle = indexTitleMatch ? indexTitleMatch[1].trim() : null;
  const indexUpdateDateMatch = indexHtml.match(/更新日：([^<]*)更新/);
  const indexUpdateDate = indexUpdateDateMatch ? indexUpdateDateMatch[1].trim() : null;
  const indexBodyHash = sha256OfBuffer(Buffer.from(body, "utf8"));

  const linkMatch = body.match(/<li><a href="([^"]+)">([^<]*)<\/a><\/li>/);
  if (!linkMatch) {
    console.warn("[sync-council-data] 質問通告一覧: 入口ページの構造が想定と異なるため、検出0件として記録します。");
    report.categories.push({ category: "question-notice", categoryLabel: "一般質問 質問通告一覧", pageUrl: indexUrl, status: "structure-mismatch", detected: 0 });
    return;
  }
  const detailUrl = resolveUrl(linkMatch[1]);
  const detailHtml = await fetchCitySiteText(detailUrl).catch((e) => {
    console.error(`[sync-council-data] 質問通告一覧の詳細ページ取得に失敗しました: ${e.message}`);
    return null;
  });
  if (!detailHtml) {
    report.categories.push({ category: "question-notice", categoryLabel: "一般質問 質問通告一覧", pageUrl: indexUrl, detailUrl, status: "fetch-error" });
    return;
  }
  const detailBody = extractMainBody(detailHtml);
  const sessionTitleMatch = detailBody.match(/<h2><strong>([^<]*)<\/strong><\/h2>/);
  const sessionTitle = sessionTitleMatch ? sessionTitleMatch[1].trim() : null;
  const detailBodyHash = sha256OfBuffer(Buffer.from(detailBody, "utf8"));

  // ページタイトル・更新日・対象会期・詳細ページ本文ハッシュのいずれも変化していない場合は、
  // 個々のPDFの再ダウンロード・再解析を行わない（公式サーバー負荷対策）。
  const indexStateId = "question-notice-index-state";
  const previousState = records.find((r) => r.id === indexStateId);
  const unchangedSinceLastCheck =
    previousState &&
    previousState.indexTitle === indexTitle &&
    previousState.indexUpdateDate === indexUpdateDate &&
    previousState.sessionTitle === sessionTitle &&
    previousState.detailBodyHash === detailBodyHash;

  if (!isDryRun) {
    if (previousState) {
      previousState.indexTitle = indexTitle;
      previousState.indexUpdateDate = indexUpdateDate;
      previousState.sessionTitle = sessionTitle;
      previousState.indexBodyHash = indexBodyHash;
      previousState.detailUrl = detailUrl;
      previousState.detailBodyHash = detailBodyHash;
      previousState.lastCheckedAt = todayIso();
    } else {
      records.push({
        id: indexStateId,
        category: "question-notice-index-state",
        title: "質問通告一覧ページの状態（変更検知用）",
        sourceUrl: indexUrl,
        indexTitle,
        indexUpdateDate,
        sessionTitle,
        indexBodyHash,
        detailUrl,
        detailBodyHash,
        status: "baseline",
        isOfficial: true,
        firstDetectedAt: todayIso(),
        lastCheckedAt: todayIso(),
      });
    }
  }

  if (unchangedSinceLastCheck) {
    const existingMemberRecords = records.filter((r) => r.category === "question-notice");
    for (const r of existingMemberRecords) r.lastCheckedAt = todayIso();
    report.categories.push({
      category: "question-notice",
      categoryLabel: "一般質問 質問通告一覧",
      pageUrl: indexUrl,
      detailUrl,
      sessionTitle,
      status: "ok",
      detected: existingMemberRecords.length,
      new: 0,
      updated: 0,
      unchanged: existingMemberRecords.length,
      removedSuspected: 0,
      urlChangeSuspected: 0,
      needsReview: existingMemberRecords.filter((r) => r.speakerIdentificationStatus === "要確認").length,
      errors: 0,
      note: "一覧ページのタイトル・更新日・対象会期・本文ハッシュが前回確認時と一致したため、PDFの再取得・再解析をスキップしました。",
    });
    console.log("[sync-council-data] 質問通告一覧: 前回確認時から変更なし（タイトル・更新日・会期・本文ハッシュ一致）。PDFの再解析をスキップしました。");
    return;
  }

  const dayBlockRe = /<h3>【(\d{1,2})月(\d{1,2})日[^】]*】[^<]*<\/h3>([\s\S]*?)(?=<h3>|$)/g;
  let dayMatch;
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;
  let needsReviewCount = 0;
  const seenUrls = new Set();

  while ((dayMatch = dayBlockRe.exec(detailBody))) {
    const [, monthStr, dayStr, tableHtml] = dayMatch;
    const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
    let rowMatch;
    while ((rowMatch = rowRe.exec(tableHtml))) {
      const rowHtml = rowMatch[1];
      if (/<th/.test(rowHtml)) continue; // ヘッダー行
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]+>/g, "").trim());
      if (cells.length < 5) continue;
      const [, , rawName, faction, format] = cells;
      const name = rawName.replace(/[　\s]+/g, " ").replace(/\s+/g, "");
      const pdfLinkMatch = rowHtml.match(/<a href="([^"]+\.pdf)"/i);
      if (!pdfLinkMatch) continue;
      const sourceUrl = resolveUrl(pdfLinkMatch[1]);
      seenUrls.add(sourceUrl);

      const matched = matchSpeakerToMember(name, members);
      if (!matched) needsReviewCount++;

      const existing = findRecord(records, "question-notice", sourceUrl);
      try {
        if (existing) {
          existing.missingStreak = 0;
          existing.lastCheckedAt = todayIso();
          if (isDryRun) {
            unchangedCount++;
            continue;
          }
          const { fileHash, ocrRequired, extractedText, etag, lastModified, contentLength } = await downloadAndAssess(sourceUrl, {
            includeText: true,
          });
          const metaChanged = existing.etag !== etag || existing.lastModified !== lastModified || existing.contentLength !== contentLength;
          if (fileHash !== existing.fileHash || metaChanged) {
            existing.fileHash = fileHash;
            existing.ocrStatus = ocrRequired ? "OCR確認待ち" : "text-extracted";
            existing.extractedTextPreview = extractedText;
            existing.etag = etag;
            existing.lastModified = lastModified;
            existing.contentLength = contentLength;
            existing.fetchedAt = new Date().toISOString();
            existing.updatedAt = todayIso();
            updatedCount++;
          } else {
            unchangedCount++;
          }
        } else {
          newCount++;
          if (isDryRun) continue;
          const { fileHash, ocrRequired, extractedText, etag, lastModified, contentLength } = await downloadAndAssess(sourceUrl, {
            includeText: true,
          });
          records.push({
            id: `question-notice-${sha256OfBuffer(Buffer.from(sourceUrl)).slice(0, 12)}`,
            category: "question-notice",
            title: `${sessionTitle ?? "会期未特定"}（${monthStr}月${dayStr}日 個人質問）`,
            sessionTitle: sessionTitle ?? null,
            questionDate: deriveQuestionDate(sessionTitle, Number(monthStr), Number(dayStr)),
            memberName: name,
            memberId: matched?.memberId ?? null,
            speakerIdentificationStatus: matched ? "confirmed" : "要確認",
            faction: faction || null,
            questionFormat: format || null,
            sourceUrl,
            sourcePageUrl: detailUrl,
            fileHash,
            ocrStatus: ocrRequired ? "OCR確認待ち" : "text-extracted",
            extractedTextPreview: extractedText,
            etag,
            lastModified,
            contentLength,
            status: "published",
            isOfficial: true,
            firstDetectedAt: todayIso(),
            lastCheckedAt: todayIso(),
            fetchedAt: new Date().toISOString(),
            updatedAt: null,
            missingStreak: 0,
          });
        }
      } catch (e) {
        errorCount++;
        console.error(`[sync-council-data] 質問通告書の取得に失敗（スキップ）: ${sourceUrl} - ${e.message}`);
      }
    }
  }

  let removedSuspectedCount = 0;
  let urlChangeSuspectedCount = 0;
  if (!isDryRun) {
    for (const r of records) {
      if (r.category !== "question-notice") continue;
      if (seenUrls.has(r.sourceUrl)) continue;
      if (r.status === "removed-confirmed-suspected") continue;
      r.missingStreak = (r.missingStreak ?? 0) + 1;
      r.lastCheckedAt = todayIso();
      if (r.missingStreak >= 2) {
        r.status = "removed-confirmed-suspected";
        removedSuspectedCount++;
      } else {
        r.status = "url-change-suspected";
        urlChangeSuspectedCount++;
      }
    }
  }

  report.categories.push({
    category: "question-notice",
    categoryLabel: "一般質問 質問通告一覧",
    pageUrl: indexUrl,
    detailUrl,
    sessionTitle,
    status: "ok",
    detected: seenUrls.size,
    new: newCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    removedSuspected: removedSuspectedCount,
    urlChangeSuspected: urlChangeSuspectedCount,
    needsReview: needsReviewCount,
    errors: errorCount,
  });
  console.log(
    `[sync-council-data] 質問通告一覧: 検出=${seenUrls.size} 新規=${newCount} 更新=${updatedCount} 変更なし=${unchangedCount} 要確認（議員特定不可）=${needsReviewCount} エラー=${errorCount}`
  );
}

/** 議員名簿ページの変更検知のみ行う（自動反映はしない）。 */
async function syncMemberRosterWatch({ records, report }) {
  const pageUrl = "https://www.city.nobeoka.miyazaki.jp/site/gikai/1455.html";
  console.log(`[sync-council-data] 議員名簿ページの変更検知を行います: ${pageUrl}`);
  let html;
  try {
    html = await fetchCitySiteText(pageUrl);
  } catch (e) {
    console.error(`[sync-council-data] 議員名簿ページの取得に失敗しました: ${e.message}`);
    report.categories.push({ category: "member-roster-watch", categoryLabel: "議員名簿（変更検知）", pageUrl, status: "fetch-error", error: e.message });
    return;
  }
  const body = extractMainBody(html).replace(/<script[\s\S]*?<\/script>/gi, "");
  const contentHash = sha256OfBuffer(Buffer.from(body, "utf8"));
  const existing = findRecord(records, "member-roster-watch", pageUrl);
  const changed = existing ? existing.fileHash !== contentHash : true;

  if (isDryRun) {
    report.categories.push({ category: "member-roster-watch", categoryLabel: "議員名簿（変更検知）", pageUrl, status: "ok", changed, note: "dry-run: 未保存" });
    return;
  }
  if (existing) {
    if (changed) {
      existing.fileHash = contentHash;
      existing.status = "要確認（変更検知）";
      existing.updatedAt = todayIso();
    }
    existing.lastCheckedAt = todayIso();
  } else {
    records.push({
      id: "member-roster-watch",
      category: "member-roster-watch",
      title: "議員名簿ページ（変更検知用ハッシュ）",
      sourceUrl: pageUrl,
      sourcePageUrl: pageUrl,
      fileHash: contentHash,
      status: "baseline",
      isOfficial: true,
      firstDetectedAt: todayIso(),
      lastCheckedAt: todayIso(),
      updatedAt: null,
      missingStreak: 0,
    });
  }
  report.categories.push({ category: "member-roster-watch", categoryLabel: "議員名簿（変更検知）", pageUrl, status: "ok", changed });
  console.log(`[sync-council-data] 議員名簿ページ: 変更検知=${changed ? "あり（要確認）" : "なし"}`);
}

function recordUnavailableCategories(report) {
  const notes = [
    {
      category: "question-memorandum",
      categoryLabel: "質問主意書・答弁書",
      status: "対象資料なし",
      note: "延岡市議会の公式サイトを実地調査したが、「質問主意書」という名称の制度・公開資料は確認できなかった。一般質問は本会議での口頭質問（質問通告一覧・会議録）のみが公式資料として存在する。",
    },
    {
      category: "committee-minutes",
      categoryLabel: "常任委員会・特別委員会の会議録",
      status: "未確認",
      note: "会議録検索システム（kensakusystem.jp）で本会議のCodeは確認済みだが、委員会分のCodeは未特定。誤ったCodeでの取得を避けるため、今回は対象外とした。",
    },
    {
      category: "petition-register",
      categoryLabel: "請願・陳情の個別一覧・審査結果",
      status: "対象資料なし",
      note: "/site/gikai/1429.html は制度説明・様式提供のみで、個別の請願・陳情一覧や審査結果を掲載する公開ページは確認できなかった。審査結果は審議結果PDF（既存のfetch-nobeoka-council-documents.mjsが扱う範囲）に含まれる場合がある。",
    },
  ];
  report.unavailableCategories = notes;
}

function markSuccess() {
  const localState = loadLocalState();
  const now = new Date().toISOString();
  localState.lastSuccessfulRunAt = now;
  saveLocalState(localState);
  console.log(`[sync-council-data] lastSuccessfulRunAtを更新しました: ${now}`);
}

async function main() {
  if (args.includes("--mark-success")) {
    markSuccess();
    return;
  }

  const localState = loadLocalState();
  const lastSuccessfulRunAt = lastSuccessArg ?? localState.lastSuccessfulRunAt;
  const gate = shouldRun({ force: isForce, lastSuccessfulRunAt });

  const report = {
    runAt: new Date().toISOString(),
    dryRun: isDryRun,
    forced: isForce,
    lastSuccessfulRunAt,
    hoursSinceLast: gate.hoursSinceLast,
    gateReason: gate.reason,
    ran: gate.run,
    allowedHosts: [...ALLOWED_HOSTS],
    categories: [],
    unavailableCategories: [],
  };

  if (!gate.run) {
    console.log(
      `[sync-council-data] 前回正常実行から${gate.hoursSinceLast?.toFixed(1)}時間しか経過していないため、対象外として終了します（120時間未満）。`
    );
    mkdirSync(reportsDir, { recursive: true });
    writeJson(reportPath, report);
    console.log("SYNC_RAN=false");
    return;
  }

  console.log(`[sync-council-data] 実行理由: ${gate.reason}（前回正常実行から${gate.hoursSinceLast === null ? "記録なし" : gate.hoursSinceLast.toFixed(1) + "時間"}）`);

  const records = readJson(watchedPath, []);
  const members = readJson(membersPath, []);

  await syncGenericListing({
    category: "session-schedule",
    categoryLabel: "会議日程",
    pageUrl: "https://www.city.nobeoka.miyazaki.jp/site/gikai/6758.html",
    records,
    report,
  });
  await syncGenericListing({
    category: "statement-resolution",
    categoryLabel: "意見書・決議",
    pageUrl: "https://www.city.nobeoka.miyazaki.jp/site/gikai/19435.html",
    records,
    report,
  });
  await syncGenericListing({
    category: "committee-activity-report",
    categoryLabel: "委員会活動報告書",
    pageUrl: "https://www.city.nobeoka.miyazaki.jp/site/gikai/43039.html",
    records,
    report,
  });
  await syncQuestionNotices({ records, report, members });
  await syncMemberRosterWatch({ records, report });
  recordUnavailableCategories(report);

  report.fetchStats = { ...fetchStats };

  if (!isDryRun) {
    writeJson(watchedPath, records);
  }

  mkdirSync(reportsDir, { recursive: true });
  writeJson(reportPath, report);

  // ローカル状態ファイルの更新（GitHub Actions実行履歴を主とするが、ローカル実行時の補助として保持する）。
  localState.lastAttemptAt = report.runAt;
  appendHistory(localState, {
    runAt: report.runAt,
    dryRun: isDryRun,
    forced: isForce,
    categories: report.categories.map((c) => ({ category: c.category, status: c.status, new: c.new, updated: c.updated, errors: c.errors })),
    fetchStats: report.fetchStats,
  });
  if (!isDryRun) saveLocalState(localState);

  const totalErrors = report.categories.reduce((sum, c) => sum + (c.errors ?? 0), 0);
  console.log(
    `[sync-council-data] 完了: カテゴリ数=${report.categories.length} 合計エラー=${totalErrors} 429=${fetchStats.count429} 403=${fetchStats.count403} 5xx=${fetchStats.count5xx}`
  );
  console.log("SYNC_RAN=true");

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const lines = [
      "## 延岡市議会 自動巡回レポート",
      "",
      `- 実行日時: ${report.runAt}`,
      `- 実行理由: ${gate.reason}`,
      `- 前回正常実行からの経過: ${gate.hoursSinceLast === null ? "記録なし" : gate.hoursSinceLast.toFixed(1) + "時間"}`,
      "",
      "| カテゴリ | 検出 | 新規 | 更新 | 変更なし | 削除疑い | 要確認 | エラー |",
      "|---|---|---|---|---|---|---|---|",
      ...report.categories
        .filter((c) => c.status === "ok")
        .map(
          (c) =>
            `| ${c.categoryLabel} | ${c.detected ?? "-"} | ${c.new ?? "-"} | ${c.updated ?? "-"} | ${c.unchanged ?? "-"} | ${(c.removedSuspected ?? 0) + (c.urlChangeSuspected ?? 0)} | ${c.needsReview ?? 0} | ${c.errors ?? 0} |`
        ),
      "",
      `- 429/403/5xx: ${fetchStats.count429}/${fetchStats.count403}/${fetchStats.count5xx}`,
      "",
      "### 対象外・未確認のカテゴリ",
      ...report.unavailableCategories.map((c) => `- **${c.categoryLabel}**（${c.status}）: ${c.note}`),
      "",
    ];
    try {
      writeFileSync(summaryPath, `${lines.join("\n")}\n`, { flag: "a" });
    } catch {
      // Step Summaryへの書き込み失敗は致命的ではないため無視する。
    }
  }
}

main().catch((e) => {
  console.error(`[sync-council-data] 予期しないエラーで中止しました: ${e.stack ?? e.message}`);
  console.log("SYNC_RAN=error");
  process.exitCode = 1;
});

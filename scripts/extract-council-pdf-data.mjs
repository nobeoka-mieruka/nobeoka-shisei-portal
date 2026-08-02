/**
 * public/council-documents/ 配下の「審議結果」PDFの本文から、議案・意見書・決議・
 * 請願・陳情の議案番号／件名／結果／議決日を抽出し、src/data/billVotes.json へ反映する。
 *
 * 重要な制約（必ず理解した上で使うこと）：
 * このスクリプトが対象とする「議案等審議結果」PDFには、議員個人の賛否（誰が賛成・反対したか）は
 * 記載されていない。掲載されているのは案件ごとの審議結果（原案可決／否決／認定 等）のみ。
 * そのため、このスクリプトは memberVotes（議員別賛否）を一切生成しない。
 * 議員別賛否の抽出には、会議録など別の資料が必要（将来の拡張課題）。
 *
 * 安全のための基本方針：
 * - 抽出結果が明確（議案番号・件名・既知の結果キーワード・議決日のいずれも問題なし）な場合のみ
 *   publicationStatus: "published" として自動公開する。
 * - 少しでも不確実な場合は publicationStatus: "pendingReview" とし、一般公開ページには出さない。
 * - 人が既に確認・入力した既存データ（extractionSourceが"automatic"以外）は絶対に上書きしない。
 * - 既存データを削除することはない（追加・更新保留のみ）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdfText } from "./lib/pdf-text.mjs";
import { extractRecordsFromPage, buildProposalId } from "./lib/council-bill-extraction.mjs";
import { sha256OfBuffer } from "./lib/council-shared.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const sessionsPath = join(root, "src", "data", "councilSessions.json");
const billVotesPath = join(root, "src", "data", "billVotes.json");
const ledgerPath = join(root, "src", "data", "councilExtractionSources.json");
const updateHistoryPath = join(root, "src", "data", "updateHistory.json");
const reportsDir = join(root, "reports");
const reportJsonPath = join(reportsDir, "council-extraction-review.json");
const reportMdPath = join(reportsDir, "council-extraction-review.md");

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const sessionFilter = args.find((a) => a.startsWith("--session="))?.split("=")[1];
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : undefined;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}
function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
function fiscalYearLabel(fiscalYear) {
  return `令和${fiscalYear - 2018}年度`;
}

async function main() {
  let sessions;
  let billVotes;
  try {
    sessions = readJson(sessionsPath, []);
    if (!Array.isArray(sessions)) throw new Error("councilSessions.jsonが配列ではありません");
  } catch (e) {
    console.error(`[extract-council-data] councilSessions.jsonの読み込みに失敗しました。中止します: ${e.message}`);
    process.exitCode = 1;
    return;
  }
  try {
    billVotes = readJson(billVotesPath, []);
    if (!Array.isArray(billVotes)) throw new Error("billVotes.jsonが配列ではありません");
  } catch (e) {
    console.error(`[extract-council-data] billVotes.jsonの読み込みに失敗しました。中止します: ${e.message}`);
    process.exitCode = 1;
    return;
  }
  const billVotesById = new Map(billVotes.map((b) => [b.id, b]));
  const ledger = readJson(ledgerPath, []);
  const ledgerByFilePath = new Map(ledger.map((l) => [l.filePath, l]));

  // --- 対象PDFの選定：公開済み(published)のresultsカテゴリ・ローカル保存資料のみ ---
  let candidates = [];
  for (const session of sessions) {
    if (sessionFilter && session.id !== sessionFilter) continue;
    for (const doc of session.documents ?? []) {
      if (doc.category !== "results" || doc.storageType !== "local") continue;
      if (doc.publicationStatus && doc.publicationStatus !== "published") continue;
      candidates.push({ session, doc });
    }
  }
  // 未処理（台帳にfileHashの記録がない、または内容が変わった）ものを優先する。
  candidates.sort((a, b) => a.session.id.localeCompare(b.session.id));

  const report = {
    checkedAt: new Date().toISOString(),
    dryRun: isDryRun,
    sessionFilter: sessionFilter ?? null,
    limit: limit ?? null,
    documentsProcessed: 0,
    documentsSkippedUnchanged: 0,
    documentsOcrRequired: 0,
    documentsError: 0,
    proposalsExtracted: 0,
    proposalsPublished: 0,
    proposalsPendingReview: 0,
    proposalsUpdatedPendingReview: 0,
    proposalsUnchanged: 0,
    proposalsConflict: 0,
    memberVoteNote:
      "このPDF（議案等審議結果）には議員個人の賛否は記載されていないため、議員別賛否（memberVotes）は抽出していません。",
    items: [],
  };

  let processedCount = 0;
  for (const { session, doc } of candidates) {
    if (limit !== undefined && processedCount >= limit) break;

    const absPath = join(root, "public", doc.filePath.replace(/^\//, ""));
    if (!existsSync(absPath)) {
      console.error(`[extract-council-data] ファイルが見つかりません（スキップ）: ${doc.filePath}`);
      report.documentsError++;
      continue;
    }
    const fileBuffer = readFileSync(absPath);
    const fileHash = sha256OfBuffer(fileBuffer);
    const ledgerEntry = ledgerByFilePath.get(doc.filePath);
    const forceReprocess = !!sessionFilter; // --session指定時は検証目的で明示的に再処理を許可する
    if (!forceReprocess && ledgerEntry?.fileHash === fileHash) {
      report.documentsSkippedUnchanged++;
      continue;
    }

    processedCount++;
    report.documentsProcessed++;

    let extraction;
    try {
      extraction = await extractPdfText(absPath);
    } catch (e) {
      console.error(`[extract-council-data] PDF解析エラー（スキップ）: ${doc.filePath} - ${e.message}`);
      report.documentsError++;
      continue;
    }

    if (extraction.ocrRequired) {
      report.documentsOcrRequired++;
      console.warn(`[extract-council-data] 文字情報が乏しいためOCRが必要です: ${doc.filePath}`);
      if (!isDryRun) {
        doc.textExtractionStatus = "ocrRequired";
        doc.textExtractedAt = todayIso();
      }
      continue;
    }

    let records = [];
    for (const page of extraction.pages) {
      records = records.concat(extractRecordsFromPage(page.normalizedText, session.year, page.pageNumber));
    }
    report.proposalsExtracted += records.length;

    for (const record of records) {
      const id = buildProposalId(session.id, record.recordType, record.proposalNumRaw);
      const existing = billVotesById.get(id);
      const isClean = record.unresolvedReasons.length === 0;

      const candidateFields = {
        id,
        fiscalYear: fiscalYearLabel(session.fiscalYear),
        session: session.title,
        billNumber: record.billNumber,
        billTitle: record.title ?? "",
        summary: "概要は確認中です。詳細は出典PDFをご確認ください。",
        votingDate: record.votingDate ?? undefined,
        result: record.result ?? "確認中",
        category: record.category,
        memberVotes: [],
        sessionId: session.id,
        sourceDocumentId: doc.id,
        sourceFilePath: doc.filePath,
        sourcePage: record.pageNumber,
        resultDocumentUrl: doc.sourceUrl,
        extractionSource: "automatic",
        extractionConfidence: isClean ? 0.95 : 0.4,
        extractionNotes: record.unresolvedReasons.length > 0 ? record.unresolvedReasons.join("; ") : undefined,
        extractedAt: todayIso(),
        lastVerified: todayIso(),
      };

      if (!existing) {
        candidateFields.publicationStatus = isClean ? "published" : "pendingReview";
        billVotes.push(candidateFields);
        billVotesById.set(id, candidateFields);
        if (candidateFields.publicationStatus === "published") report.proposalsPublished++;
        else report.proposalsPendingReview++;
        report.items.push({ id, session: session.id, billNumber: record.billNumber, title: record.title, outcome: "new", publicationStatus: candidateFields.publicationStatus, reasons: record.unresolvedReasons });
        continue;
      }

      // 既に人が確認・入力したデータ（自動抽出由来ではない）は絶対に上書きしない。
      if (existing.extractionSource !== "automatic") {
        const changed = existing.result !== candidateFields.result || existing.votingDate !== candidateFields.votingDate;
        if (changed) {
          report.proposalsConflict++;
          report.items.push({
            id,
            session: session.id,
            billNumber: record.billNumber,
            title: record.title,
            outcome: "conflict-with-manual-data",
            reasons: ["既存の確認済みデータと抽出結果が異なるため、自動更新しませんでした（人による再確認が必要です）"],
          });
        } else {
          report.proposalsUnchanged++;
        }
        continue;
      }

      // 以前も自動抽出で登録されたデータ：内容が変わっていなければ何もしない。
      const unchanged =
        existing.result === candidateFields.result &&
        existing.votingDate === candidateFields.votingDate &&
        existing.billTitle === candidateFields.billTitle;
      if (unchanged) {
        report.proposalsUnchanged++;
        continue;
      }

      Object.assign(existing, candidateFields);
      existing.publicationStatus = isClean ? "updatedPendingReview" : "pendingReview";
      report.proposalsUpdatedPendingReview++;
      report.items.push({ id, session: session.id, billNumber: record.billNumber, title: record.title, outcome: "updated", publicationStatus: existing.publicationStatus, reasons: record.unresolvedReasons });
    }

    if (!isDryRun) {
      doc.textExtractionStatus = "extracted";
      doc.textExtractedAt = todayIso();
      const entry = ledgerByFilePath.get(doc.filePath);
      if (entry) {
        entry.fileHash = fileHash;
        entry.extractedAt = todayIso();
        entry.recordCount = records.length;
      } else {
        const newEntry = { filePath: doc.filePath, fileHash, extractedAt: todayIso(), recordCount: records.length };
        ledger.push(newEntry);
        ledgerByFilePath.set(doc.filePath, newEntry);
      }
    }
  }

  if (!isDryRun) {
    writeJson(sessionsPath, sessions);
    writeJson(billVotesPath, billVotes);
    writeJson(ledgerPath, ledger);
    appendUpdateHistoryIfNeeded(report, sessions);
  }

  mkdirSync(reportsDir, { recursive: true });
  writeJson(reportJsonPath, report);
  writeFileSync(reportMdPath, buildMarkdownReport(report), "utf8");

  printSummary(report);
}

/**
 * 1回の実行（1日1回のGitHub Actions）で複数の定例会分をまとめて処理することがあるため、
 * セッションごとに個別のエントリを作らず、実行1回につき1件の更新履歴にまとめる
 * （更新履歴ページが同日付のエントリで埋め尽くされるのを防ぐため）。
 */
function appendUpdateHistoryIfNeeded(report, sessions) {
  const publishedNew = report.items.filter((i) => i.outcome === "new" && i.publicationStatus === "published");
  if (publishedNew.length === 0) return;

  const sessionIds = [...new Set(publishedNew.map((i) => i.session))];
  const sessionTitles = sessionIds.map((id) => sessions.find((s) => s.id === id)?.title ?? id);

  const history = readJson(updateHistoryPath, []);
  const nextNum =
    history.reduce((max, h) => {
      const m = /^u(\d+)$/.exec(h.id ?? "");
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0) + 1;

  const title =
    sessionIds.length === 1
      ? `${sessionTitles[0]}の議案審議結果を追加しました（${publishedNew.length}件）`
      : `議案審議結果を追加しました（${sessionIds.length}定例会・臨時会分、合計${publishedNew.length}件）`;
  if (history.some((h) => h.date === todayIso() && h.title === title)) return;

  history.unshift({
    id: `u${nextNum}`,
    date: todayIso(),
    title,
    description: `延岡市議会の審議結果PDFから、議案番号・件名・結果・議決日を自動抽出し「議案ごとの賛否」ページへ追加しました（対象：${sessionTitles.join("、")}）。議員個人の賛否は、公式資料で確認できる場合に別途登録します。`,
    targetPages: ["議案ごとの賛否"],
    category: "議案・表決",
    type: "automatic",
    linkUrl: "/bills/votes",
    linkLabel: "議案ごとの賛否を見る",
  });
  writeJson(updateHistoryPath, history);
}

function buildMarkdownReport(report) {
  const lines = [
    "# 議案・表決データ 自動抽出レポート",
    "",
    `- 確認日時: ${report.checkedAt}`,
    `- dry-run: ${report.dryRun}`,
    `- 対象定例会: ${report.sessionFilter ?? "全件"}`,
    `- 処理PDF数: ${report.documentsProcessed}（変更なしスキップ: ${report.documentsSkippedUnchanged} / OCR要: ${report.documentsOcrRequired} / エラー: ${report.documentsError}）`,
    `- 抽出件数: ${report.proposalsExtracted}`,
    `- 公開: ${report.proposalsPublished} / 確認待ち: ${report.proposalsPendingReview} / 更新確認待ち: ${report.proposalsUpdatedPendingReview} / 変更なし: ${report.proposalsUnchanged} / 手動データとの不一致: ${report.proposalsConflict}`,
    "",
    `> ${report.memberVoteNote}`,
    "",
    "## 個別案件",
    "",
    "| ID | 定例会 | 議案番号 | 件名 | 状態 | 理由 |",
    "|---|---|---|---|---|---|",
  ];
  for (const item of report.items) {
    lines.push(
      `| ${item.id} | ${item.session} | ${item.billNumber} | ${item.title ?? ""} | ${item.outcome}${item.publicationStatus ? `(${item.publicationStatus})` : ""} | ${(item.reasons ?? []).join("; ")} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function printSummary(report) {
  console.log(
    `[extract-council-data] PDF処理=${report.documentsProcessed}（スキップ=${report.documentsSkippedUnchanged} OCR要=${report.documentsOcrRequired} エラー=${report.documentsError}） 抽出=${report.proposalsExtracted}`,
  );
  console.log(
    `[extract-council-data] 公開=${report.proposalsPublished} 確認待ち=${report.proposalsPendingReview} 更新確認待ち=${report.proposalsUpdatedPendingReview} 変更なし=${report.proposalsUnchanged} 手動データ不一致=${report.proposalsConflict}`,
  );
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      writeFileSync(summaryPath, `\n${buildMarkdownReport(report)}\n`, { flag: "a" });
    } catch {
      // Step Summaryへの書き込みに失敗しても、reports/への保存は既に完了しているので継続する。
    }
  }
}

main().catch((e) => {
  console.error(`[extract-council-data] 予期しないエラーで中止しました: ${e.stack ?? e.message}`);
  process.exitCode = 1;
});

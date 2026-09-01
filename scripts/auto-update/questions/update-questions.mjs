#!/usr/bin/env node
/**
 * 自動更新パイプライン（Workstream B：一般質問 質問通告書）。
 *
 * 【重要：既存資産の再利用・重複実装の禁止】
 * 延岡市議会公式サイトの巡回（一覧ページ取得・HTML解析・PDFの新規/変更/削除判定・
 * 差分検知・リトライ・タイムアウト・rate limit・ドメイン許可リスト検証）は、すべて既存の
 * scripts/sync-council-data.mjs（5日ごとの本番巡回スクリプト。一般質問 質問通告一覧
 * （/site/gikai/1416.html → 最新会期の通告一覧ページ）を既に取得・解析している）を
 * dry-runモードでサブプロセス実行して再利用する。このスクリプト自身は
 * HTML取得・スクレイピングロジックを一切持たない（bills/update-bills.mjsが
 * fetch-nobeoka-council-documents.mjsをサブプロセス実行する方式と同じ設計）。
 *
 * このスクリプトが新規に追加するのは以下の4点のみ：
 *   1. 基底スクリプト（sync-council-data.mjs）のdry-run結果と、既存のスナップショット
 *      （src/data/councilWatchedDocuments.json、category="question-notice"。読み取りのみ）を
 *      突き合わせ、各質問通告書PDFについて「予定質問（generalQuestions.json）として
 *      既に登録済みか／未登録（新規候補）か／内容差分ありか／公式サイトから見えなくなったか」
 *      を判定する（登録の書き込みは一切行わない）。
 *   2. 新規候補（generalQuestions.jsonに未登録）についてのみ、実際にGETリクエストで
 *      到達性とハッシュを確認する（本番JSONへの書き込みは行わない。読み取りのみ）。
 *   3. スキーマ検証（sessionId形式・sourceUrlのドメイン・必須フィールド） … core/validate.mjs
 *   4. GREEN/YELLOW/RED判定・サーキットブレーカー・統一レポート出力
 *      … core/classify.mjs, core/report.mjs
 *
 * 【業務ルール：「予定」と「確認済み」を絶対に混同しない】
 * src/lib/generalQuestionStats.tsの冒頭コメントの通り、本サイトでは
 *   - 予定（generalQuestions.json）＝質問通告書のみに基づく、会議録未公開の質問予告
 *   - 確認済み（councilSpeechSummaries.json）＝会議録本文を実際に読んで確認した質問
 * を明確に区別している。このUpdaterは次を徹底する。
 *   - 新規に検出した質問通告書は、常に「予定質問の追加候補」としてのみ扱う。
 *     このスクリプトが「確認済み」へ昇格させる処理は一切実装しない（会議録本文の
 *     解釈・質問項目の抽出・答弁の紐付けは行わない。それらはAI推定であり自動反映しない）。
 *   - 通告書が検出された会期が、src/data/questionCollectionStatus.json上で
 *     既に会議録確認済み（transcriptAvailable:true）の場合は、予定/確認済みの
 *     境界があいまいな状態であるとみなし、anomalyDetected扱いで必ずRED（自動反映対象外）とする。
 *   - 質問通告書の「話者（議員）自動特定」ができていない場合（speakerIdentificationStatus
 *     が"confirmed"でない）も、常に人間確認（YELLOW以上）とする。
 *
 * 本番データ（src/data/generalQuestions.json、src/data/councilSpeechSummaries.json、
 * src/data/councilWatchedDocuments.json等）は一切書き換えない（dry-runのみで完結する）。
 *
 * 使い方: node scripts/auto-update/questions/update-questions.mjs [--verbose]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fetchWithRetry } from "../core/fetch.mjs";
import { classifyItem, checkCircuitBreaker } from "../core/classify.mjs";
import { validateEntry } from "../core/validate.mjs";
import { writeRunReport, updateStatus, ROOT } from "../core/report.mjs";
import { sha256OfBuffer } from "../../lib/council-shared.mjs";

const TARGET = "questions";
const ALLOWED_HOSTS = new Set(["www.city.nobeoka.miyazaki.jp", "city.nobeoka.miyazaki.jp"]);
const PARSER_VERSION = "sync-council-data.mjs(question-notice)@2026-08+update-questions.mjs@2026-08-cross-check-v1";
const INDEX_URL_FALLBACK = "https://www.city.nobeoka.miyazaki.jp/site/gikai/1416.html";
// council-shared.mjsのeraYearFor / parseEraFiscalYearHeadingと同じ令和換算式（令和1年=2019年）。
const REIWA_START_YEAR = 2019;

const verbose = process.argv.includes("--verbose");
function log(...args) {
  if (verbose) console.log(...args);
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.warn(`[update-questions] JSON読み込みに失敗（fallbackを使用）: ${path} - ${e.message}`);
    return fallback;
  }
}

/**
 * 既存本番スクリプト（sync-council-data.mjs）をdry-runでサブプロセス実行する。
 * 取得・HTML解析ロジックはこのスクリプトに一切持たず、既存資産をそのまま呼び出すのみ。
 */
function runBaseSyncDryRun() {
  const scriptPath = join(ROOT, "scripts", "sync-council-data.mjs");
  let stdout = "";
  let exitCode = 0;
  try {
    stdout = execFileSync("node", [scriptPath, "--dry-run"], { cwd: ROOT, encoding: "utf8", timeout: 120000 });
  } catch (e) {
    stdout = (e.stdout ?? "") + (e.stderr ?? "");
    exitCode = e.status ?? 1;
  }
  const reportPath = join(ROOT, "reports", "sync-council-data-report.json");
  const baseReport = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : null;
  return { stdout, exitCode, baseReport };
}

/**
 * councilWatchedDocuments.json（category="question-notice"）のtitle文字列から
 * 会期ID・質問日・会期名を導出する。
 * title例："第26回延岡市議会(令和8年6月定例会)（6月23日 個人質問）"
 *
 * 【重要】これはsync-council-data.mjsが既にHTMLから抽出・保存済みのtitle文字列を
 * 再パースするだけであり、公式サイトのHTML構造そのものを取得・解析するロジックの
 * 再実装ではない（HTML取得・スクレイピングの重複実装を避けるための最小限のテキスト処理）。
 */
export function deriveSessionInfo(title) {
  if (typeof title !== "string") return null;
  const dayMatch = title.match(/（(\d{1,2})月(\d{1,2})日\s*個人質問）\s*$/);
  const sessionMatch = title.match(/令和(\d+)年(\d{1,2})月(定例会|臨時会)/);
  if (!dayMatch || !sessionMatch) return null;
  const qMonth = Number(dayMatch[1]);
  const qDay = Number(dayMatch[2]);
  const eraNum = Number(sessionMatch[1]);
  const sessionMonth = Number(sessionMatch[2]);
  const isExtraordinary = sessionMatch[3] === "臨時会";
  const year = REIWA_START_YEAR + eraNum - 1;
  const sessionId = `${year}-${String(sessionMonth).padStart(2, "0")}${isExtraordinary ? "-extraordinary" : ""}`;
  const questionDate = `${year}-${String(qMonth).padStart(2, "0")}-${String(qDay).padStart(2, "0")}`;
  const sessionName = `令和${eraNum}年${sessionMonth}月${isExtraordinary ? "臨時会" : "定例会"}`;
  return { sessionId, questionDate, sessionName };
}

/**
 * 質問通告書1件分について、outcome（new/updated/unchanged/removed_candidate）・
 * 「予定」と「確認済み」の混同防止のための異常検知（anomalyDetected）・人間確認要否を
 * 判定する（I/O・非同期処理を一切含まない純粋関数）。
 *
 * 【回帰テストの主対象】この関数は「会議録公開後、質問通告書だけで確認済み（登壇済み）へ
 * 昇格してしまわないこと」を保証する中核ロジックであり、scripts/test-question-notice-lifecycle.mjs
 * から直接呼び出して検証する。会議録公開後の安全な遷移は、
 *   1. questionCollectionStatus.jsonの該当会期がtranscriptAvailable:trueになる
 *   2. その状態で該当会期の質問通告書を検出すると、本関数がanomalyDetected=trueを返し、
 *      classifyItem()が無条件でRED（自動反映対象外）にする
 *   3. 人間が会議録本文を確認し、councilSpeechSummaries.jsonへ手動で追加登録する
 *      （このパイプラインはconfirmed側のデータへは一切書き込まない）
 * という3段階を経る設計である。
 */
export function evaluateQuestionNoticeRecord(record, { generalQuestionsByUrl, transcriptAvailableSessionIds, memberIdSet, allowedHosts }) {
  const sessionInfo = deriveSessionInfo(record.title);

  const validationEntryObj = {
    sourceUrl: record.sourceUrl,
    sessionId: sessionInfo?.sessionId ?? null,
    memberName: record.memberName,
    questionDate: sessionInfo?.questionDate ?? null,
    title: record.title,
  };
  const validation = validateEntry(validationEntryObj, {
    allowedHosts,
    requiredFields: ["memberName", "questionDate", "title"],
  });

  const memberIdKnown = record.memberId !== null && record.memberId !== undefined;
  const memberIdValid = !memberIdKnown || memberIdSet.has(record.memberId);

  let outcome;
  const mismatches = [];
  if (record.status !== "published") {
    outcome = "removed_candidate";
  } else {
    const gq = generalQuestionsByUrl.get(record.sourceUrl);
    if (!gq) {
      outcome = "new";
    } else {
      if (gq.memberId !== record.memberId) {
        mismatches.push(`memberId不一致（登録済み予定質問:${gq.memberId} / 今回検出:${record.memberId}）`);
      }
      if (sessionInfo && gq.sessionName !== sessionInfo.sessionName) {
        mismatches.push(`sessionName不一致（登録済み予定質問:${gq.sessionName} / 今回検出:${sessionInfo.sessionName}）`);
      }
      if (sessionInfo && gq.questionDate !== sessionInfo.questionDate) {
        mismatches.push(`questionDate不一致（登録済み予定質問:${gq.questionDate} / 今回検出:${sessionInfo.questionDate}）`);
      }
      outcome = mismatches.length > 0 ? "updated" : "unchanged";
    }
  }

  const sessionTranscriptAlreadyPublic = sessionInfo ? transcriptAvailableSessionIds.has(sessionInfo.sessionId) : false;

  const anomalyDetected = sessionTranscriptAlreadyPublic || (memberIdKnown && !memberIdValid);
  const anomalyReason = sessionTranscriptAlreadyPublic
    ? `検出会期(${sessionInfo?.sessionId})はquestionCollectionStatus.json上で既にtranscriptAvailable=true（会議録確認済み）。予定質問の通告書検出と確認済み会期が重複しており、「予定」と「確認済み」の混同防止のため自動反映不可`
    : memberIdKnown && !memberIdValid
      ? `memberId(${record.memberId})がmembers.jsonに存在しない`
      : undefined;

  const requiresHumanReview =
    outcome === "new" ||
    outcome === "updated" ||
    outcome === "removed_candidate" ||
    record.speakerIdentificationStatus !== "confirmed";
  const humanReviewReason =
    outcome === "new"
      ? "新規検出の質問通告書。予定質問（generalQuestions.json）として追加する前に人間確認が必要（会議録は未公開のため確認済みへの昇格は行わない）"
      : outcome === "updated"
        ? `既存の予定質問登録内容と差分あり: ${mismatches.join("; ")}`
        : outcome === "removed_candidate"
          ? undefined // classify.mjs内でoutcome==="removed_candidate"は無条件YELLOW固定文言になる
          : record.speakerIdentificationStatus !== "confirmed"
            ? `質問者（議員）の自動特定ができていない通告書（speakerIdentificationStatus=${record.speakerIdentificationStatus}）`
            : undefined;

  return {
    sessionInfo,
    validation,
    memberIdKnown,
    memberIdValid,
    outcome,
    mismatches,
    sessionTranscriptAlreadyPublic,
    anomalyDetected,
    anomalyReason,
    requiresHumanReview,
    humanReviewReason,
  };
}

/** 新規候補（generalQuestions.json未登録）についてのみ、実到達性・ハッシュを確認する（保存はしない）。 */
async function probeNewDocument(sourceUrl) {
  try {
    const res = await fetchWithRetry(sourceUrl, { allowedHosts: ALLOWED_HOSTS, maxRetries: 2 });
    const buf = Buffer.from(await res.arrayBuffer());
    return { httpStatus: res.status, contentHash: res.ok ? sha256OfBuffer(buf) : null, error: null };
  } catch (e) {
    return { httpStatus: null, contentHash: null, error: e.message };
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[update-questions] 開始: ${startedAt}`);

  const { stdout, exitCode, baseReport } = runBaseSyncDryRun();
  log(stdout);

  if (exitCode !== 0 || !baseReport) {
    const report = {
      target: TARGET,
      startedAt,
      finishedAt: new Date().toISOString(),
      dryRun: true,
      baseScriptExitCode: exitCode,
      overallLevel: "RED",
      summary: { detected: 0, green: 0, yellow: 0, red: 0, error: 1 },
      entries: [],
      circuitBreakerTripped: false,
      circuitBreakerReason: null,
      note: "基底スクリプト（sync-council-data.mjs）が異常終了しました。詳細はbaseScriptOutputを参照。",
      baseScriptOutput: stdout,
    };
    const outPath = writeRunReport(report);
    updateStatus(TARGET, report);
    console.error(`[update-questions] 基底スクリプトが異常終了しました（exitCode=${exitCode}）。RUN全体をREDとして記録: ${outPath}`);
    process.exitCode = 1;
    return;
  }

  const qnCategory = baseReport.categories?.find((c) => c.category === "question-notice") ?? null;
  const baseGateRan = baseReport.ran !== false;

  // 既存データ（読み取りのみ。本番JSONへの書き込みは一切行わない）。
  const members = readJson(join(ROOT, "src", "data", "members.json"), []);
  const generalQuestions = readJson(join(ROOT, "src", "data", "generalQuestions.json"), []);
  const watchedDocuments = readJson(join(ROOT, "src", "data", "councilWatchedDocuments.json"), []);
  const questionCollectionStatus = readJson(join(ROOT, "src", "data", "questionCollectionStatus.json"), { sessions: [] });

  const memberIdSet = new Set(members.map((m) => m.id));
  const generalQuestionsByUrl = new Map(generalQuestions.map((q) => [q.sourceUrl, q]));
  const transcriptAvailableSessionIds = new Set(
    questionCollectionStatus.sessions.filter((s) => s.transcriptAvailable === true).map((s) => s.sessionId),
  );
  const questionNoticeRecords = watchedDocuments.filter((r) => r.category === "question-notice");
  const indexState = watchedDocuments.find((r) => r.id === "question-notice-index-state");

  const classifiedEntries = [];
  for (const record of questionNoticeRecords) {
    const {
      sessionInfo,
      validation,
      outcome,
      anomalyDetected,
      anomalyReason,
      requiresHumanReview,
      humanReviewReason,
    } = evaluateQuestionNoticeRecord(record, {
      generalQuestionsByUrl,
      transcriptAvailableSessionIds,
      memberIdSet,
      allowedHosts: ALLOWED_HOSTS,
    });

    let probe = null;
    let reachable;
    let httpStatus = null;
    let contentHash = record.fileHash ?? null;
    let extractionStatus;

    if (outcome === "removed_candidate") {
      reachable = null;
      extractionStatus = "unknown（前回巡回時点で公式サイト上に確認できず。削除自体は行っていない）";
    } else if (outcome === "new") {
      console.log(`[update-questions] 新規検出（予定質問未登録）の質問通告書への到達確認: ${record.sourceUrl}`);
      probe = await probeNewDocument(record.sourceUrl);
      reachable = probe.error === null && probe.httpStatus !== null;
      httpStatus = probe.httpStatus;
      contentHash = probe.contentHash ?? record.fileHash ?? null;
      extractionStatus = "detected（新規。schema検証・到達確認のみ実施。会議録本文の解釈・質問項目抽出は行っていない）";
    } else {
      // unchanged / updated: 既存fileHash（councilWatchedDocuments.json、直近の本番巡回時点）で差分照合する。
      // 公式サーバー負荷対策のため、既知資料を今回あらためて再ダウンロードすることはしない。
      reachable = true;
      httpStatus = null;
      extractionStatus = "not_reextracted（既存fileHashによる差分照合のみ。公式サーバー負荷対策のため再取得していない）";
    }

    const result = classifyItem({
      schemaValid: validation.valid,
      schemaErrors: validation.errors,
      outcome,
      isOfficialPrimarySource: true, // 延岡市議会公式サイト（sync-council-data.mjsの許可ホストのみ対象）
      reachable,
      httpStatus,
      requiresHumanReview,
      humanReviewReason,
      anomalyDetected,
      anomalyReason,
    });

    classifiedEntries.push({
      sourceUrl: record.sourceUrl,
      sourceType: "一般質問（総括質疑及び一般質問）通告書PDF（延岡市議会公式）",
      sessionId: sessionInfo?.sessionId ?? null,
      outcome,
      lastCheckedAt: startedAt,
      httpStatus,
      contentHash,
      parserVersion: PARSER_VERSION,
      extractionStatus,
      validationStatus: validation.valid ? "schema_valid" : "schema_invalid",
      validationErrors: validation.errors,
      level: result.level,
      reason: result.reason,
    });
  }

  // sync-council-data.mjsのdry-runは、質問通告一覧について「新規/更新の件数」のみを報告し、
  // 個別URLはdry-run時に保存しない仕様（公式サーバー負荷対策：dry-run中は新規PDFの再取得を行わないため）。
  // このUpdaterはsync-council-data.mjsを書き換えないため、この制限をそのまま受け入れ、
  // 検出漏れの可能性がある場合は正直にnoteへ記載し、GREEN確定を避ける。
  let baseDetectionGapNote = null;
  if (qnCategory && qnCategory.status === "ok" && ((qnCategory.new ?? 0) > 0 || (qnCategory.updated ?? 0) > 0)) {
    baseDetectionGapNote =
      `基底スクリプト（sync-council-data.mjs）のdry-run結果で新規${qnCategory.new ?? 0}件・更新${qnCategory.updated ?? 0}件を` +
      "検出していますが、同スクリプトのdry-runモードは質問通告一覧について新規/更新の個別URLを保存しない仕様のため、" +
      "このレポートのentriesには反映されていません（照合対象は前回の本番巡回時点のスナップショット" +
      "＝src/data/councilWatchedDocuments.jsonのままです）。sync-council-data.mjsを本番実行（非dry-run）して" +
      "台帳を更新した後、本Updaterを再実行して照合してください。";
    console.warn(`[update-questions] ${baseDetectionGapNote}`);
  }

  let baseCategoryErrorNote = null;
  if (qnCategory && qnCategory.status !== "ok") {
    baseCategoryErrorNote = `基底スクリプトの質問通告一覧取得がstatus="${qnCategory.status}"（正常以外）でした。詳細: ${qnCategory.error ?? qnCategory.note ?? "詳細不明"}`;
  } else if (!qnCategory && baseGateRan) {
    baseCategoryErrorNote = "基底スクリプトのレポートにquestion-noticeカテゴリが見つかりませんでした（構造変化の可能性）。";
  }

  const summary = {
    detected: qnCategory?.detected ?? questionNoticeRecords.length,
    green: classifiedEntries.filter((e) => e.level === "GREEN").length,
    yellow: classifiedEntries.filter((e) => e.level === "YELLOW").length,
    red: classifiedEntries.filter((e) => e.level === "RED").length,
    error: 0,
  };

  const previousKnownTotal = questionNoticeRecords.filter((r) => r.status === "published").length;
  const circuitBreaker = checkCircuitBreaker({
    target: TARGET,
    newCount: classifiedEntries.filter((e) => e.outcome === "new").length,
    updatedCount: classifiedEntries.filter((e) => e.outcome === "updated").length,
    removedCandidateCount: classifiedEntries.filter((e) => e.outcome === "removed_candidate").length,
    detectedTotal: summary.detected,
    previousKnownTotal,
  });

  const overallLevel = circuitBreaker.tripped
    ? "RED"
    : baseCategoryErrorNote
      ? "RED"
      : summary.red > 0
        ? "RED"
        : summary.yellow > 0 || baseDetectionGapNote
          ? "YELLOW"
          : "GREEN";

  const watchedSource = qnCategory?.pageUrl ?? indexState?.sourceUrl ?? INDEX_URL_FALLBACK;

  const noteParts = [
    "dryRun=trueのため、本番データ（src/data/generalQuestions.json・src/data/councilSpeechSummaries.json・" +
      "src/data/councilWatchedDocuments.json等）への書き込みは一切行っていない。GREEN判定であっても、" +
      "このレポート自体が自動で本番反映を行うことはない（別途、明示的な本番実行コマンドと人間の承認、" +
      "およびAUTO_APPLY_GREENフラグの有効化が必要）。",
    "新規に検出した質問通告書は、常に「予定質問（generalQuestions.json）」の追加候補としてのみ扱っており、" +
      "会議録確認済み（councilSpeechSummaries.json）への昇格は本Updaterでは一切行わない。" +
      "会議録本文の解釈・質問項目の抽出・答弁の紐付けはAI推定であり、対象外（GREENにはしない）。",
  ];
  if (baseDetectionGapNote) noteParts.push(baseDetectionGapNote);
  if (baseCategoryErrorNote) noteParts.push(baseCategoryErrorNote);
  if (!baseGateRan) {
    noteParts.push(
      `基底スクリプト（sync-council-data.mjs）は120時間ゲートにより今回は巡回を実行しませんでした` +
        `（gateReason=${baseReport.gateReason}）。既存スナップショット（councilWatchedDocuments.json）のみで照合しています。`,
    );
  }

  const report = {
    target: TARGET,
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun: true,
    watchedSource,
    baseScriptExitCode: 0,
    overallLevel,
    summary,
    entries: classifiedEntries,
    circuitBreakerTripped: circuitBreaker.tripped,
    circuitBreakerReason: circuitBreaker.reason,
    note: noteParts.join(" "),
  };

  const outPath = writeRunReport(report);
  const status = updateStatus(TARGET, report);

  console.log(
    `[update-questions] 検出=${summary.detected} GREEN=${summary.green} YELLOW=${summary.yellow} RED=${summary.red} ERROR=${summary.error} ` +
      `総合判定=${overallLevel} サーキットブレーカー=${circuitBreaker.tripped ? "発動" : "正常"} 連続正常実行=${status.consecutiveSuccessfulRuns}`,
  );
  console.log(`[update-questions] レポート書き出し: ${outPath}`);
  process.exitCode = summary.red > 0 ? 1 : 0;
}

// `node scripts/auto-update/questions/update-questions.mjs`として直接実行された場合のみ本処理を
// 実行する（scripts/test-question-notice-lifecycle.mjs等から deriveSessionInfo /
// evaluateQuestionNoticeRecord のみをimportして使う場合に、ネットワーク取得を伴う
// main()が副作用として実行されてしまわないようにするため）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

/**
 * councilSessions.json の各会期（定例会・臨時会）に、shortSummary・summary・summaryStatus・
 * summaryGeneratedAt・summaryVerifiedAt・summarySources を生成する。
 *
 * 生成に使うのは、既に登録済みの構造化データのみ（推測・本文抽出はしない）。
 *   - billVotes.json：この会期に属する議案（分類・議決結果・委員会・確認状況）
 *   - councilSessions.json：この会期に登録済みの資料（種類・公開状態）
 *   - generalQuestions.json：この会期の一般質問件数（sessionName一致で判定）
 *
 * 冪等：既存のsummaryが同じ内容であれば書き換えない（無駄な差分・再コミットを避ける）。
 *
 * 使い方：
 *   node scripts/generate-session-summaries.mjs [--dry-run] [--session=2026-06]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSessionSummary } from "./lib/session-summary.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sessionsPath = join(root, "src", "data", "councilSessions.json");
const billVotesPath = join(root, "src", "data", "billVotes.json");
const generalQuestionsPath = join(root, "src", "data", "generalQuestions.json");
/**
 * 一般質問が実際に行われたかどうかの判定に使う。
 * questionCollectionStatus.json へ登録済みの会期＝会議録・市議会だより等で開催を確認できた会期。
 * 未登録の会期の一般質問は質問通告書ベースの「予定」なので、「行われました」とは書かない。
 */
const questionCollectionStatusPath = join(root, "src", "data", "questionCollectionStatus.json");

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const sessionFilter = args.find((a) => a.startsWith("--session="))?.split("=")[1];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function sourcesEqual(a, b) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

function main() {
  if (!existsSync(sessionsPath)) throw new Error("src/data/councilSessions.json が見つかりません");
  const sessions = readJson(sessionsPath);
  const billVotes = existsSync(billVotesPath) ? readJson(billVotesPath) : [];
  const generalQuestions = existsSync(generalQuestionsPath) ? readJson(generalQuestionsPath) : [];
  const questionCollectionStatus = existsSync(questionCollectionStatusPath)
    ? readJson(questionCollectionStatusPath)
    : { sessions: [] };
  const heldQuestionSessionIds = new Set((questionCollectionStatus.sessions ?? []).map((s) => s.sessionId));

  let updated = 0;
  let unchanged = 0;
  let unavailable = 0;
  const today = todayIso();

  for (const session of sessions) {
    if (sessionFilter && session.id !== sessionFilter) continue;

    const bills = billVotes.filter((b) => b.sessionId === session.id || b.session === session.title);
    const generalQuestionCount = generalQuestions.filter((q) => q.sessionName === session.title).length;

    const result = buildSessionSummary(session, bills, generalQuestionCount, {
      generalQuestionsHeld: heldQuestionSessionIds.has(session.id),
    });

    if (result.summaryStatus === "unavailable") {
      unavailable++;
      if (session.summaryStatus !== "unavailable") {
        session.shortSummary = undefined;
        session.summary = undefined;
        session.summaryStatus = "unavailable";
        session.summaryGeneratedAt = today;
        session.summaryVerifiedAt = undefined;
        session.summarySources = undefined;
        updated++;
      } else {
        unchanged++;
      }
      continue;
    }

    const unchangedContent =
      session.summary === result.summary &&
      session.shortSummary === result.shortSummary &&
      session.summaryStatus === result.summaryStatus &&
      sourcesEqual(session.summarySources, result.sources);

    if (unchangedContent) {
      unchanged++;
      continue;
    }

    session.shortSummary = result.shortSummary;
    session.summary = result.summary;
    session.summaryStatus = result.summaryStatus;
    session.summaryGeneratedAt = today;
    session.summaryVerifiedAt = today;
    session.summarySources = result.sources.length > 0 ? result.sources : undefined;
    updated++;
  }

  console.log(
    `[generate-session-summaries] 対象: ${sessions.length}件 / 更新: ${updated}件 / 変更なし: ${unchanged}件 / 資料不足: ${unavailable}件`,
  );

  if (!isDryRun && updated > 0) {
    writeFileSync(sessionsPath, `${JSON.stringify(sessions, null, 2)}\n`, "utf8");
    console.log("[generate-session-summaries] src/data/councilSessions.json を更新しました。");
  } else if (isDryRun) {
    console.log("[generate-session-summaries] --dry-run のため、ファイルは書き換えていません。");
  }
}

main();

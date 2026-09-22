/**
 * 会期の要約が、会議録の公開状況を追い越して「一般質問が行われた」と書かないことを検証する。
 *
 * 会期の収録状況（questionCollectionStatus.json）への登録は「会期が閉会した」という意味で、
 * 「会議録を確認できた」という意味ではない。この2つを取り違えると、議決結果だけを取得した
 * 会期について「会期中には一般質問も行われました」と断定した要約が生成されてしまう。
 * 実際に2026-09-21の自動更新でそれが起きたため、回帰テストとして固定する。
 *
 * このプロジェクトには専用のテストランナーが無いため、既存のscripts/test-*.mjsと同じ
 * 「プレーンなNode＋assert」方式に揃えている。
 *
 * 使い方: node scripts/test-session-summary-transcript.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { buildSessionSummary } from "./lib/session-summary.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
const readSrc = (relPath) => readFileSync(join(ROOT, relPath), "utf8");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const sessions = readJson("src/data/councilSessions.json");
const collectionStatus = readJson("src/data/questionCollectionStatus.json");
const billsRaw = readJson("src/data/billVotes.json");
const bills = Array.isArray(billsRaw) ? billsRaw : billsRaw.billVotes;
const generalQuestions = readJson("src/data/generalQuestions.json");

const transcriptConfirmed = new Set(
  collectionStatus.sessions.filter((s) => s.transcriptAvailable === true).map((s) => s.sessionId),
);
const registered = new Set(collectionStatus.sessions.map((s) => s.sessionId));
const awaitingTranscript = [...registered].filter((id) => !transcriptConfirmed.has(id));

console.log(
  `\n会期の収録状況：登録${registered.size}会期／うち会議録を確認済み${transcriptConfirmed.size}会期` +
    `／会議録の公開待ち${awaitingTranscript.length}会期（実データから再計算）`,
);

check("会議録を確認できていない会期の要約に「一般質問も行われました」が入っていない", () => {
  const offenders = sessions.filter(
    (s) => !transcriptConfirmed.has(s.id) && /一般質問も行われました/.test(s.summary ?? ""),
  );
  assert.equal(
    offenders.length,
    0,
    `会議録が未確認なのに一般質問の実施を断定している会期: ${offenders.map((s) => s.title).join("、")}`,
  );
});

check("会議録の公開待ちの会期は、質問通告書の段階であることを要約で明示している", () => {
  for (const sessionId of awaitingTranscript) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session?.summary) continue;
    const scheduled = generalQuestions.filter((q) => q.sessionName === session.title);
    if (scheduled.length === 0) continue;
    assert.match(
      session.summary,
      /質問通告書で予定が公表されている段階/,
      `${session.title}の要約に、会議録の公開待ちであることが書かれていません`,
    );
  }
});

check("要約の生成が、収録対象への登録ではなく会議録の確認済みかどうかで判定している", () => {
  const src = readSrc("scripts/generate-session-summaries.mjs");
  assert.match(
    src,
    /transcriptAvailable === true/,
    "generate-session-summaries.mjs が transcriptAvailable で判定していません（登録の有無だけで判定すると断定表現になります）",
  );
});

/**
 * 故障注入：会議録が未確認の会期を「確認済み」として要約を作り直すと、
 * 一般質問の実施を断定する文言が入ってしまうことを確かめる。
 */
check("会議録が未確認の会期を確認済み扱いにすると断定表現になる（故障注入）", () => {
  const target = sessions.find((s) => awaitingTranscript.includes(s.id) && (s.documents ?? []).length > 0);
  if (!target) return;
  const sessionBills = bills.filter((b) => b.sessionId === target.id);
  const scheduled = generalQuestions.filter((q) => q.sessionName === target.title).length;
  const broken = buildSessionSummary(target, sessionBills, scheduled, { generalQuestionsHeld: true });
  const correct = buildSessionSummary(target, sessionBills, scheduled, { generalQuestionsHeld: false });
  assert.match(broken.summary, /一般質問も行われました/, "確認済み扱いにしても断定表現になりませんでした");
  assert.doesNotMatch(correct.summary, /一般質問も行われました/, "未確認扱いなのに断定表現が入っています");
  assert.equal(correct.summary, target.summary, "登録済みの要約が、未確認扱いで生成した要約と一致しません");
});

console.log(`\n${passCount}件成功\n`);

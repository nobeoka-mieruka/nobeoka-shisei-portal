/**
 * Phase136：市長公約「公約→施策→予算→議案→実施→成果」追跡データの整合性テスト。
 *
 * このプロジェクトには専用のテストランナー（vitest/jest等）が導入されていないため、
 * scripts/test-activity-radar.mjs・scripts/test-count-consistency.mjsと同じ
 * 「プレーンなNodeスクリプト＋assert」方式を踏襲する。
 *
 * validate-data.mjsが既に検証している項目（documentKey参照整合性・relatedBillVoteIds参照整合性・
 * ID重複・status/statusLabel整合性・確定ステータスの根拠資料必須等）は重複させず、
 * ここではPhase136で新たに追加した「予算→議案の追跡チェーン」に固有の整合性のみを検証する。
 *
 * 使い方: node scripts/test-mayor-promise-tracking.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const mayorPromises = readJson("src/data/mayorPromises.json");
const promises = mayorPromises.promises;
const measures = readJson("src/data/mayorPromiseMeasures.json");
const billVotes = readJson("src/data/billVotes.json");
const billIds = new Set(billVotes.map((b) => b.id));

console.log("\n公約データの現況（実データから再計算、固定値は使わない）");
console.log(`  公約数：${promises.length}件`);
console.log(`  個別施策（measures）数：${measures.length}件`);
console.log(`  relatedBudgetが「確認中」の完全一致文字列でない公約数：${promises.filter((p) => p.relatedBudget !== "確認中").length}件`);
console.log(`  relatedBillが「確認中」の完全一致文字列でない公約数：${promises.filter((p) => p.relatedBill !== "確認中").length}件`);
console.log(`  relatedBillVoteIdsを1件以上持つ公約数：${promises.filter((p) => (p.relatedBillVoteIds ?? []).length > 0).length}件`);

console.log("\n項目16：追跡チェーン固有の整合性チェック");

check("promiseId（公約ID）は全公約で重複が無く、mayorPromiseMeasures.jsonが参照するpromiseIdは全て実在する", () => {
  const promiseIds = new Set(promises.map((p) => p.id));
  assert.equal(promiseIds.size, promises.length, "mayorPromises.jsonにID重複があります");
  const missing = [...new Set(measures.map((m) => m.promiseId))].filter((id) => !promiseIds.has(id));
  assert.equal(missing.length, 0, `mayorPromiseMeasures.jsonが存在しない公約IDを参照しています: ${missing.join("、")}`);
});

check("relatedBillVoteIdsが参照する議案IDは全てbillVotes.jsonに実在する（存在しない議案IDへのリンク検知）", () => {
  const brokenRefs = [];
  for (const p of promises) {
    for (const billId of p.relatedBillVoteIds ?? []) {
      if (!billIds.has(billId)) brokenRefs.push(`${p.id} → ${billId}`);
    }
  }
  assert.equal(brokenRefs.length, 0, `存在しない議案IDへの参照があります: ${brokenRefs.join("、")}`);
});

check("relatedBillVoteIdsを持つ公約は、その議案の議案名（billTitle）に公約本文・進捗欄のいずれかと一致する固有名詞が含まれている（同じ年度というだけの理由での紐付けを禁止）", () => {
  // 「西階」のように、promiseText/progressSummaryに現れる施設名・事業名の断片が
  // 議案名に含まれているかを機械的にチェックする（完全一致までは求めないが、
  // 何の実在キーワードとも一致しない議案が紛れ込んでいないかを検知する）。
  for (const p of promises) {
    const billIdsForPromise = p.relatedBillVoteIds ?? [];
    if (billIdsForPromise.length === 0) continue;
    const searchableText = [p.promiseText, ...(p.progressSummary ?? [])].join(" ");
    // 日本語は分かち書きされないため、単語単位ではなく2文字の連続部分文字列（バイグラム）の
    // 一致を見る簡易実装。「西階野球場」と「西階公園...」のように送り仮名や接尾語が異なっても、
    // 固有名詞の断片（「西階」等）が共有されていれば一致を検知できる。
    const bigrams = (s) => {
      const kanjiKana = s.match(/[一-龠ァ-ヶー]+/g) ?? [];
      const out = [];
      for (const run of kanjiKana) for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
      return out;
    };
    const candidateKeywords = [...new Set(bigrams(searchableText))];
    for (const billId of billIdsForPromise) {
      const bill = billVotes.find((b) => b.id === billId);
      assert.ok(bill, `${billId}がbillVotes.jsonに見つかりません`);
      const matched = candidateKeywords.some((kw) => bill.billTitle.includes(kw));
      assert.ok(
        matched,
        `公約${p.id}に紐付けられた議案「${bill.billTitle}」（${billId}）が、公約本文・進捗欄のどの語句とも一致しません（キーワード類似のみでの紐付けの疑いがあります）`,
      );
    }
  }
});

check("relatedBudget・relatedBillは空文字列ではない（値そのものが欠落していないか）", () => {
  const blank = promises.filter((p) => !p.relatedBudget || !p.relatedBill);
  assert.equal(blank.length, 0, `relatedBudgetまたはrelatedBillが空の公約があります: ${blank.map((p) => p.id).join("、")}`);
});

check("項目13（二重計上防止）：同一の事業名＋予算額の組み合わせが、異なる複数の公約のrelatedBudgetへ重複登録されていない", () => {
  // relatedBudgetは自由記述文のため、文中の「事業名（令和8年度当初予算 N千円」というパターンを
  // 抽出し、同一の事業名＋金額が異なるpromiseIdで使われていないかを検知する。
  // 1つの公約内の複数施策（measures）が同じ予算事業を共有すること自体は許容するが、
  // 異なる公約のrelatedBudgetへ同じ事業名＋金額が「別予算」であるかのように重複記載されると、
  // 将来の合計額表示機能で二重計上（例：公約A 1億円＋公約B 1億円＝合計2億円という誤表示）に
  // つながるため、事前に検知する。
  const pattern = /([^\s、。（）]+事業)（令和\d+年度当初予算\s*[\d,]+千円/g;
  const seen = new Map();
  for (const p of promises) {
    const matches = [...(p.relatedBudget ?? "").matchAll(pattern)];
    for (const m of matches) {
      const key = m[0];
      if (seen.has(key) && seen.get(key) !== p.id) {
        assert.fail(`公約${seen.get(key)}と公約${p.id}の両方のrelatedBudgetに同一の予算事業「${key}」が記載されています（二重計上の恐れ）`);
      }
      seen.set(key, p.id);
    }
  }
});

check("relatedBudgetCandidates／relatedBillCandidatesにstatus=\"confirmed\"が紛れ込んでいない（確定情報はrelatedBudget/relatedBillへ記載する運用のため）", () => {
  for (const p of promises) {
    for (const c of [...(p.relatedBudgetCandidates ?? []), ...(p.relatedBillCandidates ?? [])]) {
      assert.notEqual(c.status, "confirmed", `公約${p.id}の候補「${c.label}」がstatus="confirmed"になっています`);
    }
  }
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");

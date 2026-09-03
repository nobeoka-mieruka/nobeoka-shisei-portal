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
 * Phase208で追加：予算→議案→成果の状態表現（src/lib/mayorPromiseLinkage.ts）の検証。
 * 「独立した議案が無いことを確認済み」と「まだ確認できていない」を必ず別の状態として数え、
 * 一次資料の裏付けが無いまま前者へ格上げされていないことを機械的に保証する。
 *
 * 使い方: node --experimental-strip-types scripts/test-mayor-promise-tracking.mjs
 * （src/lib/mayorPromiseLinkage.tsを直接importするため、NodeのTS直接実行を使う）
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));

const { classifyPromiseBudgetLinkage, classifyPromiseBillLinkage, summarizeBillLinkage } = await import(
  "../src/lib/mayorPromiseLinkage.ts"
);

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

/**
 * Phase135-R：relatedBudget/relatedBillは自由記述文であり、Phase136で「確認中」の2文字だけ
 * だった値を「確認中（〜を検索したが見つからなかった）」という説明文へ拡張したため、
 * 単純な完全一致（=== "確認中"）では「未確定」を検出できなくなった（全14件が非該当という
 * 誤った集計になっていた不具合をPhase135-Rの監査で発見・修正）。前方一致（"確認中"で始まるか）
 * で判定することで、確定情報（事業名から始まる文）と未確定（「確認中」から始まる説明文）を
 * 正しく区別する。
 */
const isBudgetConfirmed = (p) => !p.relatedBudget.startsWith("確認中");
const isBillConfirmed = (p) => !p.relatedBill.startsWith("確認中") && (p.relatedBillVoteIds ?? []).length > 0;

console.log("\n公約データの現況（実データから再計算、固定値は使わない）");
console.log(`  公約数：${promises.length}件`);
console.log(`  個別施策（measures）数：${measures.length}件`);
console.log(`  予算まで確認できた公約数：${promises.filter(isBudgetConfirmed).length}件`);
console.log(`  議案まで確認できた公約数：${promises.filter(isBillConfirmed).length}件`);
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

check("「公約」と「個別施策」の件数を取り違えた固定文言（例：「31公約」「公約31件」「14施策」等）が画面表示コード・SEO文言に存在しない（Phase135-R：数値の主語取り違え防止）", () => {
  // 対象はページ・コンポーネント（.tsx）とSEO文言（lib/seo.ts）に限定する。
  // src/data配下のJSON（notes等）には、当時の件数を正しく記録した過去の監査記録
  // （例：「既存の12公約（1-1〜4-3）とは別の項目として」＝4-4/4-5追加前の正しい記述）が
  // 含まれており、これらを機械的に「誤り」として検出すると過去の記録を書き換える圧力になる
  // ため対象外とする（ユーザー指示：「当時31公約と認識していた」という歴史的記録は書き換えない）。
  const glob = (dir, exts) => {
    const out = [];
    const walk = (d) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (exts.some((e) => entry.name.endsWith(e))) out.push(p);
      }
    };
    walk(dir);
    return out;
  };
  const files = [...glob(join(ROOT, "src/pages"), [".tsx"]), ...glob(join(ROOT, "src/components"), [".tsx"]), join(ROOT, "src/lib/seo.ts")];
  // 「N公約」「公約N件」のNが実際の公約数（promises.length）と異なる場合、または
  // 「N施策」「施策N件」のNが実際の施策数（measures.length）と異なる場合に検出する。
  // 実際の件数と一致する表記（動的計算の結果を偶然ハードコードしたに過ぎない場合を含む）は
  // 誤りとは断定できないため対象外とする。
  const violations = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/(\d+)\s*公約|公約\s*(\d+)\s*件/g)) {
      const n = Number(m[1] ?? m[2]);
      if (n !== promises.length && n > 1) violations.push(`${file}: "${m[0]}"（実際の公約数は${promises.length}件）`);
    }
    for (const m of text.matchAll(/(\d+)\s*施策|施策\s*(\d+)\s*件/g)) {
      const n = Number(m[1] ?? m[2]);
      if (n !== measures.length && n > 1) violations.push(`${file}: "${m[0]}"（実際の個別施策数は${measures.length}件）`);
    }
  }
  assert.equal(violations.length, 0, `公約/施策の件数取り違えの疑いがある固定文言があります:\n${violations.join("\n")}`);
});

check('予算・議案の確認状況判定（"確認中"前方一致）が、src/lib/mayorPromiseStatus.tsの共通関数以外で再実装されていない（Phase135-Rで一度発生した重複実装バグの再発防止）', () => {
  const walk = (dir, out) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p, out);
      else if (entry.name.endsWith(".tsx")) out.push(p);
    }
  };
  const files = [];
  walk(join(ROOT, "src/pages"), files);
  walk(join(ROOT, "src/components"), files);
  const suspects = [];
  for (const f of files) {
    if (f.endsWith("mayorPromiseStatus.ts")) continue;
    const text = readFileSync(f, "utf8");
    if (/relatedBudget\.startsWith\(["']確認中["']\)/.test(text) || /relatedBill\.startsWith\(["']確認中["']\)/.test(text)) {
      suspects.push(f);
    }
  }
  assert.equal(suspects.length, 0, `relatedBudget/relatedBillの確認状況判定を独自に再実装しているファイル: ${suspects.join("、")}`);
});

console.log("\nPhase208：予算→議案→成果の状態表現");

/**
 * Phase205（reports/phase205-mayor-promise-linkage.json）で確定した内訳。
 * これはハードコードした「期待する結論」ではなく、一次資料の記述内容が変わらない限り
 * 変わってはならない baseline。新しい一次資料で状態が動いた場合は、この期待値の更新と
 * 根拠（どの資料のどこ）の記録をセットで行う。
 */
const PHASE205_BILL_BASELINE = {
  CONFIRMED_RELATED_BILL: 1,
  BUDGET_BILL_INCLUDED: 4,
  NO_SEPARATE_BILL_LIKELY: 7,
  PENDING_FUTURE_BILL: 1,
  NOT_INTERPRETED: 1,
};

const billLinkages = promises.map((p) => ({ id: p.id, ...classifyPromiseBillLinkage(p) }));
const budgetLinkages = promises.map((p) => ({ id: p.id, ...classifyPromiseBudgetLinkage(p) }));
const tally = (rows) => {
  const out = {};
  for (const r of rows) out[r.reasonCode] = (out[r.reasonCode] ?? 0) + 1;
  return out;
};
const billTally = tally(billLinkages);
const budgetTally = tally(budgetLinkages);
console.log(`  議案側の内訳：${JSON.stringify(billTally)}`);
console.log(`  予算側の内訳：${JSON.stringify(budgetTally)}`);

check("議案側の理由コードの内訳がPhase205のbaselineと一致する（根拠なく状態が動いていない）", () => {
  assert.deepEqual(billTally, PHASE205_BILL_BASELINE);
  const total = Object.values(billTally).reduce((a, b) => a + b, 0);
  assert.equal(total, promises.length, "全公約が1つの理由コードへ分類されていません");
});

check("予算側は一次資料で対応関係を確認できた公約のみがCONFIRMED_BUDGET_ITEMになっている", () => {
  assert.equal(budgetTally.CONFIRMED_BUDGET_ITEM, 4);
  const total = Object.values(budgetTally).reduce((a, b) => a + b, 0);
  assert.equal(total, promises.length);
});

check('「議案化を伴わない可能性が高い」だけを根拠に「独立した議案が無いことを確認済み」へ格上げしていない（NO_SEPARATE_BILL_CONFIRMEDは0件）', () => {
  const upgraded = billLinkages.filter((l) => l.reasonCode === "NO_SEPARATE_BILL_CONFIRMED");
  assert.equal(
    upgraded.length,
    0,
    `一次資料が断定していないのに確認済みへ格上げされた公約があります: ${upgraded.map((l) => l.id).join("、")}`,
  );
});

check("原文が結論を留保している（「断定はしていない」）公約は、「独立した議案が無いことを確認済み」に分類されない", () => {
  const violations = billLinkages.filter((l) => l.hedged && l.reasonCode === "NO_SEPARATE_BILL_CONFIRMED");
  assert.equal(violations.length, 0, `ヘッジ表現があるのに確認済み扱いの公約: ${violations.map((l) => l.id).join("、")}`);
});

check("原文が結論を留保している公約は、表示文からも留保が消えていない（確認済みと言い切っていない）", () => {
  // 予算議案への包含だけが整理済みで、別議案の不存在までは断定していない公約
  // （例：1-2）について、市民向けの説明文からその留保が落ちていないことを保証する。
  const hedgedRows = billLinkages.filter((l) => l.hedged);
  assert.ok(hedgedRows.length > 0, "ヘッジ表現を持つ公約が1件も検出されていません（判定式の退行の疑い）");
  for (const l of hedgedRows) {
    assert.ok(
      /確認中|引き続き確認/.test(l.display.description),
      `公約${l.id}の説明文に「確認中」であることの断りがありません: ${l.display.description}`,
    );
  }
});

check("「独立議案なしを確認済み」と「追加確認中」が別の数として集計される（同じ数に潰れていない）", () => {
  const summary = summarizeBillLinkage(promises);
  assert.equal(summary.confirmedBill, PHASE205_BILL_BASELINE.CONFIRMED_RELATED_BILL);
  assert.equal(summary.noSeparateBillConfirmed, PHASE205_BILL_BASELINE.BUDGET_BILL_INCLUDED);
  assert.equal(
    summary.underReview,
    PHASE205_BILL_BASELINE.NO_SEPARATE_BILL_LIKELY +
      PHASE205_BILL_BASELINE.PENDING_FUTURE_BILL +
      PHASE205_BILL_BASELINE.NOT_INTERPRETED,
  );
  assert.equal(summary.sourceNotFound, 0);
  assert.equal(
    summary.confirmedBill + summary.noSeparateBillConfirmed + summary.underReview + summary.sourceNotFound,
    promises.length,
  );
  console.log(
    `    関連議案を確認済み：${summary.confirmedBill}件／予算議案に含まれることを確認：${summary.noSeparateBillConfirmed}件／追加確認中：${summary.underReview}件`,
  );
});

check("全公約の表示文言（バッジ・説明文）が空でなく、内部コードをそのまま含まない", () => {
  const codes = [
    "CONFIRMED_RELATED_BILL",
    "BUDGET_BILL_INCLUDED",
    "NO_SEPARATE_BILL_CONFIRMED",
    "NO_SEPARATE_BILL_LIKELY",
    "PENDING_FUTURE_BILL",
    "NOT_INTERPRETED",
    "UNDER_REVIEW",
    "SOURCE_NOT_FOUND",
    "CONFIRMED_BUDGET_ITEM",
    "NOT_IN_MAJOR_PROJECT_LIST",
    "WITHIN_EXISTING_OPERATING_COST",
    "MULTI_YEAR_MULTI_BILL",
  ];
  for (const l of [...billLinkages, ...budgetLinkages]) {
    assert.ok(l.display.pillLabel.length > 0, `${l.id}のバッジ文言が空です`);
    assert.ok(l.display.description.length > 0, `${l.id}の説明文が空です`);
    for (const code of codes) {
      assert.ok(!l.display.pillLabel.includes(code), `${l.id}のバッジ文言に内部コード${code}が含まれています`);
      assert.ok(!l.display.description.includes(code), `${l.id}の説明文に内部コード${code}が含まれています`);
    }
    assert.ok(
      !/^なし$|：なし|関連議案：なし/.test(l.display.pillLabel),
      `${l.id}のバッジ文言が「なし」と断定しています（実態に応じた表現にしてください）`,
    );
  }
});

check("議案・予算の状態判定（理由コードの読み取り）がsrc/lib/mayorPromiseLinkage.ts以外で再実装されていない", () => {
  const walk = (dir, out) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const q = join(dir, entry.name);
      if (entry.isDirectory()) walk(q, out);
      else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) out.push(q);
    }
  };
  const files = [];
  walk(join(ROOT, "src/pages"), files);
  walk(join(ROOT, "src/components"), files);
  const suspects = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    if (/議案化を伴わない可能性が高い|独立の議案は無い|主要事業一覧/.test(text)) suspects.push(f);
  }
  assert.equal(
    suspects.length,
    0,
    `relatedBudget/relatedBillの状態判定を独自に再実装しているファイル: ${suspects.join("、")}`,
  );
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");

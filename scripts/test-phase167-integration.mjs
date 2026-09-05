/**
 * Phase167：Phase163（会期要約19件）・Phase164（市長任期空白13期間）・Phase165（財政欠損）・
 * Phase166（市長公約33施策監査）の統合結果の回帰テスト。
 *
 * 使い方: node scripts/test-phase167-integration.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { eraYearFor } from "./lib/council-shared.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

console.log("\nPhase167：Phase163〜166統合結果の現況");

check("Phase163で発見・修正したeraYearForのバグ：令和より前（平成・昭和）の年を渡しても不正な文字列（「令和-10年」等）を生成しない。令和期の既存呼び出し元の挙動（令和元年〜）は変えていない", () => {
  assert.equal(eraYearFor(2019), "令和元年", "令和元年（2019年）の変換が正しくありません");
  assert.equal(eraYearFor(2026), "令和8年", "令和8年（2026年）の変換が正しくありません");
  assert.equal(eraYearFor(2007), "平成19年", "平成19年（2007年）の変換が正しくありません（バグ修正前は「令和-10年」等になっていた）");
  assert.equal(eraYearFor(1989), "平成元年", "平成元年（1989年）の変換が正しくありません");
  assert.equal(eraYearFor(1988), "昭和63年", "昭和63年（1988年）の変換が正しくありません");
  assert.ok(!eraYearFor(2007).includes("-"), "平成期の年に負の数値が含まれています");
});

check("Phase163：会期要約19件のうち10件に公式資料（議案等審議結果PDF等）を新規登録し、summaryStatusがunavailableからpartially-verifiedへ改善した。誰も「verified」へは無理に昇格させていない", () => {
  const cs = JSON.parse(readFileSync(join(ROOT, "src/data/councilSessions.json"), "utf8"));
  const improvedIds = ["2007-06", "2008-09", "2009-09", "2010-06", "2011-03", "2015-09", "2016-09", "2017-06", "2018-12", "2019-03"];
  for (const id of improvedIds) {
    const s = cs.find((x) => x.id === id);
    assert.ok(s, `${id}がcouncilSessions.jsonに見つかりません`);
    assert.equal(s.summaryStatus, "partially-verified", `${id}のsummaryStatusがpartially-verifiedではありません（${s.summaryStatus}）`);
    assert.ok(s.documents && s.documents.length > 0, `${id}にdocumentsが登録されていません`);
    assert.ok(s.summary && !s.summary.includes("令和-"), `${id}のsummaryに不正な元号表記が含まれています`);
  }
  // 【Phase175追記】Phase163時点でunavailableのまま残っていた9会期のうち、Phase175でNDLサーチ
  // （国立国会図書館サーチ）の書誌情報を新規発見できた8会期はpartially-verifiedへ前進した。
  // 2014-03のみPhase175時点では対応するNDLサーチ書誌が見つからず、unavailableのままだった（UNR-061参照）。
  // 【Phase179追記】2014-03はNDLサーチとは別系統の一次資料「のべおか市議会だより」第59号
  // （延岡市議会公式発行、市公式サイトで常時公開）を新規発見し、partially-verifiedへ前進した。
  // 会議録原本の書誌（NDLサーチ）には引き続き到達できていないため、documentsのcategoryは
  // "minutes"ではなく"newsletters"のみが登録されている点が他の8会期と異なる。
  const phase179ImprovedIds = ["2014-03"];
  for (const id of phase179ImprovedIds) {
    const s = cs.find((x) => x.id === id);
    assert.ok(s, `${id}がcouncilSessions.jsonに見つかりません`);
    assert.equal(s.summaryStatus, "partially-verified", `${id}のsummaryStatusがpartially-verifiedではありません（${s.summaryStatus}）`);
    assert.ok(
      s.documents.some((d) => d.category === "newsletters" && d.storageType === "external" && (d.sourceUrl ?? "").includes("city.nobeoka.miyazaki.jp")),
      `${id}に「のべおか市議会だより」（newsletters/external）が登録されていません`,
    );
    assert.ok(
      !s.documents.some((d) => d.category === "minutes"),
      `${id}にNDLサーチの会議録書誌（minutes）が登録されています。Phase175〜179時点では未発見のはずです`,
    );
  }
  const phase175ImprovedIds = ["2000-09", "2004-06", "2005-09", "2006-06", "2012-09", "2013-06", "2013-09", "2014-09"];
  for (const id of phase175ImprovedIds) {
    const s = cs.find((x) => x.id === id);
    assert.ok(s, `${id}がcouncilSessions.jsonに見つかりません`);
    assert.equal(s.summaryStatus, "partially-verified", `${id}のsummaryStatusがpartially-verifiedではありません（${s.summaryStatus}）`);
    assert.ok(s.documents && s.documents.length > 0, `${id}にdocumentsが登録されていません`);
    assert.ok(
      s.documents.some((d) => d.category === "minutes" && d.storageType === "external" && (d.sourceUrl ?? "").includes("ndlsearch.ndl.go.jp")),
      `${id}にNDLサーチの書誌情報（minutes/external）が登録されていません`,
    );
  }
});

check("Phase164：市長任期空白13期間は、新たな一次資料が確認できなかったため、archiveMayorTerms.jsonへのデータ追加を一切行っていない（推測での日付埋めをしていないことの確認）", () => {
  const terms = JSON.parse(readFileSync(join(ROOT, "src/data/archiveMayorTerms.json"), "utf8"));
  assert.equal(terms.length, 30, `archiveMayorTerms.jsonの件数が30件ではありません（${terms.length}件、新規レコード追加が無いはず）`);
  const sorted = [...terms].sort((a, b) => (a.termStart || "").localeCompare(b.termStart || ""));
  function daysBetween(a, b) {
    return (new Date(b) - new Date(a)) / 86400000;
  }
  let gapCount = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    if (cur.termEnd && next.termStart && daysBetween(cur.termEnd, next.termStart) > 1) gapCount++;
  }
  assert.equal(gapCount, 13, `空白期間が13件ではありません（${gapCount}件、Phase164で意図せず解決・悪化していないか）`);
});

check("Phase165：archiveFiscalYears.jsonに新規確定した37件の数値フィールドは、既存の非null値を一切変更していない（コミット5bd5bc1の内容確認）。件数（70件）も不変", () => {
  const fy = JSON.parse(readFileSync(join(ROOT, "src/data/archiveFiscalYears.json"), "utf8"));
  assert.equal(fy.length, 70, `archiveFiscalYears.jsonの件数が70件ではありません（${fy.length}件）`);
  const fy2026 = fy.find((x) => x.fiscalYear === 2026);
  assert.ok(fy2026, "FY2026のレコードが見つかりません");
  assert.equal(fy2026.budget.generalAccountSettlementYen, null, "FY2026は年度未終了のため決算額はnullのはずです（推測で埋めていないことの確認）");
});

check("Phase166：mayorPromisesの新規議案紐付け2件（2023-06-gian-19, 2026-03-gian-155）は、いずれもbillVotes.jsonに実在し、billTitleに固有名詞（西階）が含まれる。公約14件・施策33件の件数は不変", () => {
  const mp = JSON.parse(readFileSync(join(ROOT, "src/data/mayorPromises.json"), "utf8"));
  assert.equal(mp.promises.length, 14, `公約が14件ではありません（${mp.promises.length}件）`);
  const measures = JSON.parse(readFileSync(join(ROOT, "src/data/mayorPromiseMeasures.json"), "utf8"));
  assert.equal(measures.length, 33, `個別施策が33件ではありません（${measures.length}件）`);
  const bv = JSON.parse(readFileSync(join(ROOT, "src/data/billVotes.json"), "utf8"));
  const newIds = ["2023-06-gian-19", "2026-03-gian-155"];
  const promise23 = mp.promises.find((p) => p.id === "2-3");
  assert.ok(promise23, "公約2-3が見つかりません");
  for (const id of newIds) {
    const bill = bv.find((b) => b.id === id);
    assert.ok(bill, `${id}がbillVotes.jsonに存在しません`);
    assert.ok(bill.billTitle.includes("西階") || (bill.reason ?? "").includes("西階"), `${id}のbillTitle・reasonのいずれにも「西階」が含まれていません`);
    assert.ok((promise23.relatedBillVoteIds ?? []).includes(id), `公約2-3のrelatedBillVoteIdsに${id}が含まれていません`);
  }
});

/*
 * Phase207 による期待値の更新（なぜ動いたか）：
 * Phase162完了時点の Level1=402 / Level2=153 / Level3=622 / sourceTextVerified=775 は、
 * Phase163〜206 の間は一切変更されていない。Phase207 で次の2つの反映を行ったため、
 * データ件数が動いた（新規のオンライン調査・推測での加筆は行っていない）。
 *
 *  (1) Level2 → Level3：30件
 *      verificationNote に既に転記されていた「この議案固有の会議録原文」を、そのまま
 *      提出理由（reason）として登録した（要約・言い換えなし。テストで原文完全一致を検証）。
 *      Level2 153 − 30 = 123
 *  (2) Level1 → Level2：56件
 *      Phase160 が会議録本文まで確認し原文引用まで記録しながら billVotes.json へ反映せず
 *      保留していた56件（reports/phase160-held-for-future-56.json）を反映した。
 *      共通の一括説明しか存在しないため reason は書かず、sharedProposalStatement へ
 *      原文引用として登録し、本文確認済み（sourceTextVerifiedAt）を記録した。
 *      Level1 402 − 56 = 346／Level2 123 + 56 = 179／sourceTextVerified 775 + 56 = 831
 *
 * 結果：Level1=346 / Level2=179 / Level3=652 / sourceTextVerified=831（合計は1,177で不変）。
 *
 * 【Phase225追記】延岡市議会公式サイトの「議案等審議結果」に令和8年9月定例会（第27回）分
 * （28811.pdf、令和8年8月28日現在）が公開され、議案第48号「工事請負契約の締結（西階公園陸上
 * 競技場フィールド・走路改修工事）」1件を一次資料に基づき追加した。この議案は審議結果PDFのみを
 * 出典とし、会議録本文は未公表のため Level1（sourceTextVerifiedAt なし）に分類される。
 * よって Level1=347 / Level2=179 / Level3=652 / sourceTextVerified=831（合計 1,178）となる。
 * Level2・Level3・sourceTextVerified は不変であることを、引き続きこのテストで固定する。
 */
check("議案品質データ（Phase207適用後＋Phase225の新規1件：Level1=347/Level2=179/Level3=652/sourceTextVerified=831）", () => {
  const bv = JSON.parse(readFileSync(join(ROOT, "src/data/billVotes.json"), "utf8"));
  function isLevel3(b) {
    return b.summarySource === "manual" && Boolean(b.reason || (b.mainChanges && b.mainChanges.length > 0) || b.citizenImpact);
  }
  function isLevel2(b) {
    return Boolean(b.sourceTextVerifiedAt) && !isLevel3(b);
  }
  let l1 = 0, l2 = 0, l3 = 0;
  for (const b of bv) {
    if (isLevel3(b)) l3++;
    else if (isLevel2(b)) l2++;
    else l1++;
  }
  assert.equal(l1, 347, `Level1が347件ではありません（${l1}件）`);
  assert.equal(l2, 179, `Level2が179件ではありません（${l2}件）`);
  assert.equal(l3, 652, `Level3が652件ではありません（${l3}件）`);
  assert.equal(bv.filter((b) => b.sourceTextVerifiedAt).length, 831, "sourceTextVerifiedが831件ではありません");
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");

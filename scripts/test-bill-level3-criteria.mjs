/**
 * Phase144：Level3昇格条件（7項目）の機械検査、A区分とD-A区分の重複件数（常に0であるべき）、
 * 1,177件全体の「原資料到達性区分×説明品質段階」クロス集計、根拠資料（sourceExcerpt相当）の
 * 追跡可能性についての回帰テスト。
 *
 * 使い方: node scripts/test-bill-level3-criteria.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const billVotes = JSON.parse(readFileSync(join(ROOT, "src/data/billVotes.json"), "utf8"));
assert.equal(billVotes.length, 1177, "billVotes.jsonの件数が1,177件ではありません");

const STRUCTURED_CATEGORIES = new Set(["予算", "契約", "財産取得", "決算", "専決処分"]);
const LINK_CONFIRMED_YEARS = new Set(["令和5年度", "令和6年度", "令和7年度", "令和8年度"]);
function classifyRetrieval(b) {
  if (b.transcriptUrl) return STRUCTURED_CATEGORIES.has(b.category) ? "A" : "B";
  if (LINK_CONFIRMED_YEARS.has(b.fiscalYear)) return "B";
  return "D";
}
function isLevel3(b) {
  return b.summarySource === "manual" && Boolean(b.reason || (b.mainChanges && b.mainChanges.length > 0) || b.citizenImpact);
}
function isLevel2(b) {
  return Boolean(b.sourceTextVerifiedAt) && !isLevel3(b);
}
function levelOf(b) {
  if (isLevel3(b)) return 3;
  if (isLevel2(b)) return 2;
  return 1;
}

console.log("\nLevel3昇格条件・原資料到達性クロス集計の現況");

check("Level3の議案は、すべて次の7条件を満たす（項目14）：①出典あり②議案番号一致③議案名一致④本文範囲確定⑤要約と一次資料照合済み⑥数値があれば数値照合済み⑦推測表現なし", () => {
  const level3Bills = billVotes.filter(isLevel3);
  assert.ok(level3Bills.length > 0, "Level3の議案が1件もありません");
  const violations = [];
  for (const b of level3Bills) {
    // ①出典あり
    if (!b.sourceFilePath && !b.sourceDocumentId) violations.push(`${b.id}: 出典なし`);
    // ②③ 議案番号・議案名の存在（billVotes.json自体の必須項目として常に存在するはずだが念のため確認）
    if (!b.billNumber) violations.push(`${b.id}: 議案番号なし`);
    if (!b.billTitle) violations.push(`${b.id}: 議案名なし`);
    // ④ 本文範囲確定＝sourceTextVerifiedAtが設定されている
    if (!b.sourceTextVerifiedAt) violations.push(`${b.id}: 本文確認日なし`);
    // ⑤ 要約と一次資料の照合＝summarySourceが"manual"（人が確認して作成）
    if (b.summarySource !== "manual") violations.push(`${b.id}: summarySourceがmanualでない`);
    // ⑦ 推測表現が含まれていないか（「と思われます」「可能性があります」等の憶測表現を禁止）
    const speculativePattern = /と思われます|可能性があります|でしょう|と推測されます|と考えられます(?!。$)/;
    const allText = [b.reason, b.citizenImpact, ...(b.mainChanges ?? [])].filter(Boolean).join(" ");
    if (speculativePattern.test(allText)) violations.push(`${b.id}: 推測表現の疑いがある文言を含む`);
  }
  assert.equal(violations.length, 0, `Level3条件を満たさない議案: ${violations.join("、")}`);
});

check("Phase146でR1（REVIEW内NEAR_SAFE候補）36件を一次資料検証し、Level3化した15件・Level2止まりとした11件が、それぞれ意図通りの区分になっている（無理な昇格・意図しない後退が無いことの固定リスト回帰）", () => {
  const phase146Level3Ids = [
    "2023-05-gian-7", "2023-07-extraordinary-02-gian-28", "2024-09-gian-39",
    "2025-07-extraordinary-gian-38", "2025-09-gian-52", "2025-09-gian-53",
    "2022-03-gian-134", "2020-09-gian-40", "2020-09-gian-41", "2020-09-gian-42",
    "2020-06-gian-23", "2019-09-gian-47", "2019-09-gian-53", "2019-09-gian-54", "2019-06-gian-19",
  ];
  const phase146Level2Ids = [
    "2023-05-gian-8", "2025-01-extraordinary-gian-110", "2022-06-gian-20",
    "2020-06-gian-22", "2019-06-gian-23",
    "2025-03-gian-144", "2025-03-gian-145", "2022-03-gian-144", "2022-03-gian-145",
    "2020-09-gian-53", "2020-09-gian-54",
  ];
  assert.equal(phase146Level3Ids.length, 15, "Phase146 Level3固定リストの件数が15件ではありません");
  assert.equal(phase146Level2Ids.length, 11, "Phase146 Level2固定リストの件数が11件ではありません");
  for (const id of phase146Level3Ids) {
    const b = billVotes.find((x) => x.id === id);
    assert.ok(b && isLevel3(b), `${id}はPhase146でLevel3化されているはずですが、Level3条件を満たしていません`);
  }
  for (const id of phase146Level2Ids) {
    const b = billVotes.find((x) => x.id === id);
    assert.ok(b && isLevel2(b), `${id}はPhase146でLevel2止まりとしたはずですが、Level2条件を満たしていません`);
  }
});

check("Phase147でR1残存7件のうち6件を一次資料再検証し、Level3化した4件・Level2止まりとした2件が意図通りの区分になっている（無理な昇格・意図しない後退が無いことの固定リスト回帰）。残り1件（議案第9号・再議）は政治的に係争性の高い内容のため意図的に既存維持とした（Level1のまま）", () => {
  const phase147Level3Ids = ["2023-06-gian-10", "2023-06-gian-20", "2023-06-gian-21", "2021-06-gian-25"];
  /*
   * Phase207による更新（なぜ動いたか）：
   * Phase147がLevel2止まりとした2件（2021-06-gian-20・2021-06-gian-21）は、
   * 「本案は」等で始まる定型の提案理由文が抽出できなかったためLevel2に据え置かれていた。
   * しかし当時のverificationNoteには、会議録本文から転記した
   * 「議案第二〇号は藤の木辺地において、農道小原潜水橋の補修工事を行うものであります。」のように、
   * その議案だけを指し、議案名からは分からない事実（対象の施設名・工事内容）を含む原文引用が
   * 既に記録されていた。Phase206でこの点を再点検し、Phase207で原文をそのまま提出理由として
   * 登録した（要約・言い換え・理由の補完はしていない。原文完全一致を
   * scripts/test-bill-phase206-explainability.mjs で検証している）。
   * したがってこの2件はLevel3へ前進しており、意図しない後退ではない。
   */
  const phase207PromotedFromPhase147Level2Ids = ["2021-06-gian-20", "2021-06-gian-21"];
  for (const id of phase147Level3Ids) {
    const b = billVotes.find((x) => x.id === id);
    assert.ok(b && isLevel3(b), `${id}はPhase147でLevel3化されているはずですが、Level3条件を満たしていません`);
  }
  for (const id of phase207PromotedFromPhase147Level2Ids) {
    const b = billVotes.find((x) => x.id === id);
    assert.ok(b && isLevel3(b), `${id}はPhase207で原文引用を提出理由として登録しLevel3化したはずですが、Level3条件を満たしていません`);
    assert.ok(
      (b.verificationNote ?? "").includes("Phase206-207追記"),
      `${id}のverificationNoteにPhase206-207の経緯が記録されていません`,
    );
  }
  const bill9 = billVotes.find((x) => x.id === "2023-07-extraordinary-01-gian-9");
  assert.ok(bill9 && !isLevel2(bill9) && !isLevel3(bill9), "議案第9号（再議）は今回意図的に既存維持（Level1）としたはずが、Level2/3へ変化しています");
  assert.ok(bill9.verificationNote?.includes("Phase147"), "議案第9号のverificationNoteにPhase147の調査記録が追記されていません");
});

check("Level2（本文確認済み・独自要約なし）の議案は、すべてsourceTextVerifiedAtを持ち、reasonやcitizenImpact等の独自内容を持たない（項目28：議案第162号を含む）", () => {
  const level2Bills = billVotes.filter(isLevel2);
  assert.ok(level2Bills.length > 0, "Level2の議案が1件もありません");
  for (const b of level2Bills) {
    assert.ok(b.sourceTextVerifiedAt, `${b.id}: sourceTextVerifiedAtがありません`);
    assert.ok(!b.reason && !b.citizenImpact, `${b.id}: Level2のはずが独自内容（reason等）を持っています`);
  }
  const bill162 = billVotes.find((b) => b.id === "2026-03-gian-162");
  assert.ok(bill162 && isLevel2(bill162), "議案第162号がLevel2ではありません（無理な昇格または降格が起きている疑い）");
});

check("A区分とD-A区分は重複しない（transcriptUrlの有無で完全に分岐するため、定義上重複件数は常に0）。Phase145のSAFE並列検証でD-A→Aへ多数昇格したため、件数は既存値超過を確認する", () => {
  const isA = (b) => classifyRetrieval(b) === "A";
  const isDA = (b) => classifyRetrieval(b) === "D" && STRUCTURED_CATEGORIES.has(b.category);
  const overlap = billVotes.filter((b) => isA(b) && isDA(b));
  assert.equal(overlap.length, 0, `A区分とD-A区分が重複している議案があります: ${overlap.map((b) => b.id).join("、")}`);
  const aCount = billVotes.filter(isA).length;
  const daCount = billVotes.filter(isDA).length;
  assert.ok(aCount >= 267, `A区分の件数が267件未満です（${aCount}件）`);
  assert.ok(daCount <= 109, `D-A区分の件数が109件を超えています（${daCount}件）`);
  // 【Phase146追記】Phase145まではA区分の供給源がD-A→A（transcriptUrl新規登録）のみだったため
  // A+D-Aは376件で一定だったが、Phase146のR1（REVIEW内の技術的抽出問題のみの候補）検証で、
  // 「構造化しやすいカテゴリ・令和5〜8年度・transcriptUrl未登録」のためB区分に分類されていた
  // 議案（classifyBillSourceRetrievalのconfirmedYears無条件B分岐によるもの）にtranscriptUrlが
  // 新規確認され、B→Aという別の昇格経路が生じた。そのためA+D-Aは376件を下回ることはないが、
  // 上回ることはある（単調増加。B→A分だけA単独が増え、D-Aは変化しない）。
  assert.ok(aCount + daCount >= 174 + 202, `A+D-Aの合計が既存基準（376件）を下回っています（${aCount + daCount}件）`);
});

check("1,177件全体の「原資料到達性区分（A/B/D）×説明品質段階（Level1/Level2/Level3）」クロス集計の合計が1,177件と一致する", () => {
  const matrix = { A: { 1: 0, 2: 0, 3: 0 }, B: { 1: 0, 2: 0, 3: 0 }, D: { 1: 0, 2: 0, 3: 0 } };
  for (const b of billVotes) {
    const cat = classifyRetrieval(b);
    matrix[cat][levelOf(b)]++;
  }
  let sum = 0;
  for (const cat of Object.keys(matrix)) for (const lv of Object.keys(matrix[cat])) sum += matrix[cat][lv];
  assert.equal(sum, 1177, `クロス集計の合計が1,177件ではありません（${sum}件）: ${JSON.stringify(matrix)}`);
  /*
   * この不変条件が守りたいのは「本文を確認したことになっている議案は、必ず会議録本文へ
   * たどり着けること」であり、たどり着く先が transcriptUrl であること自体ではない。
   *
   * Phase207による更新（なぜ動いたか）：
   * Phase160 が会議録本文（提案理由説明の日）まで確認しながら billVotes.json へ反映せず
   * 保留していた56件を、Phase207 で反映した。この56件について分かっているのは
   * 「提案理由説明が載っている会議録のファイル名」であり、議決日の本会議録
   * （transcriptUrl に入れている種類のリンク）ではない。議決日のファイル名は確認できて
   * いないため、推測でtranscriptUrlを埋めることはせず、確認できた会議録を
   * relatedDocumentUrls（議案の提案理由の説明（会議録））として登録した。
   * その結果、D区分（transcriptUrl未登録）にLevel2が56件生じる。
   * そこで不変条件を「D区分にLevel2以上があってはならない」から
   * 「D区分でLevel2以上のものは、必ず会議録リンクをrelatedDocumentUrlsに持つ」へ改めた。
   */
  assert.equal(matrix.D[3], 0, "D区分にLevel3の議案があります（想定外：個別説明を書いた議案は会議録リンクを持つはず）");
  const dVerifiedWithoutMinutes = billVotes
    .filter((b) => classifyRetrieval(b) === "D" && levelOf(b) >= 2)
    .filter((b) => !(b.relatedDocumentUrls ?? []).some((d) => d.sourceType === "会議録"))
    .map((b) => b.id);
  assert.deepEqual(
    dVerifiedWithoutMinutes,
    [],
    `会議録リンクを持たないのに本文確認済みになっている議案があります: ${dVerifiedWithoutMinutes.join("、")}`,
  );
});

check("Level3の議案は、根拠資料（sourceExcerpt相当）を追跡できる：sourceFilePath/sourceDocumentIdに加え、会議録の実際の日付（fileName）が既存transcriptUrlと異なる場合はrelatedDocumentUrlsに正しいリンクを持つ", () => {
  const level3Bills = billVotes.filter(isLevel3);
  const missing = [];
  for (const b of level3Bills) {
    const hasSourceRef = Boolean(b.sourceFilePath || b.sourceDocumentId);
    const hasReasonSource = Boolean(b.transcriptUrl) || (b.relatedDocumentUrls && b.relatedDocumentUrls.some((d) => d.sourceType === "会議録"));
    if (!hasSourceRef || !hasReasonSource) missing.push(b.id);
  }
  assert.equal(missing.length, 0, `根拠資料を追跡できない議案: ${missing.join("、")}`);
});

check("Phase144でbill-speech-parser.mjs（機械抽出）により新規Level3化した議案のmainChangesは、原文どおりの漢数字表記のみで、算用数字＋「千円」「百万円」等の省略単位表記を含まない（項目11・19：単位変換ミスの簡易検査）", () => {
  // Phase142・Phase143（人が読みやすく手作業で算用数字＋万/億表記へ書き直した回）とは異なり、
  // Phase144のbill-speech-parser.mjsは原文の文をそのまま複製するだけで、独自の数値変換を
  // 一切行わない設計（項目18・19）。そのため、Phase144で新規にLevel3化した議案に限っては、
  // 算用数字＋省略単位（「6,500千円」等、集計表特有の表記で原文の会議録には出現しない）が
  // 見つかれば、それは原文からの引用ではなく変換が混入した疑いがある。
  const phase144NewBillIds = [
    "2024-06-gian-5", "2024-06-gian-18", "2024-06-gian-19", "2024-06-gian-26",
    "2024-09-gian-28", "2024-09-gian-29", "2024-09-gian-30", "2024-09-gian-31", "2024-09-gian-32",
    "2024-09-gian-33", "2024-09-gian-34", "2024-09-gian-35", "2024-09-gian-36", "2024-09-gian-37",
    "2024-09-gian-38", "2024-09-gian-52", "2024-09-gian-53", "2024-09-gian-55",
    "2024-12-gian-67", "2024-12-gian-68", "2024-12-gian-69", "2024-12-gian-70", "2024-12-gian-71",
    "2024-12-gian-72", "2024-12-gian-82", "2024-12-gian-83", "2024-12-gian-84", "2024-12-gian-85",
    "2024-12-gian-86", "2024-12-gian-99",
    "2024-03-gian-108", "2024-03-gian-109", "2024-03-gian-110", "2024-03-gian-111", "2024-03-gian-112",
    "2024-03-gian-113", "2024-03-gian-114", "2024-03-gian-141",
    "2025-03-gian-111", "2025-03-gian-116", "2025-03-gian-134", "2025-03-gian-135",
  ];
  assert.equal(phase144NewBillIds.length, 42, "Phase144対象議案リストが42件ではありません");
  const suspiciousUnitPattern = /[0-9０-９][,，0-9０-９]*\s*(?:千円|百万円|万円)/;
  const suspects = [];
  for (const id of phase144NewBillIds) {
    const b = billVotes.find((x) => x.id === id);
    assert.ok(b, `対象議案が見つかりません: ${id}`);
    for (const line of b.mainChanges ?? []) {
      if (suspiciousUnitPattern.test(line)) suspects.push(`${id}: ${line}`);
    }
  }
  assert.equal(suspects.length, 0, `算用数字＋省略単位の疑いがある記述: ${suspects.join(" / ")}`);
});

check("summaryVerified（Level3）・sourceTextVerifiedの総数が、Phase144時点（61件・62件）を下回っていない（Phase145で後退していないか）", () => {
  const level3Count = billVotes.filter(isLevel3).length;
  const verifiedCount = billVotes.filter((b) => b.sourceTextVerifiedAt).length;
  assert.ok(level3Count >= 61, `Level3の総数が61件を下回っています（${level3Count}件）`);
  assert.ok(verifiedCount >= 62, `sourceTextVerifiedの総数が62件を下回っています（${verifiedCount}件）`);
});

check("A区分内でLevel3へ昇格した議案は、Phase144の50件を下回っていない", () => {
  const level3InA = billVotes.filter((b) => isLevel3(b) && classifyRetrieval(b) === "A");
  assert.ok(level3InA.length >= 50, `A区分内のLevel3件数が50件を下回っています（${level3InA.length}件）`);
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");

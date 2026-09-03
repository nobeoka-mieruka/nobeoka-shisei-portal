/**
 * Phase206：詳細説明が未作成の議案555件を「説明可能性」で再分類する（分析のみ。src/data は変更しない）。
 *
 * Phase205 の発見（前提）：
 * Priority A の153件のうち151件は「一次資料に個別の提案理由が無いことを確認済み」であり、
 * 「本文確認済み＝説明文を作成できる」ではない。したがって Phase206 では
 * 「どこまで確認したか」（Level1〜3）ではなく「なぜ説明が無いのか」を分類する。
 *
 * 判定ロジックの単一情報源は src/lib/billExplainability.ts（UI と共有する）。
 * このスクリプトは billVotes.json と Phase160 の保留記録を読み、その関数を適用して集計するだけ。
 *
 * 使い方: node --experimental-strip-types scripts/analyze-phase206.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const { getBillExplanationLevel } = await import("../src/lib/billSummaryQuality.ts");
const {
  classifyBillExplainability,
  extractQuotedStatement,
  BILL_EXPLAINABILITY_CITIZEN_LABEL,
  BILL_EXPLAINABILITY_CITIZEN_DESCRIPTION,
} = await import("../src/lib/billExplainability.ts");
const BILL_EXPLAINABILITY_CITIZEN_LABEL_EARLY = BILL_EXPLAINABILITY_CITIZEN_LABEL;
const { classifyBillSourceRetrieval } = await import("../src/lib/billSourceRetrieval.ts");

/** 出力先。Phase207 適用後の状態を別ファイルへ書き出すために使う。 */
const outArgIndex = process.argv.indexOf("--out");
const OUT_JSON = outArgIndex >= 0 ? process.argv[outArgIndex + 1] : "reports/phase206-bill-explainability.json";
const OUT_MD = OUT_JSON.replace(/\.json$/, ".md");
const stageArgIndex = process.argv.indexOf("--stage");
const STAGE = stageArgIndex >= 0 ? process.argv[stageArgIndex + 1] : "Phase207適用前";

const bills = readJson("src/data/billVotes.json");
const held56 = readJson("reports/phase160-held-for-future-56.json");
const heldById = new Map(held56.map((h) => [h.id, h]));

const CODES = [
  "EXPLAINABLE_FROM_PRIMARY",
  "NO_INDIVIDUAL_REASON_CONFIRMED",
  "SHARED_REASON",
  "SOURCE_NEEDS_STRUCTURING",
  "SOURCE_INSUFFICIENT",
  "HUMAN_REVIEW",
];

const tally = (list, key) => {
  const m = {};
  for (const x of list) {
    const k = String(typeof key === "function" ? key(x) : x[key]);
    m[k] = (m[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};

const items = [];
let unclassified = 0;
for (const bill of bills) {
  const level = getBillExplanationLevel(bill);
  let result = classifyBillExplainability(bill, level);
  if (result === null) continue; // Level3（すでに一次資料に基づく説明あり）は対象外
  const held = heldById.get(bill.id) ?? null;
  // Phase160 は会議録本文まで到達し、共通の一括説明を原文引用まで記録しながら、
  // billVotes.json へ反映せず保留した（reports/phase160-held-for-future-56.json）。
  // 保留記録の note はすべて「複数議案一括説明（共通のみ）」であり、
  // billVotes.json だけを見ると「未整理」に見えるが、実態は共通説明のみが存在する状態。
  // Phase207 でこの引用を sharedProposalStatement として反映すると、
  // src/lib/billExplainability.ts 単独でも同じ SHARED_REASON になる。
  if (held && result.code === "SOURCE_NEEDS_STRUCTURING") {
    result = {
      ...result,
      code: "SHARED_REASON",
      citizenLabel: BILL_EXPLAINABILITY_CITIZEN_LABEL_EARLY.SHARED_REASON,
      basis: "Phase160 が会議録本文まで到達し、共通の一括説明を原文引用まで記録している（保留記録）",
    };
  }
  if (!CODES.includes(result.code)) {
    unclassified += 1;
    continue;
  }
  items.push({
    id: bill.id,
    session: bill.session,
    billNumber: bill.billNumber,
    billTitle: bill.billTitle,
    category: bill.category ?? null,
    fiscalYear: bill.fiscalYear,
    proposerType: bill.proposerType ?? null,
    level,
    sourceRetrieval: classifyBillSourceRetrieval(bill),
    code: result.code,
    basis: result.basis,
    citizenLabel: result.citizenLabel,
    quotedStatement: extractQuotedStatement(bill.verificationNote),
    // Phase160 が会議録本文まで到達しながら billVotes.json へ反映せず保留した記録
    // （新規調査ゼロで前進できる候補。reports/phase160-held-for-future-56.json）。
    heldRecordAvailable: Boolean(held),
    heldRecordFileName: held?.fileName ?? null,
    // sourceRef（説明を書く場合の根拠URL）が既に存在するか。
    hasTranscriptUrl: Boolean(bill.transcriptUrl),
    hasProposalReasonDocument: Boolean(
      (bill.relatedDocumentUrls ?? []).some((d) => d.sourceType === "会議録"),
    ),
  });
}

const byCode = Object.fromEntries(CODES.map((c) => [c, items.filter((i) => i.code === c)]));
const total = items.length;
const sumOfCodes = CODES.reduce((n, c) => n + byCode[c].length, 0);
const noDetailedExplanation = bills.filter((b) => getBillExplanationLevel(b) !== 3).length;

const report = {
  generatedAt: new Date().toISOString().slice(0, 10),
  phase: "Phase206",
  stage: STAGE,
  scope: "src/data/billVotes.json（詳細説明が未作成の議案）",
  totalBills: bills.length,
  targetCount: total,
  classificationSource: "src/lib/billExplainability.ts（UI と共有する単一情報源）",
  reusedExistingModules: [
    "src/lib/billSummaryQuality.ts（Level0〜3。判定を再実装せず結果を渡している）",
    "src/lib/billSourceRetrieval.ts（原資料到達性 A/B/C/D。参考列としてのみ使用）",
  ],
  newEnumRationale:
    "既存の Level0〜3（どこまで確認したか）・A/B/C/D（原資料へ到達できるか）・blockedTaskClassification.json の status（サイト全体の人手対応台帳・粒度が議案単位でない）のいずれも「なぜ説明が無いのか」を表現できないため、説明可能性コードのみを新設した。判定に使う値はすべて既存フィールドで、新しい状態管理フィールド群は追加していない。",
  checks: {
    detailedExplanationMissing: noDetailedExplanation,
    classifiedTotal: total,
    sumOfCodeCounts: sumOfCodes,
    unclassified,
    matches: noDetailedExplanation === total && sumOfCodes === total && unclassified === 0,
  },
  counts: Object.fromEntries(CODES.map((c) => [c, byCode[c].length])),
  countsByLevel: {
    level1: items.filter((i) => i.level === 1).length,
    level2: items.filter((i) => i.level === 2).length,
  },
  crossTabLevelByCode: Object.fromEntries(
    CODES.map((c) => [c, { level1: byCode[c].filter((i) => i.level === 1).length, level2: byCode[c].filter((i) => i.level === 2).length }]),
  ),
  // 市民向けの表示文（内部コードをそのまま画面に出さないための変換表）。下で埋める。
  citizenFacingWording: {},
  byCode: Object.fromEntries(
    CODES.map((c) => [
      c,
      {
        count: byCode[c].length,
        byCategory: tally(byCode[c], "category"),
        byFiscalYear: tally(byCode[c], "fiscalYear"),
        withHeldRecord: byCode[c].filter((i) => i.heldRecordAvailable).length,
        withSourceRef: byCode[c].filter((i) => i.hasTranscriptUrl || i.hasProposalReasonDocument).length,
        items: byCode[c],
      },
    ]),
  ),
  phase207Candidates: {
    explainableFromPrimary: byCode.EXPLAINABLE_FROM_PRIMARY.map((i) => i.id),
    sharedReasonWithHeldRecord: byCode.SHARED_REASON.filter((i) => i.heldRecordAvailable).map((i) => i.id),
    sharedReasonWithQuoteOnly: byCode.SHARED_REASON.filter((i) => !i.heldRecordAvailable && i.quotedStatement).map((i) => i.id),
  },
};

// 内部コードをそのまま画面に出さないための変換表を、レポートにも記録する。
report.citizenFacingWording = Object.fromEntries(
  CODES.map((c) => [c, { label: BILL_EXPLAINABILITY_CITIZEN_LABEL[c], description: BILL_EXPLAINABILITY_CITIZEN_DESCRIPTION[c] }]),
);

writeFileSync(join(ROOT, OUT_JSON), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const md = [];
md.push("# Phase206 議案「説明可能性」の再分類");
md.push("");
md.push(`生成日：${report.generatedAt}／時点：${STAGE}（この Markdown は集計結果の出力であり、\`src/data\` を書き換えるものではない）`);
md.push("");
md.push(`対象：\`src/data/billVotes.json\` のうち、一次資料に基づく詳細説明がまだ無い議案 **${total}件**（総数 ${bills.length}件）`);
md.push("");
md.push(`機械可読版：\`${OUT_JSON}\`／判定ロジック：\`src/lib/billExplainability.ts\``);
md.push("");
md.push("## なぜ新しい分類軸を作ったか");
md.push("");
md.push(report.newEnumRationale);
md.push("");
md.push("## 件数");
md.push("");
md.push("| 分類 | 件数 | Level1 | Level2 | 市民向けの表示文 |");
md.push("| --- | ---: | ---: | ---: | --- |");
for (const c of CODES) {
  const x = report.crossTabLevelByCode[c];
  md.push(`| \`${c}\` | ${byCode[c].length} | ${x.level1} | ${x.level2} | ${BILL_EXPLAINABILITY_CITIZEN_LABEL[c]} |`);
}
md.push(`| **合計** | **${sumOfCodes}** | ${report.countsByLevel.level1} | ${report.countsByLevel.level2} | |`);
md.push("");
md.push(`検算：詳細説明なし ${noDetailedExplanation}件 ＝ 分類合計 ${sumOfCodes}件（分類不能 ${unclassified}件）`);
md.push("");
md.push("## 分類ごとの内訳");
md.push("");
for (const c of CODES) {
  md.push(`### \`${c}\`（${byCode[c].length}件）`);
  md.push("");
  md.push(`市民向け表示：**${BILL_EXPLAINABILITY_CITIZEN_LABEL[c]}**`);
  md.push("");
  md.push(BILL_EXPLAINABILITY_CITIZEN_DESCRIPTION[c]);
  md.push("");
  const cats = Object.entries(report.byCode[c].byCategory);
  if (cats.length > 0) md.push(`カテゴリ内訳：${cats.map(([k, v]) => `${k} ${v}`).join(" / ")}`);
  md.push("");
  md.push(`根拠URL（会議録リンク・提案理由説明の会議録）が既にあるもの：${report.byCode[c].withSourceRef}件`);
  if (report.byCode[c].withHeldRecord > 0) {
    md.push("");
    md.push(`Phase160 の保留記録（\`reports/phase160-held-for-future-56.json\`）がある：${report.byCode[c].withHeldRecord}件`);
  }
  md.push("");
}
writeFileSync(join(ROOT, OUT_MD), `${md.join("\n")}\n`, "utf8");

console.log(`Phase206: 対象 ${total}件 / 分類合計 ${sumOfCodes}件 / 分類不能 ${unclassified}件`);
for (const c of CODES) console.log(`  ${c}: ${byCode[c].length}`);
console.log(`検算: 詳細説明なし ${noDetailedExplanation} === 分類合計 ${sumOfCodes} → ${report.checks.matches ? "OK" : "NG"}`);

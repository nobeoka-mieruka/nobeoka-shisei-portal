import { backupJson, readExistingJson, readTable, writeDiffReport, writePreview } from "./lib/import-shared.mjs";

// TASK-021（Excel取込対象の拡大）：billVotes.json向けの取込スクリプト。
// import-members.mjsと同じ「下書き生成＋人手確認」フローに合わせる。
// 取込結果は src/data/billVotes.json を自動的に上書きしない。

const filePath = process.argv[2];
if (!filePath) {
  console.error("使い方: node scripts/import-bills.mjs <ファイルパス（.xlsx または .csv）>");
  process.exit(1);
}

const VALID_BILL_VOTE_RESULTS = new Set([
  "原案可決", "修正可決", "否決", "承認", "不承認", "認定", "不認定",
  "原案可決及び認定", "否決及び不認定", "同意", "不同意",
  "採択", "一部採択", "趣旨採択", "不採択",
  "継続審査", "撤回", "廃案", "その他", "確認中",
]);
const VALID_PROPOSER_TYPES = new Set(["mayor", "member", "committee", "other"]);
const VALID_BILL_VOTE_METHODS = new Set([
  "全会一致", "起立多数", "起立少数", "簡易採決", "記名投票", "無記名投票", "採決なし", "確認できず",
]);
const VALID_BILL_CATEGORIES = new Set([
  "条例", "予算", "決算", "契約", "財産取得", "人事", "意見書", "決議", "請願", "陳情", "専決処分", "その他", "不明",
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\//;

function s(v) {
  return String(v ?? "").trim();
}
function opt(v) {
  const t = s(v);
  return t || undefined;
}
function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(/[、,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function main() {
  const rows = await readTable(filePath);
  const errors = [];
  const results = [];
  const seenIds = new Set();

  rows.forEach((row, i) => {
    const line = i + 2;
    const id = s(row.id);
    const billNumber = s(row["議案番号"]);
    const billTitle = s(row["件名"]);
    const summary = s(row["概要"]);
    const result = s(row["議決結果"]);

    if (!id) errors.push(`${line}行目: idが空です`);
    else if (seenIds.has(id)) errors.push(`${line}行目: idが重複しています（${id}）`);
    else seenIds.add(id);

    if (!billNumber) errors.push(`${line}行目: 議案番号が空です（id=${id}）`);
    if (!billTitle) errors.push(`${line}行目: 件名が空です（id=${id}）`);
    if (!summary) errors.push(`${line}行目: 概要が空です（id=${id}）`);
    if (!VALID_BILL_VOTE_RESULTS.has(result)) errors.push(`${line}行目: 議決結果の値が不正です（${result}）`);

    const proposerType = opt(row["提出者区分"]);
    if (proposerType && !VALID_PROPOSER_TYPES.has(proposerType)) {
      errors.push(`${line}行目: 提出者区分の値が不正です（${proposerType}。mayor/member/committee/otherのいずれか）`);
    }
    const voteMethod = opt(row["採決方法"]);
    if (voteMethod && !VALID_BILL_VOTE_METHODS.has(voteMethod)) {
      errors.push(`${line}行目: 採決方法の値が不正です（${voteMethod}）`);
    }
    const category = opt(row["分類"]);
    if (category && !VALID_BILL_CATEGORIES.has(category)) {
      errors.push(`${line}行目: 分類の値が不正です（${category}）`);
    }
    const submittedDate = opt(row["提出日"]);
    if (submittedDate && !DATE_RE.test(submittedDate)) errors.push(`${line}行目: 提出日の形式が不正です（YYYY-MM-DD、${submittedDate}）`);
    const votingDate = opt(row["議決日"]);
    if (votingDate && !DATE_RE.test(votingDate)) errors.push(`${line}行目: 議決日の形式が不正です（YYYY-MM-DD、${votingDate}）`);
    if (submittedDate && votingDate && submittedDate > votingDate) {
      errors.push(`${line}行目: 議決日が提出日より前です（id=${id}）`);
    }

    const billDocumentUrl = opt(row["議案書URL"]);
    const resultDocumentUrl = opt(row["審議結果PDF URL"]);
    const transcriptUrl = opt(row["会議録URL"]);
    for (const [label, url] of [
      ["議案書URL", billDocumentUrl],
      ["審議結果PDF URL", resultDocumentUrl],
      ["会議録URL", transcriptUrl],
    ]) {
      if (url && !URL_RE.test(url)) errors.push(`${line}行目: ${label}の形式が不正です（${url}）`);
    }
    const hasAnyDocument = Boolean(billDocumentUrl || resultDocumentUrl || transcriptUrl);
    if (result && result !== "確認中" && !hasAnyDocument) {
      errors.push(`${line}行目: 議決結果が確定しているのに根拠資料URL（議案書URL／審議結果PDF URL／会議録URL）が1件もありません（id=${id}）`);
    }

    results.push({
      id,
      fiscalYear: s(row["会計年度"]),
      session: s(row["会期"]),
      sessionId: opt(row["会期ID"]),
      billNumber,
      billTitle,
      summary,
      submittedDate,
      votingDate,
      committee: opt(row["付託委員会"]),
      proposer: opt(row["提出者"]),
      proposerType,
      result,
      voteMethod,
      category,
      topics: splitList(row["トピック"]),
      billDocumentUrl,
      resultDocumentUrl,
      transcriptUrl,
      lastVerified: opt(row["最終確認日"]),
      // 取込機能では未対応の項目（既存データを保持したい場合は、この取込結果を手作業でマージしてください）
      memberVotes: [],
      individualVoteDisclosureStatus: "unconfirmed",
      // Excel/CSVからの取込＝人手入力データであることを明示する（自動抽出データと区別する、CLAUDE.md方針）
      extractionSource: "manual",
    });
  });

  console.log(`[import-bills] ${rows.length}行を読み込みました。`);

  if (errors.length > 0) {
    console.error(`\n[import-bills] ${errors.length}件のエラーが見つかったため、変換を中止しました。`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const backupPath = backupJson("src/data/billVotes.json");
  if (backupPath) console.log(`[import-bills] 既存データをバックアップしました: ${backupPath}`);

  const existing = readExistingJson("src/data/billVotes.json");
  const existingIds = new Set(existing.map((b) => b.id));
  const newIds = new Set(results.map((b) => b.id));

  const diffLines = [
    `# billVotes.json 取込プレビュー差分（${new Date().toISOString()}）`,
    "",
    `既存件数: ${existing.length} / 取込件数: ${results.length}`,
    "",
    "## 新規追加される議案ID",
    ...[...newIds].filter((id) => !existingIds.has(id)).map((id) => `- ${id}`),
    "",
    "## 既存データに存在するが、取込ファイルに含まれない議案ID（このままではプレビューに反映されません）",
    ...[...existingIds].filter((id) => !newIds.has(id)).map((id) => `- ${id}`),
    "",
    "## 双方に存在する議案ID（内容差分は手作業でご確認ください）",
    ...[...newIds].filter((id) => existingIds.has(id)).map((id) => `- ${id}`),
    "",
    "※ このプレビューは src/data/billVotes.json を自動的に上書きしません。",
    "  内容を確認し、問題なければ手作業でsrc/data/billVotes.jsonへ反映してください。",
    "  memberVotesはこの取込では空配列のままです。個人別賛否が必要な場合は別途手作業で追加してください。",
  ];

  const outPath = writePreview("generated/import-preview/bills.json", results);
  const diffPath = writeDiffReport("generated/import-preview/bills-diff.txt", diffLines);

  console.log(`[import-bills] プレビューを書き出しました: ${outPath}`);
  console.log(`[import-bills] 差分レポートを書き出しました: ${diffPath}`);
  console.log("[import-bills] src/data/billVotes.json は変更していません。");
}

main().catch((err) => {
  console.error("[import-bills] 変換に失敗しました:", err.message);
  process.exit(1);
});

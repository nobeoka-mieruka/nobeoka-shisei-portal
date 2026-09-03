/**
 * Phase207：一次資料だけで説明できる議案の一括改善（src/data/billVotes.json を更新する）。
 *
 * 処理対象は Phase206 の分類結果（reports/phase206-bill-explainability.json）だけに従う。
 * 判断に迷うもの・原文から安全に書けないものは一切処理しない（件数より正確さを優先）。
 *
 * 1. EXPLAINABLE_FROM_PRIMARY
 *    verificationNote に、過去フェーズが会議録本文から転記した「この議案固有の原文引用」があり、
 *    かつその引用が議案名の言い換えにとどまらない案件。引用を **そのまま** reason へ入れ、
 *    summary を既存 Level3 と同じ書式（原文引用＋議決結果＋出典の断り書き）に置き換える。
 *    文章の新規生成・要約・因果関係の補完は一切行わない。
 *
 * 2. SHARED_REASON
 *    複数議案が一括で提案説明され、共通説明のみが存在する案件。
 *    共通説明を個別の提案理由（reason）へ書くと「この議案固有の理由」と誤解されるため、
 *    専用フィールド sharedProposalStatement（原文引用＋出典）へ入れる。
 *    Phase160 が会議録本文まで到達しながら保留した56件は、あわせて
 *    sourceTextVerifiedAt（本文確認済み）を記録する（新規調査ゼロ。記録の反映のみ）。
 *
 * 実行しないこと：
 * - NO_INDIVIDUAL_REASON_CONFIRMED（資料に個別の理由が無いことを確認済み）への説明文生成
 * - SOURCE_NEEDS_STRUCTURING / SOURCE_INSUFFICIENT / HUMAN_REVIEW への書き込み
 *
 * 使い方:
 *   node --experimental-strip-types scripts/apply-phase207-explanations.mjs --dry-run
 *   node --experimental-strip-types scripts/apply-phase207-explanations.mjs --apply
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const APPLY = process.argv.includes("--apply");
const TODAY = new Date().toISOString().slice(0, 10);

const bills = readJson("src/data/billVotes.json");
const billById = new Map(bills.map((b) => [b.id, b]));
const phase206 = readJson("reports/phase206-bill-explainability.json");
const held56 = readJson("reports/phase160-held-for-future-56.json");
const heldById = new Map(held56.map((h) => [h.id, h]));

const { extractQuotedStatement } = await import("../src/lib/billExplainability.ts");

/* ------------------------------------------------------------------ *
 * 出典URL（sourceRef）の組み立て
 * 会議録検索システムのURL書式は、既存の transcriptUrl / relatedDocumentUrls と
 * 完全に同一のものだけを使う（新しいURL書式を発明しない）。
 * ------------------------------------------------------------------ */
const codes = new Set();
for (const b of bills) {
  const m = (b.transcriptUrl ?? "").match(/[?&]Code=([^&]+)/);
  if (m) codes.add(m[1]);
}
if (codes.size !== 1) throw new Error(`会議録URLのCodeが一意ではありません: ${[...codes].join(", ")}`);
const MINUTES_CODE = [...codes][0];
const minutesUrl = (fileName) =>
  `https://www.kensakusystem.jp/nobeoka/cgi-bin3/ResultFrame.exe?Code=${MINUTES_CODE}&fileName=${fileName}&startPos=0`;

/** verificationNote に記録された、提案理由説明が載っている会議録のファイル名。 */
const noteFileName = (note) => {
  const m = (note ?? "").match(/会議録（(R\d{6}[A-Z])）/);
  return m ? m[1] : null;
};

const PROPOSAL_DOC_TITLE = "議案の提案理由の説明（会議録）";
function ensureProposalDocument(bill, fileName) {
  const url = minutesUrl(fileName);
  const list = bill.relatedDocumentUrls ?? [];
  if (list.some((d) => d.url === url)) return false;
  bill.relatedDocumentUrls = [...list, { title: PROPOSAL_DOC_TITLE, url, sourceType: "会議録" }];
  return true;
}

/** 同じ追記を二重に書かない（再実行しても結果が変わらないようにする）。 */
function appendNote(bill, text) {
  const existing = (bill.verificationNote ?? "").trim();
  if (existing.includes("Phase206-207追記")) return;
  bill.verificationNote = existing ? `${existing} ${text}` : text;
}

/* ------------------------------------------------------------------ *
 * 1. EXPLAINABLE_FROM_PRIMARY
 * ------------------------------------------------------------------ */
const explainableIds = phase206.phase207Candidates.explainableFromPrimary;
const applied = [];
const skipped = [];

for (const id of explainableIds) {
  const bill = billById.get(id);
  if (!bill) {
    skipped.push({ id, reason: "billVotes.json に該当IDが無い" });
    continue;
  }
  const quote = extractQuotedStatement(bill.verificationNote);
  const fileName = noteFileName(bill.verificationNote);
  if (!quote || !fileName) {
    // 原文引用または出典ファイル名が取れないものは書かない（推測で補わない）。
    skipped.push({ id, reason: "原文引用または会議録ファイル名を取得できない" });
    continue;
  }
  if (!bill.transcriptUrl) {
    skipped.push({ id, reason: "sourceRef（会議録リンク）が無い" });
    continue;
  }
  bill.reason = quote;
  bill.summary = `${quote}議決結果は「${bill.result}」です。会議録（市長による議案の提案理由説明）に基づいて整理しています。`;
  bill.summarySource = "manual";
  bill.summaryGeneratedAt = TODAY;
  const addedDoc = ensureProposalDocument(bill, fileName);
  appendNote(
    bill,
    `【${TODAY} Phase206-207追記】Phase206 で、このverificationNoteに既に転記済みの原文引用を再点検した。` +
      `引用は議案名の言い換えではなく、この議案固有の事実（対象・相手方・経緯等）を含むため、` +
      `Phase207 で原文をそのまま提出理由として登録した（要約・言い換え・理由の補完は行っていない）。` +
      `「本案は」等で始まる定型の提案理由文が無いという以前の記録自体は変更していない。`,
  );
  applied.push({ id, type: "EXPLAINABLE_FROM_PRIMARY", fileName, addedDoc, quoteLength: quote.length });
}

/* ------------------------------------------------------------------ *
 * 2. SHARED_REASON
 * ------------------------------------------------------------------ */
const HELD_PREFIX = "複数議案一括説明（共通のみ）。共通理由：「";

/** Phase160 の保留記録から、会議録原文の引用だけを取り出す（Phase160自身の注記は除く）。 */
function heldQuote(held) {
  if (!held.note.startsWith(HELD_PREFIX)) return null;
  let body = held.note.slice(HELD_PREFIX.length);
  const close = body.indexOf("」");
  if (close >= 0) body = body.slice(0, close); // 「」で閉じている場合、以降はPhase160の作業メモ
  body = body.replace(/\s+/g, " ").trim();
  if (!body) return null;
  const heading = (held.what ?? "").trim();
  if (heading && !body.startsWith(heading)) body = `${heading} ${body}`;
  return body;
}

const sharedHeldIds = phase206.phase207Candidates.sharedReasonWithHeldRecord;
const sharedQuoteIds = phase206.phase207Candidates.sharedReasonWithQuoteOnly;

for (const id of sharedHeldIds) {
  const bill = billById.get(id);
  const held = heldById.get(id);
  if (!bill || !held) {
    skipped.push({ id, reason: "billVotes.json または Phase160 保留記録が無い" });
    continue;
  }
  const quote = heldQuote(held);
  if (!quote || !held.fileName) {
    skipped.push({ id, reason: "Phase160 保留記録から原文引用を取り出せない" });
    continue;
  }
  bill.sharedProposalStatement = {
    quote,
    sourceFileName: held.fileName,
    sourceUrl: minutesUrl(held.fileName),
    verifiedAt: TODAY,
    generatedFrom: "reports/phase160-held-for-future-56.json（Phase160が会議録本文から転記した一括説明の原文引用）",
  };
  // Phase160 は会議録本文を実際に確認しているため、本文確認済みとして記録する（新規調査は行っていない）。
  if (!bill.sourceTextVerifiedAt) bill.sourceTextVerifiedAt = TODAY;
  const addedDoc = ensureProposalDocument(bill, held.fileName);
  appendNote(
    bill,
    `【${TODAY} Phase206-207追記】Phase160 が会議録（${held.fileName}）本文を確認し、` +
      `この議案が他の議案と一括で提案説明されたこと、およびその共通説明の原文を記録していた。` +
      `Phase207 でその記録を反映し、共通説明を原文のまま sharedProposalStatement へ登録した。` +
      `この議案固有の提案理由は一次資料に無いため、reason は設定していない（推測で補わない）。`,
  );
  applied.push({ id, type: "SHARED_REASON_HELD", fileName: held.fileName, addedDoc, quoteLength: quote.length });
}

for (const id of sharedQuoteIds) {
  const bill = billById.get(id);
  if (!bill) {
    skipped.push({ id, reason: "billVotes.json に該当IDが無い" });
    continue;
  }
  const quote = extractQuotedStatement(bill.verificationNote);
  const fileName = noteFileName(bill.verificationNote);
  if (!quote || !fileName) {
    skipped.push({ id, reason: "原文引用または会議録ファイル名を取得できない" });
    continue;
  }
  bill.sharedProposalStatement = {
    quote,
    sourceFileName: fileName,
    sourceUrl: minutesUrl(fileName),
    verifiedAt: bill.sourceTextVerifiedAt ?? TODAY,
    generatedFrom: "billVotes.json の verificationNote（過去フェーズが会議録本文から転記した一括説明の原文引用）",
  };
  const addedDoc = ensureProposalDocument(bill, fileName);
  applied.push({ id, type: "SHARED_REASON_QUOTE", fileName, addedDoc, quoteLength: quote.length });
}

/* ------------------------------------------------------------------ *
 * 検算と書き出し
 * ------------------------------------------------------------------ */
if (bills.length !== 1177) throw new Error(`議案総数が1177件ではありません: ${bills.length}`);

const hasCitizenSummary = (b) =>
  b.summarySource === "manual" && Boolean(b.reason || (b.mainChanges && b.mainChanges.length > 0) || b.citizenImpact);
const level = (b) => {
  if (!(b.sourceFilePath || b.sourceDocumentId)) return 0;
  if (hasCitizenSummary(b)) return 3;
  if (b.sourceTextVerifiedAt) return 2;
  return 1;
};

// 説明文（reason）またはsharedProposalStatementを持つ議案は、必ず根拠URLを持つこと。
const missingSourceRef = bills
  .filter((b) => hasCitizenSummary(b) || b.sharedProposalStatement)
  .filter((b) => !b.transcriptUrl && !(b.relatedDocumentUrls ?? []).some((d) => d.sourceType === "会議録"))
  .map((b) => b.id);
if (missingSourceRef.length > 0) throw new Error(`根拠URLの無い説明があります: ${missingSourceRef.join(", ")}`);

const summary = {
  generatedAt: TODAY,
  phase: "Phase207",
  totalBills: bills.length,
  candidates: {
    EXPLAINABLE_FROM_PRIMARY: explainableIds.length,
    SHARED_REASON_HELD: sharedHeldIds.length,
    SHARED_REASON_QUOTE: sharedQuoteIds.length,
  },
  appliedCount: applied.length,
  skippedCount: skipped.length,
  skipped,
  levels: {
    level1: bills.filter((b) => level(b) === 1).length,
    level2: bills.filter((b) => level(b) === 2).length,
    level3: bills.filter((b) => level(b) === 3).length,
  },
  sourceTextVerified: bills.filter((b) => b.sourceTextVerifiedAt).length,
  sharedProposalStatementCount: bills.filter((b) => b.sharedProposalStatement).length,
  sourceRefVerified: bills.filter((b) => hasCitizenSummary(b) || b.sharedProposalStatement).length,
  missingSourceRef,
  applied,
};

console.log(JSON.stringify({ ...summary, applied: `${applied.length}件`, skipped: `${skipped.length}件` }, null, 2));

if (APPLY) {
  writeFileSync(join(ROOT, "src/data/billVotes.json"), `${JSON.stringify(bills, null, 2)}\n`, "utf8");
  writeFileSync(join(ROOT, "reports/phase207-apply-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log("\n書き込みました（src/data/billVotes.json / reports/phase207-apply-summary.json）");
} else {
  console.log("\n--dry-run（--apply を付けると書き込みます）");
}

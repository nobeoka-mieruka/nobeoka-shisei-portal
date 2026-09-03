/**
 * Phase193：初期ロード用の軽量インデックスを生成する。
 *
 * 【背景】
 * `src/lib/seo.ts`（usePageTitle経由で全ページが読み込む）とトップページ（HomePage）は、
 * 件名・件数・テーマ分類といった「短い値」しか使っていないにもかかわらず、
 * `src/data/councilSpeechSummaries.json`（約6.0MB）と`src/data/billVotes.json`（約2.6MB）を
 * まるごとimportしていた。これらはエントリチャンク（index.js）の静的依存になるため、
 * トップページを開いただけで全議案・全発言要約の本文がダウンロードされていた
 * （共有チャンク`usePageTitle-*.js`が7.8MB／gzip 1.1MBまで肥大化していた原因）。
 *
 * 【この生成物の位置づけ】
 * ここで生成するのは「既存データの純粋な射影（フィールドの絞り込み）」であり、
 * 値の加工・推測・補完は一切しない。件数や表示文言は元データと完全に一致する。
 * 本文（質問項目・出典一覧・議案の要約文や資料URL等）が必要な画面は、
 * 引き続き元データ（councilSpeechSummaries.json / billVotes.json）を直接importすること。
 *
 * 出力：
 * - src/data/councilSpeechIndex.json … councilSpeechSummaries.jsonから本文系フィールドを除いたもの
 * - src/data/billVotesIndex.json     … billVotes.jsonからSEO・件数集計に必要な項目だけを抜き出したもの
 * - src/data/mayorPromiseMeasuresIndex.json
 *       … mayorPromiseMeasures.jsonから、件数集計と公約との対応確認に必要なIDだけを抜き出したもの
 *         （Phase202：市長公約の3階層の件数をseo.tsが参照するため。実績・予定の本文は含めない）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(projectRoot, "src", "data");

function readJson(name) {
  return JSON.parse(readFileSync(path.join(dataDir, name), "utf8"));
}

/** 生成物の差分が無いときはファイルを書き換えない（不要なgit差分・再ビルドを避ける）。 */
function writeJsonIfChanged(name, value) {
  const file = path.join(dataDir, name);
  const next = `${JSON.stringify(value, null, 2)}\n`;
  let current = null;
  try {
    current = readFileSync(file, "utf8");
  } catch {
    current = null;
  }
  if (current === next) return { file, bytes: next.length, changed: false };
  writeFileSync(file, next, "utf8");
  return { file, bytes: next.length, changed: true };
}

// ---------------------------------------------------------------------------
// 1. 発言要約インデックス（councilSpeechIndex.json）
// ---------------------------------------------------------------------------
// councilSpeechSummaries.jsonと同じ形（CouncilSpeechSummaryData）を保ちつつ、
// 本文にあたる questionItems（約1.2MB）・summarySources（約1.0MB）を空配列にし、
// 表示用の文章（shortSummary・verificationNote）を除く。
// 件数集計で必要な questionItems.length は questionItemCount として保持する。
function buildCouncilSpeechIndex(source) {
  return {
    version: source.version,
    generatedAt: source.generatedAt,
    /** 本文（questionItems・summarySources）を含まない軽量版であることの目印。 */
    isLightweightIndex: true,
    members: source.members.map((member) => ({
      ...member,
      speeches: (member.speeches ?? []).map((speech) => {
        const entry = {
          ...speech,
          questionItems: [],
          questionItemCount: (speech.questionItems ?? []).length,
          summarySources: [],
        };
        delete entry.shortSummary;
        delete entry.verificationNote;
        return entry;
      }),
    })),
  };
}

// ---------------------------------------------------------------------------
// 2. 議案インデックス（billVotesIndex.json）
// ---------------------------------------------------------------------------
// SEO（議案詳細のtitle・description）と件数集計（公開件数・提出者区分の確認率・
// 議員別の賛否有無）に必要な項目だけを抜き出す。要約文・資料URL・確認メモなどは含めない。
const BILL_INDEX_FIELDS = [
  "id",
  "billNumber",
  "billTitle",
  "result",
  "verificationStatus",
  "publicationStatus",
  "proposerType",
];

function buildBillVotesIndex(bills) {
  return bills.map((bill) => {
    const entry = {};
    for (const key of BILL_INDEX_FIELDS) {
      if (bill[key] !== undefined) entry[key] = bill[key];
    }
    // 「この議員の賛否がこの議案で確認できるか」の判定にのみ使う。賛否の内訳（vote）や
    // 氏名・会派は含めない（必要な画面はbillVotes.jsonを直接参照する）。
    // 個人別賛否が公開されていない議案では項目自体を省く（「賛否が確認できる議員が1人もいない」
    // ことは省略で表し、未確認の推測値は入れない）。
    const memberIdsWithVote = (bill.memberVotes ?? []).map((v) => v.memberId);
    if (memberIdsWithVote.length > 0) entry.memberIdsWithVote = memberIdsWithVote;
    return entry;
  });
}

// ---------------------------------------------------------------------------
// 3. 市長公約の個別施策インデックス（mayorPromiseMeasuresIndex.json）
// ---------------------------------------------------------------------------
// Phase202：市長公約の3階層（政策分野・個別公約・個別施策）の件数を、全ページが読み込む
// src/lib/seo.ts のmeta description・JSON-LDでも使うため、IDと進捗区分だけの射影を用意する。
// 実績・予定・注記等の本文はここに含めない（必要な画面はmayorPromiseMeasures.jsonを直接参照する）。
const MEASURE_INDEX_FIELDS = ["measureId", "promiseId", "categoryId", "status"];

function buildMayorPromiseMeasuresIndex(measures) {
  return measures.map((m) => {
    const entry = {};
    for (const key of MEASURE_INDEX_FIELDS) {
      if (m[key] !== undefined) entry[key] = m[key];
    }
    return entry;
  });
}

const speechSource = readJson("councilSpeechSummaries.json");
const billsSource = readJson("billVotes.json");
const measureSource = readJson("mayorPromiseMeasures.json");

const speechIndex = buildCouncilSpeechIndex(speechSource);
const billIndex = buildBillVotesIndex(billsSource);
const measureIndex = buildMayorPromiseMeasuresIndex(measureSource);

// 射影の健全性チェック（件数が元データと一致すること）。
const sourceSpeechCount = speechSource.members.reduce((sum, m) => sum + (m.speeches ?? []).length, 0);
const indexSpeechCount = speechIndex.members.reduce((sum, m) => sum + m.speeches.length, 0);
if (sourceSpeechCount !== indexSpeechCount) {
  throw new Error(`[generate-data-indexes] 発言件数が一致しません: ${sourceSpeechCount} !== ${indexSpeechCount}`);
}
if (billsSource.length !== billIndex.length) {
  throw new Error(`[generate-data-indexes] 議案件数が一致しません: ${billsSource.length} !== ${billIndex.length}`);
}
if (measureSource.length !== measureIndex.length) {
  throw new Error(
    `[generate-data-indexes] 個別施策件数が一致しません: ${measureSource.length} !== ${measureIndex.length}`,
  );
}

const speechResult = writeJsonIfChanged("councilSpeechIndex.json", speechIndex);
const billResult = writeJsonIfChanged("billVotesIndex.json", billIndex);
const measureResult = writeJsonIfChanged("mayorPromiseMeasuresIndex.json", measureIndex);

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
console.log(
  `[generate-data-indexes] councilSpeechIndex.json ${kb(speechResult.bytes)}（発言${indexSpeechCount}件、${speechResult.changed ? "更新" : "変更なし"}）`,
);
console.log(
  `[generate-data-indexes] billVotesIndex.json ${kb(billResult.bytes)}（議案${billIndex.length}件、${billResult.changed ? "更新" : "変更なし"}）`,
);
console.log(
  `[generate-data-indexes] mayorPromiseMeasuresIndex.json ${kb(measureResult.bytes)}（個別施策${measureIndex.length}件、${measureResult.changed ? "更新" : "変更なし"}）`,
);

/**
 * Phase205：次期改善対象の確定（分析のみ。src/data配下は一切変更しない）。
 *
 * A. 議案詳細説明（src/data/billVotes.json 全1,177件）を、既存の判定ロジック
 *    （src/lib/billSummaryQuality.ts の Level0〜3、src/lib/billSourceRetrieval.ts の A/B/C/D）と
 *    同じ定義で集計し、次に安全に改善できる候補を Priority A / B / C へ整理する。
 * B. 市長公約14件（src/data/mayorPromises.json）について、既存の自由記述フィールド
 *    （relatedBudget / relatedBill / relatedBillVoteIds / relatedBudgetCandidates）と
 *    src/data/mayorPromiseMeasures.json から、予算・議案・成果の確認状態を機械可読へ構造化する。
 *
 * 重要な前提（推測を混ぜないための取り決め）：
 * - 「関連議案なし（確認済み）」と「まだ確認できていない」を必ず別コードで区別する。
 * - 判定は既存フィールドの文字列にのみ基づく。オンライン調査・推測補完は行わない。
 * - 状態名は Phase166（reports/phase166-mayor-promise-audit.json）の
 *   confirmed / candidate / unconfirmed を再利用し、それだけでは表せない
 *   「なぜ unconfirmed なのか」だけを reason code として追加する。
 *
 * 使い方: node scripts/analyze-phase205.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const bills = readJson("src/data/billVotes.json");
const promisesFile = readJson("src/data/mayorPromises.json");
const measures = readJson("src/data/mayorPromiseMeasures.json");
const held56 = readJson("reports/phase160-held-for-future-56.json");
const blocked = readJson("src/data/blockedTaskClassification.json");

/* ------------------------------------------------------------------ *
 * A. 議案詳細説明
 * ------------------------------------------------------------------ */

/** 出典（審議結果PDF等）が紐付いているか（billSummaryQuality.isSourceLinked と同一定義）。 */
const isSourceLinked = (b) => Boolean(b.sourceFilePath || b.sourceDocumentId);
/** 一次資料本文を人が実際に確認したか（billSummaryQuality.isSourceTextVerified と同一定義）。 */
const isSourceTextVerified = (b) => Boolean(b.sourceTextVerifiedAt);
/** 一次資料本文に基づく市民向けの説明があるか（billSummaryQuality.hasCitizenSummary と同一定義）。 */
const hasCitizenSummary = (b) =>
  b.summarySource === "manual" && Boolean(b.reason || (b.mainChanges && b.mainChanges.length > 0) || b.citizenImpact);
/** billSummaryQuality.getBillExplanationLevel と同一定義。 */
const explanationLevel = (b) => {
  if (!isSourceLinked(b)) return 0;
  if (hasCitizenSummary(b)) return 3;
  if (isSourceTextVerified(b)) return 2;
  return 1;
};
/** billSourceRetrieval.classifyBillSourceRetrieval と同一定義。 */
const STRUCTURED_CATEGORIES = new Set(["予算", "契約", "財産取得", "決算", "専決処分"]);
const LINK_CONFIRMED_YEARS = new Set(["令和5年度", "令和6年度", "令和7年度", "令和8年度"]);
const sourceRetrieval = (b) => {
  if (b.transcriptUrl) return STRUCTURED_CATEGORIES.has(b.category ?? "") ? "A" : "B";
  if (LINK_CONFIRMED_YEARS.has(b.fiscalYear)) return "B";
  return "D";
};
/** 通常の「市長提案理由説明」という枠組みが適用できないカテゴリ（billRiskClassification の HOLD と同じ考え方）。 */
const NON_MAYOR_PROPOSAL_CATEGORIES = new Set(["意見書", "決議", "請願", "陳情"]);

/** verificationNote から「原文に個別の提案理由が無いことを確認済み」かを判定する。 */
const NO_INDIVIDUAL_REASON_RE = /(個別の提案理由|固有の提案理由)[^。]{0,20}(見当たらな|記載が(?:無|な)い|ありませんでした)/;
const BATCH_STATEMENT_RE = /複数議案一括|一括説明|議案の対象は確認できた/;

const tally = (list, key) => {
  const m = {};
  for (const b of list) {
    const k = String(typeof key === "function" ? key(b) : b[key]);
    m[k] = (m[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};

const level = new Map(bills.map((b) => [b.id, explanationLevel(b)]));
const byLevel = (n) => bills.filter((b) => level.get(b.id) === n);
const heldIds = new Set(held56.map((h) => h.id));

const l1 = byLevel(1);
const l2 = byLevel(2);
const l3 = byLevel(3);

// Priority A：一次資料本文確認済み（Level2）＋ 説明未作成
const priorityA = l2.map((b) => {
  const note = b.verificationNote ?? "";
  const absenceConfirmed = NO_INDIVIDUAL_REASON_RE.test(note);
  return {
    id: b.id,
    session: b.session,
    billNumber: b.billNumber,
    billTitle: b.billTitle,
    category: b.category,
    fiscalYear: b.fiscalYear,
    // A-1：原文を読んだうえで「この議案固有の提案理由は記載されていない」と確認済み。
    //      これは「説明を書き忘れている」のではなく「一次資料に書く材料が無い」状態であり、
    //      ここに説明文を新規生成することは推測の混入になる。
    // A-2：本文確認の記録はあるが、個別記載の有無について記述が無く、再確認の余地があるもの。
    subCode: absenceConfirmed ? "NO_INDIVIDUAL_REASON_CONFIRMED" : "RECHECK_CANDIDATE",
    hasBatchStatement: BATCH_STATEMENT_RE.test(note),
    verificationNoteLength: note.length,
  };
});

// Priority B：一次資料あり ＋ 追加構造化が必要（Level1 のうち、一次資料へ到達済み／到達手段が確立しているもの）
const priorityB = l1
  .filter((b) => heldIds.has(b.id) || Boolean(b.transcriptUrl))
  .map((b) => {
    const isHeld = heldIds.has(b.id);
    const blockedByPersonalInfo = b.category === "人事";
    const nonMayorProposal = NON_MAYOR_PROPOSAL_CATEGORIES.has(b.category) || b.proposerType !== "mayor";
    return {
      id: b.id,
      session: b.session,
      billNumber: b.billNumber,
      billTitle: b.billTitle,
      category: b.category,
      fiscalYear: b.fiscalYear,
      proposerType: b.proposerType ?? null,
      sourceRetrieval: sourceRetrieval(b),
      // B-1：Phase160 で一次資料本文（会議録）まで到達し、共通の一括説明文まで引用済みだが、
      //      billVotes.json 側へ sourceTextVerifiedAt が記録されないまま保留された56件。
      //      新たな調査を必要とせず、既存レポートの記録を反映するだけで前進する。
      // B-2：会議録リンク（transcriptUrl）が既に登録済みで、本文へ到達できる Level1。
      subCode: isHeld ? "HELD_RECORD_NOT_APPLIED" : "TRANSCRIPT_LINKED_NOT_READ",
      blockedByPersonalInfo,
      nonMayorProposal,
      workableNow: !blockedByPersonalInfo && !nonMayorProposal,
    };
  });

// Priority C：原資料（会議録リンク）が未登録で、追加の到達作業が先に必要なもの
const priorityC = l1
  .filter((b) => !heldIds.has(b.id) && !b.transcriptUrl)
  .map((b) => ({
    id: b.id,
    session: b.session,
    billNumber: b.billNumber,
    billTitle: b.billTitle,
    category: b.category,
    fiscalYear: b.fiscalYear,
    // C-1：会議録そのものが未公開（令和8年5月臨時会・6月定例会）。TASK-004（WAITING_EXTERNAL）。
    //      日次の自動巡回で公開され次第反映される。人手の再調査で解決するものではない。
    // C-2：会議録は公開済みだが、この議案への個別リンクが未登録（sourceRetrievalUnresolved）。
    subCode: b.fiscalYear === "令和8年度" ? "MINUTES_NOT_PUBLISHED" : "TRANSCRIPT_LINK_UNRESOLVED",
    sourceRetrieval: sourceRetrieval(b),
  }));

const missing = (field) => bills.filter((b) => b[field] === undefined || b[field] === null).map((b) => b.id);

const billReport = {
  generatedAt: new Date().toISOString().slice(0, 10),
  phase: "Phase205",
  scope: "src/data/billVotes.json",
  totalBills: bills.length,
  fieldDefinitions: {
    出典確認済み: "sourceFilePath または sourceDocumentId のいずれかが存在する（審議結果PDF等が紐付いている）。src/lib/billSummaryQuality.ts の isSourceLinked と同一。",
    一次資料本文確認済み: "sourceTextVerifiedAt が存在する（会議録等の本文を人が実際に確認した日付が記録されている）。同 isSourceTextVerified と同一。",
    詳細説明あり: "summarySource === \"manual\" かつ reason / mainChanges（1件以上）/ citizenImpact のいずれかを保有する。同 hasCitizenSummary と同一（＝Level3）。",
    詳細説明なし: "上記『詳細説明あり』に該当しない議案（Level1＋Level2）。",
    原資料未確認: "sourceTextVerifiedAt が無く、かつ詳細説明も無い（＝Level1）。出典PDFは全件紐付いているため『出典が無い』という意味ではない。",
    HUMAN_ACTION_REQUIRED: "billVotes.json 内には該当フィールド・該当値は存在しない（0件）。人手対応の管理台帳は src/data/blockedTaskClassification.json 側にある。",
    source不足: "transcriptUrl（会議録本文へのリンク）が未登録の議案。resultDocumentUrl（審議結果PDF）は全件登録済みのため、出典が皆無という意味ではない。",
  },
  counts: {
    出典確認済み: bills.filter(isSourceLinked).length,
    一次資料本文確認済み: bills.filter(isSourceTextVerified).length,
    詳細説明あり: bills.filter(hasCitizenSummary).length,
    詳細説明なし: bills.length - bills.filter(hasCitizenSummary).length,
    原資料未確認: l1.length,
    HUMAN_ACTION_REQUIRED: 0,
    source不足: bills.filter((b) => !b.transcriptUrl).length,
  },
  explanationLevels: {
    level0_出典未確認: byLevel(0).length,
    level1_議案名議決結果出典のみ: l1.length,
    level2_一次資料本文確認済み: l2.length,
    level3_本文に基づく説明あり: l3.length,
  },
  sourceRetrievalCrossTab: (() => {
    const m = { A: {}, B: {}, C: {}, D: {} };
    for (const cat of ["A", "B", "C", "D"]) m[cat] = { Level1: 0, Level2: 0, Level3: 0 };
    for (const b of bills) m[sourceRetrieval(b)][`Level${explanationLevel(b)}`] += 1;
    return m;
  })(),
  missingFields: {
    voteMethod未登録: missing("voteMethod").length,
    committee未登録: missing("committee").length,
    proposerType未登録: missing("proposerType"),
    votingDate未登録: missing("votingDate").length,
  },
  relatedBlockedTasks: blocked
    .filter((t) => /議案|billVotes/.test(`${t.title}${t.reasonSummary ?? ""}`))
    .map((t) => ({ taskId: t.taskId, title: t.title, status: t.status, blockedReasonCode: t.blockedReasonCode ?? null })),
  priorities: {
    A: {
      label: "一次資料本文確認済み ＋ 説明未作成（Level2）",
      count: priorityA.length,
      bySubCode: tally(priorityA, "subCode"),
      byCategory: tally(priorityA, "category"),
      byFiscalYear: tally(priorityA, "fiscalYear"),
      recommendation:
        "NO_INDIVIDUAL_REASON_CONFIRMED は『説明を書き忘れている』のではなく『一次資料に個別の提案理由が記載されていないことを確認済み』の状態。ここへ説明文を新規生成すると推測の混入になるため、文章生成ではなく、共通の一括説明を出典付きで示す表示改善（既存 verificationNote の構造化）が安全な方向。",
      items: priorityA,
    },
    B: {
      label: "一次資料あり ＋ 追加構造化が必要（Level1・本文へ到達済みまたは到達手段が確立済み）",
      count: priorityB.length,
      workableNow: priorityB.filter((x) => x.workableNow).length,
      bySubCode: tally(priorityB, "subCode"),
      byCategory: tally(priorityB, "category"),
      byFiscalYear: tally(priorityB, "fiscalYear"),
      recommendation:
        "HELD_RECORD_NOT_APPLIED（56件）は Phase160 が会議録本文まで到達し共通説明文を引用済みだが、billVotes.json へ sourceTextVerifiedAt を書かずに保留したもの。新規調査ゼロで前進できる唯一のまとまった候補。ただし Level1→Level2 の件数が動くため、Phase162 系の既存テストの期待値更新とセットで実施する必要がある。",
      items: priorityB,
    },
    C: {
      label: "原資料不足（会議録リンク未登録／会議録未公開）",
      count: priorityC.length,
      bySubCode: tally(priorityC, "subCode"),
      byCategory: tally(priorityC, "category"),
      byFiscalYear: tally(priorityC, "fiscalYear"),
      recommendation:
        "MINUTES_NOT_PUBLISHED は TASK-004（WAITING_EXTERNAL）と同一の理由で、日次の自動巡回により公開され次第反映される。人手の再調査では解決しない。TRANSCRIPT_LINK_UNRESOLVED は会議録自体は公開済みで、議案への個別リンク付与という機械的作業が先に必要。",
      items: priorityC,
    },
  },
};
billReport.priorityTotalCheck = {
  sum: priorityA.length + priorityB.length + priorityC.length,
  expected: billReport.counts.詳細説明なし,
  matches: priorityA.length + priorityB.length + priorityC.length === billReport.counts.詳細説明なし,
};

/* ------------------------------------------------------------------ *
 * B. 市長公約 → 予算 → 議案 → 成果
 * ------------------------------------------------------------------ */

/**
 * 状態名の方針：
 * - status は Phase166（reports/phase166-mayor-promise-audit.json）で既に使われている
 *   confirmed / candidate / unconfirmed をそのまま再利用する（新しい status enum は導入しない）。
 * - status だけでは「関連議案なし（確認済み）」と「まだ確認できていない」を区別できないため、
 *   unconfirmed の理由だけを reasonCode として追加する。これは既存 status の置き換えではなく補足。
 */
const HEDGE_RE = /断定は(?:して)?いない|断定していない/;

/** relatedBudget の自由記述から予算の確認状態を読み取る。 */
function classifyBudget(p) {
  const t = p.relatedBudget ?? "";
  const confirmed = /公約と事業の対応関係を一次資料で確認できた|一次資料の内容一致で確認できた|同一の新規事業（No\.\d+）であることを確認できた/.test(t);
  if (confirmed) {
    return { status: "confirmed", reasonCode: null, hasCandidates: (p.relatedBudgetCandidates ?? []).length > 0 };
  }
  let reasonCode = "UNDER_REVIEW";
  if (/主要事業一覧|主な事業/.test(t) && /記載は無かった|掲載が無い/.test(t)) reasonCode = "NOT_IN_MAJOR_PROJECT_LIST";
  else if (/既存の人件費・事務費の枠内/.test(t)) reasonCode = "WITHIN_EXISTING_OPERATING_COST";
  else if (/複数年度・複数議案にまたが/.test(t)) reasonCode = "MULTI_YEAR_MULTI_BILL";
  return { status: "unconfirmed", reasonCode, hasCandidates: (p.relatedBudgetCandidates ?? []).length > 0 };
}

/** relatedBill / relatedBillVoteIds から議案の確認状態を読み取る。 */
function classifyBill(p) {
  const t = p.relatedBill ?? "";
  const ids = p.relatedBillVoteIds ?? [];
  if (ids.length > 0) {
    return { status: "confirmed", reasonCode: "CONFIRMED_RELATED_BILL", billVoteIds: ids, hedged: false };
  }
  let reasonCode = "NOT_INTERPRETED";
  if (/当初予算（議案第\d+号[^）]*）に含まれる歳出予算の一部/.test(t) && /独立の議案は無い|独立の議案が(?:無|な)い/.test(t)) {
    // 一次資料に「個別事業単位で議決された独立の議案は無い」と明記され、
    // かつ当初予算議案に包含されると説明されているもの。
    reasonCode = "BUDGET_BILL_INCLUDED";
  } else if (/条例改正議案が提出される可能性が高く|その時点で本欄を更新する/.test(t)) {
    // 将来、組織条例改正等の議案が提出される見込みのもの（現時点で議案が無いのは実態と整合）。
    reasonCode = "PENDING_FUTURE_BILL";
  } else if (/議案化を伴わない可能性が高い|議案化されていない可能性が高い/.test(t)) {
    // 要綱・人事措置・運用改善等、制度上そもそも議案を要しない可能性が高いと整理されたもの。
    // ただし原文が「断定はしていない」と明記しているため、確認済みの『議案なし』ではない。
    reasonCode = "NO_SEPARATE_BILL_LIKELY";
  }
  return { status: "unconfirmed", reasonCode, billVoteIds: [], hedged: HEDGE_RE.test(t) };
}

const measuresByPromise = new Map();
for (const m of measures) {
  if (!measuresByPromise.has(m.promiseId)) measuresByPromise.set(m.promiseId, []);
  measuresByPromise.get(m.promiseId).push(m);
}

/** mayorPromiseMeasures.json の実績欄から成果の確認状態を読み取る。 */
function classifyOutcome(promiseId) {
  const ms = measuresByPromise.get(promiseId) ?? [];
  const withResult = ms.filter((m) => m.currentYearResult);
  const withPrevious = ms.filter((m) => m.previousYearResult);
  if (withResult.length > 0) {
    return { status: "confirmed", reasonCode: null, measureCount: ms.length, withCurrentYearResult: withResult.length };
  }
  return {
    status: "unconfirmed",
    reasonCode: withPrevious.length > 0 ? "PREVIOUS_YEAR_ONLY" : "PLAN_ONLY",
    measureCount: ms.length,
    withCurrentYearResult: 0,
  };
}

const promiseRows = promisesFile.promises.map((p) => {
  const budget = classifyBudget(p);
  const bill = classifyBill(p);
  const outcome = classifyOutcome(p.id);
  return {
    id: p.id,
    categoryId: p.categoryId,
    promiseText: p.promiseText,
    progressStatus: p.status,
    progressStatusLabel: p.statusLabel,
    budgetLinkage: budget,
    billLinkage: bill,
    outcome,
    evidenceItemCount: (p.evidenceItems ?? []).length,
    progressHistoryCount: (p.progressHistory ?? []).length,
    lastVerified: p.lastVerified,
  };
});

/**
 * 次回重点調査の優先度。
 * 判定根拠は「一次資料が特定できているか」と「1回の調査で解ける公約数」。
 * 推測での順位付けはしない（各行に理由を明記する）。
 */
function investigationPriority(row) {
  if (row.budgetLinkage.reasonCode === "NOT_IN_MAJOR_PROJECT_LIST") {
    return {
      rank: 1,
      reason:
        "relatedBudget 本文が『予算に関する説明書等のより詳細な資料での確認が必要』と、次に見るべき一次資料を具体的に名指ししている。同じ1資料で複数公約が同時に解決する。",
      nextSource: "令和8年度 延岡市予算に関する説明書（当初予算）",
    };
  }
  if (row.budgetLinkage.reasonCode === "WITHIN_EXISTING_OPERATING_COST") {
    return { rank: 2, reason: "既存の人件費・事務費の枠内とみられるが未確認。予算に関する説明書の組織費目で確認できる可能性がある。", nextSource: "令和8年度 延岡市予算に関する説明書（総務費）" };
  }
  if (row.billLinkage.reasonCode === "PENDING_FUTURE_BILL") {
    return { rank: 3, reason: "将来の組織条例改正議案の提出を待つ状態。新規調査ではなく、既存の日次自動巡回による議案監視で足りる。", nextSource: "延岡市議会 議案等審議結果（自動巡回）" };
  }
  if (row.budgetLinkage.reasonCode === "MULTI_YEAR_MULTI_BILL") {
    return { rank: 4, reason: "個別の工事請負契約金額は relatedBillVoteIds の各議案（いずれもLevel3・一次資料確認済み）に既に記載があり、relatedBudget からも参照済み。追加調査の必要性は低い。", nextSource: "（追加調査不要）" };
  }
  if (row.billLinkage.reasonCode === "NOT_INTERPRETED") {
    return { rank: 5, reason: "議案検索で該当0件だが、なぜ議案が無いのか（要綱か・別事業か）の整理が未記載。既存 relatedBill 本文の整理のみで前進する。", nextSource: "（既存データの整理）" };
  }
  return { rank: 6, reason: "予算・議案とも一次資料で確認済み。次は成果（実績値）の確認が中心。", nextSource: "「市長公約に関する取組み」次年度版" };
}

for (const row of promiseRows) {
  row.investigation = investigationPriority(row);
  // 優先度は「次に見るべき一次資料が特定できているか」で決めているため、
  // 議案側の未整理（NOT_INTERPRETED）が rank 5 以外の行に埋もれることがある。落とさず併記する。
  if (row.billLinkage.reasonCode === "NOT_INTERPRETED" && row.investigation.rank !== 5) {
    row.investigation.secondaryNote =
      "議案側も未整理（NOT_INTERPRETED）。議案検索で該当0件だが、議案が無い理由の整理が relatedBill 本文に記載されていない。";
  }
}
promiseRows.sort((a, b) => a.investigation.rank - b.investigation.rank || a.id.localeCompare(b.id));

const promiseReport = {
  generatedAt: new Date().toISOString().slice(0, 10),
  phase: "Phase205",
  scope: ["src/data/mayorPromises.json", "src/data/mayorPromiseMeasures.json"],
  promiseCount: promisesFile.promises.length,
  measureCount: measures.length,
  referenceDate: promisesFile.referenceDate,
  lastVerified: promisesFile.lastVerified,
  statusVocabulary: {
    note:
      "status は Phase166（reports/phase166-mayor-promise-audit.json）の confirmed / candidate / unconfirmed をそのまま再利用している（新しい status enum は導入していない）。reasonCode は status を置き換えるものではなく、『unconfirmed の理由』だけを補足するために追加した。理由：既存の3値だけでは『関連議案が無いことを確認済み』と『まだ確認できていない』が同じ unconfirmed に潰れてしまい、両者を区別せよという要件を満たせないため。",
    budgetReasonCodes: {
      NOT_IN_MAJOR_PROJECT_LIST: "市長定例記者会見資料の主要事業一覧に該当項目の記載が無かった。同資料は大規模事業の抜粋であり、予算が存在しないことを意味しない（＝未確認）。",
      WITHIN_EXISTING_OPERATING_COST: "既存の人件費・事務費の枠内で実施されているとみられるが、独立した予算額の明記は未確認。",
      MULTI_YEAR_MULTI_BILL: "複数年度・複数議案にまたがる大型公共工事のため、単一年度の予算額としては特定できていない。個別金額は関連議案側に記載あり。",
      UNDER_REVIEW: "上記のいずれにも当てはまらない未確認。",
    },
    billReasonCodes: {
      CONFIRMED_RELATED_BILL: "relatedBillVoteIds に、議案名または提案理由本文で対象施設・事業が直接確認できた議案が登録されている。",
      BUDGET_BILL_INCLUDED: "当初予算議案に含まれる歳出予算の一部であり、個別事業単位で議決された独立の議案は無い、と一次資料に基づき整理済み。",
      PENDING_FUTURE_BILL: "現時点で議案が存在しないのは実態と整合し、将来の制度変更時に議案が提出される見込み。",
      NO_SEPARATE_BILL_LIKELY: "要綱・人事上の措置・運用改善等、制度上そもそも議案化を伴わない可能性が高いと整理済み。ただし原文が『断定はしていない』と明記しているため、『議案なしを確認済み』とは扱わない。",
      NOT_INTERPRETED: "議案検索で該当0件だが、議案が無い理由の整理が relatedBill 本文に記載されていない（＝未確認）。",
    },
    outcomeReasonCodes: {
      PREVIOUS_YEAR_ONLY: "前年度実績のみ確認でき、当年度の実績値は未確認（計画値のみ）。",
      PLAN_ONLY: "計画値のみで、前年度・当年度とも実績値は未確認。",
    },
  },
  summary: {
    budget: {
      byStatus: tally(promiseRows, (r) => r.budgetLinkage.status),
      byReasonCode: tally(promiseRows, (r) => r.budgetLinkage.reasonCode ?? "(confirmed)"),
      withCandidates: promiseRows.filter((r) => r.budgetLinkage.hasCandidates).length,
    },
    bill: {
      byStatus: tally(promiseRows, (r) => r.billLinkage.status),
      byReasonCode: tally(promiseRows, (r) => r.billLinkage.reasonCode),
      hedgedCount: promiseRows.filter((r) => r.billLinkage.hedged).length,
      linkedBillVoteIdCount: promiseRows.reduce((n, r) => n + r.billLinkage.billVoteIds.length, 0),
    },
    outcome: {
      byStatus: tally(promiseRows, (r) => r.outcome.status),
      byReasonCode: tally(promiseRows, (r) => r.outcome.reasonCode ?? "(confirmed)"),
    },
    progressStatus: tally(promiseRows, "progressStatusLabel"),
  },
  nextInvestigationTargets: promiseRows.map((r) => ({
    rank: r.investigation.rank,
    id: r.id,
    promiseText: r.promiseText,
    reason: r.investigation.reason,
    secondaryNote: r.investigation.secondaryNote ?? null,
    nextSource: r.investigation.nextSource,
    budgetStatus: r.budgetLinkage.status,
    budgetReasonCode: r.budgetLinkage.reasonCode,
    billStatus: r.billLinkage.status,
    billReasonCode: r.billLinkage.reasonCode,
    outcomeStatus: r.outcome.status,
  })),
  promises: promiseRows,
};

/* ------------------------------------------------------------------ *
 * 出力
 * ------------------------------------------------------------------ */

writeFileSync(join(ROOT, "reports/phase205-bill-explanation-priority.json"), `${JSON.stringify(billReport, null, 2)}\n`, "utf8");
writeFileSync(join(ROOT, "reports/phase205-mayor-promise-linkage.json"), `${JSON.stringify(promiseReport, null, 2)}\n`, "utf8");

const pct = (n) => `${((n / bills.length) * 100).toFixed(1)}%`;
const rows = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `| ${k} | ${v} |`)
    .join("\n");

const md = `# Phase205 次期改善対象の確定

生成日：${billReport.generatedAt}（分析のみ。\`src/data\` 配下のデータは一切変更していない）

対象：\`src/data/billVotes.json\`（1,177件）／\`src/data/mayorPromises.json\`（14公約）／\`src/data/mayorPromiseMeasures.json\`（33施策）
機械可読版：\`reports/phase205-bill-explanation-priority.json\`／\`reports/phase205-mayor-promise-linkage.json\`

新規のオンライン調査は行っていない。既存データと既存レポートの集計・構造化のみ。

---

## A. 議案詳細説明

### 集計に使ったフィールドの定義

既存の \`src/lib/billSummaryQuality.ts\`・\`src/lib/billSourceRetrieval.ts\` の判定と同一の定義を使っている（Phase205で新しい判定基準は作っていない）。

| 呼び方 | 判定に使ったフィールド |
| --- | --- |
${Object.entries(billReport.fieldDefinitions)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

### 件数

| 項目 | 件数 |
| --- | --- |
| 議案総数 | ${bills.length} |
| 出典確認済み | ${billReport.counts.出典確認済み}（${pct(billReport.counts.出典確認済み)}） |
| 一次資料本文確認済み | ${billReport.counts.一次資料本文確認済み}（${pct(billReport.counts.一次資料本文確認済み)}） |
| 詳細説明あり | ${billReport.counts.詳細説明あり}（${pct(billReport.counts.詳細説明あり)}） |
| 詳細説明なし | ${billReport.counts.詳細説明なし}（${pct(billReport.counts.詳細説明なし)}） |
| 原資料未確認（Level1） | ${billReport.counts.原資料未確認} |
| HUMAN_ACTION_REQUIRED | ${billReport.counts.HUMAN_ACTION_REQUIRED}（billVotes.json 側には該当なし。管理台帳は \`blockedTaskClassification.json\`） |
| source不足（transcriptUrl未登録） | ${billReport.counts.source不足} |

説明段階（Level）の内訳：

| Level | 意味 | 件数 |
| --- | --- | --- |
| 0 | 出典未確認 | ${billReport.explanationLevels.level0_出典未確認} |
| 1 | 議案名・議決結果・出典のみ（定型説明） | ${billReport.explanationLevels.level1_議案名議決結果出典のみ} |
| 2 | 一次資料本文を確認済み・独自説明なし | ${billReport.explanationLevels.level2_一次資料本文確認済み} |
| 3 | 一次資料本文に基づく説明あり | ${billReport.explanationLevels.level3_本文に基づく説明あり} |

### Priority A：一次資料本文確認済み ＋ 説明未作成（${priorityA.length}件）

| 区分 | 件数 |
| --- | --- |
${rows(billReport.priorities.A.bySubCode)}

**この${priorityA.length}件は「説明を書き忘れている」案件ではない。**
${billReport.priorities.A.bySubCode.NO_INDIVIDUAL_REASON_CONFIRMED ?? 0}件は \`verificationNote\` に「会議録を確認したが、この議案固有の提案理由の記載は見当たらなかった」と明記されている。多くは市長が複数議案をまとめて一括で説明した会期のもの（例：「議案第八七号から第一〇二号……は、辺地に係る総合整備計画の変更であります」）で、一次資料に個別の材料が存在しない。ここへ説明文を新規生成することは推測の混入にあたるため行わない。

安全に前進できる方向は文章生成ではなく、**既に \`verificationNote\` へ引用済みの「共通の一括説明」を、出典付きの構造化フィールドとして表示すること**（「この議案は他のN件とまとめて説明されました。共通の提案理由は……」）。

残る ${billReport.priorities.A.bySubCode.RECHECK_CANDIDATE ?? 0}件（\`RECHECK_CANDIDATE\`）は、本文確認の記録はあるが個別記載の有無について記述が無く、再確認の余地がある。ただし確認には会議録本文の再読（＝新規の一次資料調査）が必要なため、Phase205 では候補として記録するにとどめた。

${priorityA
  .filter((x) => x.subCode === "RECHECK_CANDIDATE")
  .map((x) => `- \`${x.id}\` ${x.session} ${x.billNumber} ${x.billTitle}（${x.category}）／verificationNote ${x.verificationNoteLength}文字`)
  .join("\n")}

カテゴリ内訳：${Object.entries(billReport.priorities.A.byCategory).map(([k, v]) => `${k} ${v}`).join(" / ")}

### Priority B：一次資料あり ＋ 追加構造化が必要（${priorityB.length}件、うち直ちに着手可 ${billReport.priorities.B.workableNow}件）

| 区分 | 件数 |
| --- | --- |
${rows(billReport.priorities.B.bySubCode)}

- \`HELD_RECORD_NOT_APPLIED\`（${billReport.priorities.B.bySubCode.HELD_RECORD_NOT_APPLIED ?? 0}件）：Phase160 が会議録本文（\`reports/phase160-held-for-future-56.json\`）まで到達し、共通の一括説明文と会議録ファイル名まで引用済みでありながら、\`billVotes.json\` 側へ \`sourceTextVerifiedAt\` を書かずに保留した56件。**新規調査ゼロで前進できる唯一のまとまった候補**。ただし Level1→Level2 の件数が動くため、Phase162系の既存テストの期待値更新とセットでなければ実施できない。
- \`TRANSCRIPT_LINKED_NOT_READ\`（${billReport.priorities.B.bySubCode.TRANSCRIPT_LINKED_NOT_READ ?? 0}件）：会議録リンクが既に登録済みで本文へ到達できるが、まだ読まれていない Level1。ただしこのうち人事案件（個人名を含む）と、市長提出でない議案（意見書・決議・請願・陳情・委員会提出）は、既存方針どおり自動処理の対象外。

### Priority C：原資料不足（${priorityC.length}件）

| 区分 | 件数 |
| --- | --- |
${rows(billReport.priorities.C.bySubCode)}

- \`MINUTES_NOT_PUBLISHED\`（${billReport.priorities.C.bySubCode.MINUTES_NOT_PUBLISHED ?? 0}件）：令和8年度。会議録そのものが未公開で、TASK-004（\`WAITING_EXTERNAL\`）と同じ理由。日次の自動巡回で公開され次第反映されるため、人手の再調査では解決しない。
- \`TRANSCRIPT_LINK_UNRESOLVED\`（${billReport.priorities.C.bySubCode.TRANSCRIPT_LINK_UNRESOLVED ?? 0}件）：会議録自体は公開済みだが、この議案への個別リンクが未登録。**「原資料が存在しない」という意味ではない**（\`billSourceRetrieval.ts\` の注記のとおり）。

内訳合計の検算：${priorityA.length} + ${priorityB.length} + ${priorityC.length} = ${billReport.priorityTotalCheck.sum}（＝詳細説明なし ${billReport.counts.詳細説明なし}件、一致${billReport.priorityTotalCheck.matches ? "" : "しない"}）

---

## B. 市長公約 → 予算 → 議案 → 成果（14公約）

### 状態名について

新しい status enum は導入していない。status は Phase166（\`reports/phase166-mayor-promise-audit.json\`）で既に使われている **confirmed / candidate / unconfirmed** をそのまま再利用した。

ただし既存の3値だけでは「関連議案が無いことを確認済み」と「まだ確認できていない」が同じ \`unconfirmed\` に潰れてしまうため、**unconfirmed の理由だけを \`reasonCode\` として補足**した。reasonCode は status を置き換えるものではない。

### 予算

| status / reasonCode | 件数 |
| --- | --- |
${rows(promiseReport.summary.budget.byReasonCode)}

### 議案

| reasonCode | 件数 |
| --- | --- |
${rows(promiseReport.summary.bill.byReasonCode)}

**確認済みで「独立議案なし」と言えるのは \`BUDGET_BILL_INCLUDED\` の${promiseReport.summary.bill.byReasonCode.BUDGET_BILL_INCLUDED ?? 0}件のみ。**
\`NO_SEPARATE_BILL_LIKELY\`（${promiseReport.summary.bill.byReasonCode.NO_SEPARATE_BILL_LIKELY ?? 0}件）は原文自身が「議案化を伴わない可能性が高いが、断定はしていない」と明記しているため、**「議案なしを確認済み」として扱ってはならない**（表示上も「確認中」側に置く）。
関連議案が確認できているのは1公約（2-3）のみで、登録議案は${promiseReport.summary.bill.linkedBillVoteIdCount}件。

### 成果

| status / reasonCode | 件数 |
| --- | --- |
${rows(promiseReport.summary.outcome.byReasonCode)}

### 公約別一覧

| 公約 | 予算 | 議案 | 成果 | 進捗 |
| --- | --- | --- | --- | --- |
${promisesFile.promises
  .map((p) => {
    const r = promiseRows.find((x) => x.id === p.id);
    return `| ${p.id} ${p.promiseText.slice(0, 22)}… | ${r.budgetLinkage.status}${r.budgetLinkage.reasonCode ? `（${r.budgetLinkage.reasonCode}）` : ""} | ${r.billLinkage.reasonCode} | ${r.outcome.status}${r.outcome.reasonCode ? `（${r.outcome.reasonCode}）` : ""} | ${r.progressStatusLabel} |`;
  })
  .join("\n")}

### 次回重点調査すべき公約（優先度順）

| 優先度 | 公約 | 理由 | 併記事項 | 次に見るべき一次資料 |
| --- | --- | --- | --- | --- |
${promiseReport.nextInvestigationTargets.map((t) => `| ${t.rank} | ${t.id} | ${t.reason} | ${t.secondaryNote ?? "—"} | ${t.nextSource} |`).join("\n")}

最優先は **rank 1 の${promiseReport.nextInvestigationTargets.filter((t) => t.rank === 1).length}公約**。いずれも \`relatedBudget\` 本文が「予算に関する説明書等のより詳細な資料での確認が必要」と次に見るべき資料を具体的に名指ししており、**同じ1資料（令和8年度 予算に関する説明書）で${promiseReport.nextInvestigationTargets.filter((t) => t.rank === 1).length}公約が同時に解決しうる**。

---

## Phase205 での実装判断

**実装は行わなかった。** 理由：

1. Priority A の${priorityA.length}件は、一次資料に個別の提案理由が無いことを確認済みの案件であり、説明文の新規生成は推測の混入になる。
2. Priority B の \`HELD_RECORD_NOT_APPLIED\` 56件は新規調査ゼロで前進できるが、Level1/Level2 の件数が動き、Phase162系の既存テストの期待値と \`RELEASE_SNAPSHOT.md\` の baseline に影響する。Phase205 の「baseline を理由なく書き換えない」「新規warning 0」の条件下では、テスト更新とセットで独立フェーズとして扱うのが安全。
3. 公約2-3の \`relatedBudget\`（\`MULTI_YEAR_MULTI_BILL\`）は、個別の工事請負契約金額が既に relatedBillVoteIds の各議案（すべてLevel3・一次資料確認済み）に記載され、relatedBudget 本文からも参照済みで、追加対応は不要と判断した。
`;

writeFileSync(join(ROOT, "reports/phase205-next-improvement-targets.md"), md, "utf8");

console.log("Phase205 analysis written:");
console.log("  reports/phase205-bill-explanation-priority.json");
console.log("  reports/phase205-mayor-promise-linkage.json");
console.log("  reports/phase205-next-improvement-targets.md");
console.log(`  bills=${bills.length} A=${priorityA.length} B=${priorityB.length} C=${priorityC.length} sumCheck=${billReport.priorityTotalCheck.matches}`);

/**
 * Phase266：市長公約データについて「当サイトのデータ整備がどこまで進んでいるか」を、
 * 既存データから機械的に集計する。
 *
 * ■ この集計が表しているもの／表していないもの（最重要）
 * ここで算出するのはすべて「当サイトのデータ整備状況」であり、
 * 「市長が公約をどこまで達成したか」ではない。
 * 例えば「根拠資料付与率100%」は、14件の個別公約すべてに延岡市の公式資料を紐付け済み
 * という意味であって、公約が100%達成されたという意味では一切ない。
 * 表示側のラベルも必ず「〜付与率」「〜整備率」等のデータ側の語に限定し、
 * 「達成率」「評価」といった語を使わないこと。
 *
 * ■ 設計方針
 * - 固定値を持たない。すべて mayorPromises.json / mayorPromiseMeasures.json から実行時に算出する。
 *   公約データを追加・変更すれば、この集計値も自動的に変わる。
 * - 総合スコア（「品質○点」「信頼度○点」）は作らない。重み付けが恣意的になるため、
 *   個別の分子・分母をそのまま見せる（/data-status の既存「データ完全性ダッシュボード」と同じ方針）。
 * - 「あるだけ」で確認済みにしない。とくに変更履歴は、lastVerified（最終確認日）が
 *   入っているだけでは「変更履歴あり」と数えず、progressHistory に日付と出典URLを伴う
 *   記録が1件以上ある場合のみ数える（validate-data.mjs が両項目を必須にしている）。
 * - 判定ロジックを新設しない。予算・議案の確認状態は既存の src/lib/mayorPromiseLinkage.ts
 *   （Phase205〜213）をそのまま使い、同じ事実が2か所で別々に判定されないようにする。
 *
 * ■ JSONをimportしない「leafモジュール」
 * 集計本体は、データを引数で受け取る純関数（computeMayorPromiseDataQuality）として公開する。
 * このファイル自身はJSONをimportしないため、`node --experimental-strip-types`から直接
 * importでき、scripts/test-mayor-promise-data-quality.mjs が「根拠資料を1件消す」
 * 「進捗履歴を消す」等の故障注入で集計値が追随することを検証できる
 * （既存の src/lib/mayorPromiseLinkage.ts・src/lib/completeness.ts と同じ方針）。
 * 実データの読み込みは画面側（src/pages/DataStatusPage.tsx）が行う。
 */
import type { MayorPromiseDocument, MayorPromiseItem, MayorPromiseMeasureSnapshot } from "../types";
import { simpleCompleteness, type CompletenessMetric } from "./completeness";
import {
  classifyPromiseBillLinkage,
  classifyPromiseBudgetLinkage,
  groupPromisesByAwaitingBudgetSource,
  isAwaitingSource,
  summarizeBillLinkage,
  summarizeBudgetLinkage,
  type AwaitingBudgetSourceGroup,
} from "./mayorPromiseLinkage";

/**
 * 根拠資料（mayorPromises.json の documents[].sourceType）のうち、延岡市・延岡市議会が
 * 公表した資料を表す接頭辞。現在の値は「延岡市公式資料（施政方針）」のように
 * 括弧内で資料種別を補足する形式で登録されている。
 * これに当てはまらないもの（例：「市長本人の進捗公表」）は、公表主体が市ではないため
 * 「市の公式資料」には数えず、別枠で件数を出す（どちらも出典としては有効で、
 * 「根拠資料なし」ではない）。
 */
const CITY_OFFICIAL_SOURCE_PREFIX = "延岡市公式資料";

const isBlank = (value: string | undefined | null): boolean => !value || value.trim().length === 0;

/** 1指標分の集計結果。分子・分母・率をそのまま持ち、総合点へはまとめない。 */
export interface PromiseQualityMetric {
  /** 画面に出す指標名（「〜率」はすべてデータ整備側の意味）。 */
  label: string;
  /** その指標が何を数えたものかの1文説明。 */
  description: string;
  metric: CompletenessMetric;
  /** 条件を満たしていない個別公約のID（少ない順に並べ替えず、データ順のまま）。 */
  missingPromiseIds: string[];
}

/** 追加の公式資料確認を待っている個別公約1件分。件数・対象IDは自動抽出する。 */
export interface PendingVerificationItem {
  promiseId: string;
  /** 予算側・議案側のどちらの確認が残っているか。 */
  aspect: "budget" | "bill";
  /** 画面に出す短い状態ラベル（既存 LinkageDisplay.pillLabel をそのまま使う）。 */
  statusLabel: string;
  /** 確認待ちの公式資料名（特定できている場合のみ）。 */
  awaitingSource?: string;
}

export interface MayorPromiseDataQuality {
  /** 集計対象の件数（政策分野・個別公約・個別施策）。 */
  totals: { policyArea: number; promise: number; measure: number };
  /** 掲載率・根拠資料付与率・変更履歴付与率などの個別指標。 */
  metrics: {
    publication: PromiseQualityMetric;
    cityOfficialSource: PromiseQualityMetric;
    changeHistory: PromiseQualityMetric;
    fiscalYear: PromiseQualityMetric;
    judgementNote: PromiseQualityMetric;
    measurePrimarySource: PromiseQualityMetric;
  };
  /** 任意項目（担当部署など）の登録状況。未登録は「情報未登録」であり0件ではない。 */
  optionalFields: PromiseQualityMetric[];
  /** 根拠資料そのものの状況。 */
  sourceDocuments: {
    total: number;
    /** 1件以上の個別公約から参照されている資料数。 */
    referenced: number;
    /** どの個別公約からも参照されていない資料のkey。 */
    unreferencedKeys: string[];
    /** 存在しない資料keyを参照している箇所（validate:dataでもエラーになる。通常は0件）。 */
    unresolvedKeys: string[];
    /** 市が公表した資料の件数と、それ以外（市長本人の公表資料など）の件数。 */
    cityOfficialCount: number;
    otherPublisherCount: number;
  };
  /** 進捗履歴の総記録件数（公約単位の付与率とは別の数）。 */
  changeHistoryEntryTotal: number;
  /** 予算・議案の確認状況（既存 mayorPromiseLinkage の集計をそのまま再掲）。 */
  verification: {
    budget: ReturnType<typeof summarizeBudgetLinkage>;
    bill: ReturnType<typeof summarizeBillLinkage>;
    /** 追加の公式資料確認が必要な個別公約（自動抽出、件数もIDも固定値ではない）。 */
    pending: PendingVerificationItem[];
    /** 確認待ちの資料ごとの内訳。 */
    awaitingBudgetSourceGroups: AwaitingBudgetSourceGroup[];
    /** pending に1件以上含まれる個別公約の数（同じ公約が予算・議案の両方で残っていても1件と数える）。 */
    pendingPromiseCount: number;
  };
  /** 基準日・最終確認日。年度（fiscalYear）とは別概念のため分けて持つ。 */
  asOf: {
    /** mayorPromises.json 全体の基準日。 */
    referenceDate: string;
    /** 個別公約の lastVerified のうち最も新しい日付。 */
    latestPromiseVerified: string | null;
    /** 個別施策のスナップショット日のうち最も新しい日付。 */
    latestMeasureSnapshot: string | null;
    /** 個別施策に登録されている対象年度（重複除去、登録順）。 */
    fiscalYears: string[];
  };
}

function buildMetric(
  label: string,
  description: string,
  promises: MayorPromiseItem[],
  predicate: (p: MayorPromiseItem) => boolean,
): PromiseQualityMetric {
  const missingPromiseIds = promises.filter((p) => !predicate(p)).map((p) => p.id);
  return {
    label,
    description,
    metric: simpleCompleteness(promises.length - missingPromiseIds.length, promises.length),
    missingPromiseIds,
  };
}

function latestDate(dates: (string | undefined)[]): string | null {
  const valid = dates.filter((d): d is string => !isBlank(d)).sort();
  return valid.length > 0 ? valid[valid.length - 1] : null;
}

/**
 * 市長公約データの整備状況を集計する。引数を受け取る純関数にしているのは、
 * テスト側が「根拠資料を1件消す」等の故障注入を行い、集計値が追随して変わることを
 * 検証できるようにするため。
 */
export function computeMayorPromiseDataQuality(input: {
  promises: MayorPromiseItem[];
  categories: { id: string }[];
  documents: MayorPromiseDocument[];
  measures: MayorPromiseMeasureSnapshot[];
  referenceDate: string;
}): MayorPromiseDataQuality {
  const { promises, categories, documents, measures, referenceDate } = input;
  const documentByKey = new Map(documents.map((d) => [d.key, d]));
  const categoryIds = new Set(categories.map((c) => c.id));
  const measuresByPromiseId = new Map<string, MayorPromiseMeasureSnapshot[]>();
  for (const m of measures) {
    const list = measuresByPromiseId.get(m.promiseId);
    if (list) list.push(m);
    else measuresByPromiseId.set(m.promiseId, [m]);
  }

  const resolvedEvidenceDocs = (p: MayorPromiseItem): MayorPromiseDocument[] =>
    (p.evidenceItems ?? [])
      .map((e) => documentByKey.get(e.documentKey))
      .filter((d): d is MayorPromiseDocument => d !== undefined);

  const isCityOfficial = (doc: MayorPromiseDocument): boolean =>
    (doc.sourceType ?? "").startsWith(CITY_OFFICIAL_SOURCE_PREFIX);

  const metrics = {
    // 掲載率：詳細ページ（/mayor/policy-progress/:id）を公開できる状態に必要な項目が揃っているか。
    // 必要項目は validate-data.mjs の詳細ページ生成チェックと同じ（id / promiseText / statusLabel）に、
    // 政策分野への所属（categoryId が実在すること）を加えたもの。
    publication: buildMetric(
      "詳細ページ掲載率",
      "個別公約のうち、単独の詳細ページを公開するのに必要な項目（公約原文・状況・所属政策分野）が揃っているものの割合です。",
      promises,
      (p) =>
        !isBlank(p.id) && !isBlank(p.promiseText) && !isBlank(p.statusLabel) && categoryIds.has(p.categoryId),
    ),
    // 根拠資料付与率：延岡市が公表した資料が1件以上紐付いているか（資料keyが実在することも確認）。
    cityOfficialSource: buildMetric(
      "根拠資料（延岡市の公表資料）付与率",
      "個別公約のうち、延岡市が公表した資料（施政方針・予算資料・広報のべおか・公約進捗報告など）を1件以上、資料一覧の実在するキーとして紐付けているものの割合です。",
      promises,
      (p) => resolvedEvidenceDocs(p).some(isCityOfficial),
    ),
    // 変更履歴付与率：lastVerified があるだけでは数えない。日付と出典URLを伴う記録が必要。
    changeHistory: buildMetric(
      "変更履歴付与率",
      "個別公約のうち、進捗の変化を日付と出典URL付きで記録した履歴（進捗履歴）が1件以上あるものの割合です。最終確認日が入っているだけのものは含めません。",
      promises,
      (p) => (p.progressHistory ?? []).some((h) => !isBlank(h.date) && !isBlank(h.sourceUrl)),
    ),
    // 年度情報付与率：対象年度は個別施策（measures）側に持っているため、そこから辿る。
    fiscalYear: buildMetric(
      "対象年度の付与率",
      "個別公約のうち、どの年度の取組みかを示す対象年度付きの個別施策が1件以上紐付いているものの割合です。",
      promises,
      (p) => (measuresByPromiseId.get(p.id) ?? []).some((m) => !isBlank(m.fiscalYear)),
    ),
    judgementNote: buildMetric(
      "判断根拠の記録率",
      "個別公約のうち、その状況をどう判断したか（何を確認し、何が確認できていないか）を詳細ページの「判断根拠」欄に記録しているものの割合です。",
      promises,
      (p) => !isBlank(p.notes),
    ),
    measurePrimarySource: buildMetric(
      "個別施策の一次資料付与率",
      "個別公約のうち、紐付く個別施策すべてに一次資料（延岡市の公表資料の原本URL）が付いているものの割合です。個別施策が1件も無いものは未付与として数えます。",
      promises,
      (p) => {
        const list = measuresByPromiseId.get(p.id) ?? [];
        return list.length > 0 && list.every((m) => !isBlank(m.sourceUrl) && m.trustLevel === "PRIMARY");
      },
    ),
  };

  const optionalFields: PromiseQualityMetric[] = [
    buildMetric(
      "担当部署の登録",
      "延岡市の公表資料で担当部署を確認できた個別公約の割合です。未登録は「担当部署が無い」という意味ではありません。",
      promises,
      (p) => !isBlank(p.department),
    ),
    buildMetric(
      "公約の公表日の登録",
      "選挙公報・マニフェスト等でその公約が公表された日を確認できた個別公約の割合です。",
      promises,
      (p) => !isBlank(p.announcedDate),
    ),
    buildMetric(
      "市民向け要約の作成",
      "公約原文とは別に、当サイトで市民向けの短い要約を用意できている個別公約の割合です。",
      promises,
      (p) => !isBlank(p.citizenSummary),
    ),
  ];

  const referencedKeys = new Set<string>();
  const unresolvedKeys = new Set<string>();
  for (const p of promises) {
    for (const e of p.evidenceItems ?? []) {
      if (documentByKey.has(e.documentKey)) referencedKeys.add(e.documentKey);
      else unresolvedKeys.add(e.documentKey);
    }
  }

  const pending: PendingVerificationItem[] = [];
  for (const p of promises) {
    const budget = classifyPromiseBudgetLinkage(p);
    if (isAwaitingSource(budget.display)) {
      pending.push({
        promiseId: p.id,
        aspect: "budget",
        statusLabel: budget.display.pillLabel,
        awaitingSource: budget.display.awaitingSource,
      });
    } else if (budget.resolution === "under_review") {
      pending.push({ promiseId: p.id, aspect: "budget", statusLabel: budget.display.pillLabel });
    }
    const bill = classifyPromiseBillLinkage(p);
    if (bill.resolution === "under_review" || bill.resolution === "not_found") {
      pending.push({
        promiseId: p.id,
        aspect: "bill",
        statusLabel: bill.display.pillLabel,
        awaitingSource: bill.display.awaitingSource,
      });
    }
  }

  return {
    totals: { policyArea: categories.length, promise: promises.length, measure: measures.length },
    metrics,
    optionalFields,
    sourceDocuments: {
      total: documents.length,
      referenced: referencedKeys.size,
      unreferencedKeys: documents.filter((d) => !referencedKeys.has(d.key)).map((d) => d.key),
      unresolvedKeys: [...unresolvedKeys],
      cityOfficialCount: documents.filter(isCityOfficial).length,
      otherPublisherCount: documents.filter((d) => !isCityOfficial(d)).length,
    },
    changeHistoryEntryTotal: promises.reduce((sum, p) => sum + (p.progressHistory ?? []).length, 0),
    verification: {
      budget: summarizeBudgetLinkage(promises),
      bill: summarizeBillLinkage(promises),
      pending,
      awaitingBudgetSourceGroups: groupPromisesByAwaitingBudgetSource(promises),
      pendingPromiseCount: new Set(pending.map((item) => item.promiseId)).size,
    },
    asOf: {
      referenceDate,
      latestPromiseVerified: latestDate(promises.map((p) => p.lastVerified)),
      latestMeasureSnapshot: latestDate(measures.map((m) => m.snapshotDate)),
      fiscalYears: [...new Set(measures.map((m) => m.fiscalYear).filter((y): y is string => !isBlank(y)))],
    },
  };
}

/**
 * 根拠資料のURLのうち、外部リンク監査（reports/external-link-check.json →
 * src/data/dataQualitySummary.json）で到達できなかったものの件数を数える。
 * リンク監査の結果はこのモジュールの外（/data-status 側）が持っているため、
 * URLの配列を受け取る形にして依存を増やさない。
 */
export function countBrokenPromiseSourceUrls(documents: MayorPromiseDocument[], brokenUrls: string[]): number {
  const broken = new Set(brokenUrls);
  return documents.filter((d) => broken.has(d.url) || (d.officialUrl !== undefined && broken.has(d.officialUrl)))
    .length;
}

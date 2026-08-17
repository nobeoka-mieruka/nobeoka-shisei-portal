/**
 * TASK-083（優先5）：Wayback Machine再生バックエンド復旧後、すぐ本文取得→現在DBとの照合を
 * 再開できるよう、P0高信頼度サブバッチ（reports/wayback-display-php-catalog.json、
 * subcategory: "high-confidence-mayor-transition"、42件）の事前整理だけを行う。
 *
 * 重要：このスクリプトはWaybackへ一切アクセスしない（新規リクエスト0件）。既存の台帳
 * （CDX APIで既に取得済みのメタデータ）とarchiveMayorTerms.json（既に一次資料で確認済みの
 * 任期日付）だけを突き合わせ、次回の本文取得作業がすぐ着手できるよう整理する。
 *
 * 出力：reports/wayback-recovery-queue.json（機械可読）・reports/wayback-recovery-queue.md
 * （人間可読、次回セッションの作業手順）。いずれも`reports/`配下（既存の内部レポート運用
 * パターンに合わせ、ビルド・型チェック対象外）。
 *
 * 使い方：node scripts/prepare-wayback-recovery-queue.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const readJson = (relPath) => JSON.parse(readFileSync(join(root, relPath), "utf8"));

const catalog = readJson("reports/wayback-display-php-catalog.json");
const entries = Object.values(catalog).filter((e) => e && e.subcategory === "high-confidence-mayor-transition");

const mayorTerms = readJson("src/data/archiveMayorTerms.json");
const mayors = readJson("src/data/archiveMayors.json");
const mayorById = new Map(mayors.map((m) => [m.id, m]));

function fiscalYearOfDate(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  return m >= 4 ? y : y - 1;
}

/** estimatedDateに最も近い市長交代（前後の任期境界）を、既に確認済みの任期日付だけから求める。 */
function nearestMayorTransition(estimatedDate) {
  const target = new Date(estimatedDate);
  let nearest = null;
  let nearestDiffDays = Infinity;
  for (const t of mayorTerms) {
    for (const [label, dateStr] of [
      ["就任", t.termStart],
      ["退任", t.termEnd],
    ]) {
      if (!dateStr) continue;
      const d = new Date(dateStr);
      const diffDays = Math.abs((target.getTime() - d.getTime()) / 86400000);
      if (diffDays < nearestDiffDays) {
        nearestDiffDays = diffDays;
        nearest = { mayorId: t.mayorId, termId: t.id, boundaryType: label, boundaryDate: dateStr, diffDays: Math.round(diffDays) };
      }
    }
  }
  return nearest;
}

const queue = entries.map((e) => {
  const transition = e.estimatedDate ? nearestMayorTransition(e.estimatedDate) : null;
  const mayorName = transition ? mayorById.get(transition.mayorId)?.name : null;
  return {
    contId: e.contId,
    originalUrl: e.originalUrl,
    archiveUrl: e.archiveUrl,
    firstSnapshot: e.firstSnapshot,
    lastSnapshot: e.lastSnapshot,
    pageTypeGuess: e.category, // 本文未取得のため確定分類ではない（URLからの機械推定のまま）
    estimatedDate: e.estimatedDate,
    estimatedFiscalYear: e.estimatedDate ? fiscalYearOfDate(e.estimatedDate) : null,
    relatedMayorId: transition?.mayorId ?? null,
    relatedMayorName: mayorName ?? null,
    nearestMayorBoundary: transition ? `${transition.boundaryType}（${transition.boundaryDate}、差${transition.diffDays}日）` : null,
    relatedMemberIds: [], // 本文未取得のため空（推測しない）
    crossReferenceTargets: [
      "src/data/archiveMayors.json（該当市長のprofile・sourceRefs拡充候補）",
      "src/data/archiveMayorTerms.json（termStart/termEndのprecision向上候補、現状はmonth精度が多い）",
      "src/data/civicTimelineEvents.json（同時期の市政年表への新規イベント登録候補）",
      "src/data/archivePolicies.json（選挙候補者ページの場合、公約原文の新規登録候補）",
    ],
    reviewStatus: e.reviewStatus,
    priority: e.priority,
    notes: e.notes,
  };
});

const md = [
  "# Wayback再開キュー（P0高信頼度42件、事前整理のみ・本文未取得）",
  "",
  `生成日時：${new Date().toISOString()}`,
  "",
  "Wayback Machine再生バックエンド復旧後、次の手順で再開する：",
  "",
  "1. 1件だけarchiveUrlへアクセスし、再生バックエンドが復旧しているか確認する",
  "2. 復旧していれば、本キューを上から順に処理する（1件ごとに本文取得→情報抽出→",
  "   crossReferenceTargetsに列挙したファイルとの照合→根拠があれば登録）",
  "3. 過剰アクセスを避けるため、リクエスト間に間隔を空け、reviewStatusを都度更新する",
  "",
  "| contId | 推定日 | 年度 | 近接する市長交代 | ページ種別（推定） |",
  "|---|---|---|---|---|",
  ...queue.map(
    (q) =>
      `| ${q.contId} | ${q.estimatedDate ?? "不明"} | ${q.estimatedFiscalYear ?? "-"} | ${q.relatedMayorName ?? "-"}／${q.nearestMayorBoundary ?? "-"} | ${q.pageTypeGuess} |`,
  ),
  "",
  `合計：${queue.length}件（すべてreviewStatus=${[...new Set(queue.map((q) => q.reviewStatus))].join("／")}）`,
].join("\n");

writeFileSync(join(root, "reports", "wayback-recovery-queue.json"), JSON.stringify({ generatedAt: new Date().toISOString(), count: queue.length, queue }, null, 2) + "\n");
writeFileSync(join(root, "reports", "wayback-recovery-queue.md"), md + "\n");
console.log(`[prepare-wayback-recovery-queue] ${queue.length}件を整理（Waybackへの新規アクセス0件）`);

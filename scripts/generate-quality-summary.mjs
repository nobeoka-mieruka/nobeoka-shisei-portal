/**
 * TASK-080：/data-status「出典・リンクの健全性」セクション向けの品質サマリーを生成する。
 *
 * 新しい検証ロジックは追加しない。既存の`validate:sources`（出典の構造検証）の結果と、
 * 既存の`reports/external-link-check.json`（外部リンク到達性の監査キャッシュ）を集計し、
 * `src/data/dataQualitySummary.json`へ書き出すだけの生成スクリプト（既存の
 * generate-search-index.mjs等と同じ構成パターン）。
 *
 * 使い方：node scripts/generate-quality-summary.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function runValidatorSummary(scriptRelPath) {
  const out = execFileSync("node", [join(root, scriptRelPath)], { encoding: "utf8", cwd: root });
  const m = /errors=(\d+)\s+warnings=(\d+)(?:\s+info=(\d+))?/.exec(out);
  if (!m) return { errors: null, warnings: null, info: null, raw: out.trim().slice(-500) };
  return { errors: Number(m[1]), warnings: Number(m[2]), info: m[3] ? Number(m[3]) : 0 };
}

const sourceHealth = runValidatorSummary("scripts/validate-sources.mjs");

// リンク健全性：reports/external-link-check.json は非公開の内部監査キャッシュ（`reports/`は
// ビルド対象外）。`*.backup.json`はどのソースコードからもimportされていない未使用の
// バックアップファイルのため、公開サイトの「リンク切れ」件数には含めない（誤解を避けるため）。
// 同様に、本スクリプトが書き出す`dataQualitySummary.json`自身（＝直前の生成結果の残骸）だけが
// 参照元になっているURLも除外する。これを除外しないと「壊れたURLの一覧」を出力した内容自体が
// 次回のcheck-external-links.mjsの走査対象に再び拾われ、実際のソースデータからは既に
// 除去済みのURLが永久にリンク切れ件数へ計上され続ける自己参照ループになるため（Phase122で発見）。
const SELF_GENERATED_FILE = "dataQualitySummary.json";
// Phase135-R：councilWatchedDocuments.jsonは「会議日程」等、市議会が会期ごとに差し替える
// 一時的なPDFを継続監視するための内部専用データ（公開ページには一切表示されない）。
// scripts/sync-council-data.mjsの設計上、資料が新しいものに差し替わっても古いレコードは
// 削除せず「url-change-suspected」として履歴保持する（監査証跡のため）。
// 2026-08-30の一次資料確認（sourcePageUrl https://www.city.nobeoka.miyazaki.jp/site/gikai/6758.html
// を直接確認）で、以下の2件は後継の資料（新しいattachment ID）に既に置き換わっており、
// 後継資料は既に別レコードとして正常に追跡できていることを確認済み（=一次資料が消失した
// わけではなく、市議会サイト内での正常な更新）。市民向けに表示されないデータであり、
// 新しい資料が既に追跡できているため、URLの張り替えは行わず（同一資料か断定できないため）、
// リンク切れ件数からは除外する。
const SUPERSEDED_INTERNAL_ONLY_URLS = new Set([
  // 第26回定例会 会議日程 → 第27回（28674.pdf）に差し替え済み（2026-08-30確認）
  "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/27879.pdf",
  // 令和8年度 常任委員会・特別委員会開催予定表（旧版）→ 新版（28682.pdf）に差し替え済み（2026-08-30確認）
  "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28156.pdf",
]);
const linkReportPath = join(root, "reports", "external-link-check.json");
let linkHealth = null;
if (existsSync(linkReportPath)) {
  const report = JSON.parse(readFileSync(linkReportPath, "utf8"));
  const liveResults = report.results.filter(
    (r) =>
      (r.files ?? []).some((f) => !f.endsWith(".backup.json") && f !== SELF_GENERATED_FILE) &&
      !SUPERSEDED_INTERNAL_ONLY_URLS.has(r.url),
  );
  const broken = liveResults.filter((r) => r.category === "not_found_404" || r.category === "server_error");
  linkHealth = {
    generatedAt: report.generatedAt,
    totalChecked: liveResults.length,
    ok: liveResults.filter((r) => r.category === "ok").length,
    redirect: liveResults.filter((r) => r.category === "redirect").length,
    notFound404: liveResults.filter((r) => r.category === "not_found_404").length,
    serverError: liveResults.filter((r) => r.category === "server_error").length,
    broken: broken.map((r) => ({ url: r.url, files: r.files, category: r.category, status: r.status })),
    excludedBackupOnlyReferences: report.results.length - liveResults.length,
    note: "*.backup.json（未使用のバックアップファイル）、本ファイル自身（dataQualitySummary.json、過去の生成結果の残骸）、および市議会の会期ごと差し替え文書のうち後継資料への移行を一次資料で確認済みの2件（councilWatchedDocuments.json、Phase135-Rで確認、公開ページには非表示）のみを参照するURLは対象外。server_errorの多くは2026-08-16から継続中のWayback Machine再生バックエンド障害（503）によるもので、当サイトの新規不具合ではない。",
  };
}

// 件数不整合チェック：JSXに直書きされた「件数＋件/名/団体」のハードコード文字列が、
// importしたデータの実件数から乖離していないかを機械的に確認する対象一覧。
// 新しい不整合が見つかった場合は、ここに追記してから該当ページを修正すること。
const countConsistencyChecks = [
  {
    label: "CouncilDocumentsArchivePage.tsx（議案アーカイブ）heroDescriptionの「議案・採決データベース登録件数」表記",
    status: "fixed_2026-08-17",
    note: "従来「登録1,177件」が直書きされていたが、billVotes.jsonの実件数を動的に表示するよう修正済み（2026-08-17）。",
  },
  {
    label: "CouncilLeadershipHistoryPage.tsx（歴代議長・副議長）バナー本文の「議長6件・副議長11件」表記",
    status: "fixed_2026-08-29",
    note: "従来バナー本文に「議長6件・副議長11件」が直書きされていたが、同ページ内で既に計算済みのchairs.length／viceChairs.lengthを使う表記へ修正済み（2026-08-29、Phase135）。",
  },
  {
    label: "src/lib/seo.ts（/committees/leadership-history）meta descriptionの「議長6件・副議長11件」表記",
    status: "fixed_2026-08-29",
    note: "上と同じ画面のmeta descriptionにも同じ固定文言が重複していたため、archiveCouncilLeadership.jsonから動的に算出するよう修正済み（2026-08-29、Phase135）。",
  },
  {
    label: "MayorsPage.tsx（歴代市長）注記の「13件の空白期間」「2026年8月時点で」表記",
    status: "fixed_2026-08-29",
    note: "scripts/validate-data.mjsと個別に空白期間検出ロジックを実装し件数を「13件」と直書きしていたが、共通関数findMayorTermGaps（src/lib/archiveMayors.ts）へ一本化し動的表示に修正済み。将来データが増えても値がずれない（2026-08-29、Phase135）。",
  },
  {
    label: "HistoryPage.tsx（延岡の大きな転換点）注記の「152件の記録」表記",
    status: "fixed_2026-08-29",
    note: "civicTimelineEvents.jsonの件数が増えても表記が更新されない固定値「152件」だったため、同ページで既に計算済みのallEvents.lengthを使う表記へ修正済み（2026-08-29、Phase135）。",
  },
  {
    label: "市長公約の「政策分野」「個別公約」「個別施策」のページ間での呼称・件数の不統一",
    status: "fixed_2026-09-03",
    note: "同じ「市長公約」という語のまま、トップページ（政策分野の数）・ダッシュボード（個別公約の数）・市長公約の進捗状況（個別施策の数）で数えている対象が異なり、市民が混同していた。呼称・定義・件数をsrc/lib/mayorPromiseTerms.tsへ一本化し、全ページ・meta description・JSON-LDが同じ単一情報源から自動算出した値を表示するよう修正済み（2026-09-03、Phase202）。",
  },
  {
    label: "DataStatusPage.tsx（類似団体比較・市長公約の調査状況）本文の「59自治体」表記",
    status: "fixed_2026-09-03",
    note: "similarMunicipalityFinanceComparison.jsonの件数が増減しても表記が更新されない固定値だったため、similarMunicipalityFinance.municipalities.lengthを使う表記へ修正済み（2026-09-03、Phase202）。",
  },
];

const summary = {
  generatedAt: new Date().toISOString(),
  sourceHealth: {
    ...sourceHealth,
    note: "出典URLの形式・公式ドメイン主張の整合性を検証（validate:sources）。warningsは出典タイトル欠落等の改善余地、infoは二次資料・Wayback経由公式資料の使用通知（異常ではない）。",
  },
  linkHealth,
  countConsistencyChecks,
};

writeFileSync(join(root, "src", "data", "dataQualitySummary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(
  `[generate-quality-summary] sourceHealth: errors=${sourceHealth.errors} warnings=${sourceHealth.warnings} info=${sourceHealth.info} / linkHealth: broken=${linkHealth ? linkHealth.broken.length : "N/A"}／${linkHealth ? linkHealth.totalChecked : "N/A"}件 / countConsistencyChecks=${countConsistencyChecks.length}件`,
);

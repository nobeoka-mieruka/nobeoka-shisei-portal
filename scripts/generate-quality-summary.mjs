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
const linkReportPath = join(root, "reports", "external-link-check.json");
let linkHealth = null;
if (existsSync(linkReportPath)) {
  const report = JSON.parse(readFileSync(linkReportPath, "utf8"));
  const liveResults = report.results.filter((r) => (r.files ?? []).some((f) => !f.endsWith(".backup.json")));
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
    note: "*.backup.json（未使用のバックアップファイル）のみを参照するURLは対象外。server_errorの多くは2026-08-16から継続中のWayback Machine再生バックエンド障害（503）によるもので、当サイトの新規不具合ではない。",
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

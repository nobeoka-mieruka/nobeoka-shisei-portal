#!/usr/bin/env node
/**
 * サイト内の複数ページ（トップページ／data-status等）で同じ意味の指標を表示している箇所が、
 * 実際に同じ数値になっているかを横断チェックする。
 *
 * 【背景】2026-08-24、本番トップページと/data-status/で一般質問件数等の表示が一時的に
 * 食い違って見える事象が報告された。調査の結果、ソースコード側は既に単一の共通関数
 * （src/lib/generalQuestionStats.ts の calculateGeneralQuestionStats 等）を両ページで
 * 使っており、コード上の不一致は無かった（Cloudflare Pagesのデプロイ反映タイミングの
 * ずれが原因と判明）。本スクリプトは、今後同種の「表示だけが古い」状態を検出できるよう、
 * ビルド済みdist/の実際のHTML同士を直接比較する（コードの参照関係ではなく、最終的に
 * 生成された画面表示そのものを突き合わせる点が既存監査との違い）。
 *
 * 対象は「同じラベル文言が複数ページに存在する」既知の指標に限定する（ラベルの完全一致を
 * 前提とするため、新しい指標を追加する場合はLABEL_PAIRSに追記すること）。
 * 読み取り専用。dist/が無い場合は実行できない（要build）。
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./_lib.mjs";

const DIST = join(ROOT, "dist");
if (!existsSync(DIST)) {
  console.error("[check-cross-page-metric-consistency] dist/ が見つかりません。先に npm run build を実行してください。");
  process.exit(1);
}

/**
 * 比較対象ページ。値は route（distからの相対パス、index.htmlを補完）。
 * トップページ・data-status以外に、同じ指標を表示しているページがあれば追加してよい。
 */
const PAGES = {
  top: "index.html",
  dataStatus: "data-status/index.html",
};

const pageHtml = {};
for (const [key, rel] of Object.entries(PAGES)) {
  const path = join(DIST, rel);
  if (!existsSync(path)) {
    console.error(`[check-cross-page-metric-consistency] ${rel} が見つかりません`);
    process.exit(1);
  }
  // script/styleタグを除去（JSON-LD等に同名ラベルが埋め込まれ誤検知するのを防ぐ）
  pageHtml[key] = readFileSync(path, "utf8").replace(/<script[^>]*>[\s\S]*?<\/script>/g, "").replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

/**
 * ラベル文言の最初の出現直後（400文字以内）に現れる最初の数値を抽出する。
 * ページごとに文章表現が異なる（例：トップは「26／70」と簡潔表示、data-statusは
 * 「収録26件／確認済み母数70件／収録率：37%」と文章で説明）ため、分数全体の一致では
 * なく「その指標の主たる数値（最初の数字）」のみを厳密に比較する。同一ラベルがページ内に
 * 複数回出現する場合は、最初の出現（通常は見出しカード等の主表示）のみを対象とする。
 */
function extractFirstValueForLabel(html, label) {
  const idx = html.indexOf(label);
  if (idx === -1) return null;
  const window = html.slice(idx + label.length, idx + label.length + 400);
  // タグの属性内の数字（class名のmt-1やgap-2等）を誤検出しないよう、HTMLタグと
  // Reactハイドレーション用コメント（<!-- -->、隣接テキストノードの区切りに使われる）を
  // すべて除去してから、残ったテキスト内容だけを対象に最初の数値を探す。
  const plainText = window.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "");
  const m = plainText.match(/([0-9][0-9,]*)/);
  return m ? m[1].replace(/,/g, "") : null;
}

/** label: 両ページで完全一致する見出し文言。metric: レポート上の指標名。 */
const LABEL_PAIRS = [
  { metric: "一般質問（登壇・確認済み件数）", label: "一般質問（登壇・確認済み件数）" },
  { metric: "質問項目数", label: "質問項目数" },
  // Phase168：令和8年9月定例会追加で会期名が複数同時に存在するようになったため、
  // ラベル文言が「最新会期の予定質問」から「会議録未公開会期の予定質問」に変更された
  // （src/lib/generalQuestionStats.ts）。旧文言のままではどちらのページにも一致せず
  // 常にSKIPになり、本来検出すべき不一致（トップページとdata-statusの食い違い）を
  // 検出できなくなっていたため、現在の文言に追従した。
  { metric: "会議録未公開会期の予定質問", label: "会議録未公開会期の予定質問" },
  // 以下の3件は、トップページ側は/data-statusとは別の要約ウィジェット
  // （src/lib/dataCompletenessSummary.ts、homeDataCoverageItems）が独自の文言で表示しており、
  // data-status側の完全性ダッシュボード（DataStatusPage.tsx）はより詳しい区分名
  // （例：「財政：市債残高（普通会計）の年度確認」）を使うため、ラベル文言が完全一致しない。
  // 実際の数値自体はdata-statusの「財政・人口・基金・市債（年度データ）」カードの説明文中に
  // 同じ分子（市債確認済みN年度／基金確認済みN年度）で埋め込まれており、Phase168時点で
  // トップページと数値は一致している（38／26、手動確認済み）。ラベル文言をどちらかに
  // 統一すると表示の意味が変わってしまうため、ここでは統一せずSKIPのままにしている。
  { metric: "財政：基金残高の年度確認", label: "財政：基金残高の年度確認" },
  { metric: "財政：市債残高の年度確認", label: "財政：市債残高の年度確認" },
  { metric: "財政：人口の年度確認", label: "財政：人口の年度確認" },
];

const results = [];
for (const { metric, label } of LABEL_PAIRS) {
  const perPage = {};
  for (const key of Object.keys(PAGES)) {
    perPage[key] = extractFirstValueForLabel(pageHtml[key], label);
  }
  const presentValues = Object.values(perPage).filter((v) => v !== null);
  if (presentValues.length < 2) {
    // 両方のページに同じラベルが無ければ比較不能（片方にしか無い指標）。
    results.push({ metric, status: "SKIP_NOT_ON_BOTH_PAGES", values: perPage });
    continue;
  }
  const distinct = new Set(presentValues);
  const status = distinct.size === 1 ? "PASS" : "ERROR";
  results.push({ metric, status, values: perPage });
}

const errorCount = results.filter((r) => r.status === "ERROR").length;
const passCount = results.filter((r) => r.status === "PASS").length;
const skipCount = results.filter((r) => r.status === "SKIP_NOT_ON_BOTH_PAGES").length;

const findings = {
  generatedAt: new Date().toISOString(),
  pagesCompared: Object.keys(PAGES),
  summary: { pass: passCount, error: errorCount, skip: skipCount },
  results,
  note:
    "PASSは両ページ（および同一ページ内の複数出現箇所すべて）で値が完全一致したことを示す。" +
    "ERRORは同じラベル文言なのに異なる数値が見つかったことを示し、キャッシュ／デプロイ差の可能性と、" +
    "ソースコード側で計算ロジックが分岐している可能性の両方を疑うこと。" +
    "SKIP_NOT_ON_BOTH_PAGESは、そのラベルが比較対象の一方のページにしか無かったことを示す" +
    "（指標の追加・削除自体は問題ではないが、意図した変更か確認すること）。",
};

const outPath = join(ROOT, "reports", "qa-checks", "_out-cross-page-metric-consistency.json");
writeFileSync(outPath, JSON.stringify(findings, null, 2) + "\n", "utf8");

console.log(`[check-cross-page-metric-consistency] PASS=${passCount} ERROR=${errorCount} SKIP=${skipCount}`);
for (const r of results) {
  const mark = r.status === "PASS" ? "PASS" : r.status === "ERROR" ? "ERROR" : "SKIP";
  console.log(`  ${mark} ${r.metric}: ${JSON.stringify(r.values)}`);
}
process.exitCode = errorCount > 0 ? 1 : 0;

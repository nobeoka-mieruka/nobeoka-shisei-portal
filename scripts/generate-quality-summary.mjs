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

// Phase222：validate-sources.mjs の --json 出力（warningを分類コードごとに数えたもの）を使う。
// 従来はログ行を正規表現で拾って合計値だけを取り出していたため、/data-status 側で
// 「出典タイトル欠落等」という一括りの見出しにせざるを得ず、実際の内訳
// （タイトル欠落0件／国立国会図書館ドメインの一次資料23件）と表示が食い違っていた。
function runValidatorSummary(scriptRelPath) {
  const out = execFileSync("node", [join(root, scriptRelPath), "--json"], {
    encoding: "utf8",
    cwd: root,
  });
  try {
    const parsed = JSON.parse(out);
    return {
      errors: parsed.errors,
      warnings: parsed.warnings,
      info: parsed.info,
      warningsByCode: parsed.warningsByCode ?? {},
    };
  } catch {
    return { errors: null, warnings: null, info: null, warningsByCode: {}, raw: out.trim().slice(-500) };
  }
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
//
// 2026-09-23：上の2件を手書きの一覧で除外していたため、その後に同じ状態
// （status: "removed-confirmed"＝市議会サイトからの削除を確認済み）になった28682・28937は
// リンク切れとして数えられ、扱いがそろっていなかった。一覧を手で足すのをやめ、
// councilWatchedDocuments.json の status から決める。ただし、そのURLを他のデータも
// 参照している場合は除外しない（公開画面に出る可能性があるため）。
const WATCHED_DOCUMENTS_FILE = "councilWatchedDocuments.json";
const SUPERSEDED_INTERNAL_ONLY_URLS = new Set(
  JSON.parse(readFileSync(join(root, "src", "data", WATCHED_DOCUMENTS_FILE), "utf8"))
    .filter((d) => d.status === "removed-confirmed" && d.sourceUrl)
    .map((d) => d.sourceUrl),
);
/** 削除確認済みの監視記録だけが参照しているURLか（他のデータから参照されていれば false）。 */
function isRemovedWatchedOnly(result) {
  if (!SUPERSEDED_INTERNAL_ONLY_URLS.has(result.url)) return false;
  return (result.files ?? []).every(
    (f) => f.endsWith(WATCHED_DOCUMENTS_FILE) || f.endsWith(".backup.json") || f === SELF_GENERATED_FILE,
  );
}
const linkReportPath = join(root, "reports", "external-link-check.json");
let linkHealth = null;
if (existsSync(linkReportPath)) {
  const report = JSON.parse(readFileSync(linkReportPath, "utf8"));
  const liveResults = report.results.filter(
    (r) =>
      (r.files ?? []).some((f) => !f.endsWith(".backup.json") && f !== SELF_GENERATED_FILE) &&
      !isRemovedWatchedOnly(r),
  );
  const broken = liveResults.filter((r) => r.category === "not_found_404" || r.category === "server_error");
  // 到達できない参照URLの扱い（データから決める）。「公開元で掲載終了し、代わりの資料がある」ものと、
  // 「代わりの資料が無い（調査済み）」ものを分けて示す。同じ「到達できない」でも意味が違うため。
  const readData = (f) => JSON.parse(readFileSync(join(root, "src", "data", f), "utf8"));
  const removedNoticeUrls = new Set(
    readData("generalQuestions.json")
      .filter((q) => q.noticeUrlStatus === "removed" && q.transcriptUrl)
      .map((q) => q.noticeUrl),
  );
  const docSources = readData("councilDocumentSources.json");
  const removedDocUrls = new Set(
    (Array.isArray(docSources) ? docSources : docSources.sources ?? []).filter((d) => d.status === "removed").map((d) => d.sourceUrl),
  );
  const dispositionOf = (url) =>
    removedNoticeUrls.has(url)
      ? "removed_with_alternative_minutes"
      : removedDocUrls.has(url)
        ? "removed_with_successor_document"
        : "no_alternative";
  linkHealth = {
    generatedAt: report.generatedAt,
    // Phase222：ここは「内部データが参照しているURLのうち到達できないもの」の件数であり、
    // 「市民が公開画面でクリックできるリンク切れ」の件数ではない（後者は publicExposure）。
    totalChecked: liveResults.length,
    ok: liveResults.filter((r) => r.category === "ok").length,
    redirect: liveResults.filter((r) => r.category === "redirect").length,
    notFound404: liveResults.filter((r) => r.category === "not_found_404").length,
    serverError: liveResults.filter((r) => r.category === "server_error").length,
    broken: broken.map((r) => ({
      url: r.url,
      // この要約ファイル自身は参照元ではないため、一覧に出さない。
      files: (r.files ?? []).filter((f) => f !== SELF_GENERATED_FILE),
      category: r.category,
      status: r.status,
      disposition: dispositionOf(r.url),
    })),
    excludedBackupOnlyReferences: report.results.length - liveResults.length,
    note: `本ファイル自身（dataQualitySummary.json、過去の生成結果の残骸）と、市議会の会期ごと差し替え文書のうち市議会サイトからの削除を確認済みの${SUPERSEDED_INTERNAL_ONLY_URLS.size}件（councilWatchedDocuments.jsonのstatusが removed-confirmed、公開ページには非表示）だけが参照するURLは対象外。到達できないURLは、公開元で掲載終了し代わりの資料（会議録・後継の資料）があるものと、代わりの資料が無い（調査済み）ものに分けて示す。`,
  };
}

// Phase222：公開画面での露出（＝市民が押せるリンク切れ）の実測結果。
// scripts/check-broken-link-exposure.mjs がビルド後の dist/ を走査して書き出す内部監査結果を
// 読み込むだけで、ここで新しい判定は行わない（linkHealth が external-link-check.json を
// 読むのと同じ構成）。前回ビルドの結果を使うため generatedAt を必ず併記する。
const exposureReportPath = join(root, "reports", "broken-link-exposure.json");
let publicExposure = null;
if (existsSync(exposureReportPath)) {
  const exposure = JSON.parse(readFileSync(exposureReportPath, "utf8"));
  publicExposure = {
    generatedAt: exposure.generatedAt,
    checkedPages: exposure.checkedPages,
    clickableBrokenLinks: exposure.clickableBrokenLinks,
    note: "プリレンダリング済みの公開HTML（dist/）を実際に走査し、到達できないURLが<a href>として出ていないかを数えた結果。0でなければビルドが失敗する。",
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
    note: "出典URLの形式・公式ドメイン主張の整合性を検証（validate:sources）。warningsは分類コードごとの内訳（warningsByCode）で意味が異なる。MISSING_TITLEだけが「出典タイトルの欠落」で、NON_NOBEOKA_PUBLIC_DOMAINは国立国会図書館など延岡市以外の公的機関の資料を一次資料として使っている件数（出典情報は揃っており、欠落ではない）。infoは二次資料・Wayback経由公式資料の使用通知（異常ではない）。",
  },
  linkHealth,
  publicExposure,
  countConsistencyChecks,
};

writeFileSync(join(root, "src", "data", "dataQualitySummary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(
  `[generate-quality-summary] sourceHealth: errors=${sourceHealth.errors} warnings=${sourceHealth.warnings} info=${sourceHealth.info}` +
    ` (${Object.entries(sourceHealth.warningsByCode ?? {})
      .map(([c, n]) => `${c}=${n}`)
      .join(" ")})` +
    ` / 内部データ上の到達不能URL=${linkHealth ? linkHealth.broken.length : "N/A"}／${linkHealth ? linkHealth.totalChecked : "N/A"}件` +
    ` / 公開画面のクリック可能なリンク切れ=${publicExposure ? publicExposure.clickableBrokenLinks : "未計測"}` +
    ` / countConsistencyChecks=${countConsistencyChecks.length}件`,
);

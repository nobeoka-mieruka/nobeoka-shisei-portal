/**
 * Phase197：タップ領域分類レポートのMarkdown生成。
 *
 * `scripts/audit-tap-targets.mjs` が実測して書き出したJSONだけを入力にするため、
 * 文言を直したいときはブラウザで測り直さずに `--render-from` で再生成できる。
 */
import { CLASSIFICATION_LABELS } from "./tap-target-classification.mjs";

const CLASSIFICATION_ORDER = [
  "REAL_BUG",
  "ACCESSIBILITY_IMPROVEMENT",
  "INTENTIONAL",
  "FALSE_POSITIVE",
  "NON_INTERACTIVE",
  "UNCLASSIFIED",
];

const TYPE_LABEL = {
  "tap-target-small": "対象（tap-target-small）",
  "tap-target-inline-link": "参考（tap-target-inline-link）",
};

function label(classification) {
  return CLASSIFICATION_LABELS[classification] ?? "未分類";
}

/** グループ単位の分類レポート（Markdown）。 */
export function renderGroupMarkdown(report) {
  const md = [];
  const s = report.summary;

  md.push("# Phase197 タップ領域・320px候補の完全分類");
  md.push("");
  md.push(`生成日時：${report.generatedAt}（ラベル：${report.label}）`);
  md.push("");
  md.push(report.purpose);
  md.push("");
  md.push("## 対象範囲");
  md.push("");
  md.push(
    "Phase191の監査は44x44未満の操作要素を2種別に分けて数えている。本フェーズで分類を求められた候補は" +
      `**\`tap-target-small\`（${s.tapTargetSmall.occurrences}件）**であり、これを「対象」と表記する。` +
      `\`tap-target-inline-link\`（${s.tapTargetInlineLink.occurrences}件、本文中のインラインリンク。Phase191が要対応から除外した種別）は` +
      "「参考」と表記し、同じ基準で分類だけ行う（実体が独立したリンクだったものは対象と同じ扱いで修正した）。",
  );
  md.push("");
  md.push("## 分類の基準");
  md.push("");
  md.push("| 分類 | 基準 |");
  md.push("| --- | --- |");
  for (const [k, v] of Object.entries(report.criteria)) {
    md.push(`| \`${k}\`（${label(k)}） | ${v} |`);
  }
  md.push("");
  md.push(
    "判定にはWCAG 2.2 達成基準2.5.8 Target Size (Minimum)（レベルAA、24x24 CSSピクセル、間隔・インライン・不可欠の例外あり）と、" +
      "WCAG 2.1 達成基準2.5.5 Target Size（レベルAAA、44x44 CSSピクセル）を用いた。監査スクリプトのしきい値44pxはAAA基準であり、" +
      "これを下回ること自体はAA不適合を意味しない。",
  );
  md.push("");
  md.push("## 集計");
  md.push("");
  md.push("| 指標 | 件数 |");
  md.push("| --- | --- |");
  md.push(`| 対象：tap-target-small 検出（全ビューポート） | ${s.tapTargetSmall.occurrences} |`);
  md.push(`| 対象：グループ数 | ${s.tapTargetSmall.groups} |`);
  md.push(`| 対象：うち320x568での検出 | ${s.tapTargetSmall.occurrencesAt320} |`);
  md.push(`| 対象：うちスマートフォン幅（320〜430px）での検出 | ${s.tapTargetSmall.occurrencesMobile} |`);
  md.push(`| 参考：tap-target-inline-link 検出（全ビューポート） | ${s.tapTargetInlineLink.occurrences} |`);
  md.push(`| 参考：グループ数 | ${s.tapTargetInlineLink.groups} |`);
  md.push("");
  md.push("### 検出器（判定条件）の見直し");
  md.push("");
  md.push(s.revisedDetector.note);
  md.push("");
  md.push("| 判定条件 | tap-target-small 件数 |");
  md.push("| --- | --- |");
  md.push(`| Phase191（従来） | ${s.revisedDetector.tapTargetSmallPhase191} |`);
  md.push(`| Phase197（改良） | ${s.revisedDetector.tapTargetSmallPhase197} |`);
  md.push(`| うち本文中リンクへ再分類 | ${s.revisedDetector.reclassifiedToInlineLink} |`);
  md.push("");
  md.push("### 操作対象でない要素（NON_INTERACTIVE）の実測");
  md.push("");
  md.push(s.nonInteractiveEvidence.note);
  md.push("");
  md.push("| 種類 | 件数 |");
  md.push("| --- | --- |");
  md.push(`| href が無い／\`#\`／\`javascript:\` のリンク | ${s.nonInteractiveEvidence.inertLinks} |`);
  md.push(`| role属性だけで一致し tabindex を持たない要素 | ${s.nonInteractiveEvidence.roleOnlyWithoutTabindex} |`);
  md.push(`| readonly／aria-disabled の入力要素 | ${s.nonInteractiveEvidence.readOnlyControls} |`);
  md.push("");
  md.push("### 分類別の件数");
  md.push("");
  md.push("| 分類 | グループ数 | 検出件数（対象） | 検出件数（参考） | 検出件数（320x568） |");
  md.push("| --- | --- | --- | --- | --- |");
  for (const k of CLASSIFICATION_ORDER) {
    const groups = report.groups.filter((g) => g.classification === k);
    if (groups.length === 0) continue;
    const sum = (t) =>
      groups.filter((g) => g.type === t).reduce((n, g) => n + g.occurrences, 0);
    const at320 = groups.reduce((n, g) => n + g.occurrencesAt320, 0);
    md.push(`| ${k}（${label(k)}） | ${groups.length} | ${sum("tap-target-small")} | ${sum("tap-target-inline-link")} | ${at320} |`);
  }
  md.push("");
  md.push("## グループ別の分類");
  md.push("");
  md.push("| ID | 種別 | 分類 | UI種別 | 実装 | 検出 | 320px | 実サイズ | 実効サイズ | 24px(AA) | 44px(AAA) | 最近接 | 修正 |");
  md.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const g of report.groups) {
    md.push(
      [
        g.id,
        g.type === "tap-target-small" ? "対象" : "参考",
        g.classification,
        g.uiCategory,
        g.component,
        g.occurrences,
        g.occurrencesAt320,
        `${g.minWidth}x${g.minHeight}`,
        `${g.minEffectiveWidth}x${g.minEffectiveHeight}`,
        g.meetsWcag22AA_24px ? "○" : "×",
        g.meetsWcag21AAA_44px ? "○" : "×",
        `${g.minNearestControlDistance ?? "—"}px`,
        g.fixedInPhase197 ? "あり" : "なし",
      ].join(" | ").replace(/^/, "| ") + " |",
    );
  }
  md.push("");
  md.push("## グループ別の判断理由");
  md.push("");
  for (const g of report.groups) {
    md.push(`### ${g.id} ${g.classification}（${g.classificationLabel}）— ${g.uiCategory}`);
    md.push("");
    md.push(`- 検出種別：${TYPE_LABEL[g.type] ?? g.type}`);
    md.push(`- 実装：\`${g.component}\``);
    md.push(`- 表示テキストの例：${g.sampleText ? `「${g.sampleText}」` : "（テキストなし）"}`);
    md.push(`- 対象ページ：${g.pathCount}ページ（例：${g.paths.slice(0, 4).join("、")}）`);
    md.push(`- ビューポート：${g.viewports.join("、")}`);
    md.push(
      `- 検出件数：${g.occurrences}件（うち320x568：${g.occurrencesAt320}件、スマホ幅320〜430px：${g.occurrencesMobile}件）`,
    );
    const sizes =
      g.sizes.length > 8 ? `${g.sizes.slice(0, 8).join("、")} ほか（全${g.sizes.length}通り）` : g.sizes.join("、");
    md.push(
      `- 実サイズ：${sizes}／最小 ${g.minWidth}x${g.minHeight}／実効タップ領域：${g.minEffectiveWidth}x${g.minEffectiveHeight}（測定元：${g.effectiveSources.join("、")}）`,
    );
    md.push(
      `- WCAG 2.2 2.5.8（AA・24px）：${g.meetsWcag22AA_24px ? "充足" : "未充足"}／WCAG 2.1 2.5.5（AAA・44px）：${g.meetsWcag21AAA_44px ? "充足" : "未充足"}／最近接の操作要素まで${g.minNearestControlDistance ?? "—"}px（間隔例外：${g.spacingExceptionOk ? "充足" : "未充足"}）`,
    );
    md.push(`- 市民の利用を妨げるか：${g.userImpact ?? "—"}`);
    md.push(`- Phase197での修正：${g.fixedInPhase197 ? `あり（${g.fix}）` : "なし"}`);
    md.push(`- 理由：${g.reason}`);
    if (g.proposal) md.push(`- 提案（Phase197では実施しない）：${g.proposal}`);
    if (g.detectorFix) md.push(`- 検出器の見直し：${g.detectorFix}`);
    if (g.clipScreenshot) md.push(`- 320x568の切り出し画像：\`${g.clipScreenshot}\`（Git管理外・再生成可能）`);
    md.push("");
  }
  return md.join("\n") + "\n";
}

/** 320x568の要対応候補の明細レポート（Markdown）。 */
export function render320Markdown(report320) {
  const md = [];
  md.push("# Phase197 320x568 要対応候補の完全分類");
  md.push("");
  md.push(`生成日時：${report320.generatedAt}（ラベル：${report320.label}）`);
  md.push("");
  md.push(report320.note);
  md.push("");
  md.push(`候補総数：${report320.total}件`);
  md.push("");
  md.push("| 分類 | 件数 |");
  md.push("| --- | --- |");
  for (const k of CLASSIFICATION_ORDER) {
    const n = report320.byClassification[k];
    if (!n) continue;
    md.push(`| ${k}（${label(k)}） | ${n} |`);
  }
  md.push("");
  md.push(
    "| # | ルート | 要素 | 表示テキスト | 実装 | UI種別 | サイズ | 実効サイズ | 24px(AA) | 44px(AAA) | 最近接 | 分類 | 市民の利用を妨げるか |",
  );
  md.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const f of report320.findings) {
    md.push(
      [
        f.no,
        `\`${f.path}\``,
        f.element,
        (f.text || "（テキストなし）").slice(0, 20),
        f.component,
        f.uiCategory,
        f.size,
        f.effectiveSize,
        f.meetsWcag22AA_24px ? "○" : "×",
        f.meetsWcag21AAA_44px ? "○" : "×",
        `${f.nearestControlDistance ?? "—"}px`,
        f.classification,
        f.userImpact ?? "—",
      ].join(" | ").replace(/^/, "| ") + " |",
    );
  }
  md.push("");
  md.push(
    "※「実効サイズ」は、`<label>`による包み込みや`position:absolute; inset:0`のカード全面リンクなど、見た目の矩形より広い操作領域を実測した値。" +
      "「最近接」は他の操作要素の中心までの最短距離で、WCAG 2.2 2.5.8の間隔例外（24px）の判定に用いる。" +
      "各候補は320x568の実描画から要素を切り出した画像でも確認した（`reports/phase197-screenshots/`、Git管理外・再生成可能）。",
  );
  return md.join("\n") + "\n";
}

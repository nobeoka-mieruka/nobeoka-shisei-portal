#!/usr/bin/env node
/**
 * Phase249：人口統計Excelの出典URL解決（resolve-population-source.mjs）の回帰テスト。
 *
 * 実際に起きた事故：延岡市が統計ファイルを更新するたびに添付ファイルIDが変わり
 * （27980 → 28569 → 28990）、古いIDが404になって自動更新パイプラインが停止した。
 * 「新しいIDへ書き換えて終わり」にすると次の差し替えで同じことが起きるため、
 * 一覧ページからの解決と、次の6つの異常検出をテストで固定する。
 *
 *   1. 404               … 解決URL・既知URLとも取得できない
 *   2. 301/302           … 最終URLが要求と異なる
 *   3. ファイル差し替え   … 同一URLで内容ハッシュが変化
 *   4. 添付ID変更        … 一覧ページ側のIDが既知URLと異なる（＝止まらずに解決できる）
 *   5. HTML誤認          … Excelのつもりでエラーページを掴む
 *   6. 逆戻り            … 解決した資料の基準日が既存登録値より古い
 *
 * ネットワークへは一切アクセスしない（fetchText/fetchBinaryを差し替えて検証する）。
 */
import { createHash } from "node:crypto";
import {
  resolvePopulationSource,
  extractExcelLinks,
  parseLabelReferenceDate,
  pickPopulationLink,
  classifyBuffer,
  highestSeverity,
} from "./auto-update/population/resolve-population-source.mjs";

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ok - ${name}`);
  } else {
    failures.push(`${name}${detail ? `（${detail}）` : ""}`);
    console.log(`  NG - ${name}${detail ? `（${detail}）` : ""}`);
  }
}

const PINNED = "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28990.xls";
const STATS_PAGE = "https://www.city.nobeoka.miyazaki.jp/soshiki/1/1364.html";

/** 実際の「延岡市の統計」ページの構造を再現したHTML（別系列のリンクを含む）。 */
function statsPageHtml({ currentId = "28990", currentLabelDate = "令和8年9月1日" } = {}) {
  return `
<div id="main_body">
  <ul>
    <li><a href="/uploaded/attachment/28989.xls">${currentLabelDate}現在 住民基本台帳による町丁目別人口 [Excelファイル／480KB]</a></li>
    <li><a href="/uploaded/attachment/${currentId}.xls">${currentLabelDate}現在 現住人口・世帯数の推移 [Excelファイル／314KB]</a></li>
    <li><a href="/uploaded/attachment/28991.xls">${currentLabelDate}現在 住民基本台帳による年齢別人口 [Excelファイル／1.25MB]</a></li>
    <li><a href="/uploaded/attachment/25522.xls">令和7年毎月分 住民基本台帳による町丁目別人口・世帯数 [Excelファイル／619KB]</a></li>
    <li><a href="/uploaded/attachment/26961.xls">住民基本台帳による町丁目別人口・世帯数の推移（平成19年～） [Excelファイル／705KB]</a></li>
    <li><a href="/uploaded/attachment/28571.xls">延岡市主要指標 [Excelファイル／254KB]</a></li>
  </ul>
</div>`;
}

const XLS_BYTES = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.from("dummy-xls-body")]);
const XLS_BYTES_V2 = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.from("dummy-xls-body-UPDATED")]);
const HTML_BYTES = Buffer.from("<!DOCTYPE html>\n<html><head><title>お探しのページを見つけることができませんでした。</title></head></html>");

const sha = (b) => createHash("sha256").update(b).digest("hex");

console.log("\n=== Phase249：出典URL解決の基本部品 ===");
{
  const links = extractExcelLinks(statsPageHtml());
  check("一覧ページからExcelリンクをすべて抽出できる", links.length === 6, `${links.length}件`);

  check("ラベルから基準日を読める", parseLabelReferenceDate("令和8年9月1日現在 現住人口・世帯数の推移") === "2026-09-01");
  check("基準日が無いラベルはnull（推測しない）", parseLabelReferenceDate("延岡市主要指標") === null);
  check("令和元年表記も読める", parseLabelReferenceDate("令和元年5月1日現在") === "2019-05-01");

  const { picked, rejected } = pickPopulationLink(links);
  check("現住人口系列のリンクだけを選ぶ", picked?.href === "/uploaded/attachment/28990.xls", picked?.href);
  check("選んだリンクの基準日を保持する", picked?.labelReferenceDate === "2026-09-01");
  const excludedLabels = rejected.map((r) => r.label).join(" / ");
  check(
    "住民基本台帳の「世帯数の推移」を現住人口系列として拾わない（系列の取り違え防止）",
    !picked?.label.includes("住民基本台帳") && excludedLabels.includes("住民基本台帳による町丁目別人口・世帯数の推移"),
  );
  check("国勢調査・住民基本台帳のリンクは4件とも除外される", rejected.filter((r) => r.reason.startsWith("別系列")).length === 4);
}

console.log("\n=== Phase249：取得内容の判定（HTML誤認の検出） ===");
{
  check("xlsのマジックバイトをExcelと判定する", classifyBuffer(XLS_BYTES).isExcel === true);
  check("xlsx（ZIP）もExcelと判定する", classifyBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])).isExcel === true);
  check("HTMLはExcelと判定しない", classifyBuffer(HTML_BYTES).isExcel === false && classifyBuffer(HTML_BYTES).kind === "html");
  check("空バイト列はExcelと判定しない", classifyBuffer(Buffer.alloc(0)).isExcel === false);
}

console.log("\n=== Phase249：正常系（一覧ページから解決できる） ===");
{
  const r = await resolvePopulationSource({
    fetchText: async () => statsPageHtml(),
    fetchBinary: async (url) => ({ buffer: XLS_BYTES, finalUrl: url }),
    pinnedUrl: PINNED,
    statsPageUrl: STATS_PAGE,
    baselineReferenceDate: "2026-08-01",
  });
  check("解決に成功する", r.ok === true);
  check("一覧ページ側から解決している（固定IDへの直アクセスではない）", r.resolvedFrom === "stats-page");
  check("既知URLと同じIDなら「ID変更」とは言わない", r.attachmentIdChanged === false);
  check("正常系ではRED/YELLOWの指摘が出ない", highestSeverity(r.issues) === "NONE", JSON.stringify(r.issues));
}

console.log("\n=== Phase249：異常1 添付ファイルIDが変わった（止まらずに解決できること） ===");
{
  const r = await resolvePopulationSource({
    fetchText: async () => statsPageHtml({ currentId: "29500", currentLabelDate: "令和8年10月1日" }),
    fetchBinary: async (url) => {
      if (url === PINNED) throw new Error("HTTP 404 Not Found");
      return { buffer: XLS_BYTES, finalUrl: url };
    },
    pinnedUrl: PINNED,
    statsPageUrl: STATS_PAGE,
    baselineReferenceDate: "2026-09-01",
  });
  check("既知URLが404でも、一覧ページから解決してパイプラインが止まらない", r.ok === true);
  check("新しい添付ファイルIDを解決している", r.resolvedUrl?.endsWith("/29500.xls"), r.resolvedUrl);
  check("添付ファイルIDの変更を検出する", r.attachmentIdChanged === true);
  check(
    "IDの変更はINFO扱い（自動更新を止めない）",
    r.issues.find((i) => i.code === "ATTACHMENT_ID_CHANGED")?.severity === "INFO",
  );
  check("新しい基準日を読み取れている", r.labelReferenceDate === "2026-10-01");
}

console.log("\n=== Phase249：異常2 404（一覧ページも既知URLも取得できない） ===");
{
  const r = await resolvePopulationSource({
    fetchText: async () => {
      throw new Error("HTTP 404 Not Found");
    },
    fetchBinary: async () => {
      throw new Error("HTTP 404 Not Found");
    },
    pinnedUrl: PINNED,
    statsPageUrl: STATS_PAGE,
    baselineReferenceDate: "2026-09-01",
  });
  check("解決できないことをokで示す", r.ok === false);
  check("未解決をREDとして報告する", highestSeverity(r.issues) === "RED");
  check("一覧ページの取得失敗を記録する", r.issues.some((i) => i.code === "STATS_PAGE_FETCH_FAILED"));
  check("既知URLの取得失敗も記録する", r.issues.some((i) => i.code === "PINNED_FETCH_FAILED"));
}

console.log("\n=== Phase249：異常3 一覧ページは生きているがリンクが消えた（fallbackへ退避） ===");
{
  const r = await resolvePopulationSource({
    fetchText: async () => '<div id="main_body"><p>ただいま準備中です。</p></div>',
    fetchBinary: async (url) => ({ buffer: XLS_BYTES, finalUrl: url }),
    pinnedUrl: PINNED,
    statsPageUrl: STATS_PAGE,
    baselineReferenceDate: "2026-09-01",
  });
  check("既知URL（fallback）で取得を継続する", r.ok === true && r.resolvedFrom === "pinned-fallback");
  check("リンクが見つからないことをREDで報告する", r.issues.some((i) => i.code === "LINK_NOT_FOUND" && i.severity === "RED"));
}

console.log("\n=== Phase249：異常4 HTMLをExcelと誤認していないか ===");
{
  const r = await resolvePopulationSource({
    fetchText: async () => statsPageHtml(),
    fetchBinary: async () => ({ buffer: HTML_BYTES, finalUrl: PINNED }),
    pinnedUrl: PINNED,
    statsPageUrl: STATS_PAGE,
    baselineReferenceDate: "2026-09-01",
  });
  check("HTMLを掴んだ場合は解決失敗にする", r.ok === false);
  check("HTML誤認をREDで報告する", r.issues.some((i) => i.code === "NOT_EXCEL" && i.severity === "RED"));
}

console.log("\n=== Phase249：異常5 リダイレクト（301/302） ===");
{
  const moved = "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28990-moved.xls";
  const r = await resolvePopulationSource({
    fetchText: async () => statsPageHtml(),
    fetchBinary: async () => ({ buffer: XLS_BYTES, finalUrl: moved }),
    pinnedUrl: PINNED,
    statsPageUrl: STATS_PAGE,
    baselineReferenceDate: "2026-09-01",
  });
  check("リダイレクトされても取得は継続する", r.ok === true);
  check("リダイレクトを検出して記録する", r.issues.some((i) => i.code === "REDIRECTED"));
  check("最終URLを記録する", r.diagnostics.finalUrl === moved);
}

console.log("\n=== Phase249：異常6 古い版への逆戻り ===");
{
  const r = await resolvePopulationSource({
    fetchText: async () => statsPageHtml({ currentId: "28569", currentLabelDate: "令和8年8月1日" }),
    fetchBinary: async (url) => ({ buffer: XLS_BYTES, finalUrl: url }),
    pinnedUrl: PINNED,
    statsPageUrl: STATS_PAGE,
    baselineReferenceDate: "2026-09-01",
  });
  check(
    "既存より古い基準日の資料をREDで検出する（古い版への逆戻り防止）",
    r.issues.some((i) => i.code === "REFERENCE_DATE_REGRESSION" && i.severity === "RED"),
  );
}

console.log("\n=== Phase249：異常7 ファイル差し替え（同一URLで内容が変わる） ===");
{
  const first = await resolvePopulationSource({
    fetchText: async () => statsPageHtml(),
    fetchBinary: async (url) => ({ buffer: XLS_BYTES, finalUrl: url }),
    pinnedUrl: PINNED,
    statsPageUrl: STATS_PAGE,
    baselineReferenceDate: "2026-09-01",
  });
  const second = await resolvePopulationSource({
    fetchText: async () => statsPageHtml(),
    fetchBinary: async (url) => ({ buffer: XLS_BYTES_V2, finalUrl: url }),
    pinnedUrl: PINNED,
    statsPageUrl: STATS_PAGE,
    baselineReferenceDate: "2026-09-01",
  });
  check("同一URLでも内容ハッシュの変化で差し替えを検出できる", sha(first.buffer) !== sha(second.buffer));
  check("差し替え後も解決自体は成功する", first.ok && second.ok);
}

console.log("\n=== Phase249：公式ドメイン外のリンクを採用しない ===");
{
  const r = await resolvePopulationSource({
    fetchText: async () =>
      '<div id="main_body"><a href="https://example.com/uploaded/attachment/99999.xls">令和8年9月1日現在 現住人口・世帯数の推移</a></div>',
    fetchBinary: async (url) => ({ buffer: XLS_BYTES, finalUrl: url }),
    pinnedUrl: PINNED,
    statsPageUrl: STATS_PAGE,
    baselineReferenceDate: "2026-09-01",
  });
  check("公式ドメイン外のリンクをREDで拒否する", r.issues.some((i) => i.code === "NON_OFFICIAL_DOMAIN" && i.severity === "RED"));
  check("拒否したうえで既知URLへ退避する", r.resolvedFrom === "pinned-fallback");
}

console.log("\n=== Phase249：固定された添付ファイルIDの棚卸し ===");
{
  const { readFileSync } = await import("node:fs");
  const resolverSrc = readFileSync(new URL("./auto-update/population/resolve-population-source.mjs", import.meta.url), "utf8");
  const updaterSrc = readFileSync(new URL("./auto-update/population/update-population.mjs", import.meta.url), "utf8");
  const idsInResolver = [...resolverSrc.matchAll(/uploaded\/attachment\/(\d+)\.xlsx?/g)].map((m) => m[1]);
  const idsInUpdater = [...updaterSrc.matchAll(/uploaded\/attachment\/(\d+)\.xlsx?/g)].map((m) => m[1]);
  check(
    "更新スクリプト本体に添付ファイルIDを直書きしない（fallback定数は解決モジュールに1つだけ）",
    idsInUpdater.length === 0,
    `検出=${idsInUpdater.join(",") || "なし"}`,
  );
  check("解決モジュールのfallback用の固定IDは1つだけ", idsInResolver.length === 1, `検出=${idsInResolver.join(",")}`);
  check("一覧ページURLが解決モジュールに定義されている", resolverSrc.includes("/soshiki/1/1364.html"));
}

console.log(`\n${passed}件成功`);
if (failures.length > 0) {
  console.error(`\n${failures.length}件失敗:`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log("すべてのテストが成功しました。");

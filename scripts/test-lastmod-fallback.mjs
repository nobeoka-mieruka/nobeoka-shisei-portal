/**
 * lastmod（最終更新日）解決の優先順位が壊れていないことを確認する回帰テスト。
 *
 * 特にPhase198（2026-09-02）で追加した「前回公開時のlastmodへのフォールバック」を守る。
 * 背景：Cloudflare PagesのGit連携ビルドは浅いclone（shallow clone）で行われるため、
 * ファイルごとの実際の更新日をgitから取得できず、以前は最終フォールバックの
 * サイト全体最終更新日（＝実質デプロイ日）が使われていた。その結果、本番のsitemap.xmlで
 * 95URLがデプロイ日と同じ日付になり、実際には更新していないページまで
 * 「今日更新した」と検索エンジンへ伝えてしまっていた（実測で確認）。
 *
 * ネットワークアクセスは行わない。
 */
import assert from "node:assert/strict";
import {
  asValidDate,
  lastmodFromPublishedSitemap,
  lastmodFromUpdateHistory,
  maxValidDate,
  resolveLastmod,
  siteWideLastmod,
} from "./lib/lastmod.mjs";

let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log(`  ok  ${name}`);
}

console.log("[test-lastmod-fallback] lastmod解決の優先順位を検証します");

check("asValidDate：YYYY-MM-DD以外・2000年より前・遠い未来は採用しない", () => {
  assert.equal(asValidDate("2026-08-29"), "2026-08-29");
  assert.equal(asValidDate("2026-08-29T10:00:00+09:00"), "2026-08-29");
  assert.equal(asValidDate("1970-01-01"), undefined);
  assert.equal(asValidDate("2999-01-01"), undefined);
  assert.equal(asValidDate(undefined), undefined);
});

check("maxValidDate：有効な日付のうち最も新しいものを返す", () => {
  assert.equal(maxValidDate(["2026-01-02", undefined, "2026-03-04", "bad"]), "2026-03-04");
  assert.equal(maxValidDate([undefined, "bad"]), undefined);
});

check("優先順位1：データ内の日付が最優先", () => {
  assert.equal(resolveLastmod("/mayor", ["2026-08-05"], ["src/data/mayor.json"]), "2026-08-05");
});

check("前回公開時のsitemap.xmlからlastmodを読み取れる", () => {
  const value = lastmodFromPublishedSitemap("/");
  assert.ok(value, "コミット済みのpublic/sitemap.xmlから「/」のlastmodを読み取れること");
  assert.equal(asValidDate(value), value);
});

check("存在しないURLでは前回公開時のlastmodを返さない", () => {
  assert.equal(lastmodFromPublishedSitemap("/__not-a-real-page__"), undefined);
});

check("データ内の日付もGitの情報も無い場合、ビルド日ではなく前回公開時のlastmodを使う", () => {
  const siteWide = siteWideLastmod();
  // 前回公開時のlastmodがサイト全体の最終更新日と異なり、更新履歴にも記録の無いURLを探す。
  // （このようなURLが1件も無い場合は、前回公開日＝サイト全体の最終更新日で区別できないため検証をスキップする）
  let target;
  for (const path of ["/mayor", "/people", "/finance", "/history", "/committees", "/questions", "/dashboard"]) {
    const published = lastmodFromPublishedSitemap(path);
    if (published && published !== siteWide && !lastmodFromUpdateHistory(path)) {
      target = { path, published };
      break;
    }
  }
  if (!target) {
    console.log("     （前回公開日とサイト全体最終更新日が同じため、この検証はスキップしました）");
    return;
  }
  // データ内の日付なし・参照するデータファイルなし＝Gitからも解決できない状況を再現する。
  const resolved = resolveLastmod(target.path, [], []);
  assert.equal(
    resolved,
    target.published,
    `${target.path} は前回公開時のlastmod（${target.published}）を維持すること。` +
      `サイト全体の最終更新日（${siteWide}）へフォールバックしてはいけない`,
  );
});

console.log(`[test-lastmod-fallback] ${checks}件の検証にすべて合格しました`);

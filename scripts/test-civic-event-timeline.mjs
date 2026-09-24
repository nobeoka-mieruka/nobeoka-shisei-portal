/**
 * 市政タイムライン（/timeline、src/data/civicEventTimeline.json）の検査。
 *
 * 1. イベントIDの重複 = 0
 * 2. イベント・内訳のリンク先が実在ページ（プリレンダリング対象）でないもの = 0（timelineリンク切れ0）
 * 3. 架空の日（元データで日付が月・年までしか確認できないのに日を付けたもの） = 0
 * 4. 日付の形式と precision の不一致 = 0
 * 5. 過去の事実を表す種類（予定以外）に、今日より後の日付 = 0
 * 6. 一次資料URLが元データに存在しないもの（孤立） = 0
 * 7. 議決イベントに含まれる議案の件数が、公開中で議決日のある議案の件数と一致する
 *
 * 使い方: node scripts/test-civic-event-timeline.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { getPrerenderRoutes, root as ROOT } from "./lib/public-routes.mjs";

const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const { events } = readJson("src/data/civicEventTimeline.json");
const TODAY = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

check("イベントIDの重複が0件", () => {
  const seen = new Set();
  const dups = events.filter((e) => (seen.has(e.id) ? true : (seen.add(e.id), false))).map((e) => e.id);
  assert.equal(dups.length, 0, dups.join(", "));
});

check("イベントと内訳のリンク先がすべて実在ページ（リンク切れ0）", () => {
  const routes = new Set(getPrerenderRoutes().map((r) => r.path));
  const missing = [];
  for (const e of events) {
    for (const r of [e.route, ...(e.items ?? []).map((i) => i.route)]) {
      if (!routes.has(r.split(/[?#]/)[0])) missing.push(`${e.id} → ${r}`);
    }
  }
  assert.equal(missing.length, 0, `リンク切れ ${missing.length}件: ${missing.slice(0, 10).join(" / ")}`);
});

check("日付の形式と precision が一致する", () => {
  const bad = events.filter(
    (e) =>
      !(
        (e.precision === "day" && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) ||
        (e.precision === "month" && /^\d{4}-\d{2}$/.test(e.date)) ||
        (e.precision === "year" && /^\d{4}$/.test(e.date))
      ),
  );
  assert.equal(bad.length, 0, bad.slice(0, 10).map((e) => `${e.id}: ${e.date}/${e.precision}`).join(" / "));
});

check("元データで月・年までしか確認できない日付に、日を付けていない（架空のday = 0）", () => {
  const bad = [];
  const terms = new Map(readJson("src/data/archiveMayorTerms.json").map((t) => [`mayor-term-${t.id}`, t]));
  const elections = new Map(readJson("src/data/electionResults.json").map((x) => [`election-${x.id}`, x]));
  for (const e of events) {
    const t = terms.get(e.id);
    if (t && (t.termStartPrecision ?? "day") !== "day" && e.precision === "day") bad.push(e.id);
    const el = elections.get(e.id);
    if (el && ((el.electionDatePrecision ?? "day") !== "day" || !/^\d{4}-\d{2}-\d{2}$/.test(el.electionDate)) && e.precision === "day") {
      bad.push(e.id);
    }
  }
  for (const k of readJson("src/data/kohoNobeokaIssues.json")) {
    const e = events.find((x) => x.id === `koho-${k.id}`);
    if (e && e.precision === "day") bad.push(e.id);
  }
  assert.equal(bad.length, 0, bad.join(", "));
  // 月までの精度の任期・選挙が実際にあり、月表示になっていることも確認する（検査が空振りしていないこと）。
  assert.ok(events.some((e) => e.type === "mayor" && e.precision === "month"), "月精度の市長就任イベントがありません");
});

check("過去の事実を表す種類（予定以外）に、今日より後の日付が無い", () => {
  const bad = events.filter((e) => e.status !== "scheduled" && e.date.slice(0, e.date.length) > TODAY.slice(0, e.date.length));
  assert.equal(bad.length, 0, bad.map((e) => `${e.id}: ${e.date}`).join(" / "));
  const scheduledTypes = new Set(events.filter((e) => e.status === "scheduled").map((e) => e.type));
  assert.ok([...scheduledTypes].every((t) => t === "committee"), `予定として扱う種類が想定外です: ${[...scheduledTypes].join(",")}`);
});

check("一次資料URLが元データに記録されたURLである（孤立0件）", () => {
  const dataDir = join(ROOT, "src/data");
  const corpus = readdirSync(dataDir)
    .filter((n) => n.endsWith(".json") && n !== "civicEventTimeline.json" && n !== "searchIndex.json")
    .map((n) => readFileSync(join(dataDir, n), "utf8"))
    .join("\n");
  const bad = [];
  for (const e of events) {
    for (const u of [e.sourceUrl, ...(e.items ?? []).map((i) => i.sourceUrl)]) {
      if (u && (!/^https?:\/\//.test(u) || !corpus.includes(u))) bad.push(`${e.id}: ${u}`);
    }
  }
  assert.equal(bad.length, 0, bad.slice(0, 10).join(" / "));
});

check("議決イベントの議案件数が、公開中で議決日のある議案の件数と一致する", () => {
  const bills = readJson("src/data/billVotes.json").filter((b) => b.publicationStatus === "published" && b.votingDate && b.votingDate <= TODAY);
  const n = events
    .filter((e) => e.type === "billDecided" || e.type === "settlement" || (e.type === "budget" && e.id.startsWith("bill-decided-")))
    .reduce((sum, e) => sum + (e.items?.length ?? 0), 0);
  assert.equal(n, bills.length);
});

const byType = events.reduce((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {});
console.log(`\n✅ test-civic-event-timeline: ${passCount} checks passed（${events.length}件 ${JSON.stringify(byType)}）`);

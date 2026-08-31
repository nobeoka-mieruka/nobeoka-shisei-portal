/**
 * Phase138：councilSessions.jsonの開会日・閉会日・meetingDaysの整合性テスト。
 *
 * Phase138で延岡市議会会議録検索システムから19会期の開会日・閉会日・本会議日を
 * 新規に確認・登録した（warnings=40→21）。この結果が今後も壊れていないかを検証する軽量な
 * 回帰テスト。既存のscripts/test-*.mjsと同じ「プレーンなNodeスクリプト＋assert」方式。
 *
 * 使い方: node scripts/test-council-session-dates.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const sessions = readJson("src/data/councilSessions.json");
const confirmed = sessions.filter((s) => s.status === "確認済み" || s.status === undefined);

console.log(`\n会期データの現況：${sessions.length}件（実データから再計算）`);
console.log(`  status="確認済み"または未設定（＝確認済み扱い）：${confirmed.length}件`);
console.log(`  status="要確認"：${sessions.filter((s) => s.status === "要確認").length}件`);

check("startDate・endDateが設定されている会期は、endDateがstartDate以降である（日付の前後関係が壊れていないか）", () => {
  const bad = sessions.filter((s) => s.startDate && s.endDate && s.endDate < s.startDate).map((s) => s.id);
  assert.equal(bad.length, 0, `閉会日が開会日より前になっている会期: ${bad.join("、")}`);
});

check("meetingDaysを持つ会期は、全ての日付がstartDate〜endDateの範囲内にある", () => {
  const bad = [];
  for (const s of sessions) {
    if (!s.meetingDays || !s.startDate || !s.endDate) continue;
    for (const d of s.meetingDays) {
      if (d.date < s.startDate || d.date > s.endDate) bad.push(`${s.id}: ${d.date}`);
    }
  }
  assert.equal(bad.length, 0, `会期の範囲外にある本会議日: ${bad.join("、")}`);
});

check("meetingDaysのdate配列に重複が無い（同じ会期内で同日を二重登録していないか）", () => {
  const bad = [];
  for (const s of sessions) {
    if (!s.meetingDays) continue;
    const dates = s.meetingDays.map((d) => d.date);
    if (new Set(dates).size !== dates.length) bad.push(s.id);
  }
  assert.equal(bad.length, 0, `本会議日が重複している会期: ${bad.join("、")}`);
});

check("Phase138で確認済みへ更新した19会期（2000-09〜2019-03の対象ID）が、いずれもstartDate・endDateを保持している", () => {
  const targetIds = [
    "2000-09", "2004-06", "2005-09", "2006-06", "2007-06", "2008-09", "2009-09", "2010-06",
    "2011-03", "2012-09", "2013-06", "2013-09", "2014-03", "2014-09", "2015-09", "2016-09",
    "2017-06", "2018-12", "2019-03",
  ];
  const missing = targetIds.filter((id) => {
    const s = sessions.find((x) => x.id === id);
    return !s || !s.startDate || !s.endDate;
  });
  assert.equal(missing.length, 0, `Phase138で確認したはずの会期にstartDate/endDateが無い: ${missing.join("、")}`);
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");

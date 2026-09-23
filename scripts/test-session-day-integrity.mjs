/**
 * 会期・本会議の開催日・議決日・出典の重複を、ファイルをまたいで検査する。
 *
 * test-referential-integrity.mjs が「参照先のIDが実在するか」を見るのに対し、
 * ここでは「日付と会議録ファイルが互いに食い違っていないか」を見る。
 * 会議録検索システムのファイル名（例：R080612A＝令和8年6月12日）は日付そのものなので、
 * ファイル名・開催日・議決日のずれは機械的に検出できる。
 *
 * 【やらないこと】
 * - 見つけたものを自動で直さない・消さない。
 * - 開催日が未登録の会期を「開催されなかった」と扱わない（理由の記録を求めるだけ）。
 *
 * 使い方: node scripts/test-session-day-integrity.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}
function expectNone(problems, message) {
  assert.equal(problems.length, 0, `${message}（${problems.length}件）:\n  ${problems.slice(0, 15).join("\n  ")}`);
}

/** 会議録ファイル名（R080612A・H200903A）を西暦の日付にする。形式が違えば null。 */
function dateFromMinutesFile(fileName) {
  const m = /^([RH])(\d{2})(\d{2})(\d{2})[A-Z]$/.exec(fileName ?? "");
  if (!m) return null;
  const year = (m[1] === "R" ? 2018 : 1988) + Number(m[2]);
  return `${year}-${m[3]}-${m[4]}`;
}

const sessions = read("src/data/councilSessions.json");
const billVotes = read("src/data/billVotes.json");

check("会議録ファイル名の日付読み取りが正しい（R080612A→2026-06-12、H200903A→2008-09-03）", () => {
  assert.equal(dateFromMinutesFile("R080612A"), "2026-06-12");
  assert.equal(dateFromMinutesFile("H200903A"), "2008-09-03");
  assert.equal(dateFromMinutesFile("R01"), null);
});

check("本会議の開催日：会期内で重複・順序の乱れがなく、会議録ファイル名の日付と一致する", () => {
  const problems = [];
  for (const s of sessions) {
    const days = s.meetingDays ?? [];
    const dates = days.map((d) => d.date);
    if (new Set(dates).size !== dates.length) problems.push(`${s.id}: 同じ開催日が重複`);
    if ([...dates].sort().join() !== dates.join()) problems.push(`${s.id}: 開催日が日付順でない`);
    for (const d of days) {
      if (d.fileName && dateFromMinutesFile(d.fileName) !== d.date) {
        problems.push(`${s.id}: ${d.date} の会議録ファイル名が ${d.fileName}`);
      }
      if (d.minutesUrl && d.fileName && !d.minutesUrl.includes(`fileName=${d.fileName}`)) {
        problems.push(`${s.id}: ${d.date} の会議録URLが fileName=${d.fileName} を指していない`);
      }
      if (s.startDate && s.endDate && (d.date < s.startDate || d.date > s.endDate)) {
        problems.push(`${s.id}: 開催日 ${d.date} が会期（${s.startDate}〜${s.endDate}）の外`);
      }
    }
  }
  expectNone(problems, "本会議の開催日が食い違っています");
});

check("会期の欠落：開催日が未登録の会期には、その理由（会議録の公開待ち等）と確認日が記録されている", () => {
  const problems = [];
  for (const s of sessions) {
    if ((s.meetingDays ?? []).length > 0) {
      if (s.meetingDaysStatus) problems.push(`${s.id}: 開催日が登録済みなのに未登録の理由（${s.meetingDaysStatus}）が残っている`);
      continue;
    }
    if (s.meetingDaysStatus !== "minutesNotYetPublished") problems.push(`${s.id}: 開催日が未登録で、理由の記録がない`);
    else if (!s.meetingDaysStatusNote || !/^\d{4}-\d{2}-\d{2}$/.test(s.meetingDaysStatusCheckedAt ?? "")) {
      problems.push(`${s.id}: 未登録の理由の説明または確認日がない`);
    }
  }
  expectNone(problems, "開催日が未登録の会期に、理由が記録されていません");
});

check("同じ会議録の日（ファイル名）を、2つの会期の開催日として登録していない", () => {
  const owner = new Map();
  const problems = [];
  for (const s of sessions) {
    for (const d of s.meetingDays ?? []) {
      if (!d.fileName) continue;
      if (owner.has(d.fileName)) problems.push(`${d.fileName}: ${owner.get(d.fileName)} と ${s.id}`);
      owner.set(d.fileName, s.id);
    }
  }
  expectNone(problems, "会議録の日が複数の会期に重複しています");
});

check("議決日：開催日が登録済みの会期では、議案の議決日が本会議の開催日のどれかに当たる", () => {
  const daysBySession = new Map(sessions.map((s) => [s.id, new Set((s.meetingDays ?? []).map((d) => d.date))]));
  const problems = [];
  for (const b of billVotes) {
    const days = daysBySession.get(b.sessionId);
    if (!days || days.size === 0 || !b.votingDate) continue;
    if (!days.has(b.votingDate)) problems.push(`${b.id}: 議決日 ${b.votingDate} が ${b.sessionId} の開催日にない`);
  }
  expectNone(problems, "議決日が本会議の開催日と食い違っています");
});

check("議員個人の賛否「公表なし」：議決日の会議録（ファイル名の日付＝議決日）を根拠として記録している", () => {
  // 提案日など別の日の会議録だけでは、その日の採決で個人別の記録が無いことは確かめられない。
  const problems = [];
  for (const b of billVotes) {
    if (b.individualVoteDisclosureStatus !== "notDisclosed") continue;
    const files = [
      ...(b.transcriptUrl ?? "").matchAll(/(?:fileName=|\/)([RH]\d{6}[A-Z])/g),
      ...(b.verificationNote ?? "").matchAll(/([RH]\d{6}[A-Z])/g),
    ].map((m) => m[1]);
    if (!b.votingDate) problems.push(`${b.id}: 議決日が未登録なのに「公表なし」`);
    else if (!files.some((f) => dateFromMinutesFile(f) === b.votingDate)) {
      problems.push(`${b.id}: 議決日 ${b.votingDate} の会議録が根拠に無い`);
    }
  }
  expectNone(problems, "「公表なし」の根拠が議決日の会議録を指していません");
});

check("出典の重複：同じ配列の中に、まったく同じ出典（URL・位置・引用まで同一）を二重に登録していない", () => {
  const dir = join(ROOT, "src/data");
  const skip = /backup|searchIndex|Index\.json$|adminReviewQueue|dataQualitySummary/;
  const problems = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json") && !skip.test(n))) {
    let data;
    try {
      data = JSON.parse(readFileSync(join(dir, f), "utf8"));
    } catch {
      continue;
    }
    const walk = (v, path) => {
      if (Array.isArray(v)) {
        const seen = new Set();
        for (const x of v) {
          if (!x || typeof x !== "object" || Array.isArray(x) || !(x.url || x.sourceUrl)) continue;
          const key = JSON.stringify(x);
          if (seen.has(key)) problems.push(`${f}${path}: ${String(x.url ?? x.sourceUrl).slice(0, 80)}`);
          seen.add(key);
        }
        v.forEach((x, i) => walk(x, `${path}[${i}]`));
      } else if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
      }
    };
    walk(data, "");
  }
  expectNone(problems, "同じ出典が二重に登録されています");
});

console.log(`\n${passCount}件成功\n`);

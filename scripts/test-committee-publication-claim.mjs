/**
 * 「委員会の開催日・審査結果は公表されていない」という、事実と異なる説明が
 * 画面へ出ないことを検証する。
 *
 * ■ 事実（2026-09-22に一次資料で確認）
 * 委員会の開催日と審査結果は、本会議での委員長報告として会議録に記録されている。
 *   例：令和8年第24回定例会 厚生教育委員会委員長報告
 *       「本委員会といたしましては、三月十六日に委員会を開き、関係部課長の出席を求め、
 *         慎重に審査いたしました結果、いずれも原案のとおり可決すべきものと決定いたしました。」
 *       https://www.kensakusystem.jp/nobeoka/cgi-bin3/GetText3.exe?...&fileName=R080319A&startPos=57460
 * また、延岡市議会「常任委員会・特別委員会開催予定表」（attachment/29033.pdf）にも
 * 委員会名・開催日時・場所・協議内容が掲載されている。
 *
 * したがって、当サイトがこれらを取り込んでいないのは「資料が無いから」ではなく
 * 「まだ取り込んでいないから」である。両者を取り違えると、市民に対して
 * 「延岡市議会は委員会の情報を公表していない」という誤った印象を与える。
 *
 * なお「委員会そのものの逐語会議録（開催日・出席委員・個別発言の全文）」は、
 * 会議録検索システムが本会議録のみを収録しているため公表を確認できていない。
 * この2つは別のものなので、テストでも区別する。
 *
 * このプロジェクトには専用のテストランナーが無いため、既存のscripts/test-*.mjsと同じ
 * 「プレーンなNode＋assert」方式に揃えている。
 *
 * 使い方: node scripts/test-committee-publication-claim.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

/** src/ と scripts/ のソースを走査する（生成物・依存は見ない）。 */
function collectSourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectSourceFiles(full, out);
    else if ([".ts", ".tsx", ".mjs", ".js"].includes(extname(name))) out.push(full);
  }
  return out;
}

const sourceFiles = [...collectSourceFiles(join(ROOT, "src")), ...collectSourceFiles(join(ROOT, "scripts"))].filter(
  (f) => !f.endsWith("test-committee-publication-claim.mjs"),
);

console.log(`\n委員会の公表状況の説明を検査（ソース${sourceFiles.length}ファイル＋会期データ）`);

/**
 * 「委員会の開催日・審査結果が公表されていない」と読める言い回し。
 * 逐語会議録（発言全文）についての記述は対象外にするため、
 * 「会議録」「発言記録」を含む文はここでは拾わない。
 */
const FORBIDDEN_PATTERNS = [
  /委員会が(?:いつ|、)?[^。]{0,20}公表されていない/,
  /委員会の(?:個別の)?開催日[^。]{0,40}公表されていない/,
  /開催日[^。]{0,20}審査結果[^。]{0,40}公表されていない/,
];

check("ソースに「委員会の開催日・審査結果は公表されていない」と読める記述が無い", () => {
  const hits = [];
  for (const file of sourceFiles) {
    const text = readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      // 逐語会議録・発言記録についての記述は、実際に公表を確認できていないため対象外。
      if (/会議録|発言記録|発言全文/.test(line)) continue;
      if (FORBIDDEN_PATTERNS.some((re) => re.test(line))) {
        hits.push(`${file.replace(ROOT, "")}: ${line.trim().slice(0, 100)}`);
      }
    }
  }
  assert.equal(hits.length, 0, `事実と異なる記述が残っています:\n${hits.join("\n")}`);
});

check("会期の要約に「委員会がいつ開かれ何を審査したかは公表されていない」が残っていない", () => {
  const sessions = JSON.parse(readFileSync(join(ROOT, "src/data/councilSessions.json"), "utf8"));
  const hits = sessions.filter((s) => /委員会がいつ開かれ[^。]*公表されていない/.test(s.summary ?? ""));
  assert.equal(hits.length, 0, `該当する会期: ${hits.map((s) => s.title).join("、")}`);
});

check("付託がある会期の要約では、取り込んでいないだけであることを示している", () => {
  const sessions = JSON.parse(readFileSync(join(ROOT, "src/data/councilSessions.json"), "utf8"));
  const withReferral = sessions.filter((s) => /委員会への付託/.test(s.summary ?? ""));
  assert.ok(withReferral.length > 0, "委員会への付託に触れた会期が1件もありません（前提が変わった可能性）");
  for (const s of withReferral) {
    assert.match(
      s.summary,
      /まだ取り込んでいません/,
      `${s.title}の要約に、当サイトが未取り込みである旨が書かれていません`,
    );
  }
});

/** 故障注入：誤った言い回しを混ぜたら検出できることを確かめる。 */
check("「公表されていない」と書き戻すと検出される（故障注入）", () => {
  const broken = "委員会がいつ開かれ何を審査したかは公表されていないため、付託先のみを掲載しています。";
  assert.ok(
    FORBIDDEN_PATTERNS.some((re) => re.test(broken)),
    "誤った言い回しを検出できませんでした",
  );
});

check("逐語会議録についての正しい記述は誤検出しない（故障注入の裏返し）", () => {
  const correct =
    "委員会そのものの会議録・発言記録が公開されているかを複数の資料経路で調査しましたが、確認できていません。";
  const isFlagged = !/会議録|発言記録|発言全文/.test(correct) && FORBIDDEN_PATTERNS.some((re) => re.test(correct));
  assert.equal(isFlagged, false, "逐語会議録についての正しい記述を誤って検出しました");
});

console.log(`\n${passCount}件成功\n`);

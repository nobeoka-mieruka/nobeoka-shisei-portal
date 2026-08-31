/**
 * Phase141：市民向け用語説明（councilGlossary.ts・financeGlossary.ts）とtrustLevel表示の
 * 回帰テスト。既存のscripts/test-*.mjsと同じ「プレーンなNodeスクリプト＋assert」方式。
 *
 * 使い方: node scripts/test-civic-glossary.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

function listFiles(dir, ext) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(ext)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

const councilGlossarySrc = readFileSync(join(ROOT, "src/lib/councilGlossary.ts"), "utf8");
const financeGlossarySrc = readFileSync(join(ROOT, "src/lib/financeGlossary.ts"), "utf8");

console.log("\n用語辞書の現況");

check("COUNCIL_GLOSSARY・SOURCE_GLOSSARY・TRUST_LEVEL_LABELの各キーに、空文字列の説明が無い", () => {
  // 簡易パーサ：`キー: "説明",` または `キー:\n  "説明",` の形を検出し、値が空でないことを確認する。
  const entries = [...councilGlossarySrc.matchAll(/^\s*["]?([^":\n]+)["]?:\s*\n?\s*"([^"]*)"/gm)];
  assert.ok(entries.length > 10, `councilGlossary.tsから十分な数の用語エントリを検出できませんでした（検出${entries.length}件）`);
  const empty = entries.filter(([, , def]) => def.trim().length === 0);
  assert.equal(empty.length, 0, `説明が空の用語があります: ${empty.map((e) => e[1]).join("、")}`);
});

// councilGlossary.tsのCOUNCIL_GLOSSARYキー一覧を、このテストからも参照できるよう簡易抽出する
// （TypeScriptファイルをこのプレーンNodeスクリプトから直接importできないため、正規表現で抽出）。
const GLOSSARY_TERMS = Object.fromEntries(
  [...councilGlossarySrc.matchAll(/^\s*([^\s:]+):\s*\n?\s*"/gm)].map((m) => [m[1].replace(/["']/g, ""), true]),
);

check("billVotes.jsonの議決結果（result）で実際に使われている値のうち、単独の結果区分はCOUNCIL_GLOSSARYで説明できる", () => {
  const billVotes = JSON.parse(readFileSync(join(ROOT, "src/data/billVotes.json"), "utf8"));
  const results = new Set(billVotes.map((b) => b.result));
  // 「継続審査」「採択」「不採択」はBillVoteDetailPage.tsx側で別途固有のGlossaryNoteを出しているため対象外。
  const handledElsewhere = new Set(["継続審査", "採択", "不採択"]);
  const uncovered = [];
  for (const r of results) {
    if (handledElsewhere.has(r)) continue;
    // 複合結果（例："原案可決及び認定"）は、いずれかの構成語がCOUNCIL_GLOSSARYにあれば説明可能とみなす。
    const covered = Object.keys(GLOSSARY_TERMS).some((term) => r.includes(term));
    if (!covered) uncovered.push(r);
  }
  assert.equal(uncovered.length, 0, `COUNCIL_GLOSSARYで説明できない議決結果があります: ${uncovered.join("、")}`);
});

check("src配下の.tsx/.tsに、trustLevelの内部値（PRIMARY/OFFICIAL_ARCHIVE/SECONDARY/NEWS/SOCIAL/UNVERIFIED）が文字列リテラルとして画面表示コードに直書きされていない（councilGlossary.ts自身とtype定義ファイルは対象外）", () => {
  const files = [...listFiles(join(ROOT, "src/pages"), ".tsx"), ...listFiles(join(ROOT, "src/components"), ".tsx")];
  const rawValues = ["PRIMARY", "OFFICIAL_ARCHIVE", "SECONDARY", "NEWS", "SOCIAL", "UNVERIFIED"];
  const suspects = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const v of rawValues) {
      // JSX内でそのまま表示されそうな `>{...PRIMARY...}<` や `"PRIMARY"` の直書きを大まかに検出する。
      const re = new RegExp(`>[^<{]*${v}[^<}]*<`);
      if (re.test(text)) suspects.push(`${f}: ${v}`);
    }
  }
  assert.equal(suspects.length, 0, `trustLevelの内部値が画面表示コードに直書きされている疑いがあります: ${suspects.join("、")}`);
});

check("financeGlossary.tsの各用語に空でない説明がある（既存Phase137分の回帰確認）", () => {
  const entries = [...financeGlossarySrc.matchAll(/^\s*([^\s:]+):\s*\n?\s*"([^"]*)"/gm)];
  assert.ok(entries.length >= 6, `financeGlossary.tsから想定より少ない用語しか検出できませんでした（検出${entries.length}件）`);
  const empty = entries.filter(([, , def]) => def.trim().length === 0);
  assert.equal(empty.length, 0, `説明が空の財政用語があります: ${empty.map((e) => e[1]).join("、")}`);
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");

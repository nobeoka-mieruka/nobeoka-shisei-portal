/**
 * Phase139：実機ブラウザ（Chrome拡張）が本セッションで利用できなかったため、
 * 代替としてソースコードレベルで検証可能なアクセシビリティ観点を機械的にチェックする。
 *
 * 重要な限定事項：このプロジェクトはReact 18のSuspenseストリーミングSSRを使っており、
 * prerenderされた生HTMLの文字列上の出現順序は、実際にブラウザで完成するDOMの順序と
 * 一致しない場合がある（Phase139で発見。フッターの内容が、ストリーミング中のプレース
 * ホルダーより先に出現するように見えるが、実際のDOM完成後は正しい順序になる）。
 * そのため、このテストは生HTMLの見出し順序等は検証せず、確実に検証可能な
 * 「JSXソースコード自体のパターン」（alt属性の有無・aria-labelの有無等）のみを対象とする。
 *
 * 既存のscripts/test-*.mjsと同じ「プレーンなNodeスクリプト＋assert」方式。
 *
 * 使い方: node scripts/test-accessibility-source-patterns.mjs
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

function listTsxFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".tsx")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

const files = listTsxFiles(join(ROOT, "src"));
console.log(`\n対象ファイル数：${files.length}件（src配下の.tsx全件）`);

check("<img>要素は全てalt属性を持つ（装飾以外の画像に代替テキストが無いものが無いか）", () => {
  const missing = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    const re = /<img[\s\S]{0,400}?\/?>/g;
    let m;
    while ((m = re.exec(text))) {
      if (!/alt=/.test(m[0])) missing.push(`${f}`);
    }
  }
  assert.equal(missing.length, 0, `alt属性が無い<img>: ${missing.join("、")}`);
});

check("アイコンのみのbutton要素は、aria-labelまたは可視テキストのいずれかを持つ（スクリーンリーダーで用途不明なボタンが無いか）", () => {
  const suspects = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    const re = /<button[\s\S]{0,400}?<\/button>/g;
    let m;
    while ((m = re.exec(text))) {
      const block = m[0];
      const hasAriaLabel = /aria-label/.test(block);
      const hasIcon = /Icon\b/.test(block);
      const textNodes = [...block.matchAll(/>([^<{}]*[一-龠ぁ-んァ-ヶa-zA-Z0-9][^<{}]*)</g)].map((x) => x[1].trim()).filter(Boolean);
      if (hasIcon && !hasAriaLabel && textNodes.length === 0) suspects.push(f);
    }
  }
  assert.equal(suspects.length, 0, `aria-label・可視テキストのいずれも無いアイコンボタンの疑い: ${suspects.join("、")}`);
});

check('target="_blank"のリンクは、rel="noopener"またはrel="noreferrer"を伴う（タブナビゲーション乗っ取り対策。noreferrerはnoopenerの効果も含むため、いずれか一方があれば良い）', () => {
  const missing = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    const re = /<a[\s\S]{0,300}?\/?>/g;
    let m;
    while ((m = re.exec(text))) {
      const block = m[0];
      if (/target=["']_blank["']/.test(block) && !/rel=["'][^"']*(noopener|noreferrer)/.test(block)) missing.push(f);
    }
  }
  assert.equal(missing.length, 0, `target="_blank"だがrel="noopener"/"noreferrer"のいずれも無いリンク: ${missing.join("、")}`);
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
console.log(
  "\n【注意】このテストはソースコードのパターンのみを検証しており、実機ブラウザでの視覚的な崩れ・タップ領域・コントラスト・フォーカス順序等は検証できていません。Chrome接続が復旧次第、実機確認を実施してください。",
);

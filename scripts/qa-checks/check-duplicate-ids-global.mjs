#!/usr/bin/env node
/**
 * duplicate ID横断チェック（src/data全体）
 *
 * 【既存資産との重複回避】
 * scripts/validate-data.mjs は members.json / billVotes.json / councilSessions.json /
 * mayorPromises.json / searchIndex.json / updateHistory.json など「個別に把握しているファイル」
 * について、ファイルごとに手書きでid重複チェックを行っている（checkDuplicateIds等）。
 * 本スクリプトはそれを置き換えるのではなく、以下2点を横断的・機械的に補う：
 *   (A) src/data配下の「まだ手動チェックが書かれていないJSONファイル」内の配列でも、
 *       オブジェクトが id フィールドを持っていれば自動的に重複検出の対象にする
 *       （新規データファイルを追加した際に検証漏れが生じるのを防ぐ保険）。
 *   (B) 同じid文字列が「異なるファイル間」で衝突していないかを横断的に検出する
 *       （validate-data.mjsは基本的にファイル単位でしかidを見ていないため、
 *       例えば archiveMayors.json の "mayor-01" と別ファイルの "mayor-01" が
 *       無関係な由来で偶然衝突しているケースは検出できていない）。
 *
 * (A)(B)とも「本当に問題か」はデータ設計次第（意図的に共有される命名規則もありうる）ため、
 * 本スクリプトの出力は全件エラー確定ではなく、人手レビュー用の一覧として設計している。
 * 読み取り専用。src/data・scripts/への書き込みは一切行わない。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listDataJsonFiles, readJson, walk } from "./_lib.mjs";

const files = listDataJsonFiles();

// (A) ファイル内・配列内でのid重複
const withinFileDuplicates = [];
// (B) ファイル横断でのid衝突（同じidが複数ファイルの"id"配列に出現）
const idOccurrences = new Map(); // id -> [{file, path}]

for (const file of files) {
  let data;
  try {
    data = readJson(join("src", "data", file).replace(/\\/g, "/"));
  } catch {
    continue;
  }

  walk(data, (node, path) => {
    if (!Array.isArray(node) || node.length === 0) return;
    // 配列の要素の過半数がオブジェクトで、かつidフィールドを持つ場合のみ「idを持つコレクション」とみなす。
    const objectElems = node.filter((x) => x !== null && typeof x === "object" && !Array.isArray(x));
    if (objectElems.length < node.length * 0.5) return;
    const withId = objectElems.filter((x) => typeof x.id === "string" && x.id.trim() !== "");
    if (withId.length < objectElems.length * 0.5) return;

    const seen = new Map();
    for (const item of withId) {
      if (seen.has(item.id)) {
        withinFileDuplicates.push({
          file,
          arrayPath: path,
          id: item.id,
          note: "同一配列内でidが重複しています",
        });
      } else {
        seen.set(item.id, true);
      }

      if (!idOccurrences.has(item.id)) idOccurrences.set(item.id, []);
      idOccurrences.get(item.id).push({ file, arrayPath: path });
    }
  });
}

const crossFileCollisions = [];
for (const [id, occurrences] of idOccurrences.entries()) {
  const distinctFiles = new Set(occurrences.map((o) => o.file));
  if (distinctFiles.size > 1) {
    crossFileCollisions.push({ id, occurrences });
  }
}
crossFileCollisions.sort((a, b) => a.id.localeCompare(b.id));

const findings = {
  generatedAt: new Date().toISOString(),
  filesScanned: files.length,
  withinFileDuplicateCount: withinFileDuplicates.length,
  crossFileCollisionCount: crossFileCollisions.length,
  withinFileDuplicates,
  crossFileCollisions,
  note:
    "crossFileCollisionsは「同じid文字列が複数ファイルの配列で使われている」事実の一覧であり、" +
    "設計上意図的な共有命名（例：略称の偶然一致）を含みうるため、全件を即エラー扱いにはしない。" +
    "人手で「本来は別idにすべきか」をレビューすること。withinFileDuplicatesは原則すべて要修正。",
};

const outPath = join(ROOT, "reports", "qa-checks", "_out-duplicate-ids.json");
writeFileSync(outPath, JSON.stringify(findings, null, 2) + "\n", "utf8");

console.log(
  `[check-duplicate-ids-global] filesScanned=${files.length} withinFileDuplicates=${withinFileDuplicates.length} crossFileCollisions=${crossFileCollisions.length}`,
);
if (withinFileDuplicates.length > 0) {
  console.log("  同一配列内重複の例:", withinFileDuplicates.slice(0, 5));
}
process.exitCode = withinFileDuplicates.length > 0 ? 1 : 0;

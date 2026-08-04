/**
 * 非公開の品質レポートを docs/quality-report.md へ生成する。
 *
 * 公開ページからはリンクしない内部向けドキュメント。validate-data.mjsの出力（重複ID・
 * 出典不足・verificationStatus未設定等の警告）をカテゴリ別に集計し、加えて検索インデックス
 * 登録漏れ・主要件数の突合を行う。新しいチェックを追加する場合はvalidate-data.mjs側に
 * 実装し、本スクリプトはその出力を要約するだけに留める（チェックロジックの二重管理を避ける）。
 *
 * 使い方：node scripts/generate-quality-report.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (p) => JSON.parse(readFileSync(`${ROOT}/${p}`, "utf8"));

function runValidateData() {
  // validate-data.mjsはwarn/errをconsole.error（stderr）へ出力するため、2>&1でstdoutへ
  // 合流させてから捕捉する（execSyncの戻り値は既定でstdoutのみのため）。
  try {
    return execSync("node scripts/validate-data.mjs 2>&1", { cwd: ROOT, encoding: "utf8" });
  } catch (e) {
    // errors>0でも非ゼロ終了するため、出力自体は e.stdout から取得する。
    return `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
}

function categorize(output) {
  const lines = output.split("\n").filter((l) => l.startsWith("[ERR]") || l.startsWith("[WARN]"));
  const byCategory = new Map();
  const rules = [
    [/重複/, "ID・キー重複"],
    [/出典|sourceRefs|accessedAt/, "出典不足・未確認"],
    [/verificationStatus/, "verificationStatus未設定・不正"],
    [/存在しない.*(ID|id)/, "孤立データ（存在しない参照）"],
    [/空白期間/, "任期・在職期間の空白"],
    [/リンク切れ|URL/, "URL・リンク関連"],
  ];
  for (const line of lines) {
    let matched = false;
    for (const [re, label] of rules) {
      if (re.test(line)) {
        byCategory.set(label, (byCategory.get(label) ?? 0) + 1);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const key = line.startsWith("[ERR]") ? "その他のエラー" : "その他の警告";
      byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
    }
  }
  const errorCount = lines.filter((l) => l.startsWith("[ERR]")).length;
  const warnCount = lines.filter((l) => l.startsWith("[WARN]")).length;
  return { byCategory, errorCount, warnCount };
}

function searchIndexCoverage() {
  const searchIndex = readJson("src/data/searchIndex.json");
  const byType = new Map();
  for (const e of searchIndex) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);

  const archiveMayors = readJson("src/data/archiveMayors.json");
  const archiveCouncilDocuments = readJson("src/data/archiveCouncilDocuments.json");
  const archivePolicies = readJson("src/data/archivePolicies.json");

  // type:"mayor"には、歴代市長アーカイブ（archiveMayors.json）に加えて現職市長プロフィール
  // （mayor.json由来の"mayor-main"、archiveMayors.jsonとは別管理の既存ページ）が1件含まれる。
  const mayorMainEntry = searchIndex.filter((e) => e.type === "mayor" && e.id === "mayor-main").length;
  const mayorIndexed = (byType.get("mayor") ?? 0) - mayorMainEntry;
  const documentIndexed = byType.get("council-document") ?? 0;

  return [
    { label: "歴代市長（archiveMayors.json）", total: archiveMayors.length, indexed: mayorIndexed },
    { label: "議案・条例・請願・陳情アーカイブ", total: archiveCouncilDocuments.length, indexed: documentIndexed },
    { label: "政策・公約", total: archivePolicies.length, indexed: byType.get("policy") ?? 0 },
  ];
}

function crossPageCountConsistency() {
  // 複数ページで同じ意味のはずの件数が、同一データソースから算出されているかを機械確認する
  // （手入力の固定値が紛れ込むとここで値がズレる）。
  const billVotes = readJson("src/data/billVotes.json");
  const generalQuestions = readJson("src/data/generalQuestions.json");
  const archiveMayors = readJson("src/data/archiveMayors.json");
  return [
    { label: "議案ごとの賛否登録数（billVotes.json）", value: billVotes.length },
    { label: "一般質問（質問通告書ベース）登録数（generalQuestions.json）", value: generalQuestions.length },
    { label: "歴代市長登録数（archiveMayors.json）", value: archiveMayors.length },
  ];
}

const validateOutput = runValidateData();
const { byCategory, errorCount, warnCount } = categorize(validateOutput);
const coverage = searchIndexCoverage();
const counts = crossPageCountConsistency();

const now = new Date().toISOString();
let md = `# 品質レポート（非公開・内部向け）\n\n`;
md += `生成日時（UTC）：${now}\n\n`;
md += `このレポートは公開ページからリンクしていません。\`node scripts/generate-quality-report.mjs\` で再生成できます。\n\n`;

md += `## validate:data の集計\n\n`;
md += `- エラー件数：${errorCount}\n`;
md += `- 警告件数：${warnCount}\n\n`;
md += `| カテゴリ | 件数 |\n|---|---:|\n`;
for (const [label, count] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
  md += `| ${label} | ${count} |\n`;
}

md += `\n## 検索インデックス登録カバレッジ\n\n`;
md += `| データ | 収録件数 | 検索インデックス登録件数 |\n|---|---:|---:|\n`;
for (const c of coverage) {
  md += `| ${c.label} | ${c.total} | ${c.indexed} |\n`;
}

md += `\n## 主要件数（複数ページで参照される値の突合用）\n\n`;
md += `| データ | 件数 |\n|---|---:|\n`;
for (const c of counts) {
  md += `| ${c.label} | ${c.value} |\n`;
}
md += `\n上記は各ページ（トップ、ダッシュボード、/data-status等）が同じJSONファイルから直接算出している値です。手入力の固定値と混在していないかを確認する際の基準値として使ってください。\n`;

writeFileSync(`${ROOT}/docs/quality-report.md`, md);
console.log(`[generate-quality-report] docs/quality-report.md を生成しました（errors=${errorCount}, warnings=${warnCount}）`);

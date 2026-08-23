#!/usr/bin/env node
/**
 * `npm run quality:check` — validate:data/typecheck/lint/build/validate:seo/validate:content と
 * Phase87で追加した横断監査群（scripts/qa-checks/）をまとめて実行する統合コマンド（Phase88で
 * scripts/quality-check.mjsとして正式配置）。
 *
 * 既存の "check": "npm run validate:data && npm run typecheck && npm run lint && npm run build" は
 * &&連結のため最初の失敗で後続が止まる（1つ失敗すると他の結果が分からない）。
 * 本スクリプトは、失敗しても全項目を実行し続け、最後に一覧で結果（PASS/WARNING/FAIL）を出す。
 *
 * 各ステップはchild_process.spawnSyncで既存npm scriptsをそのまま呼び出すのみで、
 * 検証ロジック自体を重複実装しない（validate-data.mjs等の中身を書き換えない）。
 *
 * 実行方法:
 *   npm run quality:check
 *   node scripts/quality-check.mjs --skip-build
 *     （buildは時間がかかるため、動作確認時はスキップ可能にしている）
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");

/**
 * 各ステップの定義。
 * severity: "error"のステップが失敗した場合は最終結果がFAILになる。
 * severity: "warn"のステップが失敗（exitCode!==0）しても最終結果はWARNING止まりとする
 * （scripts/qa-checks/配下の横断監査群は、いきなりCIをブロックしないよう当面warn運用とする）。
 */
const STEPS = [
  { name: "validate:data", cmd: ["npm", "run", "validate:data"], severity: "error" },
  { name: "typecheck", cmd: ["npm", "run", "typecheck"], severity: "error" },
  { name: "lint", cmd: ["npm", "run", "lint"], severity: "error" },
  ...(skipBuild ? [] : [{ name: "build", cmd: ["npm", "run", "build"], severity: "error" }]),
  // build内でvalidate:seo/validate:contentは既に実行されるため（package.jsonのbuildスクリプト参照）、
  // buildをスキップしない場合はここでの重複実行を避ける。skipBuild時のみ単独実行する。
  ...(skipBuild
    ? [
        { name: "validate:seo", cmd: ["npm", "run", "validate:seo"], severity: "warn", requiresDist: true },
        { name: "validate:content", cmd: ["npm", "run", "validate:content"], severity: "warn", requiresDist: true },
      ]
    : []),
  // src/data全体を横断する新規監査群（新規・過渡的にwarn運用とする）。
  {
    name: "check-duplicate-ids-global",
    cmd: ["node", "scripts/qa-checks/check-duplicate-ids-global.mjs"],
    severity: "warn",
  },
  {
    name: "check-orphan-foreign-keys",
    cmd: ["node", "scripts/qa-checks/check-orphan-foreign-keys.mjs"],
    severity: "warn",
  },
  {
    name: "check-source-refs-coverage",
    cmd: ["node", "scripts/qa-checks/check-source-refs-coverage.mjs"],
    severity: "warn",
  },
  {
    name: "check-completeness-status-usage",
    cmd: ["node", "scripts/qa-checks/check-completeness-status-usage.mjs"],
    severity: "warn",
  },
  {
    name: "check-finance-unit-anomalies",
    cmd: ["node", "scripts/qa-checks/check-finance-unit-anomalies.mjs"],
    severity: "warn",
  },
  {
    name: "check-term-overlaps",
    cmd: ["node", "scripts/qa-checks/check-term-overlaps.mjs"],
    severity: "warn",
  },
  {
    name: "check-search-index-and-updates-order",
    cmd: ["node", "scripts/qa-checks/check-search-index-and-updates-order.mjs"],
    severity: "warn",
  },
  {
    name: "check-list-vs-detail-count",
    cmd: ["node", "scripts/qa-checks/check-list-vs-detail-count.mjs"],
    severity: "warn",
    requiresDist: true,
  },
];

const results = [];
for (const step of STEPS) {
  if (step.requiresDist && !existsSync(join(ROOT, "dist"))) {
    results.push({ name: step.name, status: "SKIPPED", detail: "dist/が無いため未実行（先にbuildが必要）" });
    continue;
  }
  console.log(`\n=== ${step.name} ===`);
  const [cmd, ...cmdArgs] = step.cmd;
  // Windows環境ではnpm/npx等が.cmdラッパー経由になり、shell:false かつ拡張子省略だと
  // spawnSyncがEINVALで失敗することがある（本ドラフト作成時に実機で確認済み）。
  // shell:trueにして各プラットフォームのシェル経由で解決させることで確実に動作させる。
  const fullCommand = [cmd, ...cmdArgs].map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ");
  const proc = spawnSync(fullCommand, [], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });
  const ok = proc.status === 0;
  results.push({
    name: step.name,
    status: ok ? "PASS" : step.severity === "error" ? "FAIL" : "WARNING",
    exitCode: proc.status,
  });
}

console.log("\n\n===== quality:check 統合結果 =====");
let overall = "PASS";
for (const r of results) {
  const mark = r.status === "PASS" ? "✅" : r.status === "WARNING" ? "⚠️" : r.status === "SKIPPED" ? "⏭️" : "❌";
  console.log(`${mark} ${r.status.padEnd(8)} ${r.name}`);
  if (r.status === "FAIL") overall = "FAIL";
  else if (r.status === "WARNING" && overall !== "FAIL") overall = "WARNING";
}
console.log(`\n総合結果: ${overall}`);
process.exitCode = overall === "FAIL" ? 1 : 0;

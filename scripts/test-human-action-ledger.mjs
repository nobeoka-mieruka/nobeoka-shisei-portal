#!/usr/bin/env node
/**
 * Phase254：残課題の運用台帳（reports/human-action-ledger.json）の整合性テスト。
 *
 * 【このテストの目的】
 * 件数を減らすことではなく、台帳が実データと食い違わないこと・分類が増殖しないこと・
 * 内部用語が市民向け表現へ漏れないことを守る。
 * warning件数やHUMAN_ACTION_REQUIRED件数そのものは固定値として検査しない
 * （一次資料が公開されれば正しく減るし、新しい課題が見つかれば正しく増えるため）。
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { CATEGORIES, CITIZEN_LABELS, classifyBlockedTask } from "./build-human-action-ledger.mjs";

const LEDGER_PATH = "reports/human-action-ledger.json";
const MD_PATH = "reports/human-action-ledger.md";
const BLOCKED_TASKS_PATH = "src/data/blockedTaskClassification.json";

let checks = 0;
let failures = 0;
function ok(label, condition, detail) {
  checks++;
  if (!condition) {
    failures++;
    console.error(`  [FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("[test-human-action-ledger] 開始");

ok("台帳（JSON）が生成されている", existsSync(LEDGER_PATH));
ok("台帳（Markdown）が生成されている", existsSync(MD_PATH));
if (!existsSync(LEDGER_PATH)) {
  console.error("台帳が無いため以降のテストを実行できません。node scripts/build-human-action-ledger.mjs を実行してください。");
  process.exit(1);
}

const ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
const tasks = JSON.parse(readFileSync(BLOCKED_TASKS_PATH, "utf8"));

/* --- 1. 台帳が最新（実データから再生成しても同じ内容になる） --- */
{
  const res = spawnSync("node", ["scripts/build-human-action-ledger.mjs", "--check"], { encoding: "utf8" });
  ok("台帳が実データと一致している（再生成しても変わらない）", res.status === 0, (res.stderr ?? "").trim());
}

/* --- 2. 分類が増殖していない --- */
const allowedCategories = new Set(Object.keys(CATEGORIES));
for (const item of ledger.items) {
  ok(`分類が既定の7種類のいずれか（${item.id}）`, allowedCategories.has(item.category), item.category);
  ok(`分類ラベルが対応表と一致する（${item.id}）`, item.categoryLabel === CATEGORIES[item.category]);
  ok(`市民向けラベルが対応表と一致する（${item.id}）`, item.citizenLabel === CITIZEN_LABELS[item.category]);
}

/* --- 3. 1件ごとに必要な情報が揃っている --- */
const REQUIRED_FIELDS = [
  "id",
  "category",
  "title",
  "domain",
  "reason",
  "requiredAction",
  "sourceCandidate",
  "lastCheckedAt",
  "priority",
  "blocksRelease",
  "blocksDataPublication",
];
for (const item of ledger.items) {
  for (const field of REQUIRED_FIELDS) {
    ok(`${item.id}: ${field} が存在する`, Object.prototype.hasOwnProperty.call(item, field));
  }
  ok(`${item.id}: priority が3区分のいずれか`, ["high", "medium", "low"].includes(item.priority), item.priority);
  ok(`${item.id}: blocksRelease が真偽値`, typeof item.blocksRelease === "boolean");
  ok(`${item.id}: blocksDataPublication が真偽値`, typeof item.blocksDataPublication === "boolean");
}

/* --- 4. 実データとの整合（解決済みタスクを台帳へ残さない／未解決タスクを落とさない） --- */
const openTaskIds = tasks.filter((t) => t.status !== "COMPLETED").map((t) => t.taskId);
const completedTaskIds = tasks.filter((t) => t.status === "COMPLETED").map((t) => t.taskId);
const ledgerTaskIds = ledger.items.filter((i) => i.origin === "blocked-task").map((i) => i.id);
ok("未解決タスクがすべて台帳にある", openTaskIds.every((id) => ledgerTaskIds.includes(id)));
ok("解決済みタスクを台帳へ載せない", completedTaskIds.every((id) => !ledgerTaskIds.includes(id)));
ok("台帳のタスク件数が実データと一致する", ledgerTaskIds.length === openTaskIds.length, `${ledgerTaskIds.length} vs ${openTaskIds.length}`);
for (const task of tasks.filter((t) => t.status !== "COMPLETED")) {
  const item = ledger.items.find((i) => i.id === task.taskId);
  ok(`${task.taskId}: 分類が既存フィールドから導出したものと一致する`, item?.category === classifyBlockedTask(task));
  ok(`${task.taskId}: 最終確認日が実データと一致する`, item?.lastCheckedAt === (task.lastCheckedAt ?? null));
}

/* --- 5. 件数の定義が守られている --- */
ok(
  "人手対応の件数＝未解決タスク－一次資料の公開待ち",
  ledger.counts.humanActionRequired === ledger.counts.openTasks - ledger.counts.waitingOfficialSource,
);
ok("validate:data の error が0である", ledger.counts.validateDataErrors === 0, String(ledger.counts.validateDataErrors));
ok(
  "errorが0ならリリースを止める件数も0",
  ledger.counts.validateDataErrors !== 0 || ledger.counts.blocksRelease === 0,
);
const categorySum = Object.values(ledger.counts.byCategory).reduce((a, b) => a + b, 0);
ok("分類別の合計が項目数と一致する", categorySum === ledger.items.length, `${categorySum} vs ${ledger.items.length}`);

/* --- 6. warningは「減らすべきもの」として扱わない（定義が書かれていること） --- */
ok("warningの定義が台帳に記録されている", typeof ledger.definitions?.warning === "string" && ledger.definitions.warning.length > 0);
ok(
  "人手対応の定義が台帳に記録されている",
  typeof ledger.definitions?.humanActionRequired === "string" && ledger.definitions.humanActionRequired.includes("WAITING_EXTERNAL"),
);

/* --- 7. 内部情報が市民向け表現へ混ざっていない --- */
const INTERNAL_PATTERNS = [/TASK-\d+/, /Phase\s?\d+/, /[A-Za-z0-9]+\.json/, /WAITING_EXTERNAL|MANUAL_REVIEW|RESEARCH_EXHAUSTED|HUMAN_ACTION_REQUIRED/];
for (const item of ledger.items) {
  for (const re of INTERNAL_PATTERNS) {
    ok(`${item.id}: 市民向けラベルに内部用語が含まれない`, !re.test(item.citizenLabel ?? ""), item.citizenLabel);
  }
}

/* --- 8. 運用台帳を市民向けページから読み込んでいない --- */
{
  const res = spawnSync(
    "node",
    [
      "-e",
      "const {readdirSync,readFileSync,statSync}=require('fs');const {join}=require('path');" +
        "let hit=[];(function walk(d){for(const e of readdirSync(d)){const p=join(d,e);" +
        "if(statSync(p).isDirectory())walk(p);else if(/\\.(ts|tsx)$/.test(p)&&readFileSync(p,'utf8').includes('human-action-ledger'))hit.push(p);}})('src');" +
        "process.stdout.write(hit.join(','));",
    ],
    { encoding: "utf8" },
  );
  ok("運用台帳をsrc配下（市民向け画面）から読み込んでいない", (res.stdout ?? "").trim() === "", res.stdout);
}

console.log(`[test-human-action-ledger] ${checks} checks, ${failures} failures`);
if (failures > 0) process.exit(1);

#!/usr/bin/env node
/**
 * Phase254：残課題（warning／人手対応が必要な項目）の運用台帳を、実データから生成する。
 *
 * 【目的】件数を0にすることではなく、「何が残っていて、なぜ人手が必要なのか」を明確にすること。
 * 一次資料が公開されていない項目を機械的にresolvedへ倒すことは、このスクリプトでは一切行わない。
 *
 * 【単一情報源】
 * 台帳は既存データから毎回導出する（新しい台帳ファイルを手入力で持たない）。
 *   - src/data/blockedTaskClassification.json … 人手対応が必要なタスク（既存の運用台帳）
 *   - scripts/validate-data.mjs の [WARN] 出力  … データ側のwarning（会期要約・市長任期・財政年度）
 * 既存schemaは変更しない。分類（category）も既存フィールドの組み合わせから導出するだけで、
 * データファイルへ新しい列挙値を書き足さない。
 *
 * 【市民向け表示について】
 * この台帳は運用者向けであり、/data-status 等の市民向けページへは出さない
 * （内部ID・Phase番号・ワークフロー名などを含むため）。市民向けには既存の
 * 「公式資料の公開待ち」「人手による追加調査が必要」等の日本語ラベルだけを表示する。
 *
 * 使い方: node scripts/build-human-action-ledger.mjs [--check]
 *   --check … 生成結果を書き出さず、既存ファイルとの差分の有無だけを終了コードで返す
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BLOCKED_TASKS_PATH = join(ROOT, "src", "data", "blockedTaskClassification.json");
const JSON_OUT = join(ROOT, "reports", "human-action-ledger.json");
const MD_OUT = join(ROOT, "reports", "human-action-ledger.md");
const checkOnly = process.argv.includes("--check");

/**
 * 分類。既存の status / blockedReasonCode / nextActionCategory から導出する。
 * 新しい列挙値をデータへ書き足さないため、対応表はこのスクリプト内だけに持つ。
 */
export const CATEGORIES = {
  WAITING_OFFICIAL_SOURCE: "一次資料の公開待ち",
  ONSITE_CONFIRMATION: "図書館・現地での資料確認が必要",
  MANUAL_REVIEW: "人間による判断・照合が必要",
  EXTERNAL_ACCESS_REQUIRED: "外部サービスのログイン・閲覧制限がある",
  DATA_GAP: "資料そのものが確認できない",
  TECHNICAL_LIMITATION: "実機確認など技術的な制約がある",
  RESEARCH_EXHAUSTED: "オンライン調査では確認が困難",
};

/** 市民向けに表示してよい言い換え（内部IDやPhase番号を含めない）。 */
export const CITIZEN_LABELS = {
  WAITING_OFFICIAL_SOURCE: "一次資料の公開待ち",
  ONSITE_CONFIRMATION: "現地資料の確認が必要",
  MANUAL_REVIEW: "追加確認中",
  EXTERNAL_ACCESS_REQUIRED: "追加確認中",
  DATA_GAP: "資料を確認できないため未登録",
  TECHNICAL_LIMITATION: "追加確認中",
  RESEARCH_EXHAUSTED: "調査を尽くしたが未確認",
};

/**
 * 既存フィールドから分類を決める。判定順に意味がある（先に決まったものを採用する）。
 */
export function classifyBlockedTask(task) {
  if (task.status === "RESEARCH_EXHAUSTED") return "RESEARCH_EXHAUSTED";
  if (task.status === "BLOCKED_TECHNICAL") return "TECHNICAL_LIMITATION";
  if (task.status === "WAITING_EXTERNAL") return "WAITING_OFFICIAL_SOURCE";
  if (task.nextActionCategory === "needs_offline_library") return "ONSITE_CONFIRMATION";
  if (task.nextActionCategory === "needs_ndl_login") return "EXTERNAL_ACCESS_REQUIRED";
  if (task.nextActionCategory === "research_exhausted") return "RESEARCH_EXHAUSTED";
  if (task.blockedReasonCode === "SOURCE_UNAVAILABLE") return "DATA_GAP";
  return "MANUAL_REVIEW";
}

/**
 * 着手可能性（運用上の優先度）。対象の中身への評価ではなく、
 * 「いまオンラインで着手できるか」だけで決める機械的な区分。
 */
export function derivePriority(category, task) {
  if (category === "WAITING_OFFICIAL_SOURCE") return task?.autoRecheck === true ? "high" : "medium";
  if (category === "MANUAL_REVIEW") return "medium";
  return "low"; // 現地確認・外部ログイン・調査済みなど、オンラインでは進められないもの
}

/** validate-data の [WARN] 行を、対象ファイルごとにまとめる。 */
export function groupWarningLines(lines) {
  const groups = new Map();
  for (const line of lines) {
    const m = line.match(/^\[WARN\]\s+([A-Za-z0-9_.-]+\.json)([^:]*):\s*(.*)$/);
    if (!m) continue;
    const file = m[1];
    if (!groups.has(file)) groups.set(file, { file, count: 0, messages: [] });
    const g = groups.get(file);
    g.count += 1;
    g.messages.push(m[3].trim());
  }
  return [...groups.values()];
}

/**
 * warningグループを、それを解決する既存タスクへ結びつける。
 * 対応するタスクが無い場合は relatedTaskId = null とし、勝手に新しいタスクを作らない。
 */
const WARNING_OWNERS = {
  "councilSessions.json": {
    relatedTaskId: "TASK-101",
    domain: "市議会（過去の会期要約）",
    title: "過去の会期要約が一次資料本文で未確認",
    reason:
      "会議録の原本が国立国会図書館・県立図書館の館内閲覧限定でデジタル化されておらず、本文をオンラインで確認できないため、会期要約を「一部確認済み」のままにしている。",
    requiredAction: "所蔵館での会議録原本の閲覧、または本文のデジタル公開を待つ。",
    sourceCandidate: "宮崎県立図書館・国立国会図書館所蔵『延岡市議会会議録』原本（館内閲覧限定）",
  },
  "archiveMayorTerms.json": {
    relatedTaskId: "TASK-045",
    domain: "歴代市長（任期）",
    title: "歴代市長の任期に空白期間が残っている",
    reason: "1937〜1994年の一部区間について、就任・退任日を裏づける一次資料がオンラインで確認できていない。",
    requiredAction: "国立国会図書館デジタルコレクション（送信サービス）等での市史・公報の確認。",
    sourceCandidate: "延岡市史・市報のバックナンバー（国立国会図書館の個人送信サービス対象資料）",
  },
  "archiveFiscalYears.json": {
    relatedTaskId: "TASK-102",
    domain: "財政（年度別）",
    title: "財政データに年度の欠番がある",
    reason: "昭和期を中心に、決算額を確認できる一次資料（予算書・決算書・統計書）へオンラインで到達できていない。",
    requiredAction: "国立国会図書館等での予算書・決算書・統計書の確認。",
    sourceCandidate: "延岡市統計書・決算書（国立国会図書館所蔵）",
  },
};

function runValidateDataWarnings() {
  // validate-data.mjs は [WARN] 行を stderr へ、集計行（errors=／warnings=）を stdout へ出す。
  // 台帳の件数を実際のvalidate結果と必ず一致させるため、両方を取り込む。
  const res = spawnSync("node", ["--experimental-strip-types", "scripts/validate-data.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
  const lines = output.split(/\r?\n/);
  const warnLines = lines.filter((l) => l.startsWith("[WARN]"));
  const summary = lines.find((l) => l.includes("errors=") && l.includes("warnings="));
  const m = summary?.match(/errors=(\d+)\s+warnings=(\d+)/);
  return {
    warnLines,
    errorCount: m ? Number(m[1]) : null,
    warningCount: m ? Number(m[2]) : warnLines.length,
  };
}

function build() {
  const tasks = JSON.parse(readFileSync(BLOCKED_TASKS_PATH, "utf8"));
  const { warnLines, errorCount, warningCount } = runValidateDataWarnings();

  const openTasks = tasks.filter((t) => t.status !== "COMPLETED");
  const taskItems = openTasks.map((task) => {
    const category = classifyBlockedTask(task);
    return {
      id: task.taskId,
      origin: "blocked-task",
      category,
      categoryLabel: CATEGORIES[category],
      citizenLabel: CITIZEN_LABELS[category],
      title: task.title,
      domain: task.title?.split(/[（(]/)[0]?.trim() ?? null,
      reason: task.reasonSummary ?? null,
      requiredAction: task.nextActionCategory ?? null,
      sourceCandidate: task.expectedPublicationPeriod ?? null,
      lastCheckedAt: task.lastCheckedAt ?? null,
      priority: derivePriority(category, task),
      // 公開済みデータの誤りではなく「未収録・未確認」であるため、リリースは止めない。
      // 止めるのは validate:data の error / release-check の失敗だけで、現在それは0件。
      blocksRelease: false,
      // 一次資料が無いために、市民向け画面で値のかわりに「確認中」等を表示している項目か。
      blocksDataPublication: true,
      autoRecheck: task.autoRecheck === true,
      relatedWarningFile: null,
    };
  });

  const warningItems = groupWarningLines(warnLines).map((g) => {
    const owner = WARNING_OWNERS[g.file] ?? null;
    const ownerTask = owner ? tasks.find((t) => t.taskId === owner.relatedTaskId) : null;
    const category = ownerTask ? classifyBlockedTask(ownerTask) : "MANUAL_REVIEW";
    return {
      id: `WARN-${g.file.replace(/\.json$/, "")}`,
      origin: "data-warning",
      category,
      categoryLabel: CATEGORIES[category],
      citizenLabel: CITIZEN_LABELS[category],
      title: owner?.title ?? `${g.file} のwarning`,
      domain: owner?.domain ?? g.file,
      reason: owner?.reason ?? g.messages[0] ?? null,
      requiredAction: owner?.requiredAction ?? null,
      sourceCandidate: owner?.sourceCandidate ?? null,
      lastCheckedAt: ownerTask?.lastCheckedAt ?? null,
      priority: derivePriority(category, ownerTask),
      blocksRelease: false,
      blocksDataPublication: true,
      autoRecheck: ownerTask?.autoRecheck === true,
      relatedTaskId: owner?.relatedTaskId ?? null,
      warningCount: g.count,
      warningFile: g.file,
    };
  });

  const items = [...taskItems, ...warningItems];
  const byCategory = Object.fromEntries(
    Object.keys(CATEGORIES).map((key) => [key, items.filter((i) => i.category === key).length]),
  );
  const humanActionItems = taskItems.filter((i) => i.category !== "WAITING_OFFICIAL_SOURCE");

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    note:
      "残課題の運用台帳。件数を減らすことを目的にしていない。一次資料が確認できない項目は、維持することが正しい状態である。" +
      "運用者向けの記録であり、市民向けページへはそのまま出さない（citizenLabelの表現だけを使う）。",
    definitions: {
      warning: "validate:data が出力する [WARN] の件数。データの誤りではなく、一次資料の不足に起因する未確認項目。",
      humanActionRequired:
        "blockedTaskClassification.json のうち、status が COMPLETED でも WAITING_EXTERNAL でもないもの。" +
        "WAITING_EXTERNAL は自動再確認の対象（資料の公開を待つだけ）であり、人手の調査を要する件数とは分けて数える。",
      blocksRelease: "validate:data の error または release-check の失敗を引き起こすか。引き起こす場合だけ true。",
      blocksDataPublication: "一次資料が無いため、市民向け画面で値のかわりに「確認中」等を表示しているか。",
      priority: "内容の重要度ではなく、いまオンラインで着手できるかだけで決める機械的な区分（high/medium/low）。",
    },
    counts: {
      validateDataErrors: errorCount,
      validateDataWarnings: warningCount,
      openTasks: openTasks.length,
      waitingOfficialSource: taskItems.filter((i) => i.category === "WAITING_OFFICIAL_SOURCE").length,
      humanActionRequired: humanActionItems.length,
      blocksRelease: items.filter((i) => i.blocksRelease).length,
      byCategory,
    },
    items,
  };
}

function renderMarkdown(ledger) {
  const lines = [];
  lines.push("# 残課題の運用台帳（自動生成）");
  lines.push("");
  lines.push(`生成日: ${ledger.generatedAt}`);
  lines.push("");
  lines.push("このファイルは `node scripts/build-human-action-ledger.mjs` が既存データから毎回生成する。手で編集しない。");
  lines.push("");
  lines.push("件数を0にすることは目的ではない。一次資料が公開されていない項目は、維持することが正しい状態である。");
  lines.push("");
  lines.push("## 件数");
  lines.push("");
  lines.push("| 指標 | 件数 |");
  lines.push("| --- | ---: |");
  lines.push(`| validate:data errors | ${ledger.counts.validateDataErrors} |`);
  lines.push(`| validate:data warnings | ${ledger.counts.validateDataWarnings} |`);
  lines.push(`| 未完了タスク | ${ledger.counts.openTasks} |`);
  lines.push(`| うち一次資料の公開待ち（自動再確認対象） | ${ledger.counts.waitingOfficialSource} |`);
  lines.push(`| うち人手対応が必要 | ${ledger.counts.humanActionRequired} |`);
  lines.push(`| リリースを止める件数 | ${ledger.counts.blocksRelease} |`);
  lines.push("");
  lines.push("## 分類別");
  lines.push("");
  lines.push("| 分類 | 意味 | 件数 |");
  lines.push("| --- | --- | ---: |");
  for (const [key, label] of Object.entries(CATEGORIES)) {
    lines.push(`| ${key} | ${label} | ${ledger.counts.byCategory[key]} |`);
  }
  lines.push("");
  lines.push("## 項目");
  lines.push("");
  lines.push("| 整理番号 | 分類 | 対象 | なぜ人手が必要か | 次の行動 | 最終確認日 | 着手可能性 |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const i of ledger.items) {
    const reason = (i.reason ?? "").replace(/\|/g, "／").replace(/\s+/g, " ").slice(0, 120);
    lines.push(
      `| ${i.id} | ${i.categoryLabel} | ${i.domain ?? "-"} | ${reason} | ${i.requiredAction ?? "-"} | ${i.lastCheckedAt ?? "-"} | ${i.priority} |`,
    );
  }
  lines.push("");
  return lines.join("\n") + "\n";
}

// テスト等からimportされたときは実行しない（分類関数だけを再利用できるようにする）。
const isDirectRun = Boolean(process.argv[1]) && process.argv[1].replace(/\\/g, "/").endsWith("build-human-action-ledger.mjs");
if (isDirectRun) main();

function main() {
const ledger = build();
const json = JSON.stringify(ledger, null, 2) + "\n";
const md = renderMarkdown(ledger);

if (checkOnly) {
  const existing = existsSync(JSON_OUT) ? readFileSync(JSON_OUT, "utf8") : "";
  const stripDate = (s) => s.replace(/"generatedAt": "[^"]*"/, '"generatedAt": ""');
  if (stripDate(existing) !== stripDate(json)) {
    console.error("[build-human-action-ledger] 台帳の内容が変わっています。再生成してください。");
    process.exit(1);
  }
  console.log("[build-human-action-ledger] 台帳は最新です。");
} else {
  if (!existsSync(dirname(JSON_OUT))) mkdirSync(dirname(JSON_OUT), { recursive: true });
  writeFileSync(JSON_OUT, json);
  writeFileSync(MD_OUT, md);
  console.log(
    `[build-human-action-ledger] warning=${ledger.counts.validateDataWarnings} 人手対応=${ledger.counts.humanActionRequired} 公開待ち=${ledger.counts.waitingOfficialSource} リリース停止=${ledger.counts.blocksRelease}`,
  );
  for (const [key, count] of Object.entries(ledger.counts.byCategory)) console.log(`  ${key}: ${count}`);
  console.log(`[build-human-action-ledger] 出力: ${JSON_OUT} / ${MD_OUT}`);
}
}

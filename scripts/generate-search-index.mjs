import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

function truncate(text, max) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const entries = [];

// --- members ---
const members = readJson("src/data/members.json");
const factions = readJson("src/data/factions.json");
const factionName = (id) => factions.find((f) => f.id === id)?.name ?? "";

for (const m of members) {
  entries.push({
    type: "member",
    title: m.name,
    description: [factionName(m.factionId), ...(m.committees ?? [])].filter(Boolean).join("／"),
    url: `/members/${m.id}`,
    keywords: [m.nameKana, factionName(m.factionId), ...(m.committees ?? []), m.district].filter(Boolean),
  });
}

// --- mayor ---
const mayor = readJson("src/data/mayor.json");
entries.push({
  type: "mayor",
  title: `延岡市長 ${mayor.name}`,
  description: "延岡市長のプロフィール、経歴、公約、市政方針",
  url: "/mayor",
  keywords: [mayor.name, mayor.nameKana].filter(Boolean),
});

// --- mayor promises ---
try {
  const promisesData = readJson("src/data/mayorPromises.json");
  const categoryAnchor = new Map((promisesData.categories ?? []).map((c) => [c.id, c.anchor]));
  for (const p of promisesData.promises ?? []) {
    const anchor = categoryAnchor.get(p.categoryId);
    entries.push({
      type: "promise",
      title: truncate(p.promiseText, 60),
      description: `${p.categoryTitle}／${p.statusLabel}`,
      url: anchor ? `/mayor/policy-progress#${anchor}` : "/mayor/policy-progress",
      keywords: [p.categoryTitle, p.statusLabel, ...(p.progressSummary ?? [])],
    });
  }
} catch {
  // データがない場合はスキップ
}

// --- bills / votes ---
const billVotes = readJson("src/data/billVotes.json");
for (const b of billVotes) {
  entries.push({
    type: "bill",
    title: b.billTitle,
    description: `${b.billNumber}／${b.result}`,
    url: `/bills/votes/${b.id}`,
    keywords: [b.billNumber, b.session, b.committee, b.proposer, ...(b.topics ?? [])].filter(Boolean),
  });
}

// --- general questions ---
const generalQuestions = readJson("src/data/generalQuestions.json");
for (const q of generalQuestions) {
  entries.push({
    type: "question",
    title: q.title,
    description: truncate(q.summary, 80),
    url: `/questions?member=${q.memberId}`,
    keywords: [q.memberName, q.sessionName, ...(q.topics ?? []), ...(q.questionItems ?? [])],
  });
}

// --- compensation ---
try {
  const compensation = readJson("src/data/compensationComparison.json");
  entries.push({
    type: "compensation",
    title: "市長・市議会議員の報酬",
    description: "延岡市長・議長・副議長・議員の月額報酬、期末手当、年間見込額",
    url: "/compensation",
    keywords: compensation.map((c) => c.municipality).filter(Boolean),
  });
} catch {
  // データがない場合はスキップ
}

// --- finance ---
try {
  const finance = readJson("src/data/financeDashboard.json");
  entries.push({
    type: "finance",
    title: "延岡市の財政",
    description: `${finance.fiscalYearLabel}の一般会計、歳入・歳出構成、基金残高、人口推移`,
    url: "/finance",
    keywords: [
      ...(finance.revenue ?? []).map((r) => r.label),
      ...(finance.expenditureByPurpose ?? []).map((r) => r.label),
      ...(finance.supplementaryBudgetProjects ?? []).map((p) => p.title),
    ],
  });
} catch {
  // データがない場合はスキップ
}

// --- update history ---
const updateHistory = readJson("src/data/updateHistory.json");
for (const u of updateHistory) {
  entries.push({
    type: "update",
    title: u.title,
    description: truncate(u.description, 80),
    url: "/updates",
    keywords: [u.category, ...(u.targetPages ?? [])],
  });
}

writeFileSync(join(root, "src", "data", "searchIndex.json"), `${JSON.stringify(entries, null, 2)}\n`, "utf8");
console.log(`[generate-search-index] wrote ${entries.length} entries to src/data/searchIndex.json`);

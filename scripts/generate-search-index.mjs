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
    id: `member-${m.id}`,
    type: "member",
    title: m.name,
    description: [factionName(m.factionId), ...(m.committees ?? [])].filter(Boolean).join("／"),
    url: `/members/${m.id}`,
    keywords: [m.nameKana, factionName(m.factionId), ...(m.committees ?? []), m.district].filter(Boolean),
    content: [m.profile, ...(m.sns ?? []).map((s) => s.platform)].filter(Boolean).join(" "),
    sourceId: m.id,
  });
}

// --- mayor ---
const mayor = readJson("src/data/mayor.json");
entries.push({
  id: "mayor-main",
  type: "mayor",
  title: `延岡市長 ${mayor.name}`,
  description: "延岡市長のプロフィール、経歴、公約、市政方針",
  url: "/mayor",
  keywords: [mayor.name, mayor.nameKana, "市長", "延岡市長"].filter(Boolean),
  content: mayor.profile,
});

// --- mayor promises ---
try {
  const promisesData = readJson("src/data/mayorPromises.json");
  const categoryAnchor = new Map((promisesData.categories ?? []).map((c) => [c.id, c.anchor]));
  const documentByKey = new Map((promisesData.documents ?? []).map((d) => [d.key, d]));
  for (const p of promisesData.promises ?? []) {
    const anchor = categoryAnchor.get(p.categoryId);
    const evidenceLabels = (p.evidenceItems ?? [])
      .map((ev) => documentByKey.get(ev.documentKey)?.label)
      .filter(Boolean);
    entries.push({
      id: `promise-${p.id}`,
      type: "promise",
      title: truncate(p.promiseText, 60),
      description: `${p.categoryTitle}／${p.statusLabel}`,
      url: p.id ? `/mayor/policy-progress/${p.id}` : anchor ? `/mayor/policy-progress#${anchor}` : "/mayor/policy-progress",
      keywords: [p.categoryTitle, p.statusLabel, ...evidenceLabels],
      content: [p.citizenSummary, ...(p.progressSummary ?? []), p.notes].filter(Boolean).join(" "),
      date: p.lastVerified,
      sourceId: p.id,
    });
  }
} catch {
  // データがない場合はスキップ
}

// --- bills / votes ---
const billVotes = readJson("src/data/billVotes.json");
for (const b of billVotes) {
  entries.push({
    id: `bill-${b.id}`,
    type: "bill",
    title: b.billTitle,
    description: `${b.billNumber}／${b.result}`,
    url: `/bills/votes/${b.id}`,
    keywords: [
      b.billNumber,
      b.fiscalYear,
      b.session,
      b.committee,
      b.proposer,
      b.submittingDepartment,
      ...(b.topics ?? []),
      ...(b.memberVotes ?? []).map((v) => v.memberName),
    ].filter(Boolean),
    content: [b.summary, b.reason, b.citizenImpact, ...(b.relatedOrdinances ?? [])].filter(Boolean).join(" "),
    date: b.votingDate || b.submittedDate,
    sourceId: b.id,
  });
}

// --- general questions ---
const generalQuestions = readJson("src/data/generalQuestions.json");
for (const q of generalQuestions) {
  entries.push({
    id: `question-${q.id}`,
    type: "question",
    title: q.title,
    description: truncate(q.summary, 80),
    url: `/questions/${q.id}`,
    keywords: [q.memberName, q.sessionName, q.fiscalYear, ...(q.topics ?? [])].filter(Boolean),
    content: [...(q.questionItems ?? []), q.answerSummary].filter(Boolean).join(" "),
    date: q.questionDate,
    sourceId: q.id,
  });
}

// --- compensation ---
try {
  const compensation = readJson("src/data/compensationComparison.json");
  entries.push({
    id: "compensation-main",
    type: "compensation",
    title: "市長・市議会議員の報酬",
    description: "延岡市長・議長・副議長・議員の月額報酬、期末手当、年間見込額",
    url: "/compensation",
    keywords: ["市長", "議長", "副議長", "議員", "報酬", "給料", ...compensation.map((c) => c.municipality)].filter(
      Boolean,
    ),
  });
} catch {
  // データがない場合はスキップ
}

// --- finance ---
try {
  const finance = readJson("src/data/financeDashboard.json");
  const fi = finance.financialIndicators;
  entries.push({
    id: "finance-main",
    type: "finance",
    title: "延岡市の財政",
    description: `${finance.fiscalYearLabel}の一般会計、歳入・歳出構成、基金残高、人口推移、財政指標`,
    url: "/finance",
    keywords: [
      "財政",
      "予算",
      "決算",
      "人口推移",
      "基金残高",
      "市債",
      "市民1人当たり",
      "財政力指数",
      "経常収支比率",
      "実質公債費比率",
      "将来負担比率",
      "実質収支",
      "健全化判断比率",
      ...(finance.revenue ?? []).map((r) => r.label),
      ...(finance.expenditureByPurpose ?? []).map((r) => r.label),
      ...(finance.expenditureByNature ?? []).map((r) => r.label),
      ...(finance.supplementaryBudgetProjects ?? []).map((p) => p.title),
      ...(fi ? [fi.fiscalYearLabel, ...(fi.notApplicableIndicators ?? [])] : []),
    ].filter(Boolean),
  });
} catch {
  // データがない場合はスキップ
}

// --- mayor entertainment expenses ---
try {
  const expenses = readJson("src/data/mayorEntertainmentExpenses.json");
  entries.push({
    id: "mayor-entertainment-expenses-main",
    type: "finance",
    title: "市長交際費",
    description: `${expenses.fiscalYearLabel}の市長交際費の支出明細、月別・区分別の合計`,
    url: "/mayor/entertainment-expenses",
    keywords: [
      "市長交際費",
      "交際費",
      expenses.fiscalYearLabel,
      ...Array.from(new Set((expenses.expenses ?? []).map((e) => e.category))),
    ].filter(Boolean),
    content: (expenses.expenses ?? []).map((e) => e.description).join(" "),
  });
} catch {
  // データがない場合はスキップ
}

// --- city guide (診断ページの質問・担当課データは src/data/cityGuideData.ts で管理しているため、ここでは固定の案内エントリのみ登録する) ---
entries.push({
  id: "guide-main",
  type: "guide",
  title: "延岡市役所 どこに行けばいい？診断",
  description: "質問に答えるだけで、住民票・税金・子育て・介護・ごみ・道路など、市役所のどの課に相談すればよいかが分かります。",
  url: "/city-guide",
  keywords: [
    "市役所案内",
    "どこに行けばいい",
    "窓口案内",
    "市民課",
    "税金",
    "子育て",
    "介護",
    "障がい",
    "ごみ",
    "環境",
    "住宅",
    "空き家",
    "道路",
    "水道",
    "下水道",
    "仕事",
    "農業",
    "防災",
    "災害",
    "総合案内",
  ],
});

// --- mayor press conferences (データは src/data/mayorPressConferences.ts で管理しているため、ここでは固定エントリを登録する) ---
entries.push({
  id: "press-conference-2026-07-16",
  type: "press-conference",
  title: "令和8年7月16日市長定例記者会見",
  description:
    "県内初のリーグH公式戦開催、愛宕山実証実験イベント募集、自衛隊統合防災演習、INSECTS特別展、市民スペース開放、学びの多様化学校の学校名提案について",
  url: "/mayor/press-conferences/2026-07-16",
  keywords: [
    "市長定例記者会見",
    "リーグH",
    "愛宕山",
    "自衛隊統合防災演習",
    "08JXR",
    "INSECTS",
    "内藤記念博物館",
    "市民スペース",
    "学びの多様化学校",
    "熊野江教室",
  ],
  date: "2026-07-16",
});

// --- update history ---
const updateHistory = readJson("src/data/updateHistory.json");
for (const u of updateHistory) {
  entries.push({
    id: `update-${u.id}`,
    type: "update",
    title: u.title,
    description: truncate(u.description, 80),
    url: "/updates",
    keywords: [u.category, ...(u.targetPages ?? [])],
    date: u.date,
    sourceId: u.id,
  });
}

// --- 固定ページ（このサイトについて／編集方針／利用規約／お問い合わせ／ダッシュボード） ---
const staticPages = [
  {
    id: "page-about",
    title: "このサイトについて",
    description: "延岡市政見える化ポータルの目的、運営方針、主な情報源について説明しています。",
    url: "/about",
    keywords: ["このサイトについて", "運営方針", "非公式"],
  },
  {
    id: "page-editorial-policy",
    title: "編集方針・情報源",
    description: "延岡市政見える化ポータルの編集方針、情報源、掲載しない情報の範囲について説明しています。",
    url: "/editorial-policy",
    keywords: ["編集方針", "情報源", "出典"],
  },
  {
    id: "page-terms",
    title: "利用規約・免責事項",
    description: "延岡市政見える化ポータルの利用規約、免責事項、プライバシーに関する案内を掲載しています。",
    url: "/terms",
    keywords: ["利用規約", "免責事項", "プライバシー"],
  },
  {
    id: "page-contact",
    title: "情報提供・訂正依頼",
    description: "掲載内容の誤りのご指摘や、新しい公開資料の情報提供を受け付ける窓口です。",
    url: "/contact",
    keywords: ["情報提供", "訂正依頼", "お問い合わせ", "連絡先"],
  },
  {
    id: "page-dashboard",
    title: "市政データダッシュボード",
    description: "延岡市議会議員、議案、市長公約などの登録件数や構成を、データから自動集計して確認できます。",
    url: "/dashboard",
    keywords: ["ダッシュボード", "統計", "集計", "会派別", "年齢構成"],
  },
  {
    id: "page-mayor-press-conferences",
    title: "市長定例記者会見",
    description: "延岡市長の定例記者会見の発表事項を、延岡市公式ホームページに基づいて開催日順に整理しています。",
    url: "/mayor/press-conferences",
    keywords: ["市長定例記者会見", "記者会見", "発表事項"],
  },
];
for (const p of staticPages) {
  entries.push({ ...p, type: "page" });
}

writeFileSync(join(root, "src", "data", "searchIndex.json"), `${JSON.stringify(entries, null, 2)}\n`, "utf8");
console.log(`[generate-search-index] wrote ${entries.length} entries to src/data/searchIndex.json`);

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

// --- archive: former members ---
try {
  const archiveMemberProfiles = readJson("src/data/archiveMemberProfiles.json");
  for (const p of archiveMemberProfiles) {
    entries.push({
      id: `former-member-${p.id}`,
      type: "former-member",
      title: `${p.name}（元議員）`,
      description: "現職ではない過去の延岡市議会議員。公式資料で確認できた在職・活動の記録を掲載しています。",
      url: `/members/former/${p.slug}`,
      keywords: [p.nameKana, "元議員", "過去の議員"].filter(Boolean),
      content: p.notes ?? "",
      date: p.lastVerifiedAt,
      sourceId: p.id,
    });
  }
} catch {
  // データがない場合はスキップ
}

// --- archive: policies ---
// AI生成コンテンツ（aiAnalysis）は、公式資料（summary/sourceOriginalText）と混同しないよう
// content/description/keywordsには一切含めない（検索インデックスをAI生成文で汚染しない）。
try {
  const archivePolicies = readJson("src/data/archivePolicies.json");
  const archivePolicyCategories = readJson("src/data/archivePolicyCategories.json");
  const archivePolicyQuestionRelations = readJson("src/data/archivePolicyQuestionRelations.json");
  const archiveMayors = readJson("src/data/archiveMayors.json");
  const formerMembers = readJson("src/data/formerMembers.json");
  const generalQuestionsForPolicies = readJson("src/data/generalQuestions.json");

  const categoryLabel = (id) => archivePolicyCategories.find((c) => c.id === id)?.label ?? "";
  const questionTitle = (id) => generalQuestionsForPolicies.find((q) => q.id === id)?.title ?? "";

  const POLICY_OWNER_TYPE_LABELS = {
    mayor: "市長",
    member: "議員",
    formerMember: "元議員",
    faction: "会派",
    city: "市",
  };
  const POLICY_SOURCE_TYPE_LABELS = {
    electionManifesto: "選挙公約",
    policyDocument: "政策文書",
    councilQuestion: "一般質問",
    mayorPolicySpeech: "市長施政方針",
    budgetDocument: "予算資料",
    settlementDocument: "決算資料",
    comprehensivePlan: "総合計画",
    ordinance: "条例",
    bill: "議案",
    officialStatement: "公式発表",
    otherOfficialSource: "その他公式資料",
  };

  function policyOwnerName(p) {
    if (p.ownerType === "city") return "延岡市";
    if (!p.ownerId) return "";
    if (p.ownerType === "mayor") return archiveMayors.find((m) => m.id === p.ownerId)?.name ?? "";
    if (p.ownerType === "member") return members.find((m) => m.id === p.ownerId)?.name ?? "";
    if (p.ownerType === "formerMember") return formerMembers.find((m) => m.id === p.ownerId)?.name ?? "";
    if (p.ownerType === "faction") return factionName(p.ownerId);
    return "";
  }

  for (const p of archivePolicies) {
    const relatedQuestionIds = [
      ...new Set([
        ...(p.relatedQuestionIds ?? []),
        ...archivePolicyQuestionRelations.filter((r) => r.policyId === p.id).map((r) => r.questionId),
      ]),
    ];
    const relatedQuestionTitles = relatedQuestionIds.map(questionTitle).filter(Boolean);
    const announcedYear = p.announcedDate ? p.announcedDate.slice(0, 4) : undefined;

    entries.push({
      id: `policy-${p.id}`,
      type: "policy",
      title: p.title,
      description: p.summary,
      url: `/policies/${p.slug}`,
      keywords: [
        policyOwnerName(p),
        POLICY_OWNER_TYPE_LABELS[p.ownerType],
        ...(p.categoryIds ?? []).map(categoryLabel),
        POLICY_SOURCE_TYPE_LABELS[p.sourceType],
        announcedYear ? `${announcedYear}年度` : undefined,
        ...(p.relatedFiscalYears ?? []).map((y) => `${y}年度`),
        ...relatedQuestionTitles,
      ].filter(Boolean),
      // 公式資料（要約・原文）のみを全文検索対象にする。AI生成の要約・分類はここに含めない。
      content: [p.summary, p.sourceOriginalText].filter(Boolean).join(" "),
      date: p.announcedDate ?? p.lastVerifiedAt,
      sourceId: p.id,
    });
  }
} catch {
  // データがない場合はスキップ
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
// rejected・errorのみ検索インデックスから除外する。pendingReview等（確認待ち）は「確認待ち」表示を
// 伴って一般公開しているため、検索対象にも含める。
const billVotes = readJson("src/data/billVotes.json").filter(
  (b) => b.publicationStatus !== "rejected" && b.publicationStatus !== "error",
);
for (const b of billVotes) {
  entries.push({
    id: `bill-${b.id}`,
    type: "bill",
    title: b.billTitle,
    description:
      b.verificationStatus && b.verificationStatus !== "verified"
        ? `${b.billNumber}／${b.result}（確認待ち）`
        : `${b.billNumber}／${b.result}`,
    url: `/bills/votes/${b.id}`,
    keywords: [
      b.billNumber,
      b.fiscalYear,
      b.session,
      b.category,
      b.result,
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

// --- council speech summaries（会議録本文ベースの一般質問・答弁要約） ---
// 収録対象期間（councilSpeechPeriod.from）より前のデータ、および非公開（isPublished:false）
// のデータは検索対象に含めない。
try {
  const { councilSpeechPeriod } = await import("./lib/council-speech-period.mjs");
  const speechData = readJson("src/data/councilSpeechSummaries.json");
  const members2 = readJson("src/data/members.json");
  const memberName = (id) => members2.find((m) => m.id === id)?.name ?? id;

  for (const record of speechData.members ?? []) {
    for (const s of record.speeches ?? []) {
      if (!s.isPublished || !s.date || s.date < councilSpeechPeriod.from) continue;
      entries.push({
        id: `speech-${s.id}`,
        type: "speech",
        title: `${memberName(s.memberId)}議員の${s.speechType}`,
        description: truncate(s.shortSummary ?? "", 80),
        url: `/members/${s.memberId}/questions/${s.id}`,
        keywords: [memberName(s.memberId), s.speechType, s.meetingType, ...(s.topics ?? [])].filter(Boolean),
        content: s.questionItems.flatMap((q) => [q.title, q.questionSummary, q.answerSummary]).filter(Boolean).join(" "),
        date: s.date,
        sourceId: s.id,
      });
    }
  }
} catch {
  // データがない場合はスキップ
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
    id: "page-members-former",
    title: "元議員（延岡市政アーカイブ）",
    description: "現職ではない過去の延岡市議会議員について、公式資料で確認できた在職・活動の記録を整理しています。",
    url: "/members/former",
    keywords: ["元議員", "過去の議員", "延岡市政アーカイブ"],
  },
  {
    id: "page-members-history",
    title: "議員在籍履歴（延岡市政アーカイブ）",
    description: "会期ごとに、公式資料で在籍が確認できた元議員を整理しています。",
    url: "/members/history",
    keywords: ["議員在籍履歴", "在籍履歴", "延岡市政アーカイブ"],
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

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const errors = [];
const warnings = [];

function err(file, message) {
  errors.push(`[ERROR] ${file}: ${message}`);
}
function warn(file, message) {
  warnings.push(`[WARN] ${file}: ${message}`);
}

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/\S+$/;

function isBlank(v) {
  return typeof v !== "string" || v.trim().length === 0;
}

// --- members.json ---
const members = readJson("src/data/members.json");
const memberIds = new Set();
const VALID_GENDERS = new Set(["male", "female", "other", "undisclosed", "unknown"]);

for (const m of members) {
  const tag = `members.json (${m.id ?? "id不明"})`;
  if (isBlank(m.id)) err(tag, "idが空です");
  else if (memberIds.has(m.id)) err(tag, `議員IDが重複しています: ${m.id}`);
  else memberIds.add(m.id);

  if (isBlank(m.name)) err(tag, "nameが空です");
  if (isBlank(m.nameKana)) err(tag, "nameKanaが空です");
  if (isBlank(m.factionId)) warn(tag, "factionIdが空です");
  if (m.gender && !VALID_GENDERS.has(m.gender)) err(tag, `未定義のgenderです: ${m.gender}`);
  if (m.termCount !== undefined && typeof m.termCount !== "number") err(tag, "termCountが数値ではありません");
  if (m.age !== undefined && typeof m.age !== "number") err(tag, "ageが数値ではありません");

  if (m.photoUrl) {
    const localPath = join(root, "public", m.photoUrl.replace(/^\//, ""));
    if (!existsSync(localPath)) warn(tag, `photoUrlのファイルが見つかりません: ${m.photoUrl}`);
  }
  if (m.profileUrl && !URL_RE.test(m.profileUrl)) err(tag, `profileUrlの形式が不正です: ${m.profileUrl}`);

  const snsUrls = new Set();
  for (const s of m.sns ?? []) {
    if (!URL_RE.test(s.url ?? "")) err(tag, `SNS URLの形式が不正です: ${s.url}`);
    if (snsUrls.has(s.url)) err(tag, `同じSNS URLが重複登録されています: ${s.url}`);
    snsUrls.add(s.url);
  }

  for (const v of m.votes ?? []) {
    if (v.date && !DATE_RE.test(v.date)) err(tag, `votes[].dateの形式が不正です: ${v.date}`);
  }
  for (const q of m.questions ?? []) {
    if (q.date && !DATE_RE.test(q.date)) err(tag, `questions[].dateの形式が不正です: ${q.date}`);
  }
}

// --- generalQuestions.json ---
const generalQuestions = readJson("src/data/generalQuestions.json");
const questionIds = new Set();
const VALID_SESSION_TYPES = new Set(["定例会", "臨時会"]);
const VALID_QUESTION_TYPES = new Set(["一般質問", "代表質問"]);

for (const q of generalQuestions) {
  const tag = `generalQuestions.json (${q.id ?? "id不明"})`;
  if (isBlank(q.id)) err(tag, "idが空です");
  else if (questionIds.has(q.id)) err(tag, `一般質問IDが重複しています: ${q.id}`);
  else questionIds.add(q.id);

  if (!memberIds.has(q.memberId)) err(tag, `存在しない議員IDを参照しています: ${q.memberId}`);
  if (q.sessionType && !VALID_SESSION_TYPES.has(q.sessionType)) err(tag, `未定義のsessionTypeです: ${q.sessionType}`);
  if (q.questionType && !VALID_QUESTION_TYPES.has(q.questionType)) err(tag, `未定義のquestionTypeです: ${q.questionType}`);
  if (q.questionDate && !DATE_RE.test(q.questionDate)) err(tag, `questionDateの形式が不正です: ${q.questionDate}`);
  if (isBlank(q.title)) err(tag, "titleが空です");
  if (q.questionCount !== undefined && q.questionItems && q.questionCount !== q.questionItems.length) {
    warn(tag, `questionCount(${q.questionCount})とquestionItemsの件数(${q.questionItems.length})が一致しません`);
  }
  if (q.durationMinutes !== undefined && (typeof q.durationMinutes !== "number" || q.durationMinutes <= 0)) {
    err(tag, `durationMinutesが不正です（0より大きい数値である必要があります）: ${q.durationMinutes}`);
  }
  if (q.transcriptPdfUrl && !URL_RE.test(q.transcriptPdfUrl)) {
    err(tag, `transcriptPdfUrlの形式が不正です: ${q.transcriptPdfUrl}`);
  }
  for (const item of q.relatedFinanceItems ?? []) {
    if (isBlank(item)) err(tag, "relatedFinanceItemsに空文字が含まれています");
  }
}

// --- billVotes.json ---
const billVotes = readJson("src/data/billVotes.json");
const billIds = new Set();
const VALID_VOTE_STATUS = new Set([
  "approve",
  "oppose",
  "departed",
  "absent",
  "recused",
  "notVoting",
  "abstained",
  "unconfirmed",
]);
const VALID_PROPOSER_TYPES = new Set(["mayor", "member", "committee", "other"]);
const VALID_BILL_VOTE_RESULTS = new Set([
  "原案可決",
  "修正可決",
  "否決",
  "承認",
  "認定",
  "同意",
  "採択",
  "不採択",
  "継続審査",
  "撤回",
  "その他",
  "確認中",
]);

for (const b of billVotes) {
  const tag = `billVotes.json (${b.id ?? "id不明"})`;
  if (isBlank(b.id)) err(tag, "idが空です");
  else if (billIds.has(b.id)) err(tag, `議案IDが重複しています: ${b.id}`);
  else billIds.add(b.id);

  if (isBlank(b.billNumber)) err(tag, "billNumberが空です");
  if (isBlank(b.billTitle)) err(tag, "billTitleが空です");
  if (isBlank(b.summary)) err(tag, "summaryが空です");
  if (b.submittedDate && !DATE_RE.test(b.submittedDate)) err(tag, `submittedDateの形式が不正です: ${b.submittedDate}`);
  if (b.votingDate && !DATE_RE.test(b.votingDate)) err(tag, `votingDateの形式が不正です: ${b.votingDate}`);
  if (!VALID_BILL_VOTE_RESULTS.has(b.result)) err(tag, `未定義の議決結果です: ${b.result}`);

  const seenVoters = new Set();
  for (const v of b.memberVotes ?? []) {
    if (!memberIds.has(v.memberId)) err(tag, `存在しない議員IDを参照しています: ${v.memberId}`);
    if (!VALID_VOTE_STATUS.has(v.vote)) err(tag, `未定義の賛否状態です: ${v.vote}`);
    if (seenVoters.has(v.memberId)) err(tag, `同じ議員の賛否が二重登録されています: ${v.memberId}`);
    seenVoters.add(v.memberId);
  }

  const billDocUrls = [b.billDocumentUrl, b.resultDocumentUrl, b.transcriptUrl, b.committeeDocumentUrl, b.budgetDocumentUrl, b.videoUrl];
  for (const url of billDocUrls) {
    if (url && !URL_RE.test(url)) err(tag, `根拠資料URLの形式が不正です: ${url}`);
  }
  // 「確認中」以外＝議決結果が確定しているデータには、必ず何らかの根拠資料URLを求める。
  const hasAnyDocument = billDocUrls.some(Boolean) || (b.relatedDocumentUrls ?? []).length > 0;
  if (b.result && b.result !== "確認中" && !hasAnyDocument) {
    err(tag, "議決結果が確定しているのに根拠資料URLが1件もありません");
  }

  if (b.proposerType && !VALID_PROPOSER_TYPES.has(b.proposerType)) {
    err(tag, `未定義のproposerTypeです: ${b.proposerType}`);
  }

  for (const ordinance of b.relatedOrdinances ?? []) {
    if (isBlank(ordinance)) err(tag, "relatedOrdinancesに空文字が含まれています");
  }

  for (const qId of b.relatedQuestionIds ?? []) {
    if (!questionIds.has(qId)) warn(tag, `存在しない一般質問IDを参照しています: ${qId}`);
  }

  for (const item of b.relatedFinanceItems ?? []) {
    if (isBlank(item)) err(tag, "relatedFinanceItemsに空文字が含まれています");
  }
}

// --- mayorPromises.json ---
let mayorPromiseIds = new Set();
const VALID_PROMISE_STATUS_LABELS = new Set([
  "達成",
  "進行中",
  "一部実施",
  "未着手",
  "方針変更",
  "確認中",
  "検討中",
  "実施済み",
]);
// 「達成」相当の確定的な状況。確定ステータスなのに根拠資料がない場合はエラーとする。
const CONFIRMED_PROMISE_STATUSES = new Set(["達成", "実施済み"]);

try {
  const mayorPromises = readJson("src/data/mayorPromises.json");
  const categoryIds = new Set((mayorPromises.categories ?? []).map((c) => c.id));
  const documentKeys = new Set((mayorPromises.documents ?? []).map((d) => d.key));
  // status(内部キー)とstatusLabel(表示ラベル)の対応が公約データ全体で一貫しているかを確認する
  // （固定の対応表を用意するのではなく、実データ内の対応関係自体の矛盾を検出する）。
  const statusToLabel = new Map();
  const labelToStatus = new Map();

  for (const p of mayorPromises.promises ?? []) {
    const tag = `mayorPromises.json (${p.id ?? "id不明"})`;

    if (isBlank(p.id)) err(tag, "idが空です");
    else if (mayorPromiseIds.has(p.id)) err(tag, `公約IDが重複しています: ${p.id}`);
    else mayorPromiseIds.add(p.id);

    if (isBlank(p.promiseText)) err(tag, "promiseTextが空です");
    if (isBlank(p.categoryTitle)) err(tag, "categoryTitleが空です");
    if (isBlank(p.categoryId)) err(tag, "categoryIdが空です");
    else if (!categoryIds.has(p.categoryId)) err(tag, `存在しないcategoryIdを参照しています: ${p.categoryId}`);

    if (!VALID_PROMISE_STATUS_LABELS.has(p.statusLabel)) err(tag, `未定義のstatusLabelです: ${p.statusLabel}`);
    if (CONFIRMED_PROMISE_STATUSES.has(p.statusLabel) && (p.evidenceItems ?? []).length === 0) {
      err(tag, `statusLabel="${p.statusLabel}"（確定的な状況）なのに根拠資料（evidenceItems）が1件もありません`);
    }
    if (isBlank(p.status)) {
      err(tag, "statusが空です");
    } else if (p.statusLabel) {
      const mappedLabel = statusToLabel.get(p.status);
      if (mappedLabel === undefined) {
        statusToLabel.set(p.status, p.statusLabel);
      } else if (mappedLabel !== p.statusLabel) {
        err(
          tag,
          `statusとstatusLabelの対応が他の公約と矛盾しています: status="${p.status}" が "${mappedLabel}" と "${p.statusLabel}" の両方に対応付けられています`,
        );
      }

      const mappedStatus = labelToStatus.get(p.statusLabel);
      if (mappedStatus === undefined) labelToStatus.set(p.statusLabel, p.status);
      else if (mappedStatus !== p.status) {
        warn(tag, `statusLabel="${p.statusLabel}" に複数のstatusキー（"${mappedStatus}" と "${p.status}"）が使われています`);
      }
    }

    if (p.referenceDate && !DATE_RE.test(p.referenceDate)) err(tag, `referenceDateの形式が不正です: ${p.referenceDate}`);
    if (p.lastVerified && !DATE_RE.test(p.lastVerified)) err(tag, `lastVerifiedの形式が不正です: ${p.lastVerified}`);
    if (p.announcedDate && !DATE_RE.test(p.announcedDate)) err(tag, `announcedDateの形式が不正です: ${p.announcedDate}`);
    if (p.siteUpdatedAt && !DATE_RE.test(p.siteUpdatedAt)) err(tag, `siteUpdatedAtの形式が不正です: ${p.siteUpdatedAt}`);

    const seenDocKeys = new Set();
    for (const ev of p.evidenceItems ?? []) {
      if (!documentKeys.has(ev.documentKey)) err(tag, `存在しないdocumentKeyを参照しています: ${ev.documentKey}`);
      if (seenDocKeys.has(ev.documentKey)) warn(tag, `同じ根拠資料（${ev.documentKey}）が重複して参照されています`);
      seenDocKeys.add(ev.documentKey);
    }

    for (const link of p.relatedLinks ?? []) {
      if (!URL_RE.test(link.url ?? "")) err(tag, `relatedLinksのURL形式が不正です: ${link.url}`);
    }

    for (const bId of p.relatedBillVoteIds ?? []) {
      if (!billIds.has(bId)) warn(tag, `存在しない議案IDを参照しています: ${bId}`);
    }
    for (const qId of p.relatedQuestionIds ?? []) {
      if (!questionIds.has(qId)) warn(tag, `存在しない一般質問IDを参照しています: ${qId}`);
    }
    // mayorPressConferences.tsはTypeScriptモジュールのためこのスクリプトからは直接参照できず、日付形式のみ検証する。
    for (const d of p.relatedPressConferenceDates ?? []) {
      if (!DATE_RE.test(d)) err(tag, `relatedPressConferenceDatesの形式が不正です: ${d}`);
    }

    if (p.progressHistory && p.progressHistory.length > 0) {
      for (const h of p.progressHistory) {
        if (!DATE_RE.test(h.date ?? "")) err(tag, `progressHistory[].dateの形式が不正です: ${h.date}`);
        if (!VALID_PROMISE_STATUS_LABELS.has(h.statusLabel))
          err(tag, `progressHistory[]に未定義のstatusLabelがあります: ${h.statusLabel}`);
        // 進捗状況の変更には出典URLと確認日（date）を必須とする。
        if (isBlank(h.sourceUrl)) err(tag, `progressHistory[]（${h.date ?? "日付不明"}）にsourceUrl（出典URL）がありません`);
        else if (!URL_RE.test(h.sourceUrl)) err(tag, `progressHistory[].sourceUrlの形式が不正です: ${h.sourceUrl}`);
      }
      const dates = p.progressHistory.map((h) => h.date);
      const sortedDates = [...dates].sort();
      if (JSON.stringify(dates) !== JSON.stringify(sortedDates)) {
        err(tag, "progressHistoryが日付の昇順に並んでいません");
      }
    }

    // 詳細ページ（/mayor/policy-progress/:id）を安全に描画できるかの最低条件。
    if (isBlank(p.id) || isBlank(p.promiseText) || !VALID_PROMISE_STATUS_LABELS.has(p.statusLabel)) {
      err(tag, "詳細ページの生成に必要な項目（id / promiseText / statusLabel）が不足しています");
    }
  }

  const docUrls = new Set();
  for (const d of mayorPromises.documents ?? []) {
    const docTag = `mayorPromises.json (documents:${d.key ?? "key不明"})`;
    if (d.publishedDate && !DATE_RE.test(d.publishedDate)) err(docTag, `publishedDateの形式が不正です: ${d.publishedDate}`);
    if (isBlank(d.url)) continue;
    if (docUrls.has(d.url)) warn("mayorPromises.json (documents)", `根拠資料のURLが重複しています: ${d.url}`);
    docUrls.add(d.url);
  }
} catch {
  warn("mayorPromises.json", "読み込めませんでした（存在しない場合はスキップ）");
}

for (const b of billVotes) {
  for (const pId of b.relatedMayorPromiseIds ?? []) {
    if (!mayorPromiseIds.has(pId)) warn(`billVotes.json (${b.id})`, `存在しない市長公約IDを参照しています: ${pId}`);
  }
}

for (const q of generalQuestions) {
  const tag = `generalQuestions.json (${q.id ?? "id不明"})`;
  for (const bId of q.relatedBillVoteIds ?? []) {
    if (!billIds.has(bId)) warn(tag, `存在しない議案IDを参照しています: ${bId}`);
  }
  for (const pId of q.relatedMayorPromiseIds ?? []) {
    if (!mayorPromiseIds.has(pId)) warn(tag, `存在しない市長公約IDを参照しています: ${pId}`);
  }
}

// --- compensationComparison.json ---
function isPositiveAmount(v) {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

try {
  const compensation = readJson("src/data/compensationComparison.json");
  const compensationIds = new Set();
  const sourceUrls = new Map();

  for (const c of compensation) {
    const tag = `compensationComparison.json (${c.id ?? c.municipality ?? "id不明"})`;

    if (isBlank(c.id)) err(tag, "idが空です");
    else if (compensationIds.has(c.id)) err(tag, `自治体IDが重複しています: ${c.id}`);
    else compensationIds.add(c.id);

    if (isBlank(c.municipality)) err(tag, "municipalityが空です");
    if (isBlank(c.prefecture)) err(tag, "prefectureが空です");
    if (!c.referenceDate || !DATE_RE.test(c.referenceDate)) err(tag, `referenceDateが未登録または形式が不正です: ${c.referenceDate}`);
    if (c.confirmedAt && !DATE_RE.test(c.confirmedAt)) err(tag, `confirmedAtの形式が不正です: ${c.confirmedAt}`);

    for (const [key, label] of [
      ["mayorMonthly", "市長月額"],
      ["chairMonthly", "議長月額"],
      ["viceChairMonthly", "副議長月額"],
      ["memberMonthly", "議員月額"],
    ]) {
      if (!isPositiveAmount(c[key])) err(tag, `${label}(${key})が不正、または0以下の金額です: ${c[key]}`);
    }

    for (const key of ["mayorBonusMonths", "councilBonusMonths", "bonusAdjustmentRate"]) {
      const v = c[key];
      if (v !== null && (typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
        err(tag, `${key}が不正です（null または0以上の数値である必要があります）: ${v}`);
      }
    }

    if (!URL_RE.test(c.sourceUrl ?? "")) err(tag, `sourceUrlの形式が不正です: ${c.sourceUrl}`);
    if (isBlank(c.sourceTitle)) err(tag, "sourceTitleが空です");
    if (c.sourceUrl) {
      const prevMunicipality = sourceUrls.get(c.sourceUrl);
      if (prevMunicipality && prevMunicipality !== c.municipality) {
        warn(tag, `sourceUrlが別の自治体（${prevMunicipality}）と重複しています: ${c.sourceUrl}`);
      }
      sourceUrls.set(c.sourceUrl, c.municipality);
    }

    if (c.pendingProposal?.sourceUrl && !URL_RE.test(c.pendingProposal.sourceUrl)) {
      err(tag, `pendingProposal.sourceUrlの形式が不正です: ${c.pendingProposal.sourceUrl}`);
    }
  }
} catch {
  warn("compensationComparison.json", "読み込めませんでした（存在しない場合はスキップ）");
}

// --- nationalCompensationRanking.json / similarMunicipalityComparison.json（役職別の順位・範囲データ） ---
function validateRoleRankingFile(relPath) {
  try {
    const data = readJson(relPath);
    const tag = (role) => `${relPath} (${role})`;

    if (!URL_RE.test(data.sourceUrl ?? "")) err(relPath, `sourceUrlの形式が不正です: ${data.sourceUrl}`);
    if (data.referenceDate && !DATE_RE.test(data.referenceDate)) err(relPath, `referenceDateの形式が不正です: ${data.referenceDate}`);
    if (data.lastVerified && !DATE_RE.test(data.lastVerified)) err(relPath, `lastVerifiedの形式が不正です: ${data.lastVerified}`);

    for (const r of data.roles ?? []) {
      const hasRank = r.rank !== null && r.rank !== undefined;
      const hasMonthly = r.monthly !== null && r.monthly !== undefined;
      if (hasRank !== hasMonthly) {
        err(tag(r.role), `順位状態(rank)と順位値(monthly)の整合性が取れていません: rank=${r.rank}, monthly=${r.monthly}`);
      }
      if (r.max !== undefined && r.min !== undefined) {
        if (r.min > r.max) {
          err(tag(r.role), `最低額(min=${r.min})が最高額(max=${r.max})を上回っています`);
        }
        const nobeoka = (readJson("src/data/compensationComparison.json") ?? []).find((c) => c.id === "nobeoka");
        if (nobeoka) {
          const monthlyKey = { mayor: "mayorMonthly", chair: "chairMonthly", viceChair: "viceChairMonthly", member: "memberMonthly" }[
            r.role
          ];
          const nobeokaAmount = nobeoka[monthlyKey];
          if (typeof nobeokaAmount === "number" && (nobeokaAmount < r.min || nobeokaAmount > r.max)) {
            err(
              tag(r.role),
              `延岡市の金額(${nobeokaAmount})が類似団体の最高・最低範囲(${r.min}〜${r.max})の外にあります`,
            );
          }
        }
      }
    }
  } catch {
    warn(relPath, "読み込めませんでした（存在しない場合はスキップ）");
  }
}

validateRoleRankingFile("src/data/nationalCompensationRanking.json");
validateRoleRankingFile("src/data/similarMunicipalityComparison.json");

// --- financeDashboard.json ---
try {
  const finance = readJson("src/data/financeDashboard.json");
  const tag = "financeDashboard.json";

  if (finance.fiscalYear && !/^\d{4}$/.test(finance.fiscalYear)) err(tag, `fiscalYearの形式が不正です: ${finance.fiscalYear}`);
  if (finance.referenceDate && !DATE_RE.test(finance.referenceDate)) err(tag, `referenceDateの形式が不正です: ${finance.referenceDate}`);
  if (finance.lastVerified && !DATE_RE.test(finance.lastVerified)) err(tag, `lastVerifiedの形式が不正です: ${finance.lastVerified}`);

  function checkAmountItems(items, label) {
    const seenLabels = new Set();
    for (const item of items ?? []) {
      const itemTag = `${tag} (${label}:${item.label ?? "項目不明"})`;
      if (isBlank(item.label)) err(itemTag, "labelが空です");
      else if (seenLabels.has(item.label)) err(itemTag, `${label}内で項目名が重複しています: ${item.label}`);
      else seenLabels.add(item.label);
      if (typeof item.amountThousandYen !== "number" || !Number.isFinite(item.amountThousandYen)) {
        err(itemTag, `amountThousandYenが数値ではありません: ${item.amountThousandYen}`);
      } else if (item.amountThousandYen < 0) {
        err(itemTag, `amountThousandYenが負の値です: ${item.amountThousandYen}`);
      }
      if (item.percentage !== undefined && (item.percentage < 0 || item.percentage > 100)) {
        err(itemTag, `percentageが0〜100の範囲外です: ${item.percentage}`);
      }
    }
  }
  checkAmountItems(finance.revenue, "revenue");
  checkAmountItems(finance.expenditureByPurpose, "expenditureByPurpose");
  checkAmountItems(finance.expenditureByNature, "expenditureByNature");

  for (const p of finance.supplementaryBudgetProjects ?? []) {
    if (isBlank(p.title)) err(tag, "supplementaryBudgetProjects[].titleが空です");
    if (typeof p.amountThousandYen !== "number" || p.amountThousandYen < 0) {
      err(tag, `supplementaryBudgetProjects[].amountThousandYenが不正です: ${p.amountThousandYen}`);
    }
  }

  // 年度重複・年度欠落（連続する年度が飛んでいないか）・負の値のチェック
  function checkFiscalYearSeries(entries, label, yearField, amountField) {
    const seenYears = new Set();
    for (const e of entries ?? []) {
      const y = e[yearField];
      const seriesTag = `${tag} (${label}:${y ?? "年度不明"})`;
      if (isBlank(y)) err(seriesTag, "年度ラベルが空です");
      else if (seenYears.has(y)) err(seriesTag, `${label}内で年度が重複しています: ${y}`);
      else seenYears.add(y);
      const amount = e[amountField];
      if (typeof amount !== "number" || !Number.isFinite(amount)) {
        err(seriesTag, `${amountField}が数値ではありません: ${amount}`);
      } else if (amount < 0) {
        err(seriesTag, `${amountField}が負の値です: ${amount}`);
      }
    }
  }
  checkFiscalYearSeries(finance.fundBalance?.fiscalAdjustmentFunds, "fundBalance.fiscalAdjustmentFunds", "fiscalYear", "amountThousands");
  checkFiscalYearSeries(finance.debtBalanceTrend, "debtBalanceTrend", "fiscalYear", "amountThousandYen");

  if (finance.fundBalance?.totalFunds) {
    const t = finance.fundBalance.totalFunds;
    const sum = (t.fiscalAdjustmentFunds ?? 0) + (t.otherSpecificPurposeFunds ?? 0);
    if (typeof t.total === "number" && sum !== t.total) {
      err(tag, `fundBalance.totalFunds: 内訳の合計(${sum})とtotal(${t.total})が一致しません`);
    }
  }

  // 人口推移：年度重複・0以下の人口（0除算防止）・世界的にありえない値の防止
  const seenPopYears = new Set();
  for (const p of finance.populationTrend?.trend ?? []) {
    const popTag = `${tag} (populationTrend:${p.year ?? "年不明"})`;
    if (seenPopYears.has(p.year)) err(popTag, `populationTrend内で年が重複しています: ${p.year}`);
    else seenPopYears.add(p.year);
    if (p.referenceDate && !DATE_RE.test(p.referenceDate)) err(popTag, `referenceDateの形式が不正です: ${p.referenceDate}`);
    if (typeof p.population !== "number" || p.population <= 0) {
      err(popTag, `populationが不正です（0より大きい数値が必要）: ${p.population}`);
    }
  }
  if (finance.populationTrend?.latest) {
    const latest = finance.populationTrend.latest;
    if (typeof latest.population !== "number" || latest.population <= 0) {
      err(tag, `populationTrend.latest.populationが不正です（人口0除算の原因になります）: ${latest.population}`);
    }
    if (latest.referenceDate && !DATE_RE.test(latest.referenceDate)) {
      err(tag, `populationTrend.latest.referenceDateの形式が不正です: ${latest.referenceDate}`);
    }
  }

  // 財政指標：%範囲チェック（0〜100を超えることがある比率は除外し、常識的な範囲のみチェック）
  const fi = finance.financialIndicators;
  if (fi) {
    if (isBlank(fi.fiscalYearLabel)) err(`${tag} (financialIndicators)`, "fiscalYearLabelが空です");
    for (const [key, label] of [
      ["realDebtServiceRatioPercent", "実質公債費比率"],
      ["futureBurdenRatioPercent", "将来負担比率"],
      ["currentBalanceRatioPercent", "経常収支比率"],
    ]) {
      const v = fi[key];
      if (v !== null && (typeof v !== "number" || v < 0)) {
        err(`${tag} (financialIndicators)`, `${label}(${key})が不正です（nullまたは0以上の数値が必要）: ${v}`);
      }
    }
    if (fi.fiscalStrengthIndex !== null && (typeof fi.fiscalStrengthIndex !== "number" || fi.fiscalStrengthIndex < 0)) {
      err(`${tag} (financialIndicators)`, `fiscalStrengthIndexが不正です: ${fi.fiscalStrengthIndex}`);
    }
  }

  // 出典：sectionの重複、URL形式、日付形式
  const seenSections = new Set();
  for (const s of finance.sources ?? []) {
    const sourceTag = `${tag} (sources:${s.section ?? "section不明"})`;
    if (isBlank(s.section)) err(sourceTag, "sectionが空です");
    else if (seenSections.has(s.section)) warn(sourceTag, `同じsectionの出典が複数登録されています: ${s.section}`);
    seenSections.add(s.section);
    if (isBlank(s.title)) err(sourceTag, "titleが空です");
    if (isBlank(s.organization)) err(sourceTag, "organizationが空です");
    // 資料URLはドキュメントルート相対パス（/documents/...）または絶対URLのいずれかを許可する。
    if (isBlank(s.url) || !(s.url.startsWith("/") || URL_RE.test(s.url))) {
      err(sourceTag, `urlの形式が不正です: ${s.url}`);
    }
    if (s.referenceDate && !DATE_RE.test(s.referenceDate)) err(sourceTag, `referenceDateの形式が不正です: ${s.referenceDate}`);
    if (s.confirmedDate && !DATE_RE.test(s.confirmedDate)) err(sourceTag, `confirmedDateの形式が不正です: ${s.confirmedDate}`);
  }
} catch {
  warn("financeDashboard.json", "読み込めませんでした（存在しない場合はスキップ）");
}

// --- searchIndex.json（サイト内横断検索インデックス） ---
const VALID_SEARCH_TYPES = new Set([
  "member",
  "mayor",
  "promise",
  "bill",
  "question",
  "compensation",
  "finance",
  "update",
  "guide",
  "press-conference",
  "page",
]);
// 実在するルートの先頭一致のみを許可する（管理用・非公開データの混入を防ぐ）。
const VALID_URL_PREFIXES = [
  "/",
  "/members/",
  "/mayor",
  "/finance",
  "/dashboard",
  "/compensation",
  "/city-guide",
  "/bills",
  "/questions",
  "/search",
  "/about",
  "/editorial-policy",
  "/terms",
  "/contact",
  "/updates",
];

try {
  const searchIndex = readJson("src/data/searchIndex.json");
  const searchIds = new Set();
  const seenPairs = new Set();

  for (const s of searchIndex) {
    const tag = `searchIndex.json (${s.id ?? s.title ?? "id不明"})`;

    if (isBlank(s.id)) err(tag, "idが空です");
    else if (searchIds.has(s.id)) err(tag, `検索インデックスIDが重複しています: ${s.id}`);
    else searchIds.add(s.id);

    if (isBlank(s.title)) err(tag, "titleが空です");
    if (isBlank(s.url)) err(tag, "urlが空です");
    else if (!VALID_URL_PREFIXES.some((p) => s.url === p || s.url.startsWith(p))) {
      err(tag, `既知のルートに含まれない、または非公開の可能性があるURLです: ${s.url}`);
    }
    if (!VALID_SEARCH_TYPES.has(s.type)) err(tag, `未定義のtypeです: ${s.type}`);
    if (!Array.isArray(s.keywords) || s.keywords.length === 0) {
      warn(tag, "keywordsが空です");
    }
    if (s.date && !DATE_RE.test(s.date)) err(tag, `dateの形式が不正です: ${s.date}`);

    const pairKey = `${s.type}:${s.url}:${s.title}`;
    if (seenPairs.has(pairKey)) warn(tag, `同一内容（type/url/title）のエントリが重複登録されています`);
    seenPairs.add(pairKey);

    if (s.sourceId) {
      if (s.type === "member" && !memberIds.has(s.sourceId)) {
        warn(tag, `存在しない議員IDを参照しています: ${s.sourceId}`);
      }
      if (s.type === "bill" && !billIds.has(s.sourceId)) {
        warn(tag, `存在しない議案IDを参照しています: ${s.sourceId}`);
      }
      if (s.type === "promise" && !mayorPromiseIds.has(s.sourceId)) {
        warn(tag, `存在しない市長公約IDを参照しています: ${s.sourceId}`);
      }
      if (s.type === "question" && !questionIds.has(s.sourceId)) {
        warn(tag, `存在しない一般質問IDを参照しています: ${s.sourceId}`);
      }
    }
  }
} catch {
  warn("searchIndex.json", "読み込めませんでした（存在しない場合はスキップ）");
}

// --- report ---
for (const w of warnings) console.warn(w);
for (const e of errors) console.error(e);

console.log(
  `[validate-data] members=${members.length} generalQuestions=${generalQuestions.length} billVotes=${billVotes.length} — errors=${errors.length} warnings=${warnings.length}`,
);

if (errors.length > 0) {
  console.error("\nデータ検証でエラーが見つかったため、ビルドを中止します。上記のエラー内容を確認してください。");
  process.exit(1);
}

/**
 * 市政タイムライン（/timeline）用の軽いイベント一覧を、既存データから生成する。
 * 出力：src/data/civicEventTimeline.json（TimelinePage の遅延読み込みチャンクだけが import する）
 *
 * 方針
 * - 元データに記録された日付だけを使う。年月・年しか分からないものに日を付けない
 *   （precision: "day" | "month" | "year"、date は "YYYY-MM-DD" / "YYYY-MM" / "YYYY"）。
 * - 並び順は日付のみ。重要度による選別・並べ替えはしない（種類での絞り込みだけを提供する）。
 * - 「予定」と「実施済み」を区別する。開催が確認できていない委員会日程は「予定」とし、
 *   過去の事実を表す種類（選挙・就任・会期・一般質問・議案提出・議決）は生成日より後の日付を出さない。
 * - 一次資料URLは元データに記録されたものだけを付ける。
 * - 同じ日・同じ会期の議案提出・議決・一般質問は1件のイベントにまとめ、中に個別のリンクを持たせる。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

// 生成日（日本時間）。過去の事実を表す種類で、これより後の日付を出さないために使う。
const TODAY = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());

const isHttp = (u) => typeof u === "string" && /^https?:\/\//.test(u);
const firstHttp = (...urls) => urls.find(isHttp) ?? null;

/** precision に合わせて日付を切り詰める（日が確定していないものに日を残さない）。 */
function dateAtPrecision(date, precision) {
  if (!date) return null;
  const m = String(date).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return null;
  const p = precision ?? (m[3] ? "day" : m[2] ? "month" : "year");
  if (p === "day" && m[3]) return { date: `${m[1]}-${m[2]}-${m[3]}`, precision: "day" };
  if ((p === "day" || p === "month") && m[2]) return { date: `${m[1]}-${m[2]}`, precision: "month" };
  return { date: m[1], precision: "year" };
}

const events = [];
const push = (e) => {
  if (!e.date) return;
  events.push(e);
};

// --- 選挙 ---
for (const e of readJson("src/data/electionResults.json")) {
  const d = dateAtPrecision(e.electionDate, e.electionDatePrecision);
  if (!d || d.date > TODAY) continue;
  push({
    id: `election-${e.id}`,
    type: "election",
    ...d,
    status: "done",
    title: e.electionName,
    route: `/elections/${e.id}`,
    sourceUrl: firstHttp(...(e.sourceRefs ?? []).map((r) => r.sourceUrl ?? r.url)),
  });
}

// --- 市長就任 ---
{
  const mayors = new Map(readJson("src/data/archiveMayors.json").map((m) => [m.id, m]));
  for (const t of readJson("src/data/archiveMayorTerms.json")) {
    const m = mayors.get(t.mayorId);
    const d = dateAtPrecision(t.termStart, t.termStartPrecision);
    if (!m || !d || d.date > TODAY) continue;
    push({
      id: `mayor-term-${t.id}`,
      type: "mayor",
      ...d,
      status: "done",
      title: `${m.name}氏が市長に就任${t.termNumber != null ? `（${t.termNumber}期目）` : ""}`,
      route: `/mayors/${m.slug}`,
      sourceUrl: firstHttp(...(t.sourceRefs ?? []).map((r) => r.sourceUrl ?? r.url)),
    });
  }
}

// --- 市長公約の進捗の公表（市の公表資料の日付） ---
{
  const data = readJson("src/data/mayorPromises.json");
  for (const p of data.promises ?? []) {
    for (const [i, h] of (p.progressHistory ?? []).entries()) {
      const d = dateAtPrecision(h.date);
      if (!d || d.date > TODAY) continue;
      push({
        id: `promise-${p.id}-${i}`,
        type: "promise",
        ...d,
        status: "done",
        title: `市長公約「${p.promiseText.length > 30 ? `${p.promiseText.slice(0, 30)}…` : p.promiseText}」の進捗が公表（${h.statusLabel}）`,
        route: `/mayor/policy-progress/${p.id}`,
        sourceUrl: firstHttp(h.sourceUrl),
      });
    }
  }
}

// --- 会期（開会・閉会） ---
const sessions = readJson("src/data/councilSessions.json");
const sessionTitle = new Map(sessions.map((s) => [s.id, s.title]));
for (const s of sessions) {
  const src = firstHttp(s.periodSourceRef?.url, s.officialSessionUrl);
  for (const [kind, date, label] of [
    ["open", s.startDate, "開会"],
    ["close", s.endDate, "閉会"],
  ]) {
    const d = dateAtPrecision(date);
    if (!d || d.date > TODAY) continue;
    push({
      id: `session-${s.id}-${kind}`,
      type: "session",
      ...d,
      status: "done",
      title: `${s.title} ${label}`,
      route: `/council-documents/${s.id}`,
      sourceUrl: src,
    });
  }
}

// --- 一般質問（同じ日・同じ会期をまとめる） ---
{
  const groups = new Map();
  for (const q of readJson("src/data/generalQuestions.json")) {
    const d = dateAtPrecision(q.questionDate);
    if (!d || d.date > TODAY) continue;
    const key = `${q.sessionName}|${d.date}`;
    if (!groups.has(key)) groups.set(key, { d, sessionName: q.sessionName, items: [] });
    groups.get(key).items.push({
      title: `${q.memberName}議員：${q.title}`,
      route: `/questions/${q.id}`,
      sourceUrl: firstHttp(q.transcriptUrl, q.sourceUrl),
      transcriptPublished: isHttp(q.transcriptUrl),
    });
  }
  for (const [key, g] of groups) {
    const allTranscripts = g.items.every((i) => i.transcriptPublished);
    push({
      id: `gq-${key.replace(/[|]/g, "-")}`,
      type: "generalQuestion",
      ...g.d,
      status: "done",
      title: `${g.sessionName} 一般質問（${g.items.length}人）`,
      note: allTranscripts ? undefined : "会議録の公開前のため、一部は通告書にもとづく記録です。",
      route: g.items.length === 1 ? g.items[0].route : "/questions",
      sourceUrl: g.items.length === 1 ? g.items[0].sourceUrl : null,
      items: g.items.map(({ transcriptPublished: _t, ...rest }) => rest),
    });
  }
}

// --- 議案の提出・議決（同じ日・同じ会期をまとめる。予算・決算は種類を分ける） ---
{
  const bills = readJson("src/data/billVotes.json").filter((b) => b.publicationStatus === "published");
  const groupBy = (list, keyFn) => {
    const m = new Map();
    for (const x of list) {
      const k = keyFn(x);
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };
  const kindOf = (b) => (b.category === "予算" ? "budget" : b.category === "決算" ? "settlement" : "billDecided");
  const itemOf = (b) => ({
    title: `${b.billNumber} ${b.billTitle}${b.result ? `（${b.result}）` : ""}`,
    route: `/bills/votes/${b.id}`,
    sourceUrl: firstHttp(b.resultDocumentUrl),
  });
  const byNumber = (a, b) => a.billNumber.localeCompare(b.billNumber, "ja", { numeric: true });

  const submitted = groupBy(bills, (b) => (b.submittedDate && b.submittedDate <= TODAY ? `${b.sessionId}|${b.submittedDate}` : null));
  for (const [key, list] of submitted) {
    const [sessionId, date] = key.split("|");
    list.sort(byNumber);
    push({
      id: `bill-submitted-${sessionId}-${date}`,
      type: "billSubmitted",
      date,
      precision: "day",
      status: "done",
      title: `${sessionTitle.get(sessionId) ?? list[0].session} 議案${list.length}件の提出`,
      route: `/council-documents/${sessionId}`,
      sourceUrl: null,
      items: list.map(itemOf),
    });
  }
  const decided = groupBy(bills, (b) =>
    b.votingDate && b.votingDate <= TODAY ? `${b.sessionId}|${b.votingDate}|${kindOf(b)}` : null,
  );
  const KIND_TITLE = { budget: "予算・補正予算の議決", settlement: "決算の認定", billDecided: "議案の議決" };
  for (const [key, list] of decided) {
    const [sessionId, date, kind] = key.split("|");
    list.sort(byNumber);
    push({
      id: `bill-decided-${sessionId}-${date}-${kind}`,
      type: kind,
      date,
      precision: "day",
      status: "done",
      title: `${sessionTitle.get(sessionId) ?? list[0].session} ${KIND_TITLE[kind]}（${list.length}件）`,
      route: `/council-documents/${sessionId}`,
      sourceUrl: firstHttp(list[0].resultDocumentUrl),
      items: list.map(itemOf),
    });
  }
}

// --- 予算案の提出（予算の補正状況） ---
for (const r of readJson("src/data/budgetRevisions.json")) {
  const dates = [...new Set((r.accounts ?? []).map((a) => a.submittedDate).filter(Boolean))].sort();
  const date = dates[0];
  const d = dateAtPrecision(date);
  if (!d || d.date > TODAY) continue;
  push({
    id: `budget-revision-${r.id}`,
    type: "budget",
    ...d,
    status: "done",
    title: `${r.fiscalYear}年度 ${r.label}の議案提出`,
    route: `/finance#budget-revision-${r.id}`,
    sourceUrl: firstHttp(...(r.sources ?? []).map((s) => s.url), r.listingPageUrl),
  });
}

// --- 委員会（公表された日程。開催が確認できたものだけ「実施済み」） ---
{
  const data = readJson("src/data/committeeMeetingSchedule.json");
  for (const it of data.items ?? []) {
    const d = dateAtPrecision(it.date);
    if (!d) continue;
    const held = it.heldConfirmed === true && d.date <= TODAY;
    push({
      id: `committee-${it.id}`,
      type: "committee",
      ...d,
      status: held ? "done" : "scheduled",
      title: `${it.committeeNameAsWritten}${it.subdivision ? `（${it.subdivision}）` : ""}${(it.topicsAsWritten ?? []).length ? `：${it.topicsAsWritten.join("、")}` : ""}`,
      note: held ? undefined : "議会の日程表に記載された予定です（開催の確認は取れていません）。",
      route: it.committeeId ? `/committees/${it.committeeId}` : "/committees",
      sourceUrl: firstHttp(it.sourceUrl, it.sourcePageUrl),
    });
  }
}

// --- 行政資料の公開（意見募集・広報のべおか） ---
{
  const pc = readJson("src/data/publicComments.json");
  for (const c of pc.entries ?? []) {
    const d = dateAtPrecision(c.startDate);
    if (!d || d.date > TODAY) continue;
    push({
      id: `public-comment-${c.id}`,
      type: "adminDocument",
      ...d,
      status: "done",
      title: `意見募集（パブリックコメント）開始：${c.title}${c.endDate ? `（締切 ${c.endDate}）` : ""}`,
      route: "/public-comments",
      sourceUrl: firstHttp(c.officialUrl),
    });
  }
  for (const k of readJson("src/data/kohoNobeokaIssues.json")) {
    const d = dateAtPrecision(k.issueYearMonth);
    if (!d || d.date > TODAY.slice(0, 7)) continue;
    push({
      id: `koho-${k.id}`,
      type: "adminDocument",
      ...d,
      status: "done",
      title: `${k.title} 発行`,
      route: "/koho-search",
      sourceUrl: firstHttp(k.pdfUrl),
    });
  }
}

// 日付の新しい順（同じ日付は種類・IDの順）。並べ替えに重要度は使わない。
events.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));

const ids = new Set();
for (const e of events) {
  if (ids.has(e.id)) throw new Error(`[generate-civic-event-timeline] ID重複: ${e.id}`);
  ids.add(e.id);
}

writeFileSync(join(root, "src/data/civicEventTimeline.json"), `${JSON.stringify({ events })}\n`, "utf8");
const byType = events.reduce((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {});
console.log(`[generate-civic-event-timeline] ${events.length}件 ${JSON.stringify(byType)}`);

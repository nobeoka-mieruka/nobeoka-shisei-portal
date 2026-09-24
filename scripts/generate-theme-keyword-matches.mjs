/**
 * テーマページ（/themes/:slug）の「同じキーワードを含む資料」用の一覧を、ビルド時に生成する。
 * 出力：src/data/themeKeywordMatches.json（ThemeDetailPage の遅延読み込みチャンクだけが import する）
 *
 * ここで作るのは「テーマのキーワード（src/data/themes.json）を含む資料」の一覧であり、
 * そのテーマとの政策上の関連を確認したものではない。画面でも必ず「同じキーワードを含む資料」として、
 * 確認できる関連資料とは分けて表示する。AIによる判定は行わない。
 *
 * 議案は、議案名にテーマ語が入りやすいが内容が別の分野にまたがる「人事」「予算」「決算」を除く
 * （例：「教育委員会委員の任命」が子育て・教育テーマに入る、補正予算がすべての分野に入る）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const themes = readJson("src/data/themes.json").filter((t) => (t.keywords ?? []).length > 0);
const generalQuestions = readJson("src/data/generalQuestions.json");
const bills = readJson("src/data/billVotes.json").filter(
  (b) => b.publicationStatus === "published" && !["人事", "予算", "決算"].includes(b.category),
);
const promises = readJson("src/data/mayorPromises.json").promises ?? [];
const committeeReports = readJson("src/data/committeeActivityReports.json");
const budgetProjects = readJson("src/data/budgetRevisions.json").flatMap((r) =>
  (r.projects ?? []).map((p) => ({ ...p, revisionId: r.id, revisionLabel: `${r.fiscalYear}年度 ${r.label}` })),
);

/** texts のどれかに含まれる最初のキーワードを返す（無ければ null）。 */
function firstMatch(keywords, ...texts) {
  const joined = texts.filter(Boolean).join(" ");
  return keywords.find((k) => joined.includes(k)) ?? null;
}

const out = {};
for (const t of themes) {
  const kw = t.keywords;
  const gq = [];
  for (const q of generalQuestions) {
    const m = firstMatch(kw, q.title, (q.topics ?? []).join(" "), q.summary);
    if (m) gq.push({ id: q.id, title: `${q.memberName}議員：${q.title}`, date: q.questionDate, matched: m });
  }
  const bl = [];
  for (const b of bills) {
    const m = firstMatch(kw, b.billTitle);
    if (m) bl.push({ id: b.id, title: b.billTitle, billNumber: b.billNumber, result: b.result ?? null, date: b.votingDate ?? null, matched: m });
  }
  bl.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.id.localeCompare(b.id));
  const pr = [];
  for (const p of promises) {
    const m = firstMatch(kw, p.promiseText);
    if (m) pr.push({ id: p.id, title: p.promiseText, matched: m });
  }
  const cr = [];
  for (const r of committeeReports) {
    const m = firstMatch(kw, r.title);
    if (m) cr.push({ id: r.id, title: `${r.committeeName}（${r.fiscalYear}年度）：${r.title}`, committeeId: r.committeeId, sourceUrl: r.url ?? r.sourceUrl ?? null, matched: m });
  }
  const bp = [];
  for (const p of budgetProjects) {
    const m = firstMatch(kw, p.name, p.purpose);
    if (m) bp.push({ id: p.id, revisionId: p.revisionId, title: `${p.name}（${p.revisionLabel}）`, matched: m });
  }
  out[t.slug] = { generalQuestions: gq, bills: bl, promises: pr, committeeReports: cr, budgetProjects: bp };
}

writeFileSync(join(root, "src/data/themeKeywordMatches.json"), `${JSON.stringify(out)}\n`, "utf8");
const summary = Object.entries(out).map(([slug, v]) => `${slug}:${Object.values(v).reduce((n, l) => n + l.length, 0)}`);
console.log(`[generate-theme-keyword-matches] ${summary.join(" ")}`);

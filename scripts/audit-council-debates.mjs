/**
 * 本会議の討論（src/data/councilDebateSpeeches.json）を、会議録の原文と1件ずつ突き合わせる。
 *
 * 【確かめること】
 * 1. 出典URL（発言単位）が開けて、目的の発言であること（HTTP 200 だけでは足りない。
 *    会議録検索システムは未公開・存在しない発言にも HTTP 200 でエラー文を返すため）。
 *    - ページ見出しの会議名・開催日を読み取り、記録と食い違わないこと
 *    - ページ上の発言者が、記録の発言者と一致すること
 *    - 記録の抜粋が、そのページの本文に含まれていること
 * 2. 議事進行役（議長・副議長など）の発言を、議員の討論として取っていないこと。
 *    「採決に移ります」「討論を終結します」「賛成多数」「起立多数」のような
 *    進行上の言い回しで始まる記録が無いこと。
 * 3. 賛否の根拠（stanceBasis）が、会議録の本文にそのまま存在すること。
 *    for／against／mixed は根拠が必須。unclear は推測で埋めず、そのまま正常な状態として扱う。
 * 4. 会議日1日分の本文から抽出をやり直し、同じ発言者・同じ立場が得られること（再現性）。
 *
 * ネットワークを使うため npm test には入れない。結果は reports/council-debate-audit.json へ書く。
 * --apply を付けると、発言者が一致し再抽出できた記録について、会議録のページ見出しから
 * 読み取った会議名（meetingTitle）・開催日（meetingDate）と、再抽出した立場・立場の対象
 * （stanceTarget）・根拠を書き込み、照合日（verifiedAt）を付ける。発言者が一致しない記録は書き換えない。
 * 書き込んだあとにもう一度（--apply なしで）流し、指摘が0件になることを確かめる。
 *
 * 使い方: node scripts/audit-council-debates.mjs [--apply]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractDebates, fetchDayText, STANCE_TARGET_NOTE } from "./extract-council-debates.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DATA_PATH = join(ROOT, "src/data/councilDebateSpeeches.json");
const REPORT_PATH = join(ROOT, "reports/council-debate-audit.json");
const apply = process.argv.includes("--apply");

const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
const speeches = data.speeches;

/** 議事進行上の言い回し。これで始まる記録は、議員本人の討論ではない疑いがある。 */
const PROCEDURAL_OPENINGS = [
  /^これより/,
  /^採決/,
  /^お諮りいたします/,
  /^討論を終/,
  /^以上で討論を終/,
  /^(?:起立|賛成)多数/,
  /^ただいまの/,
  /^暫時休憩/,
  /^休憩前に引き続き/,
];
/** 本文のどこかに出てきたら、議長の発言が混ざった疑いがある言い回し。 */
const PROCEDURAL_ANYWHERE = [/採決に移ります/, /討論を終結します/, /起立多数/, /賛成多数であります/, /よって、.{0,40}可決/];

const NON_MEMBER_LABEL = /^(議長|副議長|仮議長|臨時議長|市長|副市長|教育長)/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const squash = (s) => String(s ?? "").replace(/[\s　]/g, "");

/** 「令和 5年第30回臨時会（第1号 3月28日）」→ 会議名と日付。 */
function parseHeader(plain) {
  const m = plain.match(/(令和\s*(\d+)年\s*第\s*(\d+)回\s*(定例会|臨時会)\s*（第\s*(\d+)号\s*(\d+)月\s*(\d+)日）)/);
  if (!m) return null;
  const year = 2018 + Number(m[2]);
  const date = `${year}-${String(m[6]).padStart(2, "0")}-${String(m[7]).padStart(2, "0")}`;
  return { meetingTitle: m[1].replace(/\s+/g, " ").trim(), meetingDate: date };
}

/** 会議録のファイル名（R050328A）が表す日付。見出しと食い違わないかの照合に使う。 */
function dateFromFileName(fileName) {
  const m = /^R(\d{2})(\d{2})(\d{2})/.exec(fileName ?? "");
  if (!m) return null;
  return `${2018 + Number(m[1])}-${m[2]}-${m[3]}`;
}

async function fetchSpeechPage(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; NobeokaShiseiPortalBot/1.0; +https://nobeoka-shisei-portal.pages.dev/about)" },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const html = new TextDecoder("shift_jis").decode(buf);
  const plain = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ");
  return { status: res.status, plain };
}

const results = [];
const issues = [];
function issue(record, code, detail) {
  issues.push({ id: record.id, speakerName: record.speakerName, code, detail });
}

console.log(`[audit-council-debates] ${speeches.length}件の討論を会議録と照合します`);

for (const r of speeches) {
  const row = { id: r.id, speakerName: r.speakerName, stance: r.stance, checks: {} };
  // --- 議事進行役を議員の討論として取っていないか ---
  if (NON_MEMBER_LABEL.test(r.speakerLabelAsWritten ?? "")) issue(r, "SPEAKER_IS_CHAIR", r.speakerLabelAsWritten);
  const opening = PROCEDURAL_OPENINGS.find((re) => re.test(r.excerpt ?? ""));
  if (opening) issue(r, "PROCEDURAL_OPENING", String(opening));
  // --- 賛否の根拠 ---
  if (r.stance !== "unclear" && !r.stanceBasis) issue(r, "STANCE_WITHOUT_BASIS", r.stance);
  if (!["for", "against", "mixed", "unclear"].includes(r.stance)) issue(r, "UNKNOWN_STANCE", r.stance);

  if (!r.sourceUrl) {
    issue(r, "NO_SOURCE_URL", "");
    results.push(row);
    continue;
  }
  let page;
  try {
    page = await fetchSpeechPage(r.sourceUrl);
  } catch (e) {
    issue(r, "FETCH_FAILED", String(e));
    results.push(row);
    continue;
  }
  row.httpStatus = page.status;
  if (page.status !== 200) issue(r, "HTTP_NOT_200", String(page.status));
  if (/ERROR:|議会名が登録されていません/.test(page.plain)) issue(r, "SOURCE_ERROR_PAGE", "");

  const header = parseHeader(page.plain);
  row.meetingTitle = header?.meetingTitle ?? null;
  row.meetingDate = header?.meetingDate ?? null;
  if (!header) issue(r, "HEADER_NOT_FOUND", "");
  else if (header.meetingDate !== dateFromFileName(r.meetingFileName))
    issue(r, "DATE_MISMATCH", `${header.meetingDate} ≠ ${dateFromFileName(r.meetingFileName)}`);

  const flat = squash(page.plain);
  row.checks.speakerOnPage = flat.includes(squash(r.speakerName));
  if (!row.checks.speakerOnPage) issue(r, "SPEAKER_NOT_ON_PAGE", r.speakerName);
  // 抜粋は出典URLの発言（最初の1発言）から取っている。
  row.checks.excerptOnPage = flat.includes(squash(String(r.excerpt ?? "").split("\n")[0]).slice(0, 40));
  if (!row.checks.excerptOnPage) issue(r, "EXCERPT_NOT_ON_PAGE", (r.excerpt ?? "").slice(0, 40));
  // 議長の発言が混ざっていないか（発言単位のページは、その発言者の発言だけを返す）。
  const mixedIn = PROCEDURAL_ANYWHERE.find((re) => re.test(page.plain));
  if (mixedIn) row.checks.proceduralPhraseOnPage = String(mixedIn);
  // 根拠が発言単位のページに無い場合は、議長の制止を挟んだ続きにある（日単位の照合で確かめる）。
  row.checks.basisOnPage = r.stanceBasis ? flat.includes(squash(r.stanceBasis)) : null;
  results.push(row);
  await sleep(600);
}

// --- 会議日ごとに抽出をやり直し、同じ結果になるか ---
const byDay = new Map();
for (const r of speeches) {
  if (!byDay.has(r.meetingFileName)) byDay.set(r.meetingFileName, []);
  byDay.get(r.meetingFileName).push(r);
}
const dayChecks = [];
for (const [fileName, recs] of byDay) {
  const day = await fetchDayText(fileName);
  if (!day) {
    dayChecks.push({ fileName, ok: false, reason: "本文を取得できません" });
    for (const r of recs) issue(r, "DAY_TEXT_UNAVAILABLE", fileName);
    continue;
  }
  const fresh = extractDebates(fileName, day.text, day.segments);
  const dayFlat = squash(day.text);
  for (const r of recs) {
    const row = results.find((x) => x.id === r.id);
    const match = fresh.find((f) => f.sourceUrl === r.sourceUrl);
    if (!match) {
      issue(r, "NOT_REPRODUCED", "日単位の再抽出で同じ発言が得られません");
      continue;
    }
    if (row) row.fresh = match;
    if (match.speakerName !== r.speakerName) issue(r, "SPEAKER_DIFFERS_ON_REEXTRACT", match.speakerName);
    // --apply で書き込む前の差分は「更新」として記録し、書き込んだ後にもう一度流して0件になることを確かめる。
    if (match.stance !== r.stance) issue(r, "STANCE_DIFFERS_ON_REEXTRACT", `${match.stance} ≠ ${r.stance}`);
    if ((match.agendaTitle ?? null) !== (r.agendaTitle ?? null))
      issue(r, "AGENDA_DIFFERS_ON_REEXTRACT", `${match.agendaTitle} ≠ ${r.agendaTitle}`);
    // 議題の取り違え：発言者が冒頭で名指しした種類（決議・意見書）と、記録の議題の種類が食い違わないこと。
    const opening = squash(match.excerpt).slice(0, 120);
    const agendaKind = /^(決議|意見書)/.test(match.agendaTitle ?? "") ? "resolution" : "bill";
    if (/(決議|意見書)[（(]案[）)]に/.test(opening) && agendaKind === "bill")
      issue(r, "AGENDA_KIND_MISMATCH", `発言は決議・意見書への討論だが、議題が「${match.agendaTitle}」`);
    if ((match.stanceTarget ?? null) !== (r.stanceTarget ?? null))
      issue(r, "TARGET_DIFFERS_ON_REEXTRACT", `${match.stanceTarget} ≠ ${r.stanceTarget ?? "未設定"}`);
    // 根拠の引用は、1つの発言の中に丸ごと存在しなければならない（発言をまたいだ文は会議録に無い）。
    const basis = match.stanceBasis;
    if (basis && !day.text.split(/\n○/).some((u) => squash(u).includes(squash(basis))))
      issue(r, "BASIS_NOT_IN_ONE_UTTERANCE", basis);
    if (r.stanceBasis && !dayFlat.includes(squash(r.stanceBasis))) issue(r, "BASIS_NOT_IN_MINUTES", r.stanceBasis);
    if (row) row.checks.basisInMinutes = r.stanceBasis ? dayFlat.includes(squash(r.stanceBasis)) : null;
  }
  // 記録に無い討論が再抽出で出てくる場合も報告する（取りこぼし）。
  for (const f of fresh) {
    if (!recs.some((r) => r.sourceUrl === f.sourceUrl)) {
      issues.push({ id: null, speakerName: f.speakerName, code: "EXTRA_ON_REEXTRACT", detail: `${fileName} ${f.sourceUrl}` });
    }
  }
  dayChecks.push({ fileName, ok: true, extracted: fresh.length, recorded: recs.length });
  await sleep(600);
}

const stanceCounts = speeches.reduce((acc, r) => ((acc[r.stance] = (acc[r.stance] ?? 0) + 1), acc), {});
const report = {
  auditedAt: new Date().toISOString().slice(0, 10),
  total: speeches.length,
  currentMembers: speeches.filter((r) => r.memberId).length,
  formerMembers: speeches.filter((r) => !r.memberId && r.formerMemberId).length,
  unmatched: speeches.filter((r) => !r.memberId && !r.formerMemberId).length,
  withSourceUrl: speeches.filter((r) => r.sourceUrl).length,
  stanceCounts,
  sourceVerified: results.filter((r) => r.httpStatus === 200 && r.checks.speakerOnPage && r.checks.excerptOnPage).length,
  issues,
  days: dayChecks,
  records: results,
};
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, records: undefined, days: undefined }, null, 2));

if (apply) {
  // 発言者が一致し、会議録の見出しを読めた記録だけを書き換える。
  // 取れなかった項目は既存の値を残す（空で上書きしない）。
  const blocking = new Set(["SPEAKER_NOT_ON_PAGE", "SPEAKER_DIFFERS_ON_REEXTRACT", "NOT_REPRODUCED", "DATE_MISMATCH"]);
  let updated = 0;
  data.speeches = speeches.map((r) => {
    const row = results.find((x) => x.id === r.id);
    if (!row?.fresh || issues.some((i) => i.id === r.id && blocking.has(i.code))) return r;
    const f = row.fresh;
    updated += 1;
    // キーの並びをそろえて、差分を読みやすくする。
    return {
      id: r.id,
      meetingFileName: r.meetingFileName,
      meetingTitle: row.meetingTitle ?? r.meetingTitle ?? null,
      meetingDate: row.meetingDate ?? r.meetingDate ?? null,
      sessionId: r.sessionId,
      sessionLabel: r.sessionLabel,
      agendaTitle: f.agendaTitle ?? r.agendaTitle,
      memberId: r.memberId,
      formerMemberId: r.formerMemberId,
      speakerName: r.speakerName,
      speakerLabelAsWritten: r.speakerLabelAsWritten,
      stance: f.stance,
      stanceBasis: f.stanceBasis || null,
      stanceSourceUrl: f.stanceSourceUrl ?? null,
      amendmentOnFloor: f.amendmentOnFloor,
      stanceTarget: f.stanceTarget,
      stanceTargetBasis: f.stanceTargetBasis ?? null,
      excerpt: f.excerpt,
      sourceUrl: r.sourceUrl,
      verifiedAt: report.auditedAt,
    };
  });
  data.stanceTargetNote = STANCE_TARGET_NOTE;
  data.generatedAt = report.auditedAt;
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(`${updated}件を会議録の再抽出結果で更新しました`);
}
// 差分（*_DIFFERS_ON_REEXTRACT）は --apply で解消するものなので、書き込んだ回では失敗扱いにしない。
const fatal = issues.filter((i) => i.code !== "EXTRA_ON_REEXTRACT" && !(apply && /DIFFERS_ON_REEXTRACT|BASIS_NOT_IN_MINUTES|EXCERPT_NOT_ON_PAGE/.test(i.code)));
process.exitCode = fatal.length > 0 ? 1 : 0;

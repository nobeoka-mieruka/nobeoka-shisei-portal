/**
 * Phase256の作業用スクリプト（一時的）：令和8年6月定例会の一般質問について、
 * 人が公式会議録本文を読んで作成した「照合仕様」（data/minutes/june-specs/*.json）から、
 * councilSpeechSummaries.json へ追加する CouncilSpeech レコードを組み立てる。
 *
 * このスクリプトは要約を生成しない。定型部分（id・出典URL・確認メモ）を組み立てるだけで、
 * questionSummary・answerSummary・exchanges[].summary はすべて仕様ファイルの記述をそのまま使う。
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const CODE = "48o046ot0cia1xvtw7";
const SPEC_DIR = "data/minutes/june-specs";
const OUT = "data/minutes/june-records/speeches.json";
const SESSION_ID = "2026-06";
const SESSION_LABEL = "令和8年第26回定例会";
const DEFAULT_VERIFIED_AT = "2026-09-12";
const GENERATED_AT = "2026-09-15";

const urlFor = (fileName, pos) => `https://www.kensakusystem.jp/nobeoka/cgi-bin3/GetText3.exe?${CODE}/${fileName}/${pos}/10/1//0/0`;

const speeches = [];
for (const f of readdirSync(SPEC_DIR).filter((f) => f.endsWith(".json")).sort()) {
  const spec = JSON.parse(readFileSync(`${SPEC_DIR}/${f}`, "utf8"));
  const { memberId, memberName, fileName, date, meetingNumber, topics, shortSummary, items, sources } = spec;

  const questionItems = items.map((it, i) => ({
    id: `q${i + 1}`,
    title: it.title,
    questionSummary: it.questionSummary,
    answerSummary: it.answerSummary,
    ...(it.answerers?.length ? { answerers: it.answerers } : {}),
    questionAnswerLinkStatus: it.linkStatus,
    exchanges: it.exchanges.map((e, j) => ({
      order: j + 1,
      type: e.type,
      ...(e.type === "question" || e.type === "follow-up-question" ? { speakerId: memberId } : { speakerName: e.speakerName }),
      summary: e.summary,
    })),
    relatedBills: it.relatedBills ?? [],
    relatedDocuments: it.relatedDocuments ?? [],
    ...(it.approach ? { questionApproach: it.approach } : {}),
    ...(it.answerStatus ? { answerStatus: it.answerStatus } : {}),
  }));

  speeches.push({
    id: `${memberId}-${date}-ippan-shitsumon`,
    memberId,
    sessionId: SESSION_ID,
    date,
    meetingNumber,
    meetingType: "本会議",
    speechType: "一般質問",
    isPublished: true,
    summaryStatus: spec.summaryStatus ?? "verified",
    topics,
    shortSummary,
    questionItems,
    summarySources: sources.map((s) => ({
      title: `${SESSION_LABEL}（${meetingNumber} ${date.slice(5, 7).replace(/^0/, "")}月${date.slice(8, 10).replace(/^0/, "")}日） ${s.label}`,
      sourceType: "official-minutes-html",
      sourceUrl: urlFor(fileName, s.pos),
      speakerSection: `pos=${s.pos}`,
    })),
    verifiedAt: spec.verifiedAt ?? DEFAULT_VERIFIED_AT,
    verificationNote:
      "公式会議録検索システムの本文（出典URLに記載のGetText3.exeページ）を読み、質問項目・質問内容・答弁者・答弁内容・再質問と再答弁の順序を照合した。質問本文・答弁本文の原文は転載せず、出典URLで参照できるようにしている（要約は原文に記載された事実のみから作成し、補完・推測は行っていない）。",
    generatedAt: GENERATED_AT,
  });

  console.log(`${memberId} ${memberName}: 質問項目${questionItems.length}件 / exchanges${questionItems.reduce((n, q) => n + q.exchanges.length, 0)}件 / 出典${spec.sources.length}件`);
}

if (!existsSync("data/minutes/june-records")) mkdirSync("data/minutes/june-records", { recursive: true });
writeFileSync(OUT, JSON.stringify(speeches, null, 2) + "\n");
console.log(`\n合計 ${speeches.length}名 / 質問項目${speeches.reduce((n, s) => n + s.questionItems.length, 0)}件 → ${OUT}`);

/**
 * 本会議の「討論」の発言者を、延岡市議会 会議録検索システムから抽出する。
 *
 * 【なぜ必要か】
 * 議案への賛否は起立採決のため、会議録に議員一人ひとりの賛否が残らない。
 * ただし討論（賛成討論・反対討論）は発言者の氏名が記録される。
 * 「誰が討論に立ったか」は一次資料から個人に帰属できる数少ない記録である。
 *
 * 【やらないこと】
 * - 賛成か反対かを点数にしない。討論の中身も評価しない。
 * - 討論しなかった議員の賛否を推測しない（起立採決では分からない）。
 * - 立場（賛成／反対）を機械判定で断定しない。読み取れない場合は unclear のまま残す。
 *
 * 【討論の切り出し方】
 * 議長が「これより（一括）討論に入ります」と宣告してから
 * 「討論を終わります」までが討論の段階。ただし途中に
 * 「通告による討論は終わりました」という別の定型句があり、
 * これを終了と取ると通告外の討論者を丸ごと取りこぼす。必ず先に除外する。
 *
 * 使い方: node scripts/extract-council-debates.mjs [--limit N] [--out <path>]
 */
import { writeFileSync } from "node:fs";
import { listMeetingDays, listSessionsForYear, listSpeakerSegments } from "./lib/minutes-source.mjs";

const CODE = "48o046ot0cia1xvtw7";
const BASE = "https://www.kensakusystem.jp/nobeoka";

/** 発言者ラベルが議員本人ではないもの（議事進行役・執行部）。 */
const NON_MEMBER = [
  /^議長/,
  /^副議長/,
  /^仮議長/,
  /^臨時議長/,
  /^市長/,
  /^副市長/,
  /^教育長/,
  /^会計管理者/,
  /^監査委員/,
  /部長（/,
  /局長（/,
  /課長（/,
  /^参事/,
  /支所長（/,
  /委員会委員長（/,
  /^選挙管理委員会/,
  /^農業委員会/,
];

function isMemberSpeaker(label) {
  return !NON_MEMBER.some((re) => re.test(label));
}

/** 議事進行役かどうか。討論の開始・終了を宣告できるのはこの人だけ。 */
function isChairSpeaker(label) {
  return /^(議長|副議長|仮議長|臨時議長)/.test(label);
}

/** 「二二番（平田信広君）」→「平田信広」 */
function normalizeSpeakerName(label) {
  const m = label.match(/（([^）]+)）/);
  const inner = m ? m[1] : label;
  return inner.replace(/君$/, "").replace(/\s+/g, "");
}

/**
 * 会議日1日分の全発言をプレーンテキストで取得する。
 *
 * GetPerson.exe は発言位置（downloadPos）を並べて渡すと、その全文を一度に返す。
 * 位置を渡さないとヘッダーだけが返るため、先に発言一覧を引いて位置を集める。
 * 発言数ぶんGetText3.exeを叩くより、1日あたり2リクエストで済む。
 */
async function fetchDayText(fileName) {
  const { segments } = await listSpeakerSegments({ code: CODE, fileName });
  if (!segments.length) return null;
  const body = new URLSearchParams();
  body.set("Code", CODE);
  body.set("fileName", fileName);
  for (const seg of segments) body.append("downloadPos", String(seg.pos));
  const res = await fetch(`${BASE}/cgi-bin3/GetPerson.exe`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = new TextDecoder("shift_jis").decode(buf);
  // 未公開・存在しない会議日はHTTP 200のままエラー文字列を返す。
  if (/ERROR:|議会名が登録されていません/.test(text)) return null;
  return { text, segments };
}

/**
 * 発言ごとに分解する。
 *
 * 1発言は「○議長（早瀨賢一君）　　本文」で始まり、次の「○」が現れるまでの
 * 行がすべて同じ発言の続きになる。1行目だけを見ると、議長が討論の開始を告げる
 * 定型句（続きの行にあることが多い）を取りこぼす。
 */
function splitUtterances(text) {
  const out = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.startsWith("○")) {
      if (current) out.push(current);
      const body = raw.slice(1);
      const at = body.search(/[　\s]{2}/);
      if (at < 0) {
        current = { speaker: body.trim(), text: "" };
      } else {
        current = { speaker: body.slice(0, at).trim(), text: body.slice(at).trim() };
      }
      continue;
    }
    if (current) current.text += raw.trim();
  }
  if (current) out.push(current);
  // 直前の発言の末尾（登壇の記録が入る場所）を、各発言へ持たせる。
  out.forEach((u, i) => {
    u.previousTail = i > 0 ? out[i - 1].text.slice(-80) : "";
  });
  return out;
}

const PODIUM = /登壇〕s*$/;
const DEBATE_START = /これより[、]?(?:一括)?討論に入ります/;
const DEBATE_END = /討論を終わり(?:ます|ました)/;
// 「通告による討論は終わりました」は終了ではない。先に取り除く。
const NOTICED_DEBATE_END = /通告(?:による)?討論(?:は|を)終わり(?:ます|ました)/g;
const AGENDA = /日程第[一二三四五六七八九十百]+[　\s]*(.+?)を(?:一括)?議題といたします/;
const AGENDA_NO_NUMBER = /^((?:決議|意見書)第[^\s　]+号.*?)を(?:一括)?議題といたします/;

/**
 * 立場は、本文から読み取れたときだけ入れる。読み取れなければ unclear のままにする。
 *
 * 修正案が出ている議案では「原案反対、修正案賛成」のように、1つの討論の中で
 * 対象ごとに立場が分かれる。これは曖昧なのではなく、対象が2つあるという事実なので、
 * mixed として、どちらが何かを本文の言葉のまま残す。
 */
const SPLIT_STANCE = [
  /原案(?:に)?反対[、,]?s*修正案(?:に)?賛成/,
  /原案(?:に)?賛成[、,]?s*修正案(?:に)?反対/,
  /修正案(?:に)?賛成[、,]?s*原案(?:に)?反対/,
  /修正案(?:に)?反対[、,]?s*原案(?:に)?賛成/,
];

function judgeStance(text) {
  for (const re of SPLIT_STANCE) {
    const m = text.match(re);
    if (m) return { stance: "mixed", basis: m[0] };
  }
  // 討論は冒頭で立場を名乗る慣例がある（「決議案に賛成の討論を行います」）。
  // 本文が長いと途中で相手方の主張にも触れるため、全文を見ると両方に当たってしまう。
  // 名乗りの部分を先に見る。
  const opening = text.slice(0, 200).match(/(賛成|反対)(?:の立場|の)?(?:から)?(?:の)?討論[^。]{0,12}(?:行います|いたします|します|させていただきます)/);
  if (opening) {
    return { stance: opening[1] === "賛成" ? "for" : "against", basis: opening[0] };
  }

  // 討論の結びも立場を明言することが多い（「以上で、市長案に賛成の立場からの討論を終わります」）。
  const closing = text.match(/以上[^。]{0,40}(賛成|反対)[^。]{0,30}討論[^。]{0,12}(?:終わり|といたします|とします)/);
  if (closing) {
    return { stance: closing[1] === "賛成" ? "for" : "against", basis: closing[0] };
  }
  const against = /(反対)(?:の立場|する立場|討論|をいたします|をします)/.test(text);
  const forIt = /(賛成)(?:の立場|する立場|討論|をいたします|をします)/.test(text);
  if (against && forIt) {
    return { stance: "unclear", basis: "賛成と反対の双方に言及しており、本文からは立場を決められない" };
  }
  // 根拠の抜き出しは、判定に使った言い回しと同じものを対象にする。
  // そろえないと、判定はできたのに根拠が空、という状態が生まれる。
  const STANCE_PHRASE = String.raw`(?:の立場|する立場|討論|をいたします|をします)`;
  const quote = (word) =>
    (text.match(new RegExp(String.raw`.{0,30}` + word + STANCE_PHRASE + String.raw`.{0,30}`)) ?? [""])[0];
  if (against) return { stance: "against", basis: quote("反対") };
  if (forIt) return { stance: "for", basis: quote("賛成") };
  return { stance: "unclear", basis: "" };
}

/** 会議日1日分から討論の発言を取り出す。 */
export function extractDebates(fileName, text, segments = []) {
  const utterances = splitUtterances(text);
  // 発言の並び順は、発言一覧（segments）と1対1で対応する。
  // 位置（pos）が分かると、発言単位の出典URLを作れる。
  utterances.forEach((u, i) => {
    u.pos = segments[i]?.pos ?? null;
  });
  const results = [];
  let agenda = null;
  let inDebate = false;
  let current = null;

  const flush = () => {
    if (current) results.push(current);
    current = null;
  };

  for (const u of utterances) {
    const agendaMatch = u.text.match(AGENDA) ?? u.text.match(AGENDA_NO_NUMBER);
    if (agendaMatch) agenda = agendaMatch[1].trim();

    // 〔◯番（氏名君）登壇〕は、直前の発言（議長の発言許可）の末尾へ付く。
    const tookPodium = PODIUM.test(u.previousTail ?? "");

    // 終了判定より先に、紛らわしい定型句を消す。
    const cleaned = u.text.replace(NOTICED_DEBATE_END, "");

    if (!inDebate) {
      if (DEBATE_START.test(u.text)) inDebate = true;
      continue;
    }
    // 討論の終了を告げられるのは議事進行役だけ。討論者本人も
    // 「以上で、賛成の立場からの討論を終わります」と結ぶため、
    // 発言者を見ないと最初の1人で打ち切ってしまう。
    if (isChairSpeaker(u.speaker) && DEBATE_END.test(cleaned)) {
      flush();
      inDebate = false;
      continue;
    }
    if (!isMemberSpeaker(u.speaker)) continue;
    // 討論は登壇して行う。会議録は登壇を〔二二番（平田信広君）登壇〕と記録し、
    // 終わりを（降壇）と記録する。自席からの短いやり取り（議長への応答、
    // 他の議員の討論への補足、議事進行の質問）には登壇の記録が無い。
    // 登壇の記録が直前に無い発言は、討論として数えない。
    //
    // 実例：議長が「北林議員、討論はできないんですけど、何の提案でしょうか」と述べた
    // 直後の「過ちがあったからです。」を、討論として数えてしまっていた。
    const name = normalizeSpeakerName(u.speaker);
    // 登壇の判定は、討論の始まりにだけ効かせる。議長の制止を挟んで同じ議員が
    // 続きを述べる場合、その続きには登壇の記録が付かない。continue で落とすと、
    // 後から述べた立場（「私は、今回、反対の立場を取らせていただきました」）まで消える。
    if (!tookPodium && !(current && current.speakerName === name)) continue;

    if (current && current.speakerName === name) {
      // 議長の制止などで発言が分断される。同じ人の連続は1件にまとめる。
      current.text += u.text;
    } else {
      flush();
      current = { fileName, agenda, speakerLabelAsWritten: u.speaker, speakerName: name, text: u.text, pos: u.pos };
    }
  }
  flush();

  return results.map((r) => {
    const { stance, basis } = judgeStance(r.text);
    return {
      fileName: r.fileName,
      agendaTitle: r.agenda,
      speakerLabelAsWritten: r.speakerLabelAsWritten,
      speakerName: r.speakerName,
      pos: r.pos,
      sourceUrl:
        r.pos == null
          ? null
          : `${BASE}/cgi-bin3/GetText3.exe?${CODE}/${r.fileName}/${r.pos}/10/1//0/0`,
      stance,
      stanceBasis: basis,
      excerpt: r.text.slice(0, 120),
    };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const limitAt = args.indexOf("--limit");
  const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : Infinity;
  const outAt = args.indexOf("--out");
  const out = outAt >= 0 ? args[outAt + 1] : null;

  // 年 → 会期 → 会議日 の順にたどる。討論は閉会日に多いが臨時会にもあるため、全会議日を見る。
  const fromYearAt = args.indexOf("--from-year");
  const fromYear = fromYearAt >= 0 ? Number(args[fromYearAt + 1]) : 2023;
  const thisYear = new Date().getFullYear();
  const days = [];
  for (let year = fromYear; year <= thisYear; year += 1) {
    const sessions = await listSessionsForYear({ code: CODE, year });
    for (const session of sessions) {
      const found = await listMeetingDays({ code: CODE, sessionLabel: session.treedepth ?? session.label ?? session });
      for (const d of found) days.push({ ...d, sessionLabel: session.treedepth ?? session.label ?? session });
    }
  }
  console.log(`[extract-council-debates] ${fromYear}年以降の会議日 ${days.length}件を走査します`);

  const all = [];
  let scanned = 0;
  for (const day of days) {
    if (scanned >= limit) break;
    const day1 = await fetchDayText(day.fileName);
    scanned += 1;
    if (!day1) {
      console.log(`  skip ${day.fileName}（本文を取得できません）`);
      continue;
    }
    const found = extractDebates(day.fileName, day1.text, day1.segments);
    if (found.length) {
      console.log(`  ${day.fileName} ${day.title ?? ""}：討論 ${found.length}件`);
      all.push(...found.map((f) => ({ ...f, meetingTitle: day.title ?? null, sessionLabel: day.sessionLabel ?? null })));
    }
  }

  console.log(`\n討論の発言 ${all.length}件／発言者 ${new Set(all.map((a) => a.speakerName)).size}名`);
  if (out) {
    writeFileSync(out, JSON.stringify(all, null, 2));
    console.log(`出力: ${out}`);
  }
  return all;
}

// このファイルを直接実行したときだけ main を走らせる（importしたときは走らせない）。
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (invokedDirectly) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

/**
 * 抽出結果を、サイトが読むデータ形式へ整える。
 * 氏名から議員IDを引き、引けなかったものは捨てずに氏名のまま残す
 * （元議員や表記ゆれを黙って落とさない）。
 */
export function toDataFile(records, { members, formerMembers, councilSessions, verifiedAt }) {
  // 会議録の会期ラベル（「令和 5年 第 3回定例会」）を、サイトの会期IDへ対応づける。
  // 日付の近さで推定すると閉会日が隣の会期へ寄ってしまうため、ラベルで突き合わせる。
  const labelKey = (v) => String(v).replace(/\s|　/g, "");
  const sessionIdByLabel = new Map(
    (councilSessions ?? [])
      .filter((x) => x.eraYear && x.sessionNumber && x.sessionType)
      .map((x) => [labelKey(`${x.eraYear}${x.sessionNumber}${x.sessionType}`), x.id]),
  );
  const norm = (s) => s.replace(/[\s　]/g, "");
  const byName = new Map(members.map((m) => [norm(m.name), m.id]));
  const formerByName = new Map(formerMembers.map((m) => [norm(m.name), m.id]));
  const speeches = records.map((r, i) => {
    const key = norm(r.speakerName);
    return {
      id: `debate-${r.fileName}-${r.pos ?? i}`,
      meetingFileName: r.fileName,
      meetingTitle: r.meetingTitle ?? null,
      sessionId: r.sessionLabel ? (sessionIdByLabel.get(labelKey(r.sessionLabel)) ?? null) : null,
      sessionLabel: r.sessionLabel ? String(r.sessionLabel).trim() : null,
      agendaTitle: r.agendaTitle ?? null,
      memberId: byName.get(key) ?? null,
      formerMemberId: byName.has(key) ? null : (formerByName.get(key) ?? null),
      speakerName: r.speakerName,
      speakerLabelAsWritten: r.speakerLabelAsWritten,
      stance: r.stance,
      stanceBasis: r.stanceBasis || null,
      excerpt: r.excerpt,
      sourceUrl: r.sourceUrl,
    };
  });
  return {
    note:
      "本会議での討論（賛成討論・反対討論）の発言者。会議録の討論の段階から機械的に抽出した。" +
      "討論に立ったという事実の記録であり、賛成・反対の方向を評価するものではない。" +
      "議案の採決は起立採決のため、討論しなかった議員の賛否は会議録から分からない。" +
      "討論の有無をもって賛否を推測してはならない。",
    method:
      "議長が「これより（一括）討論に入ります」と宣告してから、議長が「討論を終わります」と述べるまでを討論の段階とし、" +
      "その間の議員の発言を討論として数える。「通告による討論は終わりました」は途中の区切りであって終了ではないため除外する。" +
      "討論者自身も「討論を終わります」と結ぶため、終了の宣告は議事進行役の発言に限って判定する。",
    stanceNote:
      "stance は発言本文から機械的に読み取れた場合のみ for／against とし、読み取れない場合や賛成・反対の双方に言及している場合は unclear のままにする（推測で決めない）。",
    generatedAt: verifiedAt,
    speeches,
  };
}

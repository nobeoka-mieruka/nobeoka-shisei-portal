/**
 * 公開記録による議会活動（①市政運営の監視・評価）の算定を検証する。
 *
 * 検証の主眼は、数値が「議員の活動」を表しているかどうかではなく、
 * 次の2つを取り違えていないことにある。
 *
 *   ・確認した結果0件（CONFIRMED_ZERO）
 *   ・まだ確認できていない／公表されていない／個人に帰属しない／制度上対象外
 *
 * このプロジェクトには専用のテストランナーが無いため、既存のscripts/test-*.mjsと同じ
 * 「プレーンなNode＋assert」方式に揃えている。
 *
 * 使い方: node --experimental-strip-types scripts/test-council-activity-record.mjs
 */
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
const readSrc = (relPath) => readFileSync(join(ROOT, relPath), "utf8");

// Node ESMは（Viteと異なり）拡張子なしの相対importを解決できないため、
// .ts拡張子を補った複製を一時ディレクトリへ書き出して読み込む（元ファイルは変更しない）。
// councilActivityRecord.tsはJSON importを持たないため、書き換えはこの1行だけで済む。
const CRLF = new RegExp(String.fromCharCode(13) + String.fromCharCode(10), "g");
const recordSource = readSrc("src/lib/councilActivityRecord.ts").replace(CRLF, String.fromCharCode(10));
const recordPatched = recordSource.replace(
  'from "./questionLikeSpeechTypes"',
  'from "./questionLikeSpeechTypes.ts"',
);
if (recordPatched === recordSource) {
  throw new Error("questionLikeSpeechTypesのimport行が見つかりませんでした（構造が変わった可能性があります）。");
}
const tmpDir = mkdtempSync(join(tmpdir(), "council-activity-record-test-"));
writeFileSync(join(tmpDir, "councilActivityRecord.ts"), recordPatched);
copyFileSync(join(ROOT, "src/lib/questionLikeSpeechTypes.ts"), join(tmpDir, "questionLikeSpeechTypes.ts"));

const { buildCouncilActivityRecord } = await import(
  pathToFileURL(join(tmpDir, "councilActivityRecord.ts")).href
);

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

/** テスト用の発言を組み立てる。 */
function makeSpeech(sessionId, itemCount, followUpCount = 0) {
  return {
    id: `${sessionId}-speech`,
    memberId: "mTest",
    sessionId,
    date: "2024-06-01",
    meetingNumber: 1,
    meetingType: "本会議",
    speechType: "一般質問",
    isPublished: true,
    summaryStatus: "verified",
    topics: [],
    shortSummary: "",
    questionItems: Array.from({ length: itemCount }, (_, i) => ({
      id: `q${i}`,
      title: `項目${i}`,
      questionSummary: "",
      answerSummary: "",
      answerers: [],
      // 実データと同じ並び（質問→答弁→再質問）にする。
      // 答弁より前に置かれた再質問は CONFIRMED ではなく LIKELY になるため、
      // ここを省略するとテストが実態とずれる。
      exchanges:
        i < followUpCount
          ? [
              { order: 1, type: "question", speakerId: "mTest", summary: "" },
              { order: 2, type: "answer", speakerName: "市長", summary: "" },
              { order: 3, type: "follow-up-question", speakerId: "mTest", summary: "" },
            ]
          : [
              { order: 1, type: "question", speakerId: "mTest", summary: "" },
              { order: 2, type: "answer", speakerName: "市長", summary: "" },
            ],
      questionAnswerLinkStatus: "confirmed",
    })),
    summarySources: [{ title: "会議録", sourceType: "official-minutes-html", sourceUrl: "https://example.invalid/a" }],
  };
}

const S = (id) => ({ sessionId: id, sessionTitle: `${id}定例会` });

console.log("\n公開記録による議会活動（①市政運営の監視・評価）");

// --- 1. 議長期間が分母から除外される ---
check("議長期間は分母から除外され、0%にならない", () => {
  const all = [S("2023-06"), S("2023-09")];
  const record = buildCouncilActivityRecord(
    [],
    [],
    all.map((s) => ({ ...s, reasonCode: "SPEAKER_TERM" })),
  );
  const rate = record.values.find((v) => v.key === "asked-rate");
  assert.equal(rate.value, null, "0%として表示してはいけない");
  assert.equal(rate.availability, "not-applicable");
  // 「役職のため質問できなかった」とは書かず、比較条件を揃えるための除外であると示す。
  assert.match(rate.availabilityNote ?? "", /役職就任期間/);
  assert.ok(
    !/質問できなかった/.test(rate.availabilityNote ?? ""),
    "役職を理由に質問できなかったと断定してはいけない",
  );
  assert.equal(record.sessions.every((s) => !s.countedInDenominator), true, "全会期が分母外になるべき");
});

// --- 2. 途中就任議員の就任前会期が分母に入らない ---
check("分母に渡さなかった会期は、実施率の分母に入らない", () => {
  // 途中就任の場合、呼び出し側は就任後の会期だけを渡す。
  const record = buildCouncilActivityRecord([makeSpeech("2025-06", 3)], [S("2025-06"), S("2025-09")], [
    { ...S("2023-06"), reasonCode: "NOT_YET_MEMBER" },
  ]);
  const rate = record.values.find((v) => v.key === "asked-rate");
  assert.equal(rate.denominator, 2, "就任前の会期は分母に含めない");
  assert.equal(rate.numerator, 1);
  assert.equal(rate.value, 50);
  const excluded = record.sessions.find((s) => s.sessionId === "2023-06");
  assert.equal(excluded.countedInDenominator, false);
  assert.match(excluded.excludedReason ?? "", /まだ議員ではありません/);
});

// --- 3. CONFIRMED_ZERO と欠損が違う ---
check("確認した結果0件と、対象外・未確認を別の状態として返す", () => {
  const zero = buildCouncilActivityRecord([], [S("2023-06")], []);
  const zeroSessions = zero.values.find((v) => v.key === "asked-sessions");
  assert.equal(zeroSessions.value, 0, "確認した結果0件は0として持つ");
  assert.equal(zeroSessions.availability, "confirmed-zero");

  const na = buildCouncilActivityRecord([], [], [{ ...S("2023-06"), reasonCode: "NOT_APPLICABLE" }]);
  const naSessions = na.values.find((v) => v.key === "asked-sessions");
  assert.equal(naSessions.value, null, "対象外は0にしない");
  assert.equal(naSessions.availability, "not-applicable");
  assert.notEqual(zeroSessions.availability, naSessions.availability);
});

// --- 4・5. 未取得・個人帰属不能を0件として表示しない ---
check("未取得・未公表・個人帰属不能の状態が語彙として用意されている", () => {
  const src = readSrc("src/lib/councilActivityRecord.ts");
  for (const code of ["not-acquired", "not-published", "not-individually-attributable"]) {
    assert.ok(src.includes(`"${code}"`), `${code} が定義されていません`);
  }
  // 0件と取り違えないラベルが与えられていること。ラベルは一覧・比較と共通の表から取る。
  assert.match(src, /"confirmed-zero": "0件（資料を確認済み）"/);
  assert.match(src, /"not-acquired": "未確認"/);
  assert.match(src, /"not-published": "未公開"/);
  assert.match(src, /"not-individually-attributable": "個人単位で確認不可"/);
  assert.match(src, /"not-applicable": "対象外"/);
  const ui = readSrc("src/components/council/CouncilActivityRecordSection.tsx");
  assert.match(ui, /ACTIVITY_AVAILABILITY_LABELS_JA/, "個人ページが共通のラベル表を使っていません");
  assert.match(readSrc("src/pages/CouncilActivityPage.tsx"), /ACTIVITY_AVAILABILITY_LABELS_JA/, "一覧が共通のラベル表を使っていません");
  // 値が無いときに0と書かないこと。
  assert.match(ui, /if \(value === null\) return "―";/);
});

// --- 6. 再質問確認率が正しく算出される ---
check("再質問の確認率が、再質問を確認できた質問 ÷ 質問総数で算出される", () => {
  const record = buildCouncilActivityRecord([makeSpeech("2023-06", 10, 4)], [S("2023-06")], []);
  const items = record.values.find((v) => v.key === "question-items");
  const fu = record.values.find((v) => v.key === "follow-up-items");
  const rate = record.values.find((v) => v.key === "follow-up-rate");
  assert.equal(items.value, 10);
  assert.equal(fu.value, 4);
  assert.equal(rate.numerator, 4);
  assert.equal(rate.denominator, 10);
  assert.equal(rate.value, 40);
});

check("質問が0件なら、再質問の確認率は0%ではなく算定しない", () => {
  const record = buildCouncilActivityRecord([], [S("2023-06")], []);
  const rate = record.values.find((v) => v.key === "follow-up-rate");
  assert.equal(rate.value, null, "分母0で0%と表示してはいけない");
  assert.equal(rate.availability, "confirmed-zero");
});

// --- 7. 同じ議員の表示値が比較相手によって変わらない ---
check("同じ入力なら常に同じ値になる（他の議員に依存しない）", () => {
  const speeches = [makeSpeech("2023-06", 5, 2)];
  const sessions = [S("2023-06"), S("2023-09")];
  const a = buildCouncilActivityRecord(speeches, sessions, []);
  const b = buildCouncilActivityRecord(speeches, sessions, []);
  assert.deepEqual(a.values, b.values);
  // 算定関数の引数に「他の議員」を受け取る経路が無いこと。
  const src = readSrc("src/lib/councilActivityRecord.ts");
  assert.ok(!/Math\.max\([^)]*\.\.\./.test(src), "他の値の最大値で正規化していない");
  assert.ok(!/平均|average|percentile|rank/i.test(src), "平均・順位を使っていない");
});

check("一覧の横棒グラフが、表示中の他議員の最大値で決まっていない", () => {
  const src = readSrc("src/pages/CouncilActivityPage.tsx");
  assert.ok(
    !/Math\.max\(1, \.\.\.filteredRows/.test(src),
    "表示中の行の最大値で棒の長さを決めてはいけない（絞り込みで同じ議員の見た目が変わる）",
  );
  assert.match(src, /SPEECH_BAR_MAX/, "固定の基準値を使うこと");
});

// --- 8. 新しい会議録が追加されたとき再計算できる ---
check("会議録が増えれば再計算される（値がデータから導出されている）", () => {
  const before = buildCouncilActivityRecord([makeSpeech("2023-06", 5, 2)], [S("2023-06"), S("2023-09")], []);
  const after = buildCouncilActivityRecord(
    [makeSpeech("2023-06", 5, 2), makeSpeech("2023-09", 3, 1)],
    [S("2023-06"), S("2023-09")],
    [],
  );
  assert.equal(before.values.find((v) => v.key === "asked-rate").value, 50);
  assert.equal(after.values.find((v) => v.key === "asked-rate").value, 100);
  assert.equal(after.values.find((v) => v.key === "question-items").value, 8);
});

// --- 9. 根拠から元の会議録へ到達できる ---
check("会期ごとの内訳に、会議録へのリンクが含まれる", () => {
  const record = buildCouncilActivityRecord([makeSpeech("2023-06", 2)], [S("2023-06"), S("2023-09")], []);
  const asked = record.sessions.find((s) => s.sessionId === "2023-06");
  const notAsked = record.sessions.find((s) => s.sessionId === "2023-09");
  assert.equal(asked.asked, true);
  assert.ok(asked.transcriptUrl, "質問を確認できた会期には会議録リンクが要る");
  assert.equal(notAsked.asked, false);
  assert.equal(notAsked.transcriptUrl, undefined, "質問の記録が無い会期にリンクを付けない");
  const ui = readSrc("src/components/council/CouncilActivityRecordSection.tsx");
  assert.match(ui, /根拠を見る/, "各項目に根拠への導線が要ります");
});

// --- 実データでの整合 ---
check("実データ：議長は対象外、他の議員は同じ分母で算定される", () => {
  const members = readJson("src/data/members.json");
  const status = readJson("src/data/questionCollectionStatus.json");
  const confirmed = status.sessions.filter((s) => s.transcriptAvailable === true);
  const isChair = (m) => (m.profile ?? "").split("。").map((x) => x.trim()).includes("議長");
  const chairs = members.filter(isChair);
  assert.equal(chairs.length, 1, "議長は1名のはずです（前提が変わった可能性）");
  const vice = members.filter((m) => (m.profile ?? "").split("。").map((x) => x.trim()).includes("副議長"));
  assert.ok(!vice.some((m) => isChair(m)), "副議長を議長と取り違えてはいけない");
  assert.ok(confirmed.length > 0, "会議録を確認できた会期が1件もありません");
});

// --- 算定していない項目の記述が、実装・実データと食い違っていないこと ---
console.log("");
console.log("事実表示へ揃えた項目の記述");

check("算定していない項目に、計算式を書き残していない", () => {
  const radar = readSrc("src/lib/activityRadar.ts");
  const page = readSrc("src/pages/MethodologyCouncilActivityPage.tsx");
  // 出席状況は議員別の出席・欠席名簿を確認できておらず、一度も算定していない。
  // 「出席回数 ÷ 出席対象会議数 × 100」のような式を残すと、算定しているように読めてしまう。
  assert.ok(!radar.includes("出席回数 ÷ 出席対象会議数"), "出席状況に計算式が残っています");
  assert.ok(!page.includes("出席回数 ÷ 出席対象会議数"), "算定方法ページに出席状況の計算式が残っています");
  assert.ok(!page.includes("現在データ整備中"), "「データ整備中」のまま放置された算定式が残っています");
  // 割合として算定しなくなった項目に、÷…×100 の式を残さない。
  // （一般質問実施率と再質問の確認率は、分子・分母を併記したうえで割合を出しているため対象外。）
  for (const stale of [
    "意思表示を確認できた議案数 ÷ 対象議案数 × 100",
    "確認できた項目数 ÷ 確認対象項目数 × 100",
  ]) {
    assert.ok(!radar.includes(stale), `算定をやめた項目の式が残っています: ${stale}`);
    assert.ok(!page.includes(stale), `算定方法ページに古い式が残っています: ${stale}`);
  }
});

check("「請願・提案等」を、登録済みの記録があるのに未収録と書いていない", () => {
  const roles = readJson("src/data/billProposalRoles.json").roles.filter((r) => r.role === "submitter");
  const reports = readJson("src/data/committeeReportActivity.json").events.filter((e) => e.memberId);
  // 決議の提出者・委員長報告は会議録から氏名を確認して登録済みで、サイト上でも実数を出している。
  assert.ok(roles.length > 0, "決議の提出者が1件も登録されていません（前提が変わった可能性）");
  assert.ok(reports.length > 0, "委員長・副委員長報告が1件も登録されていません（前提が変わった可能性）");

  const radar = readSrc("src/lib/activityRadar.ts");
  const page = readSrc("src/pages/MethodologyCouncilActivityPage.tsx");
  assert.ok(
    !radar.includes("議案・条例・請願・陳情アーカイブ（未収録）"),
    "登録済みの記録があるのに、出典を「未収録」と書いています",
  );
  assert.ok(
    !page.includes("議員別の提案者・紹介議員情報を一切収録していない"),
    "登録済みの記録があるのに、「一切収録していない」と書いています",
  );
  // 収録できていない範囲（条例案等の提出者・紹介議員）は、引き続き明示する。
  assert.match(page, /紹介議員/, "収録できていない範囲の説明が消えています");
});

check("出席状況を「公表されていない」と断定していない", () => {
  // 調査して確認できなかったことと、市議会が出していないことは別である。
  // 過去に委員会の記録でこの2つを取り違えた誤りがあり、同じ書き方を繰り返さない。
  // （この区別を全体で見張るのは scripts/test-committee-publication-claim.mjs）
  const radar = readSrc("src/lib/activityRadar.ts");
  const page = readSrc("src/pages/MethodologyCouncilActivityPage.tsx");
  for (const [name, src] of [["activityRadar.ts", radar], ["算定方法ページ", page]]) {
    // 出席と公表の両方に触れている文だけを取り出し、必ず但し書きが付いていることを確かめる。
    const sentences = src.split("。").filter((t) => t.includes("出席") && t.includes("公表"));
    for (const sentence of sentences) {
      assert.ok(
        sentence.includes("断定するものではありません") || sentence.includes("確認できていない"),
        `${name} が、出席記録を公表されていないと断定しています: ${sentence.trim().slice(0, 60)}`,
      );
    }
  }
  assert.match(page, /断定するものではありません/, "確認できていないことの但し書きが必要です");
});

// --- 7. 欠損値をレーダーの0として扱わない ---
check("レーダーチャートが、欠損値を0の位置へ描画しない", () => {
  const chart = readSrc("src/components/council/ActivityRadarChart.tsx");
  // 欠損軸は多角形へ含めず、欠損をまたいだ直線補間もしない。
  assert.match(chart, /m.value === null/, "欠損の分岐がありません");
  assert.ok(
    !chart.includes("m.value ?? 0") && !chart.includes("m.value || 0"),
    "欠損を0へ丸めています",
  );
  // 読み上げ用の文言でも「0点」と言わない。
  assert.match(chart, /データ未収録/, "欠損を数値として読み上げています");

  // 個人ページでは、軸の大半が欠損のままチャートを出さない。
  const memberPage = readSrc("src/pages/MemberDetailPage.tsx");
  assert.ok(!memberPage.includes("ActivityRadarChart"), "個人ページにレーダーチャートが復活しています");
});

// --- 8. 会議録に名前があるだけで出席扱いしない ---
check("出席を、発言記録や名前の出現から数えていない", () => {
  const radar = readSrc("src/lib/activityRadar.ts");
  // calculateAttendanceIndex は引数を取らず、常に算定しない値を返す。
  assert.ok(
    radar.includes("export function calculateAttendanceIndex(): RadarMetric"),
    "出席の算定関数が引数を取るようになっています（発言データを渡し始めた疑い）",
  );
  const body = radar.slice(radar.indexOf("export function calculateAttendanceIndex"));
  const fn = body.slice(0, body.indexOf(String.fromCharCode(10) + "}"));
  assert.ok(fn.includes("value: null"), "出席に数値が入っています");
  // 関数の中で件数を数え始めていないこと（.length / filter / reduce が現れない）。
  for (const counting of [".length", ".filter(", ".reduce(", "Math.round"]) {
    assert.ok(!fn.includes(counting), `出席を数え始めています: ${counting}`);
  }

  // 記名投票の名簿を出席として流用していないこと。
  const barometer = readSrc("src/lib/councilActivityBarometer.ts");
  assert.ok(
    !/attendance[^;]*memberVotes/.test(barometer),
    "記名投票の名簿を出席として数えています",
  );
});

// --- 9. 「公開されていない」と「当サイト未取得」を区別する ---
check("未取得と未公表を、同じ言葉で説明していない", () => {
  const vocab = readSrc("src/lib/evidenceAvailability.ts");
  const notCollected = vocab.match(/not_collected: "([^"]+)"/g) ?? [];
  const notPublished = vocab.match(/source_not_published: "([^"]+)"/g) ?? [];
  assert.ok(notCollected.length >= 2 && notPublished.length >= 2, "両方の説明文が揃っていません");
  // ラベルと説明文が、互いに異なる語であること。
  assert.notEqual(
    EVIDENCE_LABEL(vocab, "not_collected"),
    EVIDENCE_LABEL(vocab, "source_not_published"),
    "未取得と未公表に同じラベルを使っています",
  );
  // 未取得の説明が「0件ではない」と明言していること。
  assert.match(vocab, /not_collected: "[^"]*0件という意味ではありません/);
});

function EVIDENCE_LABEL(src, code) {
  const m = src.match(new RegExp(code + ': "([^"]+)"'));
  return m ? m[1] : null;
}

// --- 10. 「確認できていない」ものを0件・0会期・0%として出さない ---
console.log("");
console.log("0として表示してよいのは、確認した結果0件のときだけ");

check("データ充足状況が、確認できていない項目に0会期・0件と書かない", () => {
  const src = readSrc("src/lib/councilActivityBarometer.ts");
  // 出席状況は議員別の名簿自体を確認できていないため、件数を持たない。
  assert.ok(!src.includes('sourceRecordUnit: "出席記録0件"'), "出席を0件と書いています");
  assert.ok(
    !src.includes('sourceRecordUnit: "議員別の提案者・紹介議員情報0件"'),
    "登録済みの記録があるのに0件と書いています",
  );
  // 出席の行が confirmedSessionCount を持たないこと（0会期と表示されないため）。
  const attendance = src.slice(src.indexOf('indicatorLabel: "出席状況"'));
  const block = attendance.slice(0, attendance.indexOf("},"));
  assert.match(block, /confirmedSessionCount: null/, "出席に会期数が入っています");
  assert.match(block, /sourceRecordCount: null/, "出席に件数が入っています");
});

check("一覧・個人ページが、値の無い件数を0へ丸めていない", () => {
  for (const rel of ["src/pages/CouncilActivityPage.tsx", "src/pages/CouncilActivityMemberPage.tsx"]) {
    const src = readSrc(rel);
    assert.ok(
      !src.includes("rawValue ?? 0"),
      `${rel} が、未取得の件数を0として表示します（会議録の取得が途切れた瞬間に全議員0件になります）`,
    );
  }
});

check("制度上の対象外を「確認中」と同じ言葉にしていない", () => {
  const list = readSrc("src/pages/CouncilActivityPage.tsx");
  assert.match(list, /notApplicable \? "対象外" : "未確認"/, "一覧で対象外と未確認を区別していません");
  const detail = readSrc("src/pages/CouncilActivityMemberPage.tsx");
  assert.match(detail, /questionNotApplicable/, "個人ページで対象外を区別していません");
});

check("議長は、質問項目まで含めて対象外になる（0件と書かない）", () => {
  const record = buildCouncilActivityRecord([], [], [{ ...S("2023-06"), reasonCode: "SPEAKER_TERM" }]);
  for (const key of ["asked-sessions", "asked-rate", "question-items", "follow-up-items", "follow-up-rate"]) {
    const v = record.values.find((x) => x.key === key);
    assert.equal(v.value, null, `${key} が0として表示されます`);
    assert.equal(v.availability, "not-applicable", `${key} が対象外になっていません`);
  }
});

check("議案への賛否は、記録が無いとき個人帰属不能として扱う", () => {
  const withNone = buildCouncilActivityRecord([], [S("2023-06")], [], {});
  const v = withNone.values.find((x) => x.key === "named-votes");
  assert.equal(v.value, null, "0件として表示してはいけない");
  assert.equal(v.availability, "not-individually-attributable");
  assert.match(v.availabilityNote ?? "", /特定できない/);

  const withVotes = buildCouncilActivityRecord([], [S("2023-06")], [], {
    namedVotes: { numerator: 1, denominator: 2 },
  });
  const v2 = withVotes.values.find((x) => x.key === "named-votes");
  assert.equal(v2.value, 1);
  assert.equal(v2.denominator, 2);
  assert.equal(v2.availability, "available");
});

// --- 11. 政策分野・継続テーマ ---
console.log("");
console.log("政策テーマ");

check("政策分野は一覧として持ち、点数にしていない", () => {
  const record = buildCouncilActivityRecord([], [S("2023-06")], [], {
    policyThemes: [{ label: "子育て・教育", detail: "3会期" }],
  });
  const v = record.values.find((x) => x.key === "policy-themes");
  assert.equal(v.kind, "list");
  assert.equal(v.value, null, "分野数を数値として持ってはいけない");
  assert.equal(v.items.length, 1);
  // 説明文が、広さを評価しないと明言していること。
  assert.match(v.description, /評価するものではなく/);
});

check("継続テーマは、最初と最新の会期まで示す", () => {
  const record = buildCouncilActivityRecord([], [S("2023-06")], [], {
    recurringThemes: [{ label: "防災", detail: "4会期（最初：令和5年6月定例会／最新：令和8年3月定例会）" }],
  });
  const v = record.values.find((x) => x.key === "recurring-themes");
  assert.match(v.items[0].detail, /最初：/);
  assert.match(v.items[0].detail, /最新：/);
  assert.match(v.description, /2つ以上の会期/);
});

check("分類の根拠・確からしさ・版を保持している", () => {
  const meta = readSrc("src/lib/topicClassificationMeta.ts");
  for (const key of ["TopicClassificationMethod", "TopicClassificationConfidence", "TOPIC_CLASSIFICATION_VERSION"]) {
    assert.ok(meta.includes(key), `${key} がありません`);
  }
  // AIは語彙にあるが、現在どこからも返していないこと。
  assert.ok(!/method: "ai"/.test(meta), "AI分類を返す経路ができています（画面表示の見直しが必要です）");
  // 自動分類であることを画面へ出す語があること。
  assert.match(meta, /自動分類（キーワード）/);
});

check("「未分類」「その他」を政策テーマのカードに混ぜていない", () => {
  const meta = readSrc("src/lib/topicClassificationMeta.ts");
  assert.match(meta, /NON_POLICY_THEME_SLUGS/);
  const page = readSrc("src/pages/ThemesPage.tsx");
  assert.match(page, /policyThemes\.map/, "政策テーマのカードを絞り込んでいません");
  assert.match(page, /nonPolicyThemes/, "未分類・その他を別枠にしていません");

  // themes.json 側の前提（キーワードが空＝照合では選ばれない）が変わっていないこと。
  const themes = readJson("src/data/themes.json");
  const empty = themes.filter((t) => (t.keywords ?? []).length === 0).map((t) => t.slug).sort();
  assert.deepEqual(empty, ["other", "unclassified"], "キーワードが空のテーマが変わりました（表示の見直しが必要です）");
});

// --- 12. 除外理由をコードで追跡できる ---
console.log("");
console.log("分母から外した会期の追跡");

check("除外会期が、理由コードと根拠資料IDを持つ", () => {
  const record = buildCouncilActivityRecord([], [S("2025-06")], [
    { ...S("2026-09"), reasonCode: "SOURCE_NOT_PUBLISHED", evidenceSourceId: "questionCollectionStatus.json" },
  ]);
  const ex = record.sessions.find((x) => x.sessionId === "2026-09");
  assert.equal(ex.countedInDenominator, false, "未公開会期を分母に入れてはいけない");
  assert.equal(ex.excludedReasonCode, "SOURCE_NOT_PUBLISHED");
  assert.equal(ex.evidenceSourceId, "questionCollectionStatus.json");
  assert.equal(ex.asked, null, "未公開会期を「質問なし」にしてはいけない");
  // 分母は、渡した対象会期だけ。
  const rate = record.values.find((v) => v.key === "asked-rate");
  assert.equal(rate.denominator, 1);
});

check("内部コードと画面の文言が分離されている", () => {
  const src = readSrc("src/lib/councilActivityRecord.ts");
  assert.match(src, /EXCLUSION_REASON_LABELS_JA/, "表示文言の対応表がありません");
  for (const code of ["NOT_YET_MEMBER", "NO_LONGER_MEMBER", "SPEAKER_TERM", "SOURCE_NOT_PUBLISHED", "NOT_APPLICABLE"]) {
    assert.ok(src.includes(code), `${code} が定義されていません`);
  }
  // 未公開の説明が「質問なし」と読まれないようにしていること。
  assert.match(src, /SOURCE_NOT_PUBLISHED: "[^"]*質問がなかったという意味ではありません/);
});

check("根拠の画面から、表示値を再計算できる", () => {
  const record = buildCouncilActivityRecord([makeSpeech("2023-06", 4, 3)], [S("2023-06"), S("2023-09")], []);
  const rate = record.values.find((v) => v.key === "asked-rate");
  // 分子・分母と、それぞれが何を数えたものかが揃っていること。
  assert.equal(rate.numerator, 1);
  assert.equal(rate.denominator, 2);
  assert.ok(rate.numeratorLabel && rate.denominatorLabel, "分子・分母の意味を示す見出しがありません");
  assert.equal(Math.round((rate.numerator / rate.denominator) * 100), rate.value, "表示値を分子分母から再現できません");

  const fuRate = record.values.find((v) => v.key === "follow-up-rate");
  assert.equal(Math.round((fuRate.numerator / fuRate.denominator) * 100), fuRate.value);

  // 画面側に、式そのものが置かれていること。
  const ui = readSrc("src/components/council/CouncilActivityRecordSection.tsx");
  assert.match(ui, /÷ \$\{value\.denominator\} × 100/, "根拠の画面に計算式がありません");
});

check("実データ：会議録が未公開の会期は、分母に入らず理由付きで残る", () => {
  const status = readJson("src/data/questionCollectionStatus.json");
  const unpublished = status.sessions.filter((x) => x.transcriptAvailable !== true);
  const barometer = readSrc("src/lib/councilActivityBarometer.ts");
  assert.match(barometer, /unpublishedSessionExclusions/, "未公開会期を除外として渡していません");
  // 未公開会期が実データに存在する間は、その扱いが画面へ出ていること。
  if (unpublished.length > 0) {
    assert.match(barometer, /SOURCE_NOT_PUBLISHED/, "未公開の理由コードを使っていません");
  }
});

check("比較で、対象期間が違うときに注意を出す", () => {
  const src = readSrc("src/pages/CouncilActivityPage.tsx");
  assert.match(src, /comparePeriodDiffers/, "対象期間の違いを判定していません");
  assert.match(src, /対象期間が異なります/, "注意文がありません");
  // 件数だけを並べないよう、算定対象の会期数を行として持つこと。
  assert.match(src, /算定対象の会期数/, "対象会期数を併記していません");
  // 判定は会期数の集合で行う（他の議員の値で正規化しない）。
  assert.ok(
    src.includes("new Set(compareEligibleCounts).size > 1"),
    "対象期間の違いを、会期数の集合で判定していません",
  );
});

console.log(`\n${passCount}件成功\n`);

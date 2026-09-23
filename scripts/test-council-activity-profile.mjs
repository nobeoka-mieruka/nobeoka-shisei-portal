/**
 * 議会活動プロフィールの検査。
 *
 * ここで守りたいのは「算定できないこと」を「活動が無いこと」として
 * 見せないことに尽きる。0・N/A・未確認・未公開・対象外を分けたまま保つ。
 *
 * 使い方: node --experimental-strip-types scripts/test-council-activity-profile.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
const readSrc = (relPath) => readFileSync(join(ROOT, relPath), "utf8");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const profileSrc = readSrc("src/lib/councilActivityProfile.ts");
const chartSrc = readSrc("src/components/council/CouncilActivityProfileChart.tsx");
const barometerSrc = readSrc("src/lib/councilActivityBarometer.ts");
const recordSrc = readSrc("src/lib/councilActivityRecord.ts");

console.log("\n議会活動プロフィール（7軸）");

check("軸がそろっていて、それぞれ条例上の役割と観測している活動を分けている", () => {
  // 一次資料を調べた結果、請願の紹介・予算決算・委員会の3つは軸として成立しないと判断し、
  // レーダーから外した（記録自体は「議会での活動」に残している）。
  for (const key of ["monitoring", "policy-proposal", "long-term-view", "member-debate"]) {
    assert.ok(profileSrc.includes(`key: "${key}"`), `${key} がありません`);
  }
  for (const removed of ["representation", "budget-review", "committee-activity"]) {
    assert.ok(
      !profileSrc.includes(`key: "${removed}"`),
      `${removed} が軸として残っています（レーダーから外す判断をしたはずです）`,
    );
  }
  // 軸名が条例の役割そのものだと、役割全体を数値化しているように読める。
  assert.ok(
    !profileSrc.includes('label: "市政運営の監視・評価"'),
    "軸名が条例上の役割そのものになっています",
  );
  assert.ok(profileSrc.includes('label: "一般質問による市政チェック"'), "観測している活動に近い軸名が必要です");
  for (const field of ["roleInOrdinance", "observedActivity", "dataUsed", "upperBoundMeaning"]) {
    assert.ok(profileSrc.includes(field), `${field} がありません`);
  }
});

check("欠損軸を0として描かない（頂点を中心へ落とさない）", () => {
  // 数値の無い軸は、外周に破線の輪として置く。
  assert.match(chartSrc, /strokeDasharray/, "欠損軸の破線表現がありません");
  assert.ok(
    !/measurement\s*\?\?\s*0/.test(chartSrc) && !/ratio\s*\|\|\s*0/.test(chartSrc),
    "欠損を0の半径へ丸めています",
  );
  // ポリゴンは、数値のある軸が一定数そろうまで描かない。
  assert.match(profileSrc, /POLYGON_MIN_AXES = 3/);
  assert.match(chartSrc, /\{polygon && \(/, "ポリゴンを無条件に描いています");
});

check("0・未確認・未公開・個人単位算定不可・対象外を別の記号と言葉で示す", () => {
  // 凡例の言葉。
  for (const word of ["数値あり", "0（資料を確認した結果、該当なし）", "未確認", "未公開", "個人単位算定不可", "対象外"]) {
    assert.ok(chartSrc.includes(word), `凡例の説明「${word}」がありません`);
  }
  // 状態コードごとに記号が割り当てられていること（色だけに頼らない）。
  const table = profileSrc.slice(profileSrc.indexOf("AXIS_STATUS_SYMBOLS"));
  const symbolOf = (code) => (table.match(new RegExp(`${code}: "([^"]+)"`)) ?? [])[1];
  const codes = [
    "CONFIRMED",
    "CONDITIONAL",
    "NOT_INDIVIDUALLY_ATTRIBUTABLE",
    "NOT_ACQUIRED",
    "SOURCE_NOT_PUBLISHED",
    "RESEARCH_EXHAUSTED",
    "NOT_APPLICABLE",
  ];
  for (const code of codes) assert.ok(symbolOf(code), `記号の対応表に ${code} がありません`);
  // 0、未確認、未公開、個人単位算定不可、対象外は、それぞれ別の記号であること。
  const zero = (profileSrc.match(/AXIS_ZERO_SYMBOL = "([^"]+)"/) ?? [])[1];
  const distinct = [zero, ...["CONFIRMED", "NOT_ACQUIRED", "SOURCE_NOT_PUBLISHED", "NOT_INDIVIDUALLY_ATTRIBUTABLE", "NOT_APPLICABLE", "CONDITIONAL"].map(symbolOf)];
  assert.equal(new Set(distinct).size, distinct.length, `状態の記号が重複しています: ${distinct.join(" ")}`);
  assert.match(chartSrc, /AXIS_STATUS_SYMBOLS/, "図が記号の対応表を使っていません");
});

check("図の近くに、能力・優劣の評価ではないことと、算定方法の開閉を置いている", () => {
  assert.match(chartSrc, /議員の能力・優劣を評価するものではありません/);
  assert.match(chartSrc, /算定方法を見る/);
  assert.match(chartSrc, /aria-expanded=\{methodOpen\}/, "算定方法の開閉がキーボード・読み上げに対応していません");
  // 算定方法には、軸ごとの項目がそろっていること。
  for (const term of ["何を数えているか", "対象期間", "分子", "分母", "除外条件", "欠測値の扱い", "一次資料", "最終確認日"]) {
    assert.ok(chartSrc.includes(term), `算定方法に「${term}」がありません`);
  }
});

check("状態コードと画面の文言が分離されている", () => {
  assert.match(profileSrc, /AXIS_STATUS_LABELS_JA/, "表示文言の対応表がありません");
  // 内部コードをそのまま画面へ出していないこと。
  assert.ok(
    !/>\{axis\.status\}</.test(chartSrc),
    "内部コードをそのまま画面に出しています",
  );
});

check("役職による除外を「質問できなかった」と断定していない", () => {
  assert.match(recordSrc, /SPEAKER_TERM: "役職就任期間/, "除外理由の文言が変わっています");
  // 「質問できなかった…という意味ではありません」という打ち消しは許す。
  // 断定として使っていないことだけを見る。
  for (const src of [recordSrc, barometerSrc, profileSrc]) {
    for (const m of src.matchAll(/質問できなかった[^"]{0,40}/g)) {
      assert.match(m[0], /という意味ではありません/, `断定になっています: ${m[0].slice(0, 40)}`);
    }
  }
  // 比較条件を揃えるための除外であることを説明していること。
  assert.match(barometerSrc, /比較条件を揃える|条件が揃わない/);
});

check("議長在任は会期ごとに判定し、対象期間すべてを外さない", () => {
  assert.match(barometerSrc, /chairpersonSessionsFor/, "会期ごとの判定関数がありません");
  assert.match(barometerSrc, /sessionWithinTerm/, "在任期間との突き合わせがありません");
  // 副議長は除外しない（公式資料の裏付けが無いため）。
  assert.ok(
    !/role !== "副議長"/.test(barometerSrc) && barometerSrc.includes('term.role !== "議長"'),
    "議長以外の役職まで除外しています",
  );
});

check("議長の在任期間が、出典つきのデータとして登録されている", () => {
  const data = readJson("src/data/councilLeadershipTerms.json");
  const chairs = data.terms.filter((t) => t.role === "議長");
  assert.ok(chairs.length >= 2, "現任期の議長が2名以上登録されているはずです");
  for (const t of chairs) {
    assert.ok(t.memberId, "議員IDが必要です");
    assert.ok(t.termStart, "就任日が必要です");
    assert.ok(Array.isArray(t.sourceRefs) && t.sourceRefs.length > 0, "出典が必要です");
    for (const ref of t.sourceRefs) assert.ok(ref.label, "出典の名称が必要です");
    // 退任日は未到来なら null。架空の日付を入れない。
    assert.ok(t.termEnd === null || /^\d{4}-\d{2}-\d{2}$/.test(t.termEnd), "退任日の形式が不正です");
  }
});

check("総合点・順位・優劣の語を生成していない", () => {
  // コメントは検査対象から外す。「作らない」と書いた設計メモまで拾ってしまうため。
  const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const [name, raw] of [
    ["councilActivityProfile.ts", profileSrc],
    ["CouncilActivityProfileChart.tsx", chartSrc],
  ]) {
    const src = stripComments(raw);
    for (const word of ["ランキング", "偏差値", "総合点", "優秀", "満点", "1位", "最下位"]) {
      // 「作らない」と書いた説明文は許す。単独で表示語として使っていないことを見る。
      const used = new RegExp(`[>"'\`]\\s*[^"'\`<>]*${word}[^"'\`<>]*\\s*[<"'\`]`).test(src);
      if (!used) continue;
      const negated = new RegExp(`${word}[^。]{0,24}(ではありません|しません|行いません|作成していません|作らない)`).test(src);
      assert.ok(negated, `${name} に「${word}」が評価語として出ています`);
    }
  }
});

check("実データ：26名全員で軸を組み立てられる", () => {
  const members = readJson("src/data/members.json");
  assert.equal(members.length, 26, "現職議員は26名のはずです（前提が変わった可能性）");
  // 軸の並び順が1から連番で重複していないこと。
  const orders = [...profileSrc.matchAll(/^\s*order: (\d),$/gm)].map((m) => Number(m[1]));
  assert.deepEqual([...orders].sort((a, b) => a - b), [1, 2, 3, 4], "軸の並び順が1〜4ではありません");
});

check("討論が、分子・分母つきの算定軸になっている", () => {
  assert.match(profileSrc, /debateMeasurable/, "討論の算定判定がありません");
  assert.match(profileSrc, /numeratorLabel: "討論を行った会期"/);
  assert.match(profileSrc, /denominatorLabel: "討論が行われた会期"/);
  // 討論が1件も無かった会期を分母へ入れない（議員の行動と無関係に割合が下がるため）。
  assert.match(profileSrc, /討論が1件も行われなかった会期[^。]*は、分母にも分子にも入れません/);
  // 値は記録の一覧（debate-rate）から取り、二重に計算しない。
  assert.match(profileSrc, /record\.values\.find\(\(v\) => v\.key === "debate-rate"\)/);
  // 立場そのものを評価しないと明言していること。
  assert.match(profileSrc, /賛成か反対かという立場/);
});

check("討論の分母が、実際に討論が行われた会期だけで作られている", () => {
  const src = readSrc("src/lib/councilActivityBarometer.ts");
  assert.match(src, /debateHeldSessionIds/, "討論が行われた会期の集合がありません");
  // 対象期間内の会期に限っていること（定例会＋その間の臨時会）。
  assert.match(src, /radarEligibleSessions\.includes\(d\.sessionId\)/);
  assert.match(src, /extraordinarySessionIds\.has\(d\.sessionId\)/, "臨時会の討論を対象にしていません");
  // 議長を務めた会期は、討論の分母からも外す（一般質問と同じ扱い）。
  assert.match(src, /chairpersonSessionsFor\(memberId, debateHeldSessionIds\)/, "討論の分母で議長の会期を外していません");

  const data = readJson("src/data/councilDebateSpeeches.json");
  const status = readJson("src/data/questionCollectionStatus.json");
  const eligible = new Set(status.sessions.filter((x) => x.transcriptAvailable).map((x) => x.sessionId));
  const held = new Set(data.speeches.map((x) => x.sessionId).filter((id) => id && eligible.has(id)));
  assert.ok(held.size > 0, "討論が行われた会期が1つもありません（前提が変わった可能性）");
  assert.ok(
    held.size < eligible.size,
    "すべての会期で討論が行われた場合、分母を分ける意味が無くなります（前提の再確認が必要）",
  );
});

check("討論の記録が、発言ごとに一次資料へ辿れる", () => {
  const data = readJson("src/data/councilDebateSpeeches.json");
  assert.ok(data.speeches.length > 0, "討論の記録がありません");
  for (const sp of data.speeches) {
    assert.ok(sp.sourceUrl, `${sp.id} に出典URLがありません`);
    assert.ok(sp.memberId || sp.formerMemberId, `${sp.id} が議員と結び付いていません`);
    assert.ok(["for", "against", "mixed", "unclear"].includes(sp.stance), `${sp.id} の立場の値が不正です`);
    // 立場を確定したものには、必ず本文の根拠を添える。根拠なしの断定を許さない。
    if (sp.stance !== "unclear") {
      assert.ok(sp.stanceBasis, `${sp.id} は立場を確定しているのに根拠がありません`);
    }
  }
  // 修正案がある議案では、対象ごとに立場が分かれる。どちらかへ寄せていないこと。
  assert.ok(data.speeches.some((sp) => sp.stance === "mixed"), "mixed が1件も無いのは、どちらかへ寄せた疑いがあります");
  // 読み取れないものを無理に確定していないこと。
  assert.ok(
    data.speeches.some((sp) => sp.stance === "unclear"),
    "unclear が1件も無いのは、断定しすぎの疑いがあります",
  );
});

check("修正案が出ている議題では、立場の対象（原案・修正案）を確かめてから表示する", () => {
  const data = readJson("src/data/councilDebateSpeeches.json");
  for (const sp of data.speeches) {
    if (sp.amendmentOnFloor && sp.stance !== "mixed" && sp.stance !== "unclear") {
      assert.ok(
        ["original", "amendment", "unspecified"].includes(sp.stanceTarget),
        `${sp.id} は修正案が出ている議題なのに、対象を確かめていません`,
      );
    }
    if (sp.stanceTarget === "original" || sp.stanceTarget === "amendment") {
      assert.ok(sp.stanceTargetBasis, `${sp.id} は対象を確定しているのに本文の根拠がありません`);
      // 根拠の言い回しが、名指しした対象を実際に含んでいること。
      const names = sp.stanceTarget === "amendment" ? /修正案/ : /原案|市長案|当初予算案|市長提案の予算案|議案第/;
      assert.match(sp.stanceTargetBasis, names, `${sp.id} の根拠が対象を名指ししていません`);
    }
  }
  // 名指しが無いものを、どちらかへ寄せていないこと（1件以上残っているのが自然）。
  assert.ok(
    data.speeches.some((sp) => sp.stanceTarget === "unspecified"),
    "対象を特定できない討論が1件も無いのは、推測で埋めた疑いがあります",
  );
  // 画面の文言：対象を特定できないときは、そう書く。
  const barometer = readSrc("src/lib/councilActivityBarometer.ts");
  assert.match(barometer, /原案・修正案のどちらに対する/);
  // 立場の根拠は、議長の制止を挟んだ別の発言をまたいで引用しない。
  const extractor = readSrc("scripts/extract-council-debates.mjs");
  assert.match(extractor, /current\.text \+= `\\n\$\{u\.text\}`/, "続きの発言を区切らずに結合しています");
});

check("請願の紹介議員を、0件ではなく未確認として扱う", () => {
  const data = readJson("src/data/petitionIntroducers.json");
  assert.ok(data.records.length > 0, "確認できた紹介議員の記録がありません");
  for (const r of data.records) {
    assert.ok(["sole", "partial", "unnamed"].includes(r.completeness), `${r.billId} の網羅性の値が不正です`);
    assert.ok(r.sourceRefs?.length > 0, `${r.billId} に出典がありません`);
  }
  // どの資料に無かったのかを記録していること（調べていないのではない）。
  assert.ok(data.checkedSources?.length > 0, "調査した資料の記録がありません");
  const record = readSrc("src/lib/councilActivityRecord.ts");
  assert.match(record, /0件ではなく、確認できていないという意味です/);
});

check("議事進行の発言を討論として数えていない", () => {
  const src = readSrc("scripts/extract-council-debates.mjs");
  // 討論は登壇して行う。自席からの短いやり取りを討論に含めない。
  assert.match(src, /登壇〕/, "登壇の判定がありません");
  assert.match(src, /tookPodium/, "登壇の判定を使っていません");
  // 議長の発言を討論者として拾わない。
  assert.match(src, /isChairSpeaker/, "議事進行役の判定がありません");

  const data = readJson("src/data/councilDebateSpeeches.json");
  // 議長・市長などの発言が混ざっていないこと。
  for (const sp of data.speeches) {
    assert.ok(
      !/^(議長|副議長|市長|副市長|教育長)/.test(sp.speakerLabelAsWritten),
      `${sp.id} に議事進行役・執行部の発言が混ざっています`,
    );
  }
});

console.log(`\n${passCount}件成功\n`);

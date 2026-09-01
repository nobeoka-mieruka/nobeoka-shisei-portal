/**
 * Phase144：scripts/lib/bill-speech-parser.mjs（議案境界抽出・複数議案共通段落分離・
 * カテゴリ別抽出ルール）の単体テスト。実際の会議録テキストから採取した代表的な文面を
 * 小さな固定テキスト（fixture）として埋め込み、ネットワーク取得なしで検証する
 * （scripts/.cache/minutesのキャッシュに依存しない、再現性のあるテスト）。
 *
 * 使い方: node scripts/test-bill-speech-parser.mjs
 */
import assert from "node:assert/strict";
import { kanjiDigitsToNumber, findBillMarkers, splitSpeechIntoBillBlocks, extractCandidateFields } from "./lib/bill-speech-parser.mjs";

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

console.log("\n議案境界抽出パーサーの単体テスト");

check("漢数字（読み下し表記）を整数へ変換できる", () => {
  assert.equal(kanjiDigitsToNumber("一二九"), 129);
  assert.equal(kanjiDigitsToNumber("八二"), 82);
  assert.equal(kanjiDigitsToNumber("〇"), 0);
  assert.equal(kanjiDigitsToNumber("五"), 5);
});

check("単一議案の開始マーカー（次に、議案第◯号は、）を検出できる", () => {
  const text = "次に、議案第五五号は、専決処分の承認であります。";
  const markers = findBillMarkers(text);
  assert.equal(markers.length, 1);
  assert.equal(markers[0].kind, "individual");
  assert.deepEqual(markers[0].billNumbers, [55]);
});

check("複数議案の範囲マーカー（議案第◯号から議案第◯号までは）を検出できる", () => {
  const text = "議案第二八号から議案第三四号までは、決算の認定についてであります。";
  const markers = findBillMarkers(text);
  assert.equal(markers.length, 1);
  assert.equal(markers[0].kind, "range");
});

check("2番目の議案番号が「議案第」を伴わず「第」のみの範囲表記も検出できる（実データで確認された表記ゆれ）", () => {
  const text = "議案第一〇九号から第一一四号までの各特別会計並びに各企業会計予算について御説明いたします。";
  const markers = findBillMarkers(text);
  assert.equal(markers.length, 1, "範囲マーカーが検出できていません");
  assert.equal(markers[0].kind, "range");
  assert.deepEqual(markers[0].billNumbers, [109, 114]);
});

check("複数議案が同一段落を共有する場合、commonText（共通説明）とindividualText（個別説明）を分離する（項目3・4・5）", () => {
  const text =
    "議案第五二号及び議案第五三号は、工事請負契約の締結であります。" +
    "これらの工事は、学校施設の長寿命化改良事業として行うものであります。" +
    "まず、議案第五二号は、南小学校の工事請負契約の締結であります。" +
    "三者による入札の結果、Ａ社と六億千六百万円で契約を締結するものであります。" +
    "次に、議案第五三号は、土々呂中学校の工事請負契約の締結であります。" +
    "二者による入札の結果、Ｂ社と五億二千六百六十八万円で契約を締結するものであります。";
  const blocks = splitSpeechIntoBillBlocks(text);
  const b52 = blocks.get(52);
  const b53 = blocks.get(53);
  assert.ok(b52 && b53, "議案52号・53号のブロックが見つかりません");
  assert.equal(b52.commonText, b53.commonText, "共通説明が52号・53号で一致していません");
  assert.ok(b52.commonText.includes("学校施設の長寿命化改良事業"), "共通説明の内容が正しく抽出されていません");
  assert.ok(b52.individualText.includes("南小学校"), "52号固有の説明に南小学校の記述がありません");
  assert.ok(!b52.individualText.includes("土々呂中学校"), "52号固有の説明に53号（土々呂中学校）の内容が混入しています（文脈混入）");
  assert.ok(b53.individualText.includes("土々呂中学校"), "53号固有の説明に土々呂中学校の記述がありません");
  assert.ok(!b53.individualText.includes("南小学校"), "53号固有の説明に52号（南小学校）の内容が混入しています（文脈混入）");
});

check("専決処分：手続き理由（reason）と実質的な政策理由（secondaryReason）を分離して抽出する（項目6）", () => {
  const text =
    "次に、議案第五五号は、令和六年度延岡市一般会計補正予算に係る専決処分の承認であります。" +
    "本案は、緊急を要するために、地方自治法第百七十九条第一項の規定により、本年八月二十三日に専決処分を行いましたので、これを報告し、その承認を求めるものであります。" +
    "今回の補正は、歳入歳出それぞれ六億七千百六十一万八千円を追加し、予算総額を七百一億九千百二十九万八千円といたしました。" +
    "補正予算の内容でありますが、国の経済対策である給付支援策の対象世帯が明らかとなったことから、必要な予算を増額するものであります。";
  const blocks = splitSpeechIntoBillBlocks(text);
  const bill = blocks.get(55);
  const fields = extractCandidateFields(bill, "専決処分");
  assert.ok(fields.reason.includes("緊急を要する"), "手続き理由（緊急を要するため等）が抽出できていません");
  assert.ok(fields.reason.includes("専決処分"), "手続き理由に「専決処分」の語が含まれていません");
  assert.ok(!fields.reason.includes("給付支援策"), "手続き理由に政策理由（給付支援策）が混入しています（理由の二層構造が分離できていない）");
  assert.ok(fields.secondaryReason.includes("給付支援策"), "実質的な政策理由が抽出できていません");
  assert.ok(fields.amountRawText.includes("六億七千百六十一万八千円"), "金額が正しく抽出できていません（原文の桁表記のまま）");
});

check("Phase145で発見・修正したバグ：「令和元年度」（「元」は漢数字ではなく特別な読み）を含む予算・決算タイトルでもマーカーを正しく検出する（令和2〜8年度の「令和◯年度」パターンのみ対応していたため、令和元年度の議案が軒並み検出漏れしていた）", () => {
  const text = "議案第五号令和元年度延岡市一般会計補正予算は、歳入歳出それぞれ十二億八千百二万五千円を追加し、予算総額を五百九十七億八千九百十四万三千円といたしました。";
  const blocks = splitSpeechIntoBillBlocks(text);
  const block = blocks.get(5);
  assert.ok(block, "「令和元年度」を含む予算議案のブロックが検出できていません");
  const fields = extractCandidateFields(block, "予算", "令和元年度延岡市一般会計補正予算");
  assert.ok(fields.amountRawText?.includes("十二億八千百二万五千円"), "金額が抽出できていません");
});

check("Phase145で発見・修正したバグ：決算議案は審議される定例会が令和期でも対象年度（決算は前年度分）が平成期にまたがる場合があり（例：令和元年9月定例会の決算は「平成三十年度」）、そのマーカーも正しく検出する", () => {
  const text = "議案第二七号平成三十年度延岡市一般会計の決算額は、歳入総額五百九十七億千六百十四万六千九十二円に対しまして、歳出総額は五百八十億二百七十四万六千七百二十八円で、歳入歳出差引額は十七億千三百三十九万九千三百六十四円となっております。";
  const blocks = splitSpeechIntoBillBlocks(text);
  const block = blocks.get(27);
  assert.ok(block, "「平成三十年度」を含む決算議案のブロックが検出できていません");
  const fields = extractCandidateFields(block, "決算", "平成30年度延岡市一般会計歳入歳出決算の認定");
  assert.ok(fields.amountRawText?.includes("五百九十七億千六百十四万六千九十二円"), "決算額が抽出できていません");
});

check("Phase146で発見・修正したバグ：市長が1日の中で複数回登壇し、その都度「（降壇）」が現れる会議録（例：人事案件を単独提案していったん降壇し、改めて登壇して議案の概要をまとめて説明する）でも、最初の登壇分だけで打ち切らず、2回目以降の登壇分の議案も検出できる", () => {
  const text =
    "ただいま議題となりました議案につきまして、御説明申し上げます。\n" +
    "　議案第二五号は、固定資産評価審査委員会委員の選任でございます。\n" +
    "　本案は、委員が任期満了となりますので、その後任を選任するものでございます。\n" +
    "（降壇）\n" +
    "ただいま議題となりました議案の概要につきまして、御説明申し上げます。\n" +
    "　次に、議案第七号は、延岡市手数料条例の一部改正であります。\n" +
    "　本案は、関係法令の一部改正に伴い、所要の改正を行うものであります。\n" +
    "（降壇）";
  const blocks = splitSpeechIntoBillBlocks(text);
  assert.ok(blocks.get(25), "1回目の登壇分（議案第25号）のブロックが検出できていません");
  assert.ok(blocks.get(7), "「（降壇）」で打ち切られ、2回目の登壇分（議案第7号）のブロックが検出できていません（Phase146で発見した回帰）");
  const fields7 = extractCandidateFields(blocks.get(7), "条例", "延岡市手数料条例の一部を改正する条例の制定");
  assert.ok(fields7.reason?.includes("関係法令の一部改正"), "2回目の登壇分の理由が抽出できていません");
});

check("決算：対象会計・決算額を抽出し、一次資料に理由の記載が無ければreasonを推測で埋めない（項目7）", () => {
  const text =
    "議案第二九号令和五年度延岡市国民健康保険特別会計の決算額は、歳入総額百三十二億四千三百十八万九千二百三十円に対しまして、歳出総額は百三十一億七千四十九万四千六百八十五円であります。" +
    "歳入歳出差引額は、七千二百六十九万四千五百四十五円となり、同額実質収支額となっております。";
  const blocks = splitSpeechIntoBillBlocks(text);
  const bill = blocks.get(29);
  const fields = extractCandidateFields(bill, "決算");
  assert.ok(fields.what.includes("国民健康保険特別会計"), "対象会計が抽出できていません");
  assert.ok(fields.what.includes("百三十二億四千三百十八万九千二百三十円"), "決算額（原文の桁表記）が抽出できていません");
  assert.equal(fields.reason, null, "決算は理由の記載が無いのにreasonが推測で埋められています");
});

check("予算：複数会計の金額が1文にまとめて記載されている場合、該当する会計名の節だけを取り出す（項目8：文脈混入の防止）", () => {
  const text =
    "議案第一〇九号から第一一四号までの各特別会計並びに各企業会計予算について御説明いたします。" +
    "食肉センター特別会計予算は十万円で、前年度と同額、介護保険特別会計予算は百三十九億二千九十六万九千円で、前年度比二・〇％の減少、後期高齢者医療特別会計予算は十九億九千八百五十二万二千円で、前年度比八・二％の増加となっております。" +
    "初めに、議案第一一五号は、条例の制定であります。";
  const blocks = splitSpeechIntoBillBlocks(text);
  const bill111 = blocks.get(111);
  const fields111 = extractCandidateFields(bill111, "予算", "令和6年度延岡市介護保険特別会計予算");
  assert.ok(fields111.what.includes("介護保険特別会計予算は百三十九億二千九十六万九千円"), "介護保険の金額が抽出できていません");
  assert.ok(!fields111.what.includes("食肉センター"), "他会計（食肉センター）の記述が混入しています（文脈混入）");
  assert.ok(!fields111.what.includes("後期高齢者医療"), "他会計（後期高齢者医療）の記述が混入しています（文脈混入）");
});

check("既知の限界（Phase145で発見）：議案番号タグを一切伴わない会計名のみの予算説明（令和5年3月定例会の実例）は、マーカーが1件も検出されない。この場合、誤った議案へ内容を混入させるより「見つからない」ことを正直に返す（無理に何かを返さない）", () => {
  // 令和5年3月定例会（R050224A）の実際の言い回しを再現した最小fixture。
  const text = "その結果、令和五年度延岡市一般会計予算の規模は、六百六十八億六千八百万円で、前年度肉づけ後の予算額と比べ、二十三億七千六百五十六万四千円、伸び率三・七％の増加となっております。";
  const markers = findBillMarkers(text);
  assert.equal(markers.length, 0, "議案番号タグの無い文からマーカーが誤検出されています（想定外の挙動）");
  const blocks = splitSpeechIntoBillBlocks(text);
  assert.equal(blocks.size, 0, "議案番号タグの無い文からブロックが誤って生成されています（他議案への誤帰属のリスク）");
});

check("契約：目的（what）と、金額・入札方式・相手方を含む文（amountRawText）を分離して抽出する（項目9）", () => {
  const text = "次に、議案第六六号は、旧北川町塵芥処理施設解体撤去工事の請負契約の締結であります。条件付一般競争入札の結果、前田・高橋特定建設工事共同企業体と一億七千四十八万九千円で契約を締結するものであります。";
  const blocks = splitSpeechIntoBillBlocks(text);
  const bill = blocks.get(66);
  const fields = extractCandidateFields(bill, "契約");
  assert.ok(fields.what.includes("解体撤去工事"), "契約目的が抽出できていません");
  assert.ok(fields.amountRawText.includes("一億七千四十八万九千円") && fields.amountRawText.includes("前田・高橋特定建設工事共同企業体"), "契約金額・契約相手が抽出できていません");
});

check("財産取得：取得物・金額・相手方を、一次資料の文をそのまま抽出する（項目10、推測で補わない）", () => {
  const text = "まず、議案第一八号については、老朽化している小型動力ポンプ付水槽車を更新すべく、小型動力ポンプ付水槽車一台を取得するものであります。八者による指名競争入札を行った結果、尾崎ポンプ店から七千四百二十五万円で購入するものであります。";
  const blocks = splitSpeechIntoBillBlocks(text);
  const bill = blocks.get(18);
  const fields = extractCandidateFields(bill, "財産取得");
  assert.ok(fields.what.includes("小型動力ポンプ付水槽車"), "取得物が抽出できていません");
  assert.ok(fields.amountRawText.includes("七千四百二十五万円") && fields.amountRawText.includes("尾崎ポンプ店"), "金額・相手方が抽出できていません");
});

check("数値は原文の桁表記（漢数字混じりの日本語表記）のまま保持し、独自の単位変換を行わない（項目11・19：原文とdisplayValueの一致検証を可能にする）", () => {
  const text = "議案第二九号令和五年度延岡市国民健康保険特別会計の決算額は、歳入総額百三十二億四千三百十八万九千二百三十円に対しまして、歳出総額は百三十一億七千四十九万四千六百八十五円であります。";
  const blocks = splitSpeechIntoBillBlocks(text);
  const bill = blocks.get(29);
  const fields = extractCandidateFields(bill, "決算");
  // 千円／百万円等への変換を一切行っていないこと（「円」の原文表記のみを保持していること）を確認する。
  assert.ok(!/千円|百万円/.test(fields.amountRawText), "金額が千円・百万円等へ変換されています（原文は「円」表記のみ）");
  assert.ok(fields.amountRawText.includes("百三十二億四千三百十八万九千二百三十円"), "原文の桁表記がそのまま保持されていません");
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");

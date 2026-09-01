/**
 * Phase144：市長の議案提案理由説明（会議録の一続きのテキスト）を、議案ごとのブロックへ
 * 分割するための構造抽出器。Phase143の10件実証で判明した誤り原因（複数議案が同一段落に
 * 存在／専決処分の二層理由構造／本文切り出し範囲不足）を、単純な「議案第○号」から
 * 「次の議案第○号」までの機械的な範囲取得だけに頼らず、以下を組み合わせて解消する。
 *
 *  - 個別議案の開始（「次に、議案第○号は、」等）
 *  - 複数議案の一括見出し（「議案第○号から議案第○号までは、」「議案第○号及び議案第○号は、」等）
 *  - 決算専用の開始パターン（「議案第○号令和○年度延岡市○○の決算額は、」）
 *  - 一括見出しの直後に続く個別議案は、一括見出しをcommonReason、各個別ブロックを
 *    individualReasonとして分離する（項目5）。
 *
 * この抽出器は「一次資料の文をそのまま切り出す」ことしか行わない（項目18「空欄を埋めるAIに
 * しない」）。推測で文章を生成する処理は一切含まない。
 *
 * 【Phase145で発見した既知の限界（未対応）】
 * 令和5年3月定例会（第29回定例会、R050224A）の当初予算部分は、他の年度の当初予算説明と異なり、
 * 一般会計を含む全ての会計について「議案第◯号」という番号タグを一切伴わず、会計名と金額のみで
 * 説明する構成だった（例：「その結果、令和五年度延岡市一般会計予算の規模は、六百六十八億…」
 * のように、先頭に議案番号が付かない）。この変種は本抽出器のいずれのマーカーパターンでも
 * 検出できない（findBillMarkersが1件もマッチしない）。Phase145ではworker側で会計名の
 * 手動照合により個別に対応した（scratchpad/phase145/p145_worker3_results.jsonの
 * 2023-03-gian-108〜114参照）。既知の範囲では令和5年3月定例会のみで観測されており、
 * 頻度が低いため本抽出器自体の拡張は見送っている。同様の構成の会期を新たに発見した場合は、
 * この抽出器の拡張を検討すること。
 */

/** 漢数字（〇一二三四五六七八九のみ、桁区切りなしの読み下し表記）を整数へ変換する。 */
export function kanjiDigitsToNumber(kanjiStr) {
  const map = { "〇": 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  let out = "";
  for (const ch of kanjiStr) {
    if (!(ch in map)) return null;
    out += String(map[ch]);
  }
  return out.length > 0 ? Number(out) : null;
}

const KDIGIT = "[〇一二三四五六七八九]+";

/**
 * テキスト全体から、議案の開始マーカー（個別・一括・決算専用）をすべて検出し、
 * 出現位置順に並べて返す。
 * @returns {{index: number, matchLength: number, kind: "individual"|"kessan"|"range"|"and2"|"and3"|"comma2", billNumbers: number[]}[]}
 */
export function findBillMarkers(text) {
  const patterns = [
    // 一括：「議案第X号から議案第Y号までは/を/の」「…第Y号までの各特別会計…について説明申し上げます」
    // （2番目の番号は「議案第」「第」のいずれか、または省略の3通りの表記ゆれを実データで確認済み）。
    { kind: "range", re: new RegExp(`議案第(${KDIGIT})号から(?:議案第|第)?(${KDIGIT})号(?:まで)?(?:の|は|を)`, "g") },
    // 一括：「議案第X号、第Y号及び第Z号は」「議案第X号及び議案第Y号は」（2〜3件）
    { kind: "and3", re: new RegExp(`議案第(${KDIGIT})号、第(${KDIGIT})号及び(?:議案第)?第?(${KDIGIT})号は`, "g") },
    { kind: "and2", re: new RegExp(`議案第(${KDIGIT})号及び(?:議案第)?第?(${KDIGIT})号は`, "g") },
    // 一括：「議案第X号、第Y号は」（及び無し、カンマ区切りのみ）
    { kind: "comma2", re: new RegExp(`議案第(${KDIGIT})号、第(${KDIGIT})号は`, "g") },
    // 決算専用：「議案第X号[令和○年度]延岡市○○の決算額は、」
    { kind: "kessan", re: new RegExp(`議案第(${KDIGIT})号(?:令和${KDIGIT}年度)?延岡市[^、。]{0,24}?の決算額は、`, "g") },
    // 決算（企業会計の剰余金処分）専用：「議案第X号[令和○年度]延岡市○○剰余金の処分及び決算の認定について、」
    // （「の決算額は、」ではなく「について、説明申し上げます」で始まる表記を実データで確認済み）。
    { kind: "kessan_jouyokin", re: new RegExp(`議案第(${KDIGIT})号(?:令和${KDIGIT}年度)?延岡市[^、。]{0,30}?剰余金の処分及び決算の認定について、`, "g") },
    // 予算専用：「議案第X号[令和○年度]延岡市○○予算（の規模）は」（号と「は」の間に会計名等の
    // 名詞句が入り、一般の「号は、」パターンでは検出できないため専用パターンとする。「は、」の直後に
    // 読点が無い表記（「予算の規模は七百十一億…と、」等）も実データで確認済みのため、読点を必須にしない）。
    { kind: "budget", re: new RegExp(`議案第(${KDIGIT})号(?:令和${KDIGIT}年度)?延岡市[^、。]{0,30}?予算(?:の規模)?は`, "g") },
    // 個別：「（次に、|まず、|初めに、|続きまして、）議案第X号は、」
    // 「議案第X号については、」「議案第X号につきましても、」「議案第X号につきまして、」
    // （同一の説明の中でも表記が混在することを実データで確認済み）。
    { kind: "individual", re: new RegExp(`(?:次に、|まず、|初めに、|続きまして、)?議案第(${KDIGIT})号(?:については|につきましても|につきまして|は)、`, "g") },
  ];

  const matches = [];
  for (const { kind, re } of patterns) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      const billNumbers = m
        .slice(1)
        .filter((g) => g != null)
        .map(kanjiDigitsToNumber);
      matches.push({ index: m.index, matchLength: m[0].length, kind, billNumbers, matchText: m[0] });
    }
  }
  matches.sort((a, b) => a.index - b.index);

  // 同一開始位置（または極めて近接し包含関係にある）の重複検出を除去する：
  // 優先順位は range/and/comma（一括） > kessan > individual（一括見出しの一部を個別マーカーとして
  // 二重検出してしまう場合があるため、より広い一致を優先する）。
  const dedup = [];
  for (const m of matches) {
    const overlapping = dedup.find((d) => m.index >= d.index && m.index < d.index + d.matchLength);
    if (overlapping) continue;
    dedup.push(m);
  }
  dedup.sort((a, b) => a.index - b.index);
  return dedup;
}

/**
 * 議案番号→ブロック（commonReason・individualReason・生テキスト範囲）の対応表を作る。
 * @param {string} text 市長の提案理由説明の全文
 * @returns {Map<number, {billNumber: number, individualText: string, commonText: string|null,
 *   groupBillNumbers: number[]|null, sourceStart: number, sourceEnd: number}>}
 */
export function splitSpeechIntoBillBlocks(text) {
  const markers = findBillMarkers(text);
  const result = new Map();

  // 終了境界の候補（「以上、議案の概要であります。」「よろしく御審議」「（降壇）」等）で全体を打ち切る。
  const endMatch = text.match(/以上(?:が)?(?:、)?(?:議案の概要|補正予算の概要)であります。|よろしく御審議|（降壇）/);
  const hardEnd = endMatch ? endMatch.index : text.length;

  let currentGroup = null; // { billNumbers: number[], commonText: string }

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    if (marker.index >= hardEnd) break;
    const spanStart = marker.index;
    const spanEnd = i + 1 < markers.length ? markers[i + 1].index : hardEnd;
    const spanText = text.slice(spanStart, spanEnd).trim();

    if (marker.kind === "range" || marker.kind === "and2" || marker.kind === "and3" || marker.kind === "comma2") {
      let billNumbers;
      if (marker.kind === "range") {
        const [from, to] = marker.billNumbers;
        billNumbers = [];
        if (from != null && to != null && to - from < 200 && to >= from) {
          for (let n = from; n <= to; n++) billNumbers.push(n);
        }
      } else {
        billNumbers = marker.billNumbers.filter((n) => n != null);
      }
      currentGroup = { billNumbers, commonText: spanText };
      // 一括見出し自体（グループ全体に共通する議案名等）を、範囲内の各議案の暫定ブロックとして登録する
      // （直後に個別サブブロックが続かない議案＝範囲内だが個別説明の無い議案にも、最低限グループの
      // 共通説明だけは持たせるため。個別サブブロックが後で見つかれば上書きされる）。
      for (const n of billNumbers) {
        result.set(n, {
          billNumber: n,
          individualText: null,
          commonText: spanText,
          groupBillNumbers: billNumbers,
          sourceStart: spanStart,
          sourceEnd: spanEnd,
        });
      }
      continue;
    }

    // individual または kessan
    const billNumber = marker.billNumbers[0];
    if (billNumber == null) continue;
    const belongsToGroup = currentGroup && currentGroup.billNumbers.includes(billNumber);
    result.set(billNumber, {
      billNumber,
      individualText: spanText,
      commonText: belongsToGroup ? currentGroup.commonText : null,
      groupBillNumbers: belongsToGroup ? currentGroup.billNumbers : null,
      sourceStart: spanStart,
      sourceEnd: spanEnd,
    });
  }

  return result;
}

/**
 * 文単位に分割する（句点区切り）。ブロックの境界（次の議案マーカーの直前）で文が途中で
 * 切れた断片（「次に、」等、句点で終わらない末尾の残骸）は、意味のある文ではないため除外する。
 */
function splitSentences(text) {
  return (text ?? "")
    .split(/(?<=。)/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.endsWith("。"));
}

/**
 * 議案の件名（billTitle）から、会計の種類を表す名称（例：「水道事業会計」）を推定する。
 * 「令和○年度延岡市」等の接頭辞と「予算」「補正予算」等の接尾辞を取り除くだけの機械的な処理で、
 * 新しい情報を生成するものではない。推定できない場合はnullを返す。
 */
function guessAccountNameFromTitle(billTitle) {
  if (!billTitle) return null;
  let name = billTitle
    .replace(/^令和[0-9〇一二三四五六七八九]+年度/, "")
    .replace(/^延岡市/, "")
    .replace(/（[^）]*）$/, "")
    .replace(/(補正)?予算$/, "")
    .replace(/(特別会計|事業会計|会計)$/, "");
  name = name.trim();
  return name.length >= 2 ? name : null;
}

/**
 * 「AはP1で、BはP2、CはP3となっております。」のように、1つの文に複数の会計の金額が
 * まとめて記載されている場合、accountNameを含む節（クローズ）だけを取り出す。
 * 他の会計名を含む節（＝文脈混入の原因）を切り離すための処理であり、新しい文章は生成しない。
 * 該当する節が見つからない場合はnullを返す（文全体をそのまま使うと他会計の金額が混入するため、
 * 無理に文全体を返すことはしない）。
 */
function extractAccountClause(sentence, accountName) {
  if (!sentence || !accountName) return null;
  // 「○○（特別会計|事業会計）?予算は」または「○○会計（の予算）?は」の直前で文を分割する。
  const boundary = /(?<=、)(?=[^、。]{1,20}?(?:特別会計|事業会計|会計)?予算は)/g;
  const clauses = sentence.split(boundary);
  const found = clauses.find((c) => c.includes(accountName));
  return found ? found.trim() : sentence;
}

/**
 * 議案1件分のブロック（commonText・individualText）から、カテゴリ別のルールで
 * what/reason/mainChanges/amountRawText相当を抽出する。一次資料に無い項目はnullのままにする
 * （項目18）。
 * @param {{billNumber: number, individualText: string|null, commonText: string|null}} block
 * @param {string} category BillCategory（予算/契約/財産取得/決算/専決処分等）
 * @param {string} [billTitle] 議案名（複数会計の一括説明段落から該当会計名を検索するために使用）
 */
export function extractCandidateFields(block, category, billTitle) {
  const individual = block.individualText ?? "";
  const common = block.commonText ?? "";
  const sentences = splitSentences(individual);
  const commonSentences = splitSentences(common);

  const amountSentences = [...commonSentences, ...sentences].filter((s) => /円/.test(s));

  // 予算：個別マーカーが見つからず（sentences==空）、一括見出し（common）の中に、
  // 各会計名を列挙する形で金額が書かれている場合（例：「水道事業会計予算は四十一億…」）、
  // 議案名から会計名を推定し、その名称を含む文だけを抽出する（項目8：予算の専用ルール）。
  // 会計名で一致する文が見つからない場合は、無理に埋めずnullのままにする。
  if (category === "予算" && sentences.length === 0 && common) {
    const accountName = guessAccountNameFromTitle(billTitle);
    const matchSentence = accountName ? commonSentences.find((s) => s.includes(accountName) && /円/.test(s)) : null;
    // 1つの文に複数の会計（例：食肉センター・介護保険・後期高齢者医療）の金額がまとめて
    // 記載されている場合、そのまま採用すると他の会計の金額まで自分の議案の説明として
    // 混入してしまう（文脈混入）。「○○（特別会計|事業会計）?予算は」を境目に文を分割し、
    // 該当する会計名を含む節（クローズ）だけを取り出す。
    const clause = matchSentence ? extractAccountClause(matchSentence, accountName) : null;
    return {
      what: clause,
      reason: null,
      amountRawText: clause,
      amountSentences: clause ? [clause] : [],
      accountNameGuess: accountName,
    };
  }

  if (category === "専決処分") {
    // 専決処分の二層構造：手続き理由（緊急を要するため...専決処分を行った）と、
    // 実質的な政策理由（補正の内容・目的）を分離して抽出する（項目6）。
    const proceduralReason = sentences.find((s) => s.startsWith("本案は") && /専決処分/.test(s)) ?? null;
    const whatSentence = sentences.find((s) => /専決処分の承認であります/.test(s)) ?? sentences[0] ?? null;
    const amountLine = sentences.find((s) => /追加し|増額し|としました|といたしました/.test(s) && /円/.test(s)) ?? null;
    // 政策理由：手続き理由の文以降で、「（この）補正（予算）の内容は/ですが/でありますが」等の
    // 導入表現を含む文（無ければnull、推測しない）。表記ゆれ（「この」の有無、「ですが」「でありますが」
    // 「は、」）を実データで確認済み。
    const substantiveReason = sentences.find((s) => /^(?:この)?補正(?:予算)?の内容(?:でありますが|ですが|は)、/.test(s)) ?? null;
    return {
      what: whatSentence,
      reason: proceduralReason,
      secondaryReason: substantiveReason,
      amountRawText: amountLine,
      amountSentences,
    };
  }

  if (category === "決算") {
    // 決算：対象会計・対象年度・決算額・認定を求める旨を構造化する（項目7）。
    // 「…剰余金の処分及び決算の認定について、説明申し上げます。」のような、内容を含まない
    // 予告文が先頭に来る場合（kessan_jouyokinパターン）は、実際に数値を含む最初の文を
    // whatとして採用する（予告文をそのまま「何を決める議案か」として使わない）。
    const isAnnouncementOnly = sentences[0] != null && !/円/.test(sentences[0]) && /について、説明申し上げます。$/.test(sentences[0]);
    const whatSentence = isAnnouncementOnly ? (sentences.find((s) => /円/.test(s)) ?? sentences[0]) : (sentences[0] ?? null);
    return {
      what: whatSentence,
      reason: null, // 決算は「理由」ではなく実績報告のため、一次資料に理由記載が無ければnullのまま
      amountRawText: whatSentence,
      amountSentences: sentences.filter((s) => /円/.test(s)),
    };
  }

  if (category === "予算") {
    const whatSentence = sentences.find((s) => /円/.test(s)) ?? sentences[0] ?? null;
    // 「以上が、○○の概要であります。」「よろしく御審議…」等、複数議案の一括説明全体を締めくくる
    // 定型の結び文は、個々の議案固有の理由ではないため除外する。
    const isClosingBoilerplate = (s) =>
      /^以上/.test(s) || /概要であります。$/.test(s) || /よろしく御審議/.test(s) || /次に、.{0,10}議案の概要につきまして、説明を申し上げます。$/.test(s);
    const reasonSentences = sentences.filter((s) => !/円/.test(s) && s !== whatSentence && !isClosingBoilerplate(s));
    return {
      what: sentences[0] ?? null,
      reason: reasonSentences[0] ?? null,
      amountRawText: whatSentence,
      amountSentences: sentences.filter((s) => /円/.test(s)),
    };
  }

  if (category === "契約" || category === "財産取得") {
    // 契約・財産取得：目的/対象（what）と、金額・相手方・方式を含む文（amount）を分離する（項目9・10）。
    const whatSentence = sentences.find((s) => !/円/.test(s)) ?? sentences[0] ?? null;
    const amountSentence = sentences.find((s) => /円/.test(s)) ?? null;
    // 理由（なぜ必要か）：
    // - 一括見出し（common）がある場合：「ため」「図る」等の目的表現を含む文を優先する
    //   （見出し文そのもの＝announcementだけを理由にしない）。
    // - 一括見出しが無い場合：individual内の「what」でも「amount」でもない中間文で、
    //   「ため」「ことから」「見込まれる」等の説明的表現を含むものがあれば採用する（無ければnull）。
    // 「追認」（本来は事前の議決が必要な事案について、事後に承認を求めること）のような
    // 法的に重要な性質を示す語は、一括見出し文（先頭文）に現れることが多いため優先的に拾う。
    const commonReasonBase = common
      ? (commonSentences.find((s) => /追認|撤回/.test(s)) ??
        commonSentences.find((s) => /ため|図る|ことから/.test(s)) ??
        commonSentences.find((s) => !/円/.test(s)) ??
        null)
      : null;
    // 一括見出しの締めくくりに「おわび」等の重要な経緯（例：手続き上の不備の説明）がある場合、
    // 一次資料の文をそのまま（要約せず）追記する。複数センテンスの結合であり、新たな文章の
    // 生成ではない（項目18）。
    const apologySentence = common ? commonSentences.find((s) => /おわび/.test(s)) : null;
    const reasonFromCommon =
      commonReasonBase && apologySentence && commonReasonBase !== apologySentence
        ? `${commonReasonBase}${apologySentence}`
        : (commonReasonBase ?? apologySentence ?? null);
    const reasonFromIndividual = !common
      ? (sentences.find((s) => s !== whatSentence && s !== amountSentence && /ため|ことから|見込まれる|しており/.test(s)) ?? null)
      : null;
    return {
      what: whatSentence,
      reason: reasonFromCommon ?? reasonFromIndividual,
      amountRawText: amountSentence,
      amountSentences: sentences.filter((s) => /円/.test(s)),
    };
  }

  // その他カテゴリ：単純な最初の文をwhat、"本案は"文をreasonとする（Phase143相当のフォールバック）。
  const reason = sentences.find((s) => s.startsWith("本案は")) ?? null;
  return { what: sentences[0] ?? null, reason, amountRawText: null, amountSentences };
}

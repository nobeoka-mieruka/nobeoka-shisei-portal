/**
 * 「議案等審議結果」PDFの本文テキストから、議案・意見書・決議・請願・陳情の
 * 議案番号・件名・結果・議決日を抽出するための解析ロジック。
 *
 * このPDFには議員別の賛否は記載されていない（一覧表形式の結果サマリーのみ）。
 * そのため、ここで抽出できるのは案件単位の情報のみで、議員別賛否・複数採決段階の
 * 抽出はこのバージョンでは行わない（型・データ構造上は将来拡張できるようにしてある）。
 *
 * 安全のための基本方針：
 * - 既知のキーワードに一致しない結果は"確認中"とし、絶対に推測で分類しない。
 * - 議案番号・件名・結果・議決日のいずれかが明確に取れない場合は
 *   呼び出し側でpendingReviewとして扱えるよう、理由(unresolvedReason)を必ず返す。
 */

const RECORD_TYPES = [
  { prefix: "議案第", type: "gian", idSlug: "gian", isBill: true },
  { prefix: "意見書第", type: "ikensho", idSlug: "ikensho", isBill: true },
  { prefix: "決議第", type: "ketsugi", idSlug: "ketsugi", isBill: true },
  { prefix: "請願第", type: "seigan", idSlug: "seigan", isBill: true },
  { prefix: "陳情第", type: "chinjo", idSlug: "chinjo", isBill: true },
  { prefix: "報告第", type: "houkoku", idSlug: "houkoku", isBill: false },
];

// 長い（より具体的な）パターンを短いパターンより先に並べること（例: "不採択"は"採択"より先）。
// 水道・下水道事業会計等の「剰余金の処分及び決算の認定」議案は、可決／認定（または否決／不認定）が
// 1件の議案として一体で議決されるため、公式資料の複合表記をそのままcanonical値として扱う
// （個別の"認定"等より先に判定できるよう、同じ先頭文字を持つ短い語より前に置く）。
const RESULT_KEYWORD_MAP = [
  ["原案可決及び認定", "原案可決及び認定"],
  ["否決及び不認定", "否決及び不認定"],
  ["不採択", "不採択"],
  ["一部採択", "一部採択"],
  ["趣旨採択", "趣旨採択"],
  ["採択", "採択"],
  ["不同意", "不同意"],
  ["原案同意", "同意"],
  ["同意", "同意"],
  ["原案可決", "原案可決"],
  ["修正可決", "修正可決"],
  ["否決", "否決"],
  ["継続審査", "継続審査"],
  ["取下げ", "撤回"],
  ["撤回", "撤回"],
  ["廃案", "廃案"],
  ["不認定", "不認定"],
  ["認定", "認定"],
  ["不承認", "不承認"],
  ["承認", "承認"],
];
const RESULT_KEYWORD_RE = new RegExp(RESULT_KEYWORD_MAP.map(([k]) => k).join("|"), "g");

/**
 * 「結果」欄は件名の直後・末尾に現れる。件名の中に結果キーワードと同じ語（例：
 * 「…決算の認定」という件名と「認定」という結果欄が連続する場合）が含まれることがあるため、
 * 最初に見つかった一致ではなく、最後に見つかった一致を結果として採用する。
 */
function findLastResultMatch(span) {
  RESULT_KEYWORD_RE.lastIndex = 0;
  let match;
  let last;
  while ((match = RESULT_KEYWORD_RE.exec(span))) last = match;
  return last;
}

const SECTION_MARKER_RE = /【([^】]+)】/g;
const RECORD_MARKER_RE = new RegExp(`(${RECORD_TYPES.map((t) => t.prefix).join("|")})(\\d+)号`, "g");
const DATE_RE = /(\d{1,2})月(\d{1,2})日/;

export function zenkakuDigitsToHankaku(s) {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

function findSectionMarkers(text) {
  const markers = [];
  let m;
  const re = new RegExp(SECTION_MARKER_RE);
  while ((m = re.exec(text))) markers.push({ index: m.index, label: m[1] });
  return markers;
}

function sectionAt(markers, index) {
  let current;
  for (const m of markers) {
    if (m.index <= index) current = m;
    else break;
  }
  return current?.label;
}

/** 案件分類を機械的に判定する。判定できない場合は"その他"を返す（推測で細分類しない）。 */
export function classifyCategory(recordType, title) {
  if (recordType === "ikensho") return "意見書";
  if (recordType === "ketsugi") return "決議";
  if (recordType === "seigan") return "請願";
  if (recordType === "chinjo") return "陳情";
  if (!title) return "不明";
  if (/専決処分/.test(title)) return "専決処分";
  if (/条例/.test(title)) return "条例";
  if (/決算/.test(title)) return "決算";
  if (/予算/.test(title)) return "予算";
  if (/契約|工事請負/.test(title)) return "契約";
  if (/財産の取得/.test(title)) return "財産取得";
  if (/選任|委員の同意|副市長|教育委員/.test(title)) return "人事";
  return "その他";
}

// 「議案等審議結果」PDFの見出し【市長提出議案】【議員提出議案】【委員会提出議案】【陳情】【請願】は、
// 誰がこの案件を提出したかを公式資料自身が明記したものなので、この対応関係は推測ではなく直接の抽出結果として扱う。
const PROPOSER_TYPE_BY_SECTION = {
  市長提出議案: { proposerType: "mayor", proposer: "市長" },
  議員提出議案: { proposerType: "member", proposer: undefined },
  委員会提出議案: { proposerType: "committee", proposer: undefined },
  陳情: { proposerType: "other", proposer: undefined },
  請願: { proposerType: "other", proposer: undefined },
};

/** 見出しラベル（空白除去済み）から提出者区分を判定する。未知の見出しの場合はundefinedを返す（推測しない）。 */
export function proposerInfoFromSection(sectionLabel) {
  return PROPOSER_TYPE_BY_SECTION[sectionLabel];
}

export function buildProposalId(sessionId, recordType, num) {
  const def = RECORD_TYPES.find((t) => t.type === recordType);
  return `${sessionId}-${def.idSlug}-${num}`;
}

export function canonicalBillNumber(recordType, num) {
  const def = RECORD_TYPES.find((t) => t.type === recordType);
  return `${def.prefix}${num}号`;
}

/**
 * 1ページ分の正規化済みテキスト（空白除去済み）から、案件レコードを抽出する。
 * @param {string} normalizedText 空白を除去したページ全文
 * @param {number} sessionCalendarYear 議決日のyear推定に使う暦年（このPDFには年が明記されない行があるため）
 * @param {number} pageNumber
 * @returns {Array<object>} 抽出レコード配列（報告第は含まない）
 */
export function extractRecordsFromPage(normalizedText, sessionCalendarYear, pageNumber) {
  const text = zenkakuDigitsToHankaku(normalizedText);
  const sectionMarkers = findSectionMarkers(text);
  // 「再議」（議決のやり直し）のページは、通常の一覧表ではなく経緯説明文や議員別賛否表を含む
  // 特殊な構成になっており、通常のパーサーでは件名等を正しく切り出せない。誤った内容を公開
  // しないよう、該当ページから抽出したレコードはすべて要確認とする（自動公開しない）。
  const hasReconsideration = /再議/.test(text);

  const recordMatches = [];
  const re = new RegExp(RECORD_MARKER_RE);
  let m;
  while ((m = re.exec(text))) {
    const def = RECORD_TYPES.find((t) => t.prefix === m[1]);
    recordMatches.push({ index: m.index, endIndex: re.lastIndex, type: def.type, isBill: def.isBill, num: m[2] });
  }

  const sectionBoundaries = sectionMarkers.map((s) => s.index);
  const records = [];

  for (let i = 0; i < recordMatches.length; i++) {
    const cur = recordMatches[i];
    if (!cur.isBill) continue; // 報告第：議決の対象ではないため対象外（除外判定はレコード種別の接頭辞のみで行う。
    // 【市長報告】等のセクション見出しは、該当セクションが空の場合に複数連続して現れることがあり
    // （例："【委員会提出議案】【議員提出議案】【陳情】【市長報告】"の直後に別セクションの議案が続く）、
    // 見出しの直近一致だけでは所属セクションを正しく特定できないため、除外判定には使わない。

    const section = sectionAt(sectionMarkers, cur.index);

    // このレコードの範囲は、直後の(a)次のレコード開始位置 (b)次のセクション区切り のうち近い方まで。
    const nextRecordIndex = recordMatches[i + 1]?.index ?? Infinity;
    const nextSectionIndex = sectionBoundaries.find((idx) => idx > cur.index) ?? Infinity;
    const spanEnd = Math.min(nextRecordIndex, nextSectionIndex, text.length);
    const span = text.slice(cur.endIndex, spanEnd);

    const resultMatch = findLastResultMatch(span);
    const record = {
      pageNumber,
      recordType: cur.type,
      billNumber: canonicalBillNumber(cur.type, cur.num),
      proposalNumRaw: cur.num,
      section,
      rawSpan: span,
      title: null,
      resultRaw: null,
      result: null,
      votingDate: null,
      unresolvedReasons: [],
    };

    if (!resultMatch) {
      record.title = span.trim() || null;
      record.unresolvedReasons.push("結果を示すキーワードが見つかりませんでした");
    } else {
      const [, canonicalResult] = RESULT_KEYWORD_MAP.find(([k]) => k === resultMatch[0]);
      record.title = span.slice(0, resultMatch.index).trim();
      record.resultRaw = resultMatch[0];
      record.result = canonicalResult;
      const tail = span.slice(resultMatch.index + resultMatch[0].length);
      const dateMatch = DATE_RE.exec(tail);
      if (dateMatch) {
        const month = Number(dateMatch[1]);
        const day = Number(dateMatch[2]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          record.votingDate = `${sessionCalendarYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
      if (!canonicalResult) {
        record.unresolvedReasons.push(`未知の結果表現です: "${resultMatch[0]}"`);
      }
    }

    if (!record.title) record.unresolvedReasons.push("件名を特定できませんでした");
    // 「再議」「討論の詳細」等、通常の一覧表以外の説明文が混入すると、件名が異常に長くなったり
    // 表構造由来の記号（【】＜＞等）が残ったりする。正規の件名は、複数条例を一括改正する
    // 長い件名（実データで最長83字程度）でも100字は超えないため、それを上回る場合は
    // 自動抽出の誤りを疑い、推測で公開せずpendingReviewへ回す。
    if (record.title && record.title.length > 100) {
      record.unresolvedReasons.push(
        `件名が異常に長く、表以外の説明文（再議の経緯等）を誤って抽出した可能性があります（${record.title.length}文字）`,
      );
    }
    if (record.title && /[【】＜＞]/.test(record.title)) {
      record.unresolvedReasons.push("件名に見出し記号（【】＜＞等）が含まれており、抽出の誤りの可能性があります");
    }
    if (hasReconsideration) {
      record.unresolvedReasons.push(
        "このページには「再議」に関する記述が含まれており、通常の一覧表と構成が異なるため自動抽出の精度が保証できません",
      );
    }
    record.category = classifyCategory(cur.type, record.title ?? "");

    records.push(record);
  }

  return records;
}

/**
 * 延岡市議会「会議録検索システム」（https://www.kensakusystem.jp/nobeoka/）から
 * 公式会議録本文を取得するための低レベル関数群。
 *
 * 2026年8月の調査で、以下が実際のHTTPレスポンスと照合して確認できた（推測ではない）：
 * - ドメインは www. 付き（www.kensakusystem.jp）でアクセスする。www無しはTLS証明書の
 *   ホスト名不一致でハンドシェイクに失敗する環境がある。
 * - 全ページ Shift_JIS（メタタグ上はcharset=Shift_JIS／HTTPヘッダはcharset=shift-jis）。
 *   UTF-8として扱うと文字化けする。
 * - Cookie・セッション状態は不要。全リクエストがCookieなしで成功する（GET/POSTとも）。
 * - <meta name="robots" content="follow,index"> が設定されており、クロール自体は許可されている。
 * - 会期の選択は See.exe への「木構造」ナビゲーション（POSTフォーム、treedepthを
 *   段階的に指定）で行う。1階層目（年）→2階層目（定例会・臨時会名）の2回のPOSTで、
 *   本会議日ごとの fileName（例: "R080216A" = 令和8年2月16日）が判明する。
 * - r_Speakers.exe に fileName を渡すと、その本会議日の発言が「発言順・発言者付き」で
 *   すべて列挙される（No.1, No.2, ... と、各発言の開始位置=downloadPos）。
 * - GetText3.exe に fileName と開始位置(pos)を渡すと、その発言セグメントの本文だけが
 *   返る（他の発言者の発言は混入しない）。
 * - 質問と答弁は、r_Speakers.exeが返す発言順序（No.順）どおりに対応している
 *   （例: 議員の発言の直後に市長・部長等の発言が続く）。
 *
 * 未確認・today's TODO：
 * - See.exeの木構造ナビゲーション（年→会期の2階層）の自動化（本モジュールでは
 *   fileNameを既知として渡す前提の関数のみ実装。年→会期の自動探索は今後の課題）。
 * - キーワード検索（Search2.exe）は未調査。
 * - 議員名の表記ゆれ（敬称の有無、姓名の間のスペース等）の正規化ルールは今後精査する。
 */
import iconv from "iconv-lite";

const BASE = "https://www.kensakusystem.jp/nobeoka";
const USER_AGENT = "Mozilla/5.0 (compatible; NobeokaShiseiPortalBot/1.0; +https://nobeoka-shisei-portal.pages.dev/about)";
const MIN_REQUEST_INTERVAL_MS = 2000;

let lastRequestAt = 0;
async function throttle() {
  const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

/** Shift_JIS文字列をパーセントエンコードする（バイト単位、大文字16進）。URLのクエリ部分の構築に使う。 */
function sjisPercentEncode(str) {
  const buf = iconv.encode(str, "Shift_JIS");
  let out = "";
  for (const b of buf) {
    if ((b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b === 0x2d || b === 0x2e || b === 0x5f || b === 0x7e) {
      out += String.fromCharCode(b);
    } else {
      out += `%${b.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return out;
}

async function fetchWithRetry(url, init, retries = 2) {
  await throttle();
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, ...(init?.headers ?? {}) } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "";
      return { status: res.status, contentType, buf };
    } catch (e) {
      lastError = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastError;
}

function decodeSjis(buf) {
  const text = iconv.decode(buf, "Shift_JIS");
  return text;
}

/** 文字化け（デコード失敗）の簡易検査。置換文字や制御文字の異常な多さで判定する。 */
export function looksGarbled(text) {
  if (!text) return true;
  const replacementCount = (text.match(/�/g) ?? []).length;
  if (replacementCount > 0) return true;
  const hasJapanese = /[぀-ヿ一-鿿]/.test(text);
  return !hasJapanese;
}

/**
 * 指定した会期（年＋会期名の完全一致）の、本会議日一覧を取得する。
 * See.exeの木構造ナビゲーション（年→会期の2階層POST）を自動化したもの。
 * @param {{code: string, year: string, sessionLabel: string}} params
 *   year例: "令和 8年"（全角スペース区切りに注意。公式サイトの表記に合わせる）
 *   sessionLabel例: "令和 8年 第24回定例会 "（末尾の全角/半角スペースも公式サイトの実際の値に合わせる）
 */
export async function listMeetingDays({ code, sessionLabel }) {
  const body = `Code=${code}&treedepth=${sjisPercentEncode(sessionLabel)}&page=&fileName=`;
  const { buf } = await fetchWithRetry(`${BASE}/cgi-bin3/See.exe`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const html = decodeSjis(buf);
  const days = [];
  const re = /ResultFrame\.exe\?Code=([^&]+)&fileName=([^&]+)&startPos=0"[\s\S]*?>（([^）]+)）</g;
  let m;
  while ((m = re.exec(html))) {
    days.push({ code: m[1], fileName: m[2], label: `（${m[3]}）` });
  }
  return days;
}

async function postTreedepth(code, treedepth) {
  const body = `Code=${code}&treedepth=${sjisPercentEncode(treedepth)}&page=&fileName=`;
  const { buf } = await fetchWithRetry(`${BASE}/cgi-bin3/See.exe`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return decodeSjis(buf);
}

/** See.exeのHTMLから、左サイドバーの「年（またはグループ）」タブ一覧を取得する。 */
function parseYearTabs(html) {
  const re = /treedepth\.value='([^']+)'"><IMG SRC="[^"]*" BORDER="0" ALT="([^"]*)">/g;
  const tabs = [];
  let m;
  while ((m = re.exec(html))) tabs.push({ treedepth: m[1], altLabel: m[2] });
  return tabs;
}

/** "令和 8年" → 2026、"令和 5年～令和 7年" → {fromYear: 2023, toYear: 2025}。令和のみ対応（平成以前は今回対象外）。 */
function parseYearRange(altLabel) {
  const nums = [...altLabel.matchAll(/令和\s*(元|\d+)年/g)].map((m) => (m[1] === "元" ? 1 : Number(m[1])));
  if (nums.length === 0) return null;
  const toCalendarYear = (eraNum) => eraNum + 2018;
  const years = nums.map(toCalendarYear);
  return { fromYear: Math.min(...years), toYear: Math.max(...years) };
}

/**
 * 指定した西暦年に対応する、See.exeの「年」treedepth値を解決する（サイドバーのタブを実際に
 * 解析して求める。値を推測で組み立てない）。令和5年〜令和8年の範囲で動作確認済み。
 * @param {{code: string, year: number}} params
 */
export async function resolveYearTreedepth({ code, year }) {
  const eraNum = year - 2018;
  const targetLabel = eraNum === 1 ? "令和元年" : `令和 ${eraNum}年`;

  const rootHtml = await fetchWithRetry(`${BASE}/cgi-bin3/See.exe?Code=${code}`, {}).then(({ buf }) => decodeSjis(buf));
  let tabs = parseYearTabs(rootHtml);

  const direct = tabs.find((t) => t.altLabel === targetLabel);
  if (direct) return direct.treedepth;

  for (const t of tabs) {
    const range = parseYearRange(t.altLabel);
    if (range && year >= range.fromYear && year <= range.toYear) {
      const groupHtml = await postTreedepth(code, t.treedepth);
      const innerTabs = parseYearTabs(groupHtml);
      const innerMatch = innerTabs.find((it) => it.altLabel === targetLabel);
      if (innerMatch) return innerMatch.treedepth;
      if (t.treedepth === targetLabel) return t.treedepth;
    }
  }
  throw new Error(`年 ${year} に対応するタブが見つかりませんでした（令和5年〜令和8年の範囲で確認済み）`);
}

/** 会期ラベル（例: "令和 7年 第15回臨時会"）から、回次・区分を抽出する。 */
function parseSessionLabel(label) {
  const m = label.match(/第(\d+)回(定例会|臨時会)/);
  return m ? { sessionNumber: `第${m[1]}回`, sessionType: m[2] } : { sessionNumber: undefined, sessionType: undefined };
}

/**
 * 指定した西暦年の、会期（定例会・臨時会）一覧を取得する。
 * @param {{code: string, year: number}} params
 * @returns {Promise<{treedepth: string, label: string, sessionNumber?: string, sessionType?: string}[]>}
 */
export async function listSessionsForYear({ code, year }) {
  const yearTreedepth = await resolveYearTreedepth({ code, year });
  const html = await postTreedepth(code, yearTreedepth);
  const re = /treedepth\.value='([^']+)'"><IMG SRC="\/nobeoka\/image\/(?:r|down)\.gif"[^>]*>([^<]*)<\/A>/g;
  const sessions = [];
  let m;
  while ((m = re.exec(html))) {
    const label = m[2].trim();
    sessions.push({ treedepth: m[1], label, ...parseSessionLabel(label) });
  }
  return sessions;
}

/**
 * 指定した本会議日（fileName）の、発言セグメント一覧（発言順・発言者・開始位置）を取得する。
 * 本文そのものは含まない（プレビュー抜粋のみ）。本文はfetchSegmentText()で別途取得する。
 * @param {{code: string, fileName: string}} params
 * @returns {Promise<{meetingTitle: string, segments: {order: number, pos: number, speakerLabel: string}[]}>}
 */
export async function listSpeakerSegments({ code, fileName }) {
  const url = `${BASE}/cgi-bin3/r_Speakers.exe?${code}/${fileName}/0/0//10/1/3:0/654/1//0/0/0`;
  const { buf } = await fetchWithRetry(url, {});
  const html = decodeSjis(buf);
  // r_Speakers.exeの<title>は固定文言（"会議録の閲覧と検索"）で会議名を含まないため使わない。
  // 会議名が必要な場合はfetchMeetingTitle()、またはfetchSegmentText()が返すtitleを使うこと。

  const segments = [];
  const re = /downloadPos"\s*value="(\d+)"[\s\S]{0,400}?r_TextFrame\.exe\?[^"]*\/(\d+)\/0\/\/10\/1\/654\/\/0\/0\/0"\s*TARGET="TEXTW"><font class="TEXT5">([^<]*)<font>/g;
  let m;
  let order = 0;
  while ((m = re.exec(html))) {
    order++;
    segments.push({ order, pos: Number(m[2]), speakerLabel: m[3].trim() });
  }
  return { segments };
}

/**
 * 本会議日（fileName）の正式な会議名（例: "令和 8年第24回定例会（第1号 2月16日）"）を取得する。
 * ResultFrame.exeの<TITLE>から取得する（この値は正確であることを確認済み）。
 */
export async function fetchMeetingTitle({ code, fileName }) {
  const url = `${BASE}/cgi-bin3/ResultFrame.exe?Code=${code}&fileName=${fileName}&startPos=0`;
  const { buf } = await fetchWithRetry(url, {});
  const html = decodeSjis(buf);
  const titleMatch = html.match(/<TITLE>([\s\S]*?)<\/TITLE>/i);
  return titleMatch ? titleMatch[1].trim() : "";
}

/**
 * GetText3.exeが返す生HTML（Shift_JISデコード後の文字列）から、本文とタイトルを抽出する。
 * ヘッダー・フッター・script・style・br要素の変換など、HTML本文抽出（正規化）の中心ロジック。
 * @param {string} html デコード済みHTML文字列
 * @returns {{text: string, title: string}}
 */
export function parseSegmentTextHtml(html) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  // タイトルは「会議名 発言者ラベル」の形式。会議名部分を除いた末尾を発言者ラベルとして推定する
  // （呼び出し側でlistSpeakerSegments()のspeakerLabelと突き合わせて確認することを推奨）。
  const title = titleMatch ? titleMatch[1].trim() : "";

  const bodyMatch = html.match(/<FONT class="TEXT2">([\s\S]*?)<\/FONT>/i);
  const raw = bodyMatch ? bodyMatch[1] : "";
  const text = raw
    .replace(/<BR>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, title };
}

/**
 * 発言セグメント1件分の本文を取得する（fetch + parseSegmentTextHtml）。
 * @param {{code: string, fileName: string, pos: number}} params
 * @returns {Promise<{text: string, title: string, fetchedAt: string, sourceUrl: string, rawHtml: string}>}
 */
export async function fetchSegmentText({ code, fileName, pos }) {
  const sourceUrl = `${BASE}/cgi-bin3/GetText3.exe?${code}/${fileName}/${pos}/10/1//0/0`;
  const { buf } = await fetchWithRetry(sourceUrl, {});
  const rawHtml = decodeSjis(buf);
  const { text, title } = parseSegmentTextHtml(rawHtml);
  return { text, title, fetchedAt: new Date().toISOString(), sourceUrl, rawHtml };
}

/**
 * 発言者ラベル（例: "前田遼君" "市長（三浦久知君）"）から、種別と（判別できれば）氏名を推定する。
 * 議員かどうかの確定にはmembers.jsonとの突き合わせが必要（このモジュールでは行わない）。
 */
export function classifySpeakerLabel(label) {
  const officialTitles = ["市長", "副市長", "教育長", "選挙管理委員会委員長", "監査委員"];
  for (const title of officialTitles) {
    if (label.startsWith(title)) return { speakerType: title === "市長" ? "mayor" : "official", title };
  }
  if (/部長|課長|局長|次長|事務局長/.test(label)) return { speakerType: "official", title: label.replace(/（.*/, "") };
  if (label.startsWith("議長") || label.startsWith("副議長")) return { speakerType: "chair", title: label.replace(/（.*/, "") };
  return { speakerType: "member", title: undefined };
}

/**
 * 発言者ラベル（会議録上の表記）を正規化し、比較しやすい形（敬称・空白除去）にする。
 * 例："前田遼君"／"前田 遼君"／"前田 遼議員"／"○番（前田遼君）" → いずれも"前田遼"。
 */
function normalizeSpeakerName(label) {
  let s = label.trim();
  // "○番（前田遼君）"のように、役職名を伴わない丸括弧内の氏名は中身を優先する
  // （市長・部長等の役職ラベルはclassifySpeakerLabelで別処理するため、ここでは対象外）。
  const isOfficialLabel = /^(市長|副市長|教育長|議長|副議長|.*部長|.*課長|.*局長|.*委員長|.*管理者|.*事務局長)/.test(s);
  if (!isOfficialLabel) {
    const parenMatch = s.match(/[（(]([^）)]+)[）)]/);
    if (parenMatch) s = parenMatch[1];
  }
  return s
    .replace(/^\d+番/, "")
    .replace(/(君|議員|さん|氏)$/g, "")
    .replace(/\s+/g, "");
}

/**
 * 発言者ラベルを既存議員データ（members.json）とマッチングする。
 * 氏名の完全一致（敬称・空白を除去した上で）でのみ確定させ、部分一致・あいまい一致では
 * 確定しない（同姓同名や誤認識のリスクを避けるため）。一致しない場合はundefinedを返し、
 * 呼び出し側でsummaryStatus: "speaker-identification-pending"とすること。
 *
 * 未対応：旧姓・異体字（例: 髙/高、﨑/崎）の表記ゆれ。将来、必要になった時点で
 * 個別の議員データに「別表記」を追加する形で拡張する想定。
 *
 * @param {string} label 会議録上の発言者ラベル
 * @param {{id: string, name: string}[]} members members.jsonの配列
 * @returns {{memberId: string, confidence: "exact"} | undefined}
 */
export function matchSpeakerToMember(label, members) {
  const normalizedLabel = normalizeSpeakerName(label);
  if (!normalizedLabel) return undefined;

  const candidates = members.filter((m) => m.name.replace(/\s+/g, "") === normalizedLabel);
  if (candidates.length === 1) return { memberId: candidates[0].id, confidence: "exact" };
  // 同姓同名など複数該当、または該当なしの場合は確定しない。
  return undefined;
}

/**
 * @deprecated 未実装のスタブ。councilSpeechSummaries.jsonへの本格的な組み込み（sessionId/memberIdから
 * 実際のfileName・発言位置を特定する処理）は今後の課題。現時点ではlistMeetingDays/listSpeakerSegments/
 * fetchSegmentTextを直接使うこと（scripts/fetch-nobeoka-speaker-minutes.mjs参照）。
 */
export async function fetchMinutesForSpeech(input) {
  if (!input?.sessionId || !input?.memberId) {
    throw new Error("fetchMinutesForSpeech: sessionId と memberId は必須です");
  }
  return {
    sourceType: "official-minutes-html",
    sourceUrl: input.officialSearchUrl ?? "",
    fetchedAt: null,
    rawTextPath: null,
    normalizedTextPath: null,
    status: "not-fetched",
  };
}

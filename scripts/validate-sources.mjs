/**
 * 出典URL・一次資料参照の構造的検証（ネットワークアクセスなし、CIで安全に毎回実行できる）。
 *
 * リンク切れの実チェック（HTTP到達性）はここでは行わない（外部サーバーへの負荷・
 * CI実行時間・ネットワーク不安定性への配慮のため）。代わりに、既存データが実際に
 * 持っている出典系フィールド（sourceUrl・sourceTitle・sourceOrganization・sourceRefs・
 * officialListUrl等）の形式・整合性のみを検証する。実URLの到達性監査は
 * `docs/quality-report.md`系の非公開レポート、または手動のワンショット監査で行う。
 *
 * error（明確な不整合、修正が必要）：
 *   - URLとして解釈できない値（形式不正）
 *   - isOfficial:true / verificationStatus:"verified"を名乗っているのに、
 *     ドメインが延岡市・延岡市議会・宮崎県等の既知の公式ドメイン一覧に含まれない
 *     （＝「公式」表示の誤用の疑い）
 *
 * warning（改善余地はあるが、ビルドは止めない）：
 *   - 公式ドメインの出典なのにタイトル（sourceTitle/title/label等）が空
 *
 * info（参考情報）：
 *   - 二次資料ドメイン（Wikipedia等）を出典として使っている件数
 *
 * 使い方：node scripts/validate-sources.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const readJson = (relPath) => JSON.parse(readFileSync(join(root, relPath), "utf8"));

// 公式一次資料として扱ってよいドメイン（Phase 16監査で確認済み）。
const OFFICIAL_DOMAINS = new Set([
  "www.city.nobeoka.miyazaki.jp",
  "city.nobeoka.miyazaki.jp",
  "www.kensakusystem.jp",
  "www.pref.miyazaki.lg.jp",
  "www.soumu.go.jp",
  "data.stat.pref.miyazaki.lg.jp",
  "www.si-gichokai.jp",
  "www1.g-reiki.net",
]);

// 議員/元議員の経歴等で、他自治体・国政政党公式サイトを比較・参照目的で使うことがある
// （「延岡市の公式資料」ではないが「虚偽・不適切」でもないドメイン）。errorにはしない。
const OTHER_PUBLIC_DOMAINS = new Set([
  "www.city.miyakonojo.miyazaki.jp", "www.hyugacity.jp", "www.city.miyazaki.miyazaki.jp",
  "www.city.kobayashi.lg.jp", "www.city.nichinan.lg.jp", "www.city.saito.lg.jp",
  "www.komei.or.jp", "new-kokumin.jp", "cdp-japan.jp",
  // 国立国会図書館（NDL）。国の公的機関だが「延岡市の公式資料」ではないため、
  // OFFICIAL_DOMAINSではなくここに置く（NDL掲載だから自動的に最高信頼度になるわけではない、
  // という docs/ndl-search-research-plan.md の方針と整合させる）。
  "dl.ndl.go.jp", "ndlsearch.ndl.go.jp",
]);

const SECONDARY_DOMAINS = new Set([
  "ja.wikipedia.org", "kotobank.jp", "news.yahoo.co.jp", "www.the-miyanichi.co.jp", "go2senkyo.com",
]);

const errors = [];
const warnings = [];
const info = [];

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Wayback Machine（web.archive.org）のURLは "https://web.archive.org/web/<timestamp>/<元URL>"
 * という形式で元URLをそのまま内包している。元の発行元ドメインが公式ドメインかどうかを
 * 判定するため、この内包URLを抽出する。Wayback以外のURLはnullを返す。
 */
function unwrapWaybackUrl(url) {
  const m = /^https?:\/\/web\.archive\.org\/web\/[^/]+\/(https?:\/\/.+)$/.exec(url);
  return m ? m[1] : null;
}

/**
 * 1件分の出典参照（sourceUrl + タイトル候補 + 公式性の主張）を検証する。
 * @param {string} file
 * @param {string} label 対象を特定する短いラベル（例: "archiveMayors.json mayor-02"）
 * @param {string} url
 * @param {string|undefined} title
 * @param {boolean|undefined} claimsOfficial isOfficial:trueやverificationStatus:"verified"等、
 *   「これは公式資料である」と明示的に主張しているか
 */
function checkRef(file, label, url, title, claimsOfficial) {
  if (typeof url !== "string" || url.trim() === "") return;
  const host = hostOf(url);
  if (!host) {
    errors.push(`${file} [${label}]: URLとして解釈できません（値: "${url}"）`);
    return;
  }

  const isWayback = host === "web.archive.org";
  const originalUrl = isWayback ? unwrapWaybackUrl(url) : null;
  const checkHost = originalUrl ? hostOf(originalUrl) : host;

  const isOfficial = checkHost != null && OFFICIAL_DOMAINS.has(checkHost);
  const isOtherPublic = checkHost != null && OTHER_PUBLIC_DOMAINS.has(checkHost);
  const isSecondary = checkHost != null && SECONDARY_DOMAINS.has(checkHost);

  if (claimsOfficial && !isOfficial && !isOtherPublic) {
    errors.push(`${file} [${label}]: 公式資料として扱われていますが、ドメイン "${checkHost ?? host}" は既知の公式ドメイン一覧にありません`);
  } else if (claimsOfficial && isOtherPublic) {
    warnings.push(`${file} [${label}]: 公式資料として扱われていますが、延岡市・延岡市議会・国の公式ドメインではありません（${checkHost}、他の公的機関・政党公式サイトの可能性）`);
  }
  if (isOfficial && (!title || title.trim() === "")) {
    warnings.push(`${file} [${label}]: 公式ドメインの出典ですがタイトルが未設定です（${url}）`);
  }
  if (isSecondary) {
    info.push(`${file} [${label}]: 二次資料ドメイン（${checkHost}）を出典として使用`);
  }
  if (isWayback && isOfficial) {
    info.push(`${file} [${label}]: Internet Archive（Wayback Machine）に保存された公式資料（元ドメイン: ${checkHost}）を出典として使用`);
  } else if (isWayback && !originalUrl) {
    warnings.push(`${file} [${label}]: web.archive.orgのURLですが元URLの形式を認識できませんでした（値: "${url}"）`);
  }
}

// --- 1. councilSpeechSummaries.json（一般質問・答弁の要約出典） ---
try {
  const data = readJson("src/data/councilSpeechSummaries.json");
  for (const member of data.members ?? []) {
    for (const speech of member.speeches ?? []) {
      if (!speech.isPublished) continue;
      if (!speech.summarySources || speech.summarySources.length === 0) {
        warnings.push(`councilSpeechSummaries.json [${speech.id}]: 出典（summarySources）が空です`);
        continue;
      }
      for (const src of speech.summarySources) {
        checkRef("councilSpeechSummaries.json", speech.id, src.sourceUrl, src.title, src.sourceType === "official-minutes-html");
      }
    }
  }
} catch (e) {
  warnings.push(`councilSpeechSummaries.json の検証中にエラー: ${e.message}`);
}

// --- 2. archiveMayors.json / archiveMayorTerms.json（歴代市長） ---
// 注意：sourceRefs[].verificationStatusは「この事実がこの資料の記載と一致することを
// 確認した」という事実確認の意味であり、「この資料自体が公式一次資料である」という
// 意味ではない（二次資料であっても内容確認は行う）。そのため、公式性の主張チェック
// （claimsOfficial）はここでは行わず、二次資料ドメインの使用状況はinfoでのみ記録する。
for (const file of ["src/data/archiveMayors.json", "src/data/archiveMayorTerms.json"]) {
  try {
    const data = readJson(file);
    for (const item of data) {
      for (const ref of item.sourceRefs ?? []) {
        checkRef(file, item.id ?? item.slug ?? "unknown", ref.sourceUrl, ref.sourceTitle, false);
      }
    }
  } catch (e) {
    warnings.push(`${file} の検証中にエラー: ${e.message}`);
  }
}

// --- 3. civicTimelineEvents.json（市政年表） ---
try {
  const data = readJson("src/data/civicTimelineEvents.json");
  for (const ev of data) {
    for (const ref of ev.sourceRefs ?? []) {
      checkRef("civicTimelineEvents.json", ev.id, ref.url, ref.label, ev.verificationStatus === "verified");
    }
  }
} catch (e) {
  warnings.push(`civicTimelineEvents.json の検証中にエラー: ${e.message}`);
}

// --- 4. committees.json ---
try {
  const data = readJson("src/data/committees.json");
  for (const c of data) {
    for (const ref of c.sourceRefs ?? []) {
      checkRef("committees.json", c.id, ref.sourceUrl, ref.sourceTitle, true);
    }
  }
} catch (e) {
  warnings.push(`committees.json の検証中にエラー: ${e.message}`);
}

// --- 5. citySpecialPosts.json ---
try {
  const data = readJson("src/data/citySpecialPosts.json");
  for (const p of data) {
    for (const ref of p.sourceRefs ?? []) {
      checkRef("citySpecialPosts.json", p.id, ref.sourceUrl, ref.sourceTitle, true);
    }
  }
} catch (e) {
  warnings.push(`citySpecialPosts.json の検証中にエラー: ${e.message}`);
}

// --- 6. politicalFundOrganizations.json（政治資金） ---
// officialListUrlは本来「選管・総務省が公表している一覧・公表ページのURL」だが、
// 選管の公表がまだ行われていない団体（verificationStatus:"pending"、notesに公表待ちの
// 経緯が明記されている）については、本人公式サイト等の暫定参照を許容する
// （BLOCKED状態を正直に示すための既存の運用であり、データ品質の欠陥ではない）。
try {
  const data = readJson("src/data/politicalFundOrganizations.json");
  for (const org of data) {
    if (org.officialListUrl) {
      const claimsOfficial = org.verificationStatus !== "pending";
      checkRef("politicalFundOrganizations.json", org.id, org.officialListUrl, org.name, claimsOfficial);
    } else {
      warnings.push(`politicalFundOrganizations.json [${org.id}]: officialListUrlが未設定です`);
    }
  }
} catch (e) {
  warnings.push(`politicalFundOrganizations.json の検証中にエラー: ${e.message}`);
}

// --- 7. councilSessions.json（会期・議案審議結果PDF） ---
try {
  const data = readJson("src/data/councilSessions.json");
  for (const session of data) {
    if (session.officialSessionUrl) {
      checkRef("councilSessions.json", session.id, session.officialSessionUrl, session.title, true);
    }
    for (const doc of session.documents ?? []) {
      checkRef("councilSessions.json", `${session.id}/${doc.id}`, doc.sourceUrl, doc.title, doc.isOfficial === true);
    }
  }
} catch (e) {
  warnings.push(`councilSessions.json の検証中にエラー: ${e.message}`);
}

// --- 8. mayorPromises.json（市長公約） ---
try {
  const data = readJson("src/data/mayorPromises.json");
  const promises = data.promises ?? data;
  for (const p of promises) {
    if (!p.sources || p.sources.length === 0) {
      warnings.push(`mayorPromises.json [${p.id}]: 出典（sources）が空です`);
    }
  }
} catch (e) {
  warnings.push(`mayorPromises.json の検証中にエラー: ${e.message}`);
}

for (const i of info) console.log(`[INFO] ${i}`);
for (const w of warnings) console.log(`[WARN] ${w}`);
for (const e of errors) console.error(`[ERR] ${e}`);

console.log(`[validate-sources] errors=${errors.length} warnings=${warnings.length} info=${info.length}`);

if (errors.length > 0) process.exit(1);

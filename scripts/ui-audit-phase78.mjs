// UI・アクセシビリティ深掘り監査スクリプト（見出し構造・アイコンのみボタン/リンクのaria-label・
// canonical/OGP・title/description重複度・テーブルのはみ出しリスクを検査）。
// dist/配下の全prerender済みHTMLを静的解析する。一時的な監査ツールであり、npm scriptsには登録しない。
// 参考: scripts/ui-audit-phase76.mjs, scripts/ui-audit-scan.mjs, scripts/site-completeness-audit.mjs
// （これらの既存scriptsとは役割を分けている。出力先は reports/phase78-ui-a11y-findings.json）
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(process.cwd(), 'dist');
if (!fs.existsSync(DIST)) {
  console.error('[phase78-ui-audit] dist/ が見つかりません。先に npm run build を実行してください。');
  process.exit(1);
}

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.html')) files.push(p);
  }
}
walk(DIST);

const distAbs = DIST.replace(/\\/g, '/');
const routeOf = (filePath) => {
  const abs = path.resolve(filePath).replace(/\\/g, '/');
  let r = abs.startsWith(distAbs) ? abs.slice(distAbs.length) : abs;
  r = r.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  if (r === '') r = '/';
  return r;
};

const findings = {
  generatedAt: new Date().toISOString(),
  routesScanned: files.length,
  summary: {},
  issuesByPriority: { P0: [], P1: [], P2: [], P3: [] },
  representativePageChecks: [],
  safeFixCandidates: [],
};

function pushIssue(priority, route, category, detail, suggestedFix) {
  findings.issuesByPriority[priority].push({ route, category, detail, suggestedFix: suggestedFix ?? null });
}

// 集計用カウンタ
let h1MissingOrMultipleCount = 0;
let headingSkipCount = 0;
let missingAltCount = 0;
let iconOnlyButtonNoLabelCount = 0;
let iconOnlyLinkNoLabelCount = 0;
let missingCanonicalCount = 0;
let missingOgTitleCount = 0;
let missingOgDescriptionCount = 0;
let missingOgImageCount = 0;
let tableNoWrapCount = 0;
let largeFixedWidthCount = 0;

// title/description/og:title/og:description の重複検出用
const titleMap = new Map(); // text -> [routes]
const descMap = new Map();
const ogTitleMap = new Map();
const ogDescMap = new Map();

function addToMap(map, text, route) {
  if (!text) return;
  if (!map.has(text)) map.set(text, []);
  map.get(text).push(route);
}

const missingAltSample = [];
const iconOnlyButtonSample = [];
const iconOnlyLinkSample = [];
const headingSkipSample = [];
const tableSample = [];
const largeFixedWidthSample = [];

for (const f of files) {
  const route = routeOf(f);
  let html;
  try {
    html = fs.readFileSync(f, 'utf8');
  } catch {
    pushIssue('P0', route, 'read_error', 'HTMLファイルを読み込めない');
    continue;
  }

  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/);
  const head = headMatch ? headMatch[1] : '';
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
  let body = bodyMatch ? bodyMatch[1] : html;
  const bodyNoScript = body.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');

  // ---------- 1. heading構造 ----------
  const h1s = [...bodyNoScript.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  if (h1s.length !== 1) {
    h1MissingOrMultipleCount++;
    pushIssue(
      h1s.length === 0 ? 'P1' : 'P2',
      route,
      'h1_count',
      `h1の数=${h1s.length}（1つが望ましい）`,
    );
  }

  // 見出し階層の飛び検出（h1→h3など、直前より2段以上深いレベルへジャンプした場合）
  const headingSeq = [...bodyNoScript.matchAll(/<h([1-6])\b[^>]*>/g)].map((m) => Number(m[1]));
  let prevLevel = null;
  let skipDetectedThisRoute = false;
  for (const lvl of headingSeq) {
    if (prevLevel !== null && lvl > prevLevel + 1) {
      skipDetectedThisRoute = true;
    }
    prevLevel = lvl;
  }
  if (skipDetectedThisRoute) {
    headingSkipCount++;
    if (headingSkipSample.length < 30) headingSkipSample.push({ route, sequence: headingSeq.join('>') });
    pushIssue('P3', route, 'heading_level_skip', `見出しレベルが飛んでいる可能性: ${headingSeq.join('>')}（カード等の並列構造による誤検出の可能性あり・要目視確認）`);
  }

  // ---------- 2. img alt ----------
  const imgTags = bodyNoScript.match(/<img\b[^>]*>/g) || [];
  for (const tag of imgTags) {
    const altM = tag.match(/alt="([^"]*)"/);
    if (!altM || altM[1].trim() === '') {
      missingAltCount++;
      if (missingAltSample.length < 30) missingAltSample.push({ route, tag: tag.slice(0, 160) });
      pushIssue('P1', route, 'missing_alt', `alt属性が無い/空: ${tag.slice(0, 120)}`, 'alt="（内容を説明するテキスト）" を追加、装飾目的なら alt="" を明示');
    }
  }

  // ---------- 3. button/a のアクセシブルネーム ----------
  const buttonTags = [...bodyNoScript.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  for (const [, attrs, inner] of buttonTags) {
    const hasAriaLabel = /aria-label="[^"]*[^"\s][^"]*"/.test(attrs) || /aria-labelledby="/.test(attrs);
    // svg/pathなどのアイコン要素を除去してテキストのみ残す
    const textOnly = inner
      .replace(/<svg[\s\S]*?<\/svg>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    if (!hasAriaLabel && textOnly === '') {
      iconOnlyButtonNoLabelCount++;
      if (iconOnlyButtonSample.length < 30) {
        iconOnlyButtonSample.push({ route, tag: `<button${attrs}>...`.slice(0, 160) });
      }
      pushIssue('P1', route, 'icon_only_button_no_label', `アイコンのみのbuttonにaria-labelが無い: <button${attrs.slice(0, 100)}>`, 'aria-label="（操作内容）" を追加');
    }
  }

  const aTags = [...bodyNoScript.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  for (const [, attrs, inner] of aTags) {
    if (!/href=/.test(attrs)) continue; // href無しのアンカー（アンカー用途）は対象外
    const hasAriaLabel = /aria-label="[^"]*[^"\s][^"]*"/.test(attrs) || /aria-labelledby="/.test(attrs);
    const textOnly = inner
      .replace(/<svg[\s\S]*?<\/svg>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    if (!hasAriaLabel && textOnly === '') {
      iconOnlyLinkNoLabelCount++;
      if (iconOnlyLinkSample.length < 30) {
        iconOnlyLinkSample.push({ route, tag: `<a${attrs}>...`.slice(0, 160) });
      }
      pushIssue('P1', route, 'icon_only_link_no_label', `アイコンのみのaタグにaria-labelが無い: <a${attrs.slice(0, 100)}>`, 'aria-label="（リンク先の説明）" を追加');
    }
  }

  // ---------- 4. canonical, OGP, title/description の重複 ----------
  const canonicalM = head.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/);
  if (!canonicalM || !canonicalM[1]) {
    missingCanonicalCount++;
    pushIssue('P2', route, 'missing_canonical', 'canonical linkが無い');
  }

  const titleM = head.match(/<title>([^<]*)<\/title>/);
  const title = titleM ? titleM[1].trim() : '';
  const descM = head.match(/<meta\s+name="description"\s+content="([^"]*)"/);
  const description = descM ? descM[1].trim() : '';
  const ogTitleM = head.match(/<meta\s+property="og:title"\s+content="([^"]*)"/);
  const ogTitle = ogTitleM ? ogTitleM[1].trim() : '';
  const ogDescM = head.match(/<meta\s+property="og:description"\s+content="([^"]*)"/);
  const ogDesc = ogDescM ? ogDescM[1].trim() : '';
  const ogImageM = head.match(/<meta\s+property="og:image"\s+content="([^"]*)"/);

  if (!ogTitle) {
    missingOgTitleCount++;
    pushIssue('P2', route, 'missing_og_title', 'og:titleが無い');
  }
  if (!ogDesc) {
    missingOgDescriptionCount++;
    pushIssue('P2', route, 'missing_og_description', 'og:descriptionが無い');
  }
  if (!ogImageM || !ogImageM[1]) {
    missingOgImageCount++;
    pushIssue('P3', route, 'missing_og_image', 'og:imageが無い');
  }

  if (route !== '/') {
    addToMap(titleMap, title, route);
    addToMap(descMap, description, route);
    addToMap(ogTitleMap, ogTitle, route);
    addToMap(ogDescMap, ogDesc, route);
  }

  // overflow-x-auto等のスクロールコンテナ内かどうかの判定（section 5, 6 共通で使用）。
  // 直前400文字以内に overflow-x-auto / overflow-auto / overflow-scroll があれば意図的なものとみなす
  // （role="region" aria-label="…" tabindex="0" 等の属性が間に挟まるため、ある程度広めの窓を取る）。
  const isInsideScrollContainer = (idx) => {
    const before = bodyNoScript.slice(Math.max(0, idx - 400), idx);
    return /overflow-x-auto|overflow-auto|overflow-scroll/.test(before);
  };

  // ---------- 5. table横スクロールリスク（phase76の手法を踏襲）----------
  // なお、table自体が overflow-x-auto かつ role="region"/tabindex="0" のスクロールコンテナに
  // 包まれている場合は、ページ全体の横スクロールは発生せず、WCAG 1.4.10（Reflow）に沿った
  // 意図的な実装であるため severity を下げて記録する（whitespace-nowrap/break-words自体の要否は別問題）。
  if (/<table/.test(bodyNoScript)) {
    const tableBlocks = [...bodyNoScript.matchAll(/<table[\s\S]*?<\/table>/g)];
    let flaggedThisRoute = false;
    for (const tbm of tableBlocks) {
      const tb = tbm[0];
      const hasNoWrapClass = /whitespace-nowrap/.test(tb);
      const hasBreakWords = /break-words|whitespace-normal/.test(tb);
      if (!hasNoWrapClass && !hasBreakWords) {
        const wrappedInAccessibleScrollRegion = isInsideScrollContainer(tbm.index) &&
          /role="region"[^>]*tabindex="0"|tabindex="0"[^>]*role="region"/.test(
            bodyNoScript.slice(Math.max(0, tbm.index - 400), tbm.index),
          );
        tableNoWrapCount++;
        if (tableSample.length < 30) tableSample.push({ route, wrappedInAccessibleScrollRegion });
        if (!flaggedThisRoute) {
          pushIssue(
            wrappedInAccessibleScrollRegion ? 'P3' : 'P2',
            route,
            'table_no_wrap_protection',
            wrappedInAccessibleScrollRegion
              ? 'tableにwhitespace-nowrap/break-words系クラスは無いが、role="region"+tabindex="0"+overflow-x-autoの アクセシブルなスクロールコンテナで既に包まれておりページ全体の横スクロールは発生しない（低リスク、要目視確認）'
              : 'table内にwhitespace-nowrap/break-words系のクラスが無く、スクロールコンテナでの保護も確認できない。モバイル幅で横崩れの可能性',
          );
          flaggedThisRoute = true;
        }
      }
    }
  }

  // ---------- 6. 大きな固定幅指定（横スクロール誘発リスク）----------
  // overflow-x-auto等のスクロールコンテナ内で<table>にmin-w-[...]を付ける手法は、
  // ページ全体の横スクロールを防ぎつつ広い表を扱う正しいパターンのため誤検知を避ける。
  // 直前120文字以内に overflow-x-auto / overflow-auto / overflow-scroll があれば意図的なものとみなしスキップする。

  // インラインstyleでのpx指定
  const styleWidthRe = /style="[^"]*(?:^|;)\s*(?:min-)?width:\s*(\d+)px[^"]*"/g;
  let swm;
  while ((swm = styleWidthRe.exec(bodyNoScript))) {
    const px = Number(swm[1]);
    if (px >= 400 && !isInsideScrollContainer(swm.index)) {
      largeFixedWidthCount++;
      if (largeFixedWidthSample.length < 30) largeFixedWidthSample.push({ route, px, kind: 'inline-style' });
      pushIssue('P2', route, 'large_fixed_width_inline_style', `インラインstyleで${px}px幅指定。390px幅端末で横スクロールを誘発する可能性`);
    }
  }
  // Tailwind任意値クラス w-[数値px] / min-w-[数値px]
  const twWidthRe = /\b(?:min-)?w-\[(\d+)px\]/g;
  let twm;
  while ((twm = twWidthRe.exec(bodyNoScript))) {
    const px = Number(twm[1]);
    if (px >= 400 && !isInsideScrollContainer(twm.index)) {
      largeFixedWidthCount++;
      if (largeFixedWidthSample.length < 30) largeFixedWidthSample.push({ route, px, kind: 'tailwind-arbitrary' });
      pushIssue('P2', route, 'large_fixed_width_tailwind', `Tailwind任意値クラスで${px}px幅指定。390px幅端末で横スクロールを誘発する可能性`);
    }
  }
}

// 重複title/description/og集計（頻度2以上、home除く）
function summarizeDuplicates(map, minCount = 2, topN = 30) {
  const groups = [...map.entries()]
    .filter(([text, routes]) => text !== '' && routes.length >= minCount)
    .sort((a, b) => b[1].length - a[1].length);
  return {
    duplicateGroupCount: groups.length,
    totalRoutesInvolved: groups.reduce((sum, [, routes]) => sum + routes.length, 0),
    top: groups.slice(0, topN).map(([text, routes]) => ({
      text: text.slice(0, 200),
      count: routes.length,
      sampleRoutes: routes.slice(0, 5),
    })),
  };
}

const titleDup = summarizeDuplicates(titleMap);
const descDup = summarizeDuplicates(descMap);
const ogTitleDup = summarizeDuplicates(ogTitleMap);
const ogDescDup = summarizeDuplicates(ogDescMap);

// 重複title/descriptionをP2 issueとしても記録（上位のみ、件数が多すぎる場合は上限を設ける）
for (const g of titleDup.top) {
  pushIssue('P2', g.sampleRoutes[0], 'duplicate_title', `title「${g.text}」が非トップページで${g.count}件重複（例: ${g.sampleRoutes.join(', ')}）`);
}
for (const g of descDup.top) {
  pushIssue('P2', g.sampleRoutes[0], 'duplicate_description', `description「${g.text}」が非トップページで${g.count}件重複（例: ${g.sampleRoutes.join(', ')}）`);
}

// ---------- 手動調査による追加所見（静的スキャンでは検出できない、根本原因まで特定できたもの） ----------
// Phase78で実機/プレビューサーバーでの目視確認・ソースコード調査によって発見。
// 自動スキャンの duplicate_title（P2, /members/fm01 等58件）は同じ症状の表層検出だが、
// 以下はその根本原因（src/lib/seo.ts の memberSeo() が元議員IDを考慮していない）まで特定した個別事象。
{
  const formerIds = (() => {
    try {
      const raw = fs.readFileSync(path.resolve(process.cwd(), 'src/data/formerMembers.json'), 'utf8');
      return JSON.parse(raw).map((m) => m.id);
    } catch {
      return [];
    }
  })();
  const affectedRoutes = formerIds
    .filter((id) => fs.existsSync(path.join(DIST, 'members', id, 'index.html')))
    .map((id) => `/members/${id}/`);

  pushIssue(
    'P1',
    affectedRoutes[0] ?? '/members/fm01/',
    'former_member_seo_metadata_generic_and_noindex',
    `/members/{元議員ID}/ ルート（${affectedRoutes.length}件、例: ${affectedRoutes.slice(0, 5).join(', ')} ...）は、本文（h1・在職当時の一般質問等）は正しく該当の元議員名で表示されるにもかかわらず、` +
      `<title>・meta descriptionが汎用文言「議員情報｜延岡市政見える化ポータル」のまま、かつ<meta name="robots" content="noindex, nofollow">が付与されている。` +
      `原因はsrc/lib/seo.tsのmemberSeo()がmembers（現職）のみを検索し、formerMembers（元議員）を考慮していないため、notFound()の汎用値にフォールバックしていること。` +
      `姉妹ルートの /members/former/{slug}/ は同じ人物について正しく個別化されたtitle・description・robots:index,followを返しており、動作が矛盾している。` +
      `実際に /members/former/{slug}/ の本文（議員活動年表・議案表決履歴など）や、一部の議案採決詳細ページ（例: /bills/votes/2019-09-gian-47/, /bills/votes/2023-07-extraordinary-01-gian-9/）から実在するリンクとして/members/{id}/へ遷移できるため、` +
      `市民が実際にこの汎用title/description/noindexのページへ到達しうる（サイトマップには含まれていないため検索結果には出にくいが、ブラウザタブ・SNSシェア・ブックマーク上は誰のページか分からない）。`,
    'src/lib/seo.ts の memberSeo(id) 内で member が見つからない場合、formerMembers.find((m) => m.id === id) にフォールバックし、' +
      '見つかった場合は memberFormerSeo 相当の個別化されたtitle/description/canonical/og/robots:index,followを返すよう修正する（speechDetailSeo()で既に使われている' +
      'formerMembers.find(...)と同じパターン）。データ変更は不要、seo.ts内のロジック追加のみ。ただしarchiveMemberProfilesとのマッピングや' +
      '既存の/members/former/{slug}/との重複コンテンツ関係（canonicalをどちらに寄せるか）の設計判断を伴うため、Phase88適用前にコードレビューを推奨。',
  );

  pushIssue(
    'P3',
    '/mayors/aoki-yoshisuke/',
    'ambiguous_date_wording_in_body_text',
    '本文中「生年月日は2026-08-17、延岡市史（1963年、NDL個人送信サービス）で独立した一次資料の裏付けを得た」という一文が、' +
      '生年月日そのもの（別途上部に1892年11月1日と記載済み）ではなく確認日を指しているため、初見では日付の意味を誤読しやすい。データの誤りではなく文言表現のみの改善余地（Phase78代表ページ確認で発見）。',
  );

  findings.safeFixCandidates.push({
    file: 'src/lib/seo.ts',
    location: 'memberSeo(id, options) 関数（/members/:id のSEO生成、約1323〜1354行目）',
    currentCode:
      'function memberSeo(id: string, options?: SeoOptions): SeoResult {\n' +
      '  const member = members.find((m) => m.id === id);\n' +
      '  if (!member) return notFound(`/members/${id}`, "議員情報");\n' +
      '  // ...（現職議員向けのtitle/description/OGPを生成）\n' +
      '}',
    proposedCode:
      'function memberSeo(id: string, options?: SeoOptions): SeoResult {\n' +
      '  const member = members.find((m) => m.id === id);\n' +
      '  if (!member) {\n' +
      '    const formerMember = formerMembers.find((m) => m.id === id);\n' +
      '    if (formerMember) {\n' +
      '      // formerMember.name 等を使って個別化したtitle/description/canonical/og/robots:"index, follow"を返す\n' +
      '      // （/members/former/:slug のSEO生成関数と同様のロジック、または同関数への委譲）\n' +
      '    }\n' +
      '    return notFound(`/members/${id}`, "議員情報");\n' +
      '  }\n' +
      '  // ...（既存の現職議員向け処理はそのまま）\n' +
      '}',
    risk:
      '中（コード変更のみでデータ変更は無いが、単純な属性追加ではなくロジック分岐の追加。/members/former/{slug}/との' +
      'canonical・重複コンテンツの扱いを設計する必要があり、Phase88適用前にレビュー・目視確認を推奨。安全性ほぼゼロの' +
      '「aria-label追加」等とは異なるカテゴリの修正として扱うこと。',
  });
}

findings.summary = {
  routesScanned: files.length,
  h1MissingOrMultipleCount,
  headingSkipCount,
  missingAltCount,
  iconOnlyButtonNoLabelCount,
  iconOnlyLinkNoLabelCount,
  missingCanonicalCount,
  missingOgTitleCount,
  missingOgDescriptionCount,
  missingOgImageCount,
  tableNoWrapCount,
  largeFixedWidthCount,
  duplicateTitleGroups: titleDup.duplicateGroupCount,
  duplicateTitleRoutesInvolved: titleDup.totalRoutesInvolved,
  duplicateDescriptionGroups: descDup.duplicateGroupCount,
  duplicateDescriptionRoutesInvolved: descDup.totalRoutesInvolved,
  duplicateOgTitleGroups: ogTitleDup.duplicateGroupCount,
  duplicateOgDescriptionGroups: ogDescDup.duplicateGroupCount,
};

findings.samples = {
  missingAlt: missingAltSample,
  iconOnlyButtons: iconOnlyButtonSample,
  iconOnlyLinks: iconOnlyLinkSample,
  headingSkips: headingSkipSample,
  tablesWithoutWrapProtection: tableSample,
  largeFixedWidth: largeFixedWidthSample,
  duplicateTitles: titleDup.top,
  duplicateDescriptions: descDup.top,
  duplicateOgTitles: ogTitleDup.top,
  duplicateOgDescriptions: ogDescDup.top,
};

// ---------- 代表ページの実機/プレビューサーバー確認結果（Phase78で手動実施） ----------
// vite preview（http://localhost:4175 相当、dist/を配信）をclaude-in-chromeブラウザツールで
// 390x844のモバイル幅にリサイズして開き、get_page_text（DOM内容確認）とスクリーンショット（見た目確認）で確認した。
// セッション後半でCDPスクリーンショット機能が不安定になった（タイムアウト・フリーズ）ため、
// 一部ページはスクリーンショットを断念しget_page_textまたは静的HTML読解で代替した（各エントリのmethod/note参照）。
findings.representativePageChecks = [
  {
    pageType: 'top',
    url: '/',
    method: 'browser',
    findings: ['390px幅で横スクロールなし。文字切れなし。ボトムナビのタップ領域は十分。問題なし。'],
  },
  {
    pageType: 'member-detail（議員詳細）',
    url: '/members/m01',
    method: 'browser',
    findings: [
      '390px幅で横スクロールなし。プロフィールカード・議会活動データとも崩れなし。',
      '「一般質問 58」等の数値には直下に「7／12（対象のうち確認できた件数）」という母数表記があり、母数不明の裸のパーセンテージ表示は見当たらなかった。',
    ],
  },
  {
    pageType: 'former-member-detail（元議員詳細）',
    url: '/members/former/fm01',
    method: 'browser',
    findings: [
      '390px幅で横スクロールなし。「元職（現職ではありません）」「資料充足レベルB」の状態バッジも視認性良好。',
    ],
  },
  {
    pageType: 'mayor-detail（歴代市長詳細）',
    url: '/mayors/aoki-yoshisuke',
    method: 'browser',
    findings: [
      '390px幅で横スクロールなし、文字切れなし。',
      'P3所見: 本文中「生年月日は2026-08-17、延岡市史（1963年）で独立した一次資料の裏付けを得た」という一文が、生年月日そのもの（1892年11月1日、別途上部に記載）ではなく確認日を指しているため、初見では日付の意味を誤読しやすい表現になっている。データの誤りではなく文言のみの改善余地。',
    ],
  },
  {
    pageType: 'questions-list（一般質問一覧）',
    url: '/questions',
    method: 'browser',
    findings: ['390px幅で横スクロールなし。導入文・アコーディオンとも問題なし。'],
  },
  {
    pageType: 'question-detail（一般質問詳細）',
    url: '/questions/gq2026-06-m01',
    method: 'browser',
    findings: ['390px幅で横スクロールなし。バッジ・タグとも折り返し良好。'],
  },
  {
    pageType: 'finance-top（財政）',
    url: '/finance',
    method: 'browser',
    findings: ['390px幅で横スクロールなし。基準日（2026年6月5日）が明示されている。'],
  },
  {
    pageType: 'finance-year-detail（財政年度詳細）',
    url: '/finance/budget',
    method: 'browser',
    findings: [
      '注記: このコードベースには年度単体の財政詳細に特化した独立ルートが無く、/financeが単年度、/finance/budget・/finance/debt・/finance/fundsが複数年度推移の役割を担う構成だったため、最も近いページとして/finance/budgetを確認した。',
      '「確認中」表示と0（ゼロ）を明確に区別しており、CLAUDE.mdの方針（未確認データを0として扱わない）に沿っている。単位（億円）も明記。',
      'P3所見（低確度）: スクロール直後の1回のスクリーンショットで一瞬コンテンツが空白になる現象を観測したが、1秒待って再撮影すると正常表示に復帰した。ツール側のタイミングの問題である可能性が高く、サイト側の再現性は未確認。',
    ],
  },
  {
    pageType: 'timeline（市政年表）',
    url: '/timeline',
    method: 'browser',
    findings: ['390px幅で横スクロールなし。カテゴリ絞り込みチップの折り返し良好。'],
  },
  {
    pageType: 'bill-vote-detail（議案詳細）',
    url: '/bills/votes/2019-06-gian-10',
    method: 'browser',
    findings: [
      'get_page_textで本文確認（画面下部のスクリーンショットはツール不安定化のため一部断念、noteを参照）。',
      '個人別の賛否が公式資料で確認できない場合に推測で埋めていない（「推測で議員個人の賛否を割り当てることはしていません」の注記あり）。CLAUDE.mdの方針に合致。',
    ],
    note: 'この議案は個人別投票テーブルを含まない案件だったため、テーブルの横スクロール確認は他ページ（/compensation/等）の静的解析结果で代替した。',
  },
  {
    pageType: 'search（検索）',
    url: '/search',
    method: 'browser',
    findings: ['390px幅で横スクロールなし。検索キーワードチップの折り返し良好。'],
  },
  {
    pageType: 'compare（比較）',
    url: '/compare',
    method: 'browser',
    findings: [
      'get_page_textで確認（この時点でスクリーンショットのCDPタイムアウトが頻発したため画像確認は断念）。',
      '「点数化や優劣・勝敗の判定は行いません」「データが少ない項目は資料未確認と表示」等、CLAUDE.mdの方針に沿った注記を確認。',
    ],
  },
  {
    pageType: 'data-status（データ収録状況）',
    url: '/data-status',
    method: 'browser',
    findings: [
      'get_page_textで確認。0件・未確認・母数未確認を一貫して区別しており、パーセンテージには必ず分子/分母が併記されている（例:「収録12件／確認済み母数13件／収録率：92%」）。CLAUDE.mdの方針を最も丁寧に反映しているページの一つ。',
    ],
  },
  {
    pageType: 'updates（更新履歴）',
    url: '/updates',
    method: 'browser',
    findings: ['get_page_textで確認。109件・全6ページのページネーションが正しく機能。各項目に出典・使用資料の記載あり。'],
  },
  {
    pageType: 'committee-detail（委員会）',
    url: '/committees/committee-gikai-arikata',
    method: 'static',
    findings: [
      'このセッションのブラウザツールが不安定化し（CDPスクリーンショットのタイムアウト、当該ルート用JSチャンクのfetchが発生しない状態）、複数回再読み込みしても実機確認ができなかったため、dist/内の静的HTMLを直接確認した。',
      'curlでの直接取得ではtitle・本文とも正しく生成されていることを確認済み（<title>議会のあり方検討特別委員会の委員名簿｜延岡市政見える化ポータル</title>）。該当JSチャンク（CommitteeDetailPage-*.js）もHTTP 200で正常配信を確認。',
      '静的HTML上、table要素なし、390px幅超の固定幅指定なし、h1にbreak-wordsクラスあり。横崩れリスクは低いと判断。',
    ],
    note: 'ブラウザでの実機確認（フォーカス可視性・実際のレンダリング）は今回未実施。要実機確認。',
  },
  {
    pageType: 'council-session-detail（定例会資料）',
    url: '/council-documents/2000-09',
    method: 'static',
    findings: [
      '同上の理由でブラウザ実機確認ができず、静的HTMLで代替。',
      '資料未整理の会期について「会期：確認中」「登録資料数：0件」を明確に区別して表示しており、CLAUDE.mdの方針に合致。',
      '静的HTML上、table要素なし、390px幅超の固定幅指定なし。横崩れリスクは低いと判断。',
    ],
    note: 'ブラウザでの実機確認は今回未実施。要実機確認。',
  },
];

const OUT_DIR = path.resolve(process.cwd(), 'reports');
fs.writeFileSync(path.join(OUT_DIR, 'phase78-ui-a11y-findings.json'), JSON.stringify(findings, null, 2) + '\n', 'utf8');
console.log('[phase78-ui-audit] audited', files.length, 'routes');
console.log(JSON.stringify(findings.summary, null, 2));

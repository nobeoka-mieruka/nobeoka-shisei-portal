/**
 * Phase197：タップ領域検出の5分類テーブル
 *
 * `scripts/audit-tap-targets.mjs` が実測した各グループを、実装ファイル単位で次の5分類へ割り当てる。
 * 判定は「44px未満かどうか」ではなく、実効タップ領域・隣接する操作要素との間隔・その要素の役割から行う。
 *
 * 判定に用いた基準（いずれも公開仕様）：
 *  - WCAG 2.2 達成基準 2.5.8 Target Size (Minimum)（レベルAA）：24x24 CSSピクセル。
 *    例外として「間隔」（他の操作要素の中心と24px以上離れている）・「インライン」（文章中のリンク）・
 *    「不可欠」・「ユーザーエージェント制御」がある。
 *  - WCAG 2.1 達成基準 2.5.5 Target Size（レベルAAA）：44x44 CSSピクセル。
 *    Phase191の監査しきい値44pxはこのAAA基準であり、下回ること自体はAA不適合を意味しない。
 *
 * 分類の考え方：
 *  - REAL_BUG：実効タップ領域が小さく、かつ隣接する操作要素と24px未満しか離れていないため
 *    押し間違いが現実に起きるもの（＝WCAG 2.2 AAの間隔例外も満たさないもの）。
 *  - ACCESSIBILITY_IMPROVEMENT：押し間違いは起きない（AAは充足する）が、独立した操作要素として
 *    44x44に届かず、拡大しても情報量・レイアウト前提を損なわないもの。Phase197で修正する。
 *  - INTENTIONAL：拡大すると別の不具合（sticky絞り込みバーの位置前提の破綻、全ページ先頭の余白増、
 *    本文の行送りの崩れ）を招くため、意図的に現状を維持するもの。
 *  - FALSE_POSITIVE：実効タップ領域は十分にあるか、検出種別の判定条件そのものが誤っているもの。
 *  - NON_INTERACTIVE：セレクタには一致するが実際には操作対象でないもの。
 */

export const CLASSIFICATION_LABELS = {
  REAL_BUG: "実害あり",
  ACCESSIBILITY_IMPROVEMENT: "改善対象",
  INTENTIONAL: "設計上の意図",
  FALSE_POSITIVE: "検出器の誤り",
  NON_INTERACTIVE: "操作対象でない",
  UNCLASSIFIED: "未分類",
};

/** Phase192が意図的に据え置いた3グループに共通する理由。 */
const HEADER_REASON =
  "ヘッダー高さ57pxを前提に、6ページ（HomePage・BillVotesPage・GeneralQuestionsPage×2・ExecutiveAnswersPage・ThemeDetailPage）のsticky絞り込みバーが`top-[57px]`で配置されている。" +
  "ヘッダー内の操作要素を44pxへ拡大するとヘッダー高さが変わり、この6ページのバーがヘッダーに潜り込む／隙間が空くため、同時変更なしには安全に拡大できない。" +
  "高さ36pxでWCAG 2.2 AA（2.5.8・24px）は充足しており、最近接の操作要素とも24px以上離れているため押し間違いは起きない。Phase192の判断を維持する。";

const BREADCRUMB_REASON =
  "パンくずリンクは高さ16px（text-xs 1行）だが、隣接する操作要素とは46〜58px離れておりWCAG 2.2 AA（2.5.8）の「間隔」例外を満たす。" +
  "44px化すると全ページの先頭に約28px加算され、スマートフォンで本文の見え始めが遅くなる（本サイトはスマホ表示を最優先する方針）。Phase192の判断を維持する。";

const INLINE_CITATION_REASON =
  "本文・注記文の中に組み込まれたインラインリンク（出典・関連ページへの引用）であり、高さは周囲の非リンク文字の行の高さで決まる。" +
  "WCAG 2.2 達成基準2.5.8の「インライン」例外に該当する。拡大すると文章の行送りが崩れ、かえって読みにくくなる。";

/**
 * 分類テーブル。`match` は「Phase191と同一のアルゴリズムで生成したセレクタ」に対する部分一致条件。
 * セレクタは実装のclass属性から生成されるため、実装を変更すると一致条件も変わる点に注意する。
 */
export const CLASSIFICATIONS = [
  // ---------- INTENTIONAL（Phase192が意図的に据え置いた3グループ） ----------
  {
    id: "header-desktop-nav",
    type: "tap-target-small",
    match: ["header.sticky", "nav.hidden.shrink-0.items-center.gap-1", "a.rounded-full.px-4.py-2.text-sm"],
    component: "src/components/SiteHeader.tsx（主要メニュー）",
    uiCategory: "header nav（PC用ナビゲーション）",
    classification: "INTENTIONAL",
    userImpact: "妨げない（md以上でのみ表示。36pxでAA充足、最近接56px）",
    reason: HEADER_REASON,
    proposal:
      "解決するなら、`top-[57px]`を使う6ページのsticky絞り込みバーを同時に変更する必要がある。" +
      "ヘッダー高さをCSSカスタムプロパティ（例：`--site-header-h`）で一元管理し、各stickyバーを`top-[var(--site-header-h)]`に置き換えたうえで、" +
      "ヘッダーのナビ・検索リンクを`min-h-11`へ拡大する手順であれば安全に実施できる。Phase197では提案のみとする。",
  },
  {
    id: "header-search-link",
    type: "tap-target-small",
    match: ["header.sticky", "a.flex.shrink-0.items-center.gap-1.5"],
    component: "src/components/SiteHeader.tsx（サイト内検索リンク）",
    uiCategory: "header nav（検索リンク）",
    classification: "INTENTIONAL",
    userImpact: "妨げない（36pxでAA充足、最近接92px）",
    reason: HEADER_REASON,
    proposal: "上記`header-desktop-nav`と同じ手順で同時に解決できる。Phase197では提案のみとする。",
  },
  {
    id: "breadcrumbs",
    type: "tap-target-small",
    match: ["nav.overflow-x-auto", "ol.flex.items-center.gap-1.text-xs", "a.shrink-0.rounded.whitespace-nowrap"],
    component: "src/components/Breadcrumbs.tsx",
    uiCategory: "breadcrumb（パンくずリンク）",
    classification: "INTENTIONAL",
    userImpact: "妨げない（16pxだが最近接46〜58pxで間隔例外を充足）",
    reason: BREADCRUMB_REASON,
    proposal:
      "44pxではなくWCAG 2.2 AAの下限である24pxに合わせるなら、リンクへ`inline-flex items-center min-h-6`を付けると" +
      "全ページの加算は約8pxに収まり、間隔例外に頼らず2.5.8を直接充足できる。レイアウト影響が全ページに及ぶため、Phase197では提案のみとする。",
  },

  // ---------- FALSE_POSITIVE ----------
  {
    id: "archive-notice-inline-link",
    type: "tap-target-small",
    match: ["div.mb-1.rounded-xl.bg-surface-container-low.p-4", "a.text-primary.underline"],
    component: "src/pages/CouncilDocumentsArchivePage.tsx（登録状況の注記文）",
    uiCategory: "inline citation（注記文中のインラインリンク）",
    classification: "FALSE_POSITIVE",
    userImpact: "妨げない（本文中のインラインリンク）",
    reason:
      "注記文の途中に置かれたインラインリンク（`…既存の議案賛否データ（/bills/votes）で…`）であり、実体は`tap-target-inline-link`である。" +
      "Phase191の判定は`display:inline`かつ`p / li / dd / td / blockquote / figcaption`のいずれかを祖先に持つ場合のみインライン扱いにしており、" +
      "このように`div`が直接テキストを含む場合を取りこぼしていた。Phase197の改良判定（同じ親要素に非空のテキストノードがあればインライン扱い）では" +
      "`tap-target-inline-link`へ再分類される。表示側の変更は不要。",
    detectorFix: "同じ親要素に非空のテキストノードがある`display:inline`の要素もインラインリンクとして扱う（`typeRevised`に反映済み）。",
  },

  // ---------- ACCESSIBILITY_IMPROVEMENT（Phase197で修正） ----------
  {
    id: "dashboard-session-links",
    type: "tap-target-small",
    match: ["div.mt-3.flex.flex-wrap.gap-x-4", "a.text-primary.underline"],
    component: "src/pages/DashboardPage.tsx（今の会期・委員会の導線リンク）",
    uiCategory: "text link（独立した導線リンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（最近接27pxで間隔例外は充足。ただし高さ20pxでAAA未達）",
    reason:
      "折り返し行に並ぶ独立した導線リンクで、文章の一部ではない。高さ20pxは行の高さで決まっているだけであり、" +
      "`inline-flex min-h-11 items-center`で44pxを確保しても情報は減らず、レイアウト前提も壊れない。",
    fixed: true,
    fix: "`inline-flex min-h-11 items-center`を付与（Phase192で他ページの導線リンクへ適用済みの方式に合わせた）。",
  },
  {
    id: "dashboard-policy-progress-link",
    type: "tap-target-small",
    match: ["section.rounded-xl.bg-surface-container-low.p-4.shadow-e1 > a.mt-2.inline-block.text-sm.text-primary"],
    component: "src/pages/DashboardPage.tsx（市長公約の進捗状況への導線）",
    uiCategory: "text link（独立した導線リンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（最近接36px。高さ20pxでAAA未達）",
    reason: "セクション末尾に単独で置かれた導線リンクであり、文章の一部ではない。44px化しても情報は減らない。",
    fixed: true,
    fix: "`inline-block` を `inline-flex min-h-11 items-center` へ変更。",
  },
  {
    id: "compensation-miyazaki-sort",
    type: "tap-target-small",
    match: ["table.w-full.min-w-[560px]", "thead", "button.rounded.focus-visible:outline"],
    component: "src/components/compensation/MiyazakiComparisonTable.tsx（表の並び替えボタン）",
    uiCategory: "sort control（表ヘッダーの並び替えボタン）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（sm以上でのみ表示。最近接123〜236px）",
    reason:
      "表ヘッダーの並び替えボタンが高さ16pxしかなく、WCAG 2.2 AA（24px）を大きさ自体では満たしていない（間隔例外でのみ充足）。" +
      "同じ役割のボタンは`src/pages/CouncilActivityPage.tsx`で既に`inline-flex min-h-11 items-center gap-1`を使っており、実装を揃えられる。",
    fixed: true,
    fix: "`inline-flex min-h-11 items-center`を付与し、CouncilActivityPageの並び替えボタンと実装を統一。",
  },
  {
    id: "council-activity-sort",
    type: "tap-target-small",
    match: ["table.w-full.min-w-[820px]", "thead", "button.inline-flex.min-h-11.items-center.gap-1"],
    component: "src/pages/CouncilActivityPage.tsx（全議員比較表の並び替えボタン）",
    uiCategory: "sort control（表ヘッダーの並び替えボタン）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（高さ44px確保済み。幅36〜40pxでAAA未達）",
    reason:
      "高さはPhase192で44pxを確保済みで、AAは充足している。残るのは短い列名（「氏名」等）のときに幅が36〜40pxになる点だけであり、" +
      "`min-w-11`を足せば見た目を変えずにAAA（44x44）も満たせる。",
    fixed: true,
    fix: "`min-w-11`を付与（文字は左寄せのまま、ボタンの当たり判定だけ44px幅にする）。",
  },
  {
    id: "verified-speech-card-title",
    type: "tap-target-small",
    match: ["li.rounded-xl.bg-surface-container-low.p-4.shadow-e1 > div.mt-2 > a.block.w-full.text-left"],
    component: "src/components/questions/VerifiedSpeechCard.tsx（カード見出しリンク）",
    uiCategory: "card action（カード見出しリンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（幅256px以上・最近接104px。高さ22pxでAA下限に2px足りない）",
    reason:
      "カード見出し全幅のリンクで、高さだけが1行分（22px）のためWCAG 2.2 AAの24pxに2px足りない（現状は間隔例外で充足）。" +
      "縦paddingを1段足せば大きさ自体で24pxを満たせ、カード内の余白も自然になる。",
    fixed: true,
    fix: "`py-1`を付与（高さ22px→30px）。",
  },
  {
    id: "general-question-card-title",
    type: "tap-target-small",
    match: ["li.rounded-xl.bg-surface-container-low.p-4.shadow-e1 > div.mt-2 > button.block.w-full.text-left"],
    component: "src/components/questions/GeneralQuestionCard.tsx（カード見出しの開閉ボタン）",
    uiCategory: "accordion（カード見出しの開閉ボタン）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（幅326px以上・最近接144px。高さ22pxでAA下限に2px足りない）",
    reason: "上記`verified-speech-card-title`と同じ形の見出しで、開閉操作を担うボタン。高さだけが1行分（22px）で24pxに届かない。",
    fixed: true,
    fix: "`py-1`を付与（高さ22px→30px）。",
  },
  {
    id: "bill-votes-detail-chip",
    type: "tap-target-small",
    match: ["div.flex.flex-wrap.items-start.justify-between > a.shrink-0.rounded-full.bg-primary-container.px-4"],
    component: "src/pages/BillVotesPage.tsx（一覧カードの「詳細を見る」）",
    uiCategory: "chip link（カードの主要操作）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（36pxでAA充足、最近接198px。AAA未達）",
    reason:
      "一覧カードの主要操作である「詳細を見る」チップが36pxで、同じ役割の`GeneralQuestionCard`・`VerifiedSpeechCard`の" +
      "「詳細を見る」（`inline-flex min-h-11 items-center`）と実装が揃っていない。",
    fixed: true,
    fix: "`inline-flex min-h-11 items-center`を付与し、他の一覧カードと実装を統一。",
  },
  {
    id: "council-activity-top3",
    type: "tap-target-small",
    match: ["li.flex.items-center.justify-between.gap-2 > a.hover:underline.focus-visible:outline"],
    component: "src/pages/CouncilActivityPage.tsx（発言量TOP3・提出者件数TOP3の議員リンク）",
    uiCategory: "text link（一覧内の議員リンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（最近接26pxで間隔例外は充足。ただし余裕が2pxしかない）",
    reason:
      "3件だけの短い一覧で、各行が高さ20px・行間6pxのため隣接する操作要素との距離が26pxしかない。" +
      "WCAG 2.2 AAの間隔例外（24px）は満たすものの余裕が小さく、スマートフォンでは押し間違いが起きやすい部類に入る。" +
      "3件のみのため44px化してもカードが極端に伸びない。",
    fixed: true,
    fix: "`inline-flex min-h-11 items-center`を付与（隣接距離26px→50px）。",
  },
  {
    id: "member-card-profile-link",
    type: "tap-target-small",
    match: ["div.group.relative.flex.min-w-0 > a.relative.z-10.mt-0.5.inline-block"],
    component: "src/components/MemberCard.tsx（公式プロフィールへの外部リンク）",
    uiCategory: "source link（外部の公式資料リンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（32pxでAA充足。最近接25pxはカード全面リンクとの距離で、意図的な重ね合わせ）",
    reason:
      "カード全面リンク（`absolute inset-0`）の上に重ねた外部リンクで、押し間違えると議員詳細ページではなく外部サイトへ移動する。" +
      "高さ32pxはAAを満たすが、重なりのある配置なのでAAA（44px）まで確保したほうが誤操作が減る。",
    fixed: true,
    fix: "`inline-block`を`inline-flex min-h-11 items-center justify-center`へ変更（表示文字は変えない）。",
  },
  {
    id: "compensation-mobile-source-link",
    type: "tap-target-small",
    match: ["div.space-y-3.sm:hidden", "a.mt-2.inline-block.whitespace-nowrap.text-sm"],
    component: "src/pages/CompensationPage.tsx（スマートフォン用カードの出典リンク）",
    uiCategory: "source link（出典リンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（最近接283px。高さ20pxでAAA未達）",
    reason:
      "スマートフォン幅でのみ表示される出典リンクで、カード内に単独で置かれている。文章の一部ではないため拡大しても読みやすさを損なわない。" +
      "スマートフォン専用表示であるだけに、タップ領域はむしろ優先して確保すべき箇所である。",
    fixed: true,
    fix: "`inline-block`を`inline-flex min-h-11 items-center`へ変更。",
  },
  {
    id: "council-activity-compare-checkbox-mobile",
    type: "tap-target-small",
    match: ["li.rounded-lg.p-3.border.border-gray-200", "label.flex.items-center.gap-1.5.text-xs", "input.h-4.w-4"],
    component: "src/pages/CouncilActivityPage.tsx（スマートフォン用一覧の「比較」チェックボックス）",
    uiCategory: "checkbox（比較対象の選択）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（`<label>`により実効46x16px、最近接81px。ただし高さ16pxでAA未達）",
    reason:
      "チェックボックス本体は16x16pxだが`<label>`で包まれているため実効タップ領域は46x16px（横は充足、縦が不足）。" +
      "スマートフォン専用表示の選択操作であり、縦16pxはWCAG 2.2 AAの24pxを大きさ自体では満たしていない（現状は間隔例外でのみ充足）。",
    fixed: true,
    fix: "`<label>`へ`min-h-11`を付与（実効タップ領域を46x44pxにする）。",
  },
  {
    id: "council-activity-compare-checkbox-table",
    type: "tap-target-small",
    match: ["table.w-full.min-w-[820px]", "tbody", "td.whitespace-nowrap.py-2.pr-2 > input.h-4.w-4"],
    component: "src/pages/CouncilActivityPage.tsx（全議員比較表の選択チェックボックス）",
    uiCategory: "checkbox（比較対象の選択）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（sm以上でのみ表示。最近接40px。ただし16x16pxでAA未達）",
    reason:
      "`<label>`で包まれていない裸のチェックボックスで、実効タップ領域が16x16pxしかない。" +
      "`aria-label`によるアクセシブルな名前は付いているが、当たり判定は広げられていない。",
    fixed: true,
    fix: "チェックボックスを`<label class=\"flex min-h-11 w-11 cursor-pointer items-center justify-center\">`で包み、実効タップ領域を44x44pxにする（表示上のチェックボックスの大きさは変えない）。",
  },
  {
    id: "dashboard-barlist-link",
    type: "tap-target-small",
    match: ["ul.space-y-3 > li > a.tap-highlight-none.block.rounded-lg.px-1.5"],
    component: "src/components/dashboard/BarList.tsx（会派別内訳の棒グラフ行リンク）",
    uiCategory: "text link（グラフ行リンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（28pxでAA充足、最近接40px。sm以上でのみ1行になりAAA未達）",
    reason:
      "スマートフォン幅では2段組で44px以上あり検出されない。sm以上で1行になると高さ28pxになる。" +
      "行全体がリンクなので幅は十分あり、`min-h-11`を足すだけでAAAも満たせる。",
    fixed: true,
    fix: "`block`を`flex min-h-11 flex-col justify-center`へ変更。",
  },

  // ---------- tap-target-inline-link 種別のうち、実体が「独立したリンク」であるもの ----------
  // Phase191の判定は「display:inline かつ p/li/dd/td/blockquote/figcaption を祖先に持つ」を
  // インラインリンクの条件にしているため、1リンク＝1項目の一覧（li直下のリンク、表セル内のリンク）まで
  // インライン扱いになっていた。ここでは実体に合わせて分類し直す。
  {
    id: "council-activity-question-rate-chips",
    type: "tap-target-inline-link",
    match: ["ul.mt-1.5.flex.flex-wrap.gap-x-2", "li > a.hover:underline"],
    component: "src/pages/CouncilActivityPage.tsx（B. 一般質問実施率100%の議員名一覧）",
    uiCategory: "text link（折り返し表示の議員名一覧）",
    classification: "REAL_BUG",
    userImpact: "妨げる（高さ17px・最近接17pxで、隣の議員名を誤って開きやすい）",
    reason:
      "議員名リンクを`flex-wrap`＋`gap-y-1`（縦4px）で詰めて並べているため、高さ17pxのリンクの中心同士が縦に17pxしか離れていない。" +
      "WCAG 2.2 達成基準2.5.8の大きさ（24px）も「間隔」例外（24px）も満たさず、「インライン」例外にも当たらない（各`li`はリンクだけを含み、文章ではない）。" +
      "スマートフォンで隣の議員のページを開いてしまう誤タップが現実に起こりうるため、実害ありとする。",
    fixed: true,
    fix: "各リンクへ`inline-flex min-h-11 items-center`を付与し、縦方向のタップ領域を44pxにする。",
  },
  {
    id: "mayor-detail-related-lists",
    type: "tap-target-inline-link",
    match: ["ul.mt-2.space-y-2 > li > a.text-sm.font-medium.text-primary.underline"],
    component: "src/pages/MayorDetailPage.tsx（関連政策・関連議案の一覧リンク）",
    uiCategory: "text link（1件1行の一覧リンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（最近接42pxで間隔例外を充足。高さ20pxでAAA未達）",
    reason:
      "`li`がリンクだけを含む一覧であり、文章中のインラインリンクではない（Phase191の判定条件では`li`を祖先に持つためインライン扱いになっていた）。" +
      "1件1行の一覧リンクなので、44px化しても文章の行送りは崩れない。",
    fixed: true,
    fix: "`inline-flex min-h-11 items-center`を付与。",
  },
  {
    id: "archive-detail-source-list",
    type: "tap-target-inline-link",
    match: ["ul.mt-2.space-y-2 > li.text-sm > a.break-words.text-primary.underline"],
    component: "src/pages/CouncilDocumentsArchivePage.tsx（詳細ページの出典リンク一覧）",
    uiCategory: "source link（出典リンク一覧）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（隣接するのは同じ一覧の別の出典リンクで、行が分かれており取り違えは起きにくい）",
    reason:
      "出典1件＝1行の一覧で、各行はリンクと確認状況バッジ（操作要素ではない）で構成される。文章中の引用ではないため、" +
      "44px化しても読みやすさを損なわない。行の高さが増えることで隣接リンクとの距離にも余裕が出る。",
    fixed: true,
    fix: "`inline-flex min-h-11 items-center`を付与（`src/pages/TimelinePage.tsx`で実績のある、折り返しを保つ書き方に合わせる）。",
  },
  {
    id: "council-activity-member-link-mobile",
    type: "tap-target-inline-link",
    match: ["div.space-y-3.sm:hidden", "li.rounded-lg.p-3.border.border-gray-200 > a.font-medium.text-on-surface"],
    component: "src/pages/CouncilActivityPage.tsx（スマートフォン用一覧の議員名リンク）",
    uiCategory: "card action（一覧カードの議員名リンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（52x24pxでAA充足、最近接75px。AAA未達）",
    reason: "カード内に単独で置かれた議員名リンクであり、文章の一部ではない。スマートフォン専用表示なのでタップ領域を優先して確保する。",
    fixed: true,
    fix: "`inline-flex min-h-11 items-center`を付与。",
  },
  {
    id: "council-activity-member-link-table",
    type: "tap-target-inline-link",
    match: ["table.w-full.min-w-[820px]", "tbody", "td.whitespace-nowrap.py-2.pr-3 > a.font-medium.text-on-surface"],
    component: "src/pages/CouncilActivityPage.tsx（全議員比較表の議員名リンク）",
    uiCategory: "text link（表セル内のリンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（sm以上でのみ表示。最近接40pxで間隔例外を充足）",
    reason: "表のセルに単独で置かれたリンクであり、文章中の引用ではない。行の高さが44pxになるだけで情報は減らない。",
    fixed: true,
    fix: "`inline-flex min-h-11 items-center`を付与。",
  },
  {
    id: "archive-detail-year-chips",
    type: "tap-target-inline-link",
    match: ["ul.mt-1.flex.flex-wrap.gap-1 > li > a.rounded-full.bg-surface-container-high.px-2.py-0.5"],
    component: "src/pages/CouncilDocumentsArchivePage.tsx（関連年度のチップリンク）",
    uiCategory: "chip link（年度チップ）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（最近接100px。高さ21pxでAA未達）",
    reason:
      "背景色と丸みを持つチップ型のリンクであり、見た目のうえでも文章ではなくボタン状の操作要素として提示している。" +
      "高さ21pxはWCAG 2.2 AAの24pxに届かず（現状は間隔例外でのみ充足）、チップである以上は大きさ自体で満たすべきである。",
    fixed: true,
    fix: "`inline-flex min-h-11 items-center`を付与。",
  },
  {
    id: "compensation-table-source-link",
    type: "tap-target-inline-link",
    match: ["table.min-w-[1150px]", "td.min-w-[220px].px-3.py-3.text-left > a.text-primary.underline"],
    component: "src/pages/CompensationPage.tsx（比較表の出典リンク）",
    uiCategory: "source link（出典リンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（最近接45pxで間隔例外を充足。高さ20pxでAAA未達）",
    reason: "表のセルに単独で置かれた出典リンクであり、文章中の引用ではない。",
    fixed: true,
    fix: "`inline-flex min-h-11 items-center`を付与。",
  },
  // ---------- 修正後（label=after）の再測定に残る検出 ----------
  // 修正で実装のclass属性が変わるとセレクタも変わるため、修正後の状態にも明示的な説明を与える。
  {
    id: "after-question-card-title",
    type: "tap-target-small",
    match: ["li.rounded-xl.bg-surface-container-low.p-4.shadow-e1 > div.mt-2 > a.block.w-full.py-1.text-left"],
    component: "src/components/questions/VerifiedSpeechCard.tsx（カード見出しリンク・修正後）",
    uiCategory: "card action（カード見出しリンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（30x256px以上でWCAG 2.2 AA充足。AAAの44pxには未達）",
    reason:
      "Phase197で高さ22px→30pxにし、WCAG 2.2 AA（2.5.8・24px）を大きさ自体で満たすようにした。" +
      "AAA（44px）まで広げるとカード1件あたり14px増え、一覧の見通しが悪くなるため、AA充足の30pxで止めている。",
    fixed: false,
  },
  {
    id: "after-question-card-toggle",
    type: "tap-target-small",
    match: ["li.rounded-xl.bg-surface-container-low.p-4.shadow-e1 > div.mt-2 > button.block.w-full.py-1.text-left"],
    component: "src/components/questions/GeneralQuestionCard.tsx（カード見出しの開閉ボタン・修正後）",
    uiCategory: "accordion（カード見出しの開閉ボタン）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（30x326px以上でWCAG 2.2 AA充足。AAAの44pxには未達）",
    reason: "上記`after-question-card-title`と同じ理由。AA充足の30pxで止めている。",
    fixed: false,
  },
  {
    id: "after-miyazaki-sort",
    type: "tap-target-small",
    match: ["table.w-full.min-w-[560px]", "thead", "button.inline-flex.min-h-11.items-center.rounded"],
    component: "src/components/compensation/MiyazakiComparisonTable.tsx（表の並び替えボタン・修正後）",
    uiCategory: "sort control（表ヘッダーの並び替えボタン）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（高さ44px確保済み。列名が短いとき幅24〜36pxでAAA未達）",
    reason:
      "Phase197で高さ16px→44pxにした。残るのは「市長」等の短い列名のときに幅が24〜36pxになる点だけで、WCAG 2.2 AA（24x24）は充足している。" +
      "`CouncilActivityPage`の並び替えボタンと違いこの表の数値列は`text-right`のため、`min-w-11`を足すと見出しの右端が数値の右端と揃わなくなる。" +
      "見た目の整合を優先し、幅は文字幅のままとする。",
    fixed: false,
  },
  {
    id: "after-compare-checkbox-mobile",
    type: "tap-target-small",
    match: ["li.rounded-lg.p-3.border.border-gray-200", "label.flex.min-h-11.items-center.gap-1.5 > input.h-4.w-4"],
    component: "src/pages/CouncilActivityPage.tsx（スマートフォン用一覧の「比較」チェックボックス・修正後）",
    uiCategory: "checkbox（比較対象の選択）",
    classification: "FALSE_POSITIVE",
    userImpact: "妨げない（実効タップ領域46x44px）",
    reason:
      "Phase197で`<label>`に`min-h-11`を付け、実効タップ領域を46x44pxにした。" +
      "チェックボックス自体の矩形（16x16px）は見た目のとおり変えていないため、見た目の矩形だけを見るPhase191の条件では引き続き検出される。",
    fixed: false,
  },
  {
    id: "after-compare-checkbox-table",
    type: "tap-target-small",
    match: ["td.whitespace-nowrap.py-2.pr-2 > label.flex.min-h-11.w-11.cursor-pointer > input.h-4.w-4"],
    component: "src/pages/CouncilActivityPage.tsx（全議員比較表の選択チェックボックス・修正後）",
    uiCategory: "checkbox（比較対象の選択）",
    classification: "FALSE_POSITIVE",
    userImpact: "妨げない（実効タップ領域44x44px）",
    reason:
      "Phase197でチェックボックスを`<label>`（`min-h-11 w-11`）で包み、実効タップ領域を44x44pxにした。" +
      "チェックボックス自体の矩形（16x16px）は変えていないため、見た目の矩形だけを見るPhase191の条件では引き続き検出される。",
    fixed: false,
  },

  {
    id: "bill-vote-detail-related-link",
    type: "tap-target-inline-link",
    match: [
      "ul.space-y-2 > li.flex.flex-wrap.items-center.justify-between > div.min-w-0 > a.text-sm.font-medium.text-primary.underline",
    ],
    component: "src/pages/BillVoteDetailPage.tsx（関連議案の一覧リンク）",
    uiCategory: "text link（1件1行の一覧リンク）",
    classification: "ACCESSIBILITY_IMPROVEMENT",
    userImpact: "妨げない（最近接78px。高さ20pxでAAA未達）",
    reason: "1件1行の関連議案一覧のリンクであり、文章中の引用ではない。",
    fixed: true,
    fix: "`inline-flex min-h-11 items-center`を付与。",
  },
];

/** グループ（`audit-tap-targets.mjs`が実測した集計）に対応する分類を返す。 */
export function matchClassification(group) {
  // 実測フィールドは、実測時（集計オブジェクト）と --render-only（保存済みJSON）で名前が異なるため両方を見る。
  const meetsAA = group.meetsWcag22AA ?? group.meetsWcag22AA_24px;
  const spacingOk = group.spacingExceptionOk;
  for (const rule of CLASSIFICATIONS) {
    if (rule.type && rule.type !== group.type) continue;
    if (!rule.match.every((m) => group.selector.includes(m))) continue;
    return {
      ruleId: rule.id,
      component: rule.component,
      uiCategory: rule.uiCategory,
      classification: rule.classification,
      reason: rule.reason,
      userImpact: rule.userImpact,
      proposal: rule.proposal,
      detectorFix: rule.detectorFix,
      fixed: rule.fixed ?? false,
      fix: rule.fix,
    };
  }

  // インラインリンク種別（Phase191が「本文中のインラインリンク」として要対応から除外した1,291件）は
  // 個別ルールを持たない場合、WCAG 2.2 2.5.8「インライン」例外に基づきINTENTIONALとして扱う。
  if (group.type === "tap-target-inline-link") {
    return {
      ruleId: "inline-citation-default",
      component: "（本文・注記文中のインラインリンク：複数ファイル）",
      uiCategory: "inline citation（本文中のインラインリンク）",
      classification: "INTENTIONAL",
      reason: INLINE_CITATION_REASON,
      userImpact: "妨げない（文章中のリンク。WCAG 2.2 2.5.8「インライン」例外）",
      fixed: false,
    };
  }

  // 修正後の再測定など、実装のclass属性が変わって上のルールに一致しなくなった場合の既定値。
  // 実測値だけから判定できる範囲で、安全側（過小評価しない側）に分類する。
  if (group.minEffectiveWidth >= 43 && group.minEffectiveHeight >= 43) {
    return {
      ruleId: "measured-effective-area-ok",
      component: "（修正後の再測定：実装ファイルは修正前のレポートを参照）",
      uiCategory: "（実測による自動判定）",
      classification: "FALSE_POSITIVE",
      reason:
        "実効タップ領域が44x44以上あり、見た目の矩形だけを見る検出条件による誤検出。" +
        "`<label>`で包んだ入力欄など、要素そのものの矩形は小さいまま操作領域だけを広げた実装がこれに当たる。",
      userImpact: "妨げない（実効タップ領域44px以上）",
      fixed: false,
    };
  }
  if (meetsAA && spacingOk) {
    return {
      ruleId: "measured-aa-ok-aaa-short",
      component: "（修正後の再測定：実装ファイルは修正前のレポートを参照）",
      uiCategory: "（実測による自動判定）",
      classification: "ACCESSIBILITY_IMPROVEMENT",
      reason:
        "WCAG 2.2 達成基準2.5.8（AA・24x24）は大きさ・間隔とも充足しているが、WCAG 2.1 達成基準2.5.5（AAA・44x44）には届かない。",
      userImpact: "妨げない（AA充足・AAA未達）",
      fixed: false,
    };
  }
  if (spacingOk) {
    return {
      ruleId: "measured-spacing-ok",
      component: "（修正後の再測定：実装ファイルは修正前のレポートを参照）",
      uiCategory: "（実測による自動判定）",
      classification: "ACCESSIBILITY_IMPROVEMENT",
      reason:
        "大きさは24x24未満だが、他の操作要素の中心と24px以上離れておりWCAG 2.2 2.5.8の「間隔」例外を満たす。押し間違いは起きないが改善余地がある。",
      userImpact: "妨げない（間隔例外で充足）",
      fixed: false,
    };
  }
  return {
    ruleId: null,
    component: "（未特定）",
    uiCategory: "（未分類）",
    classification: "UNCLASSIFIED",
    reason:
      "分類テーブルに一致する規則がなく、実測値でも「大きさ24px未満かつ隣接する操作要素まで24px未満」で自動判定できない。個別確認が必要。",
    fixed: false,
  };
}

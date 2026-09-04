/**
 * Phase209：市民向け本文に混入した「内部用語」を日本語へ言い換える表示レイヤーの変換。
 *
 * 背景：`src/data` 配下の `notes` / `definitionNote` 等は、調査の経緯を正確に残すために
 * 内部のフィールド名（`bondRedemptionFundYen` 等）・列挙値（`needsReview` 等）・
 * データファイル名（`billVotes.json` 等）・整理番号（`UNR-050` 等）・リポジトリ内パス
 * （`reports/...json` 等）をそのまま書いている。これらの文字列は `/timeline`・`/finance/*`・
 * `/committees/*` 等の一般市民向けページにそのまま表示されており、読み手には意味が分からない。
 *
 * 方針：**内部データ（JSON）は書き換えない**。調査記録としての正確さを保ったまま、
 * 画面へ出す直前にだけ市民向けの日本語へ言い換える。対応表に無い語はそのまま残す
 * （推測で言い換えない）。回帰は `scripts/test-text-quality.mjs` のレイヤー3で検出する。
 *
 * 使い方：データ由来の自由記述（notes・definitionNote・summary 等）を表示する箇所で
 * `{humanizeDataNote(note)}` のように包む。コード内に直接書いた説明文には使わない。
 *
 * 実装上の注意：後読み（`(?<=...)`）は古い iOS Safari で構文エラーになり、
 * 読み込み時点でページ全体が壊れるため使わない。直前の1文字は捕捉グループで受ける。
 *
 * Phase212 の追加分：
 * - 開発フェーズ番号（`Phase166`）・作業ブロック番号（`Block3`）は、当サイトを作る側の
 *   作業単位でしかなく、市民が辿れる資料ではない。日付と本文が残れば意味は失われないため
 *   **削除・一般化**する。
 * - レコードID（`fm32`・`m08`・`pf-org-016`・`civic-047`・`mayor-14-term-01`・`TASK-174`）は
 *   **削除しない**。削ると「既存civic-030（台風18号）・civic-053（…）」のように文が壊れ、
 *   出典の追跡もできなくなる。`fm*`・`pf-org-*` は公開URLのスラッグでもある。
 *   代わりに「整理番号」「調査タスク」と前置きし、内部の番号だと分かる形で残す
 *   （UNR-・INQ- を Phase209 が「未確認項目UNR-050」としたのと同じ方針）。
 *   番号そのものの意味は `/data-status` の凡例で説明する。
 * - 調査に使った道具の名前（`pdftotext`・`pdfjs-dist`・`WinRT`）は日本語の説明語へ置き換える。
 *
 * Phase217（データ注記に残る内部識別子の管理方針）：
 * `src/data` の注記本文に残っている内部識別子を、次の4分類で扱うことに決めた。
 * データ側は原則そのまま（＝調査記録としての正確さを優先）、表示側でだけ言い換える。
 *
 * - **A. 内部管理上必要（維持）**：出典追跡・監査履歴に不可欠なもの。
 *   レコードID（`civic-047`・`csp-35`・`mayor-03`・`fm32` 等）、実在するリポジトリ内パス
 *   （`reports/…json`・`scripts/…mjs`・`docs/…md`）、データファイル名、整理番号
 *   （`UNR-`・`INQ-`・`TASK-`）、開発フェーズ番号。**削除しない。**
 *   表示時は「整理番号◯◯」等と前置きするか、日本語の呼び名へ言い換える。
 * - **B. sourceRef へ移行できるもの**：注記本文に直接書かれた外部資料のURL等。
 *   既存の `sourceRefs` へ構造化できるが、文が壊れる恐れがあるため一括移行はしない。
 * - **C. 人間向けの文章へ変換できるもの**：内部の項目名（`fund.balance` 等）・列挙値
 *   （`confirmed_primary` 等）・型名（`CitySpecialPostRole` 等）・道具名（`WebFetch` 等）。
 *   下の対応表へ日本語を登録して、表示直前に言い換える。
 * - **D. 不要な残骸**：参照先が存在しない、意味を持たない断片。これだけ削除してよい。
 *
 * どれに当たるか迷うものは A（維持）に倒す。判定の回帰は `scripts/test-text-quality.mjs`
 * のレイヤー3〜3-3が担保する（3-3 は「英数字だけの識別子らしい語」を形で検出するため、
 * 対応表に無い新しい語が本文へ入り込んでも気付ける）。
 */

/**
 * `src/data` 配下のデータファイル名 → 市民向けの呼び名。
 * `xxx.json` の形でも、拡張子なしの `xxx` の形でも本文に現れるため両方を置換する。
 */
const DATA_FILE_LABELS: Record<string, string> = {
  archiveCouncilDocuments: "議案・条例・請願陳情のアーカイブデータ",
  archiveCouncilLeadership: "歴代の議長・副議長データ",
  archiveFiscalYears: "年度別の財政データ",
  archiveMayors: "歴代市長データ",
  archiveMayorTerms: "歴代市長の任期データ",
  archiveMemberAffiliations: "議員の会派・委員会所属データ",
  archiveMemberProfiles: "議員プロフィールデータ",
  archiveMemberTerms: "議員の任期データ",
  archivePolicies: "政策データ",
  billVotes: "議案賛否データ",
  citySpecialPosts: "市の特別職データ",
  civicTimelineEvents: "市政年表データ",
  councilSessions: "会期データ",
  councilSpeechSummaries: "会議録の発言要約データ",
  councilWatchedDocuments: "市議会の更新監視資料データ",
  dataQualitySummary: "データ品質のまとめ",
  electionResults: "選挙結果データ",
  financeDashboard: "財政ダッシュボードのデータ",
  formerMembers: "元議員データ",
  generalQuestions: "一般質問データ",
  kohoOcrSearchIndex: "広報のべおかの全文検索データ",
  mayor: "市長データ",
  mayorPromises: "市長公約データ",
  members: "現職議員データ",
  questionCollectionStatus: "一般質問の収集状況データ",
  searchIndex: "サイト内検索データ",
};

/**
 * 内部のフィールド名・列挙値 → 市民向けの日本語。
 * 「実際に公開ページへ表示されている語」だけを登録する（未表示の語を推測で増やさない）。
 */
const INTERNAL_TERM_LABELS: Record<string, string> = {
  // ---- 財政・基金・市債（金額フィールド） ----
  bondRedemptionFundYen: "減債基金",
  enterpriseAccountBudgetYen: "企業会計の予算額",
  fiscalAdjustmentFundYen: "広義の財政調整基金等",
  fiscalReserveFundYen: "財政調整基金",
  generalAccountBondBalanceYen: "一般会計の市債残高",
  generalAccountFinalBudgetYen: "一般会計の補正後予算額",
  generalAccountInitialBudgetYen: "一般会計の当初予算額",
  generalAccountSettlementYen: "一般会計の決算額",
  includingEnterpriseAccountsYen: "企業会計を含む残高",
  includingSpecialAccountsYen: "特別会計を含む残高",
  localAllocationTaxYen: "地方交付税",
  localTaxRevenueYen: "市税収入",
  municipalBondIssuanceYen: "市債発行額",
  nationalSubsidiesYen: "国庫支出金",
  ordinaryAccountLocalBondBalanceYen: "普通会計の地方債残高",
  otherSpecificPurposeFundsYen: "その他特定目的基金",
  perCapitaYen: "市民1人当たりの額",
  prefecturalSubsidiesYen: "県支出金",
  specialAccountBudgetYen: "特別会計の予算額",
  totalExpenditureYen: "歳出総額",
  totalRevenueYen: "歳入総額",
  totalThousandYen: "合計額（千円単位）",
  totalYen: "合計額",
  currentAccountRatioPercent: "経常収支比率",
  financialStrengthIndex: "財政力指数",
  realDebtServiceRatioPercent: "実質公債費比率",
  debtBalanceTrend: "市債残高の推移データ",
  fiscalAdjustmentFunds: "財政調整基金等のデータ",
  fundBalance: "基金残高",
  generalAccount: "一般会計",
  totalFunds: "基金の合計",
  fiscalYear: "年度",
  fiscalYear1958: "1958年度のデータ",
  "extractionMethod.specialCaseFY2000": "抽出方法の2000年度特例処理",
  specialCaseFY2000: "2000年度の特例処理",
  extractionMethod: "抽出方法",

  // ---- 出典・確認状況 ----
  verificationStatus: "確認状況",
  verificationNote: "確認メモ",
  sourceRefs: "出典情報",
  sourceRef: "出典情報",
  sourcePublishedDate: "出典の公表日",
  partiallyVerified: "一部確認済み",
  needsReview: "要確認",
  sourceUnavailable: "出典資料未確認",
  not_researched: "未調査",
  unconfirmed: "未確認",
  confidence: "確度",
  verified: "確認済み",
  confirmed: "確定",
  candidates: "候補者一覧",
  candidate: "候補（未確定）",
  disputed: "要再確認",

  // ---- 人物・任期・委員会 ----
  appointedDate: "就任日",
  retiredDate: "退任日",
  birthDate: "生年月日",
  deathDate: "没年月日",
  committeeId: "委員会の整理番号",
  linkedProfileId: "人物データとの紐付け",
  mayorId: "市長の整理番号",
  mayorRole: "市長の役職区分",
  mayorTermId: "市長任期の整理番号",
  memberProfileId: "議員プロフィールの整理番号",
  nameKana: "ふりがな",
  servedSessions: "在職した会期",
  termEnd: "任期終了日",
  termNote: "任期に関する注記",
  termStart: "任期開始日",
  termStartPrecision: "任期開始日の精度",
  visitedMunicipalities: "訪問先の自治体",

  // ---- 議案・一般質問・政策 ----
  billTitle: "議案名",
  sharedProposalStatement: "一括説明の原文欄",
  reason: "提案理由の欄",
  reasonCode: "理由の区分",
  commonText: "一括見出し文",
  existingBillVoteId: "対応する議案賛否データの整理番号",
  memberVotes: "議員別の賛否",
  proposerType: "提出者の区分",
  promiseText: "公約の原文",
  questionItems: "質問項目",
  relatedBill: "関連議案",
  relatedBillVoteIds: "関連する議案賛否データの整理番号",
  relatedBudget: "関連予算",
  reportStatus: "報告の状況",
  voteMethod: "採決方法",
  electionDate: "選挙期日",
  votingDate: "投票日",
  dateLabel: "日付の表記",
  fileName: "会議録ファイル名",

  // ---- 資料の機械処理（Phase212：調査に使った道具の名前は、市民には何のことか分からない） ----
  "pdftotext/xpdf": "PDF文字抽出ツール",
  pdftotext: "PDF文字抽出ツール",
  "pdfjs-dist": "PDF読み取りプログラム",
  "WinRT（Windows.Data.Pdf）": "Windows標準のPDF読み取り機能",
  WinRT: "Windows標準のPDF読み取り機能",
  "GetText3.exeテキスト": "会議録の本文テキスト",
  "GetText3.exeページ": "会議録の本文ページ",
  announcedDate: "公表日",
  effectStatus: "効力状況",
  inForce: "現に効力あり",
  unknown: "不明",
  rawValue: "指数化する前の実数",
  summaryStatus: "要約の確認状況",
  NEEDS_REVIEW: "要確認",
  ocrRequired: "文字認識（OCR）が必要",
  totalChars: "抽出できた文字数",
  "Read tool": "資料本文の読み取り",

  // ---- 議案説明の確認段階（内部の3段階区分） ----
  Level3資産: "詳しい説明まで確認済みの議案",
  Level1: "議決結果まで確認済み",
  Level2: "一次資料の本文まで確認済み",
  Level3: "市民向けの詳しい説明まで確認済み",

  /* ---- Phase217：注記本文が参照している「データの項目名そのもの」 ---- */
  notes: "注記欄",
  isEstimate: "見込み値かどうかの区分",
  debtServiceRatioPercent: "公債費比率",
  affiliationId: "会派・委員会所属データの整理番号",

  /* ----
   * Phase217：年度別の財政データは `fund.balance.◯◯` のように項目の場所を「.」でつないで
   * 書いている。区切りごとに別々の語として言い換えると「基金残高.減債基金」のように
   * なるため、つないだ形のまま対応表へ登録して1つの日本語にする（長い語から照合される）。
   * ---- */
  "fund.balance.fiscalReserveFundYen": "基金残高のうち財政調整基金",
  "fund.balance.bondRedemptionFundYen": "基金残高のうち減債基金",
  "fund.balance.otherSpecificPurposeFundsYen": "基金残高のうちその他特定目的基金",
  "fund.balance.sourceRefs": "基金残高の出典情報",
  "fund.balance": "基金残高",
  "debt.balance.ordinaryAccountLocalBondBalanceYen": "市債残高のうち普通会計の地方債残高",
  "debt.balance.sourceRefs": "市債残高の出典情報",
  "debt.balance": "市債残高",
  "budget.totalExpenditureYen": "予算の歳出総額",
  "budget.sourceRefs": "予算の出典情報",
  "budget.notes": "予算の注記欄",
  "finance.debtServiceRatioPercent": "財政指標の公債費比率",
  "finance.sourceRefs": "財政指標の出典情報",
  "population.sourceRefs": "人口の出典情報",

  /* ---- Phase217：調査の確度・判定を表す内部の区分（型定義ではなく調査メモ内の語） ---- */
  confirmed_primary: "一次資料で確認済み",
  confirmed_indirect: "間接的な資料で確認",
  confirmed_single_source: "単一資料のみで確認",
  directly_attributed: "本人が直接進めたと確認",
  follow_up_source: "追加調査の候補資料",
  SAME_ENTITY_RENAMED: "同一のものの名称変更",
  NOT_FOUND: "資料を確認できず",

  /* ---- Phase217：当サイトのデータ構造の名前（型名） ---- */
  CitySpecialPostRole型: "市の特別職の役職区分",
  ArchiveBudget型: "年度別の予算データの項目",

  /* ---- Phase217：調査に使った道具の名前（Phase212 と同じ方針） ---- */
  WebFetch: "ウェブ資料の取得",
};

/**
 * 置換対象にしない語（実在の固有名詞・URLの一部など）。対応表と重複させないための備忘。
 *
 * `GetText3.exe` は延岡市議会「会議録検索システム」のページを指すURLの一部であり、出典URLとしては
 * そのまま残す必要がある。ただし本文中に「GetText3.exeテキスト」「GetText3.exeページ」の形で
 * 書かれている箇所は市民には意味が分からないため、その2語だけを上の対応表で言い換えている
 * （URL中は `GetText3.exe?...` と続くため、「テキスト」「ページ」まで含む対応表の語には一致しない）。
 */
export const CITIZEN_TERM_PROPER_NOUNS = ["waiwaiPLAYLAB", "Qubena"];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 長い語から先に照合するための、結合済み正規表現（直前の1文字を捕捉して語境界とする）。 */
const TERM_PATTERN = new RegExp(
  `(^|[^A-Za-z0-9_])(${Object.keys(INTERNAL_TERM_LABELS)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|")})(?![A-Za-z0-9_])`,
  "g",
);

/** `xxx.json` の形（パス区切りの直後にも現れるため、直前の文字は問わない）。 */
const DATA_FILE_JSON_PATTERN = /([A-Za-z][A-Za-z0-9]*)\.json/g;

/**
 * 拡張子なしで本文に現れる形。URL のパス断片（`/mayor/` 等）を巻き込まないよう、
 * 直前が `/` や英数字の場合は置換しない。
 */
const DATA_FILE_BARE_PATTERN = new RegExp(
  `(^|[^/A-Za-z0-9._-])(${Object.keys(DATA_FILE_LABELS)
    .sort((a, b) => b.length - a.length)
    .join("|")})(?![/A-Za-z0-9._-])`,
  "g",
);

/**
 * 表示直前に内部用語を日本語へ言い換える。
 * 対応表に無い語はそのまま残す（推測で言い換えない）。
 */
export function humanizeDataNote(text?: string | null): string | undefined {
  if (text == null) return undefined;
  if (text === "") return "";
  let out = text;

  // 1) リポジトリ内のパス（市民には辿れないため、何を指すかだけを日本語で残す）
  out = out.replace(
    /(^|[^A-Za-z0-9/])src\/data\/([A-Za-z][A-Za-z0-9]*)\.json/g,
    (_m, before: string, name: string) =>
      `${before}当サイトの${DATA_FILE_LABELS[name] ?? "データファイル"}`,
  );
  out = out.replace(/[A-Za-z][A-Za-z0-9]*\.backup\.json/g, "当サイトのバックアップデータ");
  out = out.replace(/reports\/[A-Za-z0-9._/-]+\.(?:json|md)/g, "当サイトの調査記録");
  out = out.replace(/scripts\/[A-Za-z0-9._/-]+\.(?:mjs|ts|ps1)/g, "当サイトの処理スクリプト");

  // 2) 開発フェーズ番号・作業ブロック番号（Phase212）。
  //    当サイトを作る側の作業単位を指すだけの番号で、市民が辿れる資料ではない。
  //    「いつ・何を確認したか」は日付と本文が残るため、番号を外しても意味は失われない。
  out = out.replace(/[（(]\s*Phase\s?\d+(?:\s?[-–—〜～]\s?\d+)*\s*[)）]/g, "");
  out = out.replace(/Phase\s?\d+(?:\s?[-–—〜～]\s?\d+)*\s*(?=追記|補足)/g, "");
  out = out.replace(/Phase\s?\d+(?:\s?[-–—〜～]\s?\d+)*/g, "これまでの確認作業");
  out = out.replace(/(^|[^A-Za-z0-9_])Block\s?(\d+)/g, "$1調査区分$2");

  // 3) 整理番号（内部台帳の番号。何の番号かが分かるよう日本語の見出しを付ける）
  out = out.replace(/UNR-(\d+)/g, "未確認項目UNR-$1");
  out = out.replace(/INQ-(\d+)/g, "照会事項INQ-$1");
  out = out.replace(/TASK-(\d+)/g, "調査タスクTASK-$1");
  out = out.replace(/disputed-(\d+)/g, "要再確認項目$1");
  out = out.replace(/acl-chair-(\d+)/g, "第$1代");
  // データ側の実際のIDは `acl-vicechair-51`（ハイフン2つ）。旧表記も残しておく。
  out = out.replace(/acl-vice-?chair-(\d+)/g, "第$1代副議長");

  // 3-2) レコードID（Phase212）。当サイト内の1件を指す番号で、削ると
  //      「既存civic-030（台風18号）・civic-053（…）」のように文が壊れる。
  //      公開URLのスラッグ（/members/fm09・/political-funds/pf-org-001）でもあるため消さず、
  //      「整理番号」と明示して、市民が内部の番号だと分かるようにする。
  //      Phase217：`mayor-03/mayor-14` のようにレコードIDを「/」で並べている書き方は、
  //      URL の一部と区別できるよう**両側ともレコードIDのときだけ**中黒へ置き換える。
  //      これをしないと、次の置換が「/」を URL とみなして前置きを付けられない。
  out = out.replace(
    /(^|[^/A-Za-z0-9_-])((?:mayor-\d+(?:-term-\d+)?|pf-org-\d+|civic-\d+|csp-\d+|fm\d+|m\d{2,3}))\/(?=(?:mayor-\d+(?:-term-\d+)?|pf-org-\d+|civic-\d+|csp-\d+|fm\d+|m\d{2,3})(?![/A-Za-z0-9_-]))/g,
    "$1$2・",
  );
  //      Phase217 で、同じ性質の他のレコードID（市の特別職 `csp-35`・歴代市長 `mayor-03`・
  //      調査記録 `finding-019`／`ndl-src-08`・委員会活動報告 `car-…-2023`）も同じ扱いに揃えた。
  //      `election-mayor-2018` のような選挙IDは公開URL（/elections/…）そのものなので前置きしない。
  out = out.replace(
    /(^|[^/A-Za-z0-9_-])(archive-(?:fm|m)\d+(?:-[a-z]+)*(?:-\d+)?|mayor-\d+-term-\d+|mayor-\d+|pf-org-\d+|civic-\d+|csp-\d+|findings?-\d+|ndl-src-\d+|car-[a-z]+(?:-[a-z]+)*-\d{4}|fm\d+|m\d{2,3})(?![/A-Za-z0-9_-])/g,
    "$1整理番号$2",
  );
  // 任期の枝番（`mayor-04-term-02` の後半だけが本文に現れる書き方）は日本語の「第N期」にする。
  // 上のレコードIDの置換が先に走るため、`mayor-04-term-02` 全体はここでは分解されない。
  out = out.replace(/(^|[^A-Za-z0-9_-])term-0*(\d+)(?![A-Za-z0-9_-])/g, "$1第$2期");
  // 国立国会図書館デジタルコレクションの「コマ番号」を、調査時に `komma286-287` とローマ字で
  // 書き残している箇所がある。番号自体は出典の位置を示すため残し、読める表記に戻す。
  out = out.replace(/(^|[^A-Za-z0-9_])komma(?=\d)/g, "$1コマ");
  // 広報のべおかの号を指す内部ID（`koho_2026_04`）は、そのまま「◯年◯月号」と読める形にする。
  out = out.replace(
    /(^|[^A-Za-z0-9_])koho_(\d{4})_0*(\d{1,2})(?![A-Za-z0-9_])/g,
    (_m, before: string, year: string, month: string) => `${before}広報のべおか${year}年${month}月号`,
  );
  // 「id: fm32」のように内部のフィールド名が前置きされている書き方を整える。
  out = out.replace(/(^|[^A-Za-z0-9_])id:\s*(?=整理番号)/g, "$1");

  // 4) データファイル名（拡張子の有無どちらの書き方でも置換する。対応表に無いものは残す）
  out = out.replace(DATA_FILE_JSON_PATTERN, (m, name: string) => DATA_FILE_LABELS[name] ?? m);
  out = out.replace(DATA_FILE_BARE_PATTERN, (_m, before: string, name: string) => `${before}${DATA_FILE_LABELS[name]}`);

  // 5) フィールド名・列挙値
  out = out.replace(TERM_PATTERN, (_m, before: string, name: string) => `${before}${INTERNAL_TERM_LABELS[name]}`);

  // 6) 言い換えの結果できた重複（「減債基金（減債基金＝…）」等）と空の括弧を整理する
  out = out
    .replace(/([^\s（）「」]+)（\1）/g, "$1")
    .replace(/([^\s（）「」]+)（\1＝/g, "$1（")
    .replace(/([^\s（）「」]+)（\1、/g, "$1（")
    .replace(/（\s*）/g, "")
    .replace(/（\s*＝/g, "（")
    // 番号を外した跡に残る空白（「これまでの確認作業 でその記録を反映し」等）を詰める。
    .replace(/(これまでの確認作業)[ \t]+(?=[^\s\x21-\x7E])/g, "$1")
    .replace(/【([^【】]*?)[ \t]+】/g, "【$1】")
    .replace(/[ \t]{2,}/g, " ")
    // データ側に既に「整理番号◯◯」と書かれていた場合の重ね付けを1つに戻す（Phase217）。
    .replace(/(整理番号)+整理番号/g, "整理番号");

  return out;
}

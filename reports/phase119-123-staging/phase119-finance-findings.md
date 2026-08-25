# Phase119（旧称Phase61）財政データ調査レポート

生成日：2026-08-25

## スコープ

1. FY2025決算・FY2026当初予算など最新年度で、新規公開された指標がないか確認する。
2. 財政欠落24年度（1934-1948, 1951-1953, 1959, 1983-1987）について、「延岡市史」以外の新規一次資料経路で確認可能なものがないか再調査する（既に調査済みの経路は繰り返さない）。
3. 一次資料で確定できた値のみarchiveFiscalYears.jsonへ追加・登録する。
4. 確定できない場合はreports/phase33-master-unresolved-ledger.jsonと整合する形で記録する。

事前に`git log --oneline -30`、`reports/phase33-master-unresolved-ledger.json`、`reports/phase20-missing-years-status.json`、`reports/phase17〜19`、直近の`reports/phase109-118-staging/phase113-finance-audit-findings.json`（Phase113、2026-08-24付、FY2018-2024の歳入内訳を包括的に監査済み）を確認し、重複調査を避けた。

## 1. 最新年度（FY2025・FY2026）の再確認

延岡市公式サイトの財政課ページ（`/soshiki/18/`、`/soshiki/18/48504.html`「財政状況資料集」、`/soshiki/18/48505.html`「延岡市の財政事情」、`/soshiki/18/48507.html`「健全化判断比率」）を再取得し、Phase113の確認日（2026-08-11）から2週間経過後の状態を再確認した。

**結果：新規公開なし。** 「財政状況資料集」「健全化判断比率」ともに最新は令和6年度版（FY2024）のままで、令和7年度版（FY2025決算）は本レポート作成時点（2026-08-25）でも未公表。総務省「市町村決算カード」も同様に令和6年度版が最新。FY2025のarchiveFiscalYears.jsonレコードに`finance`（財政指標）・`budget`（歳入歳出内訳）セクションが依然として存在しないことも確認した（Phase113時点から変化なし）。

FY2025・FY2026の既存レコード（人口・基金見込額・市債残高・当初予算の一部）はPhase90〜Phase113で既に登録済みであり、今回新規に登録できた値はない。決算統計・財政状況資料集の公表を待つ必要がある（例年、対象年度終了から半年〜1年程度遅れて公表される）。

## 2. 財政欠落24年度の新規経路調査

既存ledger（UNR-014・UNR-015・UNR-027、reports/phase17〜20）によれば、「延岡市史」「宮崎県統計年鑑」「地方財政統計年報」「e-Stat地方財政状況調査」経由のオンライン調査は既に尽きており、現地閲覧・外部照会が必要と結論済み。今回は指示どおり同一経路を繰り返さず、以下2つの新規経路を調査した。

| 新規経路 | 調査内容 | 結果 |
|---|---|---|
| 宮崎県公式オープンデータカタログ「みやざき統計BOX」（data.stat.pref.miyazaki.lg.jp） | 決算関連データセット「統計年鑑219_市町村普通会計歳入歳出決算額（市町村別）」を実際にダウンロードし、xlsxパッケージで内容を確認 | 収録範囲は2008年度（平成20年度）以降のみ。FY1934-1948・1951-1953・1959・1983-1987はいずれも対象外。 |
| 総務省「市町村決算カード」オンライン公開範囲の再確認 | 総務省サイトの決算カード一覧ページを確認 | オンライン公開は平成13-14年度（2001-2002年度）以降のみ。既存で判明していたe-Stat地方財政状況調査の下限（FY1989）よりもさらに新しい。 |
| 国立公文書館デジタルアーカイブ・NDL資料の再検索 | 「延岡市 決算 昭和10年代」等で追加検索 | 新規に該当する一次資料は発見できず。 |

**結論：オンラインで新規に確定できた財政数値は0件。** 24年度すべてについて、現地閲覧（延岡市立図書館・宮崎県立図書館・国立国会図書館来館）または外部照会が必要という既存結論に変更はない。`reports/phase33-master-unresolved-ledger.json`のUNR-014・UNR-015・UNR-027へ、今回調査した新規経路とその結果（該当なし）を追記した（既存の`notes`への追記のみ、構造は変更していない）。

## 3. 新規に確定・登録できた値

24年度の欠落そのものは埋まらなかったが、Phase113の`gapsRemainingConfirmedNotFillable`に記載されていた「fund.balance.totalYen（基金全体）がFY2020-2023の4年度でnull」という既知の欠損について、新規の一次資料経路で確定できた。

### 新規発見資料：延岡市監査委員「歳入歳出決算審査意見書・基金運用状況審査意見書」

延岡市公式サイト「決算審査意見書・基金運用状況審査意見書の公表について」（`/soshiki/78/1210.html`）を調査したところ、令和4-6年度分（FY2022-2024）は現在も公開されていることを確認した（このうちFY2024分は既存データの出典として既に使われていたが、FY2022・FY2023分は本フェーズで初めて参照した）。令和2年度・令和3年度分（FY2020・FY2021）は現行ページから削除済み（直リンクは404）だったため、Internet Archive Wayback Machine（2023-10-24取得スナップショット）で当時のPDFを発見し、本文を確認した。

各PDFの「(5)基金の状況」セクションにある「基金の増減状況表」の合計行から、基金全体（一般会計・特別会計ベース）の年度末残高を新規登録した。

| 年度 | 新規登録値（totalYen） | 出典 | 備考 |
|---|---|---|---|
| FY2020（令和2年度） | 24,335,835,000円 | 令和2年度決算審査意見書（Wayback Machine経由、6024.pdf） | 現行サイトには非掲載 |
| FY2021（令和3年度） | 24,254,090,000円 | 令和3年度決算審査意見書（Wayback Machine経由、11482.pdf） | 現行サイトには非掲載 |
| FY2022（令和4年度） | 23,492,710,000円 | 令和4年度決算審査意見書（15731.pdf、現行サイトに掲載中） | |
| FY2023（令和5年度） | 22,882,729,000円 | 令和5年度決算審査意見書（20032.pdf、現行サイトに掲載中） | |

**クロスチェック：** 4年度すべてで、決算審査意見書に記載された財政調整積立基金・減債基金の値が、archiveFiscalYears.jsonの既存fiscalReserveFundYen・bondRedemptionFundYen（財政状況資料集ベース、既存登録値）と完全一致することを確認した（例：FY2022の財政調整積立基金5,032,997千円・減債基金2,752,946千円が両資料で一致）。また、隣接年度間で「前年度末残高」列と前年度の「本年度末残高」列が一致することも確認済み（例：FY2023の前年度末残高23,492,710千円＝FY2022の新規登録値と完全一致）。これにより資料の信頼性を二重に裏付けている。

**登録しなかった値：** 決算審査意見書の「その他特定目的基金」区分は、既存のarchiveFiscalYears.json（財政状況資料集ベース）の`otherSpecificPurposeFundsYen`とは分類基準が異なり、数値が一致しない（FY2022: 決算審査意見書10,349,531千円 vs 既存9,284,472千円）。この差異はFY2024で既に文書化されている既知の現象（分類基準の相違）であり、既存の`otherSpecificPurposeFundsYen`・`fiscalAdjustmentFundYen`は書き換えていない（既存データを壊さない方針）。

### 副次的な影響：validate-finance.mjsの新規WARN 3件

上記の理由により、`totalYen`（決算審査意見書ベース）と`fiscalAdjustmentFundYen + otherSpecificPurposeFundsYen`（財政状況資料集ベース）の合計が一致しないFY2021-2023の3年度で、新規WARNが発生した（FY2020は元々fiscalAdjustmentFundYenがnullのため対象外）。これはPhase113の`warnInvestigation`で既に扱われた「集計範囲の相違」と同種の、データの誤りではない正当な差異である。各年度の`definitionNote`・`sourceRefs.notes`にこの相違を明記した。`scripts/validate-finance.mjs`のロジックは変更しておらず、`errors=0`は維持されている（`warnings`が3→6に増加したのみ）。

## 4. 未確定のまま残った項目・今後の候補

- **FY2001-2008・FY2017・FY2025のfund.balance.totalYen**：今回発見した「決算審査意見書・基金運用状況審査意見書」ルートは、少なくともFY2020以降は毎年発行されていることを確認した。同じ資料の平成期分（FY2001-2008・FY2017）が公式サイトまたはWayback Machineに存在するか、次フェーズで調査する価値がある（今回は時間の都合でFY2020-2023の4年度のみ対応）。
- **FY2018のbudget.totalRevenueYen/totalExpenditureYenの会計区分**（Phase113のFINDING-P113-01）：一般会計ベースと普通会計ベースの約1%の差異が未解消。今回は新規調査を行っていない（同一の未解決事項の再調査は避けた）。
- **公債費負担比率**（決算カードに別途記載、FY2018:18.6%・FY2019:17.5%）：archiveFiscalYears.jsonの`finance`型に対応するフィールドが存在しない（`realDebtServiceRatioPercent`とは別概念）。フィールド追加は今回見送った。
- **ふるさと納税・人件費・扶助費・公債費（額）・普通建設事業費・自主財源比率**：現行のArchiveFiscalYear型（`src/types/index.ts`）にこれらの専用フィールドが存在しないことを確認した。データが揃った段階でのスキーマ拡張が必要（今回は大規模スキーマ変更を避ける方針のため見送り、将来フェーズへの申し送り）。

## 5. UI確認・改修

`src/pages/FinancePage.tsx`・`FinanceBudgetPage.tsx`・`FinanceDebtPage.tsx`・`FinanceFundsPage.tsx`および共通コンポーネント`src/components/finance/FinanceMetricSection.tsx`を確認した。

- 10〜20年推移グラフ・年度別数値表・出典表示（`FinanceLineChart`/`FinanceBarChart`/`CompareTable`/`SourceRefList`）・人口1人当たり基金残高（`FinancePage.tsx`の「市民1人当たりの金額」セクション）は既に実装済みであることを確認した。
- 「最新値」「前年度比」「表示期間中の最高値・最低値」の要約表示が存在しなかったため、`FinanceMetricSection.tsx`（`FinanceFundsPage`・`FinanceBudgetPage`・`FinanceDebtPage`・4つのCompareページで共通利用されているコンポーネント）へ、既存のチャートと表の間に4項目の要約カードを追加した。表示範囲内（全年度推移／2〜4件の比較のいずれでも）の値であることを明記し、「過去最高・過去最低（史上record）」と誤解されないよう文言に配慮した。前年度比は、直前の確認済みデータが暦年で1年前の場合のみ算出し、それ以外は「算出不可」と表示する（誤ったYoY比較を避けるため）。
- 既存の表示・レイアウトは変更しておらず、追加のみで大規模リライトは行っていない。

## 6. 財政データ収録率（archiveFiscalYears.json、全70レコード中）

| 指標 | Before | After | 対象年度 |
|---|---|---|---|
| fund.balance.totalYen（基金全体） | 12/70 | **16/70** | FY2020-2023の4年度を新規登録 |
| fund.balance.fiscalReserveFundYen | 22/70 | 22/70（変更なし） | |
| debt.balance.ordinaryAccountLocalBondBalanceYen | 36/70 | 36/70（変更なし） | |
| finance.currentAccountRatioPercent（経常収支比率） | 24/70 | 24/70（変更なし） | |
| finance.realDebtServiceRatioPercent（実質公債費比率） | 18/70 | 18/70（変更なし） | |
| finance.futureBurdenRatioPercent（将来負担比率） | 15/70 | 15/70（変更なし） | |
| finance.financialStrengthIndex（財政力指数） | 24/70 | 24/70（変更なし） | |
| budget.localTaxRevenueYen（市税収入等） | 17/70 | 17/70（変更なし、Phase113で既に拡充済み） | |
| budget.localAllocationTaxYen（地方交付税） | 16/70 | 16/70（変更なし） | |
| budget.nationalSubsidiesYen（国庫支出金） | 16/70 | 16/70（変更なし） | |
| population.population（人口） | 26/70 | 26/70（変更なし） | |

全70レコードは1933-2026年度の範囲に対応するが、財政欠落24年度（欠番）は分母（70）に含まれない点に留意。

## 7. データ検証結果

- `node --experimental-strip-types scripts/validate-data.mjs`：**errors=0、warnings=40**（本フェーズの変更で新規に発生したwarningはなし。既存のarchiveMayorTerms・councilSessions・archiveFiscalYears欠番に関するwarningのみ）。
- `node --experimental-strip-types scripts/validate-finance.mjs`：**errors=0、warnings=6（本フェーズで3件増加、いずれも上記「集計範囲の相違」で説明済み）、info=8**。
- `npx tsc -b`：エラーなし。
- `npx oxlint`：エラーなし。
- `npm run build`：成功（`validate:seo` errors=0 warnings=0、`validate:content` errors=0 warnings=0、2241ルートのprerender完了）。

## 8. 変更したファイル

- `src/data/archiveFiscalYears.json`：FY2020-2023のfund.balance.totalYenを新規登録（sourceRefs・definitionNote・notesを追加）。
- `src/components/finance/FinanceMetricSection.tsx`：最新値・前年度比・表示期間中の最高値/最低値の要約カードを追加。
- `reports/phase33-master-unresolved-ledger.json`：UNR-014・UNR-015・UNR-027へ、Phase119での新規経路調査結果（該当なし）を追記。
- `reports/phase119-123-staging/phase119-finance-findings.md`：本レポートを新規作成。

## 9. 残課題・次フェーズへの提案

1. 「決算審査意見書・基金運用状況審査意見書」ルートを、FY2001-2008・FY2017・FY2025について追加調査する（現行サイト・Wayback Machineの両方を確認）。
2. FY2018のbudget総額の会計区分統一方針を決定する（一般会計 vs 普通会計）。
3. ふるさと納税・人件費・扶助費・公債費（額）・普通建設事業費・自主財源比率のスキーマ追加を検討する（データ収集とセットで、既存データを壊さない形で）。
4. 財政欠落24年度は、オンライン経路がほぼ尽きていることを本フェーズで再確認した。現地閲覧・外部照会（reports/phase29-inquiry-templates.md等の既存照会文の実送付）が引き続き唯一の前進経路。

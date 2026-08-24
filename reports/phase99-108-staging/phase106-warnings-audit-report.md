# Phase106: validate:data warnings（40件）再分類監査レポート

- 生成日: 2026-08-24
- 対象コマンド: `npm run validate:data`
- 実行結果: `errors=0 warnings=40`（作業開始時・終了時とも同一。本タスク中にsrc/dataへの変更は行っていない）
- 前回監査: `reports/phase97-warnings-recheck-report.md`（21件時点、2026-08-23）
- 出力: `reports/phase99-108-staging/phase106-warnings-audit-findings.json`（40件全件の分類データ）

## 0. Phase97（21件）→Phase106（40件）への増加理由

Phase97時点の21件は次の内訳だった。

| ファイル | 件数 |
| --- | --- |
| councilSessions.json（`status:"要確認"`の自動生成警告） | 19 |
| archiveMayorTerms.json（任期空白13区間、1警告に集約） | 1 |
| archiveFiscalYears.json（年度欠番24件、1警告に集約） | 1 |
| 合計 | 21 |

今回の40件は、上記21件に加えて、`scripts/validate-data.mjs` 521-523行目に**Phase97以降新設された**summaryStatusチェックが原因で、councilSessions.jsonの同じ19レコード（`summaryStatus: "unavailable"`）に対して2つ目の警告「会期要約が確認待ち状態です（summaryStatus: unavailable）。」が追加で出るようになったため。

```js
if (s.summaryStatus && s.summaryStatus !== "verified") {
  warn(tag, `会期要約が確認待ち状態です（summaryStatus: ${s.summaryStatus}）。`);
}
```

19（既存metadata警告）＋19（新設summaryStatus警告）＋1（archiveMayorTerms）＋1（archiveFiscalYears）＝**40件**。新規のデータ劣化ではなく、既存の未確認19レコードに対する検証観点が1つ増えたことによる件数増加であることを確認した（本タスクの前提として与えられていた内容と一致）。

## 1. 分類基準（本タスク指定）

| 記号 | 意味 |
| --- | --- |
| A | actual_error（実際のデータ誤り） |
| B | data_gap（データ欠落、通常のbackfill待ち） |
| C | reference_pending（照会送付済み・回答待ち） |
| D | library_required（現地閲覧必要） |
| E | backfill_required（大規模データ収集必要） |
| F | historical_uncertainty（歴史資料自体の不確実性、解消見込み低い） |
| G | expected_warning（設計上意図された警告、対応不要） |
| H | false_positive（validate-data.mjs側の誤検知） |
| I | other |

## 2. サマリー

| 分類 | 件数 | 内訳 |
| --- | --- | --- |
| E（backfill_required） | 38 | councilSessions.json 19件×2警告（metadata＋summaryStatus）＝38件 |
| F（historical_uncertainty寄り） | 1 | archiveMayorTerms.json（13区間集約） |
| C（reference_pending、一部D相当を含む） | 1 | archiveFiscalYears.json（24年度集約。うち9年度は照会送付済み・回答待ち、15年度は調査未着手のE相当） |
| H（false_positive） | 0 | 該当なし |
| **合計** | **40** | |

**結論**: 40件全件を個別に検証した結果、false_positive（H）は0件だった。「長期間残っているから正常」という理由だけでの分類、および「warning数を減らすこと自体」を目的にした緩い判定は行っていない。

## 3. councilSessions.json（38件＝19レコード×2警告）

対象19レコード: `2000-09, 2004-06, 2005-09, 2006-06, 2007-06, 2008-09, 2009-09, 2010-06, 2011-03, 2012-09, 2013-06, 2013-09, 2014-03, 2014-09, 2015-09, 2016-09, 2017-06, 2018-12, 2019-03`

### 3-1. 「自動生成された定例会データです」（19件、Phase97から継続）

- **対象**: 上記19レコード（`status: "要確認"`）
- **原因**: 平成年代の会期メタデータ（開会日・閉会日・公式URL・documents）が延岡市議会公式サイト／会議録検索システムで個別確認されないまま自動生成投入されたプレースホルダー状態。
- **市民向け影響**: 当該定例会の開閉会日・公式リンクが未掲載。
- **修正可能性**: 単発修正では不可。19件×複数フィールドの個別照合が必要な大規模backfill。
- **次アクション**: UNR-023（`currentStatus: reference_pending`、`requiresBulkBackfill: true`）に基づき優先度順にbackfillを実施。
- **分類**: E（backfill_required）※Phase97から判定変化なし

### 3-2. 「会期要約が確認待ち状態です（summaryStatus: unavailable）」（19件、新設）

- **対象**: 上記19レコードと同一（`summaryStatus: "unavailable"`）
- **原因**: `scripts/validate-data.mjs` 521-523行目が新設され、`summaryStatus !== "verified"` の全レコードを警告するようになった。19件は要約文（summary/shortSummary）自体が未作成の状態。
- **validate-data.mjs側ロジックの検証（false_positive確認）**: `VALID_SESSION_SUMMARY_STATUSES`（455行目）は`["verified", "partially-verified", "pending", "unavailable"]`で、`"unavailable"`は正規の値。実データ（`src/data/councilSessions.json`）を確認したところ、対象19件は`summaryStatus: "unavailable"`かつ`summary`・`shortSummary`フィールドが未設定であることを確認した。ロジック・実データとも整合しており、誤検知ではない。
- **市民向け影響**: `src/pages/CouncilSessionDetailPage.tsx`（114-124行目）を確認したところ、`summaryStatus === "unavailable"`の場合は要約セクション自体を表示しない設計になっており、架空の要約文が表示されることはない。「この会期の概要」欄が空白になるのみで、誤情報のリスクはない。
- **修正可能性**: 上記3-1のmetadata確認と表裏一体。19会期の一次資料確認が完了すればsummaryも同時に作成可能。単独では解消しない。
- **次アクション**: UNR-023のbackfill実施時に、開閉会日・公式URLとあわせてsummary/summarySourcesの作成・summaryStatus更新もスコープに含めるよう明記することを提案する（現在のUNR-023 nextActionはメタデータ追加のみを明記しており、要約文作成への言及がない）。
- **分類**: E（backfill_required）※新規警告だが、根本原因は3-1と同じ未backfillレコード

## 4. archiveMayorTerms.json（1件・分類F寄り）

> 任期が登録されていない空白期間があります（13件）: 1937-01-06〜1937-03-06 ほか計13区間

- **対象**: 1937・1941・1942・1946・1947・1948・1952・1956・1966-67・1978・1994年の13区間
- **原因**: 前任者退任日〜次期就任日の間に1日超の空白があるが、「職務代理期間だったのか」「単なるデータ未収録なのか」を判別する情報がarchiveMayorTerms.jsonに存在しない。
- **市民向け影響**: 歴代市長年表・比較ページでこの13区間が空白のまま。ただし推測値で埋めていないため誤情報のリスクは低い。
- **修正可能性**: 戦前〜平成初期の13区間×延岡市史・官報等の一次資料照合が必要。戦前区間は資料自体の現存性も不確実なため、E（backfill_required）とF（historical_uncertainty）の境界事例。UNR-029のprimaryRoute（既存source ledger再確認）が未完了の段階のため、backfillの余地がまだ残っているとみてE寄りで維持しつつ、戦前分の一部は解消見込みが低いF要素を持つことを明記する。
- **次アクション**: UNR-029のprimaryRoute（source ledger再確認）に優先着手。戦前区間はNDL個人送信サービス等での延岡市史照合が必要。
- **Phase97との比較**: 変化なし（UNR-029自体はPhase97時点で既に起票済み）。

## 5. archiveFiscalYears.json（1件・分類C、一部E）

> 登録済み年度の範囲内(1933〜2026)に欠番があります: 24年度

- **対象**: UNR-014（1934-1948年度、15年度、`not_collected`）＋UNR-015（1951-1953・1959・1983-1987年度、9年度、`reference_pending`）
- **原因（9年度分）**: 宮崎県立図書館（INQ-001）・宮崎県総合政策部統計調査課（INQ-002）へ2026-08-21に照会送付済み、回答待ち（`reports/phase21-inquiry-tracker.json`で確認）。
- **原因（15年度分）**: 対象資料候補の調査自体が未着手。
- **市民向け影響**: 財政ダッシュボードの年度別グラフに空白が残る。推測値で埋めていないため誤情報のリスクは低い。
- **修正可能性**: 9年度分は外部機関の回答待ちで当方制御不能。15年度分は資料候補調査からの大規模backfillが必要。
- **次アクション**: 9年度分はINQ-001/INQ-002の回答受領を待つ。15年度分はUNR-014の対象資料候補調査に着手する。
- **Phase97との比較**: 変化なし（照会送付済みの状態もPhase97から継続）。

## 6. false_positive（H）の検証結果 — 該当なし

40件全件についてvalidate-data.mjs側のロジックを実際に読み、対応する実データ（councilSessions.json・archiveMayorTerms.json・archiveFiscalYears.json）と突き合わせた。3-1・4・5はPhase97で既に検証済みのロジックと同一で変化なし。3-2（新設のsummaryStatusチェック）についても本タスクで新たに検証し、ロジック・実データとも整合していることを確認した。

**結論**: false_positiveは0件。`scripts/validate-data.mjs`・`scripts/lib/validate-archive-common.mjs`への修正は行っていない（`codeFixesApplied: []`）。

## 7. 「warning数が増えた＝品質低下」に見えるUI表示の確認

`src/pages/DataStatusPage.tsx`の「出典・リンクの健全性（品質監査）」セクションで表示している「出典不足」件数（15件）は、`src/data/dataQualitySummary.json`経由で`scripts/validate-sources.mjs`（出典URL形式・公式ドメイン検証）の結果を集計したものであり、**`scripts/validate-data.mjs`のwarnings（今回の40件）とは別の検証系統**であることを`scripts/generate-quality-summary.mjs`（21-26行目）で確認した。

`src`ディレクトリ全体を`validate-data`でgrepしたところ、以下4ファイルで言及があったが、いずれもコード内コメント（検証ロジックへの参照）であり、warnings総数を市民向け画面に表示している箇所ではなかった。

- `src/lib/billVotes.ts`（48行目）
- `src/lib/councilSpeeches.ts`（122行目）
- `src/pages/MayorPromiseDetailPage.tsx`（228行目）
- `src/types/index.ts`（706行目）

**結論**: 「warning数が増えた＝品質低下」に見える市民向けUI表示は現時点で見つからなかった。コード修正・改善提案は不要と判断した。

## 8. 総括

- 40件全件について、(1) validate-data.mjs側のロジックを実際に読んでfalse positiveでないことを確認、(2) 関連UNR項目（UNR-023, UNR-029, UNR-014, UNR-015）の現状を再確認、(3) Phase97からの実質的な変化点（summaryStatus警告の新設）を明示した上で判定した。
- H（false_positive）は0件のため、`scripts/validate-data.mjs`への修正は行っていない。
- 新設されたsummaryStatus警告19件は、既存のmetadata未確認19件と同一レコードに対する2つ目の観点であり、フロントエンド側（CouncilSessionDetailPage.tsx）は`unavailable`状態を架空データなしで正しく扱っていることを確認した。
- warning総数（40件）を市民向けに単純表示している箇所は見つからず、UI改善提案は不要と判断した。
- 監査条件を緩めて警告を0件に見せる操作、および内容を検証せず「正常」と判定する操作は一切行っていない。

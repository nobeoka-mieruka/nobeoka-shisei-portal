# Phase54 sourceRefs・検索index・UI完全性 調査結果

- 調査日：2026-08-22
- 調査者：Phase54 worker（読み取り専用調査。src/components・src/pages等は未編集）
- 事前確認済み：`reports/phase43-source-ui-audit-findings.md`、`src/data/dataQualitySummary.json`、
  `src/lib/completeness.ts`、`src/lib/dataAvailabilityStatus.ts`

## 1. broken link 11件の再確認結果

`src/data/dataQualitySummary.json` の `linkHealth`（`generatedAt: 2026-08-16T23:25:10.204Z`、Phase43時点から
未再生成・変化なし）に記録された既知11件について、本フェーズで実際に生存確認（curl、`-L --max-time 15`）を行った。

| 分類 | 件数 | 結果 |
|---|---|---|
| `not_found_404`（恒久404と記録） | 4件 | **変化なし。4件とも引き続き404。** |
| `server_error`（503、Wayback一時障害と記録） | 7件 | **7件全てが200 OKへ復旧していることを確認（新たに修復）。** |

### 4件（依然404、確認済み恒久broken）
- `https://ja.wikipedia.org/wiki/仲田又次郎`
- `https://news.yahoo.co.jp/articles/54bca0ed2ef221f61c15fcb199c2377eda2bf8ba`
- `https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/27980.xls`
- `https://www.the-miyanichi.co.jp/kennai/_84868.html`

### 7件（Wayback Machine、503→200へ復旧確認）
- `.../20111114185739/.../kouhou/2011_05.pdf`（archiveFiscalYears.json）
- `.../20140715095752/.../display.php?cont=140324102214`（archiveMayors.json）
- `.../20140715140122/.../kouhou/2006year.html`（civicTimelineEvents.json）
- `.../20140715141044/.../kouhou/2008year.html`（civicTimelineEvents.json）
- `.../20140715143912/.../kouhou/2009year.html`（civicTimelineEvents.json）
- `.../20140715144720/.../kouhou/2007year.html`（civicTimelineEvents.json）
- `.../20190701010720/.../display.php?cont=180131171602`（archiveMayors.json/archiveMayorTerms.json）

**提案**：`scripts/generate-quality-summary.mjs`（linkHealth生成元）の再実行を次フェーズで行い、
`dataQualitySummary.json` の `broken` を11件→4件へ更新することを推奨する（本フェーズはread-only調査のため、
データファイル自体は更新していない）。DataStatusPage.tsx側は`linkHealth.broken.length`を動的参照しているため、
再生成すればUI表示も自動的に4件へ追従する見込み（コード変更不要）。

## 2. naming-collision risk（CompletenessStatus vs DataAvailabilityStatus）の追加調査と修正案

### 追加調査結果

- `CompletenessStatus`（`src/lib/completeness.ts`）を実際にimportしているのは `DataStatusPage.tsx` と
  `HomePage.tsx` の2ファイルのみ。
- `DataAvailabilityStatus`（`src/lib/dataAvailabilityStatus.ts`）を実際に使っているのは
  `EmptyState.tsx`・`DataAvailabilityBadge.tsx`（定義側）と、呼び出し側6ファイル
  （`MayorPage.tsx`・`MemberFormerDetailPage.tsx`・`PoliticalFundOrganizationDetailPage.tsx`・`PeoplePage.tsx`、
  他 `MemberDetailPage.tsx`/`KohoSearchPage.tsx`/`ElectionsPage.tsx`/`PoliticalFundsPage.tsx` は
  `EmptyState`をmessageのみで使用・statusは渡していない）。
- **CompletenessStatusを使うファイルとDataAvailabilityStatusを使うファイルは現状重複していない**
  （`DataStatusPage.tsx`・`HomePage.tsx`は`EmptyState`/`DataAvailabilityBadge`を使っていない）。
- 実際の`status`指定は全て文字列リテラル直書き（`status="under_review"`等）であり、`CompletenessStatus`型の
  変数を`DataAvailabilityStatus`のpropへ渡している箇所は発見できなかった（現時点でのバグは無し、Phase43の
  結論を追加調査でも再確認）。
- ただし、`DataAvailabilityBadge`のstatus propは`DataAvailabilityStatus`型であり、TypeScriptの構造的型付けにより
  `"under_review"`・`"unknown"`・`"not_collected"`という**文字列リテラルは両方の型のメンバーであるため**、
  将来どちらかの型の値・定数（例：`COMPLETENESS_STATUS_LABELS`のキーをループで回してbadgeへ渡す等の
  リファクタ）を誤って混用してもコンパイルエラーにならない。特に`under_review`はCompletenessStatus側
  「調査中」・DataAvailabilityStatus側「未確認」で意味が異なり、`unknown`はCompletenessStatus側「母数未確認」・
  DataAvailabilityStatus側「調査中」で意味が実質的に入れ替わっている点が最大のリスク。

### 修正案（実装はしない、提案のみ）

**推奨案：DataAvailabilityStatus側の衝突キー2つをリネームし、CompletenessStatusとの字面重複を解消する。**

理由：DataAvailabilityStatus は利用箇所が6ファイル・7呼び出し（`under_review`のみ、`unknown`は
未使用＝現状コードベースでは`status="unknown"`の呼び出し実績なし）と少なく、CompletenessStatus
（`DataStatusPage.tsx`の集計ロジック中核）より改修コストが小さい。

具体的な変更案：
- `under_review` → `unverified`（ラベル文言「未確認」は変更しない）
- `unknown` → `investigating`（ラベル文言「調査中」は変更しない、現状呼び出し実績0件のため実質リスクは低いが、
  型定義として重複が残るため合わせて解消する）
- `not_collected` は両者でラベルが完全一致（「未収録」）なので**そのまま維持**（衝突しても実害がないため
  リネーム対象から除外し、変更範囲を最小化する）
- `confirmed`・`unavailable` はCompletenessStatus側に同名キーが無いため変更不要

変更が必要になる箇所（実装時の参考、対応漏れ防止用）：
1. `src/lib/dataAvailabilityStatus.ts`：型定義・`DATA_AVAILABILITY_STATUS_LABELS`・`DATA_AVAILABILITY_STATUS_NOTES`
2. `src/components/DataAvailabilityBadge.tsx`：`STYLE_BY_STATUS`のキー
3. 呼び出し側の文字列リテラル（`under_review`のみ、6箇所）：
   - `src/pages/MayorPage.tsx:195`
   - `src/pages/MemberFormerDetailPage.tsx:253, 270, 284, 300`
   - `src/pages/PeoplePage.tsx:310`（`otherActivityCount > 0 ? "not_collected" : "under_review"`の三項演算子内）

代替案（比較用、非推奨）：CompletenessStatus側をリネームする案は、`DataStatusPage.tsx`内の
`STATUS_BADGE_STYLE`・`badgeFromStatus`・`COMPLETENESS_STATUS_LABELS`など参照箇所が多く
（Phase43調査時点で7区分×複数参照）、変更コストがDataAvailabilityStatus側より大きいため見送り。

型システムでの根本対策（将来的な追加検討、今回は範囲外）：文字列リテラル型のままだと将来また
別の語彙が同名キーを使う可能性が残るため、余力があれば`type DataAvailabilityStatus = { __brand: "DataAvailabilityStatus" } & (...)`
のようなnominal typing、または各語彙のキーに共通のprefixを付ける命名規約（例：全て`da_`/`cs_`）を
今後の新規語彙追加時のガイドラインとしてCLAUDE.mdやコード内コメントに明記することも検討に値する。

## 3. sourceRefs形式の一致確認結果（Phase34-53系の新規データ）

git状態を確認したところ、本フェーズ実行時点でPhase45-53系の並列workerによる未コミット差分は以下の3点のみ
存在した（他は無し）：

- `reports/phase45-55-baseline.md`（新規、ベースライン記録。データファイルへの変更なし）
- `reports/phase48-elections-findings.md`（新規、選挙データ監査。**新規確定レコード0件**のためsourceRefs追加なし）
- `reports/phase51-petitions-committees-findings.json`（新規、請願・陳情のアーカイブ層インデックス化ステージングデータ、20件）
- `src/data/councilSessions.json`（gitでは変更ありと表示されるが、`--ignore-space-at-eol`で実差分0行。
  改行コード正規化のみで実質変更なし、`phase45-55-baseline.md`の記載と一致）

このうち実際に新規sourceRefsを含むのは `reports/phase51-petitions-committees-findings.json`（20件、
既存`src/data/archiveCouncilDocuments.json`への統合を待つステージングデータ）のみ。

### フォーマット一致確認

`src/data/archiveCouncilDocuments.json`（既存13件）の`sourceRefs`スキーマと、
`reports/phase51-petitions-committees-findings.json`（新規20件）を1件ずつ比較した結果、
**フィールド構成・キー名・型が完全に一致**していることを確認した。

| 項目 | 既存（archiveCouncilDocuments.json） | Phase51ステージング | 一致 |
|---|---|---|---|
| `sourceRefs[].sourceUrl` | あり | あり | ✅ |
| `sourceRefs[].sourceTitle` | あり | あり | ✅ |
| `sourceRefs[].sourceOrganization` | あり（"延岡市議会"） | あり（"延岡市議会"） | ✅ |
| `sourceRefs[].extractionMethod` | `"pdf-extraction"` | `"pdf-extraction"` | ✅ |
| `sourceRefs[].verificationStatus` | `"verified"` | `"verified"` | ✅ |
| `sourceRefs[].accessedAt` | ISO日付文字列 | ISO日付文字列（`2026-08-22`） | ✅ |
| レコード直下`verificationStatus` | あり | あり | ✅ |
| `status`/`result`のenum値（petition/request型） | 英語enum（`adopted`/`rejected`/`withdrawn`/`continuedReview`/`decided`） | 同じ英語enumを使用 | ✅ |
| `petitionDetail`/`requestDetail` | 既存7件全て`{}`（個人情報非保持のため） | 全20件`{}` | ✅ |
| `existingBillVoteId` | あり（billVotes.jsonとの相互参照） | あり | ✅ |

さらに、`scripts/generate-final-quality-audit.mjs`（`reports/source-quality-audit.json`生成元）が
sourceRefs要素から`r.sourceUrl`のみを読み取る実装になっている点、`scripts/validate-sources.mjs`が
`ref.sourceUrl`・`ref.sourceTitle`を読む前提になっている点（archiveCouncilDocuments.json系の
チェックロジック）とも、Phase51ステージングデータのフィールド名は完全に合致している。

**結論：Phase51の新規sourceRefsは、既存の`source-quality-audit.json`生成ロジック・
`archiveCouncilDocuments.json`の確立済みスキーマの両方と形式的に完全一致しており、
統合時に追加のフィールド名変換・移行作業は不要と判断できる。**

`reports/ndl-historical-source-ledger.json`（史料台帳）は、`sourceUrl`ベースの一般的なsourceRefsとは
別目的（NDL資料の調査進捗管理、`ndl-src-XX`という独自ID体系）のファイルであり、Phase51のデータとは
直接比較対象にならない（Phase43の判断を踏襲）。今回、Phase45-53系のいずれのworkerもこの台帳への
新規追記は行っていないことを確認した（git diffで変更なし）。

`reports/phase48-elections-findings.md`は新規確定レコード0件と明記されており、sourceRefs追加は無い
（確認のみで問題なし）。

## 4. 検索index（generate-search-index.mjs）のカバー状況確認結果

`scripts/generate-search-index.mjs`を全文確認し、指示にある9種のデータ種別について収録状況を確認した。

| データ種別 | カバー状況 | 詳細 |
|---|---|---|
| 一般質問 | ✅ カバー済み | `generalQuestions.json`（type: "question"）＋`councilSpeechSummaries.json`（type: "speech"、会議録本文ベース） |
| 元議員 | ✅ カバー済み | `archiveMemberProfiles.json`（`legacyMemberId`なしのレコードのみ、type: "former-member"） |
| 議案 | ✅ カバー済み | `billVotes.json`（type: "bill"）＋`archiveCouncilDocuments.json`のdocumentType=bill/ordinance（type: "council-document"） |
| 請願 | ✅ カバー済み（将来のPhase51統合後も自動反映） | `archiveCouncilDocuments.json`のdocumentType=petitionを汎用的に処理（`DOCUMENT_TYPE_LABELS`に"petition"定義済み）。Phase51のステージングデータが将来`archiveCouncilDocuments.json`へマージされれば、スクリプト変更なしで自動的に索引化される |
| 陳情 | ✅ カバー済み（同上） | documentType=requestも同様に汎用処理済み |
| 選挙 | ✅ カバー済み | `electionResults.json`（type: "election"、コメントに"Phase55で新規登録"と記載あり＝スクリプト側は既に対応済み） |
| 財政 | ✅ カバー済み（集約1件のみ） | `financeDashboard.json`→"finance-main"、`mayorEntertainmentExpenses.json`→"mayor-entertainment-expenses-main"。年度別レコード単位ではなくページ単位の集約エントリ（既存の設計方針を踏襲） |
| 市政年表 | ✅ カバー済み | `civicTimelineEvents.json`（type: "page"、id: `civic-timeline-{id}`） |
| 広報OCR | ⚠️ **generate-search-index.mjsではカバーされていない（意図的な別系統）** | `kohoOcrSearchIndex.json`は`src/lib/kohoSearch.ts`経由で`KohoSearchPage.tsx`（`/koho/search`等、広報のべおか全文検索専用ページ）が直接読み込む専用データであり、サイト全体検索（`SearchPage.tsx`が使う`src/data/searchIndex.json`／`generate-search-index.mjs`）とは別のアーキテクチャ。`scripts/`配下に`kohoOcrSearchIndex.json`の生成スクリプトは存在せず（`scripts/validate-data.mjs`が検証のみ行う）、OCR実施フェーズのworkerが直接編集していると見られる |

**結論**：一般質問・元議員・議案・請願・陳情・選挙・財政・市政年表の8種は、いずれも既存の
`generate-search-index.mjs`で構造的にカバーされている（請願・陳情はPhase51データのマージ後も
スクリプト変更不要で自動索引化される設計）。広報OCR（`kohoOcrSearchIndex.json`）のみ、サイト全体検索
（`SearchPage.tsx`）とは意図的に分離された別の専用検索UI（`KohoSearchPage.tsx`）を持つため、
`generate-search-index.mjs`に含まれないのは設計上の欠落ではなく、既存アーキテクチャ上の役割分担と判断する。
ただし、サイト内検索（`SearchPage.tsx`）から広報OCR全文検索結果を横断的に見つけられない点は、
利用者体験としては改善余地として次フェーズへの提案事項に残す（"guide-main"のような固定エントリで
`/koho/search`ページ自体を`searchIndex.json`へ1件だけ登録する程度の軽微な拡張は、既存の固定ページ
登録パターン（staticPages配列）を踏襲すれば実装コストは低いと見られる。今回はコード変更をしない
方針のため提案のみ）。

## 5. 終了時報告

- **sourceRefs補強件数**：0件（本フェーズは読み取り専用調査のため、データへの追記は行っていない。
  Phase51ステージングデータのフォーマット適合を確認したのみ）
- **リンク修正候補件数**：7件（Wayback Machine 503→200へ復旧確認済みの7件。`dataQualitySummary.json`の
  再生成でbroken件数を11件→4件へ更新することを推奨。実データファイルの更新はスコープ外のため未実施）
- **warnings**：
  1. naming-collision risk（`CompletenessStatus`と`DataAvailabilityStatus`の`under_review`/`unknown`キー衝突）は
     現時点で実害となる誤表示は発生していないが、型システムでは検出できない潜在リスクとして引き続き残っている。
     本フェーズでDataAvailabilityStatus側2キーのリネーム案（`under_review`→`unverified`、`unknown`→`investigating`）
     を具体化した（実装はしていない）。
  2. `dataQualitySummary.json`のlinkHealthは2026-08-16生成のまま更新されておらず、実際には7件が既に復旧している
     （011件→4件が実態に近い）。次回の`scripts/generate-quality-summary.mjs`再実行を推奨。
  3. `kohoOcrSearchIndex.json`（広報OCR）はサイト全体検索から独立しており、これは設計上の分離と判断したが、
     利用者からは「サイト内検索で広報OCRがヒットしない」という体験になる点は改善余地として記録した。
  4. Phase45-53系の他worker（Phase45-47統合worker等）は本フェーズ実行時点で本調査に該当する新規`src/data`
     変更をまだコミット・ステージングしていない（`reports/phase45-55-baseline.md`のみ確認できた）。
     並行実行中のため、本フェーズのsourceRefs形式確認はその時点でファイル化されていたPhase51分のみが対象。

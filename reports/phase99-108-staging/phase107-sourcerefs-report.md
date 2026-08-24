# Phase107: 出典補強（Priority A：人物・財政・選挙・議案）調査・補強報告

作成日: 2026-08-24

## 1. 前提の確認

作業開始前に `reports/phase94-source-reinforcement-report.md`・`reports/phase94-source-reinforcement-findings.json`・`reports/phase79-source-coverage-findings.json` を読み、以下を確認した。

- phase79監査時点：`insufficientSourceCount`（出典フィールド皆無）23件、`partiallyDocumentedCount`（部分出典）299件。
- phase94：出典なし23件（`compensationPendingMunicipalities.json` 5件・`memberSpeechAnalysis.json` 18件）を特定し、報酬比較5市は既存データ（`miyazakiCompensationComparison.json`）で基礎報酬月額のみ再紐付け可能と結論。ただし**src/data側の実編集は行わず**、findings.jsonへの記録のみで終了していた。
- 前回セッションで報酬比較ページのUI文言のみ修正済み（データ移動は未実施）。

本フェーズはこれらを踏まえ、**Priority A（人物・財政・選挙・議案）の部分出典（partiallyDocumented）カテゴリ**を対象に、既存source ledgerとの再紐付け、および安全に実施可能な場合はWebFetchによるライブ再検証で出典を補強することを目的とした。

## 2. 対象カテゴリの特定

`reports/phase79-source-coverage-findings.json` の `categories` 配列（32カテゴリ）から、`partiallyDocumentedCount > 0` かつPriority A（人物・財政・選挙・議案）に該当するものを抽出した。

| データファイル | カテゴリ | partiallyDocumentedCount |
|---|---|---|
| `src/data/archiveFiscalYears.json` | 財政（歴史的年度別データ） | 26 |
| `src/data/electionResults.json` | 選挙結果（市長選・市議選） | 20 |
| `src/data/archiveMemberProfiles.json` | 市議会議員プロフィール（歴史アーカイブ） | 48 |
| `src/data/formerMembers.json` | 元市議会議員 | 58 |
| `src/data/archiveMemberAffiliations.json` | 市議会議員の会派・委員会所属歴 | 74 |
| `src/data/billProposalRoles.json` | 議案提出者・決議提案者 | 1 |

（`billVotes.json`・`citySpecialPosts.json`は編集禁止ファイルのため対象から除外。`billVotes.json`は元々partiallyDocumentedCount=0で対象外。）

## 3. 「資料名だけ」判定

各カテゴリのsourceRefs（またはsourceRef）を機械走査し、`sourceTitle`はあるが`sourceUrl`・`page`・`ndlPid/ndlKoma`のいずれも無い「資料名だけ」レコードを検索した。`archiveFiscalYears.json`・`electionResults.json`・`archiveMemberProfiles.json`・`billProposalRoles.json`のいずれも該当0件だった。`formerMembers.json`は構造化`sourceRefs`配列自体を持たない設計（`sourceNote`という自由記述テキストで管理）であり、phase79の基準では別軸の理由でpartial判定されている（4節参照）。

**結論：Priority A・partiallyDocumented側にも「資料名だけ」のsourceRefsは0件。** partial判定の実態は、`verificationStatus: "needsReview"`のまま（＝一次資料はあるが機械的な確認しかできていない）という状態であることを確認した。

## 4. needsReviewの原因ドメイン分類とライブ再検証

needsReviewの原因URLドメインを分類したところ、2種類に分かれることが分かった。

- **検証不能**：`kensakusystem.jp`（延岡市議会会議録検索システム、セッション依存CGIのため外部から再現不可）、`*.xls`/`*.xlsx`/`*.pdf`（この環境のWebFetchではバイナリを解析できず、実際に`https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28569.xls`で再試行しても「文字化けで読み取り不可」という結果になることを確認した）。→ `archiveFiscalYears.json`の該当分・`archiveMemberAffiliations.json`の委員会関連5件はここに分類され、phase79/94の既存所見どおり本フェーズでも解決不可と再確認した。
- **検証可能**：`go2senkyo.com`（選挙ドットコム、選挙結果ページ）と延岡市公式サイトの「近代の年表」HTMLページ。いずれも通常のHTMLページで、WebFetchによる実アクセスが可能であることを確認した。

検証可能な方については、実際にWebFetchでURLへアクセスし、レコード側の氏名・党派・得票数・当落・日付等がページの記載内容と一致するかを個別に確認した。**20の異なるURLを実際に取得し、対応する123件のレコード内容と突合した結果、不一致は1件も見つからなかった。** 一致が確認できたレコードのみ`verificationStatus`を`needsReview`→`verified`へ更新し、`notes`に再確認日（2026-08-24）と確認方法（WebFetch）を追記した。

## 5. 直接編集した内容

| ファイル | 補強前partiallyDocumented | 補強後 | 補強件数 |
|---|---|---|---|
| `src/data/archiveMemberProfiles.json` | 48 | 0 | 48 |
| `src/data/electionResults.json` | 20 | 0 | 20 |
| `src/data/archiveMemberAffiliations.json` | 74 | 19 | 55 |
| **合計** | | | **123件** |

- `archiveMemberProfiles.json`：1999年・2002年・2003年・2007年の延岡市議会議員選挙結果ページ（distinct URL 6件）を取得し、48名の元議員プロフィールの当選事実（氏名・ふりがな）を確認。
- `electionResults.json`：1986〜2025年の市長選・市議選12件（distinct URL、延岡市公式2件＋go2senkyo.com 10件）を取得し、候補者氏名・得票数・党派・当落を確認。
- `archiveMemberAffiliations.json`：`affiliationType==='party'`の69件（全件go2senkyo.com由来）のうち、`memberProfileId`の氏名（漢字）がページの氏名表記と完全一致する55件を党派情報とあわせて確認し更新。**残る19件は据え置いた**（内訳：14件はページが候補者名をひらがな表記のみで掲載しており、記録作成時点でデータ作成者自身が「氏名の漢字表記を機械的に読み取ったため念のためneedsReview」と明記していたケース。新たな確証を得られなかったため、推測での確定は行わなかった。残り5件は`kensakusystem.jp`（委員会役職の会議録）で検証不能）。

いずれの更新も、**候補資料の存在のみでverifiedにする、推測での氏名対応の確定は行っていない**。実際にページを取得し内容が完全一致することを確認できたケースのみを更新した。

## 6. 補強できなかった対象と理由

- **`src/data/archiveFiscalYears.json`**（partial 26〜38件、集計方法により幅あり）：原因はxlsx/pdfバイナリ資料。本フェーズで実際に1件WebFetchを試行し、phase79の既存所見（バイナリ解析不可）を再確認するにとどまった。`reports/ndl-historical-source-ledger.json`も再確認したが、31件中adopted済みは1件のみで新規の手がかりなし。
- **`src/data/billProposalRoles.json`**（partial 1件、`role-2019-09-ketsugi-1-submitter`）：共同提出者「ほか2名」の氏名がそもそも会議録本文に存在せず、既存source ledgerにも関連資料なし。推測補完は禁止のため未対応。
- **`src/data/memberSpeechAnalysis.json`**（insufficient 18件）：phase94の結論（出典漏れではなく分析未生成）を再確認。ソース再紐付けでは解決しない性質のため対象外のまま。

## 7. 編集禁止ファイルへの提案（findings.jsonに記録）

- **`src/data/compensationPendingMunicipalities.json`**：phase94時点の再紐付け候補（`miyazakiCompensationComparison.json`から基礎報酬月額）は依然有効。本フェーズでは追加情報なし。担当workerの判断待ち。
- **`src/data/formerMembers.json`**（編集禁止ではないが本フェーズでは見送り）：`sourceNote`自由記述は具体的だが、型定義（`FormerMember`インターフェース）が構造化`sourceRefs`を持たないため、phase79基準では機械的にpartial判定される。型定義変更は複数ページに影響するため、本フェーズの「安全な直接編集」の範囲を超えると判断し、次フェーズ検討事項として記録した。

## 8. 出典なし（insufficientSourceCount）のbefore/after

- **before: 23件、after: 23件（変化なし）**
- 対象23件（`compensationPendingMunicipalities.json` 5件・`memberSpeechAnalysis.json` 18件）はいずれも編集禁止ファイル、または性質上ソース再紐付けでは解決しない（分析未生成）案件のため、本フェーズでの増減はない。

## 9. 品質確認

- `npm run validate:data`：errors=0、warnings=40（既存警告のみ、本フェーズ由来の新規警告なし）
- `npm run typecheck`：エラーなし
- `npm run lint`（oxlint）：エラーなし
- `npm run build`：成功（653ms）。prerender 2241/2241 route生成、`validate:seo` failures=0 warnings=0、`validate:content` errors=0 warnings=0

## 10. 出力ファイル

- `reports/phase99-108-staging/phase107-sourcerefs-findings.json`
- `reports/phase99-108-staging/phase107-sourcerefs-report.md`（本ファイル）

git commit・push は指示どおり行っていない。

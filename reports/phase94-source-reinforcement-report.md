# Phase94: 出典なし23レコードの集中補強 調査報告

作成日: 2026-08-23

## 1. 対象の特定

`reports/phase79-source-coverage-findings.json` の `categories` 配列（32カテゴリ）を全件走査し、`insufficientSourceCount > 0` のカテゴリを抽出した結果、以下の2ファイル・計23レコードのみが該当することを確認した（他30カテゴリはすべて `insufficientSourceCount: 0`）。

| データファイル | カテゴリ名 | 件数 |
|---|---|---|
| `src/data/compensationPendingMunicipalities.json` | 報酬比較（データ未取得の市町村一覧） | 5件 |
| `src/data/memberSpeechAnalysis.json` | 議員別発言傾向分析（派生集計） | 18件 |

phase79の `recordsMissingSource` は前者は市町村名を明記していたが、後者は「m02(想定・未解析18件のうち代表例)」という曖昧な記載だったため、本フェーズで `src/data/memberSpeechAnalysis.json` を実走査し、`analysisStatus === "not-analyzed"` の18件（m18および元議員fm02〜fm49の17名）を確定した。

## 2. 優先度分類

- **Priority A（5件）**: `compensationPendingMunicipalities.json` の日南市・小林市・西都市・串間市・えびの市。報酬比較は財政・処遇に関する定量データのためAとした。
- **Priority B（18件）**: `memberSpeechAnalysis.json` の18議員（早瀬賢一、佐藤誠、松田和己、三上毅、白石良盛、田村吉宏、松本哲也、下田英樹、松田勝則、本部仁俊、猪股秀明、西原茂樹、太田龍、白石武仁、高木ますお、矢野仁祺、後藤哲朗、矢野せんいちろう）。一般質問・人物経歴に近接するためBとした。
- **Priority C**: 該当なし（0件）。

## 3. 主要な発見: 報酬比較5市は既存データで再紐付け可能

`src/data/miyazakiCompensationComparison.json`（phase79監査でfullyDocumented確認済み）を確認したところ、`compensationPendingMunicipalities.json` が「未取得」としている**5市すべての基礎報酬月額（市長・議長・副議長・議員）が、既に出典付きで収録済み**であることが判明した。

- 出典: 宮崎県「令和7年度市町村公務員制度の概況」第20-1表 特別職に属する職員等の定数及び給料（報酬）額
- URL: `https://www.pref.miyazaki.lg.jp/documents/107925/97124_20260330203858-1.xlsx`
- 確認日: 2026-07-14

ただし `compensationComparison.json`（延岡市・宮崎市・都城市・日向市の4市が既に採用している完全形式）は、市個別公式サイトの「人事行政の運営状況」ページ＋期末手当支給月数（`mayorBonusMonths`/`councilBonusMonths`）まで含む、より詳細なスキーマである。宮崎県資料には期末手当の支給月数が含まれないため、**基礎月額は再紐付けで解決できるが、期末手当支給月数は依然未確認**として残る。この点は `stillUnresolved` に明記した。

再紐付け候補5件はすべて `reLinkedFromExistingLedger` に記録した（title/URL/page/accessedAt/参照元データファイルを保持）。src/data側の実際の追記・スキーマ統合判断は、他workerとの衝突を避けるため本フェーズでは行っていない。

## 4. 主要な発見: 発言傾向分析18件は「出典漏れ」ではなく「未生成」

`memberSpeechAnalysis.json` の該当18件は `analysisStatus: "not-analyzed"` で、`overview`・`mainTopics`・`evidenceSpeechIds` 等がすべて空文字・空配列であることを確認した。これは出典の記載漏れではなく、**派生分析（発言傾向の要約テキスト）そのものが未生成**という状態である。

`src/data/councilSpeechSummaries.json` を照合したところ、該当18議員全員について元の発言記録（1〜11件ずつ）は既に存在し、phase79監査で `fullyDocumented`/`partiallyDocumented` と判定された正式な出典（延岡市議会会議録検索システム kensakusystem.jp のURL等）を保有している。つまり**一次資料自体は既に確保済み**であり、欠けているのは分析・要約の執筆作業であって、出典の再紐付けでは解決しない性質のものである。

src/data直接編集の禁止という本フェーズの制約もあり、この18件は `stillUnresolved` として記録し、次フェーズ（分析生成担当）への引き継ぎ事項とした。

## 5. 「資料名だけ」判定について

対象23件はいずれも `sourceRefs`/`sourceUrl` 等の出典系フィールド自体が存在しない、より重度の「出典フィールド皆無」であり、「資料名のみ記載」（タイトルはあるがURL・ページ等が一切ない）には該当しない。よって `insufficientSourceNameOnlyRecords` は0件とした。

参考として、部分出典（299件）側の代表例である `archiveMemberAffiliations.json`（74件全件 `needsReview`）を数件サンプル確認したが、`sourceTitle`・`sourceUrl`・`accessedAt`・`notes` が揃っており「資料名だけ」の状態ではなかった（`needsReview` の理由は `kensakusystem.jp` のURLがセッション依存CGIで外部から再現確認できない点であり、記載内容自体は具体的）。部分出典299件全件の悉皆確認は時間制約内では実施していない。

## 6. 確認した既存source ledger

- `reports/ndl-historical-source-ledger.json` — 財政・選挙・市長沿革のNDL文献が中心で、報酬比較データは対象外と確認。
- `reports/mayor-primary-source-matrix.json` — 市長プロフィール・任期が中心で対象外。
- `src/data/miyazakiCompensationComparison.json` — 5市の基礎報酬月額の再紐付けに使用（上記3参照）。
- `src/data/councilSpeechSummaries.json` — 18議員の元発言記録の出典存在確認に使用（上記4参照）。

新規Web検索（WebFetch/WebSearch）は、Priority Aの5件が既存データで基礎部分を再紐付けできたため実施しなかった。期末手当支給月数の個別確認（次フェーズ候補: 日南市・小林市・西都市・串間市・えびの市それぞれの公式サイト「人事行政の運営状況」ページ）は `stillUnresolved` に調査候補URLパターンを記録した。

## 7. 出力ファイル

- `reports/phase89-98-staging/phase94-source-reinforcement-findings.json`
- `reports/phase89-98-staging/phase94-source-reinforcement-report.md`（本ファイル）

src/data配下のJSONへの直接編集は行っていない。git commit / push も行っていない。

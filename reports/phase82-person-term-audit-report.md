# Phase82 人物・任期データ監査レポート

生成日: 2026-08-23

## 目的と方法

市長・助役・副市長・収入役・教育長・現職議員・元議員のデータ（`src/data/archiveMayors.json`、`archiveMayorTerms.json`、`mayor.json`、`members.json`、`formerMembers.json`、`archiveMemberProfiles.json`、`archiveMemberTerms.json`、`archiveMemberAffiliations.json`、`citySpecialPosts.json`、`electionResults.json`、`civicTimelineEvents.json`、`searchIndex.json`、`mayorPromises.json`、`kohoOcrSearchIndex.json`）について、ID重複、外部キーの整合性、任期の重複・空白、日付の矛盾、代数（ordinal）表記の整合性、氏名の表記揺れ、現職／元職の混入、「氏名確認済み」と「任期完全確認済み」の混同がないかを、Nodeスクリプトによる機械チェックと人手確認の両方で監査した。

事前に `reports/mayor-confidence-overview.json`、`reports/mayor-ordinal-crosscheck.json`、`reports/historical-mayor-research-status.json` を読み、既存の到達点（項目別confidence評価、全29任期のordinal照合、人物情報/任期の軸分け）を確認したうえで、重複調査を避けた。

**本監査ではデータファイルの直接編集は行っていない。既存の`src/data/*.json`は一切変更していない。**

## 主な結果サマリー

| チェック項目 | 結果 |
|---|---|
| person/member IDの重複 | なし |
| 外部キー（mayorId、previousMayorId、nextMayorId、legacyMemberId、legacyFormerMemberId、memberProfileId、relatedMemberId、electionResults.candidates.linkedProfileId）の整合性 | すべて実在するレコードを参照。ダングリングFKなし |
| 市長任期の重複 | なし（30任期すべて機械チェック済み） |
| 市長の日付矛盾（退任日<就任日等） | なし |
| 現職／元職議員の混入 | なし（members.json 26名＋formerMembers.json 58名＝archiveMemberProfiles.json 84名と過不足なく一致） |
| 氏名の表記揺れ（旧字体/新字体、姓名スペース等） | 系統的な検査で疑わしい例は発見されず |
| 同姓同名の別人混同 | 発見されず（既存データ内で「松田和己」と「松田満男」を別人として正しく区別する等、既存の運用が適切であることを確認） |
| 教育長・助役・副市長・収入役の任期重複／空白 | 見かけ上の重複1件、新規の空白（未収集期間）3件を発見（詳細下記） |
| 「氏名確認済み」だが「任期完全確認済み」ではない項目 | 複数件を洗い出し（詳細下記）。市長任期については既存UIが月／年精度を明示しており問題なし |
| 折小野良一の代数表記 | 既知の矛盾（Phase26）を再確認。新たな矛盾拡大はなし |
| **三浦久知の代数表記** | **新規発見：「第29代」と「第四代」の表記矛盾がサイト上に露出している** |

## 重要な新規発見：三浦久知市長の代数表記の矛盾

`mayor.json`・`archiveMayors.json`・`archiveMayorTerms.json`はいずれも延岡市公式サイトを根拠に「**第29代**延岡市長就任（令和7年7月20日）」で一致している。

一方、以下の3ファイルには「**第四代**延岡市長に三浦久知氏が就任」という表記が存在する。

- `src/data/mayorPromises.json`（`documents.koho_2025_09.label`）
- `src/data/searchIndex.json`（3箇所）
- `src/data/kohoOcrSearchIndex.json`（広報のべおか2025年9月号のOCR抽出本文）

さらに、`mayorPromises.json`の該当ラベルは`MayorPromiseDetailPage.tsx`（177行目）で実際に画面表示・aria-labelにも使われており、**サイト訪問者が「第四代」という誤った代数を目にする可能性がある**。

`mayorPromises.json`のnotesには「Windows OCR基盤による調査で発見、元PDF画像を目視確認済み」と記載されており、単純なOCR誤読と即断はできない。原本PDF（`https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/24619.pdf`）の該当箇所を人手で再確認する必要がある。本監査では新規の外部一次資料調査は行っておらず、既存データ間の矛盾の指摘に留めている。

## 折小野良一の代数表記（既存資料の再確認）

延岡市史（1993年版）の年表は折小野良一氏を「第十一・十二代」と表記するが、`archiveMayors.json`本体・`archiveMayorTerms.json`・`civicTimelineEvents.json`・`electionResults.json`・`reports/mayor-ordinal-crosscheck.json`・`searchIndex.json`は一貫して「**第12代・第13代**」としている。この矛盾はPhase26で既に発見され、`archiveMayors.json`のmayor-10レコードのnotesに明記済みであり、`MayorDetailPage.tsx`（142行目、`mayor.notes`を画面表示）を通じてサイト上でも開示されている（隠蔽なし）。

今回の監査で新たに確認したのは以下の2点。

1. この矛盾がPhase26以降、他のどのデータファイルにも波及・伝播していないこと（「第12代・第13代」表記は一貫して維持されている）。
2. 代数（ordinal）を検証可能な構造化フィールドとして保持していないという設計上の弱点。`archiveMayorTerms.json`には`ordinal`フィールド自体が存在せず、代数はもっぱら自由記述のnotes・title・summary等のテキスト内にのみ現れるため、今回のような矛盾はスキーマレベルの自動バリデーションでは検出できない（人手監査でしか見つからない）。

原因（助役在任期間の数え方の違い、職務代理者期間の扱いの違い等）は今回も特定できておらず、推測での確定は行っていない。

## 教育長・助役・副市長・収入役の任期チェック

### 見かけ上の重複（1件）

- **教育長**: 笠江孝一（csp-42、〜2018-10-08）と澤野幸司（csp-41、appointedDate 2018-09-14〜）が約25日重なって見える。ただしcsp-41自身のtermNoteに「appointedDateは議会の選任議決日であり、実際の着任は前任者の任期満了翌日（2018-10-09頃）と推定される」と明記されており、真の重複ではない可能性が高い。ただし`appointedDate`フィールドが「議決日」と「着任日」のどちらを表すかがレコードによって一貫していないという構造的な問題を指摘した。

### 新規に発見した空白期間（3件、市長の既知13件とは別軸）

1. **助役**: 1983-02-20〜2006-02-27（約23年間）。後藤梅雄（csp-46）の退任後、副市長制度発足（2006年、csp-35杉本隆晴）まで助役の記録が空白。
2. **助役**: 進藤林蔵（csp-52、1937-11-05就任、退任日未登録）〜江藤千吉郎（csp-53、1942-01-10就任）の間、重複・空白いずれも確認不能。
3. **副市長**: 杉本隆晴（csp-35、2006-02-28就任、退任日未登録）〜副市長2人制開始（2011年、原田幸二csp-36就任）の約5年間、継続在任か交代があったか確認不能。

## 「氏名確認済み」だが「任期完全確認済み」ではない項目

- `citySpecialPosts.json`の6件（csp-43町田訓允・csp-44黒木道男・csp-45伊東義男・csp-47高橋重行・csp-48吉田厚・csp-49高島安三郎）は、appointedDateまたはretiredDateの一方または両方が未登録で、氏名・在任の事実のみ確認済み。
- csp-54（佐藤、助役）は姓のみ判読でき、下の名前自体が未確認（既存データが正直に「佐藤」とのみ登録しており、これ自体は適切な扱い）。
- `archiveMayorTerms.json`の30任期中27任期（90%）で、就任日または退任日の精度が「day」ではなく「month」。ただし`src/lib/archiveMayors.ts`の`formatArchiveDateWithPrecision`関数が「（月まで確認・日は未確定）」等の注記を自動付与しており、UI上で日単位確定と誤認させる表示にはなっていないことを確認した。**この点は既存実装が適切であり、是正不要。**
- 監査委員（csp-23・24・25）3名が全員retiredDateなしで登録されており、通常2名体制の監査委員が実際に3名同時在任なのか、一部が既に退任済み（未登録）なのか確認できない。

## 確認できなかった／今回対象外としたこと

- 折小野良一・三浦久知以外の代数矛盾がないか、全市長・全役職についてテキストマイニングで横断チェックしたが、上記2件以外の新たな矛盾は検出されなかった（佐藤千吉郎「八代」と「8代」、房野博「14代」と「15代」等は表記スタイルの違いまたは複数任期の正当な差であり、矛盾ではない）。
- 折小野良一の代数矛盾の原因究明（外部一次資料の新規調査）は、タスク指示に従い今回実施していない。
- 三浦久知の「第四代」表記についても、原本PDFへの再アクセス・目視確認は今回実施していない（次の調査課題として記録）。

## proposedFixes（データ未編集、提案のみ）

詳細は`phase82-person-term-audit-findings.json`の`proposedFixes`を参照。いずれも本監査では適用していない。

1. `mayorPromises.json`の`koho_2025_09.label`（「第四代」表記）を原本PDF確認後に訂正（risk: low、ただし原本未確認のまま書き換えないこと）。
2. `searchIndex.json`の該当3レコードを、mayorPromises.json訂正後に再生成で同期（risk: low）。
3. `kohoOcrSearchIndex.json`のOCR原文は書き換えず、needsReview等の注記を追加する方向を検討（risk: low〜medium）。
4. `citySpecialPosts.json`のappointedDateフィールドについて、「選任議決日」と「着任日」を分離する将来的なスキーマ拡張を提案（risk: medium、型定義変更を伴う）。
5. 進藤林蔵・杉本隆晴の退任日を延岡市議会会議録・延岡市史等で追加調査することを提案（risk: low）。

## 結論

ID重複・外部キー破損・市長任期の重複や日付矛盾・現職元職混入・氏名の表記揺れといった構造的な不整合は、対象データ全体を通じて発見されなかった。既存の確認軸（人物情報 vs 任期、確度A/B/C）もおおむね適切に運用されている。

一方で、**三浦久知市長の「第29代」と「第四代」という代数表記の矛盾が、mayorPromises.json経由でサイト画面上に露出している**ことを新規に発見した。これは今回の監査で最も優先度の高い要対応事項であり、原本一次資料（広報のべおか2025年9月号PDF）の人手再確認を推奨する。折小野良一の代数矛盾は既知・既開示のまま変わらず、新たな悪化は確認されなかった。

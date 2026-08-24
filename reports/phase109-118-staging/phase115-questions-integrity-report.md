# Phase115：一般質問・発言データ突合レポート

作成日：2026-08-24
対象ファイル（独占編集）：`generalQuestions.json` / `councilSpeechSummaries.json` / `members.json` / `formerMembers.json` / `memberSpeechAnalysis.json` / `archiveMemberProfiles.json`

このフェーズでは**データの編集は行っていない**（一次資料で確認できる新規の誤りが検出されなかったため）。以下は監査結果。

## 1. 「397件」「1470件」の再検証（結論：現在は418件・1567件が正しい）

`src/lib/generalQuestionStats.ts`（サイト全体で使われる単一情報源）と同一ロジックをNode上で再実装し、2026-08-24時点の実データに対して独立に再計算した。

| 指標 | 定義 | 2026-08-24時点の正しい値 |
|---|---|---|
| confirmedCount（登壇・確認済み件数） | councilSpeechSummaries.jsonで会議録本文を確認済みの一般質問・代表質問・関連質問・総括質疑（等）の累計。1件＝議員1名の1回の登壇 | **418件** |
| totalQuestionItemCount（質問項目数） | confirmedCountの内訳、個別テーマ数の累計 | **1,567件** |
| scheduledCount（予定質問） | generalQuestions.json全件。会議録未公開の最新会期（令和8年6月定例会）の質問通告書ベース | **15件** |

**397件・1,470件は「誤り」ではなく「古い値」だった。** `reports/data-audit-2026-08-17.json`等の過去レポートを確認したところ、2026-08-15〜17時点では397件・1,470件が実際の正しい集計値として記録されていた。その後Phase89-98・99-108等で新しい定例会（例：2026年2月定例会分）の発言データがcouncilSpeechSummaries.jsonへ追加され続けたため、8日間で21件（397→418）・97項目（1,470→1,567）増加している。ユーザー提示の数字を鵜呑みにせず実データを再計算した結果として、現在の正しい値は418件・1,567件である。

サイト上のUI表示（HomePage・DashboardPage・DataStatusPage・GeneralQuestionsPage）はすべて`calculateGeneralQuestionStats()`による動的計算値を使っており、ハードコードされた397/1470はどのページにも存在しない。**唯一の例外**は`src/pages/GeneralQuestionsPage.tsx`48行目の開発者向けコメント（ページ分割の設計根拠説明、ユーザー非表示）で、「397件（2026-08時点）」という古い数値が残っている。機能への影響はないが、findings.jsonのF2として記録した（pages配下は独占編集対象外のため未修正）。

### 集計単位の区別（読者への見え方）

HomePage / DashboardPage / DataStatusPage / GeneralQuestionsPage のいずれも、以下の3種類を**別々のカード・別々の見出し**で表示しており、混同されない構成になっていることを確認した。

- 「一般質問（登壇・確認済み件数）」＝418件（1回の登壇＝1件）
- 「質問項目数」＝1,567件（1回の登壇に複数テーマが含まれるため件数が多くなる旨のhint文あり）
- 「予定質問（質問通告書ベース、会議録公開前）」＝15件（確認済みとは別集合である旨を明記）

GeneralQuestionsPageは見出しで「1. 最新会期の予定質問項目」「2. 確認済み一般質問アーカイブ」とセクション自体を分離している。

## 2. 現職・元議員の誤紐付け監査（結論：0件）

現職26名（members.json）・元議員58名（formerMembers.json）・councilSpeechSummaries.json全44レコード・memberSpeechAnalysis.json全44レコード・archiveMemberProfiles.json全84件・generalQuestions.json全15件について、以下を機械的に全件監査した。

| チェック項目 | 結果 |
|---|---|
| members.json / formerMembers.json のID重複 | 0件 |
| 現職・元議員間の氏名完全一致（同姓同名ペア） | 0件 |
| councilSpeechSummaries.jsonのmemberId解決（現職・元議員いずれか） | 44/44件すべて解決 |
| isFormerMemberフラグと参照先ID接頭辞の整合性 | 不整合0件 |
| speech.memberId とレコードmemberIdの一致（419発言） | 不一致0件 |
| generalQuestions.json（15件）のmemberId/memberNameとmembers.jsonの整合性 | 不一致0件 |
| memberSpeechAnalysis.json（44件）のmemberId解決・css側との集合一致 | 未解決0件、完全一致 |
| memberSpeechAnalysis.jsonのevidenceSpeechIds参照の有効性 | 無効な参照0件 |
| archiveMemberProfiles.jsonのlegacyMemberId/legacyFormerMemberId解決 | 未解決0件（現職26名全員カバー） |
| formerMembers.json 58名中、他ファイルと一切リンクのない孤立レコード | 0件 |
| formerMembers.jsonのservedSessionsとcouncilSpeechSummaries.json実データの整合性 | 不整合0件 |
| 現職の旧任期（term:"previous"）発言17名分と、formerMembers.json 58名の氏名照合 | 一致0件（世代交代・別人混同の兆候なし） |

さらに、**最もリスクが高い「複数年の空白期間を挟む継続議員」6名**（中城あかね：2006→2019年＝13年、平田信広：2009→2019年＝10年、甲斐正幸：2013/2014→2019年＝5年、上杉泰洋：2014/2016→2019年＝3〜5年、長友幸子：2015→2019年＝4年、甲斐行雄：2017→2019年＝2年）について、該当発言のverificationNoteを個別に精読した。いずれも「氏名完全一致、同姓同名なし」の機械照合記録、または本会議録原文の発言者見出しとr_Speakers.exe発言者一覧の突合による直接確認の記録があり、既存フェーズ（Phase49・57〜72等）で同姓同名リスクの検証が完了済みであることを再確認した。

**誤紐付け発見数：0件／修正数：0件**（修正すべき問題が見つからなかったため）。

## 3. その他の発見事項（findings.json参照）

### F1（medium）councilSpeechSummaries.jsonの解析状況カウンタ不整合

MemberDetailPageの「収録・解析状況」カードが表示する`analyzedSessionCount`（解析済み会期数）・`sessionsWithSpeechCount`（質問・質疑を確認した会期数）が、同じレコードの`speeches`配列の実データ（現職は現任期分のみ、元議員は全期間分）と一致しないレコードが44件中20件（現職19名＋早瀬賢一を含む）見つかった。いずれも「レコード上の数値 > 実データの一意会期数」で、4〜7会期分多く「解析済み」と主張している。特にm18（早瀬賢一）は現任期の実データが0件にもかかわらず「2会期解析済み」と表示される。

原因は特定できなかった（m01の場合、verificationNoteに明記された「追加した」会期数＝7件はspeeches配列の実データと一致するが、レコード上のanalyzedSessionCount=11とは一致せず、旧任期を含む全期間の一意会期数15とも一致しない）。一次資料による裏付けができないため、**このフェーズでは修正していない**。専用フェーズでのspeeches配列からの機械的な再計算（回収スクリプト作成）を推奨する。一般質問の件数表示（confirmedCount/totalQuestionItemCount）への影響はない。

### F2（low）GeneralQuestionsPage.tsxの開発者コメントが古い

397件という古い数値がコメントに残っている（ユーザー非表示、機能に影響なし）。pages配下は独占編集対象外のため未修正。

### F3（info）questionCollectionStatus.jsonが2026-08-05のまま古い

`src/data/questionCollectionStatus.json`が2026-08-05生成のまま更新されておらず、その後追加された会期が反映されていない可能性がある。独占編集対象外のため未修正。

## 4. データ検証

編集を行っていないため、`npm run validate:data`は現状確認として1回のみ実行した。

```
[validate-data] people-index: 現職議員=26 元議員=58 歴代市長=14
[validate-data] members=26 generalQuestions=15 billVotes=1177 councilSessions=61 — errors=0 warnings=40
```

errors=0。warnings=40はすべてcouncilSessions.json（自動生成会期の要確認マーク）・archiveMayorTerms.json（任期空白期間）・archiveFiscalYears.json（年度欠番）に関するもので、本フェーズの独占編集ファイルとは無関係。

## 5. 次フェーズへの推奨事項

1. F1（analyzedSessionCount等の不整合）の専用調査・修正フェーズを立てる。
2. GeneralQuestionsPage.tsx 48行目のコメント数値を更新する（軽微）。
3. questionCollectionStatus.jsonの再生成を担当フェーズで実施する。

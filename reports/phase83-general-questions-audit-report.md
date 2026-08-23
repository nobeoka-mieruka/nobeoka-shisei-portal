# Phase83 一般質問データベース監査レポート

作成日: 2026-08-23
対象: `src/data/generalQuestions.json`（15件）、`src/data/councilSpeechSummaries.json`（44議員バケット・419発言）、`src/data/councilSessions.json`（61件、うち`status:"要確認"`19件）、`src/data/billVotes.json`（1177件）、`src/data/members.json`（26件）、`src/data/formerMembers.json`（58件）

**本監査は読み取り専用調査であり、`src/data`・`scripts`等の共有ファイルは一切変更していません。git commit / push も行っていません。**

## 総括

対象データベースを全件突合した結果、**重複（duplicate）・orphan memberId・誤人物紐付け・会期不整合・billVoteの参照破損は0件**でした。想定していたような深刻なデータ破損は見つかりませんでしたが、以下の点を確認・記録しました。

- 一見「日付不整合」に見えた21件（令和8年3月定例会＝`2026-03`の代表質問/一般質問/関連質問）は、実際には公式会議録の見出し（「令和8年第24回定例会（第2号 2月25日）」等）どおりの正しい日付であり、機械チェックの誤検出でした。
- 「質問予定」と「実施確認済み」の混同は検出されませんでした。generalQuestions.jsonの令和8年6月定例会14件は、notesで「予定された質問項目」と明記しつつ、`newsletterConfirmed`フィールドで「登壇の事実は市議会だよりで確認済み、ただし内容は会議録未公開のため未確認」という別軸の情報を正しく分離しており、UIコンポーネント（`GeneralQuestionCard.tsx`）でもバッジ表示で区別されていることをコードで確認しました。
- `billVotes.json`と一般質問・委員会発言との相互リンク（`relatedQuestionIds`、`questionItems[].relatedBills`）は**全件が空**でした。データ破損ではなく、単純に未整備（今後の拡張余地）です。
- 一般質問関連の主要9ページを直接読み、「0件」と表示される全箇所を確認しましたが、いずれも「未確認・未収録」であることを明示する文言（「準備中です」「まだありません」「未取得」等）になっており、確認済み0件との混同は見つかりませんでした（Phase77・TASK-080等、過去のPhaseで既に手当て済み）。

## 詳細所見

### a. 重複（duplicate）
`generalQuestions.json`内の`memberId×sessionName×questionDate`キー一致、および`councilSpeechSummaries.json`内の`id`重複・`memberId×sessionId×date×speechType`キー一致・`memberId×date×meetingNumber`（sessionId違い）の3パターンで全件チェックしましたが、**重複は0件**でした。Phase77で新規追加された21件（partially-verified状態の記録、2000〜2019年度分）についても、既存レコードとの重複はありませんでした。

### b. orphan memberId
`generalQuestions.json`の15件、`councilSpeechSummaries.json`の44議員バケット・419発言すべてについて、`memberId`が`members.json`（26件）または`formerMembers.json`（58件）のいずれかに存在するかを確認しましたが、**orphanは0件**でした。

### c. 誤人物紐付け
`councilSpeechSummaries.json`の各議員レコードについて、`isFormerMember`フラグと実際の所属（`members.json`/`formerMembers.json`のどちらに存在するか）を突合、また現職議員の記録内で`speech.term:"previous"`（旧任期発言）が正しく設定されているかを、選挙日基準日（`councilSpeechPeriod.json`の`from:2023-04-23`）と照合して確認しました。**誤紐付けは0件**でした。また`formerMembers.json`のうち`servedSessions`が登録されている18名について、当該議員の全発言の`sessionId`が`servedSessions`に含まれるかも突合し、**不一致は0件**でした。Phase67-77で新規追加された2000-2019年度分（`summaryStatus:"partially-verified"`の21件）も同様に確認済みです。

### d. 会期不整合
`councilSpeechSummaries.json`の全419発言の`sessionId`が`councilSessions.json`（61件）に存在するかを確認しましたが、**孤立参照は0件**でした。`generalQuestions.json`は`sessionId`フィールドを持たず`sessionName`（テキスト）で会期を表現していますが、全15件が`councilSessions.json`の`title`と一致することを確認しました。

### e. 日付不整合
会期id（`YYYY-MM`形式）の年月と質問日／発言日の年月を機械的に突合したところ、21件が「1か月早い」候補として検出されました。すべて令和8年3月定例会（`sessionId:"2026-03"`、第24回定例会）の代表質問・一般質問・関連質問・総括質疑一般質問で、日付は2026-02-25〜2026-02-27でした。個別レコードの`summarySources[].title`（例：「令和8年第24回定例会（第2号 2月25日）」）を確認したところ、公式会議録の原文見出しどおりの正しい日付であることが分かりました。他の年度の3月定例会（2011, 2014, 2019-2022年）はいずれも3月上旬〜中旬に開会しており、この会期に限って2月下旬開会だったという事実です。**誤検出であり、データ修正は不要**と判断しました。

### f. 「質問予定」と「実施確認済み」の混同
- `generalQuestions.json`の令和8年6月定例会14件：`notes`に「実際の発言内容の確認ができておらず、質問項目は『予定された質問項目』」と明記。`newsletterConfirmed:true`（市議会だより第108号で開催確認済み）と矛盾しません。UIの`GeneralQuestionCard.tsx`も「会議録は未公開ですが、市議会だよりで開催・実施は確認済みです。」と正しく区別表示しています。
- `councilSpeechSummaries.json`の419発言全件について、`isPublished:true`かつ未確認系`summaryStatus`（`minutes-not-fetched`/`source-unavailable`/`pending`/`speaker-identification-pending`/`question-answer-link-pending`）の組み合わせを検索しましたが、**該当0件**（全件`verified`または`partially-verified`）でした。

### g. 未構造化資料
`generalQuestions.json`・`councilSpeechSummaries.json`双方で`questionItems`（またはその下位の`questionSummary`/`answerSummary`）・`topics`が空のレコードを検索しましたが、**該当0件**でした。

### h. 0件誤表示（UIコード確認）
以下のページ・コンポーネントのソースを直接読み、「0件」と表示される分岐すべてで文言を確認しました（修正は行っていません）。

| ページ／コンポーネント | 0件時の文言 | 判定 |
|---|---|---|
| `src/components/GeneralQuestionsSection.tsx` | 「現在、公開資料を確認しながら一般質問データを整理しています。未掲載であっても、一般質問や議員活動がなかったことを示すものではありません。」 | 問題なし |
| `src/pages/GeneralQuestionsPage.tsx`（予定質問／確認済みセクション） | 「一般質問データを準備中です。」／「確認済みの会議録ベース一般質問データを準備中です。」＋絞り込み時は「見つかりませんでした」で区別 | 問題なし |
| `src/pages/MemberDetailPage.tsx` | 「公開している発言記録はまだありません。」／`minutes-not-fetched`バッジ表示 | 問題なし |
| `src/pages/DataStatusPage.tsx` | TASK-080実装済み（confirmed_zeroと未収録を区別する7区分）。`membersWithoutConfirmedQuestion`は「未確認」ラベルで一覧化 | 問題なし |
| `src/lib/generalQuestionStats.ts` | confirmedCount／scheduledCountを意図的に合算しない単一情報源設計 | 問題なし |

## 委員会発言・議案賛否との関連付け（billVotes.json）

- `billVotes.json`（1177件）の`sessionId`は全件`councilSessions.json`のidと整合（孤立参照0件）、`session`テキストと`councilSessions.title`の不一致も0件でした。
- 一方、**議案↔一般質問の相互リンク（`billVotes[].relatedQuestionIds`）は1177件中0件で設定**、**発言↔議案のリンク（`councilSpeechSummaries.json`の`questionItems[].relatedBills`）も419発言中0件で設定**されていました。データの破損ではなく、この機能自体がまだ実データで使われていない状態です。UI側（`BillVoteDetailPage.tsx`）の参照コード自体は正しく実装されています。
- `billVotes.json`のデータ収集対象は`sessionId:"2019-06"`以降に限られており、Phase77で追加した19会期（2000-2019年度、`status:"要確認"`）にはbillVotesレコードが存在しません（設計上の対象外であり不整合ではありません）。
- 個人別記名投票（`memberVotes`）が実データとして入っているのは1177件中2件のみで、収録されている54名分の`memberId`はいずれも`members.json`/`formerMembers.json`の範囲内でした（孤立0件）。

## councilSessions.json Phase77「要確認」19会期の重点確認

`status:"要確認"`の19会期（2000-09〜2019-03）について、紐づく`councilSpeechSummaries.json`の発言記録（`summaryStatus:"partially-verified"`の21件がほぼ対応）を重点的に確認しましたが、`sessionId`の孤立参照・日付の会期逸脱・memberIdの誤紐付けはいずれも0件でした。

## その他の所見（参考情報、修正提案なし）

- `councilSpeechSummaries.json`の`speechType`分布は「一般質問」347件、「代表質問」26件、「関連質問」21件、「総括質疑・一般質問」23件、「総括質疑」1件、「議案質疑」1件でした。このうち「議案質疑」（fm06、2022-06-23）は`QUESTION_LIKE_SPEECH_TYPES`（`src/lib/questionLikeSpeechTypes.ts`）の対象集合に含まれておらず、一般質問データベースの集計・一覧から除外されます。コード上のコメントから意図的な除外と考えられますが、方針判断が必要な場合は別途確認してください。

## proposedFixes

今回の監査では、修正が必要な具体的な不整合レコードは見つかりませんでした（`proposedFixes`は空配列）。強いて挙げるなら以下は今後の拡張候補ですが、いずれも「壊れている」ものではないため緊急対応は不要です。

1. `billVotes.json`の`relatedQuestionIds`と`councilSpeechSummaries.json`の`questionItems[].relatedBills`を将来的に埋めていく（データ拡充作業。既存データの修正ではない）。
2. `generalQuestions.json`の令和8年6月定例会14件について、令和8年6月定例会の会議録が公開され次第、`notes`の「予定された質問項目」表記を実施確認済みへ更新する（既存の運用フローどおり）。

## 出力ファイル

- `reports/phase78-88-staging/phase83-general-questions-audit-findings.json`
- `reports/phase78-88-staging/phase83-general-questions-audit-report.md`（本ファイル）

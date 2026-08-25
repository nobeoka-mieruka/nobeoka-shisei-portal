# Phase132 一般質問・議案・財政の件数定義総監査 報告書

## 実施日
2026-08-25

## 目的
過去フェーズ（TASK-084〜086等）で使われていた「一般質問397件・質問項目1,470件」という古い数値が、その後の重複解消・データ拡張（Phase129のu129で1件重複解消等）を経て現在も残っていないか、サイト全体（`src/pages`・`src/components`・`src/lib`・`public`）を対象に網羅的に監査した。あわせて、`/questions`（一般質問データベース、ルート上は`/general-questions`ではなく`/questions`）・`/bills/votes`（議案賛否）・`/data-status`（データ収録状況）等の主要ページの実表示件数が、確定基準値（登壇419件／質問項目1,568件／議案賛否1,177件）と一致しているかをコードレベル・ビルド後HTMLレベルで確認した。

## 1. 古い数値（397／1,470／1470／1,177／1177）のgrep網羅調査結果

対象：`src/pages`・`src/components`・`src/lib`（TSX/TS全件）、`public/`、`functions/`、`scripts/`。

`src/components`・`src/lib`・`public/`・`functions/`・`scripts/`には該当する数値の記載は**一切なかった**。

`src/pages`では2件ヒットしたが、いずれも**現在正しい値（1,177件）を指すコメント**であり、古い数値ではない。

| ファイル | 内容 | 判定 |
|---|---|---|
| `src/pages/DataStatusPage.tsx:381` | コメント「下のcouncilExtra（1,177件の議案・採決データベース）と同じ〜」 | 現在値と一致。修正不要 |
| `src/pages/BillVotesPage.tsx:26` | コメント「1,177件（2026-08時点）を1ページに全件表示すると〜」 | 現在値と一致。修正不要 |

`src/data`配下のJSON（`members.json`・`miyazakiCompensationComparison.json`・`municipalityComparison.json`・`kohoNobeokaIssues.json`・`financeDashboard.json`・`electionResults.json`・`councilWatchedDocuments.json`・`councilSpeechSummaries.json`・`committeeReportActivity.json`・`archiveFiscalYears.json`・`similarMunicipalityFinanceComparison.json`）にも`397`等の数字がヒットしたが、全件を個別に確認した結果、**すべて無関係な数値との偶然の一致**（プロフィールURLの`1397.html`、報酬額`397000`円、決算額の一部`84,397,888`千円、会議録原文中の文字位置`pos=131470`等の出典URLパラメータ、選挙得票数`11776`等）であり、件数定義とは無関係。修正不要。

以下の2ファイルには`397件`・`1,470件`という**文字列そのもの**が見つかったが、いずれも過去の更新履歴・監査ログという性質上、書き換えないと判断した。

| ファイル | 内容 | 判定・理由 |
|---|---|---|
| `src/data/updateHistory.json`（id: u89, u90, u92、2026-08-15付近） | 「一般質問の『登壇・確認済み件数（397件）』と『質問項目数（1,470件）』」等、当時の実データを記録した更新履歴本文 | **修正しない**。更新履歴はTASKS.mdと同様に「その時点で確認できた事実の記録」であり、後日の件数変化に合わせて過去ログを書き換えると、記録の正確性・監査可能性を損なう（本タスク指示の「TASKS.mdの過去記録は書き換えない」と同じ考え方を適用）。 |
| `src/data/searchIndex.json`（37335行目付近） | `updateHistory.json`のu89 descriptionを`scripts/generate-search-index.mjs`が`truncate(u.description, 80)`で機械的に転記した検索インデックス | **修正しない（そもそも独立した誤りではない）**。`updateHistory.json`を単一情報源として自動生成されているだけであり、上記の判断に従う。 |
| `src/data/dataQualitySummary.json` / `src/data/blockedTaskClassification.json` | 「従来『登録1,177件』が直書きされていたが〜動的表示に修正済み」「billVotes総数（1,177件）は既に登録済み」等の**監査メモ・現状確認メモ** | 現在の正しい値（1,177）を指しており、古い数値ではない。修正不要。 |

**結論：サイトの実行コード（pages/components/lib/public/functions/scripts）に、397・1,470・1,470（コンマなし）のハードコードされた古い件数は1件も見つからなかった。** 過去の更新履歴（updateHistory.json）にのみ当時の記録として残っているが、これは意図的に保持すべき履歴であり修正対象ではない。

## 2. 主要ページの実表示件数と確定基準値の一致状況（重要な発見あり）

`npm run build`でローカルビルドし、生成された`dist/`配下のHTML（プリレンダリング済み）を実際にgrepして確認した。

### 2-1. 議案賛否（確定基準値：1,177件）
- `src/data/billVotes.json`の配列長：**1,177件**（全件`publicationStatus: "published"`、`rejected`/`error`は0件のため`publicBills()`でのフィルタ後も1,177件のまま）。
- `dist/data-status/index.html`：「議案・採決データベース（**1177**件）」と表示 → **一致**。
- `src/lib/billVotes.ts`の`publicBills()`を`BillVotesPage.tsx`・`DataStatusPage.tsx`など複数箇所で共通利用しており、集計ロジックの分裂はなかった。

### 2-2. 一般質問「登壇件数」「質問項目件数」（確定基準値：419件／1,568件）— **表示値は418件／1,567件で、基準値と1件ずつ異なる**

`councilSpeechSummaries.json`の`speeches`配列を**単純合計**すると419件（questionItems合計1,568件）になるが、サイト上で実際に「一般質問（登壇・確認済み件数）」として表示される値は、`src/lib/questionLikeSpeechTypes.ts`の`QUESTION_LIKE_SPEECH_TYPES`（一般質問・代表質問・関連質問・総括質疑・総括質疑一般質問の5区分のみ）でフィルタした後の件数であり、**418件／1,567件**である。

原因を特定した：`memberId: "fm06"`（元議員）の`id: "fm06-2022-06-23-gian-shitsugi"`（令和4年6月定例会）が、`speechType: "議案質疑"`として登録されている。この記録の`shortSummary`には「本人が原文で『一般質問する予定ではなかったが、追加提案された二次補正予算について議案質疑をさせていただきます』と明言しており、一般質問には含めていない」と明記されており、**意図的に一般質問ではないものとして区別・登録されたレコード**である（`questionItems`を1件持つため、質問項目数の差分も1件）。

`QUESTION_LIKE_SPEECH_TYPES`は`議事系区分は含めない`という設計方針のコメント付きで一般質問データベースの単一情報源として運用されており、これは既存の正しいフィルタリングロジックである。つまり：

- `councilSpeechSummaries.json`の`speeches`配列合計（419件／1,568件）＝**登壇記録の総数**（一般質問以外の議案質疑1件を含む）
- サイト上で「一般質問（登壇・確認済み件数）」として表示される値（418件／1,567件）＝**一般質問・代表質問・関連質問・総括質疑のみに絞った件数**

ビルド後HTMLで以下を確認し、全ページで一貫して418／1,567が表示されていることを確認した（**集計ロジックの分裂・不整合はない**）。

| ページ | 出力ファイル | 表示値（登壇・確認済み） | 表示値（質問項目数） |
|---|---|---|---|
| トップページ | `dist/index.html` | 418件 | （未確認、ホームページはconfirmedCountのみ表示） |
| 市政ダッシュボード | `dist/dashboard/index.html` | 418件 | 同一ロジック |
| データ収録状況 | `dist/data-status/index.html` | 418件 | 同一ロジック |
| 一般質問データベース（`/questions`） | `dist/questions/index.html` | 418件 | 1,567件 |

いずれも`src/lib/generalQuestionStats.ts`の`calculateGeneralQuestionStats()`（トップページ・ダッシュボード・データ収録状況）、または同じ集計の元になっている`src/lib/councilSpeeches.ts`の`questionLikeSpeeches(allPublicSpeeches(...))`（一般質問データベースページ）を共通利用しており、**独自に再実装している箇所はなかった**。

**判断：これはコード側の不具合ではない。** 本タスクの依頼メッセージで示された「確定済みの正しい基準値＝419件／1,568件」は、`councilSpeechSummaries.json`の`speeches`配列を単純合計した値であり、その中には意図的に一般質問と区別されている「議案質疑」1件が含まれている。サイトが表示している418件／1,567件は、一般質問データベースとして定義された区分（`QUESTION_LIKE_SPEECH_TYPES`）で正しくフィルタした後の値であり、**現状のサイト表示のほうが「一般質問の件数」という定義としては正確**である。推測でどちらかに合わせる修正は行っていない（原因を特定できたため、依頼元にこの差分の性質を報告することとした）。

なお、`speeches`配列の**総登壇記録数**（一般質問以外の区分を含む全件）を指す用途であれば419件／1,568件は正しい値である。「419件／1,568件」と「418件／1,567件」のどちらも、それぞれの定義（登壇記録の総数 vs. 一般質問区分のみ）において正しく、サイト側に矛盾や誤表示はない。

### 2-3. 現職議員数
- `src/data/members.json`の配列長：**26件**。
- `npm run validate:data`の出力：`members=26`、`dist/data-status/index.html`上でも「確認済み質問がある現職議員：26／26名」と表示 → **一致**。ハードコードなし、全ページで`members.length`を動的参照していることを確認した。

## 3. TASKS.mdの過去記録について

`TASKS.md`の6026行目・7004行目付近には「397件」「1,470件」等の当時の記録が残っているが、これは指示のとおり**書き換えていない**。これらはDONE済みタスクの完了時点（TASK-084〜086等）における実データのスナップショットであり、その後のデータ拡張・重複解消により現在値（419／1,568、うち一般質問区分のみは418／1,567）へ変化している。過去記録は当時の実データを示すものであり、現在の基準値とは異なる旨をここに明記する。

## 4. 修正内容

**コード修正は行っていない。** grep調査の結果、`src/pages`・`src/components`・`src/lib`・`public`・`functions`・`scripts`のいずれにも、動的に算出すべきなのに古い件数がハードコードされている箇所は見つからなかった。既存の集計ロジック（`calculateGeneralQuestionStats`・`publicBills`・`QUESTION_LIKE_SPEECH_TYPES`）はすでに一元化されており、重複実装や不整合もなかった。

## 5. 品質確認結果

- `npm run typecheck` … エラーなし。
- `npm run lint` … エラー・警告なし。
- `npm run validate:data` … `errors=0 warnings=40`（既存の警告のみ。内訳は`archiveMayorTerms.json`の任期空白期間13件、`archiveFiscalYears.json`の年度欠番、`councilSessions.json`の自動生成会期の要確認事項など、いずれも本タスク以前から存在する既知の「確認中」項目であり、本監査による新規warningの発生はない）。`members=26 generalQuestions=14 billVotes=1177 councilSessions=61`。
- `npm run build` … 成功（`[prerender] generated 2240/2240 route(s) + 404.html`、`validate-seo` failures=0 warnings=0、`validate-content` errors=0 warnings=0）。
- ビルドで再生成された派生データ（`adminReviewQueue.json`・`archiveAiCategoryCandidates.json`・`archiveRelationCandidates.json`・`dataQualitySummary.json`・`siteUpdate.json`・`councilSessions.json`・`memberSpeechAnalysis.json`・`photoDimensions.json`・`searchIndex.json`・`public/robots.txt`・`public/sitemap.xml`）はタイムスタンプ等の再生成ノイズのみだったため、本タスクの範囲外としてコミット前に元に戻した（`git checkout --`）。

## 6. 総括

- サイト全体を対象としたgrep調査の結果、397・1,470（1470）のハードコードされた古い件数は実行コード中に存在しなかった。1,177は現在も正しい値であり修正不要。
- `/bills/votes`・`/data-status`の議案賛否件数（1,177件）は基準値と一致。
- `/questions`・トップページ・ダッシュボード・データ収録状況の一般質問「登壇・確認済み件数」「質問項目数」は、全ページで一貫して418件／1,567件を表示しており、集計ロジックの分裂はない。ただし`councilSpeechSummaries.json`の`speeches`配列の単純合計（419件／1,568件）とは、意図的に区別された「議案質疑」1件（一般質問ではないと本人が明言した登壇）の扱いにより1件差がある。これはサイトの不具合ではなく、「登壇記録の総数」と「一般質問区分に限定した件数」という定義の違いによるものであり、推測での統一修正は行わなかった。
- 現職議員数（26名）はすべて`members.json`を動的参照しており、ハードコードはなかった。
- `TASKS.md`の過去記録本文（397件・1,470件等）は当時の実データのスナップショットであり、書き換えていない。

## 7. 今後の改善提案（任意）

- 依頼元で「419件／1,568件」を今後も基準値として使う場合は、「councilSpeechSummaries.jsonの登壇記録総数（一般質問以外の議案質疑等を含む）」という定義であることを明記し、「一般質問（登壇・確認済み件数）」として画面表示する418件／1,567件とは区別して扱うことを推奨する。
- 混同を避けるため、`generalQuestionStats.ts`の`confirmedCount`のJSDocに「councilSpeechSummaries.jsonの登壇記録総数（全speechType）とは異なり、QUESTION_LIKE_SPEECH_TYPESでフィルタ後の件数である」旨を追記すると、今後同様の監査で同じ疑問が生じにくくなる（本タスクでは指示に基づき既存ロジックの変更は行わず、コメント追記も見送った。次フェーズでの検討事項として提案する）。

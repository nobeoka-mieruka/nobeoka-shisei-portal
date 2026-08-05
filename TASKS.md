# 延岡市政見える化ポータル 実行タスク

最終更新日：2026-08-05

---

## 運用ルール

- タスクは上から優先順位順に並べる
- Claude Codeは原則1回につき1件を完了する
- ユーザーが「次」「次へ」「続けて」「残りを進めて」と伝えた場合、最上位のREADYタスクを1件実行する
- ユーザーが「すべて自動で」「止まらず進めて」と明示した場合のみ、READYタスクを優先順に連続して進めてよい
- 未コミット作業がある場合は、新しいタスクより優先して完了させる
- 公式資料が不足している場合は推測せずBLOCKEDにする
- 完了時は完了日、コミットID、変更概要を「完了記録」へ記録する
- 作業開始時にREADY→IN_PROGRESSへ変更する
- 検証（validate:data / typecheck / lint / build）後にDONEへ変更する
- 大規模タスクは小さなタスクへ分割する
- 画面実装とデータ収集は別タスクにする
- 実装済みの機能を新規タスクとしてREADYへ戻さない

状態は次の5種類：`READY` / `IN_PROGRESS` / `BLOCKED` / `REVIEW` / `DONE`

---

## 優先度A

### TASK-001 未コミットの検索機能改善を確認してコミットする

状態：DONE
優先度：A
対象：`src/lib/search.ts`、`src/hooks/useSearchHistory.ts`、`src/components/HighlightText.tsx`、`src/pages/SearchPage.tsx`、`src/components/SiteHeader.tsx`、`src/types/index.ts`、`scripts/generate-search-index.mjs`、`scripts/validate-data.mjs`
状態遷移：READY → IN_PROGRESS → DONE（2026-07-20、「次へ」指示により実行）
依存関係：なし（他の全タスクより優先）
目的：既に実装済みで未コミットの検索機能改善（検索ロジック刷新、検索結果ハイライト、検索履歴、ヘッダーへの検索導線追加、`searchIndex.json`の検証強化）を確認し、安全であればコミット・プッシュする

作業内容：
- `git diff`で全変更内容を再確認する
- `validate:data` / `typecheck` / `lint` / `build`が通ることを確認する（本セッションで確認済み、コミット前に再確認）
- 推測データや架空の値が含まれていないか確認する
- 問題なければコミットし、GitHubへプッシュする

受入条件：
- 4つの検証コマンドがすべて成功する
- 既存ページ・既存データを破壊していない
- `.claude/settings.local.json`など秘密情報・ローカル専用ファイルを含めない

公式資料：
- 該当なし（サイト内機能改善のため）

完了記録：
- 完了日：2026-07-20
- コミットID：732c724
- 変更概要：検索ロジックを表記ゆれ吸収＋関連度スコア方式に刷新、検索結果ハイライト（`HighlightText`）、検索履歴（`useSearchHistory`、端末内localStorageのみ）、ヘッダーへの検索導線を追加。`validate-data.mjs`に`searchIndex.json`の検証（ID重複・URL・type・参照整合性）を追加。validate:data/typecheck/lint/buildすべて成功。

---

### TASK-002 Cloudflare Analytics API（/api/site-stats）の本番503エラー解消

状態：DONE
優先度：A
対象：`functions/api/site-stats.ts`、`src/components/SiteAnalyticsSummary.tsx`、Cloudflare Pagesダッシュボード
依存関係：なし
目的：本番の累計アクセス数表示が「集計中」のまま動作していない問題を解消する

作業内容（コード側・完了）：
- レスポンス契約を`{ok, ...}`形式へ変更し、環境変数未設定時・Cloudflare API障害時ともHTTP 503ではなく200＋安全なJSON（`configuration_required`/`temporarily_unavailable`）を返すようにした
- APIトークン・Account ID・Cloudflareの詳細なエラー内容は引き続きレスポンス・ログへ含めない設計を維持
- 本日のアクセス数（`todayViews`、JST基準）を同一クエリで追加取得
- 環境変数未設定時はCloudflare APIを呼ばず`no-store`で即応答、Cloudflare API障害時は直前の正常値があればフォールバック、無ければ60秒だけ短時間キャッシュして過剰アクセスを防止
- 公開ページ（`SiteAnalyticsSummary.tsx`）を新レスポンス契約に対応させ、「設定確認中」と「一時的に取得できません」を文言で区別
- 管理者専用ページは既存に存在せず、認証機構もないため新規追加はしない（詳細診断情報を公開ページへは出さない）

解消までの経緯（2026-07-20、本番リアルタイムログでの一次情報に基づく段階的対応）：
1. 保持期間超過エラー（`account cannot request data older than 26w2d`）を解消。31日×6区間（186日）だったチャンク方式を30日×6区間（180日、安全余裕あり）へ変更し、任意の`CLOUDFLARE_ANALYTICS_START_DATE`環境変数（未設定可）にも対応
2. `?debug=1`診断エンドポイントを追加し、キャッシュが query 文字列を無視して共有される問題（`?nocache`等が効かない）を修正、`?debug=1`/`?nocache`時はキャッシュを完全に迂回するよう変更
3. AdaptiveGroupsのレスポンス形状（`count`が単一オブジェクトではなく配列で返る）に対応するよう`readCount`を修正
4. siteTag不一致の調査用に、直近30日→前30日→さらに前30日と遡る診断クエリ（`siteTagDiagnostics`）を追加。診断の結果、**`CLOUDFLARE_SITE_TAG`環境変数の値が実際のWeb Analyticsデータのsiteタグと一致していなかったことが根本原因と判明**（コードの不具合ではない）
5. 診断クエリ自体もCloudflareの1回あたり最大期間（13w2d）を超えていたため30日単位へ修正。Cloudflareのエラーメッセージ自体にAccount IDが埋め込まれるケースがあり、ログ・デバッグレスポンスへ漏れていたため`redactSecrets()`で除去
6. `CLOUDFLARE_SITE_TAG`をユーザーが正しい値へ更新後、`totalViews`/`todayViews`が実データ（890件／99件など）で取得できることを確認
7. キャッシュキーに`CODE_VERSION`を含め、ロジック修正のたびに修正前データに基づく古いキャッシュ済みレスポンス（最大1時間残留）を自動的に無効化するよう変更
8. 公開表示の文言を「累計アクセス数」から「直近30日間のアクセス数」＋「本日のアクセス数」の2項目表示に変更し、実際のデータ保持期間・意味と一致させた

受入条件：
- 本番`/api/site-stats`が503を返さない（達成）
- 環境変数設定後、本番で実際のアクセス数（`ok: true`、`totalViews`/`todayViews`が実データ）が返る（達成、2026-07-20確認）
- コード変更を伴う場合、推測ではなく特定できた原因に基づく修正であること（達成。各段階とも本番ログ・`?debug=1`診断結果に基づく）

公式資料：
- Cloudflare公式ドキュメント（GraphQL Analytics API、Getting started／Authentication／Account Analytics権限）
- Cloudflare Pagesダッシュボード本番リアルタイムログ、`?debug=1`診断エンドポイント（一次情報として使用）

完了記録：
- 完了日：2026-07-20
- コミットID：09b8d87（初回契約変更）、fe1fab8/aaab385/b1ad494（Redeploy）、7d4ea86（保持期間180日化）、59c1ec2（キャッシュ診断追加）、6c2e647（AdaptiveGroups配列対応）、a8e88bb（siteTag発見診断追加）、1bf7269（診断クエリ期間修正）、18f1bc0（Account ID漏えい修正）、c9f2253/2532634（env変更後再デプロイ）、775a115（siteTag比較のtrim/大文字小文字正規化）、64c42a4（キャッシュキーのCODE_VERSION化、表示文言を「直近30日間のアクセス数」＋「本日のアクセス数」へ変更、本記録更新）
- 変更概要：上記1〜8のとおり。根本原因は環境変数`CLOUDFLARE_SITE_TAG`の値の誤りであり、コード側は保持期間・レスポンス形状・キャッシュ・診断機能の複数の実バグ修正と、原因特定のための診断機能追加を行った。

---

### TASK-003 サイト内横断検索の最終動作確認

状態：DONE
優先度：A
対象：`/search`
依存関係：TASK-001の完了後に実施
目的：検索改善（TASK-001）の反映後、複数語検索・検索履歴・ハイライト表示が正しく動作するか確認する

作業内容：
- 主要キーワード（議員名、議案、一般質問テーマ等）での検索結果を確認する
- 検索履歴の保存・表示・削除を確認する
- ハイライト表示が崩れないか確認する
- スマホ幅（375/390/430px）での表示崩れがないか確認する

受入条件：
- 主要な検索パターンで期待する結果が表示される
- 表示崩れ、横スクロールが発生しない

公式資料：
- 該当なし

完了記録：
- 完了日：2026-07-20
- コミットID：（コード変更なし、検証のみのためコミットなし）
- 変更概要：開発サーバーをPlaywright（Chromium）で操作し実機相当の検証を実施。主要キーワード8件（市長公約/一般質問/議案/子育て/防災/報酬/財政/市役所案内）すべてで結果が表示され、タイトル・概要一致箇所はハイライト表示された（キーワードのみ一致の場合はハイライトなしが正しい挙動と確認）。複数語（AND）検索も正常。検索履歴の追加・「最近の検索」表示・個別削除・全削除も正常動作。ヘッダーの検索導線から`/search`へ遷移することを確認。375/390/430px幅で`scrollWidth<=clientWidth`（横スクロールなし）を確認。フルページスクリーンショットで下部ナビが本文中央に重なって見えたが、実際のスクロール操作では重なりが発生しないことを個別スクリーンショットで確認済み（フルページ合成時のみの見た目上のアーティファクト）。コンソールエラーなし。コード変更は不要だったためコミットは発生していない。

---

### TASK-004 議案賛否データの投入・品質向上

状態：IN_PROGRESS（第1段階〔抽出パイプライン改善〕完了、UI・監査レポート・議員別賛否は未着手）
優先度：A
対象：`src/data/billVotes.json`、`src/types/index.ts`、`scripts/lib/council-bill-extraction.mjs`、`scripts/extract-council-pdf-data.mjs`、`scripts/validate-data.mjs`
依存関係：なし（画面・検索・フィルタ・検証ロジックは実装済み。2026-07-21、TASK-028で画面側の残課題も解消済み）
目的：議案ごとの賛否・品質データを公式資料に基づいて登録・整理する

2026-08-05実施分（第1段階、コミット済み）：
- 「議案等審議結果」PDF（全26会期分、ローカル既存資料）の見出し【市長提出議案】【議員提出議案】
  【委員会提出議案】【陳情】【請願】は、公式資料自身が明記した提出者区分であるため、これを
  `proposerType`/`proposer`として抽出・反映（305/546件で判定、残りはPDFのページ跨ぎでセクション
  見出しが引き継がれない技術的制約により未反映＝TASK-004の残課題）
- `individualVoteDisclosureStatus`（新設。disclosed/notDisclosed/unconfirmed）を全545件に設定。
  現状は全件`unconfirmed`（審議結果PDFには個人別賛否が記載されておらず、かつ会議録側もまだ
  確認していないため、「非公表と確認済み」ではなく「未確認」として扱う。可決＝全員賛成という
  推測は行っていない）
- `voteMethod`（新設。全会一致/起立多数/起立少数/簡易採決/記名投票/無記名投票/採決なし/確認できず）
  を型・検証へ追加したが、現在の情報源（審議結果PDF）には採決方法の記載が無いため、今回はデータ
  未登録（0/546件）。会議録の個別確認が必要（TASK-004の残課題）
- `BillVoteResult`に複合議決結果「原案可決及び認定」「否決及び不認定」（水道・下水道事業会計の
  剰余金処分と決算認定が1議案で一体議決される場合の公式表記）を追加。従来この複合表記を
  抽出できず`確認中`のまま放置されていた6件（2023-09-gian-35/36、2024-09-gian-33/34、
  2025-09-gian-45/46）が解消。うち2023-09-gian-36は、旧ロジックの結果抽出範囲の誤りにより
  実際は「否決及び不認定」（否決）だった議案が「認定」（可決同然の誤表示）として登録されていた
  実データ誤りで、PDF原文を目視確認のうえ修正した
- 個人別賛否（`memberVotes`）を自動抽出処理が空配列で上書きしてしまう潜在バグ（現状は全546件が
  空のため実害なし）を修正し、既存データがあれば保持するようにした
- `validate-data.mjs`に、voteMethod/individualVoteDisclosureStatusの値検証、
  individualVoteDisclosureStatusとmemberVotesの整合性検証、同一会期・同一議案番号の重複検証、
  votingDateがsubmittedDateより前の場合のエラー、lastVerified超過（1年以上）の警告を追加

未着手（TASK-004の残課題、次回以降）：
- 提出者区分のPDFページ跨ぎ未反映241件の解消（審議結果PDFのページごとパース方式の見直しが必要）
- 令和8年度・令和7年度を含む全546件の委員会付託先・委員会審査結果・採決方法・提出日・施行日・
  予算額の個別確認（会議録・委員会審査報告書等、審議結果PDF以外の資料が必要）
- 議員個人別の賛否（memberVotes）の登録（現状0件のまま。会議録での個別確認が必要）
- `/bills/votes`一覧・詳細ページのUI改善（未確認項目のまとめ表示等）
- データ収録状況ページへの議案品質集計の追加
- 共通集計関数（getBillCoverageStats等）の新設

受入条件：
- `validate:data`のエラーが0件（達成）
- 出典URLの無いデータをverifiedにしない（達成。既存の検証を維持）
- 不明な賛否を推測で埋めていない（達成。個人別賛否は全件unconfirmedのまま、可決＝全員賛成という
  補完は行っていない）

公式資料：
- 延岡市議会「議案等審議結果」PDF（`public/council-documents/`配下、既存の会期ごとローカル保存資料）

完了記録（第1段階）：
- 完了日：2026-08-05
- コミットID：（後述）
- 変更概要：上記のとおり。

---

### TASK-005 一般質問対象年度の拡大（旧任期アーカイブ拡張）

状態：分割済み（TASK-005A〜005Gへ分割。本タスク自体は進行管理のみ）
優先度：A
対象：`src/data/councilSpeechSummaries.json`、`src/data/formerMembers.json`、`src/data/councilSessions.json`
依存関係：なし
目的：現議員任期（2023-04-23〜）の会議録確認済み一般質問177件に加え、それより前（旧任期、2019年5月頃〜2023年4月頃）の一般質問を、公式会議録検索システム（kensakusystem.jp/nobeoka）から拡張する

- TASK-005A：旧任期会期マスター整理
- TASK-005B：旧任期議員ID対応
- TASK-005C：2022年度一般質問
- TASK-005D：2021年度一般質問
- TASK-005E：2020年度一般質問
- TASK-005F：2019年度一般質問
- TASK-005G：表示・検索・検証統合

---

### TASK-005A 旧任期会期マスター整理

状態：IN_PROGRESS
優先度：A
対象：`src/data/councilSessions.json`、`data/minutes/discovery-*.json`（作業用、未コミット）
依存関係：なし
目的：令和元年（2019年）〜令和5年3月（2023年4月選挙前）の定例会・臨時会を一覧化する

実施内容：
- `node scripts/discover-nobeoka-minutes.mjs --year=<年> --from=2019-01-01`で、令和元年〜令和5年3月分の
  会期・本会議日を自動取得できることを確認した（`See.exe`の年階層ナビゲーションが2023-2026年だけでなく
  2019-2022年でも正しく動作することを確認済み）。5年分・30会期・約98本会議日の一覧を確認した
- `councilSessions.json`へ実際に登録したのは、最優先1件（`2023-03`＝令和5年3月定例会／第29回定例会、
  開会2023-02-24・閉会2023-03-24）のみ。他29会期は未登録

状態：令和5年3月定例会（`2023-03`）は完全収録（一般質問者12名全員登録済み）。残り29会期は未登録。

未着手：
- 残り29会期の`councilSessions.json`登録（開会日・閉会日・一般質問有無・収録状態等）

公式資料：
- 延岡市議会会議録検索システム（https://www.kensakusystem.jp/nobeoka/）

完了記録：
- 完了日：（一部完了のみ、TASK-005Aは継続中）
- コミットID：（後述）
- 変更概要：`2023-03`会期を追加、完全収録化。

---

### TASK-005B 旧任期議員ID対応

状態：IN_PROGRESS
優先度：A
対象：`src/data/formerMembers.json`、`src/data/councilSpeechSummaries.json`、`src/types/index.ts`、
`src/lib/councilSpeeches.ts`
依存関係：TASK-005Aの完了後（一部完了で着手）
目的：旧任期当時の議員と、現職・元議員マスターの対応を確認する

実施内容（令和5年3月定例会＝2023-03の発言者一覧より、一般質問者12名全員を処理完了）：
- 12名を会議録検索システムの発言者一覧（`r_Speakers.exe`）で確認した
- うち7名（稲田雅之m01・上杉泰洋m03・小野正二m04・甲斐忠篤m07・甲斐正幸m08・河野治満m10・
  中城あかねm16）は現職議員名簿の氏名と一致（続投した議員）
- うち5名（佐藤誠fm02・松田和己fm03・三上毅fm04・白石良盛fm05・田村吉宏fm06）は現職議員名簿に
  該当する氏名がなく、新規元議員として登録した（servedSessions:["2023-03"]、ふりがな・当選回数・
  経歴等は未確認のため登録していない。白石良盛・田村吉宏は本人の発言原文で「今期限りで退任」
  「四年間任期の最後」と明言しており、旧任期のみの在職であることを本人発言でも確認できた）
- **続投した7名の旧任期発言は、現職の既存memberIdへ追加した。** `CouncilSpeech`型へ
  `term?: "current" | "previous"`を新設し、旧任期の発言に`term:"previous"`を設定。
  `src/lib/councilSpeeches.ts`へ`currentTermPublicSpeeches()`を新設し、議会活動レーダーチャート
  （`MemberDetailPage.tsx`）の入力を`term:"previous"`除外済みのものに限定することで、
  現任期集計・活動指数へ旧任期分が混入しないことを確認した（データ上・テスト上の両方で確認：
  `scripts/test-activity-radar.mjs`に回帰防止テストを追加）

未着手：
- 残り29会期分の議員ID対応表の作成

公式資料：
- 延岡市議会会議録検索システム（発言者一覧・発言原文、令和5年第29回定例会）

完了記録：
- 完了日：（一部完了のみ）
- コミットID：（後述）
- 変更概要：元議員8名（fm02〜fm09）を新規登録、既存fm01（吉本靖）のservedSessionsへ`2022-12`を追加。

---

### TASK-005C 2022年度一般質問

状態：DONE（令和4年度4定例会＝令和4年3月・6月・9月・12月定例会、すべて完全収録で完了）
優先度：A
対象：`src/data/councilSpeechSummaries.json`、`src/data/councilSessions.json`、`src/data/formerMembers.json`
依存関係：TASK-005A・005Bの完了後
目的：令和4年度の定例会（6月・9月・12月）の一般質問を登録する

実施内容（令和4年12月定例会＝第28回定例会、一般質問者12名全員を処理完了）：
- `councilSessions.json`へ`2022-12`会期を新規登録
- 一般質問者12名を発言者一覧で確認：8名（松田満男m22・甲斐行雄m06・猪之鼻哲m02・比江島久美子m19・
  上杉泰洋m03・平田信広m20・柴浩信m14・峯田克明m23）は現職継続、1名は既存元議員（吉本靖fm01、
  servedSessionsへ`2022-12`を追加）、3名は新規元議員（松本哲也fm07・下田英樹fm08・松田勝則fm09）
- 12件全ての質問・答弁を実際に取得・精読して登録（`term:"previous"`で現職IDへ追加、または
  `isFormerMember:true`の元議員レコードへ追加）
- speechType：総括質疑・一般質問（松田満男・平田信広、いずれも本人が原文でその名称を使用）、
  一般質問（他10名）

実施内容（令和4年9月定例会＝第26回定例会、一般質問者13名全員を処理完了）：
- `councilSessions.json`へ`2022-09`会期を新規登録
- 13名を確認：10名（柴浩信m14・稲田雅之m01・比江島久美子m19・平田信広m20・峯田克明m23・
  長友幸子m17・河野治満m10・中城あかねm16・甲斐忠篤m07・早瀬賢一m18）は現職継続、3名は既存元議員
  （佐藤誠fm02・松田和己fm03・田村吉宏fm06、servedSessionsへ`2022-09`を追加）で新規元議員は無し
- この会期の登録で、早瀬賢一議員（m18）の会議録確認済み一般質問が初めて1件登録され、
  「確認済みの一般質問が1件も無い現職議員」の警告が解消した

実施内容（令和4年6月定例会＝第24回定例会、登壇者16名全員を処理完了）：
- `councilSessions.json`へ`2022-06`会期を新規登録
- 16名を確認：10名（上杉泰洋m03・松田満男m22・峯田克明m23・小野正二m04・猪之鼻哲m02・平田信広m20・
  甲斐正幸m08・甲斐行雄m06・長友幸子m17・柴浩信m14）は現職継続、6名は既存元議員（佐藤誠fm02・
  松本哲也fm07・下田英樹fm08・白石良盛fm05・吉本靖fm01・田村吉宏fm06、servedSessionsへ
  `2022-06`を追加）で新規元議員は無し
- **田村吉宏議員（元議員fm06）の登壇は「議案質疑」であり一般質問ではないことを本人発言原文
  （「一般質問する予定ではなかったが、追加提案された二次補正予算について議案質疑をさせていただき
  ます」）で確認し、`speechType: "議案質疑"`として登録した（question-like集計には含まれない）。**
  よって登壇者16名のうち15件が会議録確認済み一般質問の集計対象、1件は対象外

実施内容（令和4年3月定例会＝第21回定例会、一般質問実施日3日分・登壇者14名全員を処理完了）：
- `councilSessions.json`へ`2022-03`会期を新規登録（fiscalYear:2021、開会2022-03-01・閉会2022-03-25）
- 14名を確認：10名（北林幹雄m11・柴浩信m14・長友幸子m17・比江島久美子m19・小野正二m04・
  上杉泰洋m03・稲田雅之m01・甲斐忠篤m07・河野治満m10・峯田克明m23）は現職継続、4名は既存元議員
  （松本哲也fm07・松田勝則fm09・田村吉宏fm06・三上毅fm04、servedSessionsへ`2022-03`を追加）で
  新規元議員は無し
- speechType：総括質疑・一般質問（北林幹雄・上杉泰洋）、代表質問（松本哲也・松田勝則）、
  関連質問（柴浩信・長友幸子・小野正二）、一般質問（他7名）。14件全て会議録確認済み一般質問の
  集計対象（議案質疑等の非対象speechTypeは無し）
- 比江島久美子議員（m19）は、質問原文冒頭の話題（シニア向けスマートフォン教室）と直後の市長答弁
  セグメントの話題（医学部進学奨学金、原文中に存在しない）が一致しない事象を発見したため、推測を
  避け、原文中に実在し答弁との対応が直接確認できた別の話題（市営住宅の連帯保証人に代わる保証会社
  導入の検討状況、都市建設部長答弁）に切り替えて登録した

公式資料：延岡市議会会議録検索システム（発言者一覧・発言原文、令和4年第28回・第26回・第24回・
第21回定例会）

完了記録：
- 完了日：2026-08-05
- コミットID：（後述）
- 変更概要：上記のとおり。会議録確認済み一般質問の累計が201→214→229→243件に増加（12月分+12、
  9月分+13、6月分+15、3月分+14）。令和4年度（第21回・24回・26回・28回定例会）全4定例会が
  完全収録となり、TASK-005Cを完了とした。

---

### TASK-005D 2021年度一般質問

状態：READY
優先度：A
対象：`src/data/councilSpeechSummaries.json`
依存関係：TASK-005A・005Bの完了後
公式資料：延岡市議会会議録検索システム

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-005E 2020年度一般質問

状態：READY
優先度：A
対象：`src/data/councilSpeechSummaries.json`
依存関係：TASK-005A・005Bの完了後
公式資料：延岡市議会会議録検索システム

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-005F 2019年度一般質問

状態：READY
優先度：A
対象：`src/data/councilSpeechSummaries.json`
依存関係：TASK-005A・005Bの完了後
公式資料：延岡市議会会議録検索システム

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-005G 表示・検索・検証統合

状態：IN_PROGRESS
優先度：A
対象：`src/lib/councilSpeeches.ts`、`scripts/lib/public-routes.mjs`、`scripts/generate-search-index.mjs`、
`scripts/validate-data.mjs`、`src/types/index.ts`
依存関係：なし（旧任期データが1件でもあれば必要になるため先行実施）
目的：旧任期データが、現任期専用に設計されていた収録対象期間カットオフ（`councilSpeechPeriod.from`）で
誤って除外・非公開・検索対象外・validate:dataエラーにならないようにする

実施内容（2026-08-05、TASK-005A/Bの`2023-03`会期・`fm02`登録に伴い発見・対応）：
- `CouncilMemberSpeechRecord`型へ`isFormerMember?: boolean`を追加（現議員任期より前の発言を
  含み得る元議員レコードであることを示す）
- `src/lib/councilSpeeches.ts`の`publicSpeeches`/`findPublishedSpeech`、`scripts/lib/public-routes.mjs`の
  `publishedSpeeches`、`scripts/generate-search-index.mjs`の会議録要約インデックス生成処理を、
  `isFormerMember:true`の場合は`councilSpeechPeriod.from`カットオフを適用しないよう修正
- `scripts/validate-data.mjs`の収録対象期間チェックも同様に、元議員IDの発言は対象外とした
  （元議員の在職確認はservedSessionsで別途検証済み）
- 現職議員（members.json）の発言には引き続き`councilSpeechPeriod.from`カットオフを適用する
  （議会活動レーダーチャート等、現任期を前提とした機能への影響を避けるため）

受入条件：
- 旧任期の元議員データが、トップページ・`/questions`・検索・サイトマップ・元議員詳細ページに
  正しく反映される（達成：`fm02`登録後、確認済み件数が177→178件に反映されることを確認）
- 現職議員の集計・議会活動レーダーチャート等、既存の現任期機能を壊さない（達成：`validate:data`
  errors=0、typecheck/lint/test/build成功）

完了記録：
- 完了日：2026-08-05
- コミットID：（後述）
- 変更概要：上記のとおり。

追記（2026-08-05、令和4年3月定例会分の本番確認中に発見・対応）：
- `/people/former-member-fm0X`ページの「プロフィール・発言記録の詳細を見る」ボタンが
  `/members/former/fm0X`（`MemberFormerDetailPage`）へリンクしているが、`src/data/archiveMemberProfiles.json`
  にはfm01のプロフィールしか登録されておらず、fm02〜fm09（8名、旧任期一般質問アーカイブ拡張で
  新規登録した元議員全員）はこのリンク先が「指定された元議員情報は見つかりませんでした」と
  なるリンク切れ状態だったことを発見した
- `src/data/formerMembers.json`の既存確認済みデータ（name/note/sourceNote/lastVerified）から、
  fm01の既存プロフィール形式に倣ってfm02〜fm09の`archiveMemberProfiles.json`エントリ8件を追加
  （新たな事実の追加ではなく、既存の確認済みデータの構造化のみ。新規調査・推測は行っていない）
- 修正後、`/members/former/fm02`〜`/members/former/fm09`が正しく表示され、
  `speechesForProfile`経由でcouncilSpeechSummaries.jsonの発言記録・活動レーダーチャートが
  正しく反映されることをローカルビルド・本番デプロイ後に確認した

---

### TASK-006 一般質問の答弁概要データ追加

状態：BLOCKED
優先度：A
対象：`src/data/generalQuestions.json`（`answerSummary`等）
依存関係：TASK-005と一部重複するが別データ項目のため独立管理
目的：会議録が公開された一般質問について答弁概要を追加する

作業内容：
- 会議録公開状況を確認する
- 公開されている範囲で答弁概要を要約して登録する（全文転載はしない）

受入条件：
- `validate:data`のエラーが0件
- 会議録が未公開の質問には答弁概要を追加しない（推測で埋めない）

公式資料：
- 延岡市議会公式ホームページ（会議録）

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-007 市長公約一覧・詳細ページへの検索・カテゴリ・進捗状態フィルタ実装

状態：DONE
優先度：A
対象：`src/pages/MayorPolicyProgressPage.tsx`、`src/pages/MayorPromiseDetailPage.tsx`、`src/pages/MayorPage.tsx`、`src/components/mayor/PromiseCard.tsx`、`src/components/mayor/MayorPromiseStatusBadge.tsx`（新規）、`src/components/SearchBar.tsx`、`src/components/icons.tsx`、`src/lib/mayorPromiseStatus.ts`、`src/config/site.ts`、`src/types/index.ts`、`scripts/generate-search-index.mjs`、`scripts/validate-data.mjs`
依存関係：なし（既存の`SearchBar`/`FilterSelect`コンポーネントを流用）
目的：`RELEASE_CHECKLIST.md`セクション4で「未完了」とされていた検索・カテゴリ絞り込み・進捗状態絞り込みを実装する

作業内容（実施済み）：
- 公約一覧ページへキーワード検索（公約名・公約原文・公約概要・政策分野・進捗説明・根拠資料名を対象）を追加
- 絞り込み条件（進捗状況／政策分野／根拠資料の有無／関連議案の有無／関連一般質問の有無／確認年度）と「条件をリセット」ボタンを追加
- 全公約数・検索結果件数・進捗状況ごとの件数を表示（独自の達成率・総合点は追加していない）
- 進捗状況区分を`達成`/`進行中`/`一部実施`/`未着手`/`方針変更`/`確認中`へ拡張。既存データが使用していた`検討中`/`実施済み`は後方互換のため型に残し、値は変更していない（`MayorPromiseStatusLabel`）
- 進捗状況を色だけでなく文字＋アイコンでも識別できる`MayorPromiseStatusBadge`コンポーネントを新設し、一覧カード・詳細ページ・市長ページ・進捗履歴の表示を統一
- 公約カードに政策分野チップ、公約概要（`citizenSummary`）、「根拠資料あり」/「根拠資料を確認中」の文字表示を追加
- 公約詳細ページに、関連議案・関連一般質問（ID参照、`relatedBillVoteIds`/`relatedQuestionIds`を新設）、財政ダッシュボードへの導線、根拠資料の公開日（`publishedDate`、任意）を追加。予算措置の項目名を明確化
- 進捗履歴（`progressHistory`）の型を`summary`/`sourceTitle`/`sourceUrl`へ拡張し、`validate-data.mjs`で出典URL必須を検証するようにした（既存データに進捗履歴は0件のため、既存値への影響なし）
- `validate-data.mjs`に、拡張後の進捗状況区分の検証、確定的な状況（達成・実施済み）に根拠資料が無い場合のエラー、`relatedBillVoteIds`/`relatedQuestionIds`の参照整合性チェック、根拠資料`publishedDate`の日付形式チェックを追加
- `generate-search-index.mjs`に、根拠資料名・公約概要（`citizenSummary`）をキーワード・本文へ追加

受入条件：
- キーワード検索が動作する（達成）
- カテゴリ・進捗状態での絞り込みが動作する（達成）
- 既存の一覧表示・詳細ページへの導線を壊さない（達成。カテゴリ別グルーピング・アンカーリンク・PDF一覧は維持）

公式資料：
- 該当なし（UI機能追加。データは既存の12件から変更していない）

完了記録：
- 完了日：2026-07-21
- コミットID：70f638e
- 変更概要：上記のとおり。`validate:data`（errors=0 warnings=0）/`typecheck`/`lint`/`build`すべて成功。Playwrightで375/390/430/768/1280px幅の横スクロールなしを確認、検索・絞り込み・条件リセット・カテゴリアンカー遷移・詳細ページの動作をヘッドレスブラウザで確認、コンソールエラーなし。

---

### TASK-008 ホームページから市長公約進捗ページへの直接導線を追加

状態：DONE
優先度：A
対象：`src/pages/HomePage.tsx`
依存関係：なし
目的：現状`/mayor`経由でしか到達できない公約進捗ページへ、ホームページから直接遷移できるようにする

作業内容：
- ホームページの`navLinks`（クイックリンクのグリッド）へ「市長公約の進捗を見る」（`/mayor/policy-progress`）を追加
- 同様に導線が欠けていた「延岡市の財政を見る」（`/finance`）も併せて追加（グリッドは`grid-cols-2 sm:grid-cols-3`で項目数増加に自動対応するため、レイアウト崩れなし）

受入条件：
- ホームページから1クリックで`/mayor/policy-progress`へ到達できる（達成）
- 既存のホームページレイアウトを大きく崩さない（達成。既存の`nav`グリッドへ項目追加のみ）

公式資料：
- 該当なし

完了記録：
- 完了日：2026-07-21
- コミットID：1d92d49
- 変更概要：上記のとおり。`validate:data`/`typecheck`/`lint`成功。

---

### TASK-009 議員・一般質問・議案・公約の相互リンク棚卸し

状態：DONE
優先度：A
対象：`src/pages/MemberDetailPage.tsx`、`src/pages/GeneralQuestionDetailPage.tsx`、`src/pages/BillVoteDetailPage.tsx`、`src/pages/MayorPromiseDetailPage.tsx`、`src/types/index.ts`、`scripts/validate-data.mjs`
依存関係：なし
目的：議員↔一般質問↔議案↔公約↔財政↔記者会見の相互リンクが網羅されているか確認し、不足箇所を補う

作業内容（調査で判明した問題と対応）：
- `MemberDetailPage`（所属委員会・会派・一般質問・議案賛否）は既に網羅済みで、`EmptyState`によるゼロ件表示も実装済みだった（変更なし）
- `MayorPromiseDetailPage`（TASK-007で追加した関連議案・関連一般質問・財政ページ導線）も実装済みだった
- `BillVoteDetailPage`の「関連する一般質問」「関連する市長公約」が、個別ページへのID参照リンクではなく、一覧ページへの件数リンク（例："関連する一般質問（3件）"→`/questions`）になっていたバグを修正し、`GeneralQuestionDetailPage`/`MayorPromiseDetailPage`と同様に個別項目ごとのタイトル付きリンクへ変更した
- `GeneralQuestionItem`・`BillVoteItem`双方に存在した`relatedFinanceItems`（財政項目、IDを持たないデータのため文言で保持）について、`GeneralQuestionDetailPage`には表示箇所が無かったため追加した
- `MayorPromiseItem`に`relatedPressConferenceDates`（市長定例記者会見, `mayorPressConferences.ts`のdate参照）を新設し、`MayorPromiseDetailPage`に関連記者会見の表示を追加（実データの紐付けは公式資料で個別に確認できていないため未設定のまま）
- ユーザーからの追加指示「関連データがない場合は空欄にせず『関連情報は登録されていません』と表示」に基づき、`GeneralQuestionDetailPage`・`BillVoteDetailPage`・`MayorPromiseDetailPage`の関連情報セクションを、データが無い場合でも非表示にせず明示メッセージを表示する方式へ変更した（旧受入条件「データが存在しない場合はリンクを表示しない」から方針変更）
- `validate-data.mjs`に、`relatedFinanceItems`の空文字チェック、`relatedPressConferenceDates`の日付形式チェックを追加（`mayorPressConferences.ts`はTypeScriptモジュールのためID参照整合性チェックは対象外、形式チェックのみ）

受入条件：
- 主要な関連データがある場合、個別ページへ双方向にリンクできる（達成）
- 関連データが存在しない場合は「関連情報は登録されていません」と明示する（達成、方針変更）
- ID参照（memberId/billId/questionId/promiseId等）で結合し、氏名やタイトルの文字列一致では結合していない（達成）

公式資料：
- 該当なし（UI・型・検証ロジックの整合性強化のため。実データの紐付けは各データ投入タスクで別途対応）

完了記録：
- 完了日：2026-07-21
- コミットID：a0270c1
- 変更概要：上記のとおり。`validate:data`（errors=0 warnings=0）/`typecheck`/`lint`/`build`すべて成功。Playwrightで`/questions/:id`・`/mayor/policy-progress/:id`の「関連情報は登録されていません」表示とコンソールエラーなしを確認。

---

### TASK-010 スマホ表示崩れの全体確認

状態：DONE
優先度：A
対象：主要ページ全体（19ページ）
依存関係：なし
目的：`RELEASE_CHECKLIST.md`セクション12で「要確認」とされているスマホ表示（375/390/430/768/1024/1280px）を確認する

作業内容：
- Playwright（Chromium、`npm install --no-save playwright`で一時導入、`package.json`には追加していない）で、ホーム・議員詳細・市長ページ・市長公約一覧/詳細・一般質問一覧/詳細・議案賛否一覧/詳細（存在しないID）・財政・ダッシュボード・市長記者会見一覧/詳細・市長交際費・検索・市役所案内・更新履歴・お問い合わせ・編集方針の19ページ×6幅＝114パターンを自動確認
- 確認項目：`document.documentElement`のページ全体の横スクロール有無、ビューポート外へはみ出す要素の検出、コンソールエラー、HTTPステータス、見出し数、パンくずの有無

調査結果：
- 全114パターンでページ全体の横スクロールは0件（`scrollWidth === clientWidth`を全幅で確認）
- 検出された「要素のはみ出し」3件（財政ページの表、市長交際費ページの表）は、いずれも`overflow-x-auto`でスコープされた表自体の意図的な横スクロール（CLAUDE.mdが許容する「幅の広い表は横スクロールを使用する」パターン）であり、ページ全体には影響しないことを確認。実害なし
- 調査の過程で、`SiteHeader.tsx`の`<h1 className="sr-only">延岡市政見える化ポータル</h1>`が、各ページ自身の`<h1>`（ページタイトル）と重複し、全ページでh1が2つ存在する状態になっていたことを発見。ロゴ画像に`alt="延岡市政見える化ポータル"`、リンクに`aria-label="延岡市政見える化ポータルのトップページへ"`が既に設定されており、このh1は情報として重複していたため削除し、全ページで見出し階層を「h1は1つ」の状態に修正（TASK-027の調査と合わせて対応）

受入条件：
- 主要ページで横スクロールが発生しない（達成）
- 下部ナビゲーションが本文と重ならない（達成。`pb-24 md:pb-10`の余白設計を確認、はみ出し要素の検出でも該当なし）

公式資料：
- 該当なし

完了記録：
- 完了日：2026-07-21
- コミットID：772d9ad（TASK-027と共通）
- 変更概要：上記のとおり。`validate:data`（errors=0 warnings=0）/`typecheck`/`lint`/`build`すべて成功。

---

## 優先度B

### TASK-011 全国報酬比較データの投入

状態：BLOCKED
優先度：B
対象：`src/data/nationalCompensationRanking.json`
依存関係：なし（画面・型は実装済み）
目的：市長・議長・副議長・議員の報酬について、同一条件で比較できる全国データを登録する

作業内容：
- 総務省等の公的統計から同一条件（月額/年額、期末手当有無等）のデータを確認する
- 条件が異なる場合は掲載しない、または条件差異を明記する

受入条件：
- 推定順位を掲載しない
- 出典・基準日を明記する

公式資料：
- 総務省資料
- e-Stat

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-012 類似団体報酬比較データの投入

状態：BLOCKED
優先度：B
対象：`src/data/similarMunicipalityComparison.json`
依存関係：なし
目的：類似団体（人口・財政規模が近い自治体）の報酬データを同一条件で登録する

作業内容：
- 類似団体の公式データを確認する
- 条件が異なる場合は`usesAlternativeDefinition`等で明記する

受入条件：
- 推定値を掲載しない
- 出典・基準日を明記する

公式資料：
- 各自治体公式ホームページ
- 総務省資料

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-013 財政指標の他自治体比較データ投入

状態：BLOCKED
優先度：B
対象：`src/data/financeDashboard.json`または新規ファイル
依存関係：なし
目的：延岡市単独データのみの財政ページに、他自治体との比較を追加する

作業内容：
- 比較対象自治体と指標（財政力指数、実質公債費比率等）を確認する
- 同一年度・同一基準の公式データを収集する

受入条件：
- 同一条件のデータのみ掲載する
- 出典・基準日を明記する

公式資料：
- 総務省「地方財政状況調査」等
- 各自治体の財政状況資料集

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-014 市債残高の複数年度推移データ整備

状態：BLOCKED
優先度：B
対象：`src/data/financeDashboard.json`
依存関係：なし
目的：現状は単年度（令和8年度予算計上額）のみの市債データを、複数年度の残高推移に拡張する

作業内容：
- 決算書・財政状況資料集から複数年度分の市債残高を確認する
- 予算計上額と残高を混同しないよう区別して登録する

受入条件：
- 年度ごとの残高が明確に区別される
- 出典・基準日を明記する

公式資料：
- 延岡市決算書
- 財政状況資料集

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-015 政治資金データベースの型・画面設計

状態：DONE
優先度：B
対象：`src/types/index.ts`、`src/data/politicalFundOrganizations.json`（新規）、`src/data/politicalFundReports.json`（新規）、`src/lib/politicalFunds.ts`（新規）、`src/pages/PoliticalFundsPage.tsx`（新規）、`src/pages/PoliticalFundOrganizationDetailPage.tsx`（新規）、`src/App.tsx`、`src/lib/seo.ts`、`src/pages/SearchPage.tsx`、`scripts/lib/public-routes.mjs`、`scripts/generate-search-index.mjs`、`scripts/validate-data.mjs`
依存関係：なし（データ投入はTASK-016で別管理）
目的：政治資金収支報告書等を整理するためのデータ構造と画面を設計する（データ投入は行わない）

作業内容：
- 政治資金収支報告書の公開項目（収入内訳・支出内訳・繰越額・提出先・公開状況・出典・確認日）を確認し、型定義（`PoliticalFundOrganization`/`PoliticalFundReport`/収入・支出内訳）を設計
- 一覧ページ（`/political-funds`）・詳細ページ（`/political-funds/:id`）を実装
- 空データ（0件）の状態で画面が壊れないこと、既存の`EmptyState`コンポーネントで「現在公開できる収支報告書データはありません」等を表示することを確認
- SEO（`/political-funds`は0件でもnoindexにしない）、サイト内検索（団体名・代表者・年度をキーワード化）、パンくず（ホーム→政治資金収支報告書→団体名）を実装
- 元議員（`formerMembers.json`）に紐づく団体を`/members/:id`へ直接リンクすると本番404になる既知の不具合を避けるため、既存の`findMemberOrFormerLink`ヘルパーで現職・元議員を正しく判定してリンク先を解決

受入条件：
- 型定義が`validate:data`の検証対象に組み込まれる（達成：ID重複・区分値・議員ID参照整合性・年度重複・金額非負・確認済みなのに出典なし等を検証）
- データ0件でも「情報未登録」等の表示になる（達成）

公式資料：
- 該当なし（型・画面の設計のみ。実データ投入はTASK-016で対応）

完了記録：
- 完了日：2026-08-05
- コミットID：8caa24a
- 変更概要：政治資金収支報告書データベースの基盤（型・一覧画面・詳細画面・検証・検索・SEO）を実装。実データは0件のまま。TASK-016で公式資料（総務省・宮崎県選挙管理委員会の公表資料）を確認しながら投入する。

---

### TASK-016 政治資金データの投入

状態：分割済み（TASK-016A〜016Dへ分割。本タスク自体は進行管理のみ）
優先度：B
対象：TASK-015で設計するデータファイル
依存関係：TASK-015の完了後
目的：政治資金収支報告書等の公開資料に基づきデータを投入する

大規模タスクのため、以下へ分割して実施する。

- TASK-016A：政治団体マスターの登録（団体そのものの基本情報のみ）
- TASK-016B：年度別収支報告書データ登録（収入・支出・繰越額）
- TASK-016C：現職・元議員との関連付け確認（代表者名等の追加確認）
- TASK-016D：出典PDF・資料情報の精査

---

### TASK-016A 政治団体マスターの登録

状態：DONE
優先度：B
対象：`src/types/index.ts`、`src/data/politicalFundOrganizations.json`、`scripts/validate-data.mjs`、`scripts/generate-search-index.mjs`、`src/pages/PoliticalFundOrganizationDetailPage.tsx`、`src/data/updateHistory.json`
依存関係：TASK-015の完了後
目的：宮崎県選挙管理委員会・市長/議員本人公式サイト等の公式資料で確認できた範囲で、延岡市長・現職市議・元市議に関連する政治団体（資金管理団体・後援会等）の基本情報（団体そのものの情報のみ、収支金額は対象外）を登録する

作業内容：
- 宮崎県選挙管理委員会の政治資金収支報告書公表ページ（令和6年分、資金管理団体一覧・その他の政治団体一覧50音別ページ）を確認し、延岡市長・現職市議・元市議の氏名と一致する団体名を洗い出した
- 個別団体のPDF（様式その1）はいずれも画像スキャン形式（テキスト層なし）で、本セッションの環境にはOCR・PDF画像化手段が無く、代表者名・会計責任者・主たる事務所の所在地を読み取れなかった。ユーザー（サイト運営者）が団体と議員/元議員/市長の対応関係を個別に確認済みである旨の指示を受け、relatedMemberId／relatedPersonNameのみユーザー確認に基づき登録し、代表者名等の一次資料側の項目は「未確認（null）」のまま登録した
- `representativeName`の型を`string`から`string | null`へ変更（ユーザー承認済み）。詳細ページ・検索インデックス生成でnull時に「確認中」を表示するよう対応
- レコード全体の確認状況を表す`verificationStatus`（`confirmed`/`partiallyVerified`/`pending`）を新設。今回登録した21件のうち20件は`partiallyVerified`（団体の実在・団体区分・提出先・関連人物は公式資料で確認、代表者名等は未確認）、市長の後援会1件は`pending`（宮崎県選管の令和7年分がまだ未公表のため、公式な提出先自体が確認中）
- `validate-data.mjs`に、政治団体verificationStatusの値検証、representativeNameがnullの場合はconfirmed扱いを禁止する整合性チェック、relatedMemberIdとrelatedPersonNameの氏名不一致検出、確認日（verifiedAt）があるのに出典URL（officialListUrl）が無い場合のエラー、団体名の正規化重複候補の警告を追加

登録件数：21件（現職議員19件、元議員1件、市長1件）

受入条件：
- `validate:data`のエラーが0件（達成）
- relatedMemberIdを推測（同姓同名・団体名一致のみ）で設定していない。ユーザー本人による個別確認に基づく（達成）
- 出典URL（宮崎県選挙管理委員会の公表PDF、または市長本人公式サイト）と確認日を登録（達成）
- 代表者名・会計責任者・所在地は、公式資料から読み取れなかったため未確認（null）のまま登録し、推測値を入れていない（達成）

公式資料：
- 宮崎県選挙管理委員会 政治資金収支報告書の公表（令和6年分、資金管理団体一覧・その他の政治団体一覧）https://www.pref.miyazaki.lg.jp/senkyo/kense/senkyo/seijishikin/public.html
- 延岡市長 三浦久知氏 公式サイト（後援会名の確認）https://hisatomo-m.jp/donation/
- 小御門綾議員 公式サイト https://www.comicadoaya.com/
- 前田遼議員 公式サイト https://www.ryomaeda.com/

完了記録：
- 完了日：2026-08-05
- コミットID：6c5ef2d
- 変更概要：上記のとおり。政治団体マスター21件を登録。収支報告書の金額データ（収入・支出・繰越額）は今回登録していない（TASK-016Bで対応）。代表者名・会計責任者・主たる事務所の所在地はTASK-016Cで、PDFを人手で確認できた分から追加する。

---

### TASK-016B 年度別収支報告書データ登録

状態：READY
優先度：B
対象：`src/data/politicalFundReports.json`
依存関係：TASK-016Aの完了後
目的：TASK-016Aで登録した政治団体について、収支報告書の金額データ（収入・支出・前年繰越額・翌年繰越額・内訳）を公式資料に基づき登録する

作業内容：
- TASK-016Aで登録した各団体の収支報告書PDFの内容を確認する（画像PDFのためOCR代替手段または人手確認が必要）
- 確認できた年分のみ登録する

受入条件：
- `validate:data`のエラーが0件
- 未確認の金額をnull以外で埋めない

公式資料：
- 宮崎県選挙管理委員会 政治資金収支報告書（個別団体PDF）

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-016C 現職・元議員との関連付け確認（代表者名等の追加確認）

状態：READY
優先度：B
対象：`src/data/politicalFundOrganizations.json`
依存関係：TASK-016Aの完了後
目的：TASK-016Aで`representativeName`・`treasurerName`等が未確認（null）のまま登録した団体について、PDFを人手（または他の手段）で確認し、代表者名・会計責任者・主たる事務所の所在地を追加する。あわせてmayorの後援会（pf-org-001）は令和7年分の公表後に団体区分・提出先を確認する

作業内容：
- 対象PDFを人手で開き、様式（その1）の記載内容を転記する
- 確認できた団体から`representativeName`等を追加し、`verificationStatus`を`confirmed`へ更新する

受入条件：
- 推測で代表者名を埋めない
- `validate:data`のエラーが0件

公式資料：
- 宮崎県選挙管理委員会 政治資金収支報告書（個別団体PDF、様式その1）

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-016D 出典PDF・資料情報の精査

状態：READY
優先度：B
対象：`src/data/politicalFundOrganizations.json`、`src/data/politicalFundReports.json`
依存関係：TASK-016A・016Bの完了後
目的：登録した出典URL・公表日・団体区分等が最新の公表内容と一致しているかを定期的に精査する（選管の公表ページは団体の異動・解散等で更新されるため）

作業内容：
- 登録済みofficialListUrl・sourceUrlの生存確認
- 団体区分・代表者・所在地の変更有無を確認する

受入条件：
- リンク切れが無い
- 変更があった場合はnotesに履歴を残す

公式資料：
- 宮崎県選挙管理委員会 政治資金収支報告書公表ページ

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-017 財政・報酬データのCSVダウンロード機能

状態：READY
優先度：B
対象：`/finance`、`/compensation`
依存関係：なし（既存の実データを対象にできる）
目的：既に投入済みの財政・報酬データをCSVでダウンロードできるようにする

作業内容：
- 既存データからCSVを生成する機能を実装する
- ダウンロードボタンをページに追加する

受入条件：
- ダウンロードしたCSVの内容が画面表示と一致する
- 未確認値（`null`）が誤って`0`等に変換されない

公式資料：
- 該当なし（既存データの出力機能）

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

## 優先度C

### TASK-018 議員活動年表機能の実装

状態：READY
優先度：C
対象：`src/pages/MemberDetailPage.tsx`
依存関係：なし（既存の質問・議決・活動報告データを利用）
目的：議員ごとの活動（一般質問、議決、活動報告）を時系列で確認できる年表を実装する

作業内容：
- 既存データ（questions/votes/reports）を日付順に統合表示する年表UIを実装する

受入条件：
- 既存データのみで表示され、新規の推測データを追加しない
- データが少ない議員でも表示が崩れない

公式資料：
- 該当なし（既存データの表示機能）

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-019 議会中継・録画への導線追加

状態：BLOCKED
優先度：C
対象：`src/pages/BillVotesPage.tsx`等
依存関係：なし
目的：延岡市議会の公式配信・録画への導線を追加する

作業内容：
- 延岡市議会公式サイトの配信・録画ページの公式URLを確認する

受入条件：
- 公式URLのみを掲載する

公式資料：
- 延岡市議会公式ホームページ

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-020 YouTube連携

状態：BLOCKED
優先度：C
対象：関連ページ
依存関係：TASK-019と関連
目的：延岡市・延岡市議会公式YouTubeチャンネルへの導線または埋め込みを追加する

作業内容：
- 公式YouTubeチャンネルの有無・URLを確認する

受入条件：
- 公式チャンネルであることを確認したURLのみ使用する

公式資料：
- 延岡市公式ホームページ
- 延岡市議会公式ホームページ

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-021 Excel取込対象の拡大

状態：READY
優先度：C
対象：`scripts/import-members.mjs`を参考に新規スクリプト
依存関係：なし
目的：現状は議員データのみ対応のExcel/CSV取込を、議案・一般質問・報酬データへ拡大する

作業内容：
- 対象データの取込フォーマットを設計する
- 下書き生成＋人手確認のフローを既存の議員データ取込と同様に実装する

受入条件：
- 取込後も`validate:data`が通る
- 自動生成データと手入力データが区別される

公式資料：
- 該当なし（既存フローの拡張）

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-022 PDF自動取得

状態：BLOCKED
優先度：C
対象：新規スクリプト
依存関係：なし
目的：議案書・会議録等のPDFを自動取得する仕組みを整備する

作業内容：
- 対象PDFの一覧・取得方針（対象サイト、更新頻度）を確定する

受入条件：
- 取得対象・方法が公式サイトの利用規約に反しない

公式資料：
- 延岡市・延岡市議会公式ホームページ

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-023 FAQ構造化データの実装

状態：BLOCKED
優先度：C
対象：`src/pages/CityGuidePage.tsx`、`src/pages/EditorialPolicyPage.tsx`等
依存関係：なし
目的：既存のFAQ的コンテンツにFAQ構造化データ（JSON-LD）を追加する

調査結果（2026-07-21）：
- `CityGuidePage.tsx`は「質問」「回答」の固定文ペアではなく、選択肢に応じて分岐する診断UI（`DiagnosisStep`、`cityGuideQuestions`）であり、FAQPageが想定する静止したQ&Aコンテンツとは性質が異なる
- `EditorialPolicyPage.tsx`・`AboutPage.tsx`・`TermsPage.tsx`等を確認したが、「Q.」「質問」「回答」形式の固定コンテンツは見つからなかった
- ユーザー指示「構造化データは内容に適合する範囲のみ使用し、誤解を招くOrganizationやGovernmentOrganization設定は避ける」に基づき、実態に合わないFAQPage構造化データの追加は見送った

作業内容：
- FAQ形式のコンテンツを洗い出す（実施済み、該当なし）
- `FAQPage`のJSON-LDを追加する（該当コンテンツが無いため未実施）

受入条件：
- 構造化データテストで検証エラーがない
- 実際のページ内容と一致する

公式資料：
- 該当なし

完了記録：
- 完了日：
- コミットID：
- 変更概要：サイト内にFAQPage構造化データを適用できる静的なQ&Aコンテンツが存在しないため、BLOCKEDとした。将来、市役所案内診断とは別に固定のFAQコンテンツ（例：「よくある質問」ページ）を新設する場合に再検討する。

---

### TASK-024 内部リンク強化

状態：READY
優先度：C
対象：全ページ（継続的改善）
依存関係：なし
目的：関連ページ間の内部リンクを強化し、回遊性を高める

作業内容：
- リンクが不足している箇所を洗い出し、追加する

受入条件：
- 追加したリンクの遷移先が正しい
- 過剰なリンク詰め込みをしない

公式資料：
- 該当なし

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-025 議員写真の画像最適化

状態：DONE
優先度：C
対象：`public/photos/*.jpg`→`*.webp`、`src/data/members.json`、`src/data/mayor.json`、`src/components/Avatar.tsx`
依存関係：なし
目的：未最適化の議員写真（jpg）を圧縮・webp化する（ユーザー依頼では「TASK-020 画像最適化」として指示されたが、リポジトリの実際のTASK-020は「YouTube連携」のため、内容が一致するTASK-025として実施）

作業内容：
- `sharp`（`npm install --no-save`で一時導入、`package.json`には追加していない）で、議員26名＋市長1名、計27枚の写真（300x300 JPEG）をWebP（quality 82、同一寸法）へ変換
- `members.json`・`mayor.json`の`photoUrl`を`.jpg`→`.webp`へ更新し、変換元の`.jpg`は削除（`validate-data.mjs`が`photoUrl`の実ファイル存在を検証するため、変換とJSON更新を同一処理で実施し不整合を防止）
- `Avatar.tsx`の`<img>`へ`width`/`height`属性（表示サイズに対応するpx値）を追加し、CLS対策を強化（`loading="lazy"`/`decoding="async"`は既に実装済みだったため変更なし）
- OGP画像（`public/og-image.png`、`public/og/members/*.jpg`）はWebP化を見送り。多くのSNS・メッセージアプリ（LINE等）でOGP画像のWebP対応が不安定なため、社会的シェア時の表示崩れリスクを避けるためJPEG/PNGのまま維持

計測結果：
- 議員・市長写真の合計サイズ：1,067.0KB → 244.5KB（77.1%削減、約822KB削減）
- 画質はPlaywrightで実機表示を確認し、劣化なし（quality 82、300x300のまま）

受入条件：
- 画像の見た目が損なわれない（達成。Playwrightでのスクリーンショット確認済み）
- ファイルサイズが削減される（達成。77.1%削減）

公式資料：
- 該当なし

完了記録：
- 完了日：2026-07-21
- コミットID：ef161c8
- 変更概要：上記のとおり。`validate:data`（errors=0 warnings=0）/`typecheck`/`lint`/`build`すべて成功。

---

### TASK-026 Lighthouse・Core Web Vitals計測と改善

状態：READY
優先度：C
対象：主要ページ全体
依存関係：なし
目的：未計測のLighthouseスコア・Core Web Vitalsを計測し、必要な改善を行う

作業内容：
- 主要ページでLighthouseを計測する
- スコアが低い場合は原因を特定し改善する

受入条件：
- 計測結果を記録する
- 既存の表示・機能を壊さない改善のみ行う

公式資料：
- 該当なし

完了記録：
- 完了日：
- コミットID：
- 変更概要：

---

### TASK-027 WCAGアクセシビリティ簡易チェック

状態：DONE
優先度：C
対象：`src/components/SiteHeader.tsx`、`src/components/finance/FinanceTable.tsx`、`src/components/compensation/MiyazakiComparisonTable.tsx`、`src/pages/CompensationPage.tsx`、`src/pages/MayorEntertainmentExpensesPage.tsx`、`src/pages/MayorPromiseDetailPage.tsx`
依存関係：なし
目的：axe-core等でWCAG簡易チェックを実施し、コントラスト・aria属性等の問題を確認する

作業内容：
- `@axe-core/playwright`（`npm install --no-save`で一時導入、`package.json`には追加していない）で、主要18ページをwcag2a/wcag2aa/wcag21a/wcag21aaルールセットで自動チェック
- 検出された違反（重大度serious）を修正

検出・修正した問題：
1. **`link-in-text-block`**：`MayorPromiseDetailPage.tsx`の「注意事項」内、文中リンク（編集方針）が`hover:underline`のみ（通常時は色のみで判別）だったため、常時下線表示（`underline`）に変更
2. **`scrollable-region-focusable`**：`FinanceTable.tsx`（財政ページの表）、`MayorEntertainmentExpensesPage.tsx`（市長交際費の支出明細表）、`MiyazakiComparisonTable.tsx`・`CompensationPage.tsx`（報酬ページの比較表）の`overflow-x-auto`スクロール領域が、キーボードのみでは操作できなかったため、`role="region"`・`aria-label`・`tabIndex={0}`・フォーカスリング（`focus-visible:outline`）を追加
3. **`definition-list`**：`CompensationPage.tsx`の`<dl>`内に、`dt`/`dd`ペアでない補足説明の`<p>`が直接の子要素として混在し、定義リストの構造が不正だった（当初`<div>`で囲む対応をしたが、`div`はdt/dd以外を含んではならないため解消せず）。該当する補足文（「類似団体の最高額・最低額を確認中です」「理由：個別団体すべての月額データを確認できていないため」）を`</dl>`の外側（兄弟要素）へ移動し、`<dl>`内をdt/dd（および対応するdiv包含）のみに整理して解消
4. （TASK-010との共通調査）`SiteHeader.tsx`の重複h1を削除し、見出し階層違反の原因を解消

検証結果：
- 修正後、対象18ページ＋報酬ページ（390px/1024px）で違反0件を確認
- キーボード操作・フォーカス表示：`focus-visible:outline`パターンがサイト全体で一貫して使用されていることを確認
- 表のcaption：既存の`FinanceTable`等で対応済み（`TASK-029`で導入）

受入条件：
- 重大な違反（Critical/Serious）を解消する（達成。axe-coreで検出された3種類の重大違反をすべて修正）
- 既存デザインを大きく崩さない（達成。視覚的な変更は文中リンクの下線常時表示のみ）

公式資料：
- 該当なし

完了記録：
- 完了日：2026-07-21
- コミットID：772d9ad（TASK-010と共通）
- 変更概要：上記のとおり。`validate:data`（errors=0 warnings=0）/`typecheck`/`lint`/`build`すべて成功。

---

### TASK-028 議案賛否データベースの画面整合性修正・検索インデックス強化

状態：DONE
優先度：A
対象：`src/App.tsx`、`src/pages/HomePage.tsx`、`src/pages/DashboardPage.tsx`、`src/pages/BillVotesPage.tsx`、`src/pages/BillVoteDetailPage.tsx`、`src/pages/MemberDetailPage.tsx`、`src/components/bills/BillVoteBadge.tsx`、`src/lib/billVotes.ts`、`src/types/index.ts`、`scripts/validate-data.mjs`、`scripts/generate-search-index.mjs`、（削除）`src/pages/BillsPage.tsx`、`src/data/bills.json`
依存関係：TASK-004（議案賛否データの投入）の前提となる画面側の土台。今回の対応でTASK-004は実データ投入のみが残作業になった
目的：ユーザーから「議案ごとの賛否データベースを正式実装してほしい」という依頼を受けて`/bills`・`/bills/votes`・関連コードを調査したところ、画面・検索・フィルタ・検証ロジックの大部分は既に実装済みだったが、以下の実バグ・不整合が見つかったため修正した

作業内容（調査で判明した問題と対応）：
- `/bills`が、実データを持たない旧`Bill`型（`bills.json`、常に0件）のスタブページのままで、`/bills/votes`（`BillVoteItem`型、検索・フィルタ・検証まで実装済み）と機能重複していた（`generate-sitemap.mjs`に「重複するためnoindex」という既存コメントで判明）。ホームページの「議案・採決結果を見る」導線も、実装済みの`/bills/votes`ではなくこのスタブへ向いていた
- `DashboardPage.tsx`・`HomePage.tsx`の「登録済み議案数」統計カードが、常に空の`bills.json`を集計しており、実データが入っている`billVotes.json`を見ていなかった
- 賛否区分（`BillMemberVoteStatus`）に「棄権」「確認不能」が無く、退席（`abstain`）との呼称の紛らわしさもあった
- 検索インデックス（`generate-search-index.mjs`）の議案キーワードに年度・投票議員名が含まれていなかった
- `validate-data.mjs`に議決結果（`BillVoteResult`）の値検証、および「議決結果が確定しているのに根拠資料URLが無い」場合の検証が無かった

実施した修正：
- `/bills`ルートを`/bills/votes`へリダイレクト（`<Navigate replace>`）に変更し、旧`BillsPage.tsx`・`bills.json`・型（`Bill`/`BillCategory`/`MemberBillVoteRecord`）を削除。ホームページのナビゲーションリンクも修正（重複していた2つの議案リンクを1つに統合）
- `DashboardPage.tsx`・`HomePage.tsx`の議案数統計を`billVotes.json`ベースに変更
- `BillMemberVoteStatus`に`abstained`（棄権）・`unconfirmed`（確認不能）を追加し、紛らわしかった`abstain`は`departed`（退席）へ改名（実データが空のため安全に実施）。`lib/billVotes.ts`のラベル・記号、`BillVoteBadge.tsx`、一覧・詳細ページの集計表示、`validate-data.mjs`の許容値を追随修正
- 検索インデックスへ`fiscalYear`と`memberVotes[].memberName`をキーワード追加
- `validate-data.mjs`へ`BillVoteResult`の値検証と、確定済み議決結果に根拠資料URLが1件も無い場合のエラーを追加

受入条件：
- `validate:data` / `typecheck` / `lint` / `build`すべて成功
- 既存の`/bills/votes`・`/bills/votes/:id`・議員詳細ページの議案賛否表示・検索・OGP・サイトマップ機能を壊していない
- 実データ（`billVotes.json`）は空のまま。架空の議案・賛否データは追加していない

公式資料：
- 該当なし（画面・検証ロジックの整合性修正のため。実データ投入はTASK-004で別途対応）

未対応・既知の限界：
- ブラウザでの実機・実表示確認（375/390/430/768/1280px）は本セッションでは実行できていない（ブラウザ操作ツール未接続）。CSS計算上は横スクロール・数字の折り返しが発生しない設計だが、目視確認が別途必要
- 議案の実データ収集（議案書・採決結果・会議録の確認、議員ごとの賛否の構造化）はTASK-004（BLOCKED）で別途対応する

完了記録：
- 完了日：2026-07-21
- コミットID：7ce3d5e
- 変更概要：上記のとおり。ユーザー依頼（4機能の正式実装）のうち、TASKS.mdへのタスク登録と、議案ごとの賛否データベースの画面側整合性修正・検索インデックス強化までを実施。一般質問・市長公約・財政ダッシュボードの拡張（TASK-005〜007、011〜014）には着手していない。

---

### TASK-029 財政ダッシュボードの表示・検証強化

状態：DONE
優先度：A
対象：`src/pages/FinancePage.tsx`、`src/components/finance/FinanceTable.tsx`（新規）、`src/components/finance/FinanceLineChart.tsx`、`src/data/financeDashboard.json`、`src/types/index.ts`、`scripts/validate-data.mjs`、`scripts/generate-search-index.mjs`
依存関係：なし（既存の`/finance`実データを対象に強化）
目的：ユーザーから「財政ダッシュボード強化」の依頼を受けて`/finance`を調査したところ、歳入・歳出・基金推移・人口推移の画面自体は実装済みだったが、財政指標（健全化判断比率等）が未掲載、グラフに対応する表がない、市民1人当たりの参考値がない、`financeDashboard.json`が`validate-data.mjs`の検証対象外、という不足があったため対応した

作業内容（調査で判明した問題と対応）：
- 財政力指数・経常収支比率・実質公債費比率・将来負担比率・実質収支のいずれも`financeDashboard.json`に存在しなかった。延岡市公式ホームページの「令和6年度健全化判断比率等の公表」ページ（https://www.city.nobeoka.miyazaki.jp/soshiki/18/44461.html）を確認し、実質公債費比率8.6％・将来負担比率15.9％（令和6年度決算、公表日2025-09-19）を確認。財政力指数・経常収支比率・実質収支は今回の調査で公式資料から数値を特定できなかったため、`null`のまま「確認中」表示とした（推測値は追加していない）。実質赤字比率・連結実質赤字比率・資金不足比率は同ページで「対象なし」と明記されていたため、未確認とは区別して`notApplicableIndicators`に記録した
- 延岡市財政分析報告書PDF（`/uploaded/attachment/26656.pdf`）から市債残高・基金種別内訳の複数年度データ取得を試みたが、`pdftotext`でのテキスト抽出結果は数値のみでラベル（財政力指数／経常収支比率等の対応関係）が判読不能だったため、誤った対応付けを避けるためこのPDFのデータは採用しなかった。市債残高の複数年度推移、基金の財政調整基金／減債基金／その他基金の個別内訳は、今回も確認できなかったため追加していない（TASK-014、BLOCKEDのまま）
- グラフ（人口推移・財源調整用基金推移・市債残高推移）に対応する内容が、スクリーンリーダー・印刷利用者向けの表として提供されていなかったため、`caption`付きの`FinanceTable`コンポーネントを新設し、歳入・歳出・基金推移・人口推移の各グラフの直後に同内容の表を追加
- 市民1人当たりの参考値が無かったため、歳入＝歳出（地方公共団体の予算は歳入歳出同額と定められているため統合表示）・基金残高について、既存の公式数値と人口を単純に割った参考値を計算表示に追加。市債は残高データが無いため算出せず、その旨を明記した。人口の基準日と金額の基準日が異なる場合は、両方の基準日を注記した
- 人口推移表に前年比（人数の差分）を追加（既存の複数年度データから計算、新規データ収集不要）
- `financeDashboard.json`が`validate-data.mjs`の検証対象に含まれていなかったため、年度重複・年度欠落・負の値・人口0除算防止・URL形式・出典のsection重複・基金内訳の合計整合性等の検証を新規追加
- `generate-search-index.mjs`の財政エントリへ、人口推移・基金残高・市債・財政指標（財政力指数・経常収支比率・実質公債費比率・将来負担比率・実質収支・健全化判断比率）のキーワードを追加
- 単位（千円）・対象年度・出典・確認日をグラフ・表それぞれの直下に明記し、円・千円・百万円・億円の混在がないことを確認

受入条件：
- 公式資料で確認できた数値のみ使用し、未確認項目は「確認中」と表示（達成）
- グラフと同じ内容を表でも確認できる（達成）
- 人口0除算が起きない設計（達成。`validate-data.mjs`でも検証）
- 円・千円・百万円・億円を混在させない（達成。全数値を千円単位に統一し、億円換算はグラフ表示時のみ変換）
- 既存の`/finance`URL・既存データ（歳入・歳出・基金・人口の実データ）を壊さない（達成）

公式資料：
- 延岡市公式ホームページ「令和6年度健全化判断比率等の公表」（https://www.city.nobeoka.miyazaki.jp/soshiki/18/44461.html）

未対応・既知の限界：
- 市債残高の複数年度推移、基金種別（財政調整基金／減債基金／その他基金）ごとの複数年度内訳、財政力指数・経常収支比率・実質収支は今回も確認できず、追加していない（TASK-014、TASK-013はBLOCKEDのまま）
- 他自治体との財政指標比較は対象外（TASK-013、BLOCKEDのまま）

完了記録：
- 完了日：2026-07-21
- コミットID：ae462ec
- 変更概要：上記のとおり。`validate:data`（errors=0 warnings=0）/`typecheck`/`lint`/`build`すべて成功。Playwrightで375/390/430/768/1024/1280px幅の横スクロールなしと新規セクションの表示、コンソールエラーなしを確認。

---

### TASK-030 市長定例記者会見の一覧ページ追加

状態：DONE
優先度：A
対象：`src/pages/MayorPressConferencesPage.tsx`（新規）、`src/App.tsx`、`src/pages/MayorPage.tsx`、`scripts/generate-sitemap.mjs`、`scripts/generate-search-index.mjs`
依存関係：なし（既存の`mayorPressConferences.ts`・詳細ページ`/mayor/press-conferences/:date`を流用）
目的：ユーザーから「市長記者会見データベース（想定URL `/mayor/press-conferences`、`/mayor/press-conferences/:id`）」の確認を依頼され調査したところ、詳細ページ（`/mayor/press-conferences/:date`）と`MayorPage`からのインライン表示は実装済みだったが、一覧ページ（`/mayor/press-conferences`）が存在しなかったため追加した

作業内容：
- `MayorPressConferencesPage.tsx`を新規作成し、`getSortedMayorPressConferences()`を使って開催日順の一覧・登録件数・空データ時の案内文を表示
- `/mayor/press-conferences`ルートを追加（既存の`/mayor/press-conferences/:date`はそのまま維持）
- `MayorPage.tsx`の記者会見セクションに「市長定例記者会見をすべて見る」リンクを追加
- `generate-sitemap.mjs`・`generate-search-index.mjs`に一覧ページを追加

備考：
- 開催日、タイトル、会見概要、資料PDF、市公式ページ、確認日は既存の詳細ページ（`MayorPressConferenceDetailPage.tsx`）で対応済み
- 「質問と回答」「関連公約」「関連議案」「関連一般質問」「動画」は、延岡市公式ホームページの記者会見発表内容に該当情報が無いため未実装（架空データを追加しないため）。関連付けができる公式資料が確認できた場合に別途対応する
- 記者会見データは現在1件（2026-07-16）のみ。新規記者会見の追加は引き続き`src/data/mayorPressConferences.ts`への手入力で対応する

受入条件：
- `/mayor/press-conferences`にアクセスでき、既存の詳細ページへ遷移できる（達成）
- 既存の`/mayor/press-conferences/:date`・`MayorPage`のインライン表示を壊さない（達成）

公式資料：
- 該当なし（既存データを一覧表示する画面追加のため）

完了記録：
- 完了日：2026-07-21
- コミットID：ece6299
- 変更概要：上記のとおり。`validate:data`（errors=0 warnings=0）/`typecheck`/`lint`/`build`すべて成功。

---

### TASK-031 市長交際費ページへの検索・絞り込み機能追加

状態：DONE
優先度：A
対象：`src/pages/MayorEntertainmentExpensesPage.tsx`、`scripts/generate-search-index.mjs`
依存関係：なし（既存の実データ21件を対象）
目的：ユーザーから「市長交際費データベース」の確認を依頼され調査したところ、日付・区分・内容・支出先・金額・月別/区分別合計・出典・確認日の表示は実装済みだったが、検索・絞り込み機能が無かったため追加した

作業内容：
- 「支出明細」セクションの上に、キーワード検索（支出先・内容、区分を対象）、年度・月・区分の絞り込み、並び替え（支出日/金額の昇順・降順）、条件リセットボタン、結果件数表示を追加
- 月別表示・区分別合計・年度合計の集計カードは、既存どおり年度全体の集計を維持（検索・絞り込みの影響を受けない設計とし、他の一覧ページ（`BillVotesPage`等）と同様に「全体件数」と「絞り込み結果」を区別できるようにした）
- パンくず（`Breadcrumbs`）が無かったため追加（他のページとの一貫性のため）
- サイト内検索インデックスに市長交際費ページのエントリが存在しなかったため新規追加（区分・支出先内容をキーワード・本文として登録）

受入条件：
- キーワード検索・年度・月・区分の絞り込みが動作する（達成）
- 未確認値・個人情報を推測で追加していない（達成。既存の実データ21件から変更なし）
- 既存の月別・区分別集計・明細表示を壊さない（達成）

公式資料：
- 該当なし（UI機能追加。データは既存の実データから変更していない）

完了記録：
- 完了日：2026-07-21
- コミットID：102a11a
- 変更概要：上記のとおり。`validate:data`（errors=0 warnings=0）/`typecheck`/`lint`/`build`すべて成功。

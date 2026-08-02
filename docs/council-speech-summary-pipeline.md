# 一般質問・質疑のAI要約パイプライン（データ基盤）

議員詳細ページに追加した「一般質問・質疑の要約」機能の設計と、今後の実装手順をまとめたものです。
2026年8月に会議録本文の取得を実証し、3発言・8質問項目を試験公開・人による確認まで完了した
（`docs/nobeoka-minutes-fetch-investigation.md`参照）。このドキュメントは、対象を拡大する
担当者（人・AIエージェント問わず）が迷わないための手順書として引き続き参照する。

**収録対象期間**：`src/config/councilSpeechPeriod.json`（単一情報源）で
`from: "2023-04-23"`（延岡市議会議員選挙日）、`to: null`（最新の取得可能な公開会議録まで）と
定義している。実際に対象となる最初の本会議は**令和5年5月15日（令和5年第1回臨時会 第1号）**
であることを確認済み（選挙日当日には会議が存在しない）。取得処理（discover/fetch）・
`validate-data.mjs`・検索インデックス・議員詳細ページ／質問詳細ページの表示・サイトマップは
すべてこの設定を参照する。

---

## 1. 質問通告書ベース情報と会議録本文ベース情報の違い

このサイトには、一般質問に関するデータが2系統あります。混同しないでください。

| | `src/data/generalQuestions.json`（既存） | `src/data/councilSpeechSummaries.json`（新規） |
|---|---|---|
| 元資料 | 総括質疑及び一般質問**通告書**（PDF） | 公式**会議録**本文（会議録検索システム／本会議録PDF） |
| 内容 | 議員が**予定**していた質問項目 | 実際に行われた質問・答弁の要約 |
| 答弁データ | なし | あり（質問項目ごとに答弁要約） |
| 確定度 | 「予定」であり、実際に発言された保証はない | 会議録に基づくため、発言そのものは確定情報 |

画面上では常にこの違いが分かるよう、`generalQuestions.json`由来の表示には「質問通告書等に掲載された予定質問項目を基に整理しています」という注記を付けています（`src/pages/MemberDetailPage.tsx`）。

---

## 2. 会議録本文が必要な理由

`generalQuestions.json`には答弁データが一切なく、質問項目も「予定」でしかありません。実際に何を質問し、市がどう答弁したかを掲載するには、公式**会議録**（本会議の発言記録）本文が必須です。

## 3. 現在の状況（2026年8月更新）

- `public/council-documents/**/minutes/` フォルダは全26会期分存在するが、中身は空（0ファイル）。
- `scripts/fetch-nobeoka-council-documents.mjs` は「議案等審議結果」一覧PDFしか取得しておらず、会議録は対象外。
- **公式の会議録検索システム（`https://www.kensakusystem.jp/nobeoka/`）から、Node.jsで会議録本文を取得できることを実証済み**（詳細は`docs/nobeoka-minutes-fetch-investigation.md`）。以前の「セッションCGIで取得不可」という判断は誤りだった。実際には`Code`はサイト固有の固定値であり、Cookie・セッション状態は不要。`scripts/lib/minutes-source.mjs`に、発言順・発言者付きで本会議日ごとの発言セグメント一覧を取得する関数（`listMeetingDays` / `listSpeakerSegments` / `fetchSegmentText`）を実装済み。
- `robots.txt`は存在しない（404）が、トップページの`<meta name="robots" content="follow,index">`によりクロール自体は許可されている。ただし過度な連続アクセスは避けること（`scripts/lib/minutes-source.mjs`は最低2秒間隔のスロットリングを実装済み）。

## 4. 会議録取得処理の想定

`scripts/lib/minutes-source.mjs` に、実際に動作を確認した低レベル関数を実装済み（詳細は`docs/nobeoka-minutes-fetch-investigation.md`）。

- `listMeetingDays({code, sessionLabel})` … 会期内の本会議日一覧（fileName）を取得
- `fetchMeetingTitle({code, fileName})` … 本会議日の正式な会議名を取得
- `listSpeakerSegments({code, fileName})` … その本会議日の発言セグメント一覧（発言順・発言者・開始位置）を取得
- `fetchSegmentText({code, fileName, pos})` … 発言セグメント1件の本文を取得
- `classifySpeakerLabel(label)` … 発言者ラベルから種別（市長／幹部職員／議長／議員）を推定

一方、`fetchMinutesForSpeech(input)`（`{sessionId, meetingDate, meetingNumber, officialSearchUrl, memberId}` → `{sourceType, sourceUrl, fetchedAt, rawTextPath, normalizedTextPath, status}`）は、councilSessions.json・members.jsonの情報から上記の低レベル関数を自動的に呼び出す高レベルインターフェースとして設計したものだが、**まだ未実装のスタブのまま**（常に`status: "not-fetched"`を返す）。これを実装することが次のステップ。

実装時に決めるべきこと：

1. `See.exe`の1階層目（年の選択）を自動化し、councilSessions.jsonの`title`（例: "令和8年3月定例会"）から`sessionLabel`（例: "令和 8年 第24回定例会 "）を機械的に導出する処理（現状は手動で値を渡している）。
2. 取得した生テキストの保存場所：Gitで管理するか（著作物のため慎重に判断）、`.gitignore`対象のローカルキャッシュ／CI成果物のみとするかを決める。個人的には後者（Git管理しない）を推奨。理由：公式サイトの著作物をそのまま複製・再配布する形になりやすく、鮮度管理も難しいため。今回の試験データ（`data/minutes/`）は例外的に少数件のみコミットしている。
3. Cookie・セッショントークン・APIキー等はリポジトリへ一切コミットしない（今回の調査で判明したとおり、このシステム自体はCookie不要だが、AI要約生成で外部LLM APIキーを使う場合は`.env`等を使い`.gitignore`必須）。
4. 取得間隔を空け、同じ資料を再実行のたびに毎回取得しない（`scripts/fetch-nobeoka-speaker-minutes.mjs`は出力ファイルの存在チェックで再取得を防止済み。本格実装でも同様の仕組みを維持する）。

## 5. 発言者識別

会議録本文には、議長・他議員・答弁者（市長・副市長・教育長・部長等）の発言が混在する。対象議員の発言だけを正確に切り出すこと。

- 対象議員の発言開始位置は「○○議員」「○番（○○君）」等の表記から検出する。
- 次の発言者表記が現れるまでを対象議員の発言とする。
- 議長の進行発言、休憩・再開の記録、拍手等の記録、ページヘッダー・フッター、目次、重複OCRテキストを質問本文へ混入させない。
- 発言者を確定できない場合は `summaryStatus: "speaker-identification-pending"` とし、`isPublished: false` のまま保存する（自動公開しない）。

## 6. 質問と答弁の分割

一般質問・代表質問・総括質疑・議案質疑は`speechType`で区別し、討論・動議・議事進行・委員長報告・議案提出理由等とは別データとして扱う（`CouncilSpeechType`）。

一度の質問に複数の項目がある場合は`questionItems`配列で分割する。質問と答弁の対応が会議録上で明確な場合のみ紐付ける。対応が不明確な場合は`summaryStatus: "question-answer-link-pending"`とし、無理に結びつけない。

一問一答方式の再質問・再答弁は、`CouncilSpeechQuestionItem.exchanges`（`order`付きの配列）で会話順序を保持する。

## 7. AI要約生成

`scripts/generate-speech-summaries.mjs`（未実装。ファイル名は暫定）を新設し、以下の流れで実装する。

1. 対象会期を選択する。
2. `fetchMinutesForSpeech()`（実装後）で会議録本文を取得する。
3. ヘッダー・フッター・ページ番号・重複行を除去する（正規化）。
4. 発言者を識別し、対象議員の質問部分を抽出する。
5. 対応する答弁部分を抽出する。
6. 質問項目ごとに分割する。
7. 質問要約・答弁要約をLLMで生成する（プロンプトは元の依頼メッセージの【22】節を参照。事実のみを使い、評価・推測・感情表現を含めないこと）。
8. テーマ候補・関連議案候補を抽出する（`relationStatus: "suggested"`で保存し、自動確定しない）。
9. `summaryStatus: "pending"`、`isPublished: false`で`councilSpeechSummaries.json`へ保存する。
10. 実行のたびに再生成しない（既存のverified/partially-verifiedレコードは上書きしない。`generate-bill-summaries.mjs`・`generate-session-summaries.mjs`と同じ冪等方針）。

APIキー等の秘密情報はリポジトリへ保存しない（環境変数・CIシークレットで渡す）。

## 8. 人による確認

`npm run speeches:list-pending` で確認待ち一覧を表示する。担当者は元の会議録原文、質問要約、答弁要約、質問と答弁の対応、テーマ、関連議案候補、該当ページ、発言者、確認メモを照合する。

## 9. 承認

`npm run speeches:approve -- --id=<speechId>` を実行する（`scripts/review-speech-summaries.mjs`）。承認前チェック：

- 質問要約が空でないか
- 出典（`summarySources`）が登録されているか
- 発言者が確定しているか（`speaker-identification-pending`でないか）
- 質問と答弁の対応が確認できているか（`question-answer-link-pending`の場合は警告のみ、承認は妨げない＝人の判断に委ねる）

1つでもNGがあれば承認されない。承認すると`summaryStatus`が`verified`（または`partially-verified`のまま）になり、`verifiedAt`が記録される。

## 10. 公開

承認後、`isPublished: true`に更新することで初めて一般公開・サイトマップ・プリレンダリング対象になる（`scripts/lib/public-routes.mjs`の`publishedSpeeches()`が`isPublished: true`のみを対象にする）。承認＝公開ではない点に注意（既存のbillVotes/councilSessionsと異なり、このデータは「確認前は非公開」の方針。理由：会議録の誤読は個人の発言内容を誤って掲載するリスクがあり、議案データより慎重な扱いが必要なため）。

## 11. 訂正

会期カード・詳細ページに「要約内容の訂正・情報提供」ボタン（`CorrectionRequestButton`）を設置済み。第三者からの情報提供だけで自動修正・自動承認はしない。公式会議録と照合したうえで人が修正する。

## 12. 関連議案との紐付け

`CouncilSpeechQuestionItem.relatedBills`で管理する。`relationType`（explicit-reference / topic-match / budget-reference / other）と`relationStatus`（confirmed / suggested / rejected）を必ず分離する。`confirmed`は質問本文・答弁本文に明確な根拠がある場合のみ。キーワード一致だけでは`suggested`に留める。

## 13. 公開してはいけない状態

- `summaryStatus`が`minutes-not-fetched`または`source-unavailable`のまま`isPublished: true`にすること（`validate-data.mjs`がエラーにする）。
- 発言者未確定（`speaker-identification-pending`）のまま公開すること。
- 質問要約・答弁要約が空のまま`verified`とすること。
- `verified`なのに出典（`summarySources`）が0件の状態。

## 14. データ追加例

`src/data/councilSpeechSummaries.json`の該当議員レコードの`speeches`配列へ追加する。フィールドの意味は`src/types/index.ts`の`CouncilSpeech`関連の型定義コメントを参照。

## 15. 検証コマンド

```
npm run validate:data       # councilSpeechSummaries.jsonの整合性チェックを含む
npm run typecheck
npm run lint
npm run build                # prerender + validate:seoを含む
node scripts/release-check.mjs
npm run speeches:list-pending
```

## 16. 今後の全議員展開手順

元の依頼メッセージの【28】節のとおり、段階的に進める。

1. **第1段階（完了・2026年8月）**：1名・1会期（前田遼議員／令和8年3月定例会 第2号）で、会議録本文の取得→発言抽出→要約候補作成→`pending`保存を実証。
2. **第2段階（一部完了・2026年8月）**：2会期・議員3名（前田遼・宮田博徳・甲斐忠篤）、3発言・8質問項目に拡大し、人による最終確認・承認（`npm run speeches:approve`）まで完了した（詳細は`docs/nobeoka-minutes-fetch-investigation.md`）。テーマ集計・関連議案候補抽出の仕組みは実装済みだが、実際の関連議案候補は今回0件（原文に明示的な言及がなかったため）。
3. **収録対象期間の統一（完了・2026年8月）**：`src/config/councilSpeechPeriod.json`（`from: "2023-04-23"`）を単一情報源とし、取得処理（`minutes:discover`/`minutes:fetch`の`--from`）・`validate-data.mjs`・検索インデックス・サイトマップ・議員詳細/質問詳細ページの表示をすべてこの設定に統一した。
4. **次にやること**：`fetchMinutesForSpeech()`を、councilSessions.json・members.jsonの情報から`See.exe`の年階層探索を含めて自動的に低レベル関数を呼び出す実装へ置き換える（現状は`sessionLabel`等を手動で渡している）。
5. **第3段階**：対象期間（2023-04-23以降）の全26会期・全26議員に展開し、`generate-speech-summary-scaffold.mjs`が示す「未取得」件数を減らしていく。段階的取得順序は「新しい年度から古い年度へ」を基本とする。

### 市長発言に関する注意（多年度展開時に必ず確認すること）

現在の市長（三浦久知氏）は令和7年7月に就任した。それより前（2023-04-23〜2025年7月頃）の
本会議録に含まれる「市長」答弁は、前市長（読谷山氏）のものである。`src/data/mayor.json`は
現職市長1名分のデータしか保持していないため、2025年7月より前の会議録を取得・要約する場合は、
答弁者を単純に「市長」＝現職市長として扱わないこと。市長交代のタイミングを会議日と照合し、
必要であれば発言者を市長名で明示する、または別途市長の在任期間データを追加するなどの対応を
先に検討すること（今回は対象範囲がすべて現職市長の在任期間内だったため、この問題は発生していない）。

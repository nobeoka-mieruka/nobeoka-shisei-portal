# 一般質問・質疑のAI要約パイプライン（データ基盤）

議員詳細ページに追加した「一般質問・質疑の要約」機能の設計と、今後の実装手順をまとめたものです。
**2026年8月時点では、公式会議録本文の取得機能そのものが未実装であり、実データは1件も存在しません。**
このドキュメントは、会議録取得機能を実装する担当者（人・AIエージェント問わず）が迷わないための手順書です。

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

## 3. 現在のブロッカー

- `public/council-documents/**/minutes/` フォルダは全26会期分存在するが、中身は空（0ファイル）。
- `scripts/fetch-nobeoka-council-documents.mjs` は「議案等審議結果」一覧PDFしか取得しておらず、会議録は対象外。
- 公式の会議録検索システム（`https://www.kensakusystem.jp/nobeoka/`）は固定URLではなく、セッションCode方式のCGI（`cgi-bin3/Search2.exe?Code=...&sTarget=2`）。単純なGETリクエストでは本文にたどり着けない。
- `robots.txt`は存在しない（404）が、これは無制限アクセスの許可を意味しない。過度な連続アクセスは避けること。

## 4. 会議録取得処理の想定

`scripts/lib/minutes-source.mjs` の `fetchMinutesForSpeech(input)` が入出力インターフェースを定義済み（現在は常に `status: "not-fetched"` を返すスタブ）。

入力：`{ sessionId, meetingDate, meetingNumber, officialSearchUrl, memberId }`
出力：`{ sourceType, sourceUrl, fetchedAt, rawTextPath, normalizedTextPath, status }`

実装時に決めるべきこと：

1. 会議録検索システムの検索フォーム送信方法（GET/POST、必要なパラメータ）を実際のHTMLから調査する。
2. 取得した生テキストの保存場所：Gitで管理するか（著作物のため慎重に判断）、`.gitignore`対象のローカルキャッシュ／CI成果物のみとするかを決める。個人的には後者（Git管理しない）を推奨。理由：公式サイトの著作物をそのまま複製・再配布する形になりやすく、鮮度管理も難しいため。
3. Cookie・セッショントークン・APIキー等はリポジトリへ一切コミットしない（`.env`等を使う場合も`.gitignore`必須）。
4. 取得間隔を空け、同じ資料を再実行のたびに毎回取得しない（キャッシュ・ハッシュ比較で差分のみ処理する。`scripts/lib/council-shared.mjs`の`sha256OfBuffer`等、既存の仕組みを流用できる）。

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

1. **第1段階**：`scripts/lib/minutes-source.mjs`を実装し、1名・1会期で会議録本文の取得→発言抽出→要約→`pending`保存→人の確認→承認までを試験する。テスト対象は、公式会議録で発言範囲を明確に確認できる議員・会期を選ぶ（特定の議員を優遇しているように見えないよう、試験実装であることをコミットメッセージ等に明記する）。
2. **第2段階**：複数議員・複数会期に拡大し、テーマ集計・関連議案候補抽出を検証する。
3. **第3段階**：現在の任期（令和5年5月以降）の全26会期・全26議員に展開し、`generate-speech-summary-scaffold.mjs`が示す「未取得」件数を減らしていく。

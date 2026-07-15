# 延岡市政見える化ポータル 更新の手引き

このサイトは、データファイル（JSON）を書き換えるだけで、議員一覧・議員詳細・ダッシュボード・検索・サイトマップなどの関連ページへ自動的に反映される仕組みになっています。中学生でも読めるように、できるだけやさしい言葉で説明します。

---

## 0. 更新作業の全体の流れ

1. データファイル（`src/data/` の中のJSONファイル）を編集する
2. `npm run release:check` を実行する
3. エラーが出ていないことを確認する
4. Gitへコミットする
5. GitHubへpushする
6. Cloudflare Pagesが自動でビルド・公開してくれる（数分待つ）

これだけです。HTMLやReactのコードを直接さわる必要は、基本的にありません。

---

## 1. 議員情報を更新する方法

### 編集するファイル

`src/data/members.json`

### 必須項目（かならず入力する）

- `id`：議員ごとの一意な文字列（例：`"m27"`）。他の議員と重複させない
- `name`：氏名（例：`"山田 太郎"`）
- `nameKana`：ふりがな
- `factionId`：所属会派のID（`src/data/factions.json` に定義されているもの）
- `gender`：`"male"` / `"female"` / `"other"` / `"undisclosed"` / `"unknown"` のいずれか
- `committees`：所属委員会の配列（分からない場合は `[]`）
- `profile`：プロフィール文（未確認の場合は `"情報確認中"` のままにする）
- `sns`：SNSの配列（なければ `[]`）
- `questions` / `votes` / `reports`：それぞれ配列（なければ `[]`）

### 任意項目

- `photoUrl`：顔写真のパス（下記「写真の置き場所」を参照）
- `termCount`：当選回数
- `age` / `ageAsOf`：年齢とその基準日
- `district`：選挙区
- `role`：議長・副議長などの役職
- `profileUrl`：公式プロフィールページのURL
- `sources`：出典・参考資料の配列

### 写真の置き場所

`public/photos/` フォルダに画像を置き、`photoUrl` に `/photos/ファイル名.jpg` のように指定します。ファイル名はローマ字などで分かりやすくしてください。

### IDの付け方

既存の最大の番号の次の番号を使います（例：`m26` まであれば `m27`）。一度使ったIDは、その議員が引退・退任した後も再利用しないでください（過去の議案賛否データなどが指すIDと矛盾するのを防ぐためです）。

### SNS URLの入力方法

```json
{ "platform": "x", "url": "https://x.com/xxxxx", "verificationStatus": "verified" }
```

- `platform`：`"x"` `"facebook"` `"instagram"` `"threads"` `"youtube"` `"line"` `"blog"` `"website"` のいずれか
- `verificationStatus`：本人公式だと確認できた場合のみ `"verified"` にする。確認できていない場合は省略するか `"unverified"` にする（**推測で `"verified"` にしないでください**）

### 確認日の入力方法

`verifiedAt`（情報源をいつ確認したか）・`updatedAt`（サイト側でいつ更新したか）は、実際に確認・更新した日だけ `"2026-07-15"` のようなISO形式で入力してください。**確認していないのに今日の日付を入れないでください。** ビルドしただけでは自動的に書き換わりません。

### Excel・CSVでまとめて議員情報を取り込む方法（上級者向け）

たくさんの議員情報を一度に入力したいときは、Excel（.xlsx）またはCSVファイルから取り込む機能が使えます。**この機能は「下書きを作る」ためのものです。既存のデータを自動的に書き換えることはありません。**

1. `templates/members-template.xlsx` をコピーして開く（Excel・Googleスプレッドシートなど）
2. 1行目（見出し行）は変更せず、2行目以降に議員情報を入力する
   - 見出し：`id` `氏名` `ふりがな` `会派ID` `性別` `所属委員会` `プロフィール` `写真パス` `当選回数` `年齢` `年齢基準日` `選挙区` `役職` `公式プロフィールURL`
   - `性別` は `male` / `female` / `other` / `undisclosed` / `unknown`、または `男性` / `女性` / `その他` / `非公開` / `不明` のいずれか
   - `所属委員会` は複数ある場合、読点（、）またはカンマ（,）で区切る
   - CSVで保存する場合は、文字化けを防ぐため必ず**UTF-8**で保存してください（Excelの「名前を付けて保存」→「CSV UTF-8（コンマ区切り）」を選ぶと安全です）
3. ターミナルで次を実行する

   ```
   npm run import:members -- 保存したファイルのパス.xlsx
   ```

4. 次のいずれかになります。
   - **エラーが表示された場合**：内容を修正して、もう一度実行してください（この場合、何も反映されていません）
   - **成功した場合**：次の場所に「下書き」が作られます
     - `generated/import-preview/members.json`：変換されたデータ（プレビュー）
     - `generated/import-preview/members-diff.txt`：既存データとの違い（新しく増えるID、含まれていないID など）
     - `backups/日時/members.json`：取込前の`src/data/members.json`のバックアップ

5. **`generated/import-preview/members.json` の中身と、`members-diff.txt` の差分を必ず人の目で確認してください。**
6. 問題がなければ、確認した内容を手作業で `src/data/members.json` へ反映してください（自動反映はしません）。SNSリンクなど、この取込機能で対応していない項目は、既存データを見ながら手動で補ってください。

この仕組みは今回、議員データのみに対応しています。議案・賛否・一般質問・報酬データの取込は今後の課題です（詳しくは完了報告の「未完了事項」をご覧ください）。

---

## 2. 議案を追加する方法

### 議案データの入力

`src/data/billVotes.json` に、`BillVoteItem` 型（`src/types/index.ts` を参照）にしたがって1件追加します。

必須：`id`（重複不可）、`fiscalYear`、`session`、`billNumber`、`billTitle`、`summary`、`result`、`memberVotes`

### 賛否データの入力

`memberVotes` 配列に、議員ごとの賛否を入力します。

```json
{ "memberId": "m01", "memberName": "稲田 雅之", "faction": "自民党きずなの会", "vote": "approve" }
```

`vote` は `"approve"`（賛成）`"oppose"`（反対）`"abstain"`（退席）`"absent"`（欠席）`"recused"`（除斥）`"notVoting"`（採決なし）のいずれかだけを使ってください。

**議員個人の賛否が公式資料で確認できない場合は、`memberVotes` を空配列 `[]` のままにしてください。**「全会一致だから全員賛成」のように推測で埋めないでください（議長は採決に加わらない、欠席していた、などの可能性があるためです）。

### 議員IDの確認

`memberVotes[].memberId` は、必ず `members.json` に実在するIDを使ってください。`npm run validate:data` で存在しないIDを自動検出します。

### 原資料URL

`billDocumentUrl`（議案書）、`resultDocumentUrl`（議決結果）、`transcriptUrl`（会議録）などに、実在するURLだけを入力してください。存在するものだけ画面に表示されます。

### 採決日の入力

`votingDate` は `"2026-06-25"` のようなISO形式（`YYYY-MM-DD`）で入力してください。

### 未確認項目の扱い

分からない項目は省略してください（空文字 `""` ではなく、キーごと書かない）。`result` がまだ確認できない場合は `"確認中"` を使ってください。

---

## 3. 一般質問を追加する方法

### 編集するファイル

`src/data/generalQuestions.json`

### 入力する主な項目

- `memberId` / `memberName`：質問した議員
- `questionDate`：質問日（`YYYY-MM-DD`）
- `sessionName` / `sessionType`：定例会・臨時会の名称と区分
- `questionType`：`"一般質問"` または `"代表質問"`
- `title`：質問タイトル
- `summary`：200字程度の要約（全文転載はしない）
- `topics`：テーマのタグ（自由に追加可能。既存の傾向に合わせると検索しやすくなります）
- `questionItems`：質問項目の一覧（見出しのみ、全文は書かない）

### 会議録

`transcriptUrl` に会議録のURLを入力します。会議録がまだ公開されていない場合は空欄のままにし、`notes` にその旨を書いておくと親切です。

### 答弁概要

`answerSummary` / `answerSpeaker` / `answerDepartment` は、会議録で答弁内容を確認できた場合だけ入力してください（現状は未実装の任意項目です）。

---

## 4. 市長公約を更新する方法

### 編集するファイル

`src/data/mayorPromises.json`

### 状態の選択

`statusLabel` は次のいずれかだけを使ってください。

`"進行中"` `"検討中"` `"実施済み"` `"確認中"`

### 根拠資料・確認日

`evidenceItems` に根拠資料への参照を追加し、`lastVerified` に実際に確認した日を入力してください。

### 独自判断をしない注意

**「達成した」「達成していない」を運営者の判断だけで決めないでください。** 公式資料や本人の公式発信で確認できた事実だけを `progressSummary`（箇条書き）に記載し、状態は上記4区分のいずれかに分類してください。根拠が確認できない場合は `"確認中"` にしてください。

---

## 5. 公開する方法

1. 上記の手順でデータファイル（JSON）を編集する
2. ターミナルで次を実行する

   ```
   npm run release:check
   ```

3. エラー（`[FAIL]`）が出ていないことを確認する。警告（`[WARN]`）は出ても公開はできますが、できれば直してください
4. 変更をコミットする

   ```
   git add -A
   git commit -m "議員データを更新"
   ```

5. GitHubへpushする

   ```
   git push origin main
   ```

6. Cloudflare Pagesのダッシュボードで、自動ビルドが成功したことを確認する（数分かかります）

---

## こまったときは

- `npm run validate:data` を実行すると、ID重複や存在しない参照などのエラーを個別に確認できます
- `npm run typecheck` を実行すると、型のミスが分かります
- エラーメッセージにはファイル名と内容が表示されるので、そのファイルの該当箇所を確認してください
- 分からない場合は、無理に公開せず、分かる人に確認してから進めてください

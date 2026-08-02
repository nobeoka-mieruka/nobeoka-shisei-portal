# 定例会・議会資料PDFの登録手順

延岡市議会が公開している議案書、審議結果、請願・陳情、会議録、市議会だよりなどのPDFを、定例会・臨時会ごとに整理して「定例会・議会資料」ページ（`/council-documents`）に反映するための手順です。

コード（React/TypeScriptのファイル）は基本的に変更不要です。**フォルダへPDFを置くこと**と**`src/data/councilSessions.json`にデータを追加すること**の2つだけで反映されます。

---

## 0. 全体の考え方

- 1つの定例会・臨時会 ＝ `src/data/councilSessions.json` の1要素（`CouncilSession`）
- その中の資料（PDF）1件 ＝ `documents` 配列の1要素（`CouncilDocument`）
- 型定義は `src/types/index.ts` の `CouncilSession` / `CouncilDocument` を参照してください
- コピー用のひな形は `src/data/templates/councilSessionTemplate.ts` にあります

**著作権・公開範囲の大原則：**

- 延岡市議会・延岡市が一般公開しているPDFだけを対象にする
- ログインが必要な資料、個人情報を含む資料、転載禁止の資料は登録しない
- 公開可否が分からない資料は、サイト内に複製せず `storageType: "external"`（公式サイトへの外部リンクのみ）にする
- PDFの内容（本文）を加工・編集・切り抜きしない。整理するのはファイル名とサイト上の見せ方だけ

---

## 1. フォルダの作成場所とルール

### 置き場所

```
public/council-documents/<年度>/<定例会ID>/<資料分類>/
```

- `<年度>`：西暦4桁。4月始まりの年度（例：令和8年度なら `2026`）
- `<定例会ID>`：下記のルールで作った1つの定例会・臨時会を表すID
- `<資料分類>`：`proposals` / `results` / `petitions` / `statements` / `minutes` / `newsletters` / `other` のいずれか

すでに全定例会・臨時会分（令和5年5月〜令和8年6月）のフォルダと資料分類サブフォルダを作成済みです（`.gitkeep`で空フォルダをGit管理下に置いています）。新しい定例会が開催されたときだけ、下記の要領でフォルダを追加してください。

### 定例会IDの付け方

- 定例会：`西暦-月`（例：`2026-06` ＝ 令和8年6月定例会）
- 臨時会：`西暦-月-extraordinary`（例：`2026-05-extraordinary` ＝ 令和8年5月臨時会）
- 同じ月に複数の臨時会がある場合：末尾に連番（例：`2023-07-extraordinary-01` `2023-07-extraordinary-02`）

### 資料分類（カテゴリ）の意味

| カテゴリID | 表示名 | 内容の例 |
|---|---|---|
| `proposals` | 議案・条例・予算 | 議案書、条例案、予算案、補正予算案 |
| `results` | 審議結果・表決結果 | 審議結果、採決結果、議員別賛否表 |
| `petitions` | 請願・陳情 | 請願書、陳情書、要望書 |
| `statements` | 意見書・決議・討論 | 意見書、決議、修正案、討論資料 |
| `minutes` | 会議録 | 本会議録、委員会記録 |
| `newsletters` | 市議会だより | のべおか市議会だより |
| `other` | その他の資料 | 上記に当てはまらない資料 |

---

## 2. PDFファイル名のルール

- 半角英数字とハイフンのみ（空白・全角文字・括弧・日本語は使わない）
- 内容が分かる名前にする（例：`deliberation-results.pdf` `proposal-042.pdf` `minutes-plenary-2026-06-12.pdf`）
- 同じ種類が複数ある場合は番号または日付を付ける

---

## 3. PDFを保存する場合（storageType: "local"）

1. 該当フォルダ（例：`public/council-documents/2026/2026-06/results/`）にPDFファイルを置く
2. `councilSessions.json`の資料データで、`storageType: "local"`、`filePath`にサイト内パス（例：`"/council-documents/2026/2026-06/results/deliberation-results.pdf"`）を設定する
3. `sourceUrl`に、コピー元となった延岡市議会公式サイトのURLを必ず記録する（無断複製ではなく、出典を示すため）

`npm run validate:data` は、`storageType: "local"` の資料について `filePath` が実在するファイルかどうかを自動チェックします。存在しないパスを指定するとエラーになります。

## 4. 公式サイトへの外部リンクのみにする場合（storageType: "external"）

サイト内にPDFを複製せず、公式サイトへのリンクだけを案内したい場合はこちらを使います（公開可否が不明な資料は必ずこちらにしてください）。

```json
{
  "storageType": "external",
  "sourceUrl": "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/xxxxx.pdf"
}
```

`filePath`は不要です（省略してください）。

---

## 5. データ登録方法（`src/data/councilSessions.json`）

1. `src/data/templates/councilSessionTemplate.ts` の中身をコピーする
2. `src/data/councilSessions.json` の配列（`[ ]`）の中に、JSON形式で1要素として貼り付ける
3. 確認できた項目だけを入力する。確認できていない項目（例：会期の開始日・終了日）はキーごと省略する（空文字 `""` を入れない）
4. 資料（`documents`）がまだ無い定例会は、`documents: []` のままにする（詳細ページには「資料は現在整理中です」と自動表示されます）

### 入力例（審議結果PDFを1件だけ登録する場合）

```json
{
  "id": "2026-09",
  "year": 2026,
  "fiscalYear": 2026,
  "eraYear": "令和8年",
  "title": "令和8年9月定例会",
  "sessionType": "定例会",
  "sessionNumber": "第27回",
  "folderPath": "/council-documents/2026/2026-09",
  "documents": [
    {
      "id": "2026-09-results",
      "category": "results",
      "title": "議案等審議結果",
      "storageType": "external",
      "fileType": "PDF",
      "sourceUrl": "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/xxxxx.pdf",
      "isOfficial": true,
      "verifiedAt": "2026-09-30"
    }
  ],
  "officialSessionUrl": "https://www.city.nobeoka.miyazaki.jp/site/gikai/1456.html",
  "lastVerified": "2026-09-30"
}
```

---

## 6. 公式URLの登録方法

- `documents[].sourceUrl`：その資料そのものの公式URL（PDFへの直リンク、または資料が掲載されている公式ページ）
- `officialSessionUrl`：延岡市議会公式サイトの、その定例会に関する情報が確認できるページ（審議結果一覧ページなど）

どちらも `https://` から始まる完全なURLを入力してください（`npm run validate:data` が形式をチェックします）。

---

## 7. ページ数・ファイルサイズの確認方法

- ページ数：PDFをブラウザやPDFビューアーで開き、総ページ数を確認して `pages` に数値で入力（不明なら省略、または `null`）
- ファイルサイズ：ファイルのプロパティ（エクスプローラーで右クリック→プロパティ）で確認し、`"1.2MB"` のような文字列で `fileSize` に入力（不明なら省略）

---

## 8. 議案データとの連携（任意）

`src/data/billVotes.json` の議案データに、以下を追加すると、議案詳細ページから該当PDFへのリンクが自動表示されます。

```json
{
  "sessionId": "2026-06",
  "sourceDocumentId": "2026-06-results",
  "sourcePage": 3
}
```

- `sessionId`：`councilSessions.json`の該当する定例会の`id`
- `sourceDocumentId`：その定例会の`documents[].id`
- `sourcePage`：PDF内でその議案が掲載されているページ番号（確認できた場合のみ）

---

## 9. 表示確認方法

```
npm run dev
```

1. `http://localhost:5173/council-documents` … 一覧ページ（年度別アコーディオン）
2. `http://localhost:5173/council-documents/<定例会ID>` … 詳細ページ
3. PDFカードの「PDFを新しいタブで開く」ボタンが正しいPDF・URLを開くか確認する
4. スマートフォン幅（375px・390px・430px）と768px・1280pxの両方で崩れがないか確認する

---

## 10. デプロイ方法

1. `npm run validate:data` … データの整合性チェック（エラーが出ないこと）
2. `npm run typecheck` … 型チェック
3. `npm run build` … ビルド（サイトマップ・プリレンダリングまで実行されます）
4. 問題がなければコミットしてGitHubへpush
5. Cloudflare Pagesが自動でビルド・公開します（数分待つ）

---

## 10.5 自動更新の仕組み（審議結果PDF）

「議案等審議結果」ページ（https://www.city.nobeoka.miyazaki.jp/site/gikai/1456.html ）については、
毎日日本時間午前6時ごろ、GitHub Actions（`.github/workflows/update-council-documents.yml`）が
自動的に確認し、新しいPDFがあれば取得・登録・コミット・pushします。差分がない日はコミットしません。

### 手動で今すぐ確認したいとき

GitHubの「Actions」タブから `Update council documents` ワークフローを開き、「Run workflow」で手動実行できます。

### ローカルで確認・テストする方法

```
npm run fetch:council-documents -- --dry-run   # 検出結果だけ確認（何も書き込まない）
npm run fetch:council-documents                # 実際に取得・登録する
npm run generate:council-documents             # public/配下のPDFとの整合を取る
npm run validate:data
```

### 自動登録される資料の扱い

- 新規に見つかった審議結果PDFは `verificationStatus: "自動取得"` を付けて自動公開されます。
- 既存資料の内容が公式サイト側で変わっていた場合は、`publicationStatus: "updatedPendingReview"` を付けて
  **一般公開ページには表示されません**。内容を確認し、問題なければ `publicationStatus` を削除するか
  `"published"` にしてください。
- 公式ページからPDFリンクが削除された場合も、サイト内のPDFは自動削除されず、
  `publicationStatus: "removedPendingReview"` を付けて一般公開ページから外れるだけです。

### 安全のための自動停止条件

以下の場合、自動更新は何も変更せずに終了します（詳しくはスクリプト冒頭のコメントを参照）。

- 公式ページを取得できない／HTML解析に失敗した
- PDFリンクが0件しか見つからない
- 前回確認できていたPDFの50%以上が一度に消えた
- ダウンロードした内容がPDFではない（Content-Type・先頭バイトの不正、0バイト）
- 許可ドメイン（www.city.nobeoka.miyazaki.jp / city.nobeoka.miyazaki.jp）以外への通信

---

## 11. 削除・差し替え方法

- **資料を1件削除する**：`councilSessions.json`の該当`documents`配列から要素を削除する。PDFファイル自体を残しても画面には出ません（不要なら`public/council-documents/`配下からファイルも削除してください）
- **資料を差し替える**：同じ`id`のまま、`filePath`または`sourceUrl`・`verifiedAt`を新しい内容に書き換える。PDFファイル自体を差し替える場合は、ファイル名を変えるか、キャッシュ対策として`verifiedAt`も更新してください
- **定例会自体を削除する**：`councilSessions.json`から該当要素を削除する。他の議案データ（`billVotes.json`）が`sessionId`でこの定例会を参照している場合は`npm run validate:data`が警告を出すので、あわせて確認してください

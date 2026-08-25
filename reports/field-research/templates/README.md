# 現地調査結果 入力フォーマット（Phase144）

延岡市政見える化ポータルの現地調査（図書館・市役所・県文書センター・国立国会図書館等への
訪問、または照会文書への回答受領）の結果を、後日リポジトリへ安全に反映できる形で記録するための
標準フォーマット。

このフォーマットの目的は、

> 現地確認 → 記録 → 出典化 → UNR（未解決事項）解消判定 → データ検証（validate:data）

という流れを毎回同じ形で行えるようにすることである。

## このフォルダの構成

| ファイル | 内容 |
|---|---|
| `field-research-result.schema.json` | 機械可読なJSON Schema定義。フォーマットの正本の1つ。 |
| `field-research-result.example.json` | 記入例（**架空のダミーデータ**、実在の調査結果ではない）。 |
| `README.md` | 本ファイル。人間向けの記入手順。 |

対応するTypeScript型定義：[`src/types/fieldResearch.ts`](../../../src/types/fieldResearch.ts)
（`FieldResearchRecord` / `FieldResearchRecordFile`）。JSON Schemaと内容を一致させてある。

型自体の設計方針（必須/任意の判断根拠、既存型の再利用方針等）は
`src/types/fieldResearch.ts` 冒頭・各フィールドのJSDocコメントを参照すること。ここでは
現地での使い方に絞って説明する。

## 現地調査の手順

### 1. 訪問前（事前準備）

1. `reports/field-research/unr-priority-master.md`（または後続フェーズの現地調査票）で、
   今回どのUNR（例：`UNR-014`）・どの資料を確認しに行くか確認する。
2. `field-research-result.example.json` をコピーし、訪問先ごと・日付ごとにファイル名を決める
   （例：`2026-09-01-nobeoka-library.json`）。**このコピー先は当面は各自のローカル・
   運営者の作業用フォルダとし、リポジトリの `reports/field-research/` 直下や
   `src/data/` へ直接置かないこと**（実データ運用の正式な保存場所は今後のフェーズで検討する。
   現時点で正式な保存先が決まっていないファイルをリポジトリへコミットしない）。
3. 現地でスマートフォン・紙のメモでも記入できるよう、このREADMEの「現地メモ用チェック項目」
   （下記）を印刷・保存しておいてもよい。

### 2. 現地で（1資料＝1レコード）

資料1点（またはUNR1件に対する1回の確認試行）ごとに、`FieldResearchRecord` の
1レコード分を記録する。**その場で分かる範囲をすべて埋める。** 特に次の3点は、
資料が見つからなかった場合でも必ず埋めること。

- `checkedAt`（訪問日）／`checkedBy`（記録者）
- `materialTitle`（何を探しに行ったか。見つからなくても「何を探したか」は必ず書く）
- `result`（下記の結果区分）／`unrResolution`（UNR側の扱い）

現地メモの取り方は自由（紙のメモ・スマホのメモアプリ・音声メモ）でよいが、
帰宅後に本フォーマットのJSONへ必ず転記すること。

#### 撮影・複写について

- 撮影可能な館では、該当ページを必ず撮影する（`photographed: true` とし、
  ファイル名を `photoFileName` に記録する）。写真ファイル自体は個人情報・著作権の観点から
  **リポジトリへコミットしない**。運営者のローカル・外部ストレージで別途保管する。
- 複写を申請した場合は `copied: true` とし、複写受付番号等を `copyReference` に記録する。
- 撮影不可・複写不可の館では、その場で `originalTextSummary`（内容の要約）を
  できるだけ詳しく書き取る。**原文の長大な転載はしない**（要約にとどめる。全文転記は
  著作権・保存容量の観点から避ける）。

#### 結果区分（`result`）の選び方

| 値 | 選ぶ場面 |
|---|---|
| `CONFIRMED` | 探していた事実が、そのとおり確認できた |
| `PARTIALLY_CONFIRMED` | 一部だけ確認できた（残りは別途調査が必要） |
| `CONTRADICTED` | 資料の記載が、サイトの既存データや事前の想定と違っていた |
| `NOT_FOUND` | 資料自体が見つからない、または資料はあったが該当箇所が無かった |
| `ACCESS_DENIED` | 資料はあるが、非公開・貸出禁止等の理由で見られなかった |
| `NEEDS_FOLLOWUP` | 手がかりは得たが、他館への複写取り寄せ等、追加調査が必要 |

#### UNR側の扱い（`unrResolution`）の選び方

| 値 | 選ぶ場面 |
|---|---|
| `RESOLVED` | 今回の結果でそのUNRは解消したと言える |
| `KEEP_UNR` | 解消しなかった。UNRはそのまま残す |
| `SPLIT_UNR` | UNRが複数の論点を含んでいたと分かった（分割が必要） |
| `NEW_UNR_REQUIRED` | 調査中に、別の新しい未解決事項が見つかった |

`unrResolution` を記録しても、`reports/phase33-master-unresolved-ledger.json` は
**自動更新されない**。次の「3. 帰宅後」の手順で、人が内容を確認したうえで台帳を更新する。

### 3. 帰宅後（リポジトリへの反映）

1. 記録した現地調査結果JSONを `field-research-result.schema.json` に沿って見直す
   （必須項目の抜け、日付の形式`YYYY-MM-DD`、result/unrResolution/trustLevel/datePrecisionの
   値が定義済みの語彙と一致しているか）。
2. `result` が `CONFIRMED` / `PARTIALLY_CONFIRMED` / `CONTRADICTED` の場合、確認できた事実を
   どのサイトデータ（例：`src/data/archiveMayorTerms.json`、`src/data/archiveFiscalYears.json`
   等）へどう反映するかを検討する。**現地調査結果JSON自体をそのままsrc/dataへコピーしない**
   （このフォーマットは「調査の記録」であり、サイト表示用データの形とは異なる）。
   該当するサイトデータ側のスキーマに沿って、出典（`sourceRefs`等）・`trustLevel`・
   `verificationStatus` を付けたうえで個別に反映する。
3. `unrResolution` に応じて `reports/phase33-master-unresolved-ledger.json` の該当UNRの
   `status` 等を更新する（`RESOLVED`なら解消済みへ、`SPLIT_UNR`/`NEW_UNR_REQUIRED`なら
   新規UNRの追加を検討する）。台帳の更新は人が内容を確認してから行うこと（自動反映しない）。
4. サイトデータを変更した場合は、通常の品質確認を必ず実行する。

   ```
   npm run validate:data
   npm run typecheck
   npm run lint
   npm run build
   ```

5. 現地調査結果の記録そのもの（撮影・複写を伴う一次資料の写しではなく、本フォーマットの
   JSON）を保存・共有したい場合は、正式な保存場所を運営者間で決めたうえで
   `reports/field-research/` 配下に追加する（Phase144時点では保存場所は未確定のため、
   本テンプレート配下には架空の記入例のみを置いている）。

## 現地メモ用チェック項目（印刷・携行用の簡易版）

```
[ ] researchId（例: FR-YYYYMMDD-連番）
[ ] unrId（例: UNR-014）
[ ] institution（訪問先）
[ ] checkedAt（訪問日）
[ ] checkedBy（記録者）
[ ] materialTitle（探した資料名）
[ ] author / publisher / publicationYear（分かる範囲）
[ ] callNumber / materialId（分かる範囲）
[ ] page（該当ページ）
[ ] originalTextSummary（内容の要約。長文転載はしない）
[ ] confirmedFact（確認できた事実）
[ ] datePrecision（day/month/year。確認できた日付の精度に応じて。不明なら空欄でよい）
[ ] trustLevel（PRIMARY/OFFICIAL_ARCHIVE/SECONDARY/NEWS/SOCIAL/UNVERIFIED。分かる範囲）
[ ] sourceType（資料種別。自由記述）
[ ] sourceUrl（デジタル版がある場合）
[ ] photographed（true/false）+ photoFileName
[ ] copied（true/false）+ copyReference
[ ] result（CONFIRMED/PARTIALLY_CONFIRMED/CONTRADICTED/NOT_FOUND/ACCESS_DENIED/NEEDS_FOLLOWUP）
[ ] unrResolution（RESOLVED/KEEP_UNR/SPLIT_UNR/NEW_UNR_REQUIRED）
[ ] notes（補足）
```

## 注意事項（CLAUDE.mdの編集方針を踏まえて）

- 推測・不確かな内容を `confirmedFact` へ書かない。確認できなかったことは正直に
  `NOT_FOUND` 等で記録する。
- 第三者（図書館職員・窓口担当者等）の氏名・連絡先等の個人情報は記録・コミットしない。
  `checkedBy` は記録者（サイト運営者側）のみを指す。
- `field-research-result.example.json` の内容は**すべて架空のダミーデータ**である。
  実際の調査結果として `src/data` へそのまま登録しないこと。

# Phase131: trustLevelをbillVotes.json(1,177件)へ大規模展開

## 背景と前提の訂正

ユーザー指示では「約11,774件」と案内されたが、`src/data/billVotes.json` を実際に集計したところ
**1,177件**であった（10倍の相違）。推測で件数を水増しすることはせず、実データの1,177件を対象に作業した。

Phase128（TASK-168、統合済み）で `SourceMeta`（`BillVote` が継承）へ
`trustLevel?: ArchiveSourceTrustLevel`（`src/types/sourceTrust.ts`）が追加済みだが、
billVotes.json の1,177件は件数が多いことを理由に付与が見送られていた
（`reports/phase125-129-staging/phase128-trustlevel-expansion-report.md` 7章）。
本フェーズはその残作業を、機械的なルールに基づくスクリプトで実施した。

## 1. 既存フィールドの分布調査

`src/data/billVotes.json` 全1,177件を集計した結果、出典関連フィールドは極めて均質であることが判明した。

| フィールド | 分布 |
|---|---|
| `sourceFilePath` プレフィックス | `/council-documents/…` が1,177件（100%） |
| `resultDocumentUrl` ドメイン | `www.city.nobeoka.miyazaki.jp`（延岡市公式ドメイン）が1,177件（100%）、すべて`.pdf` |
| `verificationStatus` | `verified` が1,177件（100%） |
| `publicationStatus` | `published` が1,177件（100%） |
| `extractionSource` | `automatic` 1,151件／`manual` 26件 |
| `extractionConfidence` | `0.95`:1,139件／`1`:26件／`0.4`:12件 |
| 既存の`trustLevel` | 全件未設定（`(missing)`） |

`extractionSource`・`extractionConfidence` は「自動抽出プロセスの精度・手法」を表す指標であり、
`trustLevel`（出典資料自体の種別）とは独立した軸のため、判定ルールには使用しなかった
（`src/types/sourceTrust.ts` のコメント通り、事実確認状況とtrustLevelは別軸）。

`resultDocumentUrl`・`sourceFilePath`・`verificationStatus`・`publicationStatus`の4フィールドが
1,177件全件で同一パターンだったため、結果として設計したルールは1本のみとなった
（下記「2. 判定ルール」参照）。件数の少ない `extraordinary-*` / `other-auto-*` などの
`sourceDocumentId` サフィックスの違いは、出典の性質ではなく会議区分（定例会／臨時会）や
内部管理用の連番に起因するものであり、trustLevelの判定には影響しないことをサンプル確認で個別に確認した。

## 2. 判定ルール

`scripts/assign-billvotes-trustlevel.mjs` に実装。

**ルールA（OFFICIAL_ARCHIVE付与）**：以下の4条件をすべて満たす場合のみ付与する。

1. `resultDocumentUrl` が `https://www.city.nobeoka.miyazaki.jp/` で始まり、かつ拡張子が `.pdf`
   （延岡市公式ドメインに掲載された議決結果PDF）
2. `sourceFilePath` が `/council-documents/` で始まる（当サイトがアーカイブした議会文書のローカル参照）
3. `verificationStatus === "verified"`
4. `publicationStatus === "published"`

いずれか1つでも満たさない場合はルール不一致（`UNMATCHED`）とし、`trustLevel` を付与しない
（未設定のまま残す。強制付与は行わない）。

**PRIMARYではなくOFFICIAL_ARCHIVEを選んだ理由**：実際に3件のPDF（後述「3. サンプル確認」）を取得・
テキスト抽出して内容を確認したところ、`resultDocumentUrl` は「第◯回延岡市議会（定例会／臨時会）での
議案審査等結果」という、延岡市（議会事務局）が公式サイトに掲載する議決結果一覧PDFであり、
議案書原本そのものではなく、市が公表・保管する「記録」に該当する。Phase128で `financeDashboard.json`
（財政状況資料集等、原本ではなく市公式サイト上の公表資料）を `OFFICIAL_ARCHIVE` と分類した基準を
踏襲し、`PRIMARY`（原本そのもの）とはあえて区別した。

## 3. サンプル確認

`reports/phase130-134-staging/phase131-sample-verification.md` に詳細を記録。

- dry-run結果から9カテゴリ・34件（定例会/臨時会、extractionConfidence高低、extractionSource自動/手動、
  category別、最古/最新年度、votingDate欠落の例外パターン等）を抽出し、判定に使う4フィールドを個別確認。
  全34件がルールAに一致し、誤判定は無かった。
- うち3件は実際にPDFを取得（`WebFetch`）し、`scripts/extract-pdf-text-pdfjs.mjs`でテキスト層を抽出して
  内容を確認した。3件とも「第◯回延岡市議会（定例会／臨時会）での議案審査等結果」等、実際の議決結果・
  議員別賛否を記載した延岡市議会の公式記録であることを確認した。
- ルールの修正は不要と判断し、dry-runのやり直しは行わなかった。

## 4. dry-run結果（`reports/phase130-134-staging/phase131-dryrun-summary.json`）

```
対象件数: 1177
ルール別件数: { A_OFFICIAL_ARCHIVE: 1177 }
提案trustLevel件数: { OFFICIAL_ARCHIVE: 1177 }
既存trustLevel分布（適用前）: { "(missing)": 1177 }
```

全1,177件がルールAに一致した。ルール不一致（未設定のまま残す対象）は0件だった
（前述の通り、出典関連4フィールドが全件で同一パターンだったため）。

## 5. 本適用結果

`node scripts/assign-billvotes-trustlevel.mjs --apply` を実行。

| 項目 | 件数 |
|---|---|
| `trustLevel: "OFFICIAL_ARCHIVE"` を新規付与した件数 | 1,177件（全件） |
| 既存`trustLevel`があり変更しなかった件数 | 0件 |
| ルール不一致のため未設定のまま残した件数 | 0件 |

適用後、`trustLevel`以外の既存フィールドに変更がないことをスクリプトで機械的に検証した
（`{...record}`から`trustLevel`を除いた内容が適用前と完全一致することを1,177件全件で確認、差分0件）。

未設定のまま残した件数が0件だった理由：本データセットは出典に関する4フィールド
（sourceFilePath / resultDocumentUrl / verificationStatus / publicationStatus）が
1,177件すべてで同一パターン（延岡市公式ドメインの議決結果PDF・verified・published）であり、
ルールAに例外なく一致したため。将来、異なる出典パターン（例：市議会以外が発行した文書、
未verifiedのレコード等）が追加された場合は、そのレコードのみルール不一致として
自動的に未設定のまま残る（スクリプトの動作として担保済み）。

## 6. 品質確認結果

| コマンド | 適用前（ベースライン） | 適用後 |
|---|---|---|
| `npm run validate:data` | `errors=0 warnings=40` | `errors=0 warnings=40`（完全一致、悪化なし） |
| `npm run typecheck` | - | エラーなし（`tsc -b` 正常終了） |
| `npm run lint` | - | エラーなし（`oxlint` 正常終了） |
| `npm run build` | - | 正常終了。`validate:seo`（2241ページ, failures=0 warnings=0）・`validate:content`（2241ページ, errors=0 warnings=0）も正常終了 |

## 7. 変更ファイル一覧

- `scripts/assign-billvotes-trustlevel.mjs`（新規）— dry-run/apply両対応の判定・付与スクリプト。
  再現性のため削除せずリポジトリに残す。
- `src/data/billVotes.json` — 全1,177件に `trustLevel: "OFFICIAL_ARCHIVE"` を追加。既存フィールドは無変更。
- `reports/phase130-134-staging/phase131-dryrun-summary.json`（新規）— dry-run集計結果
- `reports/phase130-134-staging/phase131-sample-verification.md`（新規）— サンプル確認記録
- `reports/phase130-134-staging/phase131-trustlevel-billvotes-report.md`（新規、本ファイル）

## 8. 残作業・次の改善提案

- `members.json`（26件）・`mayorPromises.json`の公約レコードへの`trustLevel`付与は依然未実施
  （Phase128から持ち越しの残課題）。billVotesと異なりこれらは出典が多様（議員個別サイト、
  公式SNS、市長記者会見等）なため、機械的ルールでの一括判定は難しく、個別確認が必要と考えられる。
- `compensationComparison.json`の`sourceOrganization`必須フィールドと実データのスキーマのずれは
  Phase128から未解消（本フェーズのスコープ外）。
- UI表示（trustLevelバッジ等）は本フェーズでも見送った。Phase128同様、サイト内のいずれのページも
  `trustLevel`を表示していない。表示を追加する場合は出典表示の共通コンポーネントへの影響範囲調査が必要。

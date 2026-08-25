# Phase131 サンプル確認（billVotes.json trustLevel付与）

## 確認方法

`scripts/assign-billvotes-trustlevel.mjs`（dry-run）の判定結果から、以下の観点でばらつくよう
34件（1ルールしか成立しなかったため「カテゴリ」は判定ルールではなく、レコードの性質のばらつき軸として設定）を
抽出し、各レコードの `sourceFilePath` / `resultDocumentUrl` / `verificationStatus` / `publicationStatus` を
直接確認した。加えて、うち3件（`resultDocumentUrl` が異なる年代・異なる文書の代表例）は実際にPDFを取得し
（`WebFetch` でURLを取得 → `scripts/extract-pdf-text-pdfjs.mjs` でテキスト層を抽出）、
PDFの内容が実際に議案・議決結果を記載した延岡市議会の公式記録であることを確認した。

## サンプル一覧（34件、9カテゴリ）

| カテゴリ | 件数 | 抽出条件 |
|---|---|---|
| regular-session-high-conf | 4 | 定例会・extractionConfidence=0.95 |
| regular-session-conf1.0-manual | 4 | extractionConfidence=1、extractionSource=manual |
| low-confidence-0.4 | 4 | extractionConfidence=0.4（抽出信頼度が低い最下位グループ） |
| extraordinary-results | 4 | 臨時会・sourceDocumentIdが `*-results` |
| extraordinary-other-auto | 4 | 臨時会・sourceDocumentIdが `*-other-auto-*` |
| category-jinji | 3 | category="人事" |
| category-senketsu | 3 | category="専決処分" |
| earliest-year | 3 | votingDate最古（2019年） |
| latest-year | 3 | votingDate最新（2026年） |
| missing-votingDate | 2 | votingDateが未登録（11件存在する例外パターン） |

全34件について、`resultDocumentUrl`が`https://www.city.nobeoka.miyazaki.jp/`で始まりPDF拡張子であること、
`sourceFilePath`が`/council-documents/`で始まること、`verificationStatus==="verified"`、
`publicationStatus==="published"`をすべて満たしており、いずれもルールA（OFFICIAL_ARCHIVE付与）に一致した。
誤判定・境界事例は確認されなかった。

`missing-votingDate`（votingDate未登録の2件）についても、trustLevel判定に使う4フィールド
（sourceFilePath/resultDocumentUrl/verificationStatus/publicationStatus）はいずれも登録済みであり、
votingDateの欠落はtrustLevelの判定条件に含まれないため、この2件も問題なくルールAに一致した
（votingDate欠落自体は本タスクのスコープ外の別問題であり、今回は変更していない）。

## PDF実物確認（3件）

| id | resultDocumentUrl | 確認内容 |
|---|---|---|
| 2026-06-gian-14（regular-session-high-conf） | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/27929.pdf | PDFテキスト層に「第26回延岡市議会（定例会）での議案審査等結果 令和８年７月３日現在」の見出しと議案一覧表を確認。billTitle「延岡市印鑑の登録及び証明に関する条例の一部を改正する条例の制定」・result「原案可決」・議決日「６月12日」がレコードのvotingDate「2026-06-12」と一致することを確認した。 |
| 2019-06-gian-5（regular-session-conf1.0-manual / earliest-year） | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/1597.pdf | PDFテキスト層に「第２回延岡市議会（定例会）での議案審査等結果（会期：令和元年６月17日～７月５日）」の見出しと議案一覧表を確認。延岡市議会事務局が公表する公式の議案審査等結果一覧であることを確認した。 |
| 2023-07-extraordinary-01-gian-9（low-confidence-0.4 / extraordinary-results） | https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/14688.pdf | PDFテキスト層に「議案第９号 令和５年度延岡市一般会計補正予算に対する再議」の詳細と議員27名分の賛否一覧を確認。extractionConfidenceが0.4（低め）でも、実際のPDF自体は延岡市公式ドメイン上の公式記録であり、trustLevel判定（出典の種別）には影響しないことを確認した（extractionConfidenceは自動抽出の精度指標であり、verificationStatusで別途「verified」と確認済み）。 |

## 判定結果

- 34件すべてでルールAが正しく適用されることを確認。誤判定なし。
- ルール修正の必要なし。dry-runのやり直しは不要と判断した。
- `resultDocumentUrl`は「延岡市議会○○回定例会・臨時会での議案審査等結果」という、延岡市（議会事務局）が
  公式サイトに掲載する議決結果一覧PDFであり、原案そのもの（議案書原本）ではなく、市が公表・保管する
  「記録」に該当するため、Phase128の`financeDashboard.json`（財政状況資料集等）と同じ基準に沿い
  `PRIMARY`ではなく`OFFICIAL_ARCHIVE`を採用した（`reports/phase130-134-staging/phase131-trustlevel-billvotes-report.md`に詳細）。

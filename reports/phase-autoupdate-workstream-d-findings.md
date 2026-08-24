# 自動更新パイプライン Workstream D（財政・人口Updater）実装レポート

- 作成日: 2026-08-23
- 担当: Workstream D（財政・人口）
- 状態: 実装完了、dry-run検証済み。**本番データへの書き込みは一切行っていない。**

## 1. 実装したファイル一覧

| ファイル | 役割 |
| --- | --- |
| `scripts/auto-update/population/update-population.mjs` | 人口・世帯数統計（xls）のUpdater本体 |
| `scripts/auto-update/population/state/population-state.json` | 実行間でcontentHashを保持するローカル状態（自動生成、本Updater専用） |
| `scripts/auto-update/finance/update-finance.mjs` | 財政（予算・決算・財政状況資料集・基金PDF）のUpdater本体 |
| `scripts/auto-update/finance/state/finance-state.json` | 実行間でcontentHashを保持するローカル状態（自動生成、本Updater専用） |
| `reports/phase-autoupdate-workstream-d-findings.md` | 本レポート |

`src/data/*.json`・`scripts/auto-update/core/`・`scripts/auto-update/bills/`・`.github/workflows/`・`package.json`は一切編集していない（読み取りのみ）。

## 2. 再利用した既存処理（重複実装していないことの説明）

- **HTTP取得の低レベル処理**：`scripts/lib/city-site-fetch.mjs`の`fetchCitySiteBuffer`・`sha256OfBuffer`・`sha256OfBufferForDiff`・`ALLOWED_HOSTS`をそのままimportして使用。許可ドメイン検証・429（Retry-After尊重）・403（再試行しない）・5xx（最大2回再試行）・タイムアウト・500msの同一ホスト間隔制御は、この既存モジュールのロジックをそのまま使っており、独自に書き直していない。これは`.github/workflows/civic-archive-sync.yml`・`scripts/run-archive-crawler.mjs`が財政・人口・基金の巡回で実際に使っているのと同じ低レベルヘルパーである。
- **動的に発見した個別資料の取得**：`core/fetch.mjs`の`fetchWithRetry`は、`bills/update-bills.mjs`の`probeNewDocument`と同じ設計思想で、「年度別一覧ページから動的に見つかった最新年度の個別ページ」（財政の健全化判断比率個別ページ）と「人口xlsが404だった場合のフォールバック確認先ページ」の2箇所でのみ使用した。主要な資料本体の取得（xls・年度別一覧HTML・PDF）はすべてcity-site-fetch.mjs側に一本化し、二重の取得ロジックを持たせていない。
- **xls解析**：`package.json`に既存の依存として入っている`xlsx`パッケージ（devDependencies、`scripts/lib/import-shared.mjs`の`readTable()`が使っているのと同一ライブラリ）をそのままimportして使用。独自のバイナリExcelパーサーは書いていない。
- **判定・レポート**：`core/classify.mjs`の`classifyItem`・`checkCircuitBreaker`、`core/validate.mjs`の`validateEntry`、`core/report.mjs`の`writeRunReport`・`updateStatus`・`ROOT`をそのまま使用。GREEN/YELLOW/RED判定ロジック・サーキットブレーカー・レポート形式（`src/lib/auto-update/types.ts`のAutoUpdateRunReport形）は`bills/update-bills.mjs`と同一構造。
- **監視対象URL**：新規に推測したURLは作らず、`src/data/archiveCrawlerTargets.json`に登録済みのURL（`population`＝人口xls、`fund`＝基金PDF）と、`src/data/financeDashboard.json`のsourcesに既に出典として登録済みのURL（`soshiki/18/48504.html`＝財政状況資料集）をそのまま使用した。財政の年度別一覧ページ2点（`soshiki/18/`・`soshiki/18/48507.html`）のみ、archiveCrawlerTargets.jsonの`finance`ターゲット（`soshiki/18/44461.html`）を起点に実際に公式サイトを辿って新規発見したが、いずれも延岡市公式ドメイン内の同一部署（財政課）ページである。

## 3. 実際に使用した公式URL

### 人口

| URL | 用途 |
| --- | --- |
| `https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28569.xls` | 「現住人口及び世帯数の推移」（月次、archiveCrawlerTargets.jsonのid=populationと同一） |
| `https://www.city.nobeoka.miyazaki.jp/soshiki/1/1364.html` | 上記xlsが404の場合のフォールバック確認先（archiveCrawlerTargets.jsonのpopulation.notesに記載の起点ページ） |

xlsの実データ列（人口>0の最終行から実際に読み取れることを確認済み）：平成/令和年（年始行のみ）・月日・人口・男・女・世帯数。存在しない列は取得していない。

### 財政

| URL | 用途（優先度） |
| --- | --- |
| `https://www.city.nobeoka.miyazaki.jp/soshiki/18/` | 財政課トップ。「令和N年度予算」リンクで当初予算の新年度検知（優先度1） |
| `https://www.city.nobeoka.miyazaki.jp/soshiki/18/48507.html` | 「健全化判断比率」年度別一覧。「令和N年度健全化判断比率等の公表」リンクで決算資料の新年度検知（優先度2） |
| （動的発見、現状`https://www.city.nobeoka.miyazaki.jp/soshiki/18/44461.html`） | 上記一覧の最新年度個別ページ。本文平文から実質公債費比率・将来負担比率の実数値と前年度比較値を抽出（優先度3） |
| `https://www.city.nobeoka.miyazaki.jp/soshiki/18/48504.html` | 「財政状況資料集」（xlsx）年度別一覧。新年度xlsxの存在検知のみ（優先度3補助、内容は未抽出） |
| `https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/24913.pdf` | 「本市の財政状況について」PDF（archiveCrawlerTargets.jsonのid=fundと同一）。ハッシュ変更検知のみ（内容未抽出） |

## 4. 異常値検知の閾値設計とその理由

### 人口（`update-population.mjs`）

| チェック | 条件 | 判定 | 理由 |
| --- | --- | --- | --- |
| 空値への上書き | 最新人口値が0または空 | RED | xlsは年度末までの未到来月を人口=0のプレースホルダー行にしているため、この値をそのまま採用すると実在しないデータで上書きしてしまう。実データ行（人口>0）のみを対象にしつつ、万一0が選ばれた場合の最終防波堤としてRED。 |
| 日付逆行 | 取得した最新基準日が本番データより古い | RED | 解析ミス（列位置ズレ等）の可能性が高く、既存データより後退する更新はあり得ないため。 |
| 桁数異常 | 既存値と新値の桁数差が2桁以上 | RED | 単位変更や10倍・100倍の読み取りミスを検出するための簡易チェック。 |
| 前年同月比±20%以上 | シート内の12行前（前年同月）と比較 | YELLOW | 指示通り「前年比±20%程度はYELLOWが妥当」。人口の自然減はゆるやかであり、20%は明らかに通常の年変動を超える。 |
| 前年同月比±50%以上 | 同上 | RED | 20%を大きく超える変化は自動反映せず必ず人間確認とするため、より厳格な閾値を追加。 |

実際の値（令和8年8月=107,905人、令和7年8月=109,567人）での前年同月比は−1.5%であり、上記チェックはいずれも発火せず、正しくGREEN（変更なし）と判定されることを確認した。

outcome（new/updated/unchanged）は本番データ（`src/data/archiveFiscalYears.json`、読み取り専用）の既存最新基準日・人口値と比較して決定しており、指示5「新しい期間の追加を原則とし、既存の書き換えは別扱いにする」を反映している。

### 財政（`update-finance.mjs`）

| チェック | 条件 | 判定 | 理由 |
| --- | --- | --- | --- |
| 年度リンク0件 | 期待する「令和N年度〜」パターンが1件も見つからない | RED（schema invalid） | ページ構造変化の可能性が高く、「変更なし」と誤判定するより安全側に倒す。 |
| 年度重複 | 同一の最新年度に対し異なるURLのリンクが複数存在 | RED | 同一年度の資料が複数箇所に存在する状態は想定外であり、どちらが正か人間の確認が必要。 |
| 年度の逆行 | 検出した最新年度が本番データの既知最新年度より古い | RED | 解析ミスの可能性。 |
| 比率が制度上の想定範囲外 | 実質公債費比率・将来負担比率が−10%未満または60%超 | RED | 早期健全化基準（25%・350%）を大きく下回る通常運用の中で、この範囲を外れる値は抽出ミス（単位変更等）の可能性が高いと判断。 |
| 比率の前年度比変動 | ポイント差の絶対値が10ポイント以上 | YELLOW | 実際の公式資料で将来負担比率が2.1%→15.9%（13.8ポイント増）という正当な大幅変動が実在することを確認済みのため、これを異常として自動的に弾く（RED）のではなく、人間確認を促すYELLOWとした。 |
| 比率の前年度比変動 | ポイント差の絶対値が40ポイント以上 | RED | 10〜40ポイント程度は現実に起こり得るが、40ポイントを超える変動は単位変更等の異常の可能性が高いと判断し、閾値を分離した。 |
| PDF・xlsxの変更検知 | ハッシュ変更を検知したが内容は未抽出 | 常にYELLOW | 指示3「OCRが必要な資料は検知できてもYELLOW判定にする」に準じ、xlsx・PDFは中身を開かず存在検知のみとしたため、変更を検知した時点で内容の真偽を人間が確認する必要がある。 |

年度別一覧ページ3点（当初予算・決算・財政状況資料集）は、それぞれ本番データ（`archiveFiscalYears.json`・`financeDashboard.json`、読み取り専用）に登録済みの最新年度と比較し、検出年度が上回れば`outcome="new"`（新規年度エントリの追加候補）、同年度でページ本文ハッシュのみ変化していれば`outcome="updated"`（既存年度の修正候補、必ずYELLOW以上）とすることで、指示5の原則を反映している。

## 5. 各Updaterのdry-run結果（2回連続実行）

いずれも実際に延岡市公式サイトへHTTPアクセスして取得した結果であり、`dryRun: true`のため本番データへの書き込みは行っていない。

### 人口（`update-population.mjs`）

- 1回目：`検出=1 GREEN=1 YELLOW=0 RED=0 総合判定=GREEN サーキットブレーカー=正常`
- 2回目：`検出=1 GREEN=1 YELLOW=0 RED=0 総合判定=GREEN サーキットブレーカー=正常`
- 結果は完全に同一（人口xlsの最新値=107,905人、基準日2026-08-01が本番データと一致し、両回ともoutcome="unchanged"）。重複や不整合は確認されなかった。
- 最終レポート: `reports/auto-update/run-population-2026-08-23T23-15-30-519Z.json`

### 財政（`update-finance.mjs`）

- 1回目（ローカル状態が空の初回実行）：`検出=5 GREEN=3 YELLOW=2 RED=0 総合判定=YELLOW サーキットブレーカー=正常`
  - 5資源のうち3件（予算年度一覧・決算年度一覧・財政状況資料集一覧）は本番データとの比較でoutcome="unchanged"（GREEN）。
  - 健全化判断比率個別ページは本番データ（financeDashboard.jsonの実質公債費比率8.6%・将来負担比率15.9%）と一致し"unchanged"だが、将来負担比率の前年度比変動（13.8ポイント）によりYELLOW。
  - 基金PDF（24913.pdf）はローカル状態ファイルが存在しない初回実行のため`outcome="new"`（コールドスタート、内容未抽出のためYELLOW）。
- 2回目：`検出=5 GREEN=4 YELLOW=1 RED=0 総合判定=YELLOW サーキットブレーカー=正常`
  - 1回目で状態ファイルに記録された基金PDFのハッシュと一致し、`outcome="unchanged"`（GREEN）に安定。
  - 健全化判断比率個別ページは変わらずYELLOW（同じ13.8ポイント変動を継続して検知。これは一時的な現象ではなく、当該年度のデータが本番に反映され続ける限り毎回検知される想定内の挙動）。
  - それ以外の4資源はすべて1回目と同一の`outcome="unchanged"`。
- 5資源すべてで重複検出や矛盾する判定は確認されなかった。1回目→2回目の差分（基金PDFの"new"→"unchanged"）は、ローカル状態ファイルが存在しない初回実行特有の想定内の挙動であり、バグではない（財政の年度別一覧3資源は本番データとの比較のためコールドスタートの影響を受けない設計にしている）。
- 最終レポート: `reports/auto-update/run-finance-2026-08-23T23-15-19-373Z.json`

### サーキットブレーカーの挙動確認

初回実装時、健全化判断比率個別ページの`outcome`判定を「ローカル前回ハッシュとの比較のみ」で行っていたところ、初回実行で基金PDFと合わせて2/5（40%）が"new"となり、サーキットブレーカーの閾値（新規30%超）が発動してRED相当になる事象を実際に確認した。これを受けて、健全化判断比率個別ページの`outcome`は本番データ（financeDashboard.jsonの実数値）との比較に設計変更し、初回実行でも正しく"unchanged"と判定されるよう修正した（本レポートの結果は修正後のもの）。

### 使用したhttp取得の分離

人口Updaterと財政Updaterは同一ホスト（www.city.nobeoka.miyazaki.jp）へアクセスするため、テスト時は同時実行せず、財政→人口→財政→人口の順に間隔を空けて逐次実行した。city-site-fetch.mjs自体もプロセス内で500ms間隔のスロットルを持つため、各Updater単体の実行内では過度な連続アクセスは発生しない。

## 6. 未実装・今後の課題

- **全財政指標を今回は狙わなかった理由**：財政指標（歳入・歳出内訳、扶助費等の性質別内訳、実質赤字比率等）の多くはPDF（予算書・決算書・財政事情資料）としてのみ公開されており、city-site-fetch.mjsでの到達確認（ハッシュ変更検知）はできても、数値そのものの自動抽出には表構造の解析が必要で、誤読リスクが高い。今回は指示に従い「HTMLページのハッシュ・リンクテキスト比較だけで新年度資料の存在を検知できるもの」に絞り、実際に平文で数値が確認できた健全化判断比率（実質公債費比率・将来負担比率）のみ数値抽出まで実装した。
- **市債残高そのものは未実装**：`src/data/archiveCrawlerTargets.json`のid="debt"はurl=nullで確認できる公式資料が未特定であり（当該JSONのnotesに明記）、推測でURLを設定することはしなかった。基金残高もPDF内容の未抽出のため、変更検知（YELLOW）にとどまる。
- **PDF本体のテキスト抽出は未実装**：`pdfjs-dist`が既存依存として利用可能なため、次段階として非スキャンPDF（当初予算編成方針PDF等）のテキストレイヤー有無を確認し、テキスト層があれば数値抽出を試みる余地がある。ただし画像スキャンPDF（OCR要）は引き続きYELLOW方針を維持すべき。
- **xlsx（財政状況資料集）の内容抽出は未実装**：存在検知のみ。将来的にxlsxを開いて市債・基金の年度末残高等を構造化抽出することは技術的に可能（`xlsx`パッケージは既に利用中）だが、列構成の年度間差異を精査する追加調査が必要なため今回は見送った。
- **クロスプロセスでのホスト負荷制御**：`city-site-fetch.mjs`のスロットルはNodeプロセス単位（モジュール状態）であり、finance/population Updaterを完全に同時実行した場合はプロセスをまたいだ協調制御がない。実運用では両Updaterを同一ワークフロー内で逐次実行する設計（既存の`.github/workflows/civic-archive-sync.yml`と同様の直列実行）にすることを推奨する。
- **統合（integration）層との接続は対象外**：本Workstreamでは`scripts/auto-update/integration/`・`.github/workflows/`・`package.json`は一切変更していない。他Workstreamでの統合作業時に、`node scripts/auto-update/finance/update-finance.mjs`・`node scripts/auto-update/population/update-population.mjs`をそのまま呼び出し可能な設計にしてある（bills/questionsと同じ呼び出し規約）。

# Phase51 調査報告：請願・陳情・委員会バックフィル

- 調査日：2026-08-22
- 対象：`billVotes.json` の請願・陳情レコードのうち `archiveCouncilDocuments.json` に未詳細アーカイブ化の26件、および委員会「6件100%」母数問題のschema分離案
- 方針：本レポートおよび `reports/phase51-petitions-committees-findings.json`（マージ候補）の作成のみ。`archiveCouncilDocuments.json` 本体・その他ソースコードは一切編集していない。コミット・プッシュも行っていない。

## 1. 未着手26件のリストと、その突合結果

### 1.1 抽出方法

`src/data/billVotes.json`（全1177件）から `category === "請願"`（14件）・`category === "陳情"`（19件）を抽出し、`src/data/archiveCouncilDocuments.json` の既存7件（`existingBillVoteId` フィールド）と突合した。

- 既存アーカイブ済み（Phase41時点）：請願3件・陳情4件＝計7件
  - `doc-petition-01`→`2023-06-seigan-1`／`doc-petition-02`→`2024-09-seigan-2`／`doc-petition-03`→`2026-03-seigan-3`
  - `doc-request-01`→`2023-07-extraordinary-03-chinjo-1`／`doc-request-02`→`2023-12-chinjo-3`／`doc-request-03`→`2024-06-chinjo-5`／`doc-request-04`→`2025-03-chinjo-6`
- 未着手（今回の対象）：請願11件・陳情15件＝計26件（billVotes.jsonの33件から既存7件を除いた残り、件数は事前情報と一致）

### 1.2 未着手26件の一覧（billVotes.json側ID・件名・結果）

**請願（11件）**

| billVotes ID | 件名 | セッション | 結果 |
|---|---|---|---|
| 2022-09-seigan-7 | 「水田活用の直接支払交付金」の見直し中止・農家経営支援強化を求める請願 | 令和4年9月定例会 | 採択 |
| 2022-06-seigan-6 | 「エンクロス」管理運営継続を求める請願書 | 令和4年6月定例会 | 採択 |
| 2022-06-seigan-7 | 「水田活用の直接支払交付金」の見直し中止・農家経営支援強化を求める請願（継続審査段階） | 令和4年6月定例会 | 継続審査 |
| 2020-06-seigan-2 | 介護保険制度の改善を求める意見書提出に関する請願 | 令和2年6月定例会 | 撤回 |
| 2020-06-seigan-5 | 「使おやっ！のべおかプレミアム商品券」発行についての請願書 | 令和2年6月定例会 | 採択 |
| 2019-09-seigan-1 | 国民健康保険料（税）引き下げを求める請願 | 令和元年9月定例会 | 不採択 |
| 2019-12-seigan-2 | 介護保険制度の改善を求める意見書提出に関する請願（継続審査段階） | 令和元年12月定例会 | 継続審査 |
| 2019-12-seigan-3 | 議会活動のインターネット動画配信を求める陳情（※billTitleに「陳情」表記、category=請願） | 令和元年12月定例会 | 継続審査 |
| 2020-03-seigan-2 | 介護保険制度の改善を求める意見書提出に関する請願（継続審査段階） | 令和2年3月定例会 | 継続審査 |
| 2020-03-seigan-3 | 野口遵記念館建設の地元業者への発注に関する請願 | 令和2年3月定例会 | 採択 |
| 2020-03-seigan-4 | 加齢性難聴者の補聴器購入公的補助制度創設に関する意見書提出を求める請願 | 令和2年3月定例会 | 不採択 |

**陳情（15件）**

| billVotes ID | 件名 | セッション | 結果 |
|---|---|---|---|
| 2026-06-chinjo-7 | 延岡市議会議員定数削減に関する陳情 | 令和8年6月定例会 | 継続審査 |
| 2023-07-extraordinary-03-chinjo-2 | デジタル田園都市国家構想交付金関連事業予算の早期可決についての陳情 | 令和5年7月臨時会（3） | 採択 |
| 2024-03-chinjo-4 | 再審法改正意見書提出を求める陳情 | 令和6年3月定例会 | 不採択 |
| 2025-06-chinjo-6 | 津波避難困難地区の解消（継続審査段階） | 令和7年6月定例会 | 継続審査 |
| 2025-09-chinjo-6 | 津波避難困難地区の解消（撤回段階） | 令和7年9月定例会 | 撤回 |
| 2022-12-chinjo-9 | 舞野ＩＣのフルインター化整備を求める陳情 | 令和4年12月定例会 | 採択 |
| 2020-12-chinjo-7 | 「愛宕山公園」改称を求める陳情 | 令和2年12月定例会 | 採択 |
| 2020-12-chinjo-8 | 緊急雇用者の契約期限延長条件緩和を求める陳情 | 令和2年12月定例会 | 不採択 |
| 2020-09-chinjo-5 | 地方たばこ税を活用した分煙環境整備に関する陳情書 | 令和2年9月定例会 | 採択 |
| 2020-09-chinjo-6 | 長浜・方財海岸の侵食対策について | 令和2年9月定例会 | 採択 |
| 2020-06-chinjo-4 | 長浜・方財海岸の浸食対策について（継続審査段階） | 令和2年6月定例会 | 継続審査 |
| 2020-03-chinjo-3 | 議会活動のインターネット動画配信を求める陳情 | 令和2年3月定例会 | 採択 |
| 2020-03-chinjo-4 | 長浜・方財海岸の浸食対策について（継続審査段階） | 令和2年3月定例会 | 継続審査 |
| 2019-06-chinjo-1 | 五ヶ瀬川・大瀬川分派事業計画の即時中止を求める陳情 | 令和元年6月定例会 | 不採択 |
| 2019-06-chinjo-2 | 奥山等の人工林皆伐・強間伐を求める陳情 | 令和元年6月定例会 | 不採択 |

### 1.3 詳細化できた件数

**26件全件**を今回詳細化した（`reports/phase51-petitions-committees-findings.json` に候補レコードとして保存）。

想定より多く進んだ理由：この26件はいずれも「新たな外部資料調査」を要するものではなく、`billVotes.json` 自体にすでに件名・セッションID・議決日・結果・付託委員会・出典PDF（`resultDocumentUrl`）・検証状況（`verificationStatus: "verified"`）が確認済みとして格納されていた（既存7件のアーカイブ化パターンと同一の「billVotes.jsonの該当レコードをアーカイブ層へインデックスする」作業）。そのため、外部資料への新規アクセスなしに、既存の確認済みデータの範囲内で全26件を機械的に変換できた。

**変換時に採用したマッピングルール**

- `documentType`：category「請願」→`petition`、category「陳情」→`request`
- `status`/`result`：billVotes.jsonの日本語`result`値を型定義（`ArchiveCouncilDocumentStatus`/`ArchivePetitionOutcome`）の英語区分へマッピング
  - 採択→`status: "decided"`, `result: "adopted"`
  - 不採択→`status: "decided"`, `result: "rejected"`
  - 継続審査→`status: "continuedReview"`, `result: "continuedReview"`
  - 撤回→`status: "withdrawn"`, `result: "withdrawn"`
  - （26件の中に「一部採択」「審議未了」等の他区分は存在しなかった）
- `fiscalYear`：billVotes.jsonの和暦文字列（例：「令和4年度」）を西暦数値に変換（令和N年度→N+2018年）。既存7件のfiscalYear値と変換式の整合性を検証済み（例：doc-petition-03のfiscalYear=2025は「令和7年度」の変換と一致）。
- `sourceRefs`：billVotes.jsonの`resultDocumentUrl`を`sourceUrl`に、`「請願／陳情審議結果（セッション名）」`を`sourceTitle`にして1件ずつ構成（既存7件と同一パターン）。`accessedAt`は本調査日（2026-08-22）。
- `existingBillVoteId`：billVotes.json側のIDをそのまま設定（既存パターンを踏襲し、議員別賛否・出典PDF詳細は重複登録しない）。
- `petitionDetail`/`requestDetail`：既存7件と同様、`{}`（空オブジェクト）のまま。付託委員会（billVotes.jsonの`committee`フィールドで既に確認可能）を`committeeReferral`として重複登録しなかった（既存7件も同様の方針だったため踏襲）。請願者・陳情者の氏名等個人情報は出典PDF・既存データのいずれにも記載がないため未登録。
- `relatedMayorIds`：`decisionDate`（未設定の場合は`sessionId`）と、`archiveMayors.json`で確認済みの市長在任期間（mayor-03：2018-02-06〜2025-06-30、mayor-01：2025-07-20〜現在）を突合して設定。26件はすべてこの2市長の在任期間内に収まり、曖昧なケースはなかった。

### 1.4 データ品質上の観察事項（新規登録はしていない、記録のみ）

- **請願と陳情の表記混在**：`2019-12-seigan-3`（category=請願）のbillTitleは「議会活動のインターネット動画配信を求める陳情」であり、`2020-03-chinjo-3`（category=陳情）にも同一件名が存在する。Phase41時点の`doc-petition-01`など既存データのverificationNoteにも同種の「会議録上は陳情第◯号として付託されているが同一案件と判断した」という記述があり、これは延岡市議会の会議録原本自体の表記揺れであって、本サイト側の入力誤りではない。billVotes.json側のcategory区分をそのまま踏襲し、本タスクでは分類を変更・統合していない。
- **同一案件の複数セッションにまたがる継続審査チェーン**：以下は同一の請願・陳情が複数定例会にわたって「継続審査→（採択／不採択／撤回）」と推移した案件で、billVotes.json側にそれぞれ独立したレコードとして存在するため、本タスクでもそれぞれ独立したアーカイブ候補として作成した（Phase41の`doc-request-04`のnotesにあった「初期データでは重複を避けるため最初の登録分のみをアーカイブ対象とした」という制約は、今回のバックフィルタスクの趣旨（未着手26件を詳細化する）に従い、継続分も含めて全件アーカイブ候補化する方針に変更した）。
  - 介護保険制度改善の意見書提出請願：`2020-06-seigan-2`（撤回）／`2019-12-seigan-2`（継続審査）／`2020-03-seigan-2`（継続審査）
  - 水田活用の直接支払交付金見直し請願：`2022-06-seigan-7`（継続審査）／`2022-09-seigan-7`（採択）
  - 津波避難困難地区の陳情：`2025-06-chinjo-6`（継続審査）／`2025-09-chinjo-6`（撤回）（既存`doc-request-04`が最初の段階`2025-03-chinjo-6`を保持済み）
  - 長浜・方財海岸浸食（侵食）対策の陳情：`2020-03-chinjo-4`（継続審査）／`2020-06-chinjo-4`（継続審査）／`2020-09-chinjo-6`（採択）
- これらは重複登録ではなく、billVotes.json側に既に別々のレコードとして存在する審査経過をそのまま反映したものである。

## 2. 議案データとの重複チェック結果

- 生成した26件の`id`・`slug`・`existingBillVoteId`は、いずれも既存`archiveCouncilDocuments.json`の7件（および他の`bill`/`ordinance`ドキュメント6件、計13件）と重複しないことをスクリプトで検証した（`id`重複0件、`slug`重複0件、`existingBillVoteId`重複0件）。
- 26件すべての`existingBillVoteId`が`src/data/billVotes.json`内に実在することを検証した（未解決参照0件）。
- `billVotes.json`側は本タスクで一切変更していない（読み取りのみ）。議員別賛否・出典PDF・議決結果等はすべて`existingBillVoteId`経由で参照する設計を踏襲し、このJSONに複製データを持たせていない。

## 3. 委員会「6件100%」母数問題：schema分離案（記録のみ、実装はしていない）

Phase41で指摘済みの問題（`src/pages/DataStatusPage.tsx`の「委員会：所管事項の確認」note文言と`committeesWithJurisdiction`集計ロジックの不整合）に加え、本タスクの依頼にある「歴史的委員会データを追加する場合」のschema分離案を検討した。

**現状の制約**：`src/data/committees.json`は「現行の委員名簿（令和8年5月8日現在）」1時点のみを保持するフラットな配列であり、`CommitteesPage.tsx`・`DataStatusPage.tsx`の集計はすべて`committees.length`（=6）を母数とする。過去の委員構成（歴代委員会名簿）を追加する場合、単純に同じ配列へレコードを追加すると「6件100%」の母数自体が変動し、かつ「現行の委員名簿」という`scope`の意味が壊れる。

**分離案（提案のみ）**

1. **別ファイル方式**：`src/data/committees.json`（現行委員名簿、現状維持）とは別に`src/data/committeesHistorical.json`（過去の任期の委員構成、会期・任期単位でレコード化）を新設する。`DataStatusPage.tsx`の母数計算は現行`committees.json`のみを対象とし続け、歴代データはCommitteesPageまたは専用の沿革ページ（例：`/committees/history`）で別集計・別バッジとして表示する。既存の「6件100%」の意味（現行委員名簿の所管確認状況）を変更せずに済む。
2. **型面の分離**：`committees.json`のレコード型に`termLabel`（例："令和6年5月〜令和8年5月"）と`isCurrent: boolean`のような時点情報を持たせる案もあるが、既存の6件（`isCurrent: true`相当）と歴代データが同一配列に混在すると、既存コードの`committees.length`・`committees.filter(...)`を参照する全箇所（`DataStatusPage.tsx`のL405-415・L543-547、`CommitteesPage.tsx`等）を「現行のみ」条件でフィルタするよう横断的に修正する必要があり、影響範囲が広い。上記1の別ファイル方式の方が既存コードへの影響が小さく、安全度が高い。
3. どちらの案でも、`committeesWithJurisdiction`の定義（Phase41で指摘した「jurisdiction非nullの二値判定」と「本当に条例上の個別列挙があるか」の区別）は別途是正が必要（Phase41 1.3節の指摘は本タスクでも未解決のまま）。

**結論**：実装は行っていない。歴代委員会データの追加が具体的に発生した際は、上記1（別ファイル方式）を推奨する。

## 4. 終了時報告

- **請願新規件数（詳細アーカイブ候補）**：11件（`doc-petition-04`〜`doc-petition-14`）
- **陳情新規件数（詳細アーカイブ候補）**：15件（`doc-request-05`〜`doc-request-19`）
- **委員会新規件数**：0件（新規データ登録なし。schema分離案の記録のみ、本レポート3節）
- **sourceRefs追加件数**：26件（新規候補レコード1件につき1件ずつ、すべて`extractionMethod: "pdf-extraction"`・`verificationStatus: "verified"`）
- **Warnings**：
  - 本タスクで作成した26件は**候補レコード**であり、`reports/phase51-petitions-committees-findings.json`に保存したのみで、`src/data/archiveCouncilDocuments.json`本体へはマージしていない（本タスクの制約により reports/ 配下以外のファイルは編集していないため）。マージする場合は、次の担当者が本JSONの配列をそのまま`archiveCouncilDocuments.json`の既存配列へ追記できる形式にしてある。
  - `2019-12-seigan-3`と`2020-03-chinjo-3`のcategory表記混在（1.4節参照）はbillVotes.json側の既存データそのままであり、本タスクでは訂正していない。分類の要否は次の担当者の判断に委ねる。
  - `E:\nobeoka-gikai\.claude\settings.local.json`が作業開始時点でuncommitted状態（`git status`の`M`）だったが、本タスクの制約（reports配下のみ編集可）に従い、このファイルには一切触れていない。
  - 本タスクではファイル作成は`reports/phase51-petitions-committees-findings.md`・`reports/phase51-petitions-committees-findings.json`のみ。`archiveCouncilDocuments.json`・その他ソースコードの編集、`git commit`／`git push`は一切行っていない。

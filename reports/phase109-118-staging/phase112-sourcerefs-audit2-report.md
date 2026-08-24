# Phase112: sourceRefs再監査（5分類）報告

作成日: 2026-08-24
担当: Phase112（読み取り専用・レポート専用worker）

## 1. 前提の確認

作業開始前に以下を読んだ。

- `reports/phase99-108-staging/phase107-sourcerefs-report.md`・`phase107-sourcerefs-findings.json`：Phase107で123件（`archiveMemberProfiles.json` 48件・`electionResults.json` 20件・`archiveMemberAffiliations.json` 55件）をneedsReview→verifiedへ格上げ済み。`archiveMemberAffiliations.json`の残り19件（ひらがな表記のみで確証が得られなかったもの）は据え置き。
- `reports/phase79-source-coverage-findings.json`：2026-08-23生成。Phase107の更新を反映していない古い値であることを確認した（例: `archiveMemberProfiles.json`のpartiallyDocumentedCount=48はPhase107前の値）。
- `scripts/qa-checks/check-source-refs-coverage.mjs`：Phase79と同種の「レコード単位でsourceRefs系フィールドの有無を機械集計する」既存スクリプトを確認した。ただし二値判定（出典の有無）に留まり、今回要求された5分類・出典階層判定はカバーしていないため、そのロジック（`src/data`を直接読み込み、レコード単位でsourceRefs/sourceRef/sourceNote/sourceUrl等を機械走査する手法）を踏襲した新規スクリプトを作成し、**現在のデータから実際に再計算した**（Phase79の古い数字はそのまま使っていない）。

## 2. 監査方法

`C:\Users\ym198\...\scratchpad\phase112-audit.mjs`（本フェーズ用に新規作成、読み取り専用）で対象8ファイルを機械走査した。要旨：

1. 各ファイルのスキーマ差異（`sourceRefs`配列／`sourceRef`単数／`sourceNote`自由記述／トップレベル`sourceUrl`）に対応するアダプタを個別実装し、レコードごとに出典refの一覧を正規化した。
2. 出典階層（tier）はURLドメイン・発行組織名から判定した。
   - **primary（一次資料）**：`city.nobeoka.miyazaki.jp`、`kensakusystem.jp`（延岡市議会会議録検索システム＝議会公式の議事録原本）、`pref.miyazaki.lg.jp`、`soumu.go.jp`
   - **public_secondary（公的二次資料）**：`dl.ndl.go.jp`（国立国会図書館デジタルコレクション、市発行の市史等をデジタル化したもの）
   - **reliable_secondary（信頼できる二次資料）**：`go2senkyo.com`（選挙ドットコム）、`ja.wikipedia.org`、`web.archive.org`（新聞報道の保存版）
   - **self_primary**：候補者・首長本人／後援会の公式サイト
3. 5分類の判定基準（本フェーズで新規定義）：
   - **fully_documented**：主要事実の複数フィールド（またはトピック）を出典がカバーし、かつ検証状態（`verificationStatus`）がある設計のファイルでは全refが`verified`。**「refが1件のみ」は原則ここに該当しない**（タスク指示どおり）。
   - **partially_documented**：出典はあるが上記基準に届かない（refが1件のみ／`verified`と`needsReview`等が混在／`sourceNote`が単一トピックのみ等）。
   - **reference_pending**：照会送付済み・回答待ちを示す記述がある。
   - **source_not_located**：出典系フィールドが一切存在しない。
   - **library_required**：全refがPDF/xlsx添付、または書籍名のみでURL・デジタル一次資料が無く、この環境では内容照合できない（図書館等での現物確認が必要）もの。
4. `formerMembers.json`（`sourceNote`自由記述型）は、キーワードを単純にカウントすると「当選」と「得票」のように同一事実（選挙結果）を指す語を二重カウントしてしまう問題があったため、**トピック単位（election/activity/role/affiliation/vote）でグルーピングして判定するよう補正した**（詳細は4節）。
5. `verificationStatus`の値は`verified`/`needsReview`以外に`archiveMayorTerms.json`で`partiallyVerified`・`sourceUnavailable`が使われていることを確認し、`verified`以外は一律「未完全検証」として扱った（値の種類を決め打ちしない設計）。

出力: `reports/phase109-118-staging/phase112-sourcerefs-audit2-findings.json`（各ファイルの件数・出典階層集計・カテゴリごとの具体例を格納）。

## 3. 集計結果（現在のデータから再計算）

| ファイル | 総件数 | fully_documented | partially_documented | reference_pending | source_not_located | library_required |
|---|---:|---:|---:|---:|---:|---:|
| `archiveMemberProfiles.json` | 84 | 6 | 78 | 0 | 0 | 0 |
| `electionResults.json` | 39 | 0 | 39 | 0 | 0 | 0 |
| `archiveMemberAffiliations.json` | 74 | 0 | 74 | 0 | 0 | 0 |
| `formerMembers.json` | 58 | 15 | 43 | 0 | 0 | 0 |
| `citySpecialPosts.json` | 57 | 33 | 24 | 0 | 0 | 0 |
| `archiveMayorTerms.json` | 30 | 9 | 21 | 0 | 0 | 0 |
| `generalQuestions.json` | 15 | 14 | 1 | 0 | 0 | 0 |
| `billVotes.json` | 1177 | 1177 | 0 | 0 | 0 | 0 |

`reference_pending`・`source_not_located`・`library_required`はいずれの対象ファイルも0件だった（理由は各節を参照）。

## 4. ファイルごとの詳細

### 4.1 `archiveMemberProfiles.json`（84件、fully=6／partial=78）

Phase107で全84件のsourceRefsを`verified`に格上げ済みだが、**内訳を見るとrefCount=1（sourceRefsが1本のみ）のレコードが74件を占める**。これらは1999〜2011年の選挙結果ページ（go2senkyo.com）1本のみで「当選の事実」だけを確認したもので、`verified`ではあるが「経歴・複数任期・在職活動」等の他の主要事実の直接出典を欠く。タスクの定義（「URLが1本あるだけ」は非該当）に照らし、本監査では`partially_documented`とした。

- fully_documented例：`archive-fm01`（吉本靖、4件のsourceRefsが全件verified、会議録・選挙結果・市議会だよりを個別事実ごとに保有）
- partially_documented低品質例：
  - `archive-fm11`（佐藤正人）：sourceRefsは1件のみ（go2senkyo.com、1999年選挙結果）。`notes`本文には2003年の再選も記載されているが、対応するsourceRefは無い。
  - `archive-fm03`（松田和己）：4件中1件が`needsReview`のまま残存。

出典階層：primary 59件・reliable_secondary 58件（1レコードに複数tierのrefが付く場合あり）。

### 4.2 `electionResults.json`（39件、fully=0／partial=39）

Phase107で全39件のsourceRefsが`verified`となったが、**「候補者の得票数(votes)がnullのまま」の主要フィールド欠落が22/39件に残る**（1970年代以前の市長選中心）。本監査では「refs全件verifiedでも、候補者データの主要事実(votes)が未確認のまま残る場合はfully_documentedとしない」という厳格な基準を適用したため、fully_documented=0という結果になった。これはPhase107以前からの構造的な既知ギャップ（得票数resource自体が現存しない/未発見）であり、本監査で新たに悪化したものではない。

- 低品質例：`election-mayor-1971`（房野博 vs 山口哲臣、投票率57.12%まで判明も得票数は両候補ともnull）
- refs1件のみの例：`election-mayor-1986`・`1990`・`1994`・`1998`（延岡市公式「近代の年表」ページ1本のみ）

出典階層：primary 16件・public_secondary 17件（延岡市史のNDLデジタル化コマ）・reliable_secondary 16件。

### 4.3 `archiveMemberAffiliations.json`（74件、fully=0／partial=74）

全74件が`sourceRef`（単数形）1本のみで構成される設計であるため、タスク定義上すべて`partially_documented`となる。Phase107で55件はverifiedへ格上げ済みだが、単数refという設計自体は変わっていない。

- committee系5件：`kensakusystem.jp`（primary）、うち一部`needsReview`（例：`archive-fm01-aff-01`）
- party系69件：`go2senkyo.com`（reliable_secondary）、うち55件verified・14件needsReview（ひらがな表記のみで確証不足、Phase107で見送り）

### 4.4 `formerMembers.json`（58件、fully=15／partial=43）

型定義上`sourceNote`は自由記述の1フィールドであり構造化`sourceRefs`を持たない（Phase79・Phase107いずれも把握済みの既知の設計制約）。本監査では構造の有無ではなく**内容がカバーするトピック数**で判定した。ただし単純なキーワード数え上げでは「当選」「得票」のように同一事実を指す語を二重カウントしてしまうため、election/activity/role/affiliation/voteの5トピックへグルーピングして判定するよう補正した（補正前は58件中43件が誤ってfully相当になっていた）。

- fully_documented例：`fm01`（吉本靖）：election・activity・role・voteの4トピックを具体的な資料名・日付付きで記述
- partially_documented例（低品質）：`fm12`〜`fm21`等43件：`sourceNote`が「選挙結果1件をgo2senkyo.com経由でelectionResults.json参照」というelectionトピック1つのみで完結しており、経歴・在職活動等の他の事実は`note`（自由記述の本文）には書かれていても`sourceNote`（出典citation）としては明記されていない。

**構造的な改善提案**（編集は行っていない）：`FormerMember`型（`src/types/index.ts`）に構造化`sourceRefs`配列を追加する設計変更を次フェーズで検討する余地がある。Phase107も同様の指摘をしている。

### 4.5 `citySpecialPosts.json`（57件、fully=33／partial=24）

`verificationStatus`フィールドを持たない設計（label/url形式）。refCount>=2（32件）+refCount=3（1件）=33件をfully、refCount=1（24件）をpartialとした。partialの大半は選挙管理委員・補充員（`csp-27`〜`csp-33`等）で、いずれも議案審議結果PDF1本のみに依拠する。

出典階層：primary 78件・public_secondary 13件。

### 4.6 `archiveMayorTerms.json`（30件、fully=9／partial=21）

`verificationStatus`は`verified`/`needsReview`に加え`partiallyVerified`・`sourceUnavailable`の4値が使われている。`verified`以外を一律「未完全検証」として扱った結果、fully=9（全refがverified）・partial=21（未完全検証refが1件でも混在）となった。

- partially_documented例：`mayor-02-term-01`〜`03`（首藤正治）：Wikipedia由来のrefが`partiallyVerified`のまま。`mayor-04-term-01`：`sourceUnavailable`（資料に到達できない旨を明示）。

出典階層：primary 39件・reliable_secondary 28件（Wikipedia 16件＋go2senkyo.com等）・public_secondary 7件・self_primary 1件（候補者本人サイト）。

### 4.7 `generalQuestions.json`（15件、fully=14／partial=1）

sourceUrl（質問通告書PDF）に加え、newsletterUrl（のべおか市議会だよりでの実施内容クロス確認）を持つ14件をfully、`newsletterConfirmed=false`の1件（`gq2019-06-m01`）のみpartialとした。Phase79の結果と一致。

### 4.8 `billVotes.json`（1177件、fully=1177／partial=0）

「議案の結果」（billTitle/votingDate/result）は全件が延岡市公式PDF（`resultDocumentUrl`）1本から機械抽出＋`verificationStatus=verified`・`publicationStatus=published`で統一されており、このファイルの設計上（1本のURLで議案結果という単一の主要事実を確定できる公式資料）は本監査でもfully_documentedとした。

ただし**別軸の指標**として、「議員ごとの個別賛否」（`memberVotes`）は`individualVoteDisclosureStatus`が`disclosed`=2件・`unconfirmed`=654件・`notDisclosed`=521件であり、依然として大半が未確認/非公開である（Phase79の値と完全一致、変化なし）。これは「議案の結果」の出典網羅性とは別問題であり、本監査の5分類には含めていない（サイト側でも既に`individualVoteDisclosureStatus`として明示済み、0件として隠していない）。

## 5. reference_pending / source_not_located / library_required が0件だった理由

- **reference_pending**：`照会送付済み|回答待ち|問い合わせ中|reference[-_ ]?pending`等のキーワードで対象8ファイルを機械走査したが該当なし。過去フェーズの「照会」関連レポート（`phase19-library-inquiry.md`・`phase21-inquiry-tracker.json`等）は、いずれも`archiveFiscalYears.json`（財政の歴史データ）や1926年以前の市長など、本フェーズの対象8ファイル外の領域だった。
- **source_not_located**：全8ファイルとも`withSourceField`（出典系フィールドを持つレコード）が100%であることをPhase79時点から確認済みで、本監査でも変化なし。
- **library_required**：本監査では「全refがPDF/xlsx添付、またはURLの無い書籍名のみで、一次デジタル資料に到達できない」ものを対象と定義したが、対象8ファイルのPDF由来ref（`citySpecialPosts.json`・`billVotes.json`等）はいずれも`city.nobeoka.miyazaki.jp`ドメイン上の公式PDFであり、ドメイン自体はprimary（一次資料）に該当するため対象外とした。この環境のWebFetchがPDF/xlsxのバイナリを解析できないという制約（Phase79/Phase107で既出）は「資料の所在が図書館等に限られる」こととは別問題（資料はオンラインに存在するが、このツールで内容を読めないだけ）と整理し、library_requiredには含めなかった。真に物理資料（図書館所蔵の市史原本・マイクロフィルム等）への依存が疑われるのは`archiveFiscalYears.json`など対象8ファイル外であり、Phase107の`attemptedButNotReinforceable`に既出。

## 6. Phase79との差異の要約

Phase79はverified/needsReviewの二値（レコード単位で「needsReviewのみのref集合を持つか」）で判定していたが、本フェーズはタスク指示に基づき「主要事実の複数フィールドを出典がカバーしているか」という**breadth（網羅性）**を独立した判定軸として追加した。この結果、Phase107でPhase79基準の「fully」が大幅に改善したはずの`archiveMemberProfiles.json`・`electionResults.json`が、breadth基準では引き続き低い値（各6件・0件）となった。これは**verified化が進んだこと自体は事実だが、「1件のURLで1つの事実だけを確認した」状態が大半を占めるという別の課題が残っていることを可視化する結果**であり、Phase107の作業を否定するものではない。

## 7. 品質確認

本フェーズはレポート専用（読み取り専用）のため、`src/data`配下の変更は無い。`npm run validate:data`等の実行は不要と判断し、実施していない（データを変更していないため）。

## 8. 出力ファイル

- `reports/phase109-118-staging/phase112-sourcerefs-audit2-findings.json`
- `reports/phase109-118-staging/phase112-sourcerefs-audit2-report.md`（本ファイル）

git commit・push は指示どおり行っていない。src/data配下は一切編集していない。

# Phase79 出典網羅率完全監査レポート

作成日: 2026-08-23
対象: `src/data` 配下の主要データカテゴリ（財政＞選挙＞市長・議員プロフィール＞一般質問＞市政年表＞議案＞委員会＞特別職の優先順）

## 監査方法

- 各カテゴリについて対応する実データファイルをGlob/Readで実際に確認し、ファイル名・フィールド名を推測せず特定した。
- Node.jsスクリプトで全レコードを走査し、`sourceRefs` / `sourceUrl` / `sourceRef` / `sources` 等の出典系フィールドの有無・件数・URLドメイン（一次/二次/不明の判定）・`verificationStatus`等のステータス値を機械集計した。
- 財政の主要数値（`archiveFiscalYears.json`）・選挙の当落結果（`electionResults.json`）・市長/議員の任期（`archiveMayorTerms.json` / `archiveMemberTerms.json`）の4ファイルは、それぞれ5件以上を無作為抽出し、`sourceRefs`内の`sourceTitle`・`sourceUrl`・`sourceOrganization`・`notes`の記述内容がレコード本体の数値・日付・氏名と矛盾しないかを目視で確認した。それ以外のカテゴリも1〜5件程度のサンプル確認を行った。
- WebFetchによる実URL到達確認も試行した。HTML系ページ（延岡市議会公式プロフィールページ `gikai/1442.html`）は1件、実際に取得しページ内の氏名「前田 遼」を直接確認できた。一方、PDF系URL（延岡市公式PDF等）はこの実行環境にPDFレンダラー（pdftoppm）が無いためバイナリを解析できず、`kensakusystem.jp`（延岡市議会会議録検索システム）はセッション依存のCGI URLのため外部から再現アクセスできなかった。これらは「記載されているタイトル・日付・組織名・氏名等がレコードの値と整合しているか」で判定し、`sourceLooksConsistent: "unable_to_verify"`または整合性チェックの結果として明記した。

## 監査したカテゴリ数について

指示書は「29項目」という目安を示していたが、財政・選挙・市長議員プロフィール・一般質問・市政年表・議案・委員会・特別職という8分野に対応する実データファイルを`src/data`配下で実際に洗い出した結果、**32ファイル（32カテゴリ）**が該当した。29という数字に合わせるための水増しや削減は行わず、実在するファイル単位でそのまま32件を監査・報告する。

---

## 1. 財政（12カテゴリ）

### 1-1. archiveFiscalYears.json（歴史的年度別財政データ）
- 70年度分（1933〜2026年度）。全70件が`sourceRefs`を保有（budget/population/debtの階層ごとに個別付与）。
- 出典参照は延べ247件。一次資料211件（延岡市公式・総務省e-Stat・宮崎県）、二次資料36件（NDLデジコレ35件・Wayback 1件）、不明0件。NDL pid/コマ番号を含む参照35件。
- `verificationStatus`: verified 48件・needsReview 199件。レコード単位では44件が「全refがneedsReview以外」＝出典として十分、26件は全refがneedsReview相当にとどまる。
- 深堀確認5件+1件（合計6件）: すべて数値・年度・出典タイトルが一致。2026年度の予算補正PDFのみ、この環境ではPDF内容の桁レベル確認ができず「unable_to_verify」とした（タイトル・発行日は整合）。

### 1-2. financeDashboard.json（当年度財政ダッシュボード）
- 単一オブジェクト。10セクション（歳入・目的別歳出・性質別歳出・補正事業・基金・人口・財政指標・市債残高等）すべてに対応する出典（`sources`配列、計11件）あり。全て延岡市公式PDF/xls（一次資料）。
- レコード単位のverificationStatusは無く、`confirmedDate`のみで管理。

### 1-3. municipalityComparison.json（同規模他市町村比較）
- 7市町村、全件`sourceRefs`あり（延べ44件、全て公式ドメイン＝一次資料）。

### 1-4. similarMunicipalityFinanceComparison.json（類似団体決算指標比較）
- 59市町村分。ファイル冒頭の3件の出典（総務省公式）を全レコードが共有するドキュメント単位方式。個々の市町村レコード自体には専用`sourceRefs`が無い。総務省データと`archiveFiscalYears.json`の値を突き合わせたクロスチェックがnotesに記録されている。

### 1-5〜1-8. 報酬ランキング系4ファイル（compensationComparison.json / nationalCompensationRanking.json / prefectureCompensationRanking.json / miyazakiCompensationComparison.json）
- 合計21件。全件一次資料（各市公式・全国市議会議長会研究会・宮崎県公式）を保有。
- `nationalCompensationRanking.json`の市長分（monthly/rank）は`null`のまま欠損を明示しており、0埋めしていない点はCLAUDE.mdの方針と合致。

### 1-9. compensationPendingMunicipalities.json（報酬データ未取得の市町村一覧）
- 5市町村、**全件`sourceRefs`なし**。`status: "official_data_pending"`という値そのものが「確認中」を明示する設計であり、欠損を隠さず正直に管理されている。ただし出典網羅率としては0%。

### 1-10. mayorEntertainmentExpenses.json（市長交際費）
- 21件の支出明細、全件月次PDF（一次資料）を保有。加えて`unconfirmedMonths`配列で2026-07〜2027-03の9か月分が「未確認」と明示（レコード化前の透明な進捗管理）。

### 1-11. politicalFundReports.json（政治資金収支報告書）
- 20件、全件宮崎県選管公式PDF。`reportStatus`＝確認済み19件・確認中1件。

### 1-12. politicalFundOrganizations.json（政治資金団体一覧）
- 21件、全件出典URLあり。`verificationStatus`＝confirmed 20件・pending 1件（現職市長の後援会、選管の公式開示リストにまだ反映されていないため）。

---

## 2. 選挙（1カテゴリ）

### 2-1. electionResults.json
- 39件（市長選29件・市議選10件）、全件`sourceRefs`あり（延べ49件、一次32件・二次17件＝NDLデジコレ）。
- `verificationStatus`: verified 25件・needsReview 24件。
- 深堀確認5件: すべて候補者名・得票数・投票率が本体フィールドと一致。1967年市長選では延岡商工会議所年史と延岡市史で投票日が1日食い違う点をnotesで正直に開示していることを確認した（隠蔽なし）。
- 得票数（votes）が`null`のまま残る候補者は1970年代以前を中心に多数存在し、「候補者名は判明したが得票数は未確認」という状態が正しく区別されている。

---

## 3. 市長・議員プロフィール（9カテゴリ）

### 3-1. archiveMayors.json（歴代市長プロフィール）
- 14件全件`sourceRefs`あり（延べ55件、一次18・二次30＝NDL18+Wikipedia等12・不明7）。深堀確認5件すべて整合。mayor-03（読谷山洋司）ではWikipedia記事内部の日付矛盾（2月6日 vs 2月26日）を発見しつつ、断定を避けて未確定と扱っている点が確認できた。

### 3-2. archiveMayorTerms.json（歴代市長任期）
- 30任期全件`sourceRefs`あり、全件が少なくとも1件のverified参照を含む。深堀確認5件すべて整合。termEndが「次期市長就任日の前日」という逆算値である場合はその旨を明記（直接の一次資料でないことを隠さない）。

### 3-3. members.json（現職市議会議員プロフィール）
- 26名全件、`sourceUrl`（延岡市議会公式プロフィール）と`sources`配列（選挙公報等）を保有。深堀確認でm21（前田遼）はWebFetchで実際にページを取得し、氏名の実在を直接確認できた（本監査で唯一の生アクセス成功例）。

### 3-4. archiveMemberProfiles.json（議員プロフィール歴史アーカイブ）
- 84件全件`sourceRefs`あり（延べ117件、全て一次資料）。`verificationStatus`: verified 65・needsReview 52。レコード単位では36件がverified含み、48件はneedsReviewのみ。

### 3-5. archiveMemberTerms.json（議員任期歴史アーカイブ）
- 26任期全件verified。深堀確認5件すべて得票数が候補者情報と一致。

### 3-6. formerMembers.json（元市議会議員）
- 58件全件に内容の濃い`sourceNote`（自由記述テキスト）があるが、他カテゴリと異なり構造化された`sourceRefs`配列を持たない。直接URLを含むのは3件のみで、大半は`electionResults.json`等の別ファイルへの参照に依拠する設計。内容自体の具体性・正確性は高いが、この監査基準では「部分的documented」に分類した。

### 3-7. archiveMemberAffiliations.json（会派・委員会所属歴）
- 74件全件`sourceRef`（単数形）あり、全件kensakusystem.jp基準。ただし`verificationStatus`は**全件needsReview**でverified 0件。カテゴリ全体が「検証待ち」状態のまま維持されている点は正直だが、出典網羅率としては要改善。

### 3-8. mayorPromises.json（市長公約）
- 12件全件、共有ドキュメント（5件）への有効な参照（`evidenceItems.documentKey`）を1件以上保有。無効参照は無かった。

### 3-9. mayorPolicyProgress.json（市長公約進捗・政策別）
- 4政策全件、市長本人公式サイトの`referenceUrl`とevidenceLabelを保有（本人公表資料である点に留意）。

---

## 4. 一般質問（3カテゴリ）

### 4-1. generalQuestions.json（直近・質問通告書ベース）
- 15件全件`sourceUrl`（延岡市公式通告書PDF）あり。うち14件は「のべおか市議会だより」でのクロス確認も完了。1件（2019年6月分）のみ市議会だよりでの確認が未了。

### 4-2. councilSpeechSummaries.json（一般質問・代表質問の会議録要約）
- 44名・419件の発言要約、全件kensakusystem.jp（延岡市議会会議録検索システム、一次資料）のURLを保有（延べ4546件）。`summaryStatus`: verified 398・partially-verified 21。深堀確認5件すべて発言者・日付・種別が一致。

### 4-3. memberSpeechAnalysis.json（議員別発言傾向の派生分析）
- 44名分の集計レコードだが、**独自のsourceRefsを持たない**（`evidenceSpeechIds`でcouncilSpeechSummaries.jsonの個票を間接参照するのみ）。`analysisStatus`はpending 26件・not-analyzed 18件で、**verified/confirmedは1件も無い**。全44件が明示的に「未検証」（`verifiedAt: null`）として管理されており、CLAUDE.mdの「確認できない情報は確認中で区別する」方針には合致するが、本監査対象の中で最も出典網羅率が低いカテゴリの一つ。

---

## 5. 市政年表（1カテゴリ）

### 5-1. civicTimelineEvents.json
- 209件全件`sourceRefs`あり（延べ228件、一次196・二次31＝NDL23+Wayback等・不明1）。`verificationStatus`: verified 187・partiallyVerified 22。深堀確認5件すべて整合。市制施行日（civic-002）のように、公式資料が複数あっても日単位までは未確定という限界を正直に記録している例を確認した。

---

## 6. 議案（2カテゴリ）

### 6-1. billVotes.json（議案・採決結果）
- **1177件全件**が`resultDocumentUrl`（延岡市公式PDF、一次資料）を保有し、`verificationStatus=verified`・`publicationStatus=published`で統一されている。深堀確認5件すべて整合（ただしPDF内容の桁レベル確認はこの環境では不可）。
- 重要な留意点: `extractionSource`は自動抽出1151件・手動26件で、大半はスクリプトによる自動抽出（`extractionConfidence`概ね0.95）である。
- さらに重要な発見: **議員ごとの個別賛否（`memberVotes`）を実際に保有するレコードはわずか2件のみ**で、`individualVoteDisclosureStatus`はunconfirmed 654件・notDisclosed 521件・disclosed 2件。「議案の可決/否決という結果」自体の出典網羅率は極めて高いが、「議員ごとの賛否」（CLAUDE.mdの優先機能2番）は依然として大半が未確認・非公開のままである。

### 6-2. billProposalRoles.json（議案提出者・決議提案者）
- 7件全件`sourceRefs`あり（会議録の発言者ラベル引用）。verified 6・needsReview 1。ファイル冒頭のnoteに「議員提出決議8件のうち3件は会議録全文調査でも個人名を特定できず、0件ではなく確認できていない状態として未登録のまま維持している」と明記されており、欠損の扱いが誠実。

---

## 7. 委員会（3カテゴリ）

### 7-1. committees.json
- 6委員会全件`sourceRefs`あり（延べ20件、全て一次資料）。`memberCount`と`members`配列の実要素数が6委員会すべてで完全一致することを確認（内部整合性が高い）。

### 7-2. committeeActivityReports.json（委員会活動報告書）
- 15件全件`url`・`sourceUrl`（延岡市公式PDF）あり。ただし他カテゴリと異なり`verificationStatus`や`notes`フィールドが無く、出典管理の粒度が他カテゴリより粗い。

### 7-3. committeeReportActivity.json（委員長・副委員長報告）
- 68件全件verified。深堀確認5件すべて、`fileName`（例: R050825A）に埋め込まれた元号年月日と`meetingDate`が完全一致することを確認し、機械抽出の信頼性の高さを裏付けた。

---

## 8. 特別職（1カテゴリ）

### 8-1. citySpecialPosts.json
- 55件全件`sourceRefs`あり（延べ88件、一次76・二次12＝NDL）。深堀確認5件すべて整合。
- `CityOfficialsPage.tsx`で一覧表示されるが、特別職ごとの個別詳細ページ（専用URL）は無く、`withDetailPage: false`とした。

---

## 総括

| 区分 | カテゴリ数 | 総レコード数 | 出典十分(fully) | 部分的(partial) | 不十分(insufficient) |
|---|---|---|---|---|---|
| 財政 | 12 | 234 | 201 | 28 | 5 |
| 選挙 | 1 | 39 | 19 | 20 | 0 |
| 市長・議員プロフィール | 9 | 328 | 148 | 180 | 0 |
| 一般質問 | 3 | 478 | 412 | 48 | 18 |
| 市政年表 | 1 | 209 | 187 | 22 | 0 |
| 議案 | 2 | 1184 | 1183 | 1 | 0 |
| 委員会 | 3 | 89 | 89 | 0 | 0 |
| 特別職 | 1 | 55 | 55 | 0 | 0 |
| **合計** | **32** | **2616** | **2294 (87.7%)** | **299 (11.4%)** | **23 (0.9%)** |

（表の内訳は`phase79-source-coverage-findings.json`の各カテゴリの積み上げをスクリプトで再集計した値。財政の234件はarchiveFiscalYears 70件を含む12ファイルの合算、市長・議員プロフィールの328件はarchiveMayors〜mayorPolicyProgressまでの9ファイルの合算。）

### 主な所見

1. **「出典フィールドがある」＝「出典が十分」ではない実例を複数確認した。**
   - `formerMembers.json`（58件）は自由記述の`sourceNote`のみでURLを直接持たず、`archiveMemberAffiliations.json`（74件）は全件`needsReview`のまま、`memberSpeechAnalysis.json`（44件のうち26件pending・18件not-analyzed）は自身のsourceRefsを持たない派生分析であるなど、フィールドの存在と実際の検証完了度には乖離がある。
2. **billVotes.jsonは「議案の結果」自体の出典網羅率は極めて高い（1177/1177）が、「議員ごとの賛否」はほぼ未確認・非公開（654件unconfirmed、521件notDisclosed）。** CLAUDE.mdの優先機能「2. 議案ごとの賛否」を評価する際は、この二層構造（議案レベルvs議員個人レベル）を区別する必要がある。
3. **CLAUDE.mdの「確認できない情報はnullや確認中で明示する」方針は、複数のファイルで具体的に実践されていることを確認した。**（`compensationPendingMunicipalities.json`の`official_data_pending`、`nationalCompensationRanking.json`の市長分`null`、`mayorEntertainmentExpenses.json`の`unconfirmedMonths`、`billProposalRoles.json`の「確認できていない状態として未登録のまま」等）
4. **NDLデジタルコレクション（二次資料、コマ番号付き）を出典とするレコードは、財政史(35件)・選挙(17件)・市長プロフィール(18件)・市政年表(23件)・特別職(12件)で計105件確認**。いずれも「1963年版/1983年版延岡市史」等の原本を直接閲覧した記録であり、NDL経由であっても出典としての信頼性自体は高い（デジタル化された一次資料の閲覧）。
5. **深堀検証について**: この実行環境ではPDFレンダラー未導入・kensakusystem.jpのセッション依存URLのため、外部URLへの実アクセスによる完全な裏取りはHTML1件（`members.json` m21前田遼）に限られた。それ以外はレコード内のタイトル・日付・組織名・金額等の記述内容とレコード本体の値との整合性チェックで判定しており、この点は`sampledDeepVerification`の各`note`に明記している。

### 監査できなかった点・限界

- `politicalFundOrganizations.json`と`mayorPromises.json`等、一部のカテゴリでは深堀サンプル数を5件に満たない件数（1〜3件）にとどめた（時間配分上の判断）。財政の主要数値・選挙の当落結果・市長/議員の任期の4ファイルは指示通り5件以上を確認済み。
- PDF/CGIベースのURLは実アクセスでの裏取りができなかったため、「記載内容の整合性」チェックにとどまる。これは推測ではなく、ファイル内に記録された`notes`・`sourceTitle`等の記述と本体フィールドとの突合であることを明記する。

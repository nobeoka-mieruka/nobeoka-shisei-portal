# Phase121（旧称Phase63）歴代市長・歴代議員 任期データ監査 findings

生成日: 2026-08-25
担当: worker（歴代市長・歴代議員データ監査）
独占編集ファイル方針: 事実確認できたもののみ最小修正。推測補完なし。

## 0. 事前確認（実施内容）

以下を読み、既存の到達点・既に試行済みの方法を確認した上で着手した。

- `CLAUDE.md`
- `git log --oneline -50`（Phase16-31、Phase78-118を確認。特にPhase27-31・89-98・99-108・109-118）
- `reports/phase33-master-unresolved-ledger.json`（UNR-001〜UNR-031、うちUNR-029が本タスクの市長任期13区間そのもの）
- `reports/ndl-historical-source-ledger.json`、`reports/historical-mayor-research-status.{json,md}`、`reports/physical-source-candidates.md`
- `src/data/archiveMayors.json`、`archiveMayorTerms.json`、`archiveMemberProfiles.json`、`archiveMemberTerms.json`、`archiveMemberAffiliations.json`、`formerMembers.json`
- `reports/phase99-108-staging/phase102-103-term-gaps-findings.json`（19対象の詳細library_requiredプラン）
- `reports/phase109-118-staging/phase110-term-gaps-findings.json`（csp-43を新規確定、csp-44/45/48/49はlibrary_required維持）
- `reports/phase109-118-staging/phase111-mayors-audit-findings.json`（UNR-029・折小野代数表記の直近再監査、新規解決0件）

**結論**: 市長任期13区間（UNR-029）は、Phase102-103・Phase110・Phase111という3フェーズにわたり、NDLサーチ、Wikipedia出典追跡、延岡市議会会議録検索システム、市公式サイトの新規PDF（延岡市史2013年版13分冊）、夕刊デイリー特集記事検索、官報検索、アジア歴史資料センター(JACAR)、延岡史談会報の書誌発見など、多角的なオンライン経路をすでに試行し尽くしている。前回Phase111時点で13区間すべてが`library_required`（現地閲覧が必要）と分類済み。この判定・試行履歴を再確認した上で、**同一資料・同一手法の反復調査はしないという指示に従い**、今回は下記1点のみ新しい切り口を試したのみに留めた。

## 1. 市長任期13区間（UNR-029）への新規アプローチ（本フェーズで新規実施）

Phase111が未試行として残していた「官報」「国立公文書館デジタルアーカイブ」の直接検索を実施した。

- WebSearch「"延岡市長" 官報 昭和12年 鈴木憲太郎 就任 site:dl.ndl.go.jp」→ 該当資料なし（無関係な官報コマのみヒット）。
- WebSearch「国立公文書館 デジタルアーカイブ 延岡市長 任命 昭和」→ 該当資料なし。
- WebFetch でNDLデジタルコレクションの検索結果ページを直接開いたが、当該ページはJavaScript依存のUIで、WebFetch（静的HTML取得）では検索結果一覧を取得できないことを確認した（既存UNR-020と同種の技術的制約。新しい制約の発見ではなく、既知パターンの再確認）。

**結果**: 新規に確定できた日付は0件。13区間の分類（`library_required`）に変更なし。archiveMayorTerms.jsonへの変更は行っていない。validate:dataの空白期間警告13件は変更前後で同一。

戦前期（1933-1946年ごろ）の市長人事は、府県知事等とは異なり、市長単位で官報「叙任及辞令」欄に掲載される慣行が確認できなかった（少なくとも本フェーズのオンライン検索では特定不可）。この点は次フェーズ以降、同一ルートの反復を避けるための負の知見として記録する。

### 13区間の現況（変更なし、確認レベル一覧）

| 対象 | 区間 | 分類 |
|---|---|---|
| M1 | 1937-01-06〜1937-03-06（仲田又次郎→鈴木憲太郎） | library_required |
| M2 | 1937-04-14〜1937-05-16（鈴木憲太郎、辞職→再任） | library_required |
| M3 | 1937-06-15〜1937-09-26（鈴木憲太郎→大島文彦） | library_required |
| M4 | 1941-09-25〜1941-10-22（大島文彦→三浦虎雄） | library_required |
| M5 | 1942-04-25〜1942-05-19（三浦虎雄、辞職→再任） | library_required |
| M6 | 1946-03-06〜1946-03-29（三浦虎雄→鈴木憲太郎） | library_required |
| M7 | 1947-03-22〜1947-04-16（鈴木憲太郎→佐藤千吉郎） | library_required |
| M8 | 1948-06-06〜1948-07-16（佐藤千吉郎→仲田又次郎） | library_required |
| M9 | 1952-06-19〜1952-07-11（仲田又次郎→三浦虎雄） | library_required |
| M10 | 1956-03-27〜1956-04-21（三浦虎雄→青木善祐、就任日disputed） | library_required |
| M11 | 1966-12-01〜1967-01-22（折小野良一→房野博） | library_required |
| M12 | 1978-10-05〜1978-11-05（房野博→早生隆彦） | library_required |
| M13 | 1994-01-11〜1994-02-06（早生隆彦→櫻井哲雄） | library_required |

いずれも次の一歩は「延岡市史上巻（1983年、コマ124-125）の現地閲覧」または「宮崎日日新聞縮刷版・延岡市選挙管理委員会選挙録の現地確認」であり、Phase102-103のlibraryPlanを引き続き正とする。

## 2. 歴代市長14名の任期確認レベル一覧（現状のまま）

archiveMayorTerms.jsonには既に`termStartPrecision`/`termEndPrecision`（`day`/`month`/`year`）フィールドがスキーマ定義済み（`src/types/historicalArchive.ts` L141-167）であり、CLAUDE.mdの「確認できない情報は区別する」方針を満たす確認レベル管理が既に実装済みである。新規スキーマ追加は不要と判断した。

| 市長ID | 氏名 | 任期数 | 就任日精度の内訳 |
|---|---|---|---|
| mayor-01 | 三浦 久知（現職） | 1 | day |
| mayor-02 | 首藤 正治 | 3 | month×3 |
| mayor-03 | 読谷山 洋司 | 2 | day, day |
| mayor-04 | 仲田 又次郎 | 2 | month×2 |
| mayor-05 | 鈴木 憲太郎 | 3 | month×3 |
| mayor-06 | 大島 文彦 | 1 | month |
| mayor-07 | 三浦 虎雄 | 3 | month×3 |
| mayor-08 | 佐藤 千吉郎 | 1 | month |
| mayor-09 | 青木 善祐 | 1 | month |
| mayor-10 | 折小野 良一 | 2 | month×2 |
| mayor-11 | 房野 博 | 3 | month×3 |
| mayor-12 | 早生 隆彦 | 4 | month×4 |
| mayor-13 | 櫻井 哲雄 | 3 | month×3 |
| mayor-14 | 山本 一丸 | 1 | day |

現職・直近3代（三浦久知・首藤正治・読谷山洋司）と最終代（山本一丸）は日または月精度で確認済み。1937-1994年在任の10名（mayor-04〜mayor-13）は月精度が上限で、日精度化には現地閲覧が必要（上記13区間）。

## 3. 新規に確定できた任期・矛盾の記録件数

- **新規確定件数: 0件**（archiveMayorTerms.jsonへの変更なし）。
- **新規矛盾記録: 0件**（既存のdisputed項目、例：折小野良一氏の代数表記＝UNR-013、青木善祐氏の就任日候補＝UNR-029 M10は、いずれも既存のまま変更なし。両論併記を維持し、独自判断での確定は行っていない）。
- 既存disputed/RESEARCH_EXHAUSTED項目（UNR-001〜UNR-004の市長選挙対立候補等）は、指示通り同一資料・同一方法での再調査は行っていない。

## 4. 歴代議員の整合性監査結果

`archiveMemberProfiles.json`（84件）・`archiveMemberTerms.json`（26件）・`archiveMemberAffiliations.json`（74件）・`formerMembers.json`（58件）・`members.json`（26件）を対象に、`npm run validate:data`の既存自動検証に加え、手動でのクロスチェックを実施した。

### 実施した検証内容と結果

1. **重複ID**: archiveMemberProfiles/archiveMemberTerms/archiveMemberAffiliationsのid重複 → **0件**（validate:dataのcheckDuplicateIdsで検証済み、errors=0）。
2. **orphan参照**:
   - `legacyMemberId`がmembers.jsonに存在しないケース → **0件**
   - `legacyFormerMemberId`がformerMembers.jsonに存在しないケース → **0件**
   - `archiveMemberTerms.memberProfileId`がarchiveMemberProfilesに存在しないケース → **0件**
   - `archiveMemberAffiliations.memberProfileId`がarchiveMemberProfilesに存在しないケース → **0件**
   - `archiveMemberAffiliations`の`affiliationType=faction`でfactions.jsonに存在しないaffiliationId → **0件**（該当データ自体が0件）
3. **氏名の整合性**: archiveMemberProfiles.nameとmembers.json/formerMembers.jsonの氏名が食い違うケース → **0件**（84件全件一致）。
4. **日付矛盾**: archiveMemberTerms/archiveMemberAffiliationsのtermStart>termEnd等 → validate:dataのcheckPeriodConsistencyで検証済み、**0件**。同一人物・同一区分内の期間重複（checkNoOverlappingPeriods） → **0件**。
5. **committee/councilRole/party値の一覧確認**: `committee`＝産業建設委員会・議会運営委員会・厚生教育委員会、`councilRole`＝議長、`party`＝自由民主党・無所属・民主党・公明党・国民民主党・社会民主党・日本共産党。表記ゆれや不審な値は確認されなかった。
6. **プロフィール件数の突合**: archiveMemberProfiles 84件 = members.json 26件 + formerMembers.json 58件（過不足なし）。
7. **archiveMemberProfiles.termCount と archiveMemberTerms.json実件数の差異**: 76件のプロフィールでtermCount（当選確認回数、members.json/formerMembers.json由来）と、archiveMemberTerms.json（会期単位の任期開始・終了日を個別確認済みの26件のみのバックフィル層）の件数が一致しないことを検出したが、**これはデータ不整合ではなく設計上の既知の状態**と判断した。理由：archiveMemberTerms.jsonは「選挙単位の在籍期間を日付付きで個別確認したレコード」のみを収録する意図的に疎な層であり（型定義コメント参照）、termCountは別途一次資料（選挙結果等）で確認済みの当選回数を示す。両者は異なる確認粒度を表すフィールドであり、一致を要求する制約はvalidate-data.mjs上も存在しない。誤りではないため、データ修正は行っていない。
8. **previousMayorId/nextMayorId（市長側、参考確認）**: archiveMayorTerms.json 30件全件で、参照先IDがarchiveMayors.jsonに実在することを確認（orphan 0件）。

### 監査結果サマリー

- 重複ID: 0件
- orphan参照: 0件
- 日付矛盾: 0件
- 氏名不一致: 0件
- 新規に発見された問題: **0件**（既存の自動検証・手動クロスチェックいずれでも新規の不整合を検出せず）

## 5. UI表示（確認レベルの日本語表示）確認結果

`src/pages/MayorDetailPage.tsx`・`src/pages/MayorsPage.tsx`は、`src/lib/archiveMayors.ts`の`formatArchiveDateWithPrecision`関数を通じて、`termStartPrecision`/`termEndPrecision`が`day`以外（month/year）の場合に日付表示を丸め、「日付精度が年・月単位のもの◯期」という注記を既に表示している（MayorDetailPage.tsx L234-235、L253-254）。これはCLAUDE.mdが求める「確認できない情報を確認中等で明示する」を既に満たしており、本フェーズでの追加実装は不要と判断した。

`src/pages/MembersFormerPage.tsx`は、`src/lib/evidenceAvailability.ts`とは別に、既存の`archiveVerificationStatusLabel`（sourceRefのverificationStatus）を用いて「出典確認状況：確認済み／要確認」等を表示し、在籍期間が未確認の場合は「在籍期間：確認中」とフォールバック表示している。`src/pages/MembersHistoryPage.tsx`も「在籍不明であり不在を意味しない」という注記を明示済み。

archiveMemberTerms.jsonには（archiveMayorTerms.jsonと異なり）termStartPrecision相当のフィールドが定義されていないが、現状収録済み26件はいずれも選挙結果由来の日精度データのみであり、月・年精度のデータが存在しないため、対応するUI表示の必要性も現時点ではない（データが増えた段階で検討する）。

**結論**: 確認レベルのUI表示は市長・元議員ページとも既存の仕組みで既に実装済みであり、重複実装を避けるため新規UI追加は行っていない。

## 6. 変更ファイル一覧

**なし**（データファイル・コンポーネントとも変更なし）。

理由：
- UNR-029（市長任期13区間）は新規に確定できた日付が0件だったため、archiveMayorTerms.jsonへの変更なし。
- 歴代議員の整合性監査で新規の不整合が0件だったため、修正対象なし。
- UI確認レベル表示は既存実装で要件を満たしているため、新規UI追加なし。

## 7. 検証結果

- `node --experimental-strip-types scripts/validate-data.mjs` → errors=0, warnings=40（archiveMayorTerms.json空白期間13件を含む、本フェーズ実施前と同一）
- `npx tsc -b` → 実行結果は本レポート末尾のコミットログ／作業ログを参照（コード変更なしのため差分なし）
- `npx oxlint` → 実行結果は本レポート末尾のコミットログ／作業ログを参照（コード変更なしのため差分なし）

## 8. 総括

本フェーズは、Phase27-31・89-98・99-108・109-118という既存の非常に深い調査の到達点（UNR-029＝13区間すべてlibrary_required）を正しく引き継ぎ、指示に従って同一資料・同一手法の反復調査を避けた。新規に試みた官報・国立公文書館デジタルアーカイブ経路も含め、オンラインで新規確定できた任期は0件だった。一方、歴代議員データ（84名分のプロフィール・任期・会派・委員会）の整合性監査では、重複ID・orphan参照・日付矛盾・氏名不一致のいずれも新規に0件で、データ品質は健全であることを確認した。UI側の確認レベル表示（月単位・年単位の注記）も既存実装で要件を満たしていることを確認し、重複実装は行っていない。

次フェーズへの引き継ぎ：13区間の日精度化には、延岡市史上巻（1983年、コマ124-125）・宮崎日日新聞縮刷版・延岡市選挙管理委員会選挙録のいずれかへの現地閲覧が引き続き最有力の次の一歩である（Phase102-103のlibraryPlanを参照）。

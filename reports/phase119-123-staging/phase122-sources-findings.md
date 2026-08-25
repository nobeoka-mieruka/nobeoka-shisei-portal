# Phase122（旧称Phase64）: リンク・出典品質改善 findings

- 作業日: 2026-08-25
- 前提資料: `reports/phase33-master-unresolved-ledger.json`、`reports/wayback-recovery-queue.{json,md}`、
  `scripts/validate-sources.mjs`、`reports/source-quality-audit.json`、
  `reports/phase109-118-staging/phase117-linkhealth2-{findings.json,report.md}`（直近のlinkHealth実測、2026-08-24）
- 本タスクの範囲: 既知の壊れたリンク6件の代替出典チェーン調査、出典未登録・出典不足warningsの確認、
  信頼レベル付与の設計・パイロット導入、SNS/新聞単独出典の点検、Wayback復旧の1回確認。

## 1. リンク切れ件数（Before / After）

| 指標 | Before（Phase117時点） | After（本タスク後） |
| --- | --- | --- |
| `dataQualitySummary.json` linkHealth.notFound404（公開サイト表示） | 6 | **3** |
| うち現在アクティブなsourceUrlとして実害がある404 | 3（仲田又次郎Wikipedia／27879.pdf／28156.pdf） | 3（同上、内訳は変化。詳細は下記） |
| うち`dataQualitySummary.json`自己参照の残骸のみ | 3（news.yahoo記事／27980.xls／miyanichi記事） | **0（恒久的に解消、下記2-4参照）** |
| `excludedBackupOnlyReferences` | 143 | 146（*.backup.jsonのみ参照分。従来通り対象外のまま） |
| `totalChecked`（linkHealth） | 1,224 | 1,230（councilWatchedDocuments.jsonへ新規PDF2件登録に伴い増加） |

`validate-sources.mjs`: errors=0 warnings=15→15（件数不変、詳細は3節）、info=65→66（新規sourceRef追加により+1）。
`validate-data.mjs`: errors=0 warnings=40→40（本タスクでは対象外の既存warningsのため不変、詳細はPhase85/97参照）。

## 2. 6件の個別対応

### 2-1. `https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/27879.pdf`（第26回定例会 会議日程）

- **状態**: `councilWatchedDocuments.json`が正規に監視対象としている資料。延岡市議会の一覧ページ
  （https://www.city.nobeoka.miyazaki.jp/site/gikai/6758.html）を実際にfetchして確認したところ、
  旧PDFは会期終了に伴い一覧から撤去され、後継の**「第27回延岡市議会（定例会）会議日程」
  （`.../attachment/28674.pdf`、HEAD確認=200）**が新規掲載されていた。
- **対応**: 単純なURL置換はしていない（第26回と第27回は文書の実体が異なるため）。
  `scripts/sync-council-data.mjs`のsession-schedule監視ロジック（差分取得・削除検知）と全く同一のコードを
  session-schedule 1カテゴリのみに限定して再利用し（フル実行は意見書・決議、委員会活動報告書、
  質問通告一覧、議員名簿まで全カテゴリの大量PDFダウンロードを伴い本タスクの範囲を超えるため、
  一時的なスコープ限定スクリプトを使用。作業後に削除しコミットしていない）、
  実際に公式サイトへ到達して以下を実施した：
  - 新規ドキュメント`session-schedule-376b0147ddbf`（28674.pdf）をSHA-256ハッシュ・OCR判定込みで新規登録。
  - 旧レコード`session-schedule-5774a79eedad`（27879.pdf）は削除せず、スクリプトの正規の削除検知ロジック
    （連続2回未検出で`removed-confirmed-suspected`）に従って`missingStreak: 0→1`、
    `status: "published"→"url-change-suspected"`とした（1回目の未検出のため確定はせず、
    次回の自動巡回で2回目の未検出が確認されれば`removed-confirmed-suspected`へ進む設計を尊重した）。

### 2-2. `https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28156.pdf`（令和8年度 常任委員会・特別委員会開催予定表）

- **状態**: 同じ一覧ページで、タイトルが完全一致のまま新URL`.../attachment/28682.pdf`（HEAD確認=200、
  決定日「令和8年8月21日」に更新）に差し替わっていた。
- **対応**: 2-1と同一のスコープ限定スクリプトで、新規ドキュメント`session-schedule-a1de84e0ce55`
  （28682.pdf）を登録し、旧レコード`session-schedule-a392dabc3484`（28156.pdf）を
  `missingStreak: 0→1`、`status: "url-change-suspected"`とした。

### 2-3. `https://ja.wikipedia.org/wiki/仲田又次郎`（初代・第9代市長の任期日単位出典）

- **状態**: `archiveMayorTerms.json`（mayor-04-term-01）のみが現在アクティブに参照。2026-08-25に再確認したが
  依然404（独立記事は存在しない）。
- **対応**: 代替出典チェーンで調査した結果、**コトバンク（`https://kotobank.jp/word/仲田又次郎-1096772`、
  200 OK確認済み。『20世紀日本人名事典』日外アソシエーツ・『デジタル版 日本人名大辞典+Plus』講談社を
  出典として収録）**に「宮崎県延岡町議を経て、昭和8年延岡市初代市長」との記載を確認した。
  このURLは`archiveMayors.json`（人物レコード側）で既に使用されている出典と同一であり、新規発見ではないが、
  **任期レコード側（archiveMayorTerms.json）には未反映**だったため、新規sourceRefとして追加した。
  ただし、コトバンクの記載は「昭和8年（年単位）」までで、Wikipedia由来の**日単位の就任日・退任日
  （1933-04-15／1937-01-06）は裏付けられない**。よって：
  - 壊れたWikipediaのsourceRefは削除せず、404の事実と「代替の一次資料は見つかっていない」旨を追記した
    （既存の`sourceUnavailable`は維持）。
  - コトバンクのsourceRefを新規追加し、「初代市長への就任」という事実自体は独立に補強したが、
    日単位の精度については「依然未確認」と明記した（推測で日付を確定しない）。

### 2-4. `https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/27980.xls`／`https://news.yahoo.co.jp/articles/54bca0ed...`／`https://www.the-miyanichi.co.jp/kennai/_84868.html`

- **状態**: いずれも現在の`src/data`実データ（`municipalityComparison.json`・`archiveMayors.json`・
  `archiveMayorTerms.json`・`civicTimelineEvents.json`）では既にPhase96・Phase99等で正しい代替URL
  （28569.xls、Wayback保存版）へ差し替え済みだった。**唯一の参照元は`dataQualitySummary.json`自身**
  （過去の生成結果の残骸）で、実害はなかった。
- **根本原因を特定**: `scripts/generate-quality-summary.mjs`が書き出す`dataQualitySummary.json`は
  「壊れたURLの一覧（broken配列）」を含む。この配列自体が`src/data/*.json`の1ファイルとして
  `scripts/check-external-links.mjs`の走査対象に含まれるため、次回実行時にこの残骸URLを
  「参照あり」として再収集し、再びnot_found_404として`broken`配列へ書き戻す**自己参照ループ**に
  なっていた（`*.backup.json`の除外と同じ発想の抜け漏れ）。
- **恒久対応**: `scripts/generate-quality-summary.mjs`のliveResultsフィルタを拡張し、
  `dataQualitySummary.json`自身のみを参照元とするURLも`*.backup.json`と同様に集計対象外とした
  （スキーマ変更なし、`excludedBackupOnlyReferences`のカウント対象に統合、note文言のみ更新）。
  これにより3件が恒久的に「公開リンク切れ件数」から消え、今後同種の残骸が再発しない。

## 3. `validate:sources`のwarnings 15件（当初「出典未登録・出典不足」と想定していたもの）

実際に該当15件すべてを確認したところ、**すべて`civicTimelineEvents.json`の同一パターン**だった。

- メッセージ: 「公式資料として扱われていますが、延岡市・延岡市議会・国の公式ドメインではありません
  （dl.ndl.go.jp / ndlsearch.ndl.go.jp）」
- 該当15件全件のsourceRefsを直接読んだ結果、**いずれも`label`（タイトル）・出典組織・巻末ページ等が
  詳細に記入済み**で、「出典未登録」でも「出典不足（タイトル欠落）」でもなかった。
- 原因: `validate-sources.mjs`のcivicTimelineEvents.jsonチェックは、イベント単位の
  `verificationStatus === "verified"`を`claimsOfficial`としてsourceRefs内の**全URL**に適用している。
  国立国会図書館（NDL）は`OTHER_PUBLIC_DOMAINS`（公的機関だが「延岡市公式」ではない）に分類されているため、
  「延岡市史等の一次資料をNDLデジタルコレクションで確認し、市公式ページと併記した」イベントで
  warningが出る。archiveMayors.json/archiveMayorTerms.jsonでは「verified＝事実確認、official＝ドメイン、
  は別軸」という設計（該当コード140-148行目のコメント）が既に採られているが、civicTimelineEvents.json側は
  この区別を適用していない。
- **判断**: これは「出典タイトルの欠落」という当初想定とは異なり、**ドメイン分類上の意図的なソフト警告**
  （ビルドは止めない`warning`、`error`ではない）であり、内容としては正確・出典明記済みである。
  スクリプトロジックの修正（civicTimelineEvents.jsonもarchiveMayors.json同様に`claimsOfficial=false`とする）は
  一案として検討したが、**その場合「本当に非公式ドメインをofficialと誤表示している」将来のケースを
  検知できなくなる**トレードオフがあるため、今回は見送った（既存の`validate-sources.mjs`のロジックを
  変更しないという安全側の判断。破壊的変更を避けるCLAUDE.mdの方針に沿う）。
- **結論**: 15件は「対応不要な正常な警告」として記録した。件数はBefore/After共に15件で変化なし
  （意図的に温存、緩和のための条件変更は行っていない）。

## 4. 信頼レベル分類の設計・パイロット導入

`ArchiveSourceRef`（`src/types/historicalArchive.ts`）へ**任意フィールド**として`trustLevel`を新規追加した。

```ts
export type ArchiveSourceTrustLevel =
  | "PRIMARY"          // 一次資料（議事録原本・議案書・予算決算書・公文書原本・NDL歴史資料原本等）
  | "OFFICIAL_ARCHIVE"  // 公的機関の公式サイト・公式刊行物（市・市議会・県・総務省等）
  | "SECONDARY"         // 編纂・要約された二次資料（辞典類・書籍・Wikipedia等）
  | "NEWS"              // 報道機関の記事
  | "SOCIAL"            // SNS投稿等の非公式発信
  | "UNVERIFIED";        // 種別未分類、または資料に到達できず確認不能

export interface ArchiveSourceRef {
  // ...既存フィールドは一切変更していない...
  trustLevel?: ArchiveSourceTrustLevel; // 新規・任意
}
```

- **既存スキーマとの関係**: `verificationStatus`（事実確認の有無）とは独立した軸として設計した。
  例えば信頼度の低い資料（NEWS）でも記載事実そのものはverifiedになりうる（実際、mayor-14のケースが該当）。
- **既存の`reports/source-quality-audit.json`（A〜E品質グレード）との違い**: 既存のA〜Eは
  `scripts/generate-final-quality-audit.mjs`がドメイン一覧とリンク健全性から**都度計算する
  reports/専用の集計値**（データファイルには保存されない）。今回追加した`trustLevel`は
  **sourceRef単位でJSONに永続化される分類**であり、ユーザー要求のPRIMARY/OFFICIAL_ARCHIVE/SECONDARY/
  NEWS/SOCIAL/UNVERIFIEDという語彙をそのまま採用した。両者は役割が異なるため、既存のA〜Eスクリプトは
  変更していない（重複実装を避けつつ共存）。
- **パイロット範囲**: 全件への一括付与は行わず、本タスクで新規追加・見直しした
  `archiveMayorTerms.json`のmayor-04-term-01（3件のsourceRefs、上記2-3参照）にのみ付与した
  （OFFICIAL_ARCHIVE 1件、SECONDARY 2件）。既存の他レコードへの遡及付与は今回のスコープでは行っていない
  （破壊的変更を避け、まず設計と少数パイロットのみとする指示に従った）。
- **型定義・validate-data.mjs双方でこの新規フィールドを許容することを確認済み**
  （`validate-data.mjs`はsourceRefsのキーを許可リストで検証していないため、既存データへの影響なし。
  `npx tsc -b`はエラー0件）。
- **今後の拡張案**（未実施、次フェーズへの提案）: `validate-sources.mjs`のドメイン分類ロジック
  （OFFICIAL_DOMAINS／SECONDARY_DOMAINS等）を再利用してtrustLevelを機械的に提案するバッチスクリプトを
  作成し、人手レビューを経て段階的に既存データへ適用する運用が考えられる（自動確定はしない）。

## 5. SNS・新聞のみが唯一の出典になっている重要な歴史情報の点検

`src/data`配下の主要ファイル（archiveMayors.json, archiveMayorTerms.json, archiveMemberProfiles.json,
citySpecialPosts.json, civicTimelineEvents.json）を機械的に走査し、sourceRefsの参照ドメインが
**全件SNS**（x.com/twitter.com/facebook.com/instagram.com/line.me）のレコードは**0件**だった。

**新聞記事のみ**（SNSではないが単一の報道機関のみ）が出典になっているケースは3件見つかった。

| ファイル | ID | 内容 | 評価 |
| --- | --- | --- | --- |
| archiveMayors.json | mayor-14（山本一丸・元市長職務代理者） | 読谷山洋司市長の辞職関連 | 実際は読売新聞オンライン＋宮崎日日新聞の2媒体（Wayback保存）＋副市長就任時の宮崎日日新聞記事の計3件。単一媒体ではなく複数報道機関で裏付け済み。verificationStatus: verified |
| civicTimelineEvents.json | civic-156（副市長就任） | 宮崎日日新聞1件のみ | 既に`verificationStatus: "partiallyVerified"`とし、notesに「非公式・二次的な報道機関のため」と明記済み |
| civicTimelineEvents.json | civic-159（市長辞職） | 宮崎日日新聞1件のみ | 同上。notesに「事実自体はarchiveMayorTerms.json側で複数報道と整合すると記録されている」と明記済み |

**判断**: いずれも(1)健康上の理由による辞職という性質上、市の公式発表ページより報道が一次的な記録である
場合が多いこと、(2)既存データが既に「報道機関単独」である事実とその限界を`verificationStatus`と`notes`で
明示していること、(3)関連レコード間（archiveMayors.json↔civicTimelineEvents.json）で「複数報道機関の
一致」という補強事実が既に記録されていること、を確認した。市の公式記者会見ページ（延岡市サイト内）に
該当の単独ページが存在するかも確認を試みたが、時間内に特定できなかったため、**推測で追加せず現状維持**とした
（無理に一次資料を作らない、というタスク指示に従った）。追加の一次資料確認は今後の課題として記録する。

## 6. Wayback Machine 503障害の確認

指示通り、代表的なURL（`https://web.archive.org/web/20250613112338/https://www.the-miyanichi.co.jp/kennai/_84868.html`）
に**1回だけ**HEADアクセスし、200 OKであることを確認した。Phase117（2026-08-24）の「serverError 0件」
という結果と整合しており、追加のリトライ・再アクセスは行っていない。

## 7. 変更ファイル一覧

| ファイル | 変更内容 |
| --- | --- |
| `src/data/councilWatchedDocuments.json` | session-schedule 2件の後継PDFを新規登録、旧2件を`url-change-suspected`へ更新（データ削除なし） |
| `src/data/archiveMayorTerms.json` | mayor-04-term-01へコトバンクsourceRef新規追加、Wikipedia sourceRefへ2026-08-25再確認結果を追記、trustLevelパイロット付与（3件） |
| `src/types/historicalArchive.ts` | `ArchiveSourceTrustLevel`型・`ArchiveSourceRef.trustLevel`（任意フィールド）を新規追加。既存フィールドは無変更 |
| `scripts/generate-quality-summary.mjs` | dataQualitySummary.json自己参照ループの恒久修正（liveResultsフィルタ拡張） |
| `src/data/dataQualitySummary.json` | 上記修正を反映して再生成（notFound404: 6→3、totalChecked: 1224→1230） |
| `reports/external-link-check.json` | councilWatchedDocuments.json変更後の`node scripts/check-external-links.mjs`実行結果（非kensakusystem分、キャッシュ再利用733＋新規9件） |

一時的に使用した`scripts/.tmp-phase122-scoped-sync.mjs`（session-schedule限定の巡回スクリプト）は
作業完了後に削除し、コミットしていない。

## 8. 検証結果

- `node --experimental-strip-types scripts/validate-data.mjs`: errors=0 warnings=40（変化なし、対象外の既存warningsのため）
- `node scripts/validate-sources.mjs`: errors=0 warnings=15（変化なし、3節参照）info=66（+1）
- `npx tsc -b`: エラーなし
- `npx oxlint`: 警告・エラーなし
- `npm run build`: 成功（2242ルートprerender、`validate:seo` failures=0 warnings=0、`validate:content` errors=0 warnings=0）

## 9. 残課題・次の提案

1. `councilWatchedDocuments.json`の27879.pdf／28156.pdfは`url-change-suspected`（missingStreak=1）のまま。
   次回の自動巡回（GitHub Actions、120時間ゲート）で2回目の未検出が確認されれば
   `removed-confirmed-suspected`へ自動的に進む。人手での即時確定は行っていない（安全側）。
2. `trustLevel`の全件遡及付与は今後のフェーズ課題（本タスクでは設計とパイロット3件のみ）。
3. mayor-14／civic-156／civic-159の単一新聞出典について、延岡市公式記者会見ページ内に該当の
   単独ページがあるか、時間の許す次フェーズで再調査する余地がある。
4. `archiveMayorTerms.json`の13区間の任期空白、`archiveFiscalYears.json`の24年度欠番は、
   Phase85/97で「大量バックフィル待ち（正当な警告）」と分類済みであり、本タスクのスコープ外として
   変更していない。

# セッション引き継ぎメモ（2026-08-04 更新・フェーズ9B完了）

フェーズ9「比較・可視化・タイムライン」を小分けで進めている。今回は**フェーズ9B（財政比較・グラフ・年度別タイムライン）**が完了した。
push・デプロイは未実施。フェーズ9Cは開始していない。

## ロードマップ

1. フェーズ6：政策データ・政策比較基盤 → 完了
2. フェーズ7：議案・条例・請願・陳情アーカイブ → 完了
3. フェーズ8：AI横断検索・テーマ検索 → 完了
4. フェーズ9：比較・可視化・タイムライン
   - 9A：共通型・共通コンポーネント・`/compare`入口整理・`/timeline`基盤ページ → 完了
   - **9B：財政比較・グラフ・年度別タイムライン → 完了**
   - 9C以降：市長・議員・政策比較ページの追加拡張、`/themes/:slug/timeline`連携、
     未着手の`/compare/members`等 → 未着手
5. フェーズ10：自動巡回の完成・全体検証・本番デプロイ

## 完了した作業（フェーズ9B）

### 追加・変更したページ

- `/compare/finance`：全19指標（人口・世帯数・予算3種・歳入・歳出・市税・地方交付税・国庫支出金・
  市債発行額・市債残高2区分・基金総額・財源調整用基金・財政力指数・経常収支比率・実質公債費比率・
  将来負担比率）をグループ別トグルで比較できるよう拡張。年度別比較表の列も拡張。市民1人当たり
  予算・決算額（当サイトによる算出値、算式・分子・分母・使用人口年度・丸め方を明記）と、
  1人当たり市債残高・基金残高（元資料掲載値、算出していないことを明記）を追加。
- `/compare/budget`：予算グループの指標トグル（当初予算・補正後予算・決算・歳入・歳出・市税・
  地方交付税・国庫支出金）と1人当たり予算・決算額（算出値）を追加。既存の補正後予算比較・表は維持。
- `/compare/debt`：市債グループの指標トグル（発行額・残高2区分）を追加。既存の発行額比較・表は維持。
  1人当たり市債残高は元資料掲載値の列として既存表に追加（算出はしていない）。
- `/compare/funds`：基金グループの指標トグル（基金総額・財源調整用基金）を追加。既存の内訳積み上げ
  グラフ・表は維持。1人当たり基金残高は元資料掲載値の列として既存表に追加。
- `/compare/population`：`years`クエリパラメータへ変更のみ（既存の人口・世帯数推移表示は既に十分な
  ため大きな変更はしていない）。
- `/finance/budget`・`/finance/debt`・`/finance/funds`：各ページ未実装だった年度推移グラフ
  （当初予算・決算額・市債発行額・市債残高（一般会計）・基金総額）を追加。各年度カードに
  「この年度のタイムラインを見る」への導線を追加。
- `/finance`：「年度を比較する」（`/compare/finance`）・「この年度のタイムラインを見る」
  （最新年度の`/timeline/:year`）への導線を追加。
- `/timeline/:year`（新規）：市長任期・議員在籍（データ未整備のため現状は「確認できたデータは
  まだありません」）・財政指標19項目一覧・一般質問・議案条例請願陳情・政策を年度別に表示。
  年度が存在しない/該当データが無い場合も404にせず「該当データなし」を安全に表示する。
- `/timeline`：各年度カードに「この年度のタイムラインを見る」（`/timeline/:year`）への導線を追加。

### 変更したルート

- `/timeline/:year`（新規、indexable）。archiveFiscalYearsに登録されている年度（2021〜2026）分を
  サイトマップ・プリレンダリング対象に自動追加（`scripts/lib/public-routes.mjs`の
  `getIndexableRoutes()`にループを追加、`loadData()`へ`archiveMayorTerms`を追加）。
- `/compare/finance`・`/compare/budget`・`/compare/debt`・`/compare/funds`・`/compare/population`の
  クエリパラメータを`?items=`から`?years=`へ変更（例：`/compare/finance?years=2024,2025,2026`）。
  未pushのため外部リンク互換性への影響はない。`/compare/mayors`・`/compare/policies`は
  年度比較ではないため`?items=`のまま変更していない。

### 実装内容（共通基盤）

- `src/lib/archiveFinanceMetrics.ts`（新規）：19指標のレジストリ（キー・ラベル・単位・グループ・
  グラフ種別line/bar・定義注記・フォーマット関数・値取得関数）。市債残高は一般会計/普通会計地方債の
  2区分を別指標として分離（「定義が異なるため単純比較できません」の原則に沿う）。
  財源調整用基金は「単独の財政調整基金の金額ではない」ことを定義注記に明記。
- `src/lib/archivePerCapita.ts`（新規）：`computePerCapitaYen()`（同一年度の確認済み人口でのみ算出、
  金額・人口いずれかnullまたは人口0以下ならnullを返す）。`describePerCapita()`で算式・分子・分母・
  使用人口年度・丸め方・「当サイトによる算出値」である旨を1行の説明文にまとめる。
- `src/components/finance/FinanceMetricSection.tsx`（新規）：1指標分のグラフ（line/bar自動選択）＋
  数値表（年度・値・単位・定義・確認状況・出典）＋出典表示をまとめた共通部品。折れ線グラフは
  未確認（null）年度を描画対象から除外し、除外した年度を注記で明示（0として描画しない）。
  比較ページ（2〜4年度選択）・トレンドページ（全年度）の両方で同じ部品を使う。
- `src/components/compare/CompareSourceNotice.tsx`：出典組織・ページ番号・公表日・取得日・単位の
  表示を追加（既存の出典URL・確認状況表示は維持）。
- `src/lib/archiveTimeline.ts`：`fiscalYearOfIsoDate()`をexport化、`mayorTermsInFiscalYear()`・
  `memberTermsInFiscalYear()`（任期が指定会計年度と重なるかを判定）を追加。
  `buildFiscalYearEvents()`内の比較リンクを`?items=`から`?years=`へ修正（フェーズ9Aの実装漏れ）。
- `src/lib/archiveCouncilDocuments.ts`：`documentPath()`（documentTypeに応じた詳細ページパスの
  組み立て）を追加。
- `src/types/compare.ts`：`CompareSourceNoticeItem`に`unit?`を追加。

### 一人当たり数値

- 予算・決算額：当サイトが `金額（円）÷ 人口（人）` で算出（円未満四捨五入）。分母は同一年度の
  確認済み人口のみを使用し、他年度の人口で代替しない。算式・分子・分母・使用人口年度・丸め方・
  「当サイトによる算出値」である旨を明記し、元資料の1人当たり値と混同しないよう分離して表示。
- 市債残高・基金残高：元資料（財政状況資料集等）に既に1人当たり値として掲載されている
  `perCapitaYen`フィールドをそのまま表示し、当サイトでは算出していない（元資料側の分母・算式が
  非公開のため）。現在のデータでは全年度null（確認中）。

### 財政定義の分離

- 当初予算／補正後予算／決算、市債発行額／市債残高（一般会計・普通会計地方債を別指標化）、
  基金総額／財源調整用基金を、指標レジストリ・比較表・グラフのいずれでも常に別項目として扱い、
  各ページの案内文で「定義が異なるため単純比較できません」を明示。

### 欠損状態

- 0・確認中・出典未登録・要確認・定義不一致を、既存の`archiveVerificationStatusLabel`・
  「確認中」表示・`CompareSourceNotice`の「出典未登録」で区別。欠損項目があっても他の比較項目・
  他年度は表示を継続する（FinanceMetricSectionは指標単位・CompareTableは行単位で独立）。

### 出典表示

- `CompareSourceNotice`拡張により、比較表・グラフ直下・`/timeline/:year`のいずれでも
  資料名・出典組織・URL・ページ番号・公表日・取得日・確認状況・定義・単位を確認できる。

### validate:data

- `archivePolicies.relatedFiscalYears`・`archiveCouncilDocuments.fiscalYear`が
  `archiveFiscalYears.json`に存在しない場合の警告チェックを追加（`/timeline/:year`に反映されない
  ことを検出するため）。現状のデータでは警告0件（すべて範囲内）。
  金額・比率の非負／範囲チェック、出典必須チェック等は既存のvalidate-data.mjsで既に網羅されていた
  ため、今回は新規データファイルを追加していないこともあり大規模な追加は行っていない。

## 検証結果

- `npm run validate:data`：errors=0, warnings=1257（既存警告のみ、新規警告0件）
- `npm run typecheck`：エラーなし
- `npx oxlint`：クリーン
- `npm run build`：911ページ生成（前回905→+6、`/timeline/2021`〜`/timeline/2026`）、prerender成功
- `npm run validate:seo`：failures=0, warnings=0
- 生成HTML確認：`/timeline/2026`（市長任期・財政指標表・一般質問見出し・出典の公表機関表示を確認）、
  `/finance/budget`・`/finance/debt`・`/finance/funds`（新規トレンドグラフの見出しを確認）、
  `/finance`（新規導線リンクを確認）、`/compare/finance`（`robots: noindex, follow`を確認）を
  それぞれgrepで確認済み。

## 未実施・次回への申し送り

- **ブラウザでの実機確認は未実施**（Chrome拡張が本セッションでも未接続）。375/390/768/1280pxでの
  レイアウト崩れ・グラフのダークモード表示は次回セッションで確認が必要。
- 実データが依然として少ない（市債残高・基金一部区分・財政指標のほとんどが単年度または未確認）。
  今回追加した19指標・1人当たり計算・年度別タイムラインの多くは「確認中」「確認できたデータは
  まだありません」表示になる（バグではなく、データ未収集によるもの）。
- 議員在籍・会派・役職（`archiveMemberTerms.json`・`archiveMemberAffiliations.json`）は空配列のため、
  `/timeline/:year`の該当セクションは常に「確認できたデータはまだありません」。データが追加され
  次第、`memberTermsInFiscalYear()`は自動的に反映する（コード変更不要）。
- `/themes/:slug/timeline`連携（フェーズ8で残した導線コメント）は未実装。
- `/compare/members`等、新規の人物比較ページは未実装（フェーズ9C以降）。

## 既知の注意点・落とし穴（継続）

- **`npm run build`実行のたびに`src/data/siteUpdate.json`・`archiveAiCategoryCandidates.json`・
  `archiveRelationCandidates.json`・`adminReviewQueue.json`のタイムスタンプだけが更新される**。
  実データ変更を伴わない場合はコミットせず`git restore`で戻す（今回も実施）。
- `ArchiveDebt`・`ArchiveFund`の`sourceRefs`は型のトップレベルではなく`balance.sourceRefs`にネスト
  されている。
- 令和年→西暦の変換式：`西暦 = 2018 + 令和年`。会計年度は4月始まり（1〜3月は前年度扱い）。
- 比較ページの命名規則は`/xxx/compare`ではなく`/compare/xxx`。年度ベースの比較ページは
  `?years=`、市長・政策比較は`?items=`（歴史的経緯、統一していない）。
- 委員会マスタが存在しない（`committeeId`は1件も確認できていない）。
- `validate-seo.mjs`には`public-routes.mjs`とは独立したハードコードチェックが一部ある。

## 次セッション開始時の推奨手順

1. `git log --oneline -10`と`git status`で本メモと状態が一致しているか確認。
2. `npm run validate:data && npm run typecheck`で現状に問題がないか確認。
3. 可能であれば`/compare/finance`・`/timeline/2026`をブラウザで375px・390px・768px・1280pxで
   確認する（前回・今回とも未実施）。
4. フェーズ9C（市長・議員・政策比較の追加拡張、`/themes/:slug/timeline`連携等）に着手する場合は、
   ユーザーの詳細指示を確認する。

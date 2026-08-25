# 市長公約 令和8年度進捗資料の反映（独立タスク、2026-08-25）

## 一次資料

- URL：https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28741.pdf
- 資料名：「市長公約に関する取組み　令和8年度」
- 対象：延岡市長　三浦　久知
- 基準日：令和8年7月31日現在（2026-07-31）
- 全8ページ。`scripts/extract-pdf-text-pdfjs.mjs`でテキストレイヤーを抽出（8/8ページ成功）したうえで、
  Read（PDF画像表示）により全8ページを直接目視確認し、pdfjsのテキスト抽出順序が視覚的なレイアウト
  （複数ボックスにまたがる紙面構成）と一致しない箇所がないかを照合した。数値・日付・固有名詞は
  画像表示による目視確認を最終根拠とした（新規スクリプトの追加・実行、外部AI APIの追加はしていない）。

## Phase146：PDF解析結果概要

- ページ数：8
- 大分類（公約）数：4（公約1〜4、既存`mayorPromises.json`のcategories p1〜p4と一致）
- 個別公約（サブ公約）数：**14**（PDF上の色付きボックス単位で計上。公約1：3、公約2：3、公約3：3、
  公約4：**5**）
- 具体施策・事業数：33件（`src/data/mayorPromiseMeasures.json`として新規構造化）
- 数値データ（新規確認分）：自然体験活動2→5件、はらはらわくわく番外編2→4回、ふるさと教育推進事業
  A部門6校・B部門17校（ノベ☆スタ20件）・令和8年度申請小8/中2/義務教育1校、学力向上指導員15名、
  夏季食支援34食分（実績962名分）、アリーナ2026-04-18グランドオープン、地域商社令和9年度設立目標、
  避難所運営手順書8ヶ所、出張相談センター令和8年度全10回（6/18島浦10件・7/16土々呂伊形7件は実施済み）、
  RPA内製化研修4名、YEGワールドカフェ2026-07-09実施、佐伯市人事交流2026-04-01開始、リーグH公式戦
  2026-10-18開催決定　等、ユーザー提示の例示値も含めすべて実データと一致することを確認した。
- 新規事業：「NOBEOKAスクール・イノベーション事業」（令和8年度新規）
- 制度変更：「延岡市医療機関新規開業促進事業・医療機関事業承継支援補助金交付要綱」に事業承継支援を
  新規追加、令和8年度運用開始

## Phase147：既存公約DBとの差分監査

対象：`src/data/mayorPromises.json`（既存12件、referenceDate 2026-07-14、施政方針・6月補正予算・
市長公式サイト・広報のべおか2025年9月号/2026年4月号を出典として登録済み）

| PDF上のサブ公約 | 既存promiseId | 判定 | 備考 |
|---|---|---|---|
| 家庭環境に関わらず、全ての子どもが延岡の自然体験に参加できる仕組みを整えます。 | 1-1 | MATCH（PROGRESS_UPDATE） | promiseText完全一致 |
| 子どもひとりひとりの理解度に合わせた学びを実現します。 | 1-2 | MATCH（PROGRESS_UPDATE） | promiseText完全一致 |
| 市役所に「こども未来部」を設置し子育て支援を強化します。 | 1-3 | MATCH（PROGRESS_UPDATE） | 既存は「します」、PDF側「し」と句読点差程度、実質一致 |
| 地域商社を設立し、延岡の優れた農林水産物の販売強化を行います。 | 2-1 | MATCH（PROGRESS_UPDATE） | promiseText完全一致 |
| 愛宕山の魅力をさらに高めるカフェを誘致し、市民が集う拠点づくりと観光振興を図ります。 | 2-2 | MATCH（PROGRESS_UPDATE） | promiseText完全一致 |
| アスリートタウン延岡アリーナやのべおかwaiwaiスタジアムを核に、スポーツ合宿・大会の誘致を拡大します。 | 2-3 | **WORDING_CHANGED（NEEDS_REVIEW）** | 既存promiseTextは「アスリートタウン延岡アリーナや**西階野球場**を核に」。PDFは「**のべおかwaiwaiスタジアム**」。同一施設の別称・改称の可能性があるが当サイト側で断定できないため、既存promiseTextは変更せず、progressHistoryの注記で両表記を併記した。 |
| 診療所やクリニックの事業承継を支援し、地域の身近な医療を守ります。 | 3-1 | MATCH（PROGRESS_UPDATE） | promiseText完全一致 |
| 津波対策と福祉避難体制を強化し、避難所環境の質を高めることで、**市民の生活を守ります**。 | 3-2 | **WORDING_CHANGED（NEEDS_REVIEW）** | 既存promiseTextは「…**市民の命を守ります**。」。既存promiseTextは変更せず、progressHistoryの注記で両表記を併記した。 |
| 豊富な経験を持つシニア世代が地域で力を発揮できる仕組みを整えます。 | 3-3 | MATCH（PROGRESS_UPDATE） | promiseText完全一致 |
| 若手職員によるプロジェクトチームを発足させます。 | 4-1 | MATCH（PROGRESS_UPDATE） | 既存「発足します」、PDF「発足させます」の軽微な表記差。実質同一と判断し既存は変更せず。 |
| 民間人材と市職員がチームを組み仕組みを作り、新たな政策創出を実現します。 | 4-2 | MATCH（PROGRESS_UPDATE） | 既存「チームを組む仕組みをつくり」、PDF「チームを組み仕組みを作り」の軽微な表記差。既存は変更せず。 |
| 市民が身近な場所で気軽に悩みを相談できる体制を整えます。 | 4-3 | MATCH（PROGRESS_UPDATE） | promiseText完全一致 |
| 北方・北浦・北川・島浦の支所に地域活性化専門の職員を配置し、個性ある地域づくりを推進します。 | （既存なし） | **NEW_MEASURE** | 既存12件に対応レコードなし。新規promiseId「4-4」として追加。 |
| 職員の多様な働き方を推進します。 | （既存なし） | **NEW_MEASURE** | 既存12件に対応レコードなし。新規promiseId「4-5」として追加。 |

分類集計：MATCH（PROGRESS_UPDATE扱い）＝10件、WORDING_CHANGED（NEEDS_REVIEW）＝2件、NEW_MEASURE＝2件、
NOT_FOUND_IN_NEW_DOCUMENT＝0件（既存12件すべてPDF内に対応する記述を確認できた）。

### 重要：既存公約は削除・上書きしていない

- 既存12件の`promiseText`・`progressSummary`・`relatedBudget`・`relatedBill`・`notes`は**一切変更していない**。
- 新しい情報はすべて`progressHistory[]`（既存の型`MayorPromiseHistoryEntry`、これまで全件未使用だった
  既存フィールド）への**追記**として反映した（既存の「確認できた時点のみ追加する」設計方針に準拠）。
- `evidenceItems[]`へも新資料への参照を追記のみ（既存参照は削除していない）。
- WORDING_CHANGED 2件は、既存promiseTextを書き換えず、progressHistoryのsummary内で両表記を明記して
  人間の確認を促す形にした（NEEDS_REVIEW）。

## Phase148：進捗データ構造化

- `src/data/mayorPromises.json`：既存12件の`progressHistory[]`へ2026-07-31付けエントリを追加
  （statusLabel・summary・sourceTitle・sourceUrl必須、`validate-data.mjs`の既存検証をクリア）。
  新規promiseId「4-4」「4-5」を追加（計14件）。`documents[]`へ新資料
  （key: `r8_promise_progress_0731`）を追加。
- `src/data/mayorPromiseMeasures.json`（新規）：33件の個別施策・事業スナップショット。
  `measureId`/`promiseId`/`categoryId`/`measureTitle`/`status`/`fiscalYear`/`snapshotDate`/
  `previousYearResult`/`currentYearResult`/`currentYearPlan`/`futureTarget`/`quantitativeValue`/
  `quantitativeUnit`/`sourceUrl`/`sourcePage`/`sourceTitle`/`trustLevel`/`notes`。
  `trustLevel`は全件`"PRIMARY"`（既存`ArchiveSourceTrustLevel`をそのまま再利用、独自値は新設していない）。
- `status`（COMPLETED/IN_PROGRESS/PLANNED/CONTINUING/PREPARING/NOT_ASSESSABLE）は、PDF本文に
  明記された事実のみから判定した。「検討しています」はPREPARING、「予定」はPLANNED、
  「運用開始」は当該施策自体のIN_PROGRESS（公約全体の達成を意味しない）とし、根拠のない
  COMPLETED判定はしていない（達成率は一切算出していない）。

### status内訳（33件）

COMPLETED＝2件（アスリートタウン延岡アリーナ供用開始、佐伯市人事交流）、IN_PROGRESS＝16件、
CONTINUING＝9件、PLANNED＝3件、PREPARING＝3件、NOT_ASSESSABLE＝0件

## Phase149：UI更新

- `src/pages/MayorPromiseDetailPage.tsx`（`/mayor/policy-progress/:id`）：
  - 既存フィールド`progressHistory`は型定義済みだったが全件未使用だったため、UIの「進捗履歴」
    セクションは今回のデータ追加により**自動的に**表示されるようになった（コード変更不要）。
  - 新設「公約の現在地（個別の取組み）」セクションを追加し、`mayorPromiseMeasures.json`から
    該当promiseIdの施策を一覧表示（施策名・状況バッジ・前年度実績・今年度実績・今後の予定・
    将来目標・数値・出典リンク・基準日）。市独自の評価とポータル独自評価の混同を避けるため、
    セクション末尾に「当サイト独自の達成率・採点ではありません」の注記を常時表示。
  - 新規`src/lib/mayorPromiseMeasureStatus.ts`・`src/components/mayor/MayorPromiseMeasureStatusBadge.tsx`
    を追加し、英語の内部区分（COMPLETED等）を市民向け日本語ラベル（完了／実施中／予定／継続実施中／
    準備中／評価不能）へ変換して表示（色だけでなく文字・アイコンでも区別）。
  - 個別公約詳細ページ（`/mayor/policy-progress/:id`）・一覧ページ（`/mayor/policy-progress`）は
    `mayorPromises.json`の`promises`配列を動的に走査する既存設計のため、`scripts/lib/public-routes.mjs`
    も含めコード変更なしで新規2件（4-4/4-5）のルート・サイトマップ・SEOメタデータが自動生成された
    （build時にprerenderルート数が2240→2242件に増加したことを確認）。
- `MayorPage.tsx`の「個別公約数」スタット（`promisesData.promises.length`）は既存の動的算出のため
  コード変更なしで自動的に12件→14件へ更新される。
- 達成率：PDFに公式な「達成率○％」の記載は無く、当サイトの`mayorPromises.json`/
  `mayorPromiseMeasures.json`のいずれにも達成率フィールドは存在しない。今回、新規の達成率算出
  ロジックは一切追加していない（既存方針を維持）。

## Phase150：履歴・出典・整合性監査

- 選挙時公約（promiseText）：既存14件すべてで保持を確認（14-2件の新規分を除く既存12件は無改変）。
- 2026-07-31進捗：全14件の`progressHistory`（新規2件は`referenceDate`自体が2026-07-31）として
  別スナップショットで存在することを確認。
- 過去snapshot：既存12件の`progressHistory`は元々空だったため消えたものはない（追加のみ）。
- 新旧比較：詳細ページの「進捗履歴」セクションで、日付降順に表示され新旧比較が可能なことを確認
  （既存UIロジック、コード変更なし）。
- 出典：今回追加した全レコード（`progressHistory`新規12件・新規promiseId2件・`mayorPromiseMeasures.json`
  33件）が`sourceUrl`（`https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/28741.pdf`）・
  `sourceTitle`・`snapshotDate`（または`date`）・`trustLevel`（測定データ33件は"PRIMARY"）を
  保持していることを`validate-data.mjs`で機械検証済み（0件漏れ）。
- 数値の単位取り違え検査：件／回／校／名／食分／人／ヶ所／名分の単位を、原文の記載どおり
  `quantitativeUnit`へそのまま転記し、独自の単位変換・合算は行っていない
  （例：夏季食支援は「34食分」と「実績962名分」を別々の値として記録し、混同していない）。

## Phase151：検証・本番反映

`validate:data`（errors=0 warnings=40、既存基準から変化なし）／`validate:sources`（errors=0
warnings=15 info=66、既存基準から変化なし）／`validate:completeness`（errors=0）／
`validate:freshness`（errors=0）／`typecheck`（clean）／`lint`（clean）／`test`（26/26）／
`build`（2242/2242ルート prerender、`validate:seo` 2243ページ failures=0 warnings=0、
`validate:content` 2243ページ errors=0 warnings=0）すべて成功。詳細はTASKS.mdのTASK-172参照。

# データ更新後の品質チェック手順

延岡市政見える化ポータルの `src/data/*.json` を編集する人（人手・AIエージェント問わず）向けの
チェックリストです。データ追加・修正のたびに、コミット前に実行してください。

標準的な作業の流れは次のとおりです。

```
調査 → 一次資料確認 → データ登録 → quality check → build → （必要なら）実画面確認 → commit → push
```

## 1. 基本フロー（必須）

データを1件でも追加・修正したら、必ず次の順に実行します。

```bash
npm run validate:data   # データ構造・必須項目・参照整合性の検証
npm run typecheck       # TypeScriptの型検証
npm run lint             # oxlintによる静的解析
npm run build             # 本番ビルド（generate:*・validate:seo・validate:content等を含む）
```

いずれか1つでもエラー（`[ERROR]` や非ゼロ終了コード）が出た場合は、**その原因を解消してから**
コミットしてください。

## 2. 統合コマンド（`npm run quality:check`）

上記に加えて、`src/data`全体を横断する整合性チェック（`scripts/qa-checks/`）もまとめて実行する
統合コマンドです。`&&`連結と違い、**1つが失敗しても他のチェックを止めずに最後まで実行**し、
最後にPASS/WARNING/FAILの一覧を表示します。

```bash
npm run quality:check
node scripts/quality-check.mjs --skip-build   # buildを省略して素早く確認したい場合
```

`validate:data`・`typecheck`・`lint`・`build`の失敗はFAIL（要修正・コミット不可）、
`scripts/qa-checks/`配下の横断監査群は現時点ではWARNING（要レビューだがビルドは止めない）
という段階的な運用です。

## 3. 横断監査スクリプト一覧（`scripts/qa-checks/`）

個々のファイルの構造は`validate:data`が検証しますが、**ファイルをまたいだ整合性**
（重複ID、参照切れ、出典の網羅性、財政データの桁ズレ、任期の重複など）は
`scripts/qa-checks/`配下のスクリプト群で個別に確認できます。すべて**読み取り専用**で、
`src/data`や他のファイルには一切書き込みません。出力（`reports/qa-checks/_out-*.json`）は
人手レビュー用の候補一覧であり、機械的に自動修正するものではありません。

| チェック内容 | スクリプト | 目的 |
|---|---|---|
| ID重複（ファイル内・ファイル横断） | `check-duplicate-ids-global.mjs` | 同じIDが無関係な複数ファイルで衝突していないか |
| 外部キー参照切れ（孤立ID） | `check-orphan-foreign-keys.mjs` | memberId/mayorId/sessionId等が実在するIDを指しているか |
| 出典（sourceRefs）カバレッジ | `check-source-refs-coverage.mjs` | ファイル・カテゴリ別に出典を持つレコードの割合を可視化 |
| status語彙の棚卸し | `check-completeness-status-usage.mjs` | CompletenessStatus語彙とsrc/data内のstatus系フィールドの混線がないかの点検材料 |
| 財政データの単位異常・前年比異常 | `check-finance-unit-anomalies.mjs` | 円/千円等の桁ズレ入力、不自然な前年比変動の検出 |
| 任期重複・任期逆転 | `check-term-overlaps.mjs` | 同一人物の在任期間が重複・逆転していないか |
| 検索インデックス漏れ・更新履歴の並び順 | `check-search-index-and-updates-order.mjs` | searchIndex.jsonの母数カバレッジ、updateHistory.jsonの日付降順維持 |
| 一覧件数と詳細ページ生成数の整合 | `check-list-vs-detail-count.mjs` | `npm run build`後、dist/の詳細ページ数とデータ件数を突き合わせ（要build） |

個別に実行する場合：

```bash
node scripts/qa-checks/check-duplicate-ids-global.mjs
node scripts/qa-checks/check-orphan-foreign-keys.mjs
node scripts/qa-checks/check-source-refs-coverage.mjs
node scripts/qa-checks/check-completeness-status-usage.mjs
node scripts/qa-checks/check-finance-unit-anomalies.mjs
node scripts/qa-checks/check-term-overlaps.mjs
node scripts/qa-checks/check-search-index-and-updates-order.mjs
npm run build   # 以下はdist/が必要
node scripts/qa-checks/check-list-vs-detail-count.mjs
```

### 既知の誤検知（false positive）

初版のため、以下のような誤検知が残っています。値そのものの誤りではなく、スクリプト側の
判定ロジックの粗さによるものです。修正を急ぐより、まず利用しながら精度を上げる方針とします。

- `check-duplicate-ids-global.mjs`：各人物の`career`配列内で使われるローカルな連番ID
  （`c1`・`c2`…）を、サイト全体で一意であるべきIDと誤認してcrossFileCollisionsに計上する。
- `check-completeness-status-usage.mjs`：`status`という名前のフィールドを一律に
  `CompletenessStatus`語彙と比較するため、無関係な別の型（例：条例の`effectStatus`、
  質問収集状況の`status`）の正当な値まで「疑わしい値」として拾ってしまう。
- `check-term-overlaps.mjs`：ある期間の終了日と次の期間の開始日が同一日（同日中の交代）の
  ケースを「重複」として計上する（本来は隣接として扱うべき境界条件）。

## 4. 「0件」表示の扱いについて

「収録0件」を画面に表示してよいのは、一次資料を確認した上で**確認済み0件**
（`src/lib/completeness.ts`の`confirmed_zero`）の場合のみです。単に「まだ集計・収集していない」
状態で0件と表示すると、市民に「本当に無い」と誤解される恐れがあります。

`scripts/site-completeness-audit.mjs`は現在、生成HTML内の「0件」という文字列の出現数を
集計するに留まっており、その0件表示が`confirmed_zero`に基づくものかどうかまでは判定して
いません。将来的な拡張案：

- 「0件」という文字列が出現したルートについて、そのページが参照しているデータソースを
  ソースコード側から特定し、`status !== "confirmed_zero"`なのに「0件」という文言が出ている
  箇所を機械的に洗い出す。
- 完全な自動化が難しい場合は、最低限「0件」表示箇所の一覧とその周辺テキスト（前後100文字）を
  出力し、「未収集」「整備中」等の説明文が併記されているかを人手で確認できるようにする。

## 5. よくある失敗パターン

- **母数（totalKnown）を推測で埋めた** → 公式資料で確認できない場合は必ず`null`。
- **0件を「未確認」の意味で使った** → `confirmed_zero`以外は0件と表示しない。
- **金額の単位を書き間違えた（円/千円混同）** → `check-finance-unit-anomalies.mjs`で前年比異常として検出できる場合がある。
- **同じ人物の在任期間が重複・逆転している** → `check-term-overlaps.mjs`で検出できる場合がある。
- **新しいデータファイルを追加したが、重複ID・参照整合性チェックを個別に書き忘れた** →
  `check-duplicate-ids-global.mjs` / `check-orphan-foreign-keys.mjs`が保険として拾える場合がある
  （ただし専用の検証を`scripts/validate-data.mjs`に書くことが望ましい。横断監査はあくまで保険）。

## 6. 注意事項

- `scripts/qa-checks/`配下のスクリプトは初版であり、誤検出（false positive）を含みます
  （上記「既知の誤検知」参照）。誤検知の割合を見ながら、warning運用からerror運用への
  段階的な引き上げを検討してください。
- `disputed`・`unconfirmed`・`not_collected`・`onsite_required`・`library_only`等の状態は、
  資料の限界を正確に示す情報であり、件数を減らすべき「エラー」ではありません。警告を
  減らすためだけにvalidationを削除したり閾値を緩めたりしないでください。

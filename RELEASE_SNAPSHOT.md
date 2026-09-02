# 公開版 Release Snapshot（安定版の固定記録）

このファイルは、Phase197〜200 で安定版として固定した時点の記録です。
機械可読版は `reports/release-snapshot.json`（生成: `node scripts/generate-release-snapshot.mjs --deploy-id <id>`）。

以後は**毎回の全データ再監査を行いません**。新しい公開資料が出たときだけ、下記「日常運用フロー」に戻します。

## リリース識別

| 項目 | 値 |
| --- | --- |
| release commit | `cf29d4eb8a0c2c277a0e45c2d3f167031bdec508`（`cf29d4e`） |
| commit 日時 | 2026-09-02T13:15:46+09:00 |
| production deploy ID | `7b162a77-415b-48ec-ab9e-3515d5d820e5` |
| production URL | https://nobeoka-shisei-portal.pages.dev/ |

## 件数

| 項目 | 件数 |
| --- | --- |
| 議案 | 1,177 |
| 一般質問（構造化データ） | 27 |
| 会議録の発言レコード | 419 |
| 質問項目 | 1,568 |
| 現職議員 | 26 |
| 議員プロフィール（元議員含む） | 84 |
| 歴代市長 | 14（任期レコード 30） |
| 市長公約 | 14 |
| 市政年表イベント | 217 |
| 更新履歴エントリ | 137 |
| 会期 | 61 |
| 検索索引エントリ | 2,276（うち固有URL 1,916） |
| 出典URL（重複除去） | 5,488 |
| プリレンダリング済みページ | 2,270 + `404.html` |
| route template | 79 |
| sitemap 掲載URL | 2,201 |

`sitemap` との差 69 件の内訳: `/members/fm*` 58件（canonical は `/members/former/:slug`）+ `noindex` 11件（`/compare/*`・`/bills/compare`・`/koho-search`・`/search`）。

## 品質 baseline（すべて 0 が安定版の条件）

| 指標 | 値 |
| --- | --- |
| page 間件数矛盾 | 0 |
| broken internal link | 0（2,270ページ / リンク先2,335種類を検査） |
| production visual error | 0（14ページ × 3viewport = 42件） |
| horizontal overflow | 0px |
| console error | 0 |
| test failures | 0（227 checks / 24スクリプト） |
| validate:data errors | 0 |
| validate:seo failures | 0（2,271ページ） |
| validate:content errors | 0（2,271ページ） |

### 別管理（0 にはしない）

| 項目 | 件数 | 理由 |
| --- | --- | --- |
| 既存データ warning | 21 | 一次資料の不足に起因し、コードでは解消できない。内訳は会期要約 `partially-verified` 19件 / 市長任期の空白13区間 1件 / 財政年度の欠番24年度 1件 |
| 外部リンク切れ | 1 | `archiveMayorTerms.json` の Wikipedia「仲田又次郎」が 404。**未修正**。差し替え先の一次資料が確認できていないため推測で置き換えない |

## 人手対応が必要な項目

`src/data/blockedTaskClassification.json` が管理台帳（全15件）。

| status | 件数 | 意味 |
| --- | --- | --- |
| `MANUAL_REVIEW` | 8 | 人的確認・現地調査が必要 |
| `RESEARCH_EXHAUSTED` | 2 | オンライン調査を尽くした。現地資料が必要 |
| `WAITING_EXTERNAL` | 2 | 会議録等の公開待ち（自動巡回で反映） |
| `COMPLETED` | 3 | 解決済み |

**人手対応が必要 = 10件**（`MANUAL_REVIEW` + `RESEARCH_EXHAUSTED`）。対象テーマ:
市長任期13区間 / 政務活動費 / 費用弁償 / 会期資料 / 議会事務局照会 / 図書館資料確認。

これらは**オンライン再調査で解決しません**。コード変更によって「解決済み」に変えないこと。

> 補足: `UNR-035` のような ID はデータの注記本文で参照されているだけで、構造化された UNR 一覧テーブルは存在しません。実質的な管理台帳は上記 `blockedTaskClassification.json` です。

## 日常運用フロー

新しい公開資料が出たときだけ実行します。**大規模な全データ再監査は毎回行いません。**

```
自動更新 → 検証 → 差分 → GREEN なら反映
```

1. **自動更新**: `.github/workflows/update-council-documents.yml`（日次）が会議録等を巡回。
2. **検証**:
   ```
   npm run validate:data && npm run typecheck && npm run lint && npm test && npm run build
   ```
   `build` の末尾で `validate:seo` / `validate:content` / `check:bundle-size` / `check:internal-links` が動きます。
3. **差分**: `node scripts/generate-release-snapshot.mjs` を実行し、`reports/release-snapshot.json` を前回と比較。件数が動いた項目と、その根拠となる一次資料が対応しているかを確認。
4. **GREEN 判定**: 上表の品質 baseline がすべて維持されていること。新規 error 0 / 新規 warning 0。
5. **反映**: commit → push → Cloudflare Pages の自動デプロイ → `npm run smoke:production`。

### 監査スクリプト（必要なときだけ実行）

| コマンド | 用途 |
| --- | --- |
| `npm run smoke:production` | 本番の実レンダリング確認（14ページ × 3viewport） |
| `npm run audit:responsive` | レスポンシブ・横スクロール・突出の実描画監査 |
| `npm run audit:tap-targets` | タップ領域の WCAG 2.2 AA / 2.1 AAA 判定 |
| `npm run audit:production-cache` | 本番のキャッシュヘッダーと鮮度の実測 |
| `npm run analyze:bundle` | チャンク別モジュール内訳 |

`audit:*` と `smoke:production` は `playwright-core` とローカル Chromium を使います。
アクセシビリティ監査（`scripts/audit-accessibility.mjs`）の再実行には
`npm i --no-save playwright @axe-core/playwright` が必要です（Cloudflare Pages のビルドを重くしないため package.json には入れていません）。

## 既知の残課題（安定版として許容、次回以降の候補）

1. **ビルド非再現性**: 生成データの `generatedAt`（ビルド時刻）により、内容が同一でも毎回チャンクハッシュが変わり、再訪ユーザーが同じ内容の JS（845KB）を再取得する。値は画面表示にも使われるため要検討。
2. **タップ領域**: ヘッダー（803件）の 44px 化は `top-[57px]` を使う6ページの sticky バー同時変更が必要。パンくず（423件）の 24px 化は全ページ +約8px。いずれも WCAG 2.2 AA は充足済みで、AAA のみ未達。
3. **`/timeline` のデータ文面**: 一部の説明文に `bondRedemptionFundYen` 等の内部フィールド名が混入している（表示の折り返しは対応済み、文面自体はデータ側の課題）。
4. **検索**: 「市議会議員」の上位が選挙結果に偏る（語義的には妥当）。`/history`・`/updates` に項目アンカーが無いため同一URL結果を統合表示している。
5. **末尾スラッシュ**: 308リダイレクトが発生（sitemap・canonical は末尾スラッシュなし）。クロール時に1ホップ増える。
6. **スクリーンリーダー実機確認**（NVDA/VoiceOver/TalkBack）は未実施。自動 a11y 監査 0件は WCAG 完全準拠を意味しない。

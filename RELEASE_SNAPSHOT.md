# 公開版 Release Snapshot（安定版の固定記録）

このファイルは、Phase197〜200 で固定し、Phase201〜229 の品質改善を反映した安定版の記録です。
機械可読版は `reports/release-snapshot.json`（生成: `node scripts/generate-release-snapshot.mjs --deploy-id <id>`）。

以後は**毎回の全データ再監査を行いません**。新しい公開資料が出たときだけ、下記「日常運用フロー」に戻します。

## リリース識別

| 項目 | 値 |
| --- | --- |
| release commit | `749175c`（Phase229） |
| production deploy ID | `2b32d46a-a5b9-4a8e-bc35-c40dd48a1b69` |
| production URL | https://nobeoka-shisei-portal.pages.dev/ |

このファイルを後から更新するコミットは記録の修正であり、公開内容の変更ではありません。
スナップショットは「自分自身のコミット」ではなく「記述対象のリリース」を指します。

### Phase200 からの件数差分（いずれも一次資料に基づく）

| 項目 | Phase200 | Phase229 | 理由 |
| --- | ---: | ---: | --- |
| 議案 | 1,177 | 1,178 | 議案第48号（工事請負契約、令和8年9月定例会、原案可決 2026-08-28）を市議会公式資料から追加 |
| 会期 | 61 | 62 | 令和8年9月定例会を追加 |
| 市政年表イベント | 217 | 219 | 宮崎県主催だが延岡市の関与が資料に明示された2件（防災実践塾・円卓トーク） |
| 更新履歴エントリ | 137 | 143 | Phase202・208・225 の記録 |
| 検索索引エントリ | 2,276 | 2,285 | 上記の追加分が索引化されたもの |
| 出典URL（重複除去） | 5,488 | 5,494 | 新規に登録した一次資料の出典 |

**政策分野4・個別公約14・個別施策33・現職議員26 は不変**です。
議案の増加は令和8年9月定例会の新規議案であり、既存1,177件は変わっていません。

## 件数

| 項目 | 件数 |
| --- | --- |
| 議案 | 1,178 |
| 一般質問（構造化データ） | 27 |
| 会議録の発言レコード | 419 |
| 質問項目 | 1,568 |
| 現職議員 | 26 |
| 議員プロフィール（元議員含む） | 84 |
| 歴代市長 | 14（任期レコード 30） |
| 市長公約 | 14 |
| 市政年表イベント | 219 |
| 更新履歴エントリ | 143 |
| 会期 | 62 |
| 検索索引エントリ | 2,285（うち固有URL 1,917） |
| 出典URL（重複除去） | 5,494 |
| プリレンダリング済みページ | 2,272 + `404.html` |
| route template | 79 |
| sitemap 掲載URL | 2,203 |

`sitemap` との差 69 件の内訳: `/members/fm*` 58件（canonical は `/members/former/:slug`）+ `noindex` 11件（`/compare/*`・`/bills/compare`・`/koho-search`・`/search`）。

## 議案1,178件の説明状況（Phase206-207、Phase225で1件追加）

「本文を確認できた＝説明を書ける」ではない。原文に個別の提案理由が無い議案が実在するため、
その事実を市民向けに表示し分ける（内部コードは画面に出さない）。

| 状態 | 件数 | 意味 |
| --- | ---: | --- |
| 詳細説明あり | 652 | 一次資料に基づく個別の説明を掲載 |
| 共通説明のみ | 146 | 複数議案が一括で提案説明された。共通説明を原文引用で掲載 |
| 追加確認必要 | 199 | 人事・議員提出等で機械的な整理の対象外、または個別記載の有無が未記録 |
| 構造化不足 | 129 | 会議録は公開済みだが本文の確認・整理が未了 |
| 個別の提案理由なし（確認済み） | 27 | 一次資料を確認し、この議案固有の提案理由が無いことを確認 |
| 資料不足 | 25 | 会議録が未公表（令和8年度分） |
| **合計** | **1,178** | |

「個別の提案理由なし（確認済み）」27件は「未調査」ではない。追加調査では解決しない。

## 情報源の信頼階層（Phase224-229）

調査対象を延岡市・延岡市議会に加え、宮崎県・宮崎県議会・宮崎日日新聞・夕刊デイリーへ拡張した。
**報道は一次資料と同格に扱わない。**

| 階層 | 対象 | 扱い |
| --- | --- | --- |
| LEVEL A / PRIMARY | 延岡市・延岡市議会・宮崎県・宮崎県議会・国/省庁・NDL・官報公報・公式PDF | 事実の確定に使える |
| LEVEL B / SECONDARY | 宮崎日日新聞・夕刊デイリー等の報道 | **単独で金額・日付・議決結果・人名・公約達成・財政数値・議案状態を確定しない**。一次資料を探す手掛かり／論点の補助／報道された事実の記録 |
| LEVEL C / DISCOVERY ONLY | 検索snippet・SNS・まとめ・個人ブログ | 発見のみ。根拠にしない |

画面では `src/lib/sourceMedium.ts` が報道・事典に「一次資料ではありません」と文字で明示する
（データは変更せず、表示直前に判定）。`sourceType: "news"` の実データは0件。

### 混入防止（Phase226 で確認）

- 宮崎県の予算額を延岡市の財政データへ入れない（県9月補正の金額は `src/data` に0件）
- 宮崎県議会のデータを延岡市議会のデータへ入れない（`councilSessions`・`billVotes`・`generalQuestions` への県参照は各0件）
- 県の資料は「延岡市の関与・負担・共同実施が資料に明示されているもの」だけ候補化する
- `CivicTimelineEvent` の型コメントに恒久ルールとして明記済み

### 新聞2紙の制約（重要）

`the-miyanichi.co.jp` と `yukan-daily.co.jp` は **robots.txt で Claude 系クローラーを全面 Disallow** している。
記事取得・サイト内検索はできないため、**この2紙の自動更新監視はエージェント単独では実現できない**。
継続するなら「人手のブラウザ確認で見出し・掲載日を台帳へ入力 → エージェントは市公式側の一次資料探索のみ担当」という分担になる。
調査台帳は `reports/phase227-news-discovery-ledger.json`。

## 品質 baseline（すべて 0 が安定版の条件）

| 指標 | 値 |
| --- | --- |
| page 間件数矛盾 | 0 |
| broken internal link | 0（2,272ページ / リンク先2,338種類を検査） |
| production visual error | 0（27ページ × 7viewport = 189件。旧任期/現任期の質問詳細各3件・予算議案5件・通常議案5件を含む。320/375/390/430/768/1280/1440px で実レンダリング確認） |
| horizontal overflow | 0px |
| console error | 0 |
| test failures | 0（365 checks / 31スクリプト） |
| validate:data errors | 0 |
| validate:seo failures | 0（2,273ページ） |
| validate:content errors | 0（2,273ページ） |

### 別管理（0 にはしない）

| 項目 | 件数 | 理由 |
| --- | --- | --- |
| 既存データ warning | 21 | 一次資料の不足に起因し、コードでは解消できない。内訳は会期要約 `partially-verified` 19件 / 市長任期の空白13区間 1件 / 財政年度の欠番24年度 1件 |
| 外部リンク切れ | 1（公開画面での露出は0） | `archiveMayorTerms.json` の Wikipedia「仲田又次郎」が 404。日単位の就任日を裏づける代替一次資料がリポジトリ内に無いため差し替えず、Phase209 で**非リンク化**し「リンク切れ・代替資料確認中」と表示。人物データと出典レコードは保持 |

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
| `node scripts/audit-screenreader-semantics.mjs` | accessibility tree による読み上げ意味構造の監査（追加インストール不要） |
| `npm run scan:era` | 実在しない元号年度（令和0・令和マイナス・NaN年 等）の全ページ走査。build 末尾でも実行 |
| `npm run verify:production` | 本番の実レンダリング確認（27ページ × 7viewport） |

`audit:*` と `smoke:production` は `playwright-core` とローカル Chromium を使います。
アクセシビリティ監査（`scripts/audit-accessibility.mjs`）の再実行には
`npm i --no-save playwright @axe-core/playwright` が必要です（Cloudflare Pages のビルドを重くしないため package.json には入れていません）。

## 既知の残課題（安定版として許容、次回以降の候補）

1. **ビルド非再現性**: 生成データの `generatedAt`（ビルド時刻）により、内容が同一でも毎回チャンクハッシュが変わり、再訪ユーザーが同じ内容の JS（845KB）を再取得する。値は画面表示にも使われるため要検討。
2. **タップ領域**: ヘッダー（803件）の 44px 化は `top-[57px]` を使う6ページの sticky バー同時変更が必要。パンくず（423件）の 24px 化は全ページ +約8px。いずれも WCAG 2.2 AA は充足済みで、AAA のみ未達。
3. **データ文面に残る内部識別子（方針として維持）**: Phase217 で 5,247件を分類し、出典追跡・監査履歴に必要な 2,842件は**意図的に維持**、参照が壊れていた1件のみ削除。表示側は `humanizeDataNote()` で変換し、一般公開本文への流出は `scripts/test-text-quality.mjs` のレイヤー3・3-2・3-3 が形（camelCase・パス・末尾数字ID等）でも検出して防ぐ。未着手は「注記本文に直接書かれた外部URL 39件の `sourceRefs` 構造化」のみ。
4. **検索**: 「市議会議員」の上位が選挙結果に偏る（語義的には妥当）。`/history`・`/updates` に項目アンカーが無いため同一URL結果を統合表示している。
5. **末尾スラッシュ**: 308リダイレクトが発生（sitemap・canonical は末尾スラッシュなし）。クロール時に1ホップ増える。
6. **スクリーンリーダー実機確認**（NVDA/VoiceOver/TalkBack）は**未実施**（`MANUAL_ACCESSIBILITY_CHECK_REQUIRED`）。この環境に NVDA は未インストールで、導入もしていない。Phase218 で accessibility tree による代替監査（12ページ・160件検出→0件）を実施したが、読み上げ音声の自然さ・ブラウズ/フォームモード切替・見出しジャンプの実使用感・点字出力・ライブリージョンの実発話などは実機でしか判定できない。自動 a11y 監査 0件は WCAG 完全準拠を意味しない。

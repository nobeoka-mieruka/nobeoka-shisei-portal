# 公開版 Release Snapshot（安定版の固定記録）

このファイルは、Phase197〜200 で固定し、Phase201〜242 の品質改善を反映した安定版の記録です。
機械可読版は `reports/release-snapshot.json`（生成: `node scripts/generate-release-snapshot.mjs --deploy-id <id>`）。

以後は**毎回の全データ再監査を行いません**。新しい公開資料が出たときだけ、下記「日常運用フロー」に戻します。

## リリース識別

| 項目 | 値 |
| --- | --- |
| release commit | `81aaf19`（Phase242） |
| production deploy ID | `17bc17a5-53f4-4a14-baad-2eca2505211b` |
| production URL | https://nobeoka-shisei-portal.pages.dev/ |

このファイルを後から更新するコミットは記録の修正であり、公開内容の変更ではありません。
スナップショットは「自分自身のコミット」ではなく「記述対象のリリース」を指します。

### Phase200 からの件数差分（いずれも一次資料に基づく）

| 項目 | Phase200 | Phase229 | 理由 |
| --- | ---: | ---: | --- |
| 議案 | 1,177 | 1,178 | 議案第48号（工事請負契約、令和8年9月定例会、原案可決 2026-08-28）を市議会公式資料から追加 |
| 会期 | 61 | 62 | 令和8年9月定例会を追加 |
| 市政年表イベント | 217 | 219 | 宮崎県主催だが延岡市の関与が資料に明示された2件（防災実践塾・円卓トーク） |
| 更新履歴エントリ | 137 | 149 | Phase202・208・225・235・236・239 の記録 |
| 検索索引エントリ | 2,276 | 2,292 | 上記の追加分が索引化されたもの |
| 出典URL（重複除去） | 5,488 | 5,530 | 新規に登録した一次資料の出典 |

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
| 更新履歴エントリ | 149 |
| 会期 | 62 |
| 検索索引エントリ | 2,292（うち固有URL 1,918） |
| 出典URL（重複除去） | 5,530 |
| プリレンダリング済みページ | 2,273 + `404.html` |
| route template | 79 |
| sitemap 掲載URL | 2,204 |

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

### 新聞サイトの扱い（正式方針）

`the-miyanichi.co.jp`（宮崎日日新聞）と `yukan-daily.co.jp`（夕刊デイリー）は
**robots.txt で Claude 系クローラーを全面 Disallow** している。
**両紙の robots.txt とサイト側のクロール方針を尊重し、自動クロール・自動収集の対象には追加しない。**

今後も `sourceLevel = SECONDARY / DISCOVERY` として扱い、次の経路で記事の存在を把握した場合にのみ、
**一次資料を探すための手掛かり**として使用する。

- 人による通常のブラウザ閲覧
- 正規に取得できる検索結果・記事メタデータ
- 公式サイトからの紹介
- 他資料からの記事参照

**禁止**: robots 制限の回避／自動巡回の強行／paywall 回避／新聞本文の大量保存／
新聞単独での市政データ確定／新聞単独での GREEN 自動本番反映。

重要案件を新聞で発見した場合の流れ:

```
新聞 → 延岡市・延岡市議会・宮崎県・宮崎県議会等の一次資料を探す → 一次資料で確認 → 確定
```

調査台帳は `reports/phase227-news-discovery-ledger.json`。

## 市民参加（パブリックコメント）（Phase239）

`src/data/publicComments.json` に5件。**状態は日付から推定せず**、延岡市の
「パブリックコメント条例 運用状況」ページのどの見出しの下に載っているかをそのまま転記する。

| 状態 | 件数 |
| --- | ---: |
| 意見募集中（`open`） | 2 |
| 結果公表済み（`result-published`） | 3 |

提出者数と意見数は市が別々に公表しているため `submitterCount` / `opinionCount` に分けている。
**未公表を0にしない** — `status !== "result-published"` で件数や `resultUrl` があると `validate:data` が error。
結果公表済みのうち1件は市が「意見が寄せられなかった」と公表しているため 0人・0件（推定の0ではない）。

## 議案の採決方法・付託委員会（TASK-004）

令和8年5月臨時会・6月定例会の会議録公開を受け、**議案24件の採決方法・付託委員会・会議録URLを
一次資料から確定**した（会議録原文の記述が根拠。推測なし）。

| 指標 | 変化 |
| --- | --- |
| voteMethod 確認 | 1,153 / 1,177 → **1,177 / 1,178**（99.9%） |
| committee 確認 | 1,153 / 1,177 → **1,177 / 1,178**（99.9%） |

**TASK-004 の status は `WAITING_EXTERNAL` のまま**。当初対象24件は解決したが、
同じ理由（会議録未公開）で `2026-09-gian-48`（令和8年9月定例会）が新たに残るため。
HUMAN_ACTION_REQUIRED は10件から減らしていない。

## 品質 baseline（すべて 0 が安定版の条件）

| 指標 | 値 |
| --- | --- |
| page 間件数矛盾 | 0 |
| broken internal link | 0（2,273ページ / リンク先2,339種類を検査） |
| production visual error | 0（27ページ × 7viewport = 189件 ＋ 追加15ページ × 7viewport = 105件。320/375/390/430/768/1280/1440px で実レンダリング確認） |
| horizontal overflow | 0px |
| console error | 0 |
| hydration error | 0（70URL のクエリ付き直アクセス・リロードで検査。`npm run audit:hydration`） |
| test failures | 0（404 checks / 34スクリプト） |
| validate:data errors | 0 |
| validate:seo failures | 0（2,274ページ） |
| validate:content errors | 0（2,274ページ） |

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
| `npm run audit:attribution` | 実施主体の表示監査（市と県の取り違えが無いかを実レンダリングで確認）。build が必要 |

`audit:*` と `smoke:production` は `playwright-core` とローカル Chromium を使います。
アクセシビリティ監査（`scripts/audit-accessibility.mjs`）の再実行には
`npm i --no-save playwright @axe-core/playwright` が必要です（Cloudflare Pages のビルドを重くしないため package.json には入れていません）。

## 事業の実施主体（Phase230-234）

**延岡市内で行われる宮崎県の事業を、延岡市の事業と誤解させない**ための最小限の構造化。
既存フィールド33キーを監査した結果、実施主体を表せるものは0件だったため、任意フィールドを1つだけ追加した。

| 項目 | 内容 |
| --- | --- |
| 型 | `src/types/implementationAttribution.ts` |
| 付与先 | `CivicTimelineEvent.implementation?`（任意。**無い＝未確認が正常状態**） |
| `implementingBody` | `nobeokaCity` / `miyazakiPrefecture` / `nationalGovernment` / `cityPrefectureJoint` / `wideAreaUnion` / `other` |
| `nobeokaRelation` | `cityProject` / `prefecturalProjectInNobeoka` / `cityPrefectureJoint` / `nobeokaParticipant` / `nobeokaBeneficiary` / `relatedOnly` |
| `implementationScope`（任意） | `nobeokaCity` / `northernMiyazaki` / `miyazakiPrefecture` / `national` / `other` |
| `attributionSourceUrl`（必須） | 同レコードの `sourceRefs` に含まれる URL でなければ `validate:data` が error |

migration 不要・完全後方互換。命名は既存型に合わせた camelCase。

### 分類の状況

| 区分 | 件数 |
| --- | ---: |
| 宮崎県の事業 | 10 |
| 延岡市の事業 | 1 |
| 延岡市と宮崎県の共同 | 1 |
| **実施主体を確認済み** | **12** |
| 実施主体を確認中（未設定） | 207 |
| 市政年表の出来事（合計） | 219 |

**一次資料で確定できる案件だけに付与している。** 推測での分類は行わず、確定できないものは未設定のまま。
「延岡で開催」というだけでは市の事業と判定しない（県主催・延岡市開催は「宮崎県の事業／延岡市が参加」）。

### 表示

`/history`・`/timeline/:year`・`/mayors/:slug` で「実施主体：宮崎県／対象地域：延岡市／
延岡市との関係：延岡市が参加（主催・実施主体ではありません）」のように**日本語で**表示する。
内部コードは画面に出さない。`/history` には実施主体の絞り込みがあり、
「確認中」を選んだときは**それが延岡市の事業の一覧ではない**旨をその場で説明する。
色付き badge は作らず、既存の `dl/dt/dd`「項目名：値」で伝える（色だけで意味を伝えない）。

### 再発防止（Phase233）

`scripts/test-implementation-attribution.mjs`（23検査）が次を固定している。

- 宮崎県の予算が延岡市の一般会計・補正予算・基金・市債・財政ダッシュボードへ入らない
- 宮崎県議会の議案・一般質問・議員が延岡市議会のデータへ入らない
- 開催地が延岡市であることを理由に県の事業を市の事業として分類しない
- 一次資料に根拠が無い案件を共同実施へ格上げしない
- 実施主体が未設定でも既存ページが壊れない（後方互換）
- 報道（LEVEL B）だけを根拠に実施主体を確定しない

各検査は**故障注入15件＋レンダリング2件で実際に発火することを実証済み**。
実レンダリング監査は `npm run audit:attribution`。

### 未着手（資料整備待ち）

`ArchivePolicy` / `MayorPromiseMeasureSnapshot` / `BillVote` への展開は、確定できるレコードが無いため未実施。
展開する際は新しい区分体系を作らず `ImplementationAttribution` を再利用すること。

## 既知の残課題（安定版として許容、次回以降の候補）

1. **ビルド非再現性**: 生成データの `generatedAt`（ビルド時刻）により、内容が同一でも毎回チャンクハッシュが変わり、再訪ユーザーが同じ内容の JS（845KB）を再取得する。値は画面表示にも使われるため要検討。
2. **タップ領域**: ヘッダー（803件）の 44px 化は `top-[57px]` を使う6ページの sticky バー同時変更が必要。パンくず（423件）の 24px 化は全ページ +約8px。いずれも WCAG 2.2 AA は充足済みで、AAA のみ未達。
3. **データ文面に残る内部識別子（方針として維持）**: Phase217 で 5,247件を分類し、出典追跡・監査履歴に必要な 2,842件は**意図的に維持**、参照が壊れていた1件のみ削除。表示側は `humanizeDataNote()` で変換し、一般公開本文への流出は `scripts/test-text-quality.mjs` のレイヤー3・3-2・3-3 が形（camelCase・パス・末尾数字ID等）でも検出して防ぐ。未着手は「注記本文に直接書かれた外部URL 39件の `sourceRefs` 構造化」のみ。
4. **検索**: 「市議会議員」の上位が選挙結果に偏る（語義的には妥当）。`/history`・`/updates` に項目アンカーが無いため同一URL結果を統合表示している。
5. **末尾スラッシュ**: 308リダイレクトが発生（sitemap・canonical は末尾スラッシュなし）。クロール時に1ホップ増える。
6. **スクリーンリーダー実機確認**（NVDA/VoiceOver/TalkBack）は**未実施**（`MANUAL_ACCESSIBILITY_CHECK_REQUIRED`）。この環境に NVDA は未インストールで、導入もしていない。Phase218 で accessibility tree による代替監査（12ページ・160件検出→0件）を実施したが、読み上げ音声の自然さ・ブラウズ/フォームモード切替・見出しジャンプの実使用感・点字出力・ライブリージョンの実発話などは実機でしか判定できない。自動 a11y 監査 0件は WCAG 完全準拠を意味しない。

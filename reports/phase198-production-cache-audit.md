# Phase198 本番表示・キャッシュ・更新日時 監査

- 監査日：2026-09-02
- 対象：https://nobeoka-shisei-portal.pages.dev/
- 本番デプロイ対象コミット：`871415e`（ローカルHEADと同一）
- 方法：ローカルで `npm run build` した `dist/` と、本番へ実際に送信したHTTPレスポンスを突き合わせた。
  HTTP 200 だけでは合格とせず、本文のsha256（正規化後）、title・canonical・JSON-LD・件数表記・本文長、
  `cache-control` / `etag` / `age` / `cf-cache-status`、条件付きリクエスト（If-None-Match）の応答まで実測した。
- 再現コマンド：`npm run audit:production-cache`（出力：`reports/phase198-production-cache-audit.json`）
- 根拠データ：`reports/phase198-production-cache-audit.json`、`reports/phase198-lastmod-shallow-clone.json`

## 結論（件数）

| 区分 | 件数 |
| --- | --- |
| stale HTML（古い本文がCDNに残っている） | **0件** |
| stale JSON／検索インデックス（古い件数が残っている） | **0件** |
| stale アセット（HTMLが参照するJS・CSSの取得失敗／内容不一致） | **0件** |
| 更新日時（lastmod・JSON-LD dateModified）が本番でビルド日になっていた問題 | **1件（影響91URL）** |
| キャッシュ設定の不備 | **1件（`/photos/*` にキャッシュ指定漏れ）** |
| 修正 | **2件**（`scripts/lib/lastmod.mjs`、`public/_headers`） |

## 1. 本番と生成HTMLの同期確認

### 1-1. プリレンダリングHTML（14ページ）

- 14ページすべて HTTP 200。本文は、次の3点を正規化したうえでローカルの `dist/` と比較した。
  1. Cloudflare Pagesダッシュボードの Web Analytics が本番HTMLへ自動注入する beacon（ビルド成果物には存在しない）
  2. 改行コード（Windowsのチェックアウトは CRLF、本番ビルドは Linux の LF）
  3. ハッシュ付きアセットのファイル名
- 結果：**11ページは完全一致**。残り3ページ（`/dashboard`・`/people`・`/mayor`）の差分は
  JSON-LD の `dateModified` のみで、本文・見出し・件数・title・canonical・description は一致した
  （原因は「3. 更新日時」に記載。古いHTMLが残っていたわけではない）。
- `/people?type=member` などPages Functionが差し替えるバリアントHTML3種も、本文が完全一致した。

### 1-2. 更新履歴・ビルド日時

- `src/data/siteUpdate.json` の `lastUpdated` はGitの最新コミット日時から生成される。
  本番の各ページ本文はローカルビルドと一致しており、表示される最終更新日時にずれはない。

### 1-3. 検索インデックスの件数（今回の `2270→2276` 修正の反映確認）

- `searchIndex.json` / `searchIndexMeta.json` は独立したJSONとして配信されておらず、
  ビルド時にハッシュ付きJSチャンクへ取り込まれる（`/data-status` は件数のみを持つ
  `searchIndexMeta.json` を読み込む）。したがって「JSONだけが古いまま残る」経路は存在しない。
- 本番 `/data-status/` のHTMLを実取得し、**「2,276件」が含まれ、「2,270件」は含まれない**ことを確認した。
  ローカルビルドのHTMLとも完全一致（修正は本番へ反映済み）。

### 1-4. アセット（JS・CSS）

- 本番HTMLが参照するアセットをすべて取得し、HTTP 200 を確認した。
- 本番のエントリチャンク（`/assets/index-BDQlXE4S.js`）は、ローカルビルドの
  `index-VlcLbSzP.js` と**ファイル名以外はバイト単位で同一**（ハッシュ付きファイル名参照を
  正規化して比較・619,118バイトで一致）。本番のJSは古くない。
- ファイル名のハッシュだけが違う原因は、`adminReviewQueue.json`・`dataQualitySummary.json`・
  `archiveAiCategoryCandidates.json`・`archiveRelationCandidates.json` が持つ `generatedAt` /
  `createdAt`（ビルド実行時刻）で、データ内容が同じでもビルドのたびにチャンクのハッシュが変わる。
  表示上の問題はないが、キャッシュ効率の面では改善余地がある（「5. 未対応の提案」参照）。

### 1-5. sitemap.xml

- URL数は本番・ローカルとも 2,201 件で一致。過不足なし。
- `lastmod` が 91URL で不一致だった（「3. 更新日時」参照）。

## 2. キャッシュ設定の実測値

| リソース種別 | 実測 Cache-Control | ETag | 条件付きGET | 備考 |
| --- | --- | --- | --- | --- |
| HTML（プリレンダリング済み全ページ） | `public, max-age=0, must-revalidate` | あり（W/"…"） | **14/14で304** | デプロイ後に古いHTMLが返らない |
| `/people?type=…`（Pages Function） | `public, max-age=0, must-revalidate` | なし（意図的） | ─ | 別URLのETag転用を避けるための既存設計 |
| ハッシュ付きアセット `/assets/*` | `public, max-age=31536000, immutable` | あり | ─ | 長期キャッシュが正しく適用されている |
| `/sitemap.xml` | `public, max-age=3600` | あり | 304 | |
| `/robots.txt` | `public, max-age=3600` | あり | 304 | |
| `/favicon.svg` | `public, max-age=604800` | あり | 304 | |
| `/og-image.png` | `public, max-age=86400` | あり | 304 | |
| `/og/*`（例 `/og/members/m01.jpg`） | `public, max-age=86400` | あり | ─ | |
| `/images/*` | `public, max-age=604800` | あり | ─ | |
| `/photos/*`（議員・市長の顔写真） | **（修正前）`public, max-age=0, must-revalidate`** | あり | ─ | `_headers` に指定漏れ → 本Phaseで修正 |
| PDF（`/documents/*`・`/council-documents/*`） | `public, max-age=0, must-revalidate` | あり | ─ | 既定のまま（「5. 未対応の提案」参照） |
| `/api/site-stats`（Pages Function） | `public, max-age=3600, s-maxage=3600` | なし | ─ | `cf-cache-status: HIT`、`age` は最大3600秒 |
| 存在しないURL | `no-store`（HTTP 404、`dist/404.html`） | なし | ─ | |

- ハッシュ付きアセットは immutable が適切に効いており、`immutable` の欠落は0件。
- HTMLは全ページで再検証が成立（`If-None-Match` に対し304）。**古いHTMLがCDNに残る問題は検出されなかった。**
- Cloudflare Pagesの静的配信では `cf-cache-status` が返らない（デプロイ単位で配信されるため）。
  Functionの `/api/site-stats` のみ `HIT` と `age` を確認できた。

## 3. 更新日時（lastmod・JSON-LD dateModified）の不一致 ― 検出と修正

### 症状

本番の `sitemap.xml` で **95URL** の `lastmod` がデプロイ日（2026-09-02）になっていた。
全履歴のあるローカルビルドでは同じコミットから **4URL** しか当日日付にならず、**91URL** が食い違った。
同じずれは、プリレンダリングHTMLのJSON-LD `dateModified` にも現れていた
（例：`/people` 本番 2026-09-02 ／ ローカル 2026-08-29、`/mayor` 本番 2026-09-02 ／ ローカル 2026-08-05）。

### 原因（再現により特定）

CDNに古いファイルが残っていたのではない。同一コミットを **浅いclone（`git clone --depth 1`）** して
`node scripts/generate-sitemap.mjs` を実行したところ、当日日付のURLが95件となり、
**本番の sitemap.xml と差分0件で完全に再現**した。

浅いcloneでは全ファイルの「最終コミット」が唯一のコミット（HEAD）になるため、
`git log -1 -- <file>` が常にデプロイ日を返す。Cloudflare PagesのGit連携ビルドは
GitHub Actionsと異なり `fetch-depth` を指定できないため、
`scripts/lib/lastmod.mjs` に書かれていた既知の不具合（2026-08-08にGitHub Actions側で対処済み）が
本番ビルドでは残り続けていた。結果として、実際には更新していないページまで
「今日更新した」と検索エンジンへ伝えていた。

### 修正

`scripts/lib/lastmod.mjs`：

1. 浅いcloneを検出した場合は、Gitの日付を「情報なし」として扱う（全ファイルがHEADの日付になり無意味なため）。
2. 新しいフォールバック段を追加：データ内の日付 → 更新履歴 → Gitの更新日 →
   **前回公開時のlastmod（コミット済み `public/sitemap.xml`）** → サイト全体の最終更新日。
   前回公開した日付を維持するだけなので、架空の更新日を作らない。

### 修正の検証

| ビルド条件 | lastmodがビルド日と同じURL数 | コミット済みsitemapとの差分 |
| --- | --- | --- |
| 本番（現状） | 95 | 94 |
| 浅いclone・修正前 | 95（本番と差分0＝再現成功） | 94 |
| 浅いclone・修正後 | **1**（トップページのみ） | **0** |
| 全履歴ローカルビルド（修正後） | 4 | 3（`/about`・`/contact`・`/terms`。当日のコミットで実際に更新されたページ） |

修正後の浅いcloneビルドと全履歴ビルドの差は上記3URLのみで、浅いclone側は前回公開日を維持する
（＝日付を新しく作らない安全側の挙動）。正確な日付は、全履歴のあるローカルビルドが
`public/sitemap.xml` を更新してコミットすることで反映される。

回帰テスト `scripts/test-lastmod-fallback.mjs` を追加し、`npm test` に組み込んだ。

## 4. `/photos/*` のキャッシュ指定漏れ ― 検出と修正

`public/_headers` には `/images/*`（7日）・`/og/*`（1日）の指定はあるが `/photos/*` がなく、
議員・市長の顔写真27枚が Cloudflare Pages 既定の `public, max-age=0, must-revalidate` で
配信されていた（本番実測で確認）。`/people` は1ページで最大27枚を読み込むため、
再訪のたびに画像1枚ずつの条件付きリクエスト（304）が発生する。

同じ種類の静的画像である `/images/*` と同じ7日（`public, max-age=604800`）を指定した。
ファイル名にハッシュが付かないため immutable にはしていない（差し替え時はファイル名を変更する運用）。

## 5. 未対応の提案（今回は変更していない）

1. **ビルドの再現性**：`adminReviewQueue.json`・`dataQualitySummary.json`・
   `archiveAiCategoryCandidates.json`・`archiveRelationCandidates.json` の `generatedAt` /
   `createdAt` がビルド実行時刻のため、データ内容が変わっていなくても毎回チャンクのハッシュが変わり、
   再訪ユーザーが同じ内容のJS（エントリチャンク845KB）を再取得する。
   「内容が変わったときだけ `generatedAt` を更新する」方式にすれば解消できるが、
   これらの値は画面表示にも使われるため、意味の変更を伴う。別Phaseでの検討を推奨する。
2. **PDFのキャッシュ**：`/documents/*`・`/council-documents/*` は現在 `max-age=0, must-revalidate`。
   公開済みの議会資料は基本的に差し替わらないため短期キャッシュ（例：1日）を付けられるが、
   差し替え時の反映が遅れる副作用があるため、今回は既存設定を維持した。
3. **末尾スラッシュへの308リダイレクト**：`dist/<path>/index.html` 構成のため、
   Cloudflare Pages が `/data-status` → `/data-status/` へ308リダイレクトする（実測13/13）。
   sitemap.xml と canonical は末尾スラッシュなしのURLを指しており、
   クロール時に1回リダイレクトを挟む。表示・インデックスへの実害は確認されていないが、
   `canonical` を実配信URLへ合わせるか、プリレンダリング出力を `<path>.html` にするかの
   検討余地がある（配信構成全体に影響するため、本Phaseでは変更しない）。

## 6. 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `scripts/lib/lastmod.mjs` | 浅いclone時にGitの日付を使わない／前回公開時のlastmodへフォールバック |
| `public/_headers` | `/photos/*` に `Cache-Control: public, max-age=604800` を追加 |
| `public/sitemap.xml` | ビルド再生成（`/about`・`/contact`・`/terms` の実際の更新日を反映） |
| `scripts/audit-production-cache.mjs` | 本番のキャッシュ・内容同期の実測スクリプト（新規） |
| `scripts/test-lastmod-fallback.mjs` | lastmod解決の回帰テスト（新規、`npm test` へ追加） |
| `package.json` | `audit:production-cache` スクリプト追加、`test` へ回帰テスト追加 |
| `reports/phase198-production-cache-audit.json` / `.md` | 監査結果 |
| `reports/phase198-lastmod-shallow-clone.json` | 原因特定・再現・修正検証の記録 |

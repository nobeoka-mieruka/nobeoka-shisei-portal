# Phase43 出典・リンク・UI・品質 調査結果

- 調査日：2026-08-22
- 調査者：Phase43 worker（読み取り専用調査。src/components・src/pages・src/lib・src/data等は未編集）
- 事前確認済み資料：`src/data/dataQualitySummary.json`、`reports/source-quality-audit.json`、`reports/ndl-historical-source-ledger.json`、`src/lib/completeness.ts`、`reports/ui-audit.json`（Phase31）
- 本フェーズでは新規のリンク死活チェックは実行していない（既存の自動監査結果の読み込みのみ）。

## 1. 既知broken link（`src/data/dataQualitySummary.json` linkHealth）

- `generatedAt`: 2026-08-16T23:25:10.204Z
- `totalChecked`: 677、`ok`: 653、`redirect`: 10、`notFound404`: 4、`serverError`: 7（合計broken 11件）
- 内訳（新規発見なし。既存記録の確認のみ）：
  1. `not_found_404` ×4
     - `https://ja.wikipedia.org/wiki/仲田又次郎`（archiveMayorTerms.json）
     - `https://news.yahoo.co.jp/articles/54bca0ed2ef221f61c15fcb199c2377eda2bf8ba`（archiveMayors.json, archiveMayorTerms.json）
     - `https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/27980.xls`（municipalityComparison.json）
     - `https://www.the-miyanichi.co.jp/kennai/_84868.html`（archiveMayors.json, archiveMayorTerms.json）
  2. `server_error`（503、Wayback Machine再生バックエンド障害由来と記録済み）×7
     - `archiveFiscalYears.json` 1件、`archiveMayors.json` 1件、`civicTimelineEvents.json` 4件、`archiveMayors.json/archiveMayorTerms.json` 1件
- `excludedBackupOnlyReferences`: 143（*.backup.jsonのみ参照するURLは対象外、既存仕様どおり）
- 新規に発見したbroken linkは0件（本フェーズでは新規ネットワーク死活チェックを実施していないため、「新規0件」は「既存記録の再確認のみ」という意味であり、確認済み0件＝confirmed_zeroではない）。

`sourceHealth`（`validate:sources`）: errors 0 / warnings 15 / info 65。warningsは出典タイトル欠落等の改善余地で異常ではないと既存noteに明記。詳細な内訳ファイルは今回のsrcスキャン範囲外（`scripts/validate-sources.mjs`の実行結果側にあり、本フェーズでは再実行していない）。

## 2. 「0件」誤表示の疑いがある箇所

広範囲（src/pages・src/componentsの`.length === 0`、`0件`、`件数`関連コード）をGrepで確認した。当サイトは既に TASK-074／TASK-075／TASK-080／Phase17 等で「0件」と「未収録」を区別する仕組み（`CompletenessStatus`、`DataAvailabilityStatus`、`DataAvailabilityBadge`/`EmptyState`）を導入済みで、抽出した大半の箇所は適切に区別されていた。その中で以下を優先修正候補として記録する（修正はしていない、報告のみ）。

### 2-1. `src/pages/DataStatusPage.tsx:631`（優先度：中）

```
<dt className="text-xs text-on-surface-variant">件数不整合（画面表示とデータ件数のずれ）</dt>
<dd className="mt-0.5 text-lg font-semibold text-on-surface">0件（既知の問題は解消済み）</dd>
```

- `dataQualitySummary.json`の`countConsistencyChecks`配列（型は`DataStatusPage.tsx:121`で`{ label; status; note }[]`と定義済み）を実際には参照せず、「0件」という文字列を直接ハードコードしている。
- 現時点では`countConsistencyChecks`の要素は1件のみで、`status: "fixed_2026-08-17"`（解消済み）のため表示内容自体は現状事実と一致しているが、今後この配列に未解消（`status`が`fixed_*`以外）の項目が追加されても、この行は自動的には更新されず「0件」のまま表示され続ける構造になっている。
- 他の2つの隣接カード（出典不足・リンク切れ）は`dataQualitySummary.sourceHealth.warnings`・`dataQualitySummary.linkHealth.broken.length`を動的に参照しているのに対し、この1カードだけが静的文字列である点で非対称。
- 修正案（提案のみ）：`dataQualitySummary.countConsistencyChecks.filter(c => !c.status.startsWith("fixed")).length`等で動的に算出し、0件超の場合は内訳を表示する（既存の「リンク切れの内訳を見る」détailsパターンを流用可能）。

### 2-2. `src/pages/CompareMayorsPage.tsx:191`（優先度：低）

```js
const n = policiesForPerson("mayor", m.id).length;
if (n > 0) return `${n}件`;
return m.isCurrentMayor ? "0件" : "0件（歴代市長の公約データは未収集）";
```

- 現職市長でn===0の場合のみ、注釈なしの裸の「0件」を表示する（歴代市長側は「未収集」の注釈が付く）。
- 同じファイル内の直前の列「在任中の市政イベント件数」（line 182）は、現職・歴代を問わず`n>0 ? ... : "0件（未収集の可能性があります）"`と常に注釈を付けており、扱いが不揃い。
- `src/pages/MayorDetailPage.tsx:313-314`では、現職市長で公約0件のケースを「現時点で登録済みの公約はありません（0件）。」という完全な文で説明しており、単純な「0件」という2文字だけの表示ではない。比較表のセルという制約上、同程度の文章を添えるのは難しいが、「0件（現時点で登録なし）」等の最小限の注記を検討する余地がある。
- 実害は限定的（現職市長のpolicyCountが実際に0件になるケースは、サイトの優先機能である市長公約データが存在する限り通常発生しにくいと見られる）。

### 2-3. その他（発見なし）

- `.length === 0`を直接JSXへ埋め込んで生の「0」を表示している箇所（EmptyState/DataAvailabilityBadge/CompletenessStatusを経由しない箇所）は、src/pages・src/components配下で確認した範囲では発見できなかった。
- `CouncilActivityPage.tsx:483`（`coveragePercent === 0 ? "未収録" : ...`）、`MayorDetailPage.tsx:314/342/346`、`CompareMayorsPage.tsx:182/202`、`CouncilDocumentsArchivePage.tsx:133`等は、いずれも0件・未収録・確認済み0件の違いを文言または既存ステータス型で明示しており問題なし。
- Phase31 UI総点検（`reports/ui-audit.json`）で確認済みの表レイアウト（FinanceTable/CompareTable、`/council-activity`表、`/compare/similar-municipalities`表、Footer）は再調査していない（重複調査回避）。

## 3. UI status表示文言とCompletenessStatus語彙の一致状況

`src/lib/completeness.ts`の`CompletenessStatus`（7区分）：

| キー | ラベル |
| --- | --- |
| complete | 完全収録 |
| partial | 一部収録 |
| not_collected | 未収録 |
| not_available | 一次資料未公開 |
| unknown | 母数未確認 |
| under_review | 調査中 |
| confirmed_zero | 確認済み0件 |

- `DataStatusPage.tsx`（`STATUS_BADGE_STYLE`・`badgeFromStatus`・`statusBadge`関数、line 150-174）は`COMPLETENESS_STATUS_LABELS`を直接参照しており、7区分のラベル文言はハードコードされた重複定義なしに一致している（確認済み・良好）。
- 「資料確認待ち」という文言は、src配下を全文検索したが**サイト内のどこにも使用されていない**（発見なし）。CLAUDE.mdや本タスク指示に挙げられている候補語だが、実装側では採用されていない語のようで、現状は不一致というより「未使用」。
- 「確認中」は、CompletenessStatus（データセット単位の収録状況バッジ）の語彙には含まれていないが、個々のフィールド値が不明なときのプレースホルダとして全ページで広く使われている（例：`MayorDetailPage.tsx`の前任/後任市長、`CompareMayorsPage.tsx`の在籍年数等）。これはCLAUDE.md「確認できない情報は『確認中』などで区別する」の想定どおりの用法であり、CompletenessStatusのバッジ文言とは別レイヤーの表記のため、混同や不一致ではないと判断した。

### 3-1. 発見：`DataAvailabilityStatus`（`src/lib/dataAvailabilityStatus.ts`）とのキー名衝突（優先度：低〜中、要注意）

サイトには`CompletenessStatus`とは別に、もう1つの5区分語彙`DataAvailabilityStatus`（`confirmed | not_collected | under_review | unavailable | unknown`、`DataAvailabilityBadge`・`EmptyState`が使用）が存在する。両者は同じキー名（`not_collected`・`under_review`・`unknown`）を使いながら、ラベルの対応が異なる：

| キー | CompletenessStatusでのラベル | DataAvailabilityStatusでのラベル |
| --- | --- | --- |
| under_review | 調査中 | 未確認 |
| unknown | 母数未確認 | 調査中 |
| not_collected | 未収録 | 未収録（一致） |

- `under_review`と`unknown`の意味がCompletenessStatus側とDataAvailabilityStatus側で実質的に入れ替わっている。
- 実際の呼び出し箇所（`EmptyState status="under_review"` 等、`MayorPage.tsx`・`MemberFormerDetailPage.tsx`・`PoliticalFundOrganizationDetailPage.tsx`）を確認した限り、現時点では両者が混同して使われている実例は発見できなかった（いずれもDataAvailabilityStatusの意味＝「資料未確認」の文脈で正しく使われている）。
- ただしTypeScript上、両者の型は文字列リテラルの部分集合が重なる（`not_collected`・`under_review`・`unknown`は両方の型に存在する）ため、将来どちらかの型の値をもう一方のコンポーネントへ誤って渡してもコンパイルエラーにならない可能性がある。命名衝突による将来的な取り違えリスクとして記録する（現時点のバグではない）。

## 4. sourceRefs・sourceHealth関連の補足（読み取りのみ）

- `reports/source-quality-audit.json`：出典品質グレードA〜E集計。overallByGrade: A=276, D=126, E=12（B・Cは0件、grade定義上未使用と見られる）。`recordsWithoutOwnSourceRefsTotal: 0`（自身のsourceRefsを持たないレコードは無し）。
- `reports/ndl-historical-source-ledger.json`：史料台帳、31件（`summary.totalSources: 31`）。内訳は`metadata_only`13・`login_required`2・`reviewed`4・`adopted`1・`rejected`6（`sources`配列側の実カウントとはstatus区分の粒度が異なる＝配列側は`onsite_required`等の追加ステータスを含む）。本フェーズではリンク健全性・UI表記との直接の不整合は確認しなかった（このファイルはURLの生死ではなく史料調査の進捗記録が主目的のため）。

## 5. 終了時報告

- sourceRefs補強件数：0件（本フェーズは読み取り専用調査のため、データへの追記は行っていない）
- リンク修正候補件数：0件（新規発見なし。既知11件はいずれも記録済みで、Wayback側の一時障害または恒久的404として既に分類済み。新規の追加修正候補は無し）
- 0件誤表示候補件数：2件（`DataStatusPage.tsx:631`＝優先度中、`CompareMayorsPage.tsx:191`＝優先度低）。加えてキー名衝突リスク1件（`CompletenessStatus`と`DataAvailabilityStatus`の`under_review`/`unknown`、優先度低〜中）を参考記録として追加。
- warnings開始/終了件数：`sourceHealth.warnings`は開始時点15件・本フェーズでの変更なし15件（データ・コードとも未編集のため増減なし）。

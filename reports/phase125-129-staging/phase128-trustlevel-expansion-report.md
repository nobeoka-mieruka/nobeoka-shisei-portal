# Phase128: trustLevelを主要データ型へ段階的に展開

## 背景

Phase122で `src/types/historicalArchive.ts` の `ArchiveSourceRef` に、出典の信頼レベルを表す任意フィールド
`trustLevel?: ArchiveSourceTrustLevel`（PRIMARY / OFFICIAL_ARCHIVE / SECONDARY / NEWS / SOCIAL / UNVERIFIED）が
パイロット導入されていた（`src/data/archiveMayorTerms.json` の3件のみで使用）。本フェーズでは、この型を
「歴代市長・元議員アーカイブ」専用の型から、サイト全体の主要データ型（議案・一般質問・議員・公約・財政・報酬）
が共有する `SourceMeta` / `FinanceSourceMeta` / `CompensationSourceMeta` へ、後方互換を保ったまま段階的に展開した。

## 1. 型変更の範囲

### 1-1. 型定義の共有化（重複定義の回避）

`ArchiveSourceTrustLevel` を `src/types/historicalArchive.ts` から新規ファイル `src/types/sourceTrust.ts` へ移動した。

理由：`src/types/historicalArchive.ts` は既存で `src/types/index.ts` から型（`BillMemberVoteStatus` 等）を
importしている。もし `ArchiveSourceTrustLevel` を `historicalArchive.ts` に残したまま `index.ts` 側からimportすると
2ファイル間の循環import（`index.ts` → `historicalArchive.ts` → `index.ts`）になる。TypeScriptの型のみのimportは
コンパイル後に消去されるため技術的には問題ないケースが多いが、依存関係を素直に保つため、
importを一切持たない独立ファイル `src/types/sourceTrust.ts` を新設し、`index.ts` と `historicalArchive.ts` の
両方がそこから型を取得する形にした。

- `src/types/sourceTrust.ts`（新規）: `ArchiveSourceTrustLevel` 型の定義（6区分の説明コメント込み、Phase122のコメントを移設）。
- `src/types/historicalArchive.ts`: 型定義を削除し、`import type { ArchiveSourceTrustLevel } from "./sourceTrust"` の上で
  `export type { ArchiveSourceTrustLevel };` として再エクスポート（**既存の `import type { ArchiveSourceTrustLevel } from "./historicalArchive"` という書き方を壊さないため**。ただし実際に検索した範囲では、この型を他ファイルから
  importしている箇所は無かった＝型定義ファイル内で完結して使われていた）。
- `src/types/index.ts`: 冒頭に `import type { ArchiveSourceTrustLevel } from "./sourceTrust";` を追加。

### 1-2. `trustLevel` フィールドの追加（すべて任意フィールド、既存必須フィールドは無変更）

`src/types/index.ts` の以下3型に `trustLevel?: ArchiveSourceTrustLevel;` を追加した。

- `SourceMeta`（`GeneralQuestion` / `BillVote` / `CouncilMember` / `Pledge` 等が `extends SourceMeta` で継承）
- `CompensationSourceMeta`（`MiyazakiCompensationComparison` / `NationalCompensationRanking` / `SimilarMunicipalityComparison` が継承）
- `FinanceSourceMeta`（`financeDashboard.json` の `sources[]` に対応する型）

いずれも既存フィールドの型・必須/任意区分は一切変更していない（narrowingなし、後方互換）。

## 2. `scripts/validate-data.mjs` の変更内容

### 2-1. 共通ヘルパー（`scripts/lib/validate-archive-common.mjs`）

- `ARCHIVE_TRUST_LEVELS`（Set、6区分）を追加。TypeScriptの型はJSのバリデーションスクリプトから直接importできないため、
  `src/types/sourceTrust.ts` の6値と同じ値を定数として重複定義した（型自体を再利用したわけではないが、
  値のリストを一箇所に集約している）。
- `checkTrustLevel({ err }, value, tag)` を追加。`value` が `undefined`/`null` の場合は何もしない（＝存在しないレコードは
  一切エラーにしない、任意運用を維持）。値がある場合のみ6区分いずれかであるかを検証し、外れていればエラーとする。
- 既存の `checkSourceRefs`（`ArchiveSourceRef[]` の出典1件ずつを検証する共通関数）の中でも `ref.trustLevel` を
  `checkTrustLevel` で検証するようにした。Phase122で `trustLevel` がパイロット導入されて以降、実は
  この共通バリデータ自体には検証ロジックが無かった（値を書いても書かなくてもチェックされない状態だった）ため、
  今回あわせて追加した。

### 2-2. `scripts/validate-data.mjs` 本体

`checkTrustLevel` を6箇所のレコードループに追加し、`trustLevel` が存在する場合のみ値を検証するようにした
（存在しない場合はチェックをスキップ＝エラーにしない）。

- `generalQuestions.json`（各質問レコード）
- `billVotes.json`（各議案レコード）
- `members.json`（各議員レコード）
- `mayorPromises.json` の `promises[]`（各公約レコード）
- `financeDashboard.json` の `sources[]`（各出典セクション）
- `nationalCompensationRanking.json` / `similarMunicipalityComparison.json`（`validateRoleRankingFile` 経由）

`compensationComparison.json` の各自治体レコードにも追加済み。

## 3. trustLevelを付与した具体的なレコードと根拠

Phase122の「パイロット導入・全件への一括付与はしない」方針を踏襲し、既に出典情報（`sourceOrganization`・
`organization`・`sourceType`等）から一次資料か公式資料かが明確に読み取れる既存レコードのみへ試験的に付与した。
推測によるトップダウンの全件分類は行っていない。

### 3-1. `src/data/financeDashboard.json` の `sources[]`（11件、すべて `OFFICIAL_ARCHIVE`）

全11件が `organization: "延岡市"` または `organization: "延岡市監査委員"`（延岡市公式サイト上に掲載されたPDF/HTML、
url が `city.nobeoka.miyazaki.jp` の公式ドメインまたは同市が管理する `/documents/` 配下）であることが
既存フィールドから明確に確認できたため、`OFFICIAL_ARCHIVE`（公的機関が公表・保管する記録）を付与した。

内訳（section）：generalAccount, revenue, expenditureByPurpose, expenditureByNature,
supplementaryBudgetProjects, policyBudget, fundBalanceTrend, fundBalanceTotal, population,
financialIndicators, debtBalanceTrend

`PRIMARY`（予算書・決算書等の原本そのもの）とはあえて区別した。これらは市が公表した「予算の概要」「財政事情」
「財政状況資料集」等の説明・統計資料であり、予算書・決算書の原本そのものと断定できるほどの確証はないため、
既存のarchiveMayorTerms.jsonでの運用（公式サイト掲載コンテンツはOFFICIAL_ARCHIVE、原本性が明確な場合のみPRIMARY）
と同じ基準を踏襲した。

### 3-2. `src/data/generalQuestions.json`（14件、すべて `PRIMARY`）

令和8年6月定例会分の全14件は、いずれも既存フィールドで
`sourceOrganization: "延岡市議会"` / `sourceType: "質問通告書"` / `sourceUrl` が
`city.nobeoka.miyazaki.jp` 上のPDF（議員本人が提出した「総括質疑及び一般質問通告書」原本のスキャンPDF）
であることが明確に読み取れた。これは要約や二次的な記録ではなく、議員が議会に提出した文書そのものが
そのままPDF化・公開されたものであるため、`ArchiveSourceTrustLevel` の定義にある「公文書原本」に該当すると
判断し、`PRIMARY` を付与した。

対象id: gq2026-06-m24, gq2026-06-m17, gq2026-06-m14, gq2026-06-m08, gq2026-06-m26, gq2026-06-m13,
gq2026-06-m03, gq2026-06-m10, gq2026-06-m23, gq2026-06-m01, gq2026-06-m19, gq2026-06-m06,
gq2026-06-m20, gq2026-06-m02

### 3-3. 付与しなかったもの（判断できず見送り）

- `compensationComparison.json`：延岡市分（id: nobeoka）は `sourceTitle` に「延岡市公式」と明記され、
  `sourceUrl` も公式ドメインだが、`sourceOrganization` フィールド自体が実データに存在しない（型定義上は
  `CompensationSourceMeta.sourceOrganization` は必須だが、実データはこのフィールドを持たないスキーマの
  ずれがある）。他自治体分（延岡市以外）は出典の性質を個別に確認していないため、今回は付与を見送った。
- `billVotes.json` / `members.json` / `mayorPromises.json`：件数が多く（billVotesは1177件）、
  出典の性質（原本か要約か等）を1件ずつ確認する時間的余裕がなかったため、今回は検証ロジックの追加のみ行い、
  実データへの付与は見送った（将来のPhaseでの追加を想定）。

**合計付与件数：25件**（financeDashboard.json 11件 + generalQuestions.json 14件）。

## 4. UI表示について

サイト内のいずれのページ・コンポーネントも、Phase122で導入済みの `trustLevel`（`archiveMayorTerms.json` の
3件）を含めて、現時点では `trustLevel` を一切表示していない（`src/` 全体を検索し確認済み）。

本フェーズでは、既存の出典表示コンポーネント（`SourceMeta`/`FinanceSourceMeta`を参照する箇所は
`GeneralQuestionDetailPage`・`FinancePage`関連コンポーネント等、複数ページで共有されている）に手を入れると、
影響範囲の特定・スマホ表示への影響確認まで含めた検証コストが大きく、今回のスコープ（型・検証ロジックの展開と
少数レコードへの試験付与）に対してリスクが見合わないと判断し、**UI表示の追加は見送った**。
Phase122のパイロット導入時も同様にUI非表示のまま据え置かれており、今回もその方針を踏襲している。

## 5. 品質確認結果

| コマンド | 結果 |
|---|---|
| `npm run validate:data` | `errors=0 warnings=40`（変更前と完全に同数・同内容。既存の40件の警告は本変更と無関係な既存項目） |
| `npm run typecheck` | エラーなし（`tsc -b` 正常終了） |
| `npm run lint` | エラーなし（`oxlint` 正常終了） |
| `npm run build` | 正常終了。build後の `validate:seo`（2241ページ, failures=0 warnings=0）・`validate:content`（2241ページ, errors=0 warnings=0）も正常終了 |

`validate:data` の変更前後の比較は、`git stash` で変更前状態に戻して同コマンドを実行し、
`errors=0 warnings=40` が完全一致することを確認した（既存の40件の警告一覧も同一）。

## 6. 変更ファイル一覧

- `src/types/sourceTrust.ts`（新規） — `ArchiveSourceTrustLevel` 型の共有定義
- `src/types/historicalArchive.ts` — 型定義を`sourceTrust.ts`へ移動し、re-exportに変更
- `src/types/index.ts` — `SourceMeta` / `CompensationSourceMeta` / `FinanceSourceMeta` へ `trustLevel?` を追加
- `scripts/lib/validate-archive-common.mjs` — `ARCHIVE_TRUST_LEVELS` / `checkTrustLevel` を追加、`checkSourceRefs` にも組み込み
- `scripts/validate-data.mjs` — 6箇所のレコードループに `checkTrustLevel` 呼び出しを追加
- `src/data/financeDashboard.json` — `sources[]` 全11件に `trustLevel: "OFFICIAL_ARCHIVE"` を付与
- `src/data/generalQuestions.json` — 全14件に `trustLevel: "PRIMARY"` を付与

## 7. 残作業・次の改善提案

- `billVotes.json`（1177件）・`members.json`（26件）・`mayorPromises.json` の公約レコードへの`trustLevel`付与は
  未実施。件数が多いため、次フェーズ以降で出典の性質を1件ずつ確認しながら段階的に付与することを推奨する。
- `compensationComparison.json` は `CompensationSourceMeta.sourceOrganization`（型定義上は必須）が
  実データに存在しないスキーマのずれがある。将来的にデータ側へ`sourceOrganization`を補完するか、
  型定義側を実態に合わせて任意化するかの整理が望ましい（本フェーズのスコープ外のため変更していない）。
- UI表示は今回見送ったが、出典表示を1箇所に集約した共通コンポーネントが既にあれば、そこに
  「信頼レベル」バッジを追加することを次フェーズで検討する余地がある（要事前の影響範囲調査）。

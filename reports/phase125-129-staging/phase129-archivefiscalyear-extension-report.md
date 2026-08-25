# Phase129: ArchiveFiscalYearのoptional field方式による将来拡張

## 目的

`ArchiveFiscalYear`（`src/types/historicalArchive.ts`）とその関連型を調査し、Phase19〜21で
`reports/phase20-missing-years-status.json`・`reports/phase21-inquiry-tracker.json`という
非公式なレポートJSONだけで管理されている「財政欠落年度の資料入手状況」を、正式なデータスキーマ
（型定義）側にも任意フィールドとして反映できるようにする。既存レコード・既存フィールドの値は
一切変更しない（Phase127が並行して財政欠落年度の一次資料調査・データ追加を進めているため、
`src/data/archiveFiscalYears.json`自体への編集は行わなかった＝コンフリクトリスク回避）。

## 調査結果（現状の設計・制約）

- `ArchiveFiscalYear`は`fiscalYear: number`のみ必須で、population/budget/debt/fund/financeは
  すべて任意のサブ型。「確認できていない年度はundefinedのまま欠落させ、0や架空値で埋めない」という
  設計方針（型のJSDocに明記済み）。
- `src/data/archiveFiscalYears.json`は現在70件（1933〜2026年度、疎な配列）。
  `reports/phase20-missing-years-status.json`が追跡する9年度（1951, 1952, 1953, 1959,
  1983, 1984, 1985, 1986, 1987）は、レコード自体が存在しない状態（部分的なプレースホルダーも無い）。
- `src/lib/archiveFinanceMetrics.ts`は`ArchiveFiscalYear`の各サブ型フィールド（`y.population?.population`
  等）をオプショナルチェーンで読み、`FinanceMetricPoint`へ変換して/compare/finance・/finance/budget・
  /timeline/:year等で使っている。年度単位の「資料入手状況」自体は現状どこにも保持されておらず、
  UIコンポーネント側は年度レコードが存在するかしないかでしか欠落を判定できない。
- `reports/phase20-missing-years-status.json`は`statusCategories`として
  `online_confirmed` / `onsite_required` / `reference_pending` / `holding_unconfirmed` /
  `resource_unidentified`の5区分を定義し、9年度すべてを`reference_pending`と分類している。
- `reports/phase21-inquiry-tracker.json`は照会（INQ-001〜INQ-009）単位の送付・回答状況を
  `statusDefinitionsV2`（draft/sent/waiting/answered/partially_answered/no_record/
  onsite_required/closed）で追跡し、`targetFiscalYears`で対象年度と紐づけている。
- `scripts/validate-data.mjs`の`archiveFiscalYears.json`検証ブロック（既存部分、約1704〜1857行）は
  既存フィールドのみを検証しており、上記のような「資料入手状況」を検証する仕組みは存在しなかった。

## 設計方針

- 新規フィールドはすべて`?`付き（optional）とし、既存レコード（未設定のまま）が引き続き
  問題なく動作することを最優先にした（既存互換性）。
- 語彙は`reports/phase20-missing-years-status.json`の`statusCategories`と完全に一致させ、
  矛盾する別名を作らないようにした（タスク指示にあった`confirmed_primary`/`library_required`等の
  例示名はそのまま採用せず、実際に運用されているreports側の語彙を正とした）。
- 「実データの確認日」（既存の`verifiedAt`）と「資料入手状況をいつ見直したか」は別軸であるため、
  新規に`dataAvailabilityCheckedAt`を追加し、両者を混同しないようにした。
- `reports/phase21-inquiry-tracker.json`の`inquiry_id`（例: "INQ-001"）とarchiveFiscalYears.json側の
  年度レコードを紐づけられるよう、`relatedInquiryIds`を追加した。ただし参照先はsrc/data配下の
  正式マスタではなくreports配下の運用ファイルであるため、`validate-data.mjs`では存在チェックは行わず、
  形式チェック（`INQ-\d+`）のみ行う設計とした（過剰な結合を避けるため）。

## 追加した型フィールド一覧（`src/types/historicalArchive.ts`）

新規型:

```ts
export type ArchiveFiscalYearDataAvailabilityStatus =
  | "confirmed"
  | "online_confirmed"
  | "onsite_required"
  | "reference_pending"
  | "holding_unconfirmed"
  | "resource_unidentified"
  | "not_collected";
```

`ArchiveFiscalYear`への追加フィールド（すべてoptional）:

| フィールド名 | 型 | 用途 |
|---|---|---|
| `dataAvailabilityStatus` | `ArchiveFiscalYearDataAvailabilityStatus` | 年度データの資料入手状況。reports/phase20のstatusCategoriesと同一語彙。 |
| `dataAvailabilityCheckedAt` | `string`（ISO日付） | `dataAvailabilityStatus`を最後に見直した日。実登録値の確認日（`verifiedAt`）とは別軸。 |
| `relatedInquiryIds` | `string[]` | `reports/phase21-inquiry-tracker.json`の`inquiry_id`（例: "INQ-001"）への参照。形式チェックのみ、存在チェックはしない。 |

既存の必須フィールド・既存フィールドの型・意味は一切変更していない。

## `scripts/validate-data.mjs`への追加内容

`archiveFiscalYears.json`検証ブロックに以下を追加（値が存在する場合のみ検証、未設定はエラーにしない）:

- `dataAvailabilityStatus`が設定されている場合、上記7値のいずれかであることを`err`で検証。
- `dataAvailabilityCheckedAt`が設定されている場合、ISO日付形式であることを`err`で検証。
  あわせて`dataAvailabilityStatus`が未設定なら`warn`（見直し日だけあってステータスが無い状態を検知）。
- `relatedInquiryIds`が設定されている場合、配列であることを`err`で検証し、各要素が`INQ-\d+`形式で
  ない場合は`warn`（reports側ファイルの実在チェックはしないため、致命的エラーにはしない）。

## データファイル（`src/data/archiveFiscalYears.json`）について

Phase127が同ファイルの財政欠落年度（1951, 1952, 1953, 1959, 1983-1987）へ一次資料調査結果を
並行して追加中のため、コンフリクトを避ける目的で本フェーズでは**一切変更していない**。
新設フィールドはすべて任意のため、Phase127またはそれ以降の作業で
`dataAvailabilityStatus: "reference_pending"`等を個別レコードへ追加するのは今回のスキーマ変更
だけで既に可能な状態になっている。

## 品質確認結果

- `npm run typecheck`: エラーなし（既存コードへの影響なし）。
- `npm run lint`（oxlint）: 警告なし。
- `npm run validate:data`: `errors=0 warnings=40`。変更前（stashしてmain相当の状態で再実行）も
  同じく`errors=0 warnings=40`であり、既存の欠落年度警告（archiveFiscalYears.jsonの欠番一覧）を
  含め悪化なし。新設フィールドは既存データに未使用のため、新規warning/errorは0件。
- `npm run build`: 成功（vite build + プリレンダー2240ルート、`validate:seo`
  failures=0 warnings=0、`validate:content` errors=0 warnings=0）。

## 変更ファイル

- `src/types/historicalArchive.ts`（型追加）
- `scripts/validate-data.mjs`（検証ロジック追加）

# セッション引き継ぎメモ（2026-08-04 更新・フェーズ7は調査・設計のみ、実装未着手）

フェーズ6「政策データ・政策比較基盤」は完全完了（コミット`48832bb`・`fb8d18c`）。
フェーズ7「議案・条例・請願・陳情アーカイブ」は**調査・設計のみ実施し、コード・データの
実装は未着手**のままコンテキスト予算の都合で停止した。次セッションは本メモの設計に沿って
実装から再開できる（調査のやり直しは不要）。push・デプロイは未実施。

## ロードマップ（ユーザー確認済み）

1. フェーズ6：政策データ・政策比較基盤 → **完了**
2. フェーズ7：議案・条例・請願・陳情アーカイブ → **調査・設計のみ完了、実装は次回**
3. フェーズ8：AI横断検索・テーマ検索
4. フェーズ9：比較・可視化・タイムライン
5. フェーズ10：自動巡回の完成・全体検証・本番デプロイ

## 直近のコミット・現在の状態

```
fb8d18c docs: フェーズ6完全完了を反映しセッション引き継ぎメモを更新
48832bb chore: complete policy archive validation and search indexing
87af7b1 feat: 延岡市政アーカイブの政策データ・政策比較基盤（フェーズ6）を追加
```

本セッションではコード変更を行っていない（型定義への着手を1件行ったが、データ・画面が
伴わない中途半端な変更だったため`git restore`で元に戻した）。`git status`は
`.claude/settings.local.json`（ローカル専用）以外クリーン。

停止直前に確認済み：`npm run validate:data`（errors=0, warnings=1244＝既存警告のみ）／
`npm run typecheck`／`npx oxlint`（クリーン）／`npm run build`（859ページ生成）／
`npm run validate:seo`（failures=0, warnings=0）すべて成功（＝現在のコミット済みコードは
健全な状態）。

## フェーズ7：調査結果（重要、実装前に必ず読むこと）

### 既存構造の調査結果

- `src/types/index.ts`の`BillVoteItem`（`src/data/billVotes.json`、546件）は、想定より
  はるかに豊富にフェーズ7の要件をすでにカバーしている。
  - `BillCategory`に**すでに**`"条例"`（142件）・`"請願"`（3件）・`"陳情"`（9件）が
    含まれている。
  - `BillMemberVoteStatus`（議員別賛否）は**すでに**8区分ある：
    `approve`(賛成)/`oppose`(反対)/`abstained`(棄権)/`departed`(退席)/`absent`(欠席)/
    `recused`(議長のため採決不参加)/`unconfirmed`(不明)/`notVoting`(採決なし)。
    ユーザー要件の「資料未確認」に完全一致する値は無いが、item単位の
    `BillVerificationStatus`に`"individual-votes-unavailable"`（案件は確認できるが
    議員個人の賛否は資料に記載なし）があり、実質的にこの区別を担っている。
  - `BillVoteResult`は**すでに**`採択`/`一部採択`/`不採択`/`継続審査`/`撤回`等を含む
    （請願・陳情の審査結果もここに統合されている）。「提出」「付託」「審議未了」に
    直接対応する値は無い（新設が必要）。
  - `relatedBillIds`/`revisionOfBillId`/`replacesBillId`/`supersededByBillId`により、
    議案間の改正・置き換え関係は**すでに**型として存在する（条例の改正チェーンに転用可）。
  - `sourceDocumentId`/`sourceFilePath`/`sourcePage`/`resultDocumentUrl`/
    `billDocumentUrl`等が出典として機能している（`ArchiveSourceRef`ほど構造化されていない）。
- **ルーティングの衝突**：`/bills`は既存で`<Navigate to="/bills/votes" replace />`という
  リダイレクト専用ルートとしてすでに使われている（`STATIC_NOINDEX_PAGES`）。要件の
  `/bills`・`/bills/[slug]`をそのまま新設すると、この既存の再配置ページと意味的に衝突する。
  - `/bills/votes`（一覧）は**すでに**年度・会期・種別（`BillCategory`＝条例/予算/決算/…/
    請願/陳情）・結果（`BillVoteResult`）・提出者区分（`BillProposerType`）による絞り込みを
    実装済み（`src/pages/BillVotesPage.tsx`）。
  - `/bills/votes/:id`（詳細）・`/bills/compare`（比較）も既存。
  - → **要件の「既存のURLやルーティングがある場合は、それを優先して互換性を維持」に従い、
    `/bills`・`/bills/[slug]`は新設しない**。議案全般（条例・請願・陳情を含む全区分）の
    一覧・詳細・絞り込みは既存`/bills/votes`系にすでに実装済みのため、重複実装を避ける。
- **請願・陳情の個人情報**：`billVotes.json`の請願・陳情エントリを確認したところ、
  提出者名・住所等は**もともと登録されていない**（`billTitle`は議題名のみ）。既存の
  プライバシー方針をすでに満たしている。

### 設計方針（次回実装時にそのまま使える）

議案（bill）全般は既存`/bills/votes`に譲り、フェーズ7の新規アーカイブ層は
**条例・請願・陳情の3種類のみ**を対象とし、既存`billVotes.json`のレコードを
`legacyBillVoteId`で参照するインデックス層として設計する（歴代市長・元議員アーカイブと
同じ「複製せず参照する」パターン）。新規に追加するのは、既存データに無い部分
（条例の制定区分・施行日・公布日・現行/失効、請願・陳情の広い審査ステータス、
政策・予算年度との関連付け）のみ。

`src/types/historicalArchive.ts`に追記する型（設計案、未実装）：

```ts
import type { BillMemberVoteStatus, BillProposerType, BillVoteResult } from "./index";

export type ArchiveDocumentType = "ordinance" | "petition" | "request"; // 条例／請願／陳情

// 請願・陳情の審査状況。既存BillVoteResultより広い区分（提出・付託・審議未了等）を扱う。
export type ArchivePetitionResult =
  | "submitted" | "referred" | "continuedReview" | "adopted" | "partiallyAdopted"
  | "rejected" | "withdrawn" | "unresolved" | "sourceUnavailable";

export type ArchiveOrdinanceRevisionType = "enactment" | "fullRevision" | "partialRevision" | "repeal";
export type ArchiveOrdinanceEffectStatus = "inForce" | "expired" | "unknown";

// 既存BillMemberVoteStatusを再利用し、「資料未確認」のみ新規アーカイブ層で追加する
// （既存billVotes.jsonの型・データは一切変更しない）。
export type ArchiveDocumentVoteStatus = BillMemberVoteStatus | "sourceUnavailable";

export interface ArchiveDocumentVoteEntry {
  memberId: string;
  vote: ArchiveDocumentVoteStatus;
}

export interface ArchiveOrdinanceDetail {
  revisionType: ArchiveOrdinanceRevisionType;
  effectStatus: ArchiveOrdinanceEffectStatus; // 初期データは原則"unknown"（現行例規集との突合が別途必要）
  promulgationDate?: string; // 公布日（確認できる場合のみ）
  enforcementDate?: string;  // 施行日（確認できる場合のみ）
  relatedOrdinanceDocumentIds?: string[];
}

export interface ArchivePetitionDetail {
  // 私人の氏名・住所等は登録しない。区分（地域団体／市民個人／事業者団体等）のみ。
  petitionerCategory?: string;
  introducerMemberIds?: string[]; // 紹介議員（請願、確認できる場合のみ）
  committeeReferral?: string;
}

export interface ArchiveCouncilDocument {
  id: string;
  slug: string;
  documentType: ArchiveDocumentType;
  title: string;
  summary: string;
  number?: string; // 例："請願第1号"
  fiscalYear: number; // 西暦（sessionIdの先頭4桁から導出。令和年→西暦は 2018+令和年）
  sessionId?: string;
  meetingDate?: string;
  submittedDate?: string;
  decisionDate?: string;
  proposerType?: BillProposerType;
  proposerIds?: string[];
  status?: "pending" | "referred" | "continuedReview" | "decided" | "withdrawn";
  result?: BillVoteResult | ArchivePetitionResult;
  committeeId?: string;
  relatedMemberIds?: string[];
  relatedMayorIds?: string[];
  relatedPolicyIds?: string[];
  relatedQuestionIds?: string[];
  relatedBudgetIds?: string[];
  sourceRefs: ArchiveSourceRef[];
  verificationStatus: ArchiveVerificationStatus;
  notes?: string;
  // 既存billVotes.jsonの対応レコードid。設定されている場合、議決結果・議員別賛否・
  // 出典PDFはそちらを正とし、このファイルには重複登録しない。
  legacyBillVoteId?: string;
  voteEntries?: ArchiveDocumentVoteEntry[]; // legacyBillVoteId未設定の場合のみ使用
  ordinanceDetail?: ArchiveOrdinanceDetail; // documentType="ordinance"のみ
  petitionDetail?: ArchivePetitionDetail;   // documentType="petition"|"request"のみ
  createdAt?: string;
  updatedAt?: string;
}
```

### 初期データ候補（調査済み、追加取得不要・出典確認済み）

`billVotes.json`から`legacyBillVoteId`で参照する形で移行する（新規外部取得なし、
「大量の過去資料取得はしない」方針に沿い少数のみ）。

- **条例（3件）**：
  - `2023-06-gian-15`「延岡市特別用途地区内における建築物の制限に関する条例の制定」
    → `revisionType: "enactment"`（タイトルに「改正」「廃止」を含まない新規制定）
  - `2026-06-gian-14`「延岡市印鑑の登録及び証明に関する条例の一部を改正する条例の制定」
    → `revisionType: "partialRevision"`（タイトルに「一部を改正する」と明記）
  - `2023-09-gian-51`「延岡市北方ふれあい交流センター条例を廃止する条例の制定」
    → `revisionType: "repeal"`（タイトルに「廃止する」と明記）
  - `promulgationDate`/`enforcementDate`は未確認のため空欄のまま（billVotes.jsonに
    情報なし、新規PDF取得はしない）。`effectStatus`は`"unknown"`のまま
    （現行例規集との突合が別途必要、推測しない）。
  - revisionTypeの判定はタイトル文言に明記された事実のみに基づく（推測ではない）。
    `fullRevision`（全部改正）の実例は現データ内に見つからなかった（0件、無理に登録しない）。
- **請願（3件、全件）**：`2023-06-seigan-1`（採択）・`2024-09-seigan-2`（採択）・
  `2026-03-seigan-3`（撤回）
- **陳情（4件、抜粋）**：`2023-07-extraordinary-03-chinjo-1`（採択）・
  `2023-12-chinjo-3`（不採択）・`2024-06-chinjo-5`（採択）・`2025-03-chinjo-6`（継続審査）
  ※陳情は全9件中4件のみ採用（結果の多様性を優先、残りは次回以降）。

### ルーティング・ページ設計（未実装）

- `/ordinances`・`/ordinances/:slug`（新規、条例アーカイブ専用）
- `/petitions`・`/petitions/:slug`（新規、請願）
- `/requests`・`/requests/:slug`（新規、陳情）
- `/bills`・`/bills/[slug]`は**新設しない**（上記理由により既存`/bills/votes`系を維持）
- 請願・陳情はデータ構造がほぼ同一のため、実装時は1ファイル
  （例：`src/pages/PetitionsRequestsPage.tsx`）から`PetitionsPage`/`PetitionDetailPage`/
  `RequestsPage`/`RequestDetailPage`の4つをexportする形で重複実装を避けられる
  （`App.tsx`の`lazy()`は名前付きexportを個別importできるため問題なく成立する）。
- 絞り込み：年度（fiscalYear）・会期（sessionId）・結果（result）を各ページに実装する。
  「種別」は各ページがdocumentType単位のため実質不要（条例/請願/陳情でページ自体が
  分かれている）。「提出者」は条例で意味を持つ（proposerType）が、請願・陳情は
  ほぼ市民提出のため優先度は低い。

### validate-data.mjs・検索インデックスへの追加方針（未実装）

- フェーズ6の`archivePolicies.json`検証ブロック（`scripts/validate-data.mjs`）と
  同じ構成で実装する：id/slug重複、documentType別のresult/status列挙値チェック、
  `legacyBillVoteId`→`billIds`参照整合性（既存`billVotes.json`のIDセットを再利用）、
  `relatedQuestionIds`/`relatedPolicyIds`/`relatedMemberIds`等の参照整合性、
  `voteEntries[].memberId`の参照整合性、sourceRefs必須、null/0の区別
  （`ArchiveOrdinanceDetail`の日付フィールドは未確認=undefined、確認済みのみ設定）。
  条例↔請願・陳情の相互不整合チェック（例：`ordinanceDetail`が`documentType!=="ordinance"`
  なのに設定されている等）も追加する。
- `scripts/generate-search-index.mjs`にフェーズ6の政策パターンを踏襲して追加する
  （所有者名・関連質問・関連政策等をkeywordsに、AI生成物があれば分離）。

## 次セッション開始時の推奨手順

1. `git log --oneline -10`と`git status`で本メモと状態が一致しているか確認。
2. `npm run validate:data && npm run typecheck`で現状に問題がないか確認。
3. 本メモの「フェーズ7：調査結果」をそのまま実装に落とし込む
   （調査・設計は完了済みのため、型定義の追記から着手できる）。
4. 実装順序の目安：(1) 型定義追記 → (2) `archiveCouncilDocuments.json`（初期10件） →
   (3) `src/lib/archiveCouncilDocuments.ts`（ラベル・所有者解決等のヘルパー） →
   (4) ページ（Ordinances→Petitions/Requests） → (5) ルーティング/SEO/サイトマップ →
   (6) 検索インデックス → (7) validate-data.mjs → (8) 検証・コミット。

## 既知の注意点・落とし穴（継続）

- **`npm run build`実行のたびに`src/data/siteUpdate.json`のタイムスタンプだけが更新される**。
  実データ変更を伴わない場合はコミットせず`git restore`で戻してよい（本セッションでも実施）。
- `src/data/searchIndex.json`は生成物だがGit管理下にある。`generate-search-index.mjs`を
  変更した場合は再生成して差分をコミットに含めること。
- 令和年→西暦の変換式：`西暦 = 2018 + 令和年`（`scripts/lib/minutes-source.mjs`の
  `REIWA_START_YEAR`を参照）。
- 比較ページの命名規則は`/xxx/compare`ではなく`/compare/xxx`
  （既存の`/compare/mayors`・`/compare/policies`等に合わせる）。

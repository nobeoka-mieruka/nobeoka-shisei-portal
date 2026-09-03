# Phase207 一次資料だけで説明できる議案の一括改善

生成日：2026-09-03
対象：`src/data/billVotes.json`（議案総数 **1,177件は不変**）
適用スクリプト：`scripts/apply-phase207-explanations.mjs`（`--apply` で書き込み／再実行しても冪等）
機械可読版：`reports/phase207-apply-summary.json`／適用後の再分類：`reports/phase207-after-apply-explainability.json`

新規のオンライン調査は行っていない。既に `billVotes.json` の `verificationNote` と
`reports/phase160-held-for-future-56.json` に**原文引用として記録済み**の会議録本文だけを使っている。

---

## 何をしたか

### 1. `EXPLAINABLE_FROM_PRIMARY` 30件 → 個別の説明を掲載（Level2 → Level3）

Phase206 で、Level2 の153件のうち「verificationNote に会議録原文の引用があり、その引用が
議案名の言い換えではなく、議案名からは分からない事実（指定管理者となる団体名・事故の経緯・
工事の内容など）を含む」30件を特定した。

この30件は、以前のフェーズが「『本案は』等で始まる定型の提案理由文が抽出できなかった」ため
Level2 に据え置いていたもので、**材料が無かったのではなく、抽出ルールが一致しなかった**案件である。
Phase207 では、その原文を **一字も変えずに** `reason` へ登録し、`summary` を既存 Level3 と同じ書式
（原文引用＋議決結果＋出典の断り書き）に置き換えた。要約・言い換え・目的や効果の補完は一切していない。

原文と完全一致することは `scripts/test-bill-phase206-explainability.mjs` が自動検証する。

### 2. `SHARED_REASON` 146件 → 共通説明を原文のまま掲載（個別理由としては書かない）

複数議案が一括で提案説明され、**共通の説明しか存在しない**議案。
共通説明を `reason`（この議案の提出理由）へ書くと誤解を生むため、新設した
`sharedProposalStatement`（原文引用・会議録ファイル名・URL・確認日・取得元）へ入れた。

- **56件**：Phase160 が会議録本文まで確認し原文引用まで記録しながら `billVotes.json` へ反映せず
  保留していた分（`reports/phase160-held-for-future-56.json`）。あわせて `sourceTextVerifiedAt`
  を記録した（Level1 → Level2）。新規調査ゼロ。
- **90件**：既に Level2 で、`verificationNote` に一括説明の原文引用が記録されていた分（段階は不変）。

### 3. 市民向けの表示

「説明未整備」とだけ表示しない。`src/lib/billExplainability.ts` の変換表により、議案詳細ページでは
内部コードではなく次のように表示する（`src/pages/BillVoteDetailPage.tsx`）。

| 内部コード（画面に出さない） | 画面表示 |
| --- | --- |
| `NO_INDIVIDUAL_REASON_CONFIRMED` | 一次資料では、この議案だけの提案理由を確認できませんでした |
| `SHARED_REASON` | 他の議案とまとめて説明されています（＋会議録原文の引用と出典リンク） |
| `SOURCE_NEEDS_STRUCTURING` | 会議録は公開されていますが、この議案の内容はまだ整理できていません |
| `SOURCE_INSUFFICIENT` | この議案の会議録がまだ公表されていません |
| `HUMAN_REVIEW` | 内容の確認に人の判断が必要なため、確認を続けています |

---

## 件数

| 項目 | 値 |
| --- | ---: |
| 処理候補（Phase206 で確定） | 176件（EXPLAINABLE 30 ＋ SHARED_REASON 146） |
| 実際に反映した件数 | 176件 |
| 除外（原文から安全に書けない等） | 0件 |
| 出典（sourceRef）を確認した件数 | 798件（説明または共通説明を持つ全議案。欠落 **0件**） |
| 推測混入で除外した件数 | 0件（推測が必要な案件はそもそも候補に入れていない） |
| `HUMAN_REVIEW` へ移した件数 | 199件（Phase206 の分類時点。Phase207 では書き込まない） |

### 説明段階の変化

| 段階 | Phase206 まで | Phase207 適用後 | 差分 |
| --- | ---: | ---: | ---: |
| Level1（議案名・議決結果・出典のみ） | 402 | 346 | −56 |
| Level2（一次資料本文を確認済み） | 153 | 179 | ＋26（−30 ＋56） |
| Level3（一次資料に基づく説明あり） | **622** | **652** | ＋30 |
| 本文確認済み（sourceTextVerifiedAt） | 775 | 831 | ＋56 |
| 議案総数 | 1,177 | 1,177 | 0 |

### 適用後の残り 525件の内訳

| 分類 | 件数 |
| --- | ---: |
| `EXPLAINABLE_FROM_PRIMARY` | 0 |
| `NO_INDIVIDUAL_REASON_CONFIRMED` | 27 |
| `SHARED_REASON` | 146 |
| `SOURCE_NEEDS_STRUCTURING` | 129 |
| `SOURCE_INSUFFICIENT` | 24 |
| `HUMAN_REVIEW` | 199 |
| 合計 | 525 |

---

## 使ったフィールド（新設は最小限）

先に既存フィールドを確認し、次のものをそのまま使った。

| 求められた項目 | 使った既存フィールド |
| --- | --- |
| `billId` | `id` |
| `explanation` | `reason` / `summary`（Level3 の既存書式） |
| `evidence`（sourceRef） | `transcriptUrl` / `relatedDocumentUrls`（`sourceType: "会議録"`） |
| `verificationStatus` | `verificationStatus`（既存） |
| `generatedFrom` | `summarySource`（既存）＋ `sharedProposalStatement.generatedFrom` |
| `reviewedAt` | `sourceTextVerifiedAt` / `lastVerified`（既存） |

新設したのは `sharedProposalStatement` の1つだけ。理由：共通説明を既存の `reason` に入れると
「この議案固有の提案理由」と誤って伝わるため、両者を必ず分けて保持する必要がある。

---

## やらなかったこと

- `NO_INDIVIDUAL_REASON_CONFIRMED` 27件への説明文生成（一次資料に個別の理由が無いことを確認済み。
  ここに文章を書くのは推測の混入になる）
- `SOURCE_NEEDS_STRUCTURING` 129件・`SOURCE_INSUFFICIENT` 24件・`HUMAN_REVIEW` 199件への書き込み
- 会議録の新規取得・新規オンライン調査
- `RELEASE_SNAPSHOT.md` / `reports/release-snapshot.json` の更新（統合時に親が更新する）

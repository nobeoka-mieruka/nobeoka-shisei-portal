# Phase133：現地調査用「未解決資料リスト」生成

作成日：2026-08-25
担当：Phase133 worker
ブランチ：`phase133-field-research-checklist`

---

## 0. 実施内容

CLAUDE.mdの編集方針（推測禁止、確認できない情報は「確認中」等で明示、出典・基準日必須）に従い、**新規のオンライン検索・WebFetch・WebSearchは一切行わず**、既存の調査済み資料のみを機関ごとに整理し直した。

読み込んだ既存資料：

- `reports/phase33-master-unresolved-ledger.json`（UNR一覧、特にUNR-014・UNR-015・UNR-029）
- `reports/phase19-resource-dossier.md`・`reports/phase19-missing-years-matrix.json`・`reports/phase19-onsite-research-plan.md`
- `reports/phase20-missing-years-status.json`・`reports/phase21-inquiry-ready-to-send.md`・`reports/phase21-inquiry-tracker.json`
- `reports/phase119-123-staging/phase121-history-findings.md`
- `TASKS.md` TASK-046（`src/data/blockedTaskClassification.json`のsourceInventory・reopenConditions）
- `reports/phase125-129-staging/phase127-finance-mayor-gaps-report.md`（宮崎県文書センター新規候補資料）
- `reports/phase99-108-staging/phase102-103-term-gaps-findings.json`（市長任期13区間の資料対応表、M1〜M13）

---

## 1. 成果物

| ファイル | 内容 |
|---|---|
| `reports/field-research/onsite-research-checklist.md` | 人間が印刷・携行して使えるMarkdown版チェックリスト（機関ごとにチェックボックス形式） |
| `reports/field-research/onsite-research-checklist.json` | 機械可読JSON版（`statusCategories`は既存語彙〔reference_pending／library_required／inquiry_required等〕と整合） |

---

## 2. 概要

- **対象機関数**：9機関
  1. 宮崎県立図書館（情報提供課・郷土情報担当）
  2. 延岡市立図書館（郷土資料担当）
  3. 延岡市役所（財政課・総務課）
  4. 延岡市議会事務局
  5. 延岡市選挙管理委員会
  6. 延岡市教育委員会事務局
  7. 宮崎県総合政策部統計調査課
  8. 宮崎県文書センター（宮崎県総務部総務課）
  9. 国立国会図書館（東京本館・関西館）

- **対象UNR件数**：13件（UNR-001, 002, 003, 004, 005, 006, 007, 008, 014, 015, 016, 027, 029）
- **対象タスク**：TASK-046（1999年以前市議選候補者別結果）
- **チェックリスト項目数**：15項目（機関×資料テーマの組み合わせ。UNR-029は別途M1〜M13の13区間×資料対応表を補足セクションに整理）
- **除外した項目**：UNR-009（助役6〜10代の任期。primaryRouteがC＝NDL再読で、現地調査ではなくオンライン再読が正しいルートのため）、UNR-028（中井一萬氏の人物特定。一次資料が本チェックリストの照会対象と一致しないため別枠）

---

## 3. 主な発見（既存資料の再整理で判明した状態）

- **INQ-001（宮崎県立図書館）・INQ-002（宮崎県統計調査課）は2026-08-21に送付済み**で、`reports/phase21-inquiry-tracker.json`上は`sendStatus=sent, responseStatus=waiting_response`のまま。本Phaseの時点（2026-08-25）で回答が記録された形跡はない。次のアクションは「回答状況の確認」であり、新規の照会文送付ではない。
- INQ-003（延岡市立図書館）はready_to_send状態でINQ-001の回答待ち、INQ-004〜INQ-009（延岡市役所・議会事務局・選挙管理委員会・教育委員会）はすべてdraft（未送付）のまま。
- UNR-014（財政欠落FY1934-1948）はPhase127（2026-08-25、同日実施の別フェーズ）で宮崎県文書センターの簿冊番号レベルの新規候補（5043・107051等）が見つかり、`not_collected`→`reference_pending`へ既に前進済み。本Phaseではこの状態を変更せず、簿冊番号を機関別チェックリストへ転記した。
- UNR-029（市長任期13区間）は`requiresOnsite`/`requiresInquiry`フラグ自体はfalseのままだが、Phase102-103・Phase121の実際の分類は全区間`library_required`。フラグと実際の分類が食い違っている点はそのまま維持し（ステータス変更はしない）、チェックリストでは実際の分類（library_required）を採用して機関別に整理した。

---

## 4. 変更ファイル

新規作成のみ（既存データファイルの変更なし）：

- `reports/field-research/onsite-research-checklist.md`（新規）
- `reports/field-research/onsite-research-checklist.json`（新規）
- `reports/phase130-134-staging/phase133-field-research-checklist-report.md`（本ファイル、新規）

`reports/phase33-master-unresolved-ledger.json`・`src/data/blockedTaskClassification.json`・`TASKS.md`・`PROJECT_PLAN.md`はいずれも変更していない。

---

## 5. 検証結果

本タスクはドキュメント整理のみでソースコード・データファイルの変更を伴わないため、`npm run validate:data`・`typecheck`・`lint`・`build`への影響はない（未実行）。JSON成果物は`node -e "require(...)"`で構文妥当性を確認済み（institutions: 9, items: 15）。

---

## 6. 今後の課題

- 実際の送付・訪問は本ポータル運営者（人間）が行う。
- 訪問・照会が完了した場合は、`reports/phase21-inquiry-tracker.json`・`reports/phase33-master-unresolved-ledger.json`・`src/data/blockedTaskClassification.json`の該当レコードを更新すること（本Phaseでは更新していない）。
- 国立国会図書館・宮崎県文書センターの正確な所在地（住所）は既存資料に記載がなく、本チェックリストでも「確認中」のままとした。必要であれば公式サイトで確認のうえ追記する。

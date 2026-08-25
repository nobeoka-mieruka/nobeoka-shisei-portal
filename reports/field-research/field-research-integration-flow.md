# 現地調査結果→ポータル反映フロー設計（Phase145統合版）

作成日：2026-08-25（親セッション、TASK-171 Phase145として作成。workerとして起動していない）
対象読者：本サイト運営者（人間）が現地調査結果をポータルへ反映する際の標準フロー

**本ドキュメントは新規のオンライン検索・WebFetch・WebSearchを一切行わず、Phase141〜144の成果物
（`reports/field-research/print/`・`field-visit-order.md`・`inquiry-final/`・
`inquiry-status.json`・`src/types/fieldResearch.ts`・`reports/field-research/templates/`）を
統合し、反映フローを設計しただけのものです。既存のUNR・BLOCKEDステータス、既存コード・データは
変更していません。**

---

## 1. 目的

現地調査結果（`src/types/fieldResearch.ts`の`FieldResearchRecord`形式で記録されたもの）を、
**推測や手作業ミスを防ぎながら**ポータルへ反映するための標準フローを定義する。

**中心原則**：「現地で見た」というだけでは何も自動的にGREENにはならない。すべての反映は
出典（資料名・ページ・確認内容）とtrustLevelが揃って初めて候補となり、最終的な書き込みは
人間が承認する。

---

## 2. 反映フロー（20ステップ）

```
 1. 現地調査結果JSON受領
    └ reports/field-research/templates/README.md の記入手順に沿って作成された
      FieldResearchRecord[]（field-research-result.schema.json準拠）を受け取る

 2. schema validation
    └ field-research-result.schema.json に対してJSON Schemaバリデーション
      （必須フィールド欠落・型不一致を機械的に検出）

 3. UNR ID照合
    └ record.unrId が reports/phase33-master-unresolved-ledger.json に
      実在するIDかを確認（存在しないIDは受理しない）

 4. 出典情報確認
    └ materialTitle・page等、confirmedFactを裏付ける書誌情報が
      空でないか確認（result=NOT_FOUND/ACCESS_DENIEDの場合は書誌情報が
      部分的でも許容するが、その場合もresultの妥当性を確認する）

 5. trustLevel確認
    └ src/types/sourceTrust.ts の ArchiveSourceTrustLevel
      6区分のいずれかであることを確認（未設定は許容、独自値は拒否）

 6. 既存データとの矛盾チェック
    └ 対応するsrc/data配下の既存レコード（archiveFiscalYears.json・
      archiveMayorTerms.json等）とconfirmedFactを突き合わせ、
      一致／新規／矛盾のいずれかに分類する

 7. CONTRADICTEDの場合は自動上書き禁止
    └ result=CONTRADICTEDのレコードは、この時点で自動反映対象から除外し、
      「矛盾案件リスト」へ退避する（8以降のフローへ進めない）

 8. RESOLVEDの場合のみ更新候補生成
    └ unrResolution=RESOLVED かつ result=CONFIRMED/PARTIALLY_CONFIRMED の
      レコードのみ、src/data等への反映候補（差分パッチ案）を生成する

 9. dry-run
    └ 実際にはファイルを書き換えず、反映した場合の差分内容のみを出力する
      （将来スクリプト化する場合は `--dry-run` をデフォルト動作とする）

10. diff確認
    └ dry-run結果を人間が目視で確認する（自動承認しない）

11. validation
    └ 反映候補を仮適用した状態で npm run validate:data・validate:sources・
      validate:finance 等、対象データに応じたvalidationを実行する

12. typecheck
    └ npm run typecheck（型定義への影響がある場合、または念のため）

13. lint
    └ npm run lint

14. test
    └ npm run test

15. build
    └ npm run build（prerender・validate:seo・validate:contentを含む既存のbuildスクリプト）

16. 人間承認
    └ 9〜15がすべて成功したうえで、実際にsrc/dataへ書き込むかどうかを
      人間が最終判断する（このステップを機械的にスキップしない）

17. commit
    └ 承認された変更のみをコミット（出典・確認日を明記したコミットメッセージ）

18. push
    └ git push origin main（既存のGit運用方針に従う）

19. Cloudflare Pages反映確認
    └ wrangler pages deployment list 等で本番反映を確認する

20. UNR ledger更新
    └ reports/phase33-master-unresolved-ledger.json・
      reports/field-research/unr-priority-master.json・
      reports/phase21-inquiry-tracker.json・reports/field-research/inquiry-status.json の
      該当レコードのstatusを人間が更新する（自動更新しない）
```

---

## 3. 絶対ルール（Phase145で追加確認・既存方針を再整理）

- 現地で見たというだけで自動GREENにしない（フロー16「人間承認」を必ず経由する）。
- 資料名・ページ・確認内容がないものは反映しない（フロー4で機械的に弾く）。
- CONTRADICTEDは上書きせず矛盾案件として保持する（フロー7）。既存データを削除・上書きせず、
  「矛盾案件リスト」（例：`reports/field-research/results/contradictions.json`、今後の運用で
  作成）に記録し、次回のオンライン調査・追加照会で解消を試みる。
- NOT_FOUNDは「存在しない」に変換しない。UNRのステータスは`resource_unidentified`
  （見つからなかった）のまま維持し、「確定的に存在しない」という新しいステータスは作らない。
- 写真だけで書誌情報不明の場合は要再確認（フロー4で保留、`NEEDS_FOLLOWUP`として扱う）。
- OCR結果だけを確定値として採用しない（`extractionMethod`に相当する情報として記録し、
  人間の目視確認を経てから確定値とする。既存の`ArchiveSourceRef.extractionMethod`の
  `"manual" | "pdf-extraction" | "official-api" | "other"`という区分の考え方を踏襲）。
- 手入力値と一次資料が違う場合は一次資料を優先するが、自動修正せず差分を報告する
  （フロー6「既存データとの矛盾チェック」・フロー10「diff確認」で人間に提示する）。
- 既存履歴を削除しない。
- `src/data/updateHistory.json`等へ変更履歴を残す（既存のPhase124のu128〜u131のような、
  市民向け更新履歴エントリの追加を、反映内容が市民向けページの表示に影響する場合は検討する。
  内部専用データ・UNRステータスの更新のみの場合は、`reports/`側の記録で足り、
  updateHistory.jsonへの追加は必須ではない）。

---

## 4. 将来用スクリプト候補（設計のみ、今回package.jsonへの追加は行わない）

ユーザー指示に基づき、以下は**設計のみ**で実装は見送る（既存`package.json`への無理な追加を
避けるため）。将来これらを実装する場合の方針を示す。

### `npm run field-research:validate`
- 入力：`reports/field-research/results/*.json`（将来、現地調査結果を保存する想定ディレクトリ、
  今回は未作成）
- 動作：`field-research-result.schema.json`によるJSON Schemaバリデーション（フロー2〜5相当）
- 失敗時：exit code非0、該当ファイル・フィールドを明示してエラー終了

### `npm run field-research:dry-run`
- 動作：`field-research:validate`を内包したうえで、フロー6〜10（矛盾チェック・更新候補生成・
  diff出力）を実行する。**ファイルへの書き込みは一切行わない**（dry-runがデフォルトかつ唯一の
  動作、`--apply`等のフラグなしでは絶対に書き込まない設計とする）
- 出力：想定される差分（unified diff形式または変更前後のJSON比較）をコンソールまたは
  `reports/field-research/dry-run-output/`へ出力

### `npm run field-research:apply`
- 動作：`field-research:dry-run`の出力を人間が確認した後、**明示的な実行のみ**で
  実際にsrc/dataへ書き込む（フロー16〜17相当の一部を機械化する場合の想定）
- 制約：
  - dry-runを経ずに直接applyできないようにする（applyの前提としてdry-run結果の
    確認ログまたはハッシュ一致を要求する等の設計を検討）
  - 自動デプロイ（git push・Cloudflare反映）はスクリプトの範囲外とし、コミットまでで止める
    （pushは既存のCLAUDE.md方針どおり、問題なければ人間または別セッションが判断する）
  - 実行前に対象ファイルのバックアップを取る、またはgit diffで復元可能な状態
    （作業ツリーがクリーンな状態でのみ実行を許可する等）を確認できるようにする
  - validate:data等のvalidationが失敗した場合は書き込みを中止する（部分適用しない）

**実装時期**：現地調査結果が実際に蓄積され始めてから（`reports/field-research/results/`が
複数件たまった段階で）着手するのが妥当。現時点（Phase145時点）では現地調査自体が未実施のため、
スクリプトを先行実装しても検証データが無く、設計のみに留めた。

---

## 5. Phase145統合監査結果

| 確認項目 | 結果 |
|---|---|
| Phase141成果物 | `reports/field-research/print/`9ファイル（UNR31件を21枚の詳細カード＋10件の内部作業用簡易表で網羅、施設別分割7ファイル含む）を確認 |
| Phase142成果物 | `reports/field-research/field-visit-order.md`（1日案・複数日案、INQ-001/002確認を0番目に配置）を確認 |
| Phase143成果物 | `reports/field-research/inquiry-final/`10ファイル＋`inquiry-status.json`（全18照会、うち送付済み2・WAITING_RESPONSE 2）を確認 |
| Phase144成果物 | `src/types/fieldResearch.ts`・JSON Schema・サンプル・READMEを確認。typecheck/lint実行済みでクリーン |
| UNR31件 | `reports/phase33-master-unresolved-ledger.json`を再集計し、Phase145時点でも**31件のまま変化なし**（Phase141〜144は新規一次資料調査を行っていないため、想定どおり変化なし） |
| inquiry status | `inquiry-status.json`で全18件（INQ-001〜018）を一元管理できることを確認 |
| WAITING_RESPONSE | 2件（INQ-001宮崎県立図書館、INQ-002宮崎県統計調査課、いずれも2026-08-21送付） |
| FIELD_VISIT / NDL_ONSITE | Phase136の`unr-priority-master.json`（FIELD_VISIT=7、NDL_ONSITE=8）から変化なし |
| 現地資料候補 | 宮崎県文書センター簿冊番号5043・107051を含め、Phase141〜144のいずれの成果物でも「請求番号（識別子）」として一貫して扱われており、件数との誤表示は無いことを確認 |
| trustLevel整合性 | Phase144の`fieldResearch.ts`が`src/types/sourceTrust.ts`の`ArchiveSourceTrustLevel`をそのままimportして再利用しており、新しい独自定義は無いことを確認 |
| UNR ID整合性 | Phase141の各カードのUNR IDと`phase33-master-unresolved-ledger.json`のID一覧を突合し、31件すべてが1対1で対応していることを確認（過不足なし） |

**結論**：UNR件数は31件のまま変化していない（Phase141〜145は新規一次資料調査を行っていないため、
想定どおり）。全worker成果物間で矛盾・重複は見つからなかった。

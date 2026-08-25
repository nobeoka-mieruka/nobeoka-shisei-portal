# 照会文書 最終化 一覧（Phase143）

作成日：2026-08-25

本フォルダは、Phase138（`reports/field-research/inquiry-drafts/`）で作成した草案を土台に、実際に人間が送信・持参できる完成品質へ仕上げた照会文書、および宮崎県文書センター向けの新規文案をまとめたものである。

**新しいオンライン検索・WebFetch・WebSearchは一切行っていない。実際の送信・送付は一切行っていない（Claude Codeからの自動送信はない）。既にINQ-001・INQ-002として送付済みの内容は再作成していない。**

各照会文書の送付・回答状況は `reports/field-research/inquiry-status.json` で一元管理する（`inquiryId`／`institution`／`targetUNRs`／`status`／`sentAt`／`responseAt`／`nextAction`）。

---

## 1. 既に送付済み（本Phaseでは再作成しない）

| 照会ID | 宛先 | 状態 | 出典 |
|---|---|---|---|
| INQ-001 | 宮崎県立図書館（情報提供課・郷土情報担当） | **送付済み（2026-08-21）・回答待ち** | `reports/phase21-inquiry-ready-to-send.md`（照会文1）、`reports/phase21-inquiry-tracker.json` |
| INQ-002 | 宮崎県総合政策部統計調査課 | **送付済み（2026-08-21）・回答待ち** | `reports/phase21-inquiry-ready-to-send.md`（照会文2）、`reports/phase21-inquiry-tracker.json` |

上記2件は、`reports/phase21-inquiry-tracker.json`の既存レコードをそのまま正とし、本Phaseでは文案の再作成・再編集は行っていない。`inquiry-status.json`にも送付済み（`waiting_response`）として引き継いでいる。次のアクションは回答の確認のみである。

## 2. 送付可能な条件付き待機（既存、対象範囲が狭いため広い版を優先）

| 照会ID | 宛先 | 状態 | 備考 |
|---|---|---|---|
| INQ-003 | 延岡市立図書館（郷土資料担当） | ready_to_send（条件付き） | INQ-001の回答で「所蔵なし」と判明した場合に送付 |
| INQ-004 | 延岡市役所（財政課／総務課・情報公開担当） | draft | 対象範囲がより広いINQ-010・INQ-011・INQ-014に統合可能。どちらか一方のみ送付し重複を避ける |
| INQ-005 | 延岡市議会事務局（1970年代限定） | draft | 対象範囲がより広いINQ-012に統合可能。どちらか一方のみ送付し重複を避ける |
| INQ-006 | 延岡市選挙管理委員会（1975/78/82年市長選挙限定） | draft | 対象範囲がより広いINQ-013に統合可能。どちらか一方のみ送付し重複を避ける |
| INQ-007 | 延岡市教育委員会事務局 | draft | 本Phaseの対象8部署に含まれないため変更なし |
| INQ-008 | 宮崎県立図書館（早生隆彦氏生年月日等） | draft | 変更なし |
| INQ-009 | 延岡市立図書館（郷土資料） | draft | 変更なし |

## 3. 本Phase（Phase143）で最終化した照会文書

Phase138の`inquiry-drafts/`を土台に、件名／調査目的／調べたい事実／対象年代／資料名／具体的質問／閲覧方法確認／複写可否確認／情報公開請求要否の確認、を全文書に明記する形へ仕上げた。

| 照会ID | ファイル | 宛先部署 | 対象UNR | ステータス |
|---|---|---|---|---|
| INQ-010 | `soumu-ka.md` | 延岡市役所 総務課（法制第1係） | UNR-014, 015, 027, 029 | ready_to_send |
| INQ-011 | `zaisei-ka.md` | 延岡市役所 財政課 | UNR-014, 015, 027 | ready_to_send |
| INQ-012 | `gikai-jimukyoku.md` | 延岡市議会事務局 | UNR-005, 008, 009, 010, 011, 016, 022, 031 | ready_to_send |
| INQ-013 | `senkyo-kanri-iinkai.md` | 延岡市選挙管理委員会 | UNR-001〜004, 016, 028, 029 | ready_to_send |
| INQ-014 | `johokoukai-tantou.md` | 延岡市役所 情報公開担当（エスカレーション用） | UNR-014, 015, 027 | ready_to_send（条件付き） |
| INQ-015 | `hisho-tantou.md` | 延岡市役所 秘書担当 | UNR-013, 029 | ready_to_send |
| INQ-016 | `koho-tantou.md` | 延岡市役所 広報担当（総合政策課広報広聴係） | UNR-020, 029 | ready_to_send |
| INQ-017 | `tokei-tantou.md` | 延岡市役所 統計担当（所管部署要確認） | UNR-020 | draft（宛先確定待ち） |
| INQ-018 | `miyazaki-monjo-center.md`（新規） | 宮崎県文書センター（宮崎県総務部総務課） | UNR-014, 015 | ready_to_send |

## 4. 送付順序の推奨（Phase138から変更なし・再掲）

1. **総務課（INQ-010）・財政課（INQ-011）**は同じ市役所内で近い部署のため、あわせて1回で照会してよい（宛先は分ける）。
2. **議会事務局（INQ-012）・選挙管理委員会（INQ-013）**はそれぞれ独立して照会する。
3. **秘書担当（INQ-015）・広報担当（INQ-016）・統計担当（INQ-017）**は直接連絡先が未確認のため、まず総務課または代表窓口（0982-34-2111）へ、担当部署の確認を兼ねて照会するとよい。統計担当（INQ-017）は広報担当（INQ-016）の回答で所管部署を確認してから送付する。
4. **情報公開担当（INQ-014）**は、INQ-010〜013の回答で「所在不明」「正式な手続きが必要」と案内された場合にのみ、最後のステップとして利用する。
5. **宮崎県文書センター（INQ-018）**は、宮崎県立図書館（INQ-001）・宮崎県統計調査課（INQ-002）の回答と並行して送付して差し支えない（対象簿冊が異なる別組織のため）。
6. 送付済みの**INQ-001・INQ-002は重複送信しない**。回答を待ち、届いたら`inquiry-status.json`を更新する。

## 5. 回答を得た場合の共通反映手順（Phase138から変更なし）

1. `reports/field-research/inquiry-status.json`の該当レコードの`status`・`responseAt`・`nextAction`を更新する（人間が行う）。
2. `reports/phase33-master-unresolved-ledger.json`の該当UNRの`currentStatus`・`evidenceLevel`・`notes`を更新する（人間が行う）。
3. 数値・日付が確認できた場合は、`reports/phase19-onsite-research-plan.md`の登録ルール（confirmed_primaryの条件、原典値と正規化値の分離等）に従って`src/data`へ反映する。
4. 推測・補完は行わない。回答が「不明」「廃棄済み」等だった場合は、その旨を`unresolvedReason`・`notes`に正直に記録する（0件として扱わない）。

以上、既存資料の整理と文案の仕上げのみを行った。実際の送信・送付、情報公開請求の実施はサイト運営者（人間）が行う。

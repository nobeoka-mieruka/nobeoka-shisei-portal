/**
 * 現地調査結果（フィールドリサーチ）記録1件分の型定義（Phase144）。
 *
 * 目的：図書館・市役所・県文書センター・国立国会図書館等への現地訪問・現物閲覧の結果を、
 * 「現地確認 → 記録 → 出典化 → UNR（reports/phase33-master-unresolved-ledger.jsonの
 * 未解決事項）解消判定 → validation」という流れに沿って標準化された形で記録するための型。
 *
 * 位置づけ：
 * - このファイルはUNR台帳（reports/phase33-master-unresolved-ledger.json）・
 *   照会管理（reports/phase21-inquiry-tracker.json）を置き換えるものではない。
 *   現地調査「1回分の記録」を表す型であり、記録の集積結果をどのようにUNR台帳へ
 *   反映するか（unrResolutionを見て人が台帳を更新する）は運用側の作業として残す。
 * - 記入手順・サンプルは reports/field-research/templates/README.md を参照。
 * - JSON Schema版は reports/field-research/templates/field-research-result.schema.json
 *   （このTypeScript型と内容を一致させること）。
 *
 * 独自の信頼度・日付精度の再定義はしない：
 * - 出典の信頼レベルは既存 src/types/sourceTrust.ts の ArchiveSourceTrustLevel を再利用する。
 * - 日付の確認精度は既存 src/types/historicalArchive.ts の ArchiveDatePrecision
 *   （"day" | "month" | "year" の3値）を再利用する。この3値で表現できない場合
 *   （日付そのものが不明・概算にとどまる等）は、既存型に新しい値を追加するのではなく、
 *   datePrecisionフィールド自体を省略する（undefinedのまま）ことで表現する。
 *   理由：3値以外の「不明」を新しい列挙値として既存型に追加すると、既存の
 *   ArchiveMayorTerm.termStartPrecision等、既にこの型を参照している実データ・
 *   コード側の網羅性判定（switch文等）に影響しうるため、既存型は変更せず、
 *   本ファイル側の任意化のみで対応する。
 *
 * まだこの型を使用する実データファイル（src/data配下）・UI画面は存在しない
 * （Phase144はフォーマット設計のみ）。将来、現地調査の記録が蓄積された段階で、
 * 別フェーズにて実データファイル化・UNR台帳への反映・UI表示を検討する。
 */

import type { ArchiveDatePrecision } from "./historicalArchive";
import type { ArchiveSourceTrustLevel } from "./sourceTrust";

/**
 * 現地確認の結果、対象の事実（confirmedFactとして記録しようとしていた事実）が
 * どう扱えたかを表す。「資料が見つかったか」と「事実が確認できたか」を分けず、
 * 現地調査の最終的な結論として一本化した区分。
 *
 * - CONFIRMED: 現地資料により、対象の事実を確認できた（既存の想定・仮説と一致）。
 * - PARTIALLY_CONFIRMED: 対象事実の一部のみ確認できた（他の要素は依然未確認のまま残る）。
 * - CONTRADICTED: 現地資料の記載が、既存データ・想定と異なっていた（矛盾を発見）。
 *   確認できた新事実はconfirmedFactへ記載し、既存データの誤りの可能性を報告すること。
 * - NOT_FOUND: 対象資料そのものが所蔵されていなかった、または資料はあったが該当する
 *   記載が見つからなかった。
 * - ACCESS_DENIED: 資料の所在は把握できたが、非公開・貸出禁止・個人情報保護・
 *   館内規則等の理由で閲覧・複写ができなかった。
 * - NEEDS_FOLLOWUP: 部分的な手がかりは得られたが、他館への複写取り寄せ・追加照会等、
 *   さらなる調査が必要な状態で終わった。
 */
export type FieldResearchOutcome =
  | "CONFIRMED"
  | "PARTIALLY_CONFIRMED"
  | "CONTRADICTED"
  | "NOT_FOUND"
  | "ACCESS_DENIED"
  | "NEEDS_FOLLOWUP";

/**
 * 今回の現地調査結果を受けて、対象UNR（reports/phase33-master-unresolved-ledger.json）を
 * どう扱うべきかの判定。この値自体はUNR台帳を自動更新しない（人が台帳側を確認・反映する
 * ための判断材料として記録する）。
 *
 * - RESOLVED: 今回の結果でUNRは解消したと判断できる（台帳側のstatusを更新してよい）。
 * - KEEP_UNR: 今回の結果では解消に至らず、UNRはそのまま維持する（記録として結果を追加するのみ）。
 * - SPLIT_UNR: 対象UNRが複数の異なる論点を含んでいたことが判明し、分割が必要。
 * - NEW_UNR_REQUIRED: 今回の調査の過程で、対象UNRとは別の新規未解決事項が判明した
 *   （台帳側で新しいUNR IDの採番を検討する）。
 */
export type FieldResearchUnrResolution = "RESOLVED" | "KEEP_UNR" | "SPLIT_UNR" | "NEW_UNR_REQUIRED";

/**
 * 現地調査結果1件分（＝1つの資料・1つの事実確認の試みについての記録）。
 *
 * 必須／任意の設計方針：
 * - 「いつ・誰が・どのUNRについて・何をしに行き・どういう結論だったか」（researchId/unrId/
 *   institution/checkedAt/checkedBy/materialTitle/result/unrResolution）は、
 *   NOT_FOUND・ACCESS_DENIEDのような「見つからなかった」結果でも必ず分かるはずの情報のため
 *   必須とする。
 * - 資料そのものの書誌情報（author/publisher/publicationYear/callNumber/materialId/page）・
 *   内容（originalTextSummary/confirmedFact/datePrecision/trustLevel）・証跡
 *   （sourceUrl/photographed/photoFileName/copied/copyReference）は、資料が見つからなかった
 *   ・閲覧できなかった場合には存在しえないため、任意（optional）とする。
 * - photographed/copiedは「実施したかどうか」自体は常に判定できるため真偽値必須とし、
 *   その詳細（photoFileName/copyReference）のみ任意とする。
 */
export interface FieldResearchRecord {
  /**
   * この記録の一意なID。命名例："FR-20260901-001"（FR-YYYYMMDD-連番）。
   * 詳細な採番規則は reports/field-research/templates/README.md を参照。
   */
  researchId: string;

  /**
   * 調査対象のUNR ID（reports/phase33-master-unresolved-ledger.json の "UNR-001" 等）。
   * 既存UNR台帳とはファイルが分離しているため、参照整合性チェックは
   * npm run validate:data の対象外（reports配下は自動検証対象外の運用に合わせる）。
   * どのUNRとも紐付かない新規発見事項を記録する場合は "UNR-PENDING" 等、
   * 具体的なUNR番号でない旨が分かる値を使い、notesに経緯を書く。
   */
  unrId: string;

  /** 訪問・照会した機関名（例："延岡市立図書館"「宮崎県立図書館 情報提供課」）。 */
  institution: string;

  /** 現地確認・閲覧を行った日（ISO 8601、例："2026-09-01"）。 */
  checkedAt: string;

  /**
   * 記録者（サイト運営者本人、またはその担当者名・ハンドル名）。
   * 第三者（図書館職員等）の氏名は個人情報として記載しないこと（CLAUDE.md準拠）。
   */
  checkedBy: string;

  /**
   * 調査対象として探していた資料の名称（見つからなかった場合も、何を探しに行ったかは
   * 事前のチェックリストから分かるはずのため必須とする）。
   */
  materialTitle: string;

  /** 著者・編者。個人著者がいない場合や不明な場合は省略する（推測で埋めない）。 */
  author?: string;

  /** 発行者・発行機関。不明な場合は省略する。 */
  publisher?: string;

  /**
   * 発行年（西暦）。資料が和暦のみ表記の場合も、換算できた西暦をここに入れ、
   * 元の表記はnotesに残す（推測で変換しない場合は省略する）。
   */
  publicationYear?: number;

  /** 所蔵館の請求記号（例："K210.9/ノ"）。所蔵が確認できた場合のみ設定する。 */
  callNumber?: string;

  /** 所蔵館内部の資料ID・管理番号（請求記号と別体系で管理している館向け）。 */
  materialId?: string;

  /**
   * 該当ページ（例："123"「123-125」「巻末付表」）。ページ表記が不定形な資料が多いため
   * 文字列型とする。NOT_FOUND等、該当箇所自体が無い場合は省略する。
   */
  page?: string;

  /**
   * 該当箇所の原文の要約（原文そのままの引用ではなく、内容の要約。長大な引用の転載は避ける）。
   * CONFIRMED/PARTIALLY_CONFIRMED/CONTRADICTEDの場合は原則として記載する。
   */
  originalTextSummary?: string;

  /**
   * 今回の現地調査で確認できた事実そのもの（既存データへ反映する際の元になる一文）。
   * NOT_FOUND/ACCESS_DENIED/NEEDS_FOLLOWUPで確認できた事実が無い場合は省略する。
   */
  confirmedFact?: string;

  /**
   * confirmedFactに含まれる日付の確認精度。既存 ArchiveDatePrecision
   * （"day" | "month" | "year"）をそのまま再利用する。confirmedFactが日付を含まない場合や、
   * 3値のいずれでも表現できないほど不確か・概算な場合はこのフィールド自体を省略する
   * （新しい精度値は追加しない。詳細はファイル冒頭のコメント参照）。
   */
  datePrecision?: ArchiveDatePrecision;

  /**
   * 確認した資料そのものの信頼レベル。既存 ArchiveSourceTrustLevel をそのまま再利用する
   * （src/types/sourceTrust.ts参照。独自の信頼度区分は新設しない）。
   * 資料に到達できなかった場合（NOT_FOUND/ACCESS_DENIED）は省略する。
   */
  trustLevel?: ArchiveSourceTrustLevel;

  /**
   * 資料の種別を人が分かる形で自由記述する（例："議事録原本" "予算書" "決算書"
   * "市史（延岡市史）" "選挙公報" "統計書" "簿冊（県文書センター所蔵行政文書）"
   * "新聞記事（縮刷版）"）。館・資料ごとに種別の呼び方が大きく異なるため、固定の列挙型に
   * せず自由記述とし、代表的な値の一覧は reports/field-research/templates/README.md に
   * ガイドラインとして示す。
   */
  sourceType?: string;

  /** 資料のデジタル版・オンライン公開版へのURL（存在する場合のみ）。 */
  sourceUrl?: string;

  /** 資料またはその該当箇所を撮影したかどうか（館の規則で撮影不可の場合はfalse）。 */
  photographed: boolean;

  /**
   * 撮影した画像ファイル名（複数可）。photographed=trueの場合のみ意味を持つ。
   * ファイル自体はリポジトリへコミットせず、運営者のローカル・外部ストレージで管理し、
   * ここにはファイル名（または管理用の参照名）のみを記録する。
   */
  photoFileName?: string[];

  /** 複写（コピー・複写取り寄せ）を行ったかどうか。 */
  copied: boolean;

  /** 複写の参照情報（複写申請番号・受領日等）。copied=trueの場合のみ意味を持つ。 */
  copyReference?: string;

  /** 今回の現地調査の結論。FieldResearchOutcome参照。 */
  result: FieldResearchOutcome;

  /** 今回の結果を受けたUNR側の扱い方針。FieldResearchUnrResolution参照。 */
  unrResolution: FieldResearchUnrResolution;

  /**
   * その他の補足メモ（現地の状況、次回訪問時の注意点、和暦の原表記、
   * SPLIT_UNR/NEW_UNR_REQUIRED時の経緯説明等）。公式見解ではない。
   */
  notes?: string;
}

/**
 * 現地調査結果ファイル1本分（複数レコードの配列）。
 * reports/field-research/templates/field-research-result.example.json の形式に対応する。
 */
export type FieldResearchRecordFile = FieldResearchRecord[];

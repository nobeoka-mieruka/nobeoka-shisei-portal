import type { BillVoteItem } from "../../types";
import { InfoIcon } from "../icons";

/**
 * Phase161：意見書・決議・請願・陳情は、市長が提出する条例・予算等の議案とは性質が異なる。
 * 「議案の概要」の機械生成テンプレート文言をそのまま当てはめると、市長提出議案であるかのように
 * 誤解されるおそれがあるため、カテゴリごとに専用の案内文を用意する。
 *
 * 既存フィールド（category・proposer・proposerType・committee）のみを使い、新しいデータは
 * 一切収集しない（本文の推測要約も行わない）。
 */
export function getBillCategoryNoticeText(bill: BillVoteItem): string | undefined {
  const proposerPhrase = (defaultLabel: string): string => {
    if (bill.proposerType === "committee") return bill.proposer ? `${bill.proposer}が提出した` : "議会の委員会が提出した";
    if (bill.proposerType === "member") return bill.proposer ? `${bill.proposer}が提出した` : "議員が提出した";
    return defaultLabel;
  };

  switch (bill.category) {
    case "意見書":
      return `この議案は、市長が提出する予算・条例議案とは異なり、${proposerPhrase(
        "議会（委員会・議員）が提出した",
      )}「意見書」です。意見書は、市議会としての意見を国・県などの関係機関へ提出するための文書で、市の条例やお金の使い道を直接決めるものではありません。`;
    case "決議":
      return `この議案は、市長が提出する予算・条例議案とは異なり、${proposerPhrase(
        "議会（委員会・議員）が提出した",
      )}「決議」です。決議は、ある事項について議会としての意思や態度を表明するもので、市の条例やお金の使い道を直接決めるものではありません。`;
    case "請願":
      return "この案件は、市長や議員が提出する議案とは異なり、市民や団体が議会に提出した「請願」です。請願には地方自治法上、紹介議員（内容に賛同し、議会への提出を仲介する議員）が必要ですが、紹介議員の氏名は現在のデータには含まれていません。議会は、この請願の内容に賛成するかどうかを、採択・不採択などの形で判断します。";
    case "陳情":
      return "この案件は、市長や議員が提出する議案とは異なり、市民や団体が議会に提出した「陳情」です（請願と異なり、陳情には紹介議員は必要ありません）。議会は、この陳情の内容に賛成するかどうかを、採択・不採択などの形で判断します。";
    default:
      return undefined;
  }
}

/**
 * 議決結果（result）から、採決に至らなかった「撤回」「廃案」を、議会が内容に反対した「否決」や
 * 請願・陳情の「不採択」と明確に区別して案内するための文言。
 * 既存のresultフィールドの値のみを用いる（新しいフィールドは追加しない）。
 * emphasize=trueの場合は否決と誤解されやすい「撤回」「廃案」のため、目立つ枠で表示する想定。
 */
export function getBillResultOutcomeNotice(bill: BillVoteItem): { text: string; emphasize: boolean } | undefined {
  const result = bill.result;
  if (result === "撤回") {
    return {
      emphasize: true,
      text: "提出者自身がこの案件を、採決される前に取り下げました。そのため採決は行われていません。議会が内容に反対した「否決」とは異なります。",
    };
  }
  if (result === "廃案") {
    return {
      emphasize: true,
      text: "会期中に議決に至らないまま、この案件は「廃案」となりました。議会が内容に反対した「否決」とは異なります。",
    };
  }
  if (result.includes("否決")) {
    return {
      emphasize: false,
      text: "本会議で採決が行われ、議会がこの内容に反対したため否決されました。",
    };
  }
  if (result.includes("不採択")) {
    return {
      emphasize: false,
      text: "本会議または委員会で審査が行われ、議会がこの請願・陳情の内容の実現を求めないと判断したため、不採択となりました。",
    };
  }
  return undefined;
}

/**
 * 「この議案の種類について」を示す案内ボックス（意見書・決議・請願・陳情のみ表示）。
 * 通常議案（条例・予算等）の「議案の概要」テンプレートとは別に、専用の案内文を表示する。
 */
export function BillCategoryNotice({ bill }: { bill: BillVoteItem }) {
  const text = getBillCategoryNoticeText(bill);
  if (!text) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-low p-3.5 text-sm leading-relaxed text-on-surface">
      <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

/** 「撤回」「廃案」「否決」「不採択」を明確に区別して案内するボックス。該当しない結果では何も表示しない。 */
export function BillResultOutcomeNotice({ bill }: { bill: BillVoteItem }) {
  const notice = getBillResultOutcomeNotice(bill);
  if (!notice) return null;
  if (notice.emphasize) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-xl border-2 border-tertiary bg-tertiary-container p-3.5 text-sm leading-relaxed text-on-tertiary-container">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{notice.text}</p>
      </div>
    );
  }
  return <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">{notice.text}</p>;
}

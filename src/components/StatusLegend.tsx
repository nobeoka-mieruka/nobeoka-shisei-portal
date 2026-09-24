import {
  CITIZEN_STATUS_DESCRIPTIONS,
  CITIZEN_STATUS_LABELS,
  UNCONFIRMED_IS_NOT_ERROR_NOTE,
  type CitizenStatusKey,
} from "../lib/citizenStatusLabels";

const ORDER: CitizenStatusKey[] = [
  "confirmed",
  "underReview",
  "sourceNotPublished",
  "waitingOfficialSource",
  "notIndividuallyAttributable",
  "researchExhausted",
];

/** データの確認状況の凡例（市民向けの日本語表記と、その意味）。 */
export function StatusLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-sm">
      <dl className={compact ? "grid gap-1 sm:grid-cols-2" : "space-y-1.5"}>
        {ORDER.map((key) => (
          <div key={key} className="flex flex-wrap gap-x-2">
            <dt className="font-medium text-on-surface">{CITIZEN_STATUS_LABELS[key]}</dt>
            <dd className="text-on-surface-variant">{CITIZEN_STATUS_DESCRIPTIONS[key]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-on-surface-variant">{UNCONFIRMED_IS_NOT_ERROR_NOTE}</p>
    </div>
  );
}

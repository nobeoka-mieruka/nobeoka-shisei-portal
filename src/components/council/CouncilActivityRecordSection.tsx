import { useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../SectionCard";
import type { ActivityRecordAvailability, CouncilActivityRecord } from "../../lib/councilActivityRecord";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * 確認状況のラベル。
 *
 * 「確認した結果0件」と「まだ確認できていない」「公表されていない」
 * 「誰の行為か分からない」「制度上対象外」を、絶対に同じ0として見せない。
 */
const AVAILABILITY_LABEL: Record<ActivityRecordAvailability, string> = {
  available: "確認済み",
  partial: "一部のみ確認",
  "confirmed-zero": "確認した結果0件",
  "not-acquired": "未取得",
  "not-published": "公式資料が未公表",
  "not-individually-attributable": "個人別の記録なし",
  "not-applicable": "対象外",
};

const AVAILABILITY_CLASS: Record<ActivityRecordAvailability, string> = {
  available: "bg-primary-container text-on-primary-container",
  partial: "bg-tertiary-container text-on-tertiary-container",
  "confirmed-zero": "bg-surface-container-high text-on-surface",
  "not-acquired": "bg-surface-container-high text-on-surface-variant",
  "not-published": "bg-surface-container-high text-on-surface-variant",
  "not-individually-attributable": "bg-surface-container-high text-on-surface-variant",
  "not-applicable": "bg-surface-container-high text-on-surface-variant",
};

/** 値が無いときの表示。0とは書かない。 */
function formatValue(value: number | null, unit: string): string {
  if (value === null) return "―";
  return `${value.toLocaleString("ja-JP")}${unit}`;
}

export function CouncilActivityRecordSection({
  record,
  targetPeriodLabel,
  updatedAt,
}: {
  record: CouncilActivityRecord;
  targetPeriodLabel: string;
  updatedAt?: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const counted = record.sessions.filter((s) => s.countedInDenominator);
  const excluded = record.sessions.filter((s) => !s.countedInDenominator);

  return (
    <SectionCard title="公開記録による議会活動">
      <p className="text-xs leading-relaxed text-on-surface-variant">
        延岡市議会基本条例に定められた議会・議員の役割を基礎に、延岡市議会等が公開する一次資料から確認できる活動を共通の基準で整理・可視化しています。政策内容の優劣、賛否の方向、議員個人の人格・能力を判定するものではありません。
      </p>
      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
        複数の数値を合計した総合点や、議員の順位づけは行っていません。各項目は独立した記録です。
      </p>

      <h3 className="mb-2 mt-4 text-sm font-semibold text-on-surface">一般質問</h3>
      <ul className="space-y-2">
        {record.values.map((v) => {
          const open = openKey === v.key;
          return (
            <li key={v.key} className="rounded-lg border border-outline-variant p-3">
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : v.key)}
                aria-expanded={open}
                className={`flex min-h-11 w-full flex-wrap items-center justify-between gap-2 text-left ${linkClass}`}
              >
                <span className="text-sm font-semibold text-on-surface">{v.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-bold text-on-surface">{formatValue(v.value, v.unit)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${AVAILABILITY_CLASS[v.availability]}`}>
                    {AVAILABILITY_LABEL[v.availability]}
                  </span>
                </span>
              </button>
              {v.numerator != null && v.denominator != null && (
                <p className="mt-1 text-xs text-on-surface-variant">
                  {v.numerator.toLocaleString("ja-JP")}／{v.denominator.toLocaleString("ja-JP")}
                </p>
              )}
              {v.availabilityNote && (
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{v.availabilityNote}</p>
              )}
              {open && (
                <div className="mt-2 space-y-1 border-t border-outline-variant pt-2 text-xs leading-relaxed text-on-surface-variant">
                  <p>{v.description}</p>
                  {v.ordinanceBasis && <p>条例上の根拠：{v.ordinanceBasis}</p>}
                  <p>対象期間：{targetPeriodLabel}</p>
                  <p>使用した一次資料：{v.sourceLabel}</p>
                  {updatedAt && <p>最終更新：{updatedAt}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setSessionsOpen((v) => !v)}
        aria-expanded={sessionsOpen}
        className={`mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline ${linkClass}`}
      >
        {sessionsOpen ? "根拠（会期ごとの内訳）を閉じる" : "根拠を見る（会期ごとの内訳）"}
      </button>
      {sessionsOpen && (
        <div className="mt-2 rounded-lg bg-surface-container-high p-3">
          <p className="text-xs leading-relaxed text-on-surface-variant">
            一般質問実施率の分子・分母に、どの会期が入っているかの内訳です。
            {excluded.length > 0 && "算定の対象外とした会期も、理由とあわせて示しています。"}
          </p>
          <ul className="mt-2 space-y-1.5">
            {record.sessions.map((s) => (
              <li key={s.sessionId} className="text-xs leading-relaxed text-on-surface">
                <span className="font-medium">{s.sessionTitle}</span>
                {!s.countedInDenominator ? (
                  <span className="text-on-surface-variant">：算定対象外{s.excludedReason ? `（${s.excludedReason}）` : ""}</span>
                ) : s.asked ? (
                  <>
                    <span className="text-on-surface-variant">：質問あり</span>
                    {s.transcriptUrl && (
                      <a
                        href={s.transcriptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`ml-1 text-primary underline ${linkClass}`}
                      >
                        会議録
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-on-surface-variant">：質問の記録を確認できませんでした</span>
                )}
              </li>
            ))}
          </ul>
          {counted.length === 0 && (
            <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
              この議員について、算定の対象となる会期はありません。
            </p>
          )}
        </div>
      )}

      <dl className="mt-3 grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-on-surface-variant sm:grid-cols-2">
        <div>
          <dt className="inline">対象期間：</dt>
          <dd className="inline">{targetPeriodLabel}</dd>
        </div>
        {updatedAt && (
          <div>
            <dt className="inline">最終更新：</dt>
            <dd className="inline">{updatedAt}</dd>
          </div>
        )}
      </dl>
      <Link
        to="/methodology/council-activity"
        className={`mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline ${linkClass}`}
      >
        算定方法を見る
      </Link>
    </SectionCard>
  );
}

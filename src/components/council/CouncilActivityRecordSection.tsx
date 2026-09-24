import { useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../SectionCard";
import {
  ACTIVITY_AVAILABILITY_DESCRIPTIONS_JA,
  ACTIVITY_AVAILABILITY_LABELS_JA,
  type ActivityRecordAvailability,
  type ActivityRecordGroup,
  type ActivityRecordListItem,
  type ActivityRecordValue,
  type CouncilActivityRecord,
} from "../../lib/councilActivityRecord";
import { formatJapaneseDate } from "../../config/site";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * 確認状況のラベル。
 *
 * 「確認した結果0件」と「まだ確認できていない」「公表されていない」
 * 「誰の行為か分からない」「制度上対象外」を、絶対に同じ0として見せない。
 * 言葉は一覧・比較と共通の表（ACTIVITY_AVAILABILITY_LABELS_JA）から取る。
 */
const AVAILABILITY_LABEL = ACTIVITY_AVAILABILITY_LABELS_JA;

const AVAILABILITY_CLASS: Record<ActivityRecordAvailability, string> = {
  available: "bg-primary-container text-on-primary-container",
  partial: "bg-tertiary-container text-on-tertiary-container",
  "confirmed-zero": "bg-surface-container-high text-on-surface",
  "not-acquired": "bg-surface-container-high text-on-surface-variant",
  "not-published": "bg-surface-container-high text-on-surface-variant",
  "not-individually-attributable": "bg-surface-container-high text-on-surface-variant",
  "not-applicable": "bg-surface-container-high text-on-surface-variant",
};

const GROUP_TITLE: Record<ActivityRecordGroup, string> = {
  question: "一般質問",
  theme: "政策テーマ",
  council: "議会での活動",
};

const GROUP_NOTE: Record<ActivityRecordGroup, string> = {
  question: "延岡市議会の公式会議録から確認できた記録です。",
  theme: "会議録の見出し語をもとに整理しています。分野の数や広さを比べるものではありません。",
  council: "会議録に議員名が記載されていて、個人に帰属できる記録だけを載せています。",
};

const GROUP_ORDER: ActivityRecordGroup[] = ["question", "theme", "council"];

/** 値が無いときの表示。0とは書かない。 */
function formatValue(value: number | null, unit: string): string {
  if (value === null) return "―";
  return `${value.toLocaleString("ja-JP")}${unit}`;
}

/** 一次資料へのリンク。サイト内は同じタブ、外部は新しいタブで開く。 */
function ItemLink({ url, label }: { url?: string; label?: string }) {
  if (!url) return null;
  const text = label ?? "出典";
  return url.startsWith("/") ? (
    <Link to={url} className={`ml-1 inline-flex min-h-6 items-center text-primary underline ${linkClass}`}>
      {text}
    </Link>
  ) : (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${text}（新しいタブで開く）`}
      className={`ml-1 inline-flex min-h-6 items-center text-primary underline ${linkClass}`}
    >
      {text}
    </a>
  );
}

/** 一次資料の書誌情報。分かっている項目だけを出す。 */
function ItemSource({ source, url }: { source: NonNullable<ActivityRecordListItem["source"]>; url?: string }) {
  return (
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded-md bg-surface px-2.5 py-1.5 text-xs leading-relaxed text-on-surface-variant">
      <dt className="font-medium">資料名</dt>
      <dd className="min-w-0 break-words">{source.title}</dd>
      <dt className="font-medium">発行</dt>
      <dd className="min-w-0 break-words">{source.publisher}</dd>
      {source.date && (
        <>
          <dt className="font-medium">開催日</dt>
          <dd className="min-w-0">{formatJapaneseDate(source.date)}</dd>
        </>
      )}
      {source.locator && (
        <>
          <dt className="font-medium">該当箇所</dt>
          <dd className="min-w-0 break-words">{source.locator}</dd>
        </>
      )}
      {url && !url.startsWith("/") && (
        <>
          <dt className="font-medium">URL</dt>
          <dd className="min-w-0 break-all">{url}</dd>
        </>
      )}
      {source.retrievedAt && (
        <>
          <dt className="font-medium">照合日</dt>
          <dd className="min-w-0">{formatJapaneseDate(source.retrievedAt)}</dd>
        </>
      )}
    </dl>
  );
}

function AvailabilityChip({ availability }: { availability: ActivityRecordAvailability }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${AVAILABILITY_CLASS[availability]}`}>
      {AVAILABILITY_LABEL[availability]}
    </span>
  );
}

function RecordRow({
  value,
  targetPeriodLabel,
  updatedAt,
  sessionsNode,
  excludedCount,
}: {
  value: ActivityRecordValue;
  targetPeriodLabel: string;
  updatedAt?: string;
  sessionsNode: React.ReactNode;
  excludedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const hasEvidence = value.evidenceKind !== "none";
  const items = value.items ?? [];

  return (
    <li data-record-key={value.key} className="rounded-lg border border-outline-variant p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-on-surface">{value.label}</span>
        <span className="flex items-center gap-2">
          {value.kind === "number" && (
            <span className="text-base font-bold text-on-surface">{formatValue(value.value, value.unit)}</span>
          )}
          {value.kind === "list" && (
            <span className="text-base font-bold text-on-surface">
              {items.length > 0 && value.availability !== "not-applicable"
                ? `${items.length.toLocaleString("ja-JP")}件`
                : value.availability === "confirmed-zero"
                  ? // 0と書くのは、資料を確認した結果0件だったときだけ。
                    "0件"
                  : "―"}
            </span>
          )}
          <AvailabilityChip availability={value.availability} />
        </span>
      </div>

      {value.numerator != null && value.denominator != null && (
        <p className="mt-0.5 text-xs text-on-surface-variant">
          {value.numerator.toLocaleString("ja-JP")}／{value.denominator.toLocaleString("ja-JP")}
        </p>
      )}
      {/* 割合の根拠になっている個別の記録の件数。「根拠を見る」で開く一覧の件数と同じ。 */}
      {value.kind === "number" && value.evidenceKind === "items" && (
        <p className="mt-0.5 text-xs text-on-surface-variant" data-item-count={items.length}>
          根拠の記録：{items.length.toLocaleString("ja-JP")}件
        </p>
      )}

      {/* 数字だけを並べた成績表に見えないよう、説明は常に表示する（開かないと読めない状態にしない）。 */}
      <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{value.description}</p>
      {value.availabilityNote && (
        <p className="mt-1 rounded-md bg-surface-container-high px-2.5 py-1.5 text-xs leading-relaxed text-on-surface-variant">
          {value.availabilityNote}
        </p>
      )}

      {hasEvidence && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`mt-1.5 inline-flex min-h-11 items-center text-sm font-medium text-primary underline ${linkClass}`}
        >
          {open ? "根拠を閉じる" : "根拠を見る"}
        </button>
      )}

      {open && (
        <div className="mt-1.5 rounded-lg bg-surface-container-high p-3">
          {/* 第三者が同じ数字を出せるよう、分子・分母と式をそのまま置く。 */}
          {value.numerator != null && value.denominator != null && (
            <dl className="mb-2 space-y-0.5 rounded-md bg-surface p-2.5 text-xs leading-relaxed text-on-surface">
              <div className="flex justify-between gap-2">
                <dt>{value.denominatorLabel ?? "分母"}</dt>
                <dd className="tabular-nums font-medium">{value.denominator.toLocaleString("ja-JP")}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>{value.numeratorLabel ?? "分子"}</dt>
                <dd className="tabular-nums font-medium">{value.numerator.toLocaleString("ja-JP")}</dd>
              </div>
              {/* 会期ごとの内訳（一般質問）の除外数。討論など別の分母を持つ項目には出さない。 */}
              {value.evidenceKind === "sessions" && excludedCount > 0 && (
                <div className="flex justify-between gap-2 text-on-surface-variant">
                  <dt>算定対象外の会期</dt>
                  <dd className="tabular-nums">{excludedCount.toLocaleString("ja-JP")}</dd>
                </div>
              )}
              <p className="mt-1 border-t border-outline-variant pt-1 tabular-nums">
                {value.unit === "%"
                  ? `${value.numerator} ÷ ${value.denominator} × 100 = ${value.value}%`
                  : `${value.numerator} ／ ${value.denominator} = ${formatValue(value.value, value.unit)}`}
              </p>
            </dl>
          )}
          {value.evidenceKind === "sessions" && sessionsNode}
          {value.evidenceKind === "items" &&
            (items.length > 0 ? (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={`${item.label}-${item.detail ?? ""}-${item.url ?? ""}`} className="text-xs leading-relaxed text-on-surface">
                    <span className="font-medium">{item.label}</span>
                    {item.detail && <span className="text-on-surface-variant">：{item.detail}</span>}
                    <ItemLink url={item.url} label={item.urlLabel} />
                    <ItemLink url={item.secondaryUrl} label={item.secondaryUrlLabel} />
                    {item.classificationNote && (
                      <p className="mt-0.5 text-on-surface-variant">{item.classificationNote}</p>
                    )}
                    {item.notCountedReason && (
                      <p className="mt-0.5 text-on-surface-variant">※{item.notCountedReason}</p>
                    )}
                    {item.source && (
                      <ItemSource
                        source={item.source}
                        url={item.url?.startsWith("/") ? item.secondaryUrl : item.url}
                      />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-relaxed text-on-surface-variant">
                {value.availability === "confirmed-zero"
                  ? "一次資料を確認した結果、該当する記録はありませんでした。"
                  : "該当する記録を確認できていません。"}
              </p>
            ))}
          <dl className="mt-2 space-y-0.5 border-t border-outline-variant pt-2 text-xs leading-relaxed text-on-surface-variant">
            <div>
              <dt className="inline font-medium">使用した一次資料：</dt>
              <dd className="inline">{value.sourceLabel}</dd>
            </div>
            <div>
              <dt className="inline font-medium">対象期間：</dt>
              <dd className="inline">{value.periodLabel ?? targetPeriodLabel}</dd>
            </div>
            {value.ordinanceBasis && (
              <div>
                <dt className="inline font-medium">条例上の根拠：</dt>
                <dd className="inline">{value.ordinanceBasis}</dd>
              </div>
            )}
            {updatedAt && (
              <div>
                <dt className="inline font-medium">議員データの最終更新：</dt>
                <dd className="inline">{updatedAt}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </li>
  );
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
  const counted = record.sessions.filter((s) => s.countedInDenominator);
  const excluded = record.sessions.filter((s) => !s.countedInDenominator);

  const sessionsNode = (
    <>
      <p className="text-xs leading-relaxed text-on-surface-variant">
        どの会期を数え、どの会期を算定の対象外にしたかの内訳です。会議録が公開されていない会期は、
        分母にも分子にも入れていません（質問がなかったという意味ではありません）。
      </p>
      <ul className="mt-2 space-y-1.5">
        {record.sessions.map((s) => (
          <li key={s.sessionId} className="text-xs leading-relaxed text-on-surface">
            <span className="font-medium">{s.sessionTitle}</span>
            {!s.countedInDenominator ? (
              <span className="text-on-surface-variant">
                ：算定対象外{s.excludedReason ? `（${s.excludedReason}）` : ""}
              </span>
            ) : s.asked ? (
              <>
                <span className="text-on-surface-variant">：一般質問あり</span>
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
              <span className="text-on-surface-variant">：一般質問の記録を確認できませんでした</span>
            )}
          </li>
        ))}
      </ul>
      {counted.length === 0 && (
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          この議員について、算定の対象となる会期はありません。
        </p>
      )}
    </>
  );

  return (
    <SectionCard title="公開記録による議会活動">
      <p className="text-xs leading-relaxed text-on-surface-variant">
        延岡市議会基本条例に定められた議会・議員の役割を基礎に、延岡市議会等が公開する一次資料から確認できる事実を、共通の基準で整理しています。政策内容への賛否、賛成・反対の方向、議員個人の人格や能力を評価するものではありません。
      </p>
      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
        複数の項目を合計した総合点や、議員の順位づけは行っていません。各項目は独立した記録で、誰と並べても数値は変わりません。
      </p>
      <details className="mt-2 rounded-lg border border-outline-variant px-3 py-1 text-xs leading-relaxed text-on-surface-variant">
        <summary className={`flex min-h-11 cursor-pointer items-center font-medium text-on-surface ${linkClass}`}>
          表示の見方（0・未確認・未公開・個人単位で確認不可・対象外）
        </summary>
        <dl className="mb-2 space-y-1">
          {ACTIVITY_AVAILABILITY_DESCRIPTIONS_JA.map((d) => (
            <div key={d.code}>
              <dt className="inline font-medium text-on-surface">{AVAILABILITY_LABEL[d.code]}：</dt>
              <dd className="inline">{d.text}</dd>
            </div>
          ))}
        </dl>
      </details>

      {GROUP_ORDER.map((group) => {
        const values = record.values.filter((v) => v.group === group);
        if (values.length === 0) return null;
        return (
          <section key={group} className="mt-4">
            <h3 className="text-sm font-semibold text-on-surface">{GROUP_TITLE[group]}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">{GROUP_NOTE[group]}</p>
            <ul className="mt-2 space-y-2">
              {values.map((v) => (
                <RecordRow
                  key={v.key}
                  value={v}
                  targetPeriodLabel={targetPeriodLabel}
                  updatedAt={updatedAt}
                  sessionsNode={sessionsNode}
                  excludedCount={excluded.length}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <dl className="mt-4 grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-on-surface-variant sm:grid-cols-2">
        <div>
          <dt className="inline">対象期間：</dt>
          <dd className="inline">{targetPeriodLabel}</dd>
        </div>
        {updatedAt && (
          <div>
            <dt className="inline">議員データの最終更新：</dt>
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

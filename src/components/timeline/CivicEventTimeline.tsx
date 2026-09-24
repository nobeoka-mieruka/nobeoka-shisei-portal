import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import civicEventTimelineData from "../../data/civicEventTimeline.json";
import {
  CIVIC_EVENT_STATUS_LABELS,
  CIVIC_EVENT_TYPE_LABELS,
  CIVIC_EVENT_TYPES,
  groupCivicEventsByMonth,
  shortDayLabel,
  yearsOfCivicEvents,
  type CivicEvent,
  type CivicEventType,
} from "../../lib/civicEventTimeline";

const allEvents = (civicEventTimelineData as { events: CivicEvent[] }).events;
const years = yearsOfCivicEvents(allEvents);

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function SourceAnchor({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}（外部サイトが新しいタブで開きます）`}
      className={`inline-flex min-h-11 items-center text-xs text-primary underline ${focusRing}`}
    >
      一次資料
      <span aria-hidden>（外部サイト）</span>
    </a>
  );
}

/**
 * 「市政の流れ」：選挙・市長就任・議会の開会・一般質問・議案の提出と議決・予算・決算・委員会・
 * 行政資料の公開を、月ごとに時間順で並べる。重要度では選別せず、種類で絞り込むだけにしている。
 */
export function CivicEventTimeline() {
  const [year, setYear] = useState<number>(years[0]);
  const [activeTypes, setActiveTypes] = useState<Set<CivicEventType>>(new Set(CIVIC_EVENT_TYPES));

  const countsByType = useMemo(() => {
    const m = new Map<CivicEventType, number>();
    for (const e of allEvents) if (e.date.startsWith(String(year))) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return m;
  }, [year]);

  const groups = useMemo(
    () => groupCivicEventsByMonth(allEvents.filter((e) => e.date.startsWith(String(year)) && activeTypes.has(e.type))),
    [year, activeTypes],
  );

  const toggle = (t: CivicEventType) =>
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  return (
    <section aria-labelledby="civic-flow-heading" className="space-y-4">
      <div className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 id="civic-flow-heading" className="text-base font-semibold text-on-surface">
          市政の流れ（月ごと）
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
          議会の開会、一般質問、議案の提出と議決、予算、委員会、選挙などを、時間の順に並べています。
          重要度による選別や並べ替えはしていません。日付は資料で確認できた範囲で表示し、月までしか分からないものに日は付けていません。
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="civic-flow-year" className="text-sm text-on-surface-variant">
            表示する年
          </label>
          <select
            id="civic-flow-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={`min-h-11 rounded-full bg-surface-container-high px-3 text-sm text-on-surface ${focusRing}`}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="表示する出来事の種類">
          {CIVIC_EVENT_TYPES.map((t) => {
            const active = activeTypes.has(t);
            const count = countsByType.get(t) ?? 0;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(t)}
                className={`inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs font-medium transition ${focusRing} ${
                  active ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                {CIVIC_EVENT_TYPE_LABELS[t]}（{count}）
              </button>
            );
          })}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
          {activeTypes.size === 0
            ? "表示する種類を1つ以上選んでください。"
            : `${year}年に、選んだ種類の出来事は登録されていません（出来事が無かったという意味ではありません）。`}
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-labelledby={`civic-month-${g.key}`} className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
            <h3 id={`civic-month-${g.key}`} className="text-base font-semibold text-on-surface">
              {g.label}
            </h3>
            <ol className="mt-2 space-y-3">
              {g.events.map((e) => (
                <li key={e.id} className="border-l-2 border-outline-variant pl-3">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant">
                    <span className="font-medium text-on-surface">{shortDayLabel(e)}</span>
                    <span className="rounded-full bg-secondary-container px-2 py-0.5 text-on-secondary-container">
                      {CIVIC_EVENT_TYPE_LABELS[e.type]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        e.status === "scheduled" ? "border border-outline text-on-surface" : "bg-surface-container-high"
                      }`}
                    >
                      {CIVIC_EVENT_STATUS_LABELS[e.status]}
                    </span>
                  </p>
                  <Link to={e.route} className={`inline-flex min-h-11 items-center text-sm font-semibold break-words text-primary underline ${focusRing}`}>
                    {e.title}
                  </Link>
                  {e.note && <p className="text-xs text-on-surface-variant">{e.note}</p>}
                  {e.sourceUrl && <SourceAnchor url={e.sourceUrl} label={`「${e.title}」の一次資料`} />}
                  {e.items && e.items.length > 1 && (
                    <details className="mt-1">
                      <summary className={`min-h-11 cursor-pointer py-2 text-xs text-primary ${focusRing}`}>
                        内訳を見る（{e.items.length}件）
                      </summary>
                      <ul className="mt-1 space-y-1">
                        {e.items.map((it) => (
                          <li key={it.route} className="text-xs">
                            <Link to={it.route} className={`inline-flex min-h-11 items-center break-words text-primary underline ${focusRing}`}>
                              {it.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </section>
  );
}

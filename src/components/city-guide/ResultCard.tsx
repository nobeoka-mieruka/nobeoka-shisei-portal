import { useEffect, useRef } from "react";
import type { CityGuideEntry } from "../../types/cityGuide";
import { cityGuideConfig, toTelHref } from "../../lib/cityGuide";
import { formatJapaneseDate } from "../../config/site";
import { BuildingIcon, ClockIcon, GlobeIcon, MapPinIcon, PhoneIcon } from "../icons";

interface ResultCardProps {
  entry: CityGuideEntry;
  categoryName: string;
  onRestart: () => void;
  onShowList: () => void;
}

export function ResultCard({ entry, categoryName, onRestart, onShowList }: ResultCardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [entry.id]);

  const hasConfirmedPhone = entry.phone.trim().length > 0;
  const fallbackPhone = cityGuideConfig.representativePhone.trim();
  const displayPhone = hasConfirmedPhone ? entry.phone : fallbackPhone;
  const telHref = toTelHref(displayPhone);
  const consultationSummary = entry.question ?? entry.description;
  const phoneAriaLabel = `${cityGuideConfig.officeName}${entry.department}へ電話する`;

  return (
    <article className="space-y-4">
      <section
        aria-label="診断結果"
        className="rounded-2xl border-2 border-primary bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e2 sm:p-6"
      >
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="rounded text-sm font-semibold text-on-primary-container focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary"
        >
          あなたの相談先はこちら
        </h2>

        <dl className="mt-4 space-y-4">
          <div>
            <dt className="text-xs font-medium text-on-primary-container/70">相談内容</dt>
            <dd className="mt-1 text-base leading-relaxed text-on-primary-container">
              <span className="font-medium">{categoryName}</span>
              {consultationSummary && (
                <span className="mt-0.5 block text-sm text-on-primary-container/90">{consultationSummary}</span>
              )}
            </dd>
          </div>

          <div className="flex items-start gap-2.5">
            <BuildingIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-on-primary-container/70" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-on-primary-container/70">相談先（担当課）</dt>
              <dd className="text-xl font-bold leading-tight break-words text-on-primary-container sm:text-2xl">
                {entry.department}
              </dd>
              {entry.description && (
                <p className="mt-1 text-sm leading-relaxed text-on-primary-container/90">{entry.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <PhoneIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-on-primary-container/70" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-on-primary-container/70">電話番号</dt>
              {telHref ? (
                <dd>
                  <a
                    href={telHref}
                    aria-label={`${phoneAriaLabel}（${displayPhone}）`}
                    className="text-lg font-semibold text-on-primary-container underline decoration-2 underline-offset-2"
                  >
                    {displayPhone}
                  </a>
                  {!hasConfirmedPhone && (
                    <span className="ml-2 align-middle text-xs text-on-primary-container/70">
                      （代表電話・内容をお伝えください）
                    </span>
                  )}
                </dd>
              ) : (
                <dd className="text-sm text-on-primary-container/80">確認中です。延岡市公式ホームページでご確認ください。</dd>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <ClockIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-on-primary-container/70" />
            <div>
              <dt className="text-xs font-medium text-on-primary-container/70">受付時間</dt>
              <dd className="text-sm text-on-primary-container">{cityGuideConfig.officeHours}</dd>
              {cityGuideConfig.note && (
                <p className="mt-0.5 text-xs text-on-primary-container/70">※{cityGuideConfig.note}</p>
              )}
            </div>
          </div>

          {entry.location && (
            <div className="flex items-start gap-2.5">
              <MapPinIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-on-primary-container/70" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-on-primary-container/70">場所</dt>
                <dd className="text-sm text-on-primary-container">{entry.location}</dd>
              </div>
            </div>
          )}

          {entry.officialUrl && (
            <div className="flex items-start gap-2.5">
              <GlobeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-on-primary-container/70" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-on-primary-container/70">公式ページ</dt>
                <dd>
                  <a
                    href={entry.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${entry.department}の延岡市公式ページを新しいタブで開く`}
                    className="inline-block text-sm font-medium break-all text-on-primary-container underline decoration-2 underline-offset-2"
                  >
                    {entry.department}の公式ページを見る
                  </a>
                </dd>
              </div>
            </div>
          )}
        </dl>

        {entry.lastChecked && (
          <p className="mt-4 text-xs text-on-primary-container/60">最終確認日：{formatJapaneseDate(entry.lastChecked)}</p>
        )}

        <p className="mt-3 text-xs leading-relaxed text-on-primary-container/80">
          ※組織変更などにより担当窓口が変更される場合があります。来庁前に電話または延岡市公式ホームページでご確認ください。
        </p>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {telHref && (
          <a
            href={telHref}
            aria-label={phoneAriaLabel}
            className="tap-highlight-none flex min-h-11 items-center justify-center gap-2 rounded-full bg-tertiary px-5 py-3.5 text-base font-semibold text-on-tertiary shadow-e2 transition hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <PhoneIcon aria-hidden="true" className="h-5 w-5 shrink-0" />
            担当窓口へ電話
          </a>
        )}
        {entry.officialUrl && (
          <a
            href={entry.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${entry.department}の延岡市公式ページを新しいタブで開く`}
            className="tap-highlight-none flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-3.5 text-base font-medium text-on-primary-container transition hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <GlobeIcon aria-hidden="true" className="h-5 w-5 shrink-0" />
            延岡市公式ページを見る
          </a>
        )}
        <button
          type="button"
          onClick={onRestart}
          className="tap-highlight-none flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-base font-medium text-on-primary transition hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          最初からやり直す
        </button>
        <button
          type="button"
          onClick={onShowList}
          className="tap-highlight-none flex min-h-11 items-center justify-center gap-2 rounded-full bg-secondary-container px-5 py-3.5 text-base font-medium text-on-secondary-container transition hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          一覧から探す
        </button>
      </div>
    </article>
  );
}

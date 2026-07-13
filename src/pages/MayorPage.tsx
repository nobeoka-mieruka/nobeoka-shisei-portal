import mayorData from "../data/mayor.json";
import type { Mayor, PledgeStatus } from "../types";
import { Avatar } from "../components/Avatar";
import { SnsLinks } from "../components/SnsLinks";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { SourceLink } from "../components/SourceLink";
import { SourceList } from "../components/SourceList";
import { LastUpdatedInfo } from "../components/LastUpdatedInfo";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { PlayIcon, GlobeIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";

const mayor = mayorData as Mayor;

const NO_STATUS_LABEL: PledgeStatus = "確認できる資料なし";

const pledgeStatusClass: Partial<Record<PledgeStatus, string>> = {
  実施済み: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  一部実施: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  実施中: "bg-primary-container text-on-primary-container",
  取組中: "bg-primary-container text-on-primary-container",
  検討中: "bg-surface-variant text-on-surface-variant",
  未着手を確認: "bg-surface-variant text-on-surface-variant",
  方針変更: "bg-[#fff3d6] text-[#7a5900] dark:bg-[#3a2e00] dark:text-[#f2cf6b]",
  中止を確認: "bg-surface-variant text-on-surface-variant",
  確認できる資料なし: "bg-surface-variant text-on-surface-variant",
};

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const termStartEntry = mayor.career.find((c) => c.description.includes("市長") && c.description.includes("就任"));
const termStart = termStartEntry?.year ?? mayor.career[mayor.career.length - 1]?.year;
const pendingPledgeCount = mayor.pledges.filter((p) => !p.status).length;

export function MayorPage() {
  usePageTitle("市長情報");

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <section className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar name={mayor.name} photoUrl={mayor.photoUrl} color="#375ca8" size="xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-on-surface-variant">延岡市長</p>
            <h1 className="text-2xl font-semibold text-on-surface">{mayor.name}</h1>
            <p className="text-sm text-on-surface-variant">{mayor.nameKana}</p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-on-surface-variant sm:justify-start">
              {mayor.termCount && <span>当選{mayor.termCount}回</span>}
              {termStart && (
                <>
                  {mayor.termCount && <span aria-hidden>・</span>}
                  <span>任期 {termStart}〜</span>
                </>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-base leading-loose text-on-surface">{mayor.profile}</p>

        {mayor.officialUrl && (
          <a
            href={mayor.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="延岡市長 公式ホームページを新しいタブで開く"
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition hover:opacity-90 ${linkClass}`}
          >
            <GlobeIcon className="h-4 w-4" />
            公式ホームページ
          </a>
        )}
        <SnsLinks links={mayor.sns} className="mt-4" />
        {mayor.sourceUrl && (
          <a
            href={mayor.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="このページの情報源を新しいタブで開く"
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
          >
            <GlobeIcon className="h-4 w-4" />
            情報源を見る
          </a>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="公約分野" value={mayor.pledges.length} unit="件" />
        <StatCard label="SNS" value={mayor.sns.length} unit="件" />
        <StatCard label="確認できる資料なし" value={pendingPledgeCount} unit="件" />
        <StatCard label="任期開始" value={termStart ?? "情報確認中"} compact />
      </div>

      {mayor.career.length > 0 && (
        <SectionCard title="経歴">
          <ul className="space-y-2">
            {mayor.career.map((c) => (
              <li key={c.id} className="flex gap-3 text-sm">
                <span className="w-28 shrink-0 text-on-surface-variant">{c.year}</span>
                <span className="text-on-surface">{c.description}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="公約">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mayor.pledges.map((p) => (
            <li key={p.id} className="rounded-lg border border-outline-variant p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-on-surface">{p.title}</p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    p.status
                      ? (pledgeStatusClass[p.status] ?? "bg-surface-variant text-on-surface-variant")
                      : "bg-surface-variant text-on-surface-variant"
                  }`}
                >
                  {p.status ?? NO_STATUS_LABEL}
                </span>
              </div>
              {p.category && <p className="mt-1 text-xs text-on-surface-variant">{p.category}</p>}
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-on-surface-variant">
                {p.description}
              </p>
              {(p.statusEvidenceUrl || p.sourceUrl || p.verifiedAt) && (
                <div className="mt-2 border-t border-outline-variant pt-2">
                  {(p.statusEvidenceUrl ?? p.sourceUrl) ? (
                    <SourceLink
                      url={(p.statusEvidenceUrl ?? p.sourceUrl) as string}
                      label={p.statusEvidenceUrl ? "進捗の根拠資料を見る" : "出典を見る"}
                      verifiedAt={p.verifiedAt}
                    />
                  ) : (
                    p.verifiedAt && (
                      <span className="text-xs text-on-surface-variant">最終確認：{p.verifiedAt}</span>
                    )
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      {mayor.policies.length > 0 && (
        <SectionCard title="市政方針">
          <ul className="space-y-3">
            {mayor.policies.map((s) => (
              <li key={s.id} className="rounded-lg border border-outline-variant p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                  {s.date && <span>{s.date}</span>}
                </div>
                <p className="mt-1 font-medium text-on-surface">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{s.body}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {mayor.videos.length > 0 && (
        <SectionCard title="動画">
          <ul className="space-y-2">
            {mayor.videos.map((v) => (
              <li key={v.id}>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${v.title}を新しいタブで開く`}
                  className={`flex items-center gap-3 rounded-lg border border-outline-variant p-3 transition hover:bg-surface-container-high ${linkClass}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
                    <PlayIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-on-surface">{v.title}</span>
                    {v.date && <span className="block text-xs text-on-surface-variant">{v.date}</span>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {mayor.sources && mayor.sources.length > 0 && (
        <SectionCard title="出典・参考資料">
          <SourceList sources={mayor.sources} />
        </SectionCard>
      )}

      <LastUpdatedInfo verifiedAt={mayor.verifiedAt} updatedAt={mayor.updatedAt} className="px-1" />

      <CorrectionRequestButton pageName={`${mayor.name}（市長）`} />
    </div>
  );
}

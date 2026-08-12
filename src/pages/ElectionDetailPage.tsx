import { useLocation, useParams } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { StatCard } from "../components/StatCard";
import { SectionCard } from "../components/SectionCard";
import { FinanceTable } from "../components/finance/FinanceTable";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LastUpdated } from "../components/LastUpdated";
import { BackLink } from "../components/BackLink";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { electionResultById, personLinkForCandidate } from "../lib/elections";
import type { ElectionCandidate } from "../types/election";

const TYPE_LABEL: Record<"mayor" | "councilMember", string> = {
  mayor: "市長選挙",
  councilMember: "市議会議員選挙",
};

function sortedCandidates(candidates: ElectionCandidate[]): ElectionCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.elected !== b.elected) return a.elected ? -1 : 1;
    const av = a.votes ?? -1;
    const bv = b.votes ?? -1;
    return bv - av;
  });
}

export function ElectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  const election = id ? electionResultById(id) : undefined;
  usePageTitle();

  if (!election) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <BackLink to="/elections" label="選挙結果一覧に戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された選挙の情報は見つかりませんでした。
        </p>
      </div>
    );
  }

  const candidates = sortedCandidates(election.candidates);
  const electedCount = candidates.filter((c) => c.elected).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">{election.electionName}</h1>
          <span className="shrink-0 rounded-full bg-surface-container-low px-2.5 py-0.5 text-xs font-semibold text-on-surface">
            {TYPE_LABEL[election.electionType]}
          </span>
        </div>
        <p className="mt-2 text-sm text-on-primary-container/80">
          投票日：{election.electionDate}
          {election.announcementDate && `（告示日：${election.announcementDate}）`}
        </p>
      </div>

      {election.notes && (
        <p className="rounded-xl bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface">{election.notes}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="定数" value={election.seats ?? "確認中"} unit={election.seats != null ? "名" : ""} />
        <StatCard label="候補者数" value={election.candidateCount ?? candidates.length} unit="名" />
        <StatCard label="当選者数" value={electedCount} unit="名" />
        <StatCard label="投票率" value={election.turnoutPercent != null ? election.turnoutPercent : "確認中"} unit={election.turnoutPercent != null ? "%" : ""} />
        <StatCard label="有権者数" value={election.eligibleVoters != null ? election.eligibleVoters.toLocaleString("ja-JP") : "確認中"} unit={election.eligibleVoters != null ? "人" : ""} />
        <StatCard label="無効票数" value={election.invalidVotes != null ? election.invalidVotes.toLocaleString("ja-JP") : "確認中"} unit={election.invalidVotes != null ? "票" : ""} />
      </div>

      <SectionCard title="候補者一覧（得票数順）">
        <FinanceTable
          caption={`${election.electionName}（${election.electionDate}）の候補者一覧`}
          rows={candidates}
          rowKey={(c, i) => `${c.name}-${i}`}
          columns={[
            {
              header: "当落",
              render: (c) => (
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    c.elected ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {c.elected ? "当選" : "落選"}
                </span>
              ),
            },
            {
              header: "候補者名",
              render: (c) => {
                const link = personLinkForCandidate(c.linkedProfileId);
                return (
                  <span>
                    {c.name}
                    {c.age != null && <span className="ml-1 text-xs text-on-surface-variant">（{c.age}歳）</span>}
                    {link && (
                      <a href={link.href} className="ml-2 text-xs text-primary hover:underline">
                        {link.label}
                      </a>
                    )}
                  </span>
                );
              },
            },
            { header: "党派", render: (c) => c.party ?? "確認中" },
            { header: "新現元", render: (c) => c.incumbencyStatus ?? "確認中" },
            { header: "得票数", align: "right", render: (c) => (c.votes != null ? `${c.votes.toLocaleString("ja-JP")}票` : "確認中") },
          ]}
        />
      </SectionCard>

      <SectionCard title="出典">
        <ul className="space-y-2 text-xs leading-relaxed text-on-surface-variant">
          {election.sourceRefs.map((ref, i) => (
            <li key={i}>
              <a href={ref.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {ref.sourceTitle}
              </a>
              （{ref.sourceOrganization}、確認日：{ref.accessedAt}）
              {ref.notes && <p className="mt-1">{ref.notes}</p>}
            </li>
          ))}
        </ul>
      </SectionCard>

      <LastUpdated className="mt-4" />
      <CorrectionRequestButton pageName={`${election.electionName}（${election.electionDate}）`} />
    </div>
  );
}

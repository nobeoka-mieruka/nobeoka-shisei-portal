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
import { electionResultById, personLinkForCandidate, formatElectionDate, electionCandidateListConfirmed, ELECTION_SOURCE_HOST_TYPE_LABEL } from "../lib/elections";
import type { ElectionCandidate } from "../types/election";
import { humanizeDataNote } from "../lib/citizenTermLabels";

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
  const candidateListConfirmed = electionCandidateListConfirmed(election);

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
          投票日：{formatElectionDate(election)}
          {election.announcementDate && `（告示日：${election.announcementDate}）`}
        </p>
      </div>

      {election.notes && (
        <p className="rounded-xl bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface">{humanizeDataNote(election.notes)}</p>
      )}

      {!candidateListConfirmed && (
        <p className="rounded-xl bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface">
          この選挙は実施年月までは公式資料で確認できていますが、候補者一覧・得票数・投票率はまだ確認できていません。確認でき次第、追記します。
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="定数" value={election.seats ?? "確認中"} unit={election.seats != null ? "名" : ""} />
        <StatCard label="候補者数" value={candidateListConfirmed ? (election.candidateCount ?? candidates.length) : "確認中"} unit={candidateListConfirmed ? "名" : ""} />
        <StatCard label="当選者数" value={candidateListConfirmed ? electedCount : "確認中"} unit={candidateListConfirmed ? "名" : ""} />
        <StatCard label="投票率" value={election.turnoutPercent != null ? election.turnoutPercent : "確認中"} unit={election.turnoutPercent != null ? "%" : ""} />
        <StatCard label="有権者数" value={election.eligibleVoters != null ? election.eligibleVoters.toLocaleString("ja-JP") : "確認中"} unit={election.eligibleVoters != null ? "人" : ""} />
        <StatCard label="無効票数" value={election.invalidVotes != null ? election.invalidVotes.toLocaleString("ja-JP") : "確認中"} unit={election.invalidVotes != null ? "票" : ""} />
      </div>

      {candidateListConfirmed ? (
        <SectionCard title="候補者一覧（得票数順）">
          <FinanceTable
            caption={`${election.electionName}（${formatElectionDate(election)}）の候補者一覧`}
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
                        <a href={link.href} className="ml-2 text-xs text-primary underline">
                          {link.label}
                        </a>
                      )}
                    </span>
                  );
                },
              },
              {
                // Phase272：届出番号は公式の開票結果で確認できたもののみ表示する。
                // 抽選で決まる番号であり、優劣・当選確度とは無関係。
                header: "届出番号",
                align: "right",
                render: (c) => (c.registrationNumber != null ? `${c.registrationNumber}` : "確認中"),
              },
              { header: "党派", render: (c) => c.party ?? "確認中" },
              { header: "新現元", render: (c) => c.incumbencyStatus ?? "確認中" },
              { header: "得票数", align: "right", render: (c) => (c.votes != null ? `${c.votes.toLocaleString("ja-JP")}票` : "確認中") },
            ]}
          />
        </SectionCard>
      ) : (
        <SectionCard title="候補者一覧">
          <p className="p-4 text-sm text-on-surface-variant">候補者一覧はまだ確認できていません。</p>
        </SectionCard>
      )}

      <SectionCard title="出典・選挙資料">
        {/* Phase272：発行主体（誰が作った資料か）と取得元（どこから入手したか）を必ず分けて示す。
            市が発行した資料でも、市公式サイトでの掲載が終了しミラーからしか参照できない場合があり、
            これを「市公式サイトの資料」と表示すると出典の性格を偽ることになる。 */}
        <ul className="space-y-3 text-xs leading-relaxed text-on-surface-variant">
          {election.sourceRefs.map((ref, i) => (
            <li key={ref.sourceId ?? i} className="rounded-lg border border-outline-variant p-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {ref.documentType && (
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface">
                    {ref.documentType}
                  </span>
                )}
                <a
                  href={ref.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words font-medium text-primary underline"
                >
                  {ref.sourceTitle}
                </a>
              </div>
              <dl className="mt-1.5 space-y-0.5">
                {ref.publisher && (
                  <div>
                    <dt className="inline font-medium text-on-surface">発行：</dt>
                    <dd className="inline">{ref.publisher}</dd>
                  </div>
                )}
                <div>
                  <dt className="inline font-medium text-on-surface">取得：</dt>
                  <dd className="inline">
                    {ref.hostType ? `${ELECTION_SOURCE_HOST_TYPE_LABEL[ref.hostType]}／` : ""}
                    {ref.retrievedFrom ?? ref.sourceOrganization}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium text-on-surface">確認日：</dt>
                  <dd className="inline">{ref.accessedAt}</dd>
                </div>
              </dl>
              {ref.candidatePlacements && ref.candidatePlacements.length > 0 && (
                <div className="mt-1.5">
                  <p className="font-medium text-on-surface">この資料での候補者の掲載位置</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {ref.candidatePlacements.map((p) => (
                      <li key={p.candidateName}>
                        {p.registrationNumber != null && `届出番号${p.registrationNumber}　`}
                        {p.candidateName}：{p.placement}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-0.5">
                    掲載順序は抽選で決まっており、順序に優劣の意味はありません。当サイトはこの資料の内容を公約データベースへ取り込んでいません。
                  </p>
                </div>
              )}
              {ref.notes && <p className="mt-1.5">{humanizeDataNote(ref.notes)}</p>}
            </li>
          ))}
        </ul>
      </SectionCard>

      <LastUpdated className="mt-4" />
      <CorrectionRequestButton pageName={`${election.electionName}（${formatElectionDate(election)}）`} />
    </div>
  );
}

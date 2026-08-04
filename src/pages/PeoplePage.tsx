import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import factionsData from "../data/factions.json";
import billVotesData from "../data/billVotes.json";
import type { CouncilMember, FormerMember, BillVoteItem } from "../types";
import type { ArchiveMayor, ArchiveMayorTerm } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { BriefcaseIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { archiveVerificationStatusLabel, termsForMayor } from "../lib/archiveMayors";
import {
  buildPersonIndex,
  councilDocumentsForPerson,
  parsePersonSlug,
  personTypeLabel,
  policiesForPerson,
  type PersonType,
} from "../lib/people";
import { documentResultLabel, documentTypeLabel } from "../lib/archiveCouncilDocuments";
import { policyStatusLabel, categoryLabel } from "../lib/archivePolicies";
import archivePolicyCategoriesData from "../data/archivePolicyCategories.json";
import type { ArchivePolicyCategory } from "../types/historicalArchive";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];
const factions = factionsData as { id: string; name: string }[];
const billVotes = billVotesData as BillVoteItem[];
const archivePolicyCategories = archivePolicyCategoriesData as ArchivePolicyCategory[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const PERSON_TYPE_OPTIONS: PersonType[] = ["member", "former-member", "mayor"];

function factionName(id?: string): string | undefined {
  if (!id) return undefined;
  return factions.find((f) => f.id === id)?.name;
}

/** 既存の人物ごとの詳細ページ（プロフィール・発言等）への導線。表示済みの内容を重複実装しない。 */
function primaryDetailLinkFor(personType: PersonType, id: string): string {
  if (personType === "member") return `/members/${id}`;
  if (personType === "former-member") {
    const found = formerMembers.find((m) => m.id === id);
    return `/members/former/${found?.id ?? id}`;
  }
  const mayor = archiveMayors.find((m) => m.id === id);
  return mayor ? `/mayors/${mayor.slug}` : "/mayors";
}

export function PeoplePage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();

  const people = buildPersonIndex();

  const typeFilter = searchParams.get("type") ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const factionFilter = searchParams.get("faction") ?? "";
  const yearFilter = searchParams.get("year") ?? "";

  const factionIds = [...new Set(members.map((m) => m.factionId))];
  const yearOptions = [...new Set(people.flatMap((p) => p.tenureYears))].sort((a, b) => b - a);

  const filtered = people.filter((p) => {
    if (typeFilter && p.personType !== typeFilter) return false;
    if (statusFilter === "current" && !p.isCurrent) return false;
    if (statusFilter === "former" && p.isCurrent) return false;
    if (factionFilter && p.factionId !== factionFilter) return false;
    if (yearFilter && !p.tenureYears.includes(Number(yearFilter))) return false;
    return true;
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <BriefcaseIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">人物から探す</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          現職議員・元議員・市長を横断して、関連する政策・議案・条例・請願・陳情をまとめて確認できます。人物評価・順位付けは行っていません。
        </p>
      </div>

      <SectionCard title="絞り込み">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-on-surface-variant">人物種別</span>
            <select
              className="min-h-[44px] rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              value={typeFilter}
              onChange={(e) => updateParam("type", e.target.value)}
            >
              <option value="">すべて</option>
              {PERSON_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {personTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-on-surface-variant">現職・元職</span>
            <select
              className="min-h-[44px] rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              value={statusFilter}
              onChange={(e) => updateParam("status", e.target.value)}
            >
              <option value="">すべて</option>
              <option value="current">現職</option>
              <option value="former">元職</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-on-surface-variant">会派</span>
            <select
              className="min-h-[44px] rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              value={factionFilter}
              onChange={(e) => updateParam("faction", e.target.value)}
            >
              <option value="">すべて</option>
              {factionIds.map((id) => (
                <option key={id} value={id}>
                  {factionName(id) ?? id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-on-surface-variant">在籍年度</span>
            <select
              className="min-h-[44px] rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              value={yearFilter}
              onChange={(e) => updateParam("year", e.target.value)}
            >
              <option value="">すべて</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}年度
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          現職議員の在籍年度は、在籍履歴データが未整備のため今年度のみを表示しています（過去の在籍年度を推測していません）。
        </p>
      </SectionCard>

      <ul className="space-y-3">
        {filtered.map((p) => (
          <li key={p.slug}>
            <Link
              to={`/people/${p.slug}`}
              className={`block rounded-xl bg-surface-container-low p-4 shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-on-surface">{p.name}</p>
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                  {personTypeLabel(p.personType)}
                </span>
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">
                {p.tenureLabel}
                {p.factionId ? `／${factionName(p.factionId) ?? p.factionId}` : ""}
              </p>
              <p className="mt-2 text-xs text-on-surface-variant">
                関連資料：{p.relatedDocumentCount}件／確認状況：{archiveVerificationStatusLabel(p.verificationStatus)}
              </p>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">条件に一致する人物は見つかりませんでした。</p>
        )}
      </ul>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName="人物から探す" />
      </div>
    </div>
  );
}

export function PersonDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const parsed = slug ? parsePersonSlug(slug) : undefined;
  const people = buildPersonIndex();
  const person = parsed ? people.find((p) => p.slug === slug) : undefined;

  if (!parsed || !person) {
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <BackLink to="/people" label="人物から探すに戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された人物情報は見つかりませんでした。
        </p>
      </div>
    );
  }

  const { personType, id } = parsed;
  const primaryDetailLink = primaryDetailLinkFor(personType, id);
  const policies = policiesForPerson(personType, id);
  const councilDocuments = councilDocumentsForPerson(id);
  const voteCount = billVotes.filter((b) => b.memberVotes.some((v) => v.memberId === id)).length;
  const mayorTerms = personType === "mayor" ? termsForMayor(archiveMayorTerms, id) : [];
  const relatedFiscalYears = [
    ...new Set([...policies.flatMap((p) => p.relatedFiscalYears ?? []), ...councilDocuments.flatMap((d) => d.relatedFiscalYears ?? [])]),
  ].sort((a, b) => b - a);

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/people" label="人物から探すに戻る" />

      <section className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-on-surface sm:text-2xl">{person.name}</h1>
          <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
            {personTypeLabel(personType)}
          </span>
        </div>
        {person.nameKana && <p className="mt-1 text-sm text-on-surface-variant">{person.nameKana}</p>}
        <p className="mt-2 text-sm text-on-surface-variant">
          {person.tenureLabel}
          {person.factionId ? `／会派：${factionName(person.factionId) ?? person.factionId}` : ""}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">確認状況：{archiveVerificationStatusLabel(person.verificationStatus)}</p>
        <Link
          to={primaryDetailLink}
          className={`mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:opacity-90 ${linkClass}`}
        >
          プロフィール・発言記録の詳細を見る
        </Link>
        {/* フェーズ9で「この人物を比較」導線（/compare/members?ids=... 等）をここに追加予定。今回は未実装のため表示しない。 */}
      </section>

      {personType === "mayor" && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">任期</h2>
          {mayorTerms.length === 0 ? (
            <p className="mt-2 text-sm text-on-surface-variant">資料未確認</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-on-surface">
              {mayorTerms.map((t) => (
                <li key={t.id}>
                  第{t.termNumber ?? "?"}期：{t.termStart}〜{t.termEnd ?? "現在"}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">会派・委員会・役職履歴</h2>
        {personType === "member" ? (
          <p className="mt-2 text-sm text-on-surface-variant">
            現在の所属のみ確認できています（過去の異動履歴は未整備）：
            {factionName(person.factionId) ?? "会派情報確認中"}
            {(members.find((m) => m.id === id)?.committees ?? []).length > 0 &&
              `／${members.find((m) => m.id === id)?.committees.join("、")}`}
          </p>
        ) : (
          <p className="mt-2 text-sm text-on-surface-variant">資料未確認</p>
        )}
      </section>

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">一般質問・議案賛否</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          議案の議員別賛否記録：{voteCount}件
          {voteCount > 0 && (
            <>
              （
              <Link to="/bills/votes" className={`text-primary hover:underline ${linkClass}`}>
                議案ごとの賛否ページ
              </Link>
              で確認できます）
            </>
          )}
        </p>
        {(personType === "member" || personType === "former-member") && (
          <p className="mt-1 text-sm text-on-surface-variant">
            一般質問・答弁の詳細は
            <Link to={primaryDetailLink} className={`mx-1 text-primary hover:underline ${linkClass}`}>
              プロフィールページ
            </Link>
            でご確認いただけます。
          </p>
        )}
      </section>

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">政策</h2>
        {policies.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">該当資料なし（確認できた政策の登録がありません）</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {policies.map((p) => (
              <li key={p.id} className="rounded-lg border border-outline-variant p-3 text-sm">
                <Link to={`/policies/${p.slug}`} className={`text-primary hover:underline ${linkClass}`}>
                  {p.title}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                    {policyStatusLabel(p.status)}
                  </span>
                  {p.categoryIds.map((cid) => (
                    <span key={cid} className="rounded-full bg-primary-container px-2 py-0.5 text-xs text-on-primary-container">
                      {categoryLabel(archivePolicyCategories, cid)}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">条例・請願・陳情との関わり</h2>
        {councilDocuments.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">該当資料なし（確認できた関連の登録がありません）</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {councilDocuments.map((d) => {
              const basePath =
                d.documentType === "bill" ? "/bills" : d.documentType === "ordinance" ? "/ordinances" : d.documentType === "petition" ? "/petitions" : "/requests";
              return (
                <li key={d.id} className="rounded-lg border border-outline-variant p-3 text-sm">
                  <Link to={`${basePath}/${d.slug}`} className={`text-primary hover:underline ${linkClass}`}>
                    {d.title}
                  </Link>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {documentTypeLabel(d.documentType)}
                    {d.result ? `／${documentResultLabel(d.result)}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">関連する財政年度</h2>
        {relatedFiscalYears.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">資料未確認</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1">
            {relatedFiscalYears.map((y) => (
              <li key={y}>
                <Link
                  to="/finance/budget"
                  className={`rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-primary hover:underline ${linkClass}`}
                >
                  {y}年度
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        このページは、公式資料で確認できた範囲の情報のみを掲載しています。人物への評価・順位付け・点数化は行っていません。過去の所属・役職は、確認できた当時の情報のみを表示し、現在の所属を過去へ遡って適用していません。
      </p>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName={`${person.name}（人物）`} />
      </div>
    </div>
  );
}

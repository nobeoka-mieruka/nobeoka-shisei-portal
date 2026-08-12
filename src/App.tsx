import { Suspense, lazy, useEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { initGoogleAnalytics, trackPageView } from "./lib/analytics";
import { SiteHeader } from "./components/SiteHeader";
import { BottomNav } from "./components/BottomNav";
import { Footer } from "./components/Footer";
import { MaintenanceNotice } from "./components/MaintenanceNotice";
import { HomePage } from "./pages/HomePage";

const MemberDetailPage = lazy(() => import("./pages/MemberDetailPage").then((m) => ({ default: m.MemberDetailPage })));
const MemberSpeechDetailPage = lazy(() =>
  import("./pages/MemberSpeechDetailPage").then((m) => ({ default: m.MemberSpeechDetailPage })),
);
const MembersFormerPage = lazy(() =>
  import("./pages/MembersFormerPage").then((m) => ({ default: m.MembersFormerPage })),
);
const MemberFormerDetailPage = lazy(() =>
  import("./pages/MemberFormerDetailPage").then((m) => ({ default: m.MemberFormerDetailPage })),
);
const MembersHistoryPage = lazy(() =>
  import("./pages/MembersHistoryPage").then((m) => ({ default: m.MembersHistoryPage })),
);
const MayorPage = lazy(() => import("./pages/MayorPage").then((m) => ({ default: m.MayorPage })));
const MayorPolicyProgressPage = lazy(() =>
  import("./pages/MayorPolicyProgressPage").then((m) => ({ default: m.MayorPolicyProgressPage })),
);
const MayorPromiseDetailPage = lazy(() =>
  import("./pages/MayorPromiseDetailPage").then((m) => ({ default: m.MayorPromiseDetailPage })),
);
const MayorEntertainmentExpensesPage = lazy(() =>
  import("./pages/MayorEntertainmentExpensesPage").then((m) => ({ default: m.MayorEntertainmentExpensesPage })),
);
const MayorPressConferencesPage = lazy(() =>
  import("./pages/MayorPressConferencesPage").then((m) => ({ default: m.MayorPressConferencesPage })),
);
const MayorPressConferenceDetailPage = lazy(() =>
  import("./pages/MayorPressConferenceDetailPage").then((m) => ({ default: m.MayorPressConferenceDetailPage })),
);
const PoliticalFundsPage = lazy(() =>
  import("./pages/PoliticalFundsPage").then((m) => ({ default: m.PoliticalFundsPage })),
);
const PoliticalFundOrganizationDetailPage = lazy(() =>
  import("./pages/PoliticalFundOrganizationDetailPage").then((m) => ({ default: m.PoliticalFundOrganizationDetailPage })),
);
const CommitteesPage = lazy(() => import("./pages/CommitteesPage").then((m) => ({ default: m.CommitteesPage })));
const CommitteeDetailPage = lazy(() =>
  import("./pages/CommitteeDetailPage").then((m) => ({ default: m.CommitteeDetailPage })),
);
const ElectionsPage = lazy(() => import("./pages/ElectionsPage").then((m) => ({ default: m.ElectionsPage })));
const ElectionDetailPage = lazy(() =>
  import("./pages/ElectionDetailPage").then((m) => ({ default: m.ElectionDetailPage })),
);
const CityOrganizationPage = lazy(() =>
  import("./pages/CityOrganizationPage").then((m) => ({ default: m.CityOrganizationPage })),
);
const MayorsPage = lazy(() => import("./pages/MayorsPage").then((m) => ({ default: m.MayorsPage })));
const MayorDetailPage = lazy(() => import("./pages/MayorDetailPage").then((m) => ({ default: m.MayorDetailPage })));
const CityOfficialsPage = lazy(() =>
  import("./pages/CityOfficialsPage").then((m) => ({ default: m.CityOfficialsPage })),
);
const FinancePage = lazy(() => import("./pages/FinancePage").then((m) => ({ default: m.FinancePage })));
const FinanceBudgetPage = lazy(() =>
  import("./pages/FinanceBudgetPage").then((m) => ({ default: m.FinanceBudgetPage })),
);
const FinanceDebtPage = lazy(() => import("./pages/FinanceDebtPage").then((m) => ({ default: m.FinanceDebtPage })));
const FinanceFundsPage = lazy(() =>
  import("./pages/FinanceFundsPage").then((m) => ({ default: m.FinanceFundsPage })),
);
const ComparePage = lazy(() => import("./pages/ComparePage").then((m) => ({ default: m.ComparePage })));
const CompareMayorsPage = lazy(() =>
  import("./pages/CompareMayorsPage").then((m) => ({ default: m.CompareMayorsPage })),
);
const CompareMembersPage = lazy(() =>
  import("./pages/CompareMembersPage").then((m) => ({ default: m.CompareMembersPage })),
);
const CompareFinancePage = lazy(() =>
  import("./pages/CompareFinancePage").then((m) => ({ default: m.CompareFinancePage })),
);
const ComparePopulationPage = lazy(() =>
  import("./pages/ComparePopulationPage").then((m) => ({ default: m.ComparePopulationPage })),
);
const CompareBudgetPage = lazy(() =>
  import("./pages/CompareBudgetPage").then((m) => ({ default: m.CompareBudgetPage })),
);
const CompareDebtPage = lazy(() => import("./pages/CompareDebtPage").then((m) => ({ default: m.CompareDebtPage })));
const CompareFundsPage = lazy(() =>
  import("./pages/CompareFundsPage").then((m) => ({ default: m.CompareFundsPage })),
);
const CompareMunicipalitiesPage = lazy(() =>
  import("./pages/CompareMunicipalitiesPage").then((m) => ({ default: m.CompareMunicipalitiesPage })),
);
const TimelinePage = lazy(() => import("./pages/TimelinePage").then((m) => ({ default: m.TimelinePage })));
const TimelineYearPage = lazy(() => import("./pages/TimelineYearPage").then((m) => ({ default: m.TimelineYearPage })));
const HistoryPage = lazy(() => import("./pages/HistoryPage").then((m) => ({ default: m.HistoryPage })));
const PoliciesPage = lazy(() => import("./pages/PoliciesPage").then((m) => ({ default: m.PoliciesPage })));
const PolicyDetailPage = lazy(() =>
  import("./pages/PolicyDetailPage").then((m) => ({ default: m.PolicyDetailPage })),
);
const PolicyComparePage = lazy(() =>
  import("./pages/PolicyComparePage").then((m) => ({ default: m.PolicyComparePage })),
);
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const CompensationPage = lazy(() => import("./pages/CompensationPage").then((m) => ({ default: m.CompensationPage })));
const CityGuidePage = lazy(() => import("./pages/CityGuidePage").then((m) => ({ default: m.CityGuidePage })));
const AboutPage = lazy(() => import("./pages/AboutPage").then((m) => ({ default: m.AboutPage })));
const TermsPage = lazy(() => import("./pages/TermsPage").then((m) => ({ default: m.TermsPage })));
const EditorialPolicyPage = lazy(() =>
  import("./pages/EditorialPolicyPage").then((m) => ({ default: m.EditorialPolicyPage })),
);
const ContactPage = lazy(() => import("./pages/ContactPage").then((m) => ({ default: m.ContactPage })));
const BillVotesPage = lazy(() => import("./pages/BillVotesPage").then((m) => ({ default: m.BillVotesPage })));
const BillVoteDetailPage = lazy(() =>
  import("./pages/BillVoteDetailPage").then((m) => ({ default: m.BillVoteDetailPage })),
);
const BillComparePage = lazy(() => import("./pages/BillComparePage").then((m) => ({ default: m.BillComparePage })));
const BillsArchivePage = lazy(() =>
  import("./pages/CouncilDocumentsArchivePage").then((m) => ({ default: m.BillsArchivePage })),
);
const BillArchiveDetailPage = lazy(() =>
  import("./pages/CouncilDocumentsArchivePage").then((m) => ({ default: m.BillArchiveDetailPage })),
);
const OrdinancesPage = lazy(() =>
  import("./pages/CouncilDocumentsArchivePage").then((m) => ({ default: m.OrdinancesPage })),
);
const OrdinanceDetailPage = lazy(() =>
  import("./pages/CouncilDocumentsArchivePage").then((m) => ({ default: m.OrdinanceDetailPage })),
);
const PetitionsPage = lazy(() =>
  import("./pages/CouncilDocumentsArchivePage").then((m) => ({ default: m.PetitionsPage })),
);
const PetitionDetailPage = lazy(() =>
  import("./pages/CouncilDocumentsArchivePage").then((m) => ({ default: m.PetitionDetailPage })),
);
const RequestsPage = lazy(() =>
  import("./pages/CouncilDocumentsArchivePage").then((m) => ({ default: m.RequestsPage })),
);
const RequestDetailPage = lazy(() =>
  import("./pages/CouncilDocumentsArchivePage").then((m) => ({ default: m.RequestDetailPage })),
);
const PeoplePage = lazy(() => import("./pages/PeoplePage").then((m) => ({ default: m.PeoplePage })));
const PersonDetailPage = lazy(() => import("./pages/PeoplePage").then((m) => ({ default: m.PersonDetailPage })));
const CouncilDocumentsPage = lazy(() =>
  import("./pages/CouncilDocumentsPage").then((m) => ({ default: m.CouncilDocumentsPage })),
);
const CouncilSessionDetailPage = lazy(() =>
  import("./pages/CouncilSessionDetailPage").then((m) => ({ default: m.CouncilSessionDetailPage })),
);
const GeneralQuestionsPage = lazy(() =>
  import("./pages/GeneralQuestionsPage").then((m) => ({ default: m.GeneralQuestionsPage })),
);
const GeneralQuestionDetailPage = lazy(() =>
  import("./pages/GeneralQuestionDetailPage").then((m) => ({ default: m.GeneralQuestionDetailPage })),
);
const ThemesPage = lazy(() => import("./pages/ThemesPage").then((m) => ({ default: m.ThemesPage })));
const ThemeDetailPage = lazy(() => import("./pages/ThemeDetailPage").then((m) => ({ default: m.ThemeDetailPage })));
const ExecutiveAnswersPage = lazy(() =>
  import("./pages/ExecutiveAnswersPage").then((m) => ({ default: m.ExecutiveAnswersPage })),
);
const SearchPage = lazy(() => import("./pages/SearchPage").then((m) => ({ default: m.SearchPage })));
const KohoSearchPage = lazy(() => import("./pages/KohoSearchPage").then((m) => ({ default: m.KohoSearchPage })));
const UpdatesPage = lazy(() => import("./pages/UpdatesPage").then((m) => ({ default: m.UpdatesPage })));
const DataStatusPage = lazy(() => import("./pages/DataStatusPage").then((m) => ({ default: m.DataStatusPage })));
const MethodologyActivityRadarPage = lazy(() =>
  import("./pages/MethodologyActivityRadarPage").then((m) => ({ default: m.MethodologyActivityRadarPage })),
);
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

function RouteLoadingFallback() {
  return (
    <div
      className="flex min-h-[70vh] flex-1 items-center justify-center px-4 py-24"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-4 border-outline-variant border-t-primary"
      />
      <span className="sr-only">読み込み中</span>
    </div>
  );
}

function App() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    initGoogleAnalytics();
  }, []);

  // 依存配列はlocationオブジェクトそのものではなく、実際に使う文字列（pathname+search）
  // にする。react-router-domのsetSearchParams({ replace: true })は、URL文字列が
  // 実質的に変化しない場合でも新しいlocationオブジェクト参照を生成することがあり、
  // locationオブジェクト全体を依存にすると、フィルター状態をURLへ同期するページ
  // （BillVotesPage・GeneralQuestionsPage等）でinitial mount時にpage_viewが
  // 二重送信されてしまう不具合があったため、文字列依存に変更して二重送信を防ぐ。
  const currentPath = location.pathname + location.search;
  useEffect(() => {
    trackPageView(currentPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // ページ（パス）が変わったときだけ、本文の先頭へスクロールしフォーカスを移す。
  // 初回表示時（ブラウザの初期フォーカス）と、検索・絞り込みなどクエリ文字列だけが
  // 変わる操作では、意図せずフォーカスを奪わないようlocation.pathnameだけを監視する。
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    mainRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div className="flex min-h-svh flex-col overflow-x-hidden bg-surface">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-2 focus-visible:top-2 focus-visible:z-50 focus-visible:rounded-full focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-on-primary focus-visible:shadow-e2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary"
      >
        本文へ移動
      </a>
      <SiteHeader />
      <MaintenanceNotice />
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col pb-24 outline-none md:pb-10"
      >
        <div className="flex-1">
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/members/former" element={<MembersFormerPage />} />
              <Route path="/members/former/:slug" element={<MemberFormerDetailPage />} />
              <Route path="/members/history" element={<MembersHistoryPage />} />
              <Route path="/members/:id" element={<MemberDetailPage />} />
              <Route path="/members/:memberId/questions/:speechId" element={<MemberSpeechDetailPage />} />
              <Route path="/mayor" element={<MayorPage />} />
              <Route path="/mayor/policy-progress" element={<MayorPolicyProgressPage />} />
              <Route path="/mayor/policy-progress/:id" element={<MayorPromiseDetailPage />} />
              <Route path="/mayor/entertainment-expenses" element={<MayorEntertainmentExpensesPage />} />
              <Route path="/mayor/press-conferences" element={<MayorPressConferencesPage />} />
              <Route path="/mayor/press-conferences/:date" element={<MayorPressConferenceDetailPage />} />
              <Route path="/political-funds" element={<PoliticalFundsPage />} />
              <Route path="/political-funds/:id" element={<PoliticalFundOrganizationDetailPage />} />
              <Route path="/committees" element={<CommitteesPage />} />
              <Route path="/committees/:id" element={<CommitteeDetailPage />} />
              <Route path="/elections" element={<ElectionsPage />} />
              <Route path="/elections/:id" element={<ElectionDetailPage />} />
              <Route path="/city-organization" element={<CityOrganizationPage />} />
              <Route path="/mayors" element={<MayorsPage />} />
              <Route path="/mayors/:slug" element={<MayorDetailPage />} />
              <Route path="/city-officials" element={<CityOfficialsPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/finance/budget" element={<FinanceBudgetPage />} />
              <Route path="/finance/debt" element={<FinanceDebtPage />} />
              <Route path="/finance/funds" element={<FinanceFundsPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/compare/mayors" element={<CompareMayorsPage />} />
              <Route path="/compare/members" element={<CompareMembersPage />} />
              <Route path="/compare/finance" element={<CompareFinancePage />} />
              <Route path="/compare/population" element={<ComparePopulationPage />} />
              <Route path="/compare/budget" element={<CompareBudgetPage />} />
              <Route path="/compare/debt" element={<CompareDebtPage />} />
              <Route path="/compare/funds" element={<CompareFundsPage />} />
              <Route path="/compare/municipalities" element={<CompareMunicipalitiesPage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/timeline/:year" element={<TimelineYearPage />} />
              <Route path="/compare/policies" element={<PolicyComparePage />} />
              <Route path="/policies" element={<PoliciesPage />} />
              <Route path="/policies/:slug" element={<PolicyDetailPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/compensation" element={<CompensationPage />} />
              <Route path="/city-guide" element={<CityGuidePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/editorial-policy" element={<EditorialPolicyPage />} />
              <Route path="/contact" element={<ContactPage />} />
              {/* /bills は /bills/votes（議案ごとの賛否データベース）へ統合済み。旧URLへのアクセスもリダイレクトする。 */}
              <Route path="/bills" element={<BillsArchivePage />} />
              <Route path="/bills/votes" element={<BillVotesPage />} />
              <Route path="/bills/compare" element={<BillComparePage />} />
              <Route path="/bills/votes/:id" element={<BillVoteDetailPage />} />
              <Route path="/bills/:slug" element={<BillArchiveDetailPage />} />
              <Route path="/ordinances" element={<OrdinancesPage />} />
              <Route path="/ordinances/:slug" element={<OrdinanceDetailPage />} />
              <Route path="/petitions" element={<PetitionsPage />} />
              <Route path="/petitions/:slug" element={<PetitionDetailPage />} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/requests/:slug" element={<RequestDetailPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/people/:slug" element={<PersonDetailPage />} />
              <Route path="/council-documents" element={<CouncilDocumentsPage />} />
              <Route path="/council-documents/:sessionId" element={<CouncilSessionDetailPage />} />
              <Route path="/questions" element={<GeneralQuestionsPage />} />
              <Route path="/questions/:id" element={<GeneralQuestionDetailPage />} />
              <Route path="/themes" element={<ThemesPage />} />
              <Route path="/themes/:themeSlug" element={<ThemeDetailPage />} />
              <Route path="/executive-answers" element={<ExecutiveAnswersPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/koho-search" element={<KohoSearchPage />} />
              <Route path="/updates" element={<UpdatesPage />} />
              <Route path="/data-status" element={<DataStatusPage />} />
              <Route path="/methodology/activity-radar" element={<MethodologyActivityRadarPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </div>
        <Footer />
      </main>
      <BottomNav />
    </div>
  );
}

export default App;

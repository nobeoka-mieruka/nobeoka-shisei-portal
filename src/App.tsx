import { Suspense, lazy, useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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
const MayorsPage = lazy(() => import("./pages/MayorsPage").then((m) => ({ default: m.MayorsPage })));
const MayorDetailPage = lazy(() => import("./pages/MayorDetailPage").then((m) => ({ default: m.MayorDetailPage })));
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
const UpdatesPage = lazy(() => import("./pages/UpdatesPage").then((m) => ({ default: m.UpdatesPage })));
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

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

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
              <Route path="/members/:id" element={<MemberDetailPage />} />
              <Route path="/members/:memberId/questions/:speechId" element={<MemberSpeechDetailPage />} />
              <Route path="/mayor" element={<MayorPage />} />
              <Route path="/mayor/policy-progress" element={<MayorPolicyProgressPage />} />
              <Route path="/mayor/policy-progress/:id" element={<MayorPromiseDetailPage />} />
              <Route path="/mayor/entertainment-expenses" element={<MayorEntertainmentExpensesPage />} />
              <Route path="/mayor/press-conferences" element={<MayorPressConferencesPage />} />
              <Route path="/mayor/press-conferences/:date" element={<MayorPressConferenceDetailPage />} />
              <Route path="/mayors" element={<MayorsPage />} />
              <Route path="/mayors/:slug" element={<MayorDetailPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/finance/budget" element={<FinanceBudgetPage />} />
              <Route path="/finance/debt" element={<FinanceDebtPage />} />
              <Route path="/finance/funds" element={<FinanceFundsPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/compare/mayors" element={<CompareMayorsPage />} />
              <Route path="/compare/finance" element={<CompareFinancePage />} />
              <Route path="/compare/population" element={<ComparePopulationPage />} />
              <Route path="/compare/budget" element={<CompareBudgetPage />} />
              <Route path="/compare/debt" element={<CompareDebtPage />} />
              <Route path="/compare/funds" element={<CompareFundsPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/compensation" element={<CompensationPage />} />
              <Route path="/city-guide" element={<CityGuidePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/editorial-policy" element={<EditorialPolicyPage />} />
              <Route path="/contact" element={<ContactPage />} />
              {/* /bills は /bills/votes（議案ごとの賛否データベース）へ統合済み。旧URLへのアクセスもリダイレクトする。 */}
              <Route path="/bills" element={<Navigate to="/bills/votes" replace />} />
              <Route path="/bills/votes" element={<BillVotesPage />} />
              <Route path="/bills/compare" element={<BillComparePage />} />
              <Route path="/bills/votes/:id" element={<BillVoteDetailPage />} />
              <Route path="/council-documents" element={<CouncilDocumentsPage />} />
              <Route path="/council-documents/:sessionId" element={<CouncilSessionDetailPage />} />
              <Route path="/questions" element={<GeneralQuestionsPage />} />
              <Route path="/questions/:id" element={<GeneralQuestionDetailPage />} />
              <Route path="/themes" element={<ThemesPage />} />
              <Route path="/themes/:themeSlug" element={<ThemeDetailPage />} />
              <Route path="/executive-answers" element={<ExecutiveAnswersPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/updates" element={<UpdatesPage />} />
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

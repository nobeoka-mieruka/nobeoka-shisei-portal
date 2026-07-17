import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { initGoogleAnalytics, trackPageView } from "./lib/analytics";
import { SiteHeader } from "./components/SiteHeader";
import { BottomNav } from "./components/BottomNav";
import { Footer } from "./components/Footer";
import { MaintenanceNotice } from "./components/MaintenanceNotice";
import { HomePage } from "./pages/HomePage";
import { MemberDetailPage } from "./pages/MemberDetailPage";
import { MayorPage } from "./pages/MayorPage";
import { MayorPolicyProgressPage } from "./pages/MayorPolicyProgressPage";
import { MayorEntertainmentExpensesPage } from "./pages/MayorEntertainmentExpensesPage";
import { FinancePage } from "./pages/FinancePage";
import { DashboardPage } from "./pages/DashboardPage";
import { CompensationPage } from "./pages/CompensationPage";
import { CityGuidePage } from "./pages/CityGuidePage";
import { AboutPage } from "./pages/AboutPage";
import { TermsPage } from "./pages/TermsPage";
import { EditorialPolicyPage } from "./pages/EditorialPolicyPage";
import { ContactPage } from "./pages/ContactPage";
import { BillsPage } from "./pages/BillsPage";
import { BillVotesPage } from "./pages/BillVotesPage";
import { BillVoteDetailPage } from "./pages/BillVoteDetailPage";
import { GeneralQuestionsPage } from "./pages/GeneralQuestionsPage";
import { SearchPage } from "./pages/SearchPage";
import { UpdatesPage } from "./pages/UpdatesPage";
import { NotFoundPage } from "./pages/NotFoundPage";

function App() {
  const location = useLocation();

  useEffect(() => {
    initGoogleAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

  return (
    <div className="flex min-h-svh flex-col overflow-x-hidden bg-surface">
      <SiteHeader />
      <MaintenanceNotice />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col pb-24 md:pb-10">
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/members/:id" element={<MemberDetailPage />} />
            <Route path="/mayor" element={<MayorPage />} />
            <Route path="/mayor/policy-progress" element={<MayorPolicyProgressPage />} />
            <Route path="/mayor/entertainment-expenses" element={<MayorEntertainmentExpensesPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/compensation" element={<CompensationPage />} />
            <Route path="/city-guide" element={<CityGuidePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/editorial-policy" element={<EditorialPolicyPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/bills" element={<BillsPage />} />
            <Route path="/bills/votes" element={<BillVotesPage />} />
            <Route path="/bills/votes/:id" element={<BillVoteDetailPage />} />
            <Route path="/questions" element={<GeneralQuestionsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/updates" element={<UpdatesPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
        <Footer />
      </main>
      <BottomNav />
    </div>
  );
}

export default App;

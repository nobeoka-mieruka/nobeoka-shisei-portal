import { Route, Routes } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader";
import { BottomNav } from "./components/BottomNav";
import { Footer } from "./components/Footer";
import { MaintenanceNotice } from "./components/MaintenanceNotice";
import { HomePage } from "./pages/HomePage";
import { MemberDetailPage } from "./pages/MemberDetailPage";
import { MayorPage } from "./pages/MayorPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AboutPage } from "./pages/AboutPage";
import { TermsPage } from "./pages/TermsPage";

function App() {
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
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/terms" element={<TermsPage />} />
          </Routes>
        </div>
        <Footer />
      </main>
      <BottomNav />
    </div>
  );
}

export default App;

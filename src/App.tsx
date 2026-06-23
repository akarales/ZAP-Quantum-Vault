import { Routes, Route } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { KeysPage } from "./pages/KeysPage";
import { SignPage } from "./pages/SignPage";
import { AirGapPage } from "./pages/AirGapPage";
import { BackupPage } from "./pages/BackupPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AuthPage } from "./pages/AuthPage";
import { Sidebar } from "./components/layout/Sidebar";
import { useAuthStore } from "./store/authStore";

export default function App() {
  const isUnlocked = useAuthStore((s) => s.isUnlocked);

  if (!isUnlocked) {
    return <AuthPage />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/keys" element={<KeysPage />} />
          <Route path="/sign" element={<SignPage />} />
          <Route path="/airgap" element={<AirGapPage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

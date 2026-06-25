import { Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { DashboardPage } from "./pages/DashboardPage";
import { KeysPage } from "./pages/KeysPage";
import { SignPage } from "./pages/SignPage";
import { AirGapPage } from "./pages/AirGapPage";
import { BackupPage } from "./pages/BackupPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AuthPage } from "./pages/AuthPage";
import { MnemonicBackup } from "./components/auth/MnemonicBackup";
import { Sidebar } from "./components/layout/Sidebar";
import { useAuthStore } from "./store/authStore";

export default function App() {
  const isUnlocked = useAuthStore((s) => s.isUnlocked);
  const mnemonic = useAuthStore((s) => s.mnemonic);

  // After creating a vault the user is unlocked but must first back up their
  // freshly generated recovery phrase (shown only once).
  if (isUnlocked && mnemonic) {
    return (
      <ThemeProvider>
        <TooltipProvider>
          <MnemonicBackup />
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </ThemeProvider>
    );
  }

  if (!isUnlocked) {
    return (
      <ThemeProvider>
        <TooltipProvider>
          <AuthPage />
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <TooltipProvider>
        <div className="flex h-screen w-screen overflow-hidden gradient-bg">
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
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </ThemeProvider>
  );
}

import { useState } from "react";
import { Shield, Lock } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export function AuthPage() {
  const [password, setPassword] = useState("");
  const unlock = useAuthStore((s) => s.unlock);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const initialize = useAuthStore((s) => s.initialize);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isInitialized) {
      initialize();
    } else {
      unlock();
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-96 space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-2">
          <Shield className="h-12 w-12 text-blue-600" />
          <h1 className="text-xl font-bold">ZAP Quantum Vault</h1>
          <p className="text-sm text-zinc-500">
            {isInitialized ? "Enter your password to unlock" : "Create a new vault"}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-transparent px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700"
                placeholder="••••••••"
                autoFocus
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {isInitialized ? "Unlock Vault" : "Create Vault"}
          </button>
        </form>
      </div>
    </div>
  );
}

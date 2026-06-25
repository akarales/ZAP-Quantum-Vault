import { useEffect, useMemo, useState } from "react";
import { Shield, Lock, Eye, EyeOff, ArrowRight, Loader2, Usb } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
}

function evaluatePassword(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;

  const levels: PasswordStrength[] = [
    { score: 0, label: "Too weak", color: "bg-destructive" },
    { score: 1, label: "Weak", color: "bg-destructive" },
    { score: 2, label: "Fair", color: "bg-yellow-500" },
    { score: 3, label: "Good", color: "bg-primary" },
    { score: 4, label: "Strong", color: "bg-green-500" },
  ];
  return levels[score];
}

export function AuthPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [yubikeyEnabled, setYubikeyEnabled] = useState(false);
  // When creating a vault, the user can switch to restoring from a phrase.
  const [restoreMode, setRestoreMode] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState("");

  const isInitialized = useAuthStore((s) => s.isInitialized);
  const statusChecked = useAuthStore((s) => s.statusChecked);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const checkStatus = useAuthStore((s) => s.checkStatus);
  const unlock = useAuthStore((s) => s.unlock);
  const initialize = useAuthStore((s) => s.initialize);
  const restore = useAuthStore((s) => s.restore);
  const clearError = useAuthStore((s) => s.clearError);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Once we know a vault exists, find out whether a YubiKey is required so we
  // can prompt the user to insert (and touch) it before unlocking.
  useEffect(() => {
    if (!isInitialized) return;
    api
      .yubikeyStatus()
      .then((s) => setYubikeyEnabled(s.enabled))
      .catch(() => setYubikeyEnabled(false));
  }, [isInitialized]);

  const strength = useMemo(() => evaluatePassword(password), [password]);
  const passwordsMatch = password === confirmPassword;
  const recoveryWordCount = recoveryPhrase.trim().split(/\s+/).filter(Boolean).length;
  const canSubmit = isInitialized
    ? password.length > 0
    : restoreMode
      ? password.length >= 8 && passwordsMatch && recoveryWordCount === 24
      : password.length >= 8 && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (isInitialized) {
      await unlock(password);
    } else if (restoreMode) {
      await restore(recoveryPhrase.trim().replace(/\s+/g, " "), password);
    } else {
      await initialize(password);
    }
  };

  if (!statusChecked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center gradient-bg bg-grid">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl animate-pulse-glow" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Initializing vault…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center gradient-bg bg-grid">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-[420px]"
      >
        <div className="glass rounded-2xl p-8 shadow-2xl">
          <div className="mb-8 flex flex-col items-center gap-3">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="relative"
            >
              <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl animate-pulse-glow" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </motion.div>
            <div className="text-center">
              <h1 className="text-xl font-bold tracking-tight">
                <span className="gradient-text">ZAP Quantum Vault</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isInitialized
                  ? "Enter your password to unlock"
                  : restoreMode
                    ? "Restore your vault from a recovery phrase"
                    : "Create a new quantum-safe vault"}
              </p>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
            >
              {error}
            </motion.div>
          )}

          {isInitialized && yubikeyEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4 flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary"
            >
              <Usb className="h-4 w-4 shrink-0" />
              <span>Insert your YubiKey and touch it when it blinks to unlock.</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="••••••••"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isInitialized && password.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < strength.score ? strength.color : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Password strength: <span className="font-medium text-foreground">{strength.label}</span>
                </p>
              </div>
            )}

            {!isInitialized && restoreMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2"
              >
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recovery Phrase (24 words)
                </label>
                <textarea
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                  rows={3}
                  spellCheck={false}
                  placeholder="word1 word2 word3 …"
                  className="w-full resize-none rounded-md border border-input bg-background/50 px-3 py-2 text-sm font-mono outline-none focus:border-primary"
                />
                <p className="text-xs text-muted-foreground">
                  {recoveryWordCount}/24 words
                </p>
              </motion.div>
            )}

            {!isInitialized && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2"
              >
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                  <Input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
                {password.length > 0 && password.length < 8 && (
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 characters required
                  </p>
                )}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {isInitialized ? "Unlock Vault" : restoreMode ? "Restore Vault" : "Create Vault"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {!isInitialized && (
            <button
              type="button"
              onClick={() => {
                clearError();
                setRestoreMode((m) => !m);
              }}
              className="mt-4 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {restoreMode
                ? "← Back to creating a new vault"
                : "Restore from an existing recovery phrase"}
            </button>
          )}

          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              ML-DSA-87
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              NIST Level 5
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Air-Gapped
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

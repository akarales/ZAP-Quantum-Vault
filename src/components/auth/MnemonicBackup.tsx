import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Copy, Check, Eye, EyeOff, AlertTriangle, ArrowRight } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";

/**
 * One-time recovery-phrase backup gate. Shown immediately after a vault is
 * created, before the user reaches the main app. The 24-word BIP39 phrase is
 * the ONLY way to recover every derived key, so we force an explicit
 * acknowledgement that it has been written down before clearing it from memory.
 */
export function MnemonicBackup() {
  const mnemonic = useAuthStore((s) => s.mnemonic);
  const clearMnemonic = useAuthStore((s) => s.clearMnemonic);

  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (!mnemonic) return null;
  const words = mnemonic.trim().split(/\s+/);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; the user can still read the words.
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center gradient-bg bg-grid">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-[560px] max-w-[92vw]"
      >
        <div className="glass rounded-2xl p-8 shadow-2xl">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl animate-pulse-glow" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                <span className="gradient-text">Save your recovery phrase</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                These 24 words can restore every key in this vault. Write them down
                and store them offline — they are shown <strong>only once</strong>.
              </p>
            </div>
          </div>

          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Never store this phrase digitally or share it. Anyone with these words
              can recover your keys. We cannot recover it for you.
            </span>
          </div>

          <div className="relative">
            <div
              className={`grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-background/40 p-4 transition ${
                revealed ? "" : "blur-sm select-none"
              }`}
            >
              {words.map((word, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm"
                >
                  <span className="w-5 text-right font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="font-medium">{word}</span>
                </div>
              ))}
            </div>
            {!revealed && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-background/30 text-sm font-medium text-foreground backdrop-blur-[1px] transition hover:bg-background/20"
              >
                <Eye className="h-4 w-4" /> Click to reveal
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {revealed ? "Hide" : "Reveal"}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!revealed}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-muted-foreground">
              I have written down my recovery phrase and stored it securely offline.
            </span>
          </label>

          <Button
            type="button"
            disabled={!confirmed}
            onClick={clearMnemonic}
            className="mt-5 w-full"
            size="lg"
          >
            Continue to Vault
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

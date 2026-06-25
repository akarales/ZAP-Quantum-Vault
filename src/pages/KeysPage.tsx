import { useEffect, useState } from "react";
import { KeyRound, Plus, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { useKeyStore } from "@/store/keyStore";
import { type KeyEntry } from "@/lib/api";

const keyTypes = [
  { value: "genesis", label: "Genesis" },
  { value: "validator", label: "Validator" },
  { value: "governance", label: "Governance" },
  { value: "treasury", label: "Treasury" },
  { value: "security", label: "Security Admin" },
  { value: "user", label: "User" },
  { value: "quantum", label: "Quantum-Safe" },
  { value: "custom", label: "Custom" },
];

function KeyTypeBadge({ type }: { type: string }) {
  const v: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    genesis: "secondary", validator: "default", governance: "secondary",
    treasury: "default", security: "destructive", user: "outline",
    quantum: "default", custom: "outline",
  };
  const k = Object.keys(v).find((k) => type.toLowerCase().includes(k));
  return <Badge variant={k ? v[k] : "outline"}>{type}</Badge>;
}

function KeyRow({ entry, index }: { entry: KeyEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const addr = entry.metadata.address;
  const shortAddr = `${addr.slice(0, 12)}...${addr.slice(-8)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg border border-border bg-card transition-all hover:border-primary/30"
    >
      <div className="flex cursor-pointer items-center gap-3 p-4" onClick={() => setExpanded(!expanded)}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium font-mono">{shortAddr}</p>
            <KeyTypeBadge type={entry.metadata.key_type} />
          </div>
          <p className="text-xs text-muted-foreground">
            {entry.metadata.derivation_path
              ? entry.metadata.derivation_path
              : `Purpose: ${entry.metadata.purpose} · Account: ${entry.metadata.account} · Index: ${entry.metadata.index}`}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(entry.metadata.created_at).toLocaleDateString()}
        </span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="space-y-3 p-4">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</label>
                  <CopyButton text={addr} />
                </div>
                <p className="rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">{addr}</p>
              </div>
              {entry.metadata.derivation_path && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Derivation Path</label>
                    <CopyButton text={entry.metadata.derivation_path} />
                  </div>
                  <p className="rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">{entry.metadata.derivation_path}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Deterministically derived from your recovery phrase &mdash; the same path always restores this exact key.
                  </p>
                </div>
              )}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Public Key</label>
                  <CopyButton text={entry.public_key_hex} />
                </div>
                <p className="rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">{entry.public_key_hex}</p>
              </div>
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs text-muted-foreground">
                  The secret key is encrypted at rest and never leaves the vault. Signing is performed
                  securely inside the backend &mdash; use the <span className="font-medium text-foreground">Sign</span> page.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function KeysPage() {
  const { keys, loading, error, fetchKeys, generateKey, clearError } = useKeyStore();
  const [showForm, setShowForm] = useState(false);
  const [keyType, setKeyType] = useState("quantum");
  const [purpose, setPurpose] = useState("0");
  const [account, setAccount] = useState("0");
  const [index, setIndex] = useState("0");

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleGenerate = async () => {
    const key = await generateKey(keyType, parseInt(purpose), parseInt(account), parseInt(index));
    if (key) {
      toast.success("Key generated successfully");
      setShowForm(false);
    } else {
      toast.error("Failed to generate key");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Key Management</h1>
          <p className="text-sm text-muted-foreground">Generate, view, and manage quantum-safe keys</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          Generate Key
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button onClick={clearError} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Generate New Key</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Key Type</label>
                    <NativeSelect value={keyType} onChange={(e) => setKeyType(e.target.value)} className="w-full">
                      {keyTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Purpose</label>
                    <Input type="number" value={purpose} onChange={(e) => setPurpose(e.target.value)} min="0" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</label>
                    <Input type="number" value={account} onChange={(e) => setAccount(e.target.value)} min="0" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Index</label>
                    <Input type="number" value={index} onChange={(e) => setIndex(e.target.value)} min="0" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleGenerate} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Generate
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {keys.length === 0 && !loading ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRound className="h-8 w-8" />
            </EmptyMedia>
            <EmptyTitle>No keys yet</EmptyTitle>
            <EmptyDescription>Generate your first quantum-safe key pair to get started with signing and air-gap transfers.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" />Generate Key</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-2">
          {keys.map((k, i) => <KeyRow key={k.id} entry={k} index={i} />)}
        </div>
      )}
    </div>
  );
}

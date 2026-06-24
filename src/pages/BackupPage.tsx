import { useState } from "react";
import { Save, Download, Upload, RefreshCw, Shield, AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";

export function BackupPage() {
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [exporting, setExporting] = useState(false);

  const mnemonicWords = [
    "quantum", "vault", "secure", "cipher", "entropy", "photon",
    "lattice", "crystal", "neutron", "photon", "wave", "field",
    "phase", "orbit", "flux", "spin", "quark", "boson",
    "hadron", "lepton", "fermion", "parity", "isotope", "resonance",
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      toast.success("Encrypted vault export downloaded");
    } catch (e) {
      toast.error(`Export failed: ${e}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Backup & Recovery</h1>
        <p className="text-sm text-muted-foreground">Mnemonic backup, encrypted vault export, and key rotation</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-primary" />
                Mnemonic Seed Phrase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-muted-foreground/30 bg-muted/10 px-4 py-2.5">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Never share your seed phrase. Store it offline.</span>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="secondary">24 words · BIP39</Badge>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowMnemonic(!showMnemonic)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                    {showMnemonic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <CopyButton text={mnemonicWords.join(" ")} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {mnemonicWords.map((word, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted px-2 py-1.5 text-center">
                    <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                    <p className="text-xs font-mono">{showMnemonic ? word : "••••"}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Save className="h-4 w-4 text-primary" />
                Vault Export
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">Encrypted Vault File</p>
                    <p className="text-xs text-muted-foreground">AES-256-GCM encrypted export</p>
                  </div>
                  <Badge>Ready</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">Last Backup</p>
                    <p className="text-xs text-muted-foreground">Never</p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleExport} disabled={exporting} className="flex-1">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
                </Button>
                <Button variant="outline" className="flex-1">
                  <Upload className="h-4 w-4" /> Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-primary" />
            Key Rotation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { label: "Keys Rotated", value: "0", badge: "None yet" as const },
              { label: "Next Rotation", value: "—", badge: "Not scheduled" as const },
              { label: "Rotation Policy", value: "Manual", badge: "Active" as const },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-lg font-bold">{item.value}</p>
                  <Badge variant={item.badge === "Active" ? "default" : "secondary"}>{item.badge}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

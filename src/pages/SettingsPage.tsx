import { Settings, Shield, Cpu, Info, Palette } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { YubiKeyCard } from "@/components/settings/YubiKeyCard";

export function SettingsPage() {
  const settingsGroups = [
    {
      title: "Security",
      icon: Shield,
      items: [
        { label: "Auto-lock timeout", value: "5 minutes", badge: "Active" as const },
        { label: "Argon2id memory", value: "64 MiB", badge: "Fixed" as const },
        { label: "Argon2id iterations", value: "3 passes", badge: "Fixed" as const },
        { label: "Argon2id parallelism", value: "4 lanes", badge: "Fixed" as const },
      ],
    },
    {
      title: "Cryptography",
      icon: Cpu,
      items: [
        { label: "Signature algorithm", value: "ML-DSA-87", badge: "FIPS 204" as const },
        { label: "Key encapsulation", value: "ML-KEM-1024", badge: "FIPS 203" as const },
        { label: "Symmetric cipher", value: "AES-256-GCM", badge: "FIPS 197" as const },
        { label: "Hash function", value: "BLAKE3", badge: "Default" as const },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Vault configuration, security, and appearance</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4 text-primary" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <Palette className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-muted-foreground">Choose from 43+ themes and switch between light/dark mode</p>
                </div>
              </div>
              <ThemeSwitcher />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <ChangePasswordCard />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <YubiKeyCard />
      </motion.div>

      {settingsGroups.map((group, gi) => (
        <motion.div key={group.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + gi * 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <group.icon className="h-4 w-4 text-primary" />
                {group.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <span className="text-sm">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground">{item.value}</span>
                    <Badge variant="secondary">{item.badge}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      ))}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-primary" />
              About
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Version", value: "1.0.0" },
                { label: "Framework", value: "Tauri 2 + React 19" },
                { label: "Crypto Backend", value: "Rust + pqcrypto" },
                { label: "Security Level", value: "NIST Level 5" },
                { label: "License", value: "MIT" },
                { label: "Repository", value: "akarales/ZAP-Quantum-Vault" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

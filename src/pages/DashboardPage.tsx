import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  KeyRound, Shield, ShieldCheck, Zap, ArrowRight,
  Lock, Cpu, Fingerprint,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useKeyStore } from "@/store/keyStore";

export function DashboardPage() {
  const navigate = useNavigate();
  const { keys, fetchKeys } = useKeyStore();

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const stats = [
    {
      label: "Total Keys",
      value: keys.length.toString(),
      icon: KeyRound,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Signature Algorithm",
      value: "ML-DSA-87",
      icon: Fingerprint,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Security Level",
      value: "NIST Level 5",
      icon: ShieldCheck,
      color: "text-muted-foreground",
      bg: "bg-muted",
    },
  ];

  const quickActions = [
    {
      title: "Generate Key",
      desc: "Create a new quantum-safe key pair",
      icon: KeyRound,
      path: "/keys",
    },
    {
      title: "Sign Transaction",
      desc: "Offline ML-DSA-87 message signing",
      icon: Zap,
      path: "/sign",
    },
    {
      title: "Air-Gap Transfer",
      desc: "QR code signing and verification",
      icon: ArrowRight,
      path: "/airgap",
    },
  ];

  const securityFeatures = [
    { label: "ML-DSA-87 Signatures", status: "Active", variant: "default" as const },
    { label: "ML-KEM-1024 Key Exchange", status: "Active", variant: "default" as const },
    { label: "Argon2id KDF (64 MiB)", status: "Active", variant: "default" as const },
    { label: "AES-256-GCM Encryption", status: "Active", variant: "default" as const },
    { label: "BLAKE3 Hashing", status: "Active", variant: "default" as const },
    { label: "Air-Gapped Mode", status: "Ready", variant: "secondary" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Quantum-safe vault overview
          </p>
        </div>
        <Badge className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Vault Unlocked
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="glow-primary-hover">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {quickActions.map((action, i) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            >
              <Card
                className="cursor-pointer glow-primary-hover"
                onClick={() => navigate(action.path)}
              >
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <action.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{action.title}</p>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Security Features
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {securityFeatures.map((feature) => (
              <div
                key={feature.label}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <span className="text-sm">{feature.label}</span>
                <Badge variant={feature.variant}>{feature.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4 text-primary" />
              Cryptographic Stack
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { name: "ML-DSA-87", desc: "Post-quantum digital signatures (FIPS 204)" },
              { name: "ML-KEM-1024", desc: "Post-quantum key encapsulation (FIPS 203)" },
              { name: "AES-256-GCM", desc: "Authenticated encryption (FIPS 197)" },
              { name: "Argon2id", desc: "Memory-hard KDF (RFC 9106)" },
              { name: "BLAKE3", desc: "Cryptographic hash function" },
              { name: "BIP39", desc: "24-word mnemonic seed generation" },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium font-mono">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Lock className="h-3.5 w-3.5 text-primary" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

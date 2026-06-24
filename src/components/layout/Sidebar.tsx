import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, KeyRound, PenTool, Usb, Save, Settings,
  Shield, Lock, ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useKeyStore } from "@/store/keyStore";
import { ThemeSwitcher } from "@/components/theme-switcher";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, desc: "Overview" },
  { to: "/keys", label: "Keys", icon: KeyRound, desc: "Key Management" },
  { to: "/sign", label: "Sign", icon: PenTool, desc: "Transaction Signing" },
  { to: "/airgap", label: "Air-Gap", icon: Usb, desc: "QR Transfer" },
  { to: "/backup", label: "Backup", icon: Save, desc: "Recovery" },
  { to: "/settings", label: "Settings", icon: Settings, desc: "Configuration" },
];

export function Sidebar() {
  const navigate = useNavigate();
  const lock = useAuthStore((s) => s.lock);
  const keyCount = useKeyStore((s) => s.keys.length);

  const handleLock = () => {
    lock();
    navigate("/");
  };

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-3 border-b border-sidebar-border p-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-lg bg-primary/30 blur-md" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight">ZAP Vault</h1>
          <p className="text-[10px] text-muted-foreground">Quantum-Safe</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item, i) => (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-primary/10 text-sidebar-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <div>{item.label}</div>
                    <div className="text-[10px] font-normal text-muted-foreground">
                      {item.desc}
                    </div>
                  </div>
                  {isActive && (
                    <ChevronRight className="h-3 w-3 text-sidebar-primary" />
                  )}
                </>
              )}
            </NavLink>
          </motion.div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-sidebar-accent px-3 py-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Keys</span>
          </div>
          <span className="text-xs font-semibold text-foreground">
            {keyCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <button
            onClick={handleLock}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-destructive/30 text-xs font-medium text-destructive transition-all hover:bg-destructive/10"
          >
            <Lock className="h-3.5 w-3.5" />
            Lock
          </button>
        </div>

        <div className="px-1 pt-1 text-[10px] text-muted-foreground">
          <p>ML-DSA-87 · NIST Level 5</p>
          <p>Quantum-Safe · Air-Gapped</p>
        </div>
      </div>
    </aside>
  );
}

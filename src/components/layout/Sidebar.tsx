import { NavLink } from "react-router-dom";
import { LayoutDashboard, KeyRound, PenTool, Usb, Save, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/keys", label: "Keys", icon: KeyRound },
  { to: "/sign", label: "Sign", icon: PenTool },
  { to: "/airgap", label: "Air-Gap", icon: Usb },
  { to: "/backup", label: "Backup", icon: Save },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex w-60 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 p-4">
        <Shield className="h-6 w-6 text-blue-600" />
        <span className="text-lg font-bold">ZAP Vault</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 text-xs text-zinc-400">
        <p>ML-DSA-87 · NIST Level 5</p>
        <p>Quantum-Safe · Air-Gapped</p>
      </div>
    </aside>
  );
}

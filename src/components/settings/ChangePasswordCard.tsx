import { useState } from "react";
import { KeyRound, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

function PasswordField({ label, value, onChange, autoFocus }: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-10 pr-10"
          placeholder="••••••••"
          autoFocus={autoFocus}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordCard() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const loading = useAuthStore((s) => s.loading);
  const changePassword = useAuthStore((s) => s.changePassword);
  const clearError = useAuthStore((s) => s.clearError);

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    oldPassword.length > 0 &&
    newPassword.length >= 8 &&
    passwordsMatch &&
    oldPassword !== newPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const ok = await changePassword(oldPassword, newPassword);
    if (ok) {
      toast.success("Password changed successfully");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      toast.error("Failed to change password. Check your current password.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          Change Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            label="Current Password"
            value={oldPassword}
            onChange={setOldPassword}
            autoFocus
          />
          <PasswordField
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
          />
          <PasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-xs text-muted-foreground">
              New password must be at least 8 characters
            </p>
          )}
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
          {newPassword.length > 0 && oldPassword === newPassword && (
            <p className="text-xs text-destructive">
              New password must differ from the current one
            </p>
          )}

          <Button type="submit" disabled={!canSubmit || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Update Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

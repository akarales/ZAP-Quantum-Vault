import { useEffect, useState } from "react";
import { Usb, Lock, Eye, EyeOff, Loader2, ShieldCheck, ShieldOff, AlertTriangle, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { api, type SlotInfo } from "@/lib/api";

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
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

export function YubiKeyCard() {
  const [enabled, setEnabled] = useState(false);
  const [slot, setSlot] = useState(2);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);

  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  const refreshStatus = async () => {
    try {
      const status = await api.yubikeyStatus();
      setEnabled(status.enabled);
      setSlot(status.slot || 2);
    } catch {
      // Vault may not be initialized yet; leave defaults.
    } finally {
      setStatusLoaded(true);
    }
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const info = await api.detectYubikey();
      setSlots(info.slots);
      setDetectedName(info.version ? `${info.name} · fw ${info.version}` : info.name);
      const configured = info.slots.filter((s) => s.configured);
      if (configured.length > 0) {
        // Keep the current slot if it is configured, else pick the first one.
        setSlot((prev) =>
          configured.some((s) => s.slot === prev) ? prev : configured[0].slot
        );
        toast.success(
          `Detected ${info.name}. Configured slot(s): ${configured
            .map((s) => s.slot)
            .join(", ")}`
        );
      } else {
        toast.warning(
          "YubiKey detected, but no slot is programmed for challenge-response."
        );
      }
    } catch (e) {
      setSlots([]);
      setDetectedName(null);
      toast.error(String(e));
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  // Auto-probe slots once the vault status is known and the factor is not yet
  // enabled, so the enroll form shows real slot availability without a click.
  useEffect(() => {
    if (statusLoaded && !enabled) {
      handleDetect().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusLoaded, enabled]);

  const selectedSlot = slots.find((s) => s.slot === slot);
  // If we have detection results, only allow enrolling on a configured slot.
  const selectedConfigured = slots.length === 0 || (selectedSlot?.configured ?? false);
  const slotOptions = slots.length > 0
    ? slots
    : [
        { slot: 2, configured: false, requires_touch: false },
        { slot: 1, configured: false, requires_touch: false },
      ];

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.enrollYubikey(password, slot);
      toast.success("YubiKey enrolled. It is now required to unlock the vault.");
      setPassword("");
      await refreshStatus();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.disableYubikey(password);
      toast.success("YubiKey disabled. The vault now unlocks with password only.");
      setPassword("");
      await refreshStatus();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Usb className="h-4 w-4 text-primary" />
          YubiKey Two-Factor
          {statusLoaded && (
            <Badge variant={enabled ? "default" : "secondary"} className="ml-auto">
              {enabled ? "Enabled" : "Disabled"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs text-muted-foreground">
            The YubiKey HMAC-SHA1 response is mixed into your vault key derivation.
            If you lose the key (or reprogram its slot), the vault becomes{" "}
            <strong>permanently unrecoverable</strong> unless you keep a backup key
            programmed with the same secret, or disable this factor first. Keep your
            recovery mnemonic safe.
          </p>
        </div>

        {!enabled ? (
          <form onSubmit={handleEnroll} className="space-y-4">
            {detectedName && (
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                <Fingerprint className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{detectedName}</span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Slot
              </label>
              <NativeSelect
                value={String(slot)}
                onChange={(e) => setSlot(Number(e.target.value))}
              >
                {slotOptions.map((s) => (
                  <NativeSelectOption key={s.slot} value={String(s.slot)}>
                    Slot {s.slot}
                    {slots.length > 0
                      ? s.configured
                        ? s.requires_touch
                          ? " — configured (touch)"
                          : " — configured"
                        : " — empty"
                      : s.slot === 2
                        ? " (recommended)"
                        : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {slots.length > 0 && !selectedConfigured && (
                <p className="text-xs text-destructive">
                  Slot {slot} is empty. Program it for HMAC-SHA1 challenge-response
                  (e.g. <span className="font-mono">ykman otp chalresp --touch --generate {slot}</span>) or pick a configured slot.
                </p>
              )}
              {selectedSlot?.requires_touch && (
                <p className="text-xs text-muted-foreground">
                  This slot requires a touch — tap the key when it blinks during enrollment.
                </p>
              )}
            </div>
            <PasswordField
              label="Current Password"
              value={password}
              onChange={setPassword}
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleDetect} disabled={detecting}>
                {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Usb className="h-4 w-4" />}
                Detect
              </Button>
              <Button type="submit" disabled={password.length === 0 || loading || !selectedConfigured}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Enroll YubiKey
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleDisable} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A YubiKey is enrolled on <span className="font-mono">slot {slot}</span>.
              To disable it, confirm your password with the key inserted.
            </p>
            <PasswordField
              label="Current Password"
              value={password}
              onChange={setPassword}
            />
            <Button type="submit" variant="destructive" disabled={password.length === 0 || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
              Disable YubiKey
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

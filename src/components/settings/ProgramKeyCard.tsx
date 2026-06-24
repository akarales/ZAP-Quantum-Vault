import { useEffect, useState } from "react";
import {
  Cpu,
  KeyRound,
  Usb,
  Loader2,
  Wand2,
  Trash2,
  ShieldAlert,
  Fingerprint,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CopyButton } from "@/components/ui/copy-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { api, type SlotInfo } from "@/lib/api";

const HEX_SECRET_LENGTH = 40; // 20 bytes

/**
 * In-app programming of a YubiKey's HMAC-SHA1 challenge-response slot, plus slot
 * formatting. Uses the native USB backend (no external tools). Programming and
 * erasing are destructive to the key's slot; the backend refuses to touch the
 * slot currently enrolled for the vault.
 */
export function ProgramKeyCard() {
  const [slot, setSlot] = useState(2);
  const [requireTouch, setRequireTouch] = useState(true);
  const [secretMode, setSecretMode] = useState<"generate" | "existing">("generate");
  const [existingSecret, setExistingSecret] = useState("");
  const [programming, setProgramming] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [detectedName, setDetectedName] = useState<string | null>(null);

  const detect = async () => {
    setDetecting(true);
    try {
      const info = await api.detectYubikey();
      setSlots(info.slots);
      setDetectedName(info.version ? `${info.name} · fw ${info.version}` : info.name);
    } catch (e) {
      setSlots([]);
      setDetectedName(null);
      toast.error(String(e));
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    detect().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const existingValid =
    secretMode === "generate" ||
    /^[0-9a-fA-F]{40}$/.test(existingSecret.trim());

  const handleProgram = async () => {
    if (!existingValid) {
      toast.error(`Secret must be ${HEX_SECRET_LENGTH} hex characters (20 bytes).`);
      return;
    }
    setProgramming(true);
    setGeneratedSecret(null);
    try {
      const usedSecret = await api.ykProgramHmac(
        slot,
        secretMode === "existing" ? existingSecret.trim() : null,
        requireTouch
      );
      // Only surface the secret when we generated it (the user needs to save it
      // to program backup keys). When reusing an existing secret, they have it.
      if (secretMode === "generate") {
        setGeneratedSecret(usedSecret);
      }
      toast.success(`Slot ${slot} programmed for HMAC-SHA1 challenge-response.`);
      await detect();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setProgramming(false);
    }
  };

  const handleErase = async () => {
    setErasing(true);
    try {
      await api.ykEraseSlot(slot);
      setGeneratedSecret(null);
      toast.success(`Slot ${slot} formatted.`);
      await detect();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setErasing(false);
    }
  };

  const slotState = slots.find((s) => s.slot === slot);
  const busy = programming || erasing || detecting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="h-4 w-4 text-primary" />
          Configure Hardware Key
          {detectedName && (
            <Badge variant="secondary" className="ml-auto font-normal">
              <Fingerprint className="mr-1 h-3 w-3" /> {detectedName}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs text-muted-foreground">
            Programming or formatting <strong>overwrites</strong> the chosen slot on the
            inserted key. Insert <strong>one</strong> key at a time. To create a working
            backup, program a second key with the <strong>same</strong> secret.
          </p>
        </div>

        {/* Slot picker + live state */}
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Slot
          </Label>
          <NativeSelect value={String(slot)} onChange={(e) => setSlot(Number(e.target.value))}>
            {[2, 1].map((n) => {
              const st = slots.find((s) => s.slot === n);
              return (
                <NativeSelectOption key={n} value={String(n)}>
                  Slot {n}
                  {st
                    ? st.configured
                      ? st.requires_touch
                        ? " — configured (touch)"
                        : " — configured"
                      : " — empty"
                    : ""}
                  {n === 2 ? " · recommended" : ""}
                </NativeSelectOption>
              );
            })}
          </NativeSelect>
          {slotState?.configured && (
            <p className="text-xs text-amber-500">
              Slot {slot} already has a credential — programming will replace it.
            </p>
          )}
        </div>

        {/* Touch requirement */}
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium leading-tight">Require touch</p>
              <p className="text-xs text-muted-foreground">
                Each response needs a physical tap (recommended)
              </p>
            </div>
          </div>
          <Switch checked={requireTouch} onCheckedChange={setRequireTouch} />
        </div>

        {/* Secret source */}
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Secret
          </Label>
          <RadioGroup
            value={secretMode}
            onValueChange={(v) => setSecretMode(v as "generate" | "existing")}
            className="gap-2"
          >
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                secretMode === "generate" ? "border-primary/40 bg-primary/5" : "border-border/50"
              )}
            >
              <RadioGroupItem value="generate" />
              <div>
                <p className="text-sm font-medium leading-tight">Generate a new random secret</p>
                <p className="text-xs text-muted-foreground">For your primary key</p>
              </div>
            </label>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                secretMode === "existing" ? "border-primary/40 bg-primary/5" : "border-border/50"
              )}
            >
              <RadioGroupItem value="existing" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">Use an existing secret</p>
                <p className="text-xs text-muted-foreground">
                  Paste the primary key's secret to make a matching backup
                </p>
              </div>
            </label>
          </RadioGroup>
          {secretMode === "existing" && (
            <Input
              value={existingSecret}
              onChange={(e) => setExistingSecret(e.target.value)}
              placeholder="40 hex characters (20 bytes)"
              className={cn(
                "font-mono",
                existingSecret.length > 0 && !existingValid && "border-destructive"
              )}
            />
          )}
        </div>

        {/* Generated secret reveal */}
        {generatedSecret && (
          <div className="glass space-y-2 rounded-xl border border-primary/30 p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <ShieldAlert className="h-4 w-4" /> Save this secret now
              </p>
              <CopyButton text={generatedSecret} />
            </div>
            <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
              {generatedSecret}
            </p>
            <p className="text-xs text-muted-foreground">
              Store it offline. To create a backup key, insert it and program the same slot
              using <strong>“Use an existing secret”</strong> with this value. It is not stored
              and will not be shown again.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={detect} disabled={busy}>
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Usb className="h-4 w-4" />}
            Detect
          </Button>
          <Button type="button" onClick={handleProgram} disabled={busy || !existingValid}>
            {programming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Configure slot {slot}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={busy} className="ml-auto">
                {erasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Format slot {slot}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Format slot {slot}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently erases whatever credential is in slot {slot} on the inserted
                  key. If this secret protects a vault and you have no backup key, the vault
                  becomes unrecoverable. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleErase}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Format slot
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <p className="text-xs text-muted-foreground">
          Programs the slot for HMAC-SHA1 challenge-response directly over USB — no terminal or
          external tools needed. After configuring, enroll the key in the YubiKey Two-Factor
          section above.
        </p>
      </CardContent>
    </Card>
  );
}

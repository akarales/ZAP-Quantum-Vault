import { useEffect, useState } from "react";
import { PenTool, CheckCircle2, AlertCircle, Zap, ShieldCheck, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { useKeyStore } from "@/store/keyStore";
import { api } from "@/lib/api";

export function SignPage() {
  const { keys, fetchKeys } = useKeyStore();
  const [selectedKeyId, setSelectedKeyId] = useState("");

  useEffect(() => { fetchKeys(); }, [fetchKeys]);
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [verified, setVerified] = useState<boolean | null>(null);
  const [signing, setSigning] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const selectedKey = keys.find((k) => k.id === selectedKeyId);

  const handleSign = async () => {
    if (!selectedKey) return;
    setSigning(true);
    setVerified(null);
    try {
      const messageHex = Array.from(new TextEncoder().encode(message))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const sig = await api.signMessageWithKey(selectedKey.id, messageHex);
      setSignature(sig);
      toast.success("Message signed with ML-DSA-87");
    } catch (e) {
      toast.error(`Signing failed: ${e}`);
    } finally {
      setSigning(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedKey || !signature) return;
    setVerifying(true);
    try {
      const messageHex = Array.from(new TextEncoder().encode(message))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const result = await api.verifyMessage({
        public_key_hex: selectedKey.public_key_hex,
        message_hex: messageHex,
        signature_hex: signature,
      });
      setVerified(result);
      result ? toast.success("Signature verified!") : toast.error("Signature verification failed");
    } catch (e) {
      setVerified(false);
      toast.error(`Verification failed: ${e}`);
    } finally {
      setVerifying(false);
    }
  };

  if (keys.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Sign Transaction</h1>
        <Empty className="border-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PenTool className="h-8 w-8" />
            </EmptyMedia>
            <EmptyTitle>No keys available</EmptyTitle>
            <EmptyDescription>Generate a key first in the Keys page to start signing messages with ML-DSA-87.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sign Transaction</h1>
        <p className="text-sm text-muted-foreground">Offline message signing with ML-DSA-87</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-primary" />
              Sign Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Select Key</label>
              <NativeSelect value={selectedKeyId} onChange={(e) => setSelectedKeyId(e.target.value)} className="w-full">
                <option value="">Choose a key...</option>
                {keys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.metadata.key_type} · {k.metadata.address.slice(0, 12)}...
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter message to sign..."
                rows={5}
              />
            </div>
            <Button onClick={handleSign} disabled={!selectedKey || !message || signing}>
              {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenTool className="h-4 w-4" />}
              Sign with ML-DSA-87
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Signature & Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence mode="wait">
              {signature ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signature (hex)</label>
                      <CopyButton text={signature} />
                    </div>
                    <p className="rounded-md bg-muted px-3 py-2 text-xs font-mono break-all max-h-32 overflow-y-auto">{signature}</p>
                  </div>
                  <Button onClick={handleVerify} disabled={verifying} variant="secondary">
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Verify Signature
                  </Button>
                  {verified !== null && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      {verified ? (
                        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                          <span className="text-sm text-primary">Signature is valid</span>
                          <Badge className="ml-auto">Verified</Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                          <AlertCircle className="h-5 w-5 text-destructive" />
                          <span className="text-sm text-destructive">Signature is invalid</span>
                          <Badge variant="destructive" className="ml-auto">Failed</Badge>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <Empty className="border-none">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <PenTool className="h-8 w-8" />
                    </EmptyMedia>
                    <EmptyTitle>No signature yet</EmptyTitle>
                    <EmptyDescription>Sign a message to generate and verify an ML-DSA-87 signature.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

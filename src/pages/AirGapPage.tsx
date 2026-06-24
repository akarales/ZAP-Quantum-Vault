import { useEffect, useState } from "react";
import { Usb, QrCode, ScanLine, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { useKeyStore } from "@/store/keyStore";
import { api, type AirGapEnvelope } from "@/lib/api";

export function AirGapPage() {
  const { keys, fetchKeys } = useKeyStore();
  const [mode, setMode] = useState<"generate" | "parse">("generate");

  useEffect(() => { fetchKeys(); }, [fetchKeys]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [payload, setPayload] = useState("");
  const [transferType, setTransferType] = useState("transaction");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [envelopeJson, setEnvelopeJson] = useState("");
  const [parsedEnvelope, setParsedEnvelope] = useState<AirGapEnvelope | null>(null);
  const [verified, setVerified] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const selectedKey = keys.find((k) => k.id === selectedKeyId);

  const handleGenerate = async () => {
    if (!selectedKey) return;
    setGenerating(true);
    try {
      const payloadHex = Array.from(new TextEncoder().encode(payload))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const result = await api.generateQrWithKey(selectedKey.id, payloadHex, transferType);
      setEnvelopeJson(result);
      const dataUrl = await QRCode.toDataURL(result, { width: 300, margin: 2 });
      setQrDataUrl(dataUrl);
      toast.success("QR envelope generated");
    } catch (e) {
      toast.error(`Generation failed: ${e}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleParse = async () => {
    if (!envelopeJson) return;
    setParsing(true);
    try {
      const env = await api.parseQr(envelopeJson);
      setParsedEnvelope(env);
      setVerified(false);
      toast.success("Envelope parsed (not yet verified)");
    } catch (e) {
      toast.error(`Parse failed: ${e}`);
    } finally {
      setParsing(false);
    }
  };

  const handleVerify = async () => {
    if (!envelopeJson) return;
    setVerifying(true);
    try {
      const env = await api.verifyQr(envelopeJson);
      setParsedEnvelope(env);
      setVerified(true);
      toast.success("Envelope verified: signature, freshness & replay checks passed");
    } catch (e) {
      setVerified(false);
      toast.error(`Verification failed: ${e}`);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Air-Gap Transfer</h1>
        <p className="text-sm text-muted-foreground">QR code envelope transfer for air-gapped signing</p>
      </div>

      <div className="flex gap-2">
        <Button variant={mode === "generate" ? "default" : "outline"} size="sm" onClick={() => setMode("generate")}>
          <QrCode className="h-4 w-4" /> Generate QR
        </Button>
        <Button variant={mode === "parse" ? "default" : "outline"} size="sm" onClick={() => setMode("parse")}>
          <ScanLine className="h-4 w-4" /> Parse QR
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {mode === "generate" ? (
          <motion.div key="generate" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            {keys.length === 0 ? (
              <Empty className="border-none">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Usb className="h-8 w-8" />
                </EmptyMedia>
                <EmptyTitle>No keys available</EmptyTitle>
                <EmptyDescription>Generate a key first to create air-gap transfer envelopes.</EmptyDescription>
              </EmptyHeader>
            </Empty>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Generate Envelope</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signing Key</label>
                      <NativeSelect value={selectedKeyId} onChange={(e) => setSelectedKeyId(e.target.value)} className="w-full">
                        <option value="">Choose a key...</option>
                        {keys.map((k) => <option key={k.id} value={k.id}>{k.metadata.key_type} · {k.metadata.address.slice(0, 12)}...</option>)}
                      </NativeSelect>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Transfer Type</label>
                      <NativeSelect value={transferType} onChange={(e) => setTransferType(e.target.value)} className="w-full">
                        <option value="transaction">Transaction</option>
                        <option value="key_export">Key Export</option>
                        <option value="message">Message</option>
                        <option value="backup">Backup</option>
                      </NativeSelect>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payload</label>
                      <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="Enter payload data..." rows={4} />
                    </div>
                    <Button onClick={handleGenerate} disabled={!selectedKey || !payload || generating}>
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />} Generate QR Code
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>QR Code Output</CardTitle></CardHeader>
                  <CardContent>
                    {qrDataUrl ? (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
                        <img src={qrDataUrl} alt="QR Code" className="rounded-lg border border-border p-2 bg-white" />
                        <div className="w-full">
                          <div className="mb-1 flex items-center justify-between">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Envelope JSON</label>
                            <CopyButton text={envelopeJson} />
                          </div>
                          <p className="rounded-md bg-muted px-3 py-2 text-xs font-mono break-all max-h-32 overflow-y-auto">{envelopeJson}</p>
                        </div>
                      </motion.div>
                    ) : (
                      <Empty className="border-none">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <QrCode className="h-8 w-8" />
                        </EmptyMedia>
                        <EmptyTitle>No QR generated</EmptyTitle>
                        <EmptyDescription>Fill in the form and generate to create a QR code envelope.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="parse" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Parse Envelope</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Envelope JSON</label>
                    <Textarea value={envelopeJson} onChange={(e) => setEnvelopeJson(e.target.value)} placeholder="Paste envelope JSON here..." rows={8} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleParse} disabled={!envelopeJson || parsing || verifying}>
                      {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} Parse (inspect)
                    </Button>
                    <Button onClick={handleVerify} disabled={!envelopeJson || parsing || verifying}>
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify &amp; Accept
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong>Parse</strong> only inspects untrusted contents. <strong>Verify</strong> checks the
                    signature, payload checksum, freshness window, and rejects replays.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Parsed Result</CardTitle></CardHeader>
                <CardContent>
                  {parsedEnvelope ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                      <div className="flex items-center gap-2">
                        {verified ? (
                          <>
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            <Badge>Verified &amp; Accepted</Badge>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="h-5 w-5 text-amber-500" />
                            <Badge variant="outline">Parsed — not verified</Badge>
                          </>
                        )}
                      </div>
                      {[
                        { label: "Version", value: parsedEnvelope.version.toString() },
                        { label: "Type", value: parsedEnvelope.transfer_type },
                        { label: "Timestamp", value: new Date(parsedEnvelope.timestamp * 1000).toLocaleString() },
                        { label: "Public Key", value: `${parsedEnvelope.public_key_hex.slice(0, 32)}...` },
                        { label: "Checksum", value: parsedEnvelope.checksum_hex },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-border px-3 py-2">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-sm font-mono break-all">{item.value}</p>
                        </div>
                      ))}
                    </motion.div>
                  ) : (
                    <Empty className="border-none">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ScanLine className="h-8 w-8" />
                      </EmptyMedia>
                      <EmptyTitle>No envelope parsed</EmptyTitle>
                      <EmptyDescription>Paste an envelope JSON and parse to view its contents.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

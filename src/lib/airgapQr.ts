/**
 * Multi-part QR framing for air-gap envelopes.
 *
 * Post-quantum (ML-DSA-87) envelopes are ~15 KB — far larger than the ~2.9 KB a
 * single QR code can hold. We therefore base64-encode the envelope JSON and
 * split it into numbered frames that an animated QR display cycles through; a
 * scanner collects the frames and reassembles them.
 *
 * Frame wire format (pipe-delimited, ASCII-safe):
 *   ZQV2|<id>|<index>|<total>|<base64-chunk>
 * where `id` groups frames of one transfer, `index` is 1-based.
 */

const FRAME_PREFIX = "ZQV2";

/**
 * Max base64 characters per frame. Kept well under a QR code's byte capacity so
 * the rendered codes stay low-density and reliably scannable from a screen.
 */
const CHUNK_SIZE = 1000;

/** UTF-8-safe base64 encode (handles non-Latin1 payloads). */
function toBase64(input: string): string {
  return btoa(unescape(encodeURIComponent(input)));
}

/** UTF-8-safe base64 decode. */
function fromBase64(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

/** Split an envelope JSON string into one or more QR frame strings. */
export function buildFrames(json: string): string[] {
  const b64 = toBase64(json);
  const id = Math.random().toString(36).slice(2, 8);
  const total = Math.max(1, Math.ceil(b64.length / CHUNK_SIZE));
  const frames: string[] = [];
  for (let i = 0; i < total; i++) {
    const chunk = b64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    frames.push(`${FRAME_PREFIX}|${id}|${i + 1}|${total}|${chunk}`);
  }
  return frames;
}

/**
 * Reassemble the original JSON from a set of frame strings. Returns `null` if
 * the frames are malformed, mix transfer ids, or are incomplete.
 */
export function reassembleFrames(texts: string[]): string | null {
  const parts = new Map<number, string>();
  let id = "";
  let total = 0;

  for (const t of texts) {
    const f = t.trim().split("|");
    if (f.length !== 5 || f[0] !== FRAME_PREFIX) continue;
    const [, fid, idxStr, totStr, chunk] = f;
    const idx = Number(idxStr);
    const tot = Number(totStr);
    if (!Number.isInteger(idx) || !Number.isInteger(tot) || tot < 1) continue;
    if (!id) {
      id = fid;
      total = tot;
    }
    if (fid !== id) continue;
    parts.set(idx, chunk);
  }

  if (total === 0 || parts.size !== total) return null;

  let b64 = "";
  for (let i = 1; i <= total; i++) {
    const chunk = parts.get(i);
    if (chunk === undefined) return null;
    b64 += chunk;
  }

  try {
    return fromBase64(b64);
  } catch {
    return null;
  }
}

/**
 * Resolve user-supplied text into an envelope JSON string. Accepts either a raw
 * envelope JSON object or pasted/scanned multi-part frames (one per line).
 */
export function extractEnvelopeJson(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  return reassembleFrames(lines) ?? trimmed;
}

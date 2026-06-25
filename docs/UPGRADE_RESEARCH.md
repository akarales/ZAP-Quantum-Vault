# ZAP Quantum Vault — Cutting-Edge Upgrade Research & Roadmap

> Status: **DRAFT for review** · Owner: engineering · Last updated: 2026-06-24
>
> Goal: capture every worthwhile upgrade to make the vault best-in-class
> (security, features, UX, platform reach), grounded in the current codebase,
> then implement in prioritized phases after sign-off.

---

## 0. How to read this doc

Each item lists: **What**, **Why**, **Current state** (in this repo), **Proposed
change**, **Effort** (S/M/L), and **Risk**. A consolidated, phased roadmap and an
**open-questions** checklist sit at the end. Nothing here is implemented until the
questions in §11 are answered.

---

## 1. Deterministic HD Key Derivation  ★ (chosen first)

### 1.1 The problem (verified in code)
- `generate_key` calls `mldsa87::generate()` which produces a **random** 32-byte
  seed. The `purpose`, `account`, and `index` fields are stored in
  `KeyMetadata` only — they are **labels with zero cryptographic effect**
  (`src-tauri/src/commands/keys.rs:141-164`, `src-tauri/src/models/key.rs:18-26`).
- A full HD module already exists and is unit-tested but **unused**:
  `KeyPath` + `derive_seed_from_master()` (BLAKE3-based) in
  `src-tauri/src/crypto/hd_derivation.rs`.
- ML-DSA keys here are **seed-based**: `SecretKey` stores the 32-byte seed and
  `MlSigningKey::<MlDsa87>::new(&seed)` is deterministic
  (`src-tauri/src/crypto/mldsa87.rs:113-137`, test at `:227-238`). So a derived
  32-byte seed → reproducible ML-DSA keypair. **HD is feasible today.**
- **Gap:** `create_vault` stores only `salt + verifier`; it does **not** create or
  persist a BIP39 mnemonic / master seed (`src-tauri/src/commands/vault.rs:227-259`).
  There is currently no stable secret to root an HD tree in.

### 1.2 Why it matters
- **Recoverability:** a single 24-word mnemonic can regenerate *every* key →
  true cold backup. Today, losing `keys.enc` loses all keys.
- **Determinism / auditability:** the same path always yields the same key across
  machines and reinstalls.
- **Survives password changes:** the HD master seed must be independent of the
  password (Argon2 master key), or rotating the password would change all keys.

### 1.3 Proposed design
1. **Master seed** generated at vault creation from a fresh BIP39 mnemonic
   (24 words). Store the 64-byte seed **inside the encrypted keystore** (or a
   sibling encrypted blob), so it is:
   - never on disk in plaintext,
   - available in-session after unlock,
   - re-encrypted (not regenerated) during `rekey_vault` on password change.
2. **Path scheme** (purpose/account/index already in the UI):
   `m / purpose' / coin_type' / account' / change / index`
   - Reuse existing `KeyPath::hardened(purpose, account, index)`.
   - Pick a ZAP `coin_type'` (register or use a private value).
3. **Key generation** becomes:
   `seed32 = derive_seed_from_master(master_seed64, path)` →
   `MlSigningKey::<MlDsa87>::new(seed32)` → store pk + (seed) + path metadata.
4. **Recovery flow:** "Restore from mnemonic" re-derives keys by scanning paths
   (gap-limit style) or by replaying stored path metadata from a backup.
5. **Domain separation:** keep the existing `b"ZAP_HD_derive"` tag; add the
   algorithm id to the transcript so ML-KEM and ML-DSA trees never collide.

### 1.4 Decisions needed → see §11 (Q1, Q2, Q3)
**Effort:** M–L · **Risk:** medium (touches vault format → needs migration).

---

## 2. Cryptography Hardening

| # | Item | Current | Proposal | Effort | Risk |
|---|------|---------|----------|--------|------|
| 2.1 | **ml-dsa version** | `0.1` (latest `0.1.1`, FIPS-204 final) | Pin policy aside, ensure `0.1.1`; track audits | S | low |
| 2.2 | **ML-KEM usage** | crate present, no command wires it | Use ML-KEM-1024 for encrypted air-gap *payloads* / recipient encryption | M | med |
| 2.3 | **Argon2 params** | m=64 MiB, t=3 (RFC 9106 "2nd recommended") | For an offline vault, offer a **high** profile (t=1, m=1–2 GiB per RFC 9106 "1st recommended"); make it a stored, versioned param block | S | low |
| 2.4 | **KDF param versioning** | implicit constants | Store `kdf_version` + params in `vault.json` so future bumps don't break old vaults | S | low |
| 2.5 | **Hybrid signing** | `hybrid_signing.rs` exists | Surface dual ML-DSA + BLAKE3-keyed signature in the Sign UI as an option | M | low |
| 2.6 | **Encryption AEAD** | AES-256-GCM for keystore | Consider XChaCha20-Poly1305 (already a dep) for misuse-resistant 192-bit nonces; or keep AES-GCM with random-nonce audit | S | low |
| 2.7 | **Secret hygiene** | `SecretKey: ZeroizeOnDrop`, keystore `Drop` zeroizes | Audit all transient `Vec<u8>`/`String` secret copies; wrap in `Zeroizing` consistently | S | low |
| 2.8 | **Field naming** | `encrypted_secret_hex` actually holds plaintext seed (file is encrypted) | Rename to `secret_seed_hex` to prevent misuse; doc the invariant | S | low |
| 2.9 | **KAT vectors** | unit tests only | Add FIPS-204 known-answer test vectors for ML-DSA-87 to guard against regressions | M | low |
| 2.10 | **Audit caveat** | RustCrypto ML-DSA is **unaudited** | Document the risk prominently; track upstream audit status | S | n/a |

---

## 3. Key Management & UX

| # | Item | Proposal | Effort |
|---|------|----------|--------|
| 3.1 | **Editable labels** | Add/rename `label` per key (already in model, not in UI) | S |
| 3.2 | **Key list polish** | Show path (`m/44'/…`), type badge, created date, copy-address, QR of address | S |
| 3.3 | **Watch-only import** | Import a public key/address for verification without secret | M |
| 3.4 | **Export / import** | Encrypted single-key export (passphrase-wrapped) for sharing/migration | M |
| 3.5 | **Multiple vaults / profiles** | Already supports `keys_file` generations; expose named profiles | M |
| 3.6 | **Delete / archive key** | Soft-delete with confirm; never silently drop secrets | S |
| 3.7 | **Address book** | Saved counterparties for air-gap transfers | M |

---

## 4. Air-Gapped Transfer

| # | Item | Current | Proposal | Effort |
|---|------|---------|----------|--------|
| 4.1 | **Multi-part animated QR** | Implemented (`src/lib/airgapQr.ts`) | Migrate to the **BC-UR (Uniform Resources)** standard for interop with other wallets/scanners | M |
| 4.2 | **Camera scan-in** | export only | Add webcam/file scan to *receive* signed envelopes | M |
| 4.3 | **Structured tx request** | raw hex payload | PSBT-like request/response schema with human-readable review screen | L |
| 4.4 | **Envelope encryption** | signed only | Optionally ML-KEM-encrypt to a recipient (ties to 2.2) | M |
| 4.5 | **Replay/freshness** | nonce+timestamp+replay cache present | Keep; add per-device monotonic counter | S |

---

## 5. Hardware Key / 2FA

| # | Item | Current | Proposal | Effort |
|---|------|---------|----------|--------|
| 5.1 | **YubiKey HMAC chal-resp** | enroll + program + format + backup verify (done) | Maintain; add slot-status auto-refresh | — |
| 5.2 | **Multiple enrolled keys** | single secret (backup must match) | Support N independent keys (store N challenges) | M |
| 5.3 | **FIDO2 / WebAuthn** | — | Optional PRF-extension factor (cross-platform, incl. passkeys) | L |
| 5.4 | **PIV / on-card keys** | — | Explore storing/signing on hardware (PIV) — note: not PQ today | L |
| 5.5 | **Mobile NFC** | — | NFC YubiKey on iOS/Android (ties to §7) | L |

---

## 6. Tauri / App Security Hardening
(Per Tauri 2 security guidance: CSP, Capabilities, Isolation pattern.)

| # | Item | Proposal | Effort |
|---|------|----------|--------|
| 6.1 | **Strict CSP** | Lock `default-src 'self'`; remove any inline/script eval; let Tauri inject nonces | S |
| 6.2 | **Capabilities least-privilege** | Audit `capabilities/*.json`; grant only used commands per window | S |
| 6.3 | **Isolation pattern** | Adopt Tauri Isolation pattern to sanitize IPC | M |
| 6.4 | **Signed auto-updates** | If updates ever ship, enforce signature verification (or stay fully offline by policy) | M |
| 6.5 | **Screen-capture/clipboard** | Auto-clear clipboard after copy; warn on screenshot of secrets | S |
| 6.6 | **Memory/anti-forensics** | mlock/zeroize critical buffers; disable core dumps on Unix | M |
| 6.7 | **Tamper-evident logging** | Append-only local audit log of sensitive actions | M |

---

## 7. Cross-Platform Expansion (Linux/Win/macOS + iOS/Android)

- **Core crate split:** factor crypto/HD/vault logic into a `wallet-core`
  `no_std`-friendly crate, with `tauri` as a thin shell. Enables mobile reuse.
- **Desktop gating:** keep USB YubiKey programming desktop-only (`#[cfg]`), with
  NFC path on mobile.
- **Storage abstraction:** trait over file storage so mobile uses platform
  secure storage / app sandbox.
- **CI matrix:** build all five targets.
**Effort:** L · **Risk:** medium.

---

## 8. Testing, QA & Supply Chain

| # | Item | Proposal | Effort |
|---|------|----------|--------|
| 8.1 | **KAT vectors** | FIPS-204 / FIPS-203 test vectors | M |
| 8.2 | **Property tests** | `proptest` for KDF/HD/encryption round-trips | M |
| 8.3 | **Fuzzing** | `cargo-fuzz` on envelope/QR parsers | M |
| 8.4 | **Supply chain** | `cargo-audit`, `cargo-deny`, SBOM (CycloneDX), pinned CI | S |
| 8.5 | **Frontend tests** | Vitest + Testing Library for critical flows | M |
| 8.6 | **E2E** | Playwright/Tauri driver for unlock→generate→sign→airgap | M |
| 8.7 | **Coverage gate** | enforce in CI | S |

---

## 9. Observability & Ops
- Structured `tracing` with redaction (never log secrets/seeds).
- Optional encrypted, rotating audit log.
- Backup health checks (verify keystore decrypts on a schedule while unlocked).

---

## 10. Prioritized Roadmap (proposed)

**Phase 1 — Foundational (do now)**
- §1 HD derivation + BIP39 master seed + vault-format migration (★ chosen)
- §2.4 KDF param versioning, §2.8 field rename, §2.3 high Argon2 profile
- §3.1/3.2 key labels + list polish

**Phase 2 — Security depth**
- §2.9 KAT vectors, §8.1–8.4 testing/supply-chain
- §6.1–6.3 Tauri CSP/capabilities/isolation
- §2.5 hybrid signing UI

**Phase 3 — Features & interop**
- §4.1 BC-UR, §4.2 camera scan, §4.3 structured tx review
- §5.2 multiple YubiKeys, §3.3/3.4 watch-only + export

**Phase 4 — Platform reach**
- §7 wallet-core split + mobile (iOS/Android) + NFC

---

## 11. Open Questions (please answer before implementation)

**Q1 — HD master-seed model.** Root the HD tree in a **new BIP39 mnemonic**
generated at vault creation (recommended: true mnemonic backup/recovery), or in a
**derived-from-existing-vault** secret (no new words, but weaker recovery)?

**Q2 — Vault format migration.** Existing vaults have no master seed. Acceptable
to **migrate on next unlock** (generate+store a seed, keep old random keys as
"imported/legacy" non-HD entries), or do you want a clean **reset/recreate**
since this is pre-release?

**Q3 — Path scheme / coin_type.** Use BIP44-style `m/44'/<coin>'/account'/change/index`?
What `coin_type'` should ZAP use (register an official SLIP-44 value, or a
placeholder for now)?

**Q4 — Argon2 strength.** Bump to the high offline profile (t=1, ~1–2 GiB) for
maximum brute-force resistance, accepting ~1–3s unlock on this hardware? Or keep
64 MiB/t=3 for snappier unlocks?

**Q5 — Scope of this initiative.** Implement **Phase 1 only** now (HD + migration
+ key UX) and iterate, or commit to **Phases 1–2** in one push?

**Q6 — Backward compatibility.** Any existing real vaults/keys to preserve, or are
we free to break format pre-1.0?

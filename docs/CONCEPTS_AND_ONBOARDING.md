# ZAP Quantum Vault — Concepts & Developer Onboarding

**Audience:** New developers joining the project, and anyone needing to understand the
cryptography and architecture of an **offline, air-gapped, quantum-safe** key vault.
**Status:** Living document
**Prereqs:** Comfortable with Rust basics; some crypto vocabulary helps but is explained below.

> This document explains every major concept in the wallet *from first principles*,
> maps each concept to the exact source file that implements it, and finishes with a
> set of **mock technical-interview questions and answers** so you can defend the design.

---

## Table of Contents

1. [What this product is (and is not)](#1-what-this-product-is-and-is-not)
2. [The threat model](#2-the-threat-model)
3. [Architecture at a glance](#3-architecture-at-a-glance)
4. [Concept primer (plain English)](#4-concept-primer-plain-english)
5. [HD key derivation — deep dive](#5-hd-key-derivation--deep-dive)
6. [Mnemonic backup & recovery — deep dive](#6-mnemonic-backup--recovery--deep-dive)
7. [The KDF and at-rest encryption](#7-the-kdf-and-at-rest-encryption)
8. [Signing: ML-DSA-87 and hybrid signing](#8-signing-ml-dsa-87-and-hybrid-signing)
9. [Air-gapped transfer (QR envelopes)](#9-air-gapped-transfer-qr-envelopes)
10. [YubiKey second factor](#10-yubikey-second-factor)
11. [Data at rest: file layout](#11-data-at-rest-file-layout)
12. [End-to-end lifecycles](#12-end-to-end-lifecycles)
13. [Glossary](#13-glossary)
14. [Mock technical-interview questions](#14-mock-technical-interview-questions)

---

## 1. What this product is (and is not)

**Zap Quantum Vault** is a desktop application (Tauri = Rust backend + React/TypeScript
frontend) for generating and storing **post-quantum** cryptographic keys and signing
messages/transactions **offline**.

| It IS | It is NOT |
|-------|-----------|
| An offline, air-gapped signer / key vault | A hot wallet that talks to a network |
| A generator of deterministic, recoverable keys from a 24-word phrase | A custodial service |
| A producer of quantum-safe (ML-DSA-87) signatures | A general crypto exchange / browser extension |
| A tool that keeps secret keys inside the Rust process | A web app that ships keys to a server |

**"Offline / air-gapped"** means the machine running the vault is assumed to have **no
network**. Transactions enter and leave through **QR codes** (or files), never through a
socket. The app itself makes **no outbound network calls** — this is enforced by a strict
Content-Security-Policy and least-privilege Tauri capabilities.

---

## 2. The threat model

Designing crypto is meaningless without stating *what you defend against*.

**Adversaries we defend against:**

- **Disk theft / cold storage compromise.** Someone steals the laptop or copies the
  vault directory. Defense: everything sensitive on disk is AES-256-GCM encrypted under a
  key derived from the user password (+ optional YubiKey) via memory-hard Argon2id.
- **Offline password brute-force.** The attacker has the encrypted files and grinds
  passwords. Defense: Argon2id with a ~1 GiB memory cost makes each guess expensive.
- **Replay / tampering of transfers.** An attacker captures a QR envelope and re-submits
  it, or edits a field. Defense: signed canonical envelopes with nonce + timestamp +
  replay cache.
- **"Harvest now, decrypt later" quantum attacker.** An adversary records signatures
  today to break them with a future quantum computer. Defense: ML-DSA-87 (a NIST
  PQC standard) is the primary signature algorithm.
- **Local malware reading process memory (partial).** Defense (best-effort): secrets are
  wrapped in `Zeroizing`, kept only while unlocked, and never crossed the IPC boundary to
  the webview.

**Explicitly out of scope:**

- A compromised OS kernel / hardware implant with full live memory access.
- The user losing **both** the password and the recovery phrase (by design unrecoverable).
- Coercion ("$5 wrench attack").

---

## 3. Architecture at a glance

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (React + TypeScript)  src/                          │
│  - Pages: Auth, Keys, Sign, Settings                          │
│  - Zustand stores (authStore, keyStore)                       │
│  - Talks to backend ONLY via Tauri invoke()  (src/lib/api.ts) │
└───────────────▲──────────────────────────────────────────────┘
                │  IPC (typed commands). SECRETS NEVER CROSS THIS LINE.
┌───────────────┴──────────────────────────────────────────────┐
│  Backend (Rust)  src-tauri/src/                               │
│                                                              │
│  commands/        Tauri command handlers (the API surface)   │
│    vault.rs       create / unlock / restore / rekey / yubikey │
│    keys.rs        generate_key (HD), list, keystore I/O       │
│    signing.rs     sign / verify / hybrid sign                 │
│    airgap.rs      QR envelope build / verify / replay guard   │
│    yubikey.rs     native USB HMAC-SHA1 programming + detect   │
│                                                              │
│  crypto/          Pure, unit-tested primitives               │
│    kdf.rs         Argon2id + BLAKE3 key derivation           │
│    mnemonic.rs    BIP39 24-word phrase ↔ 64-byte seed        │
│    hd_derivation.rs  paths + per-path seed from master       │
│    mldsa87.rs     ML-DSA-87 (FIPS 204) keygen/sign/verify    │
│    hybrid_signing.rs  ML-DSA-87 + Ed25519 hybrid             │
│    encryption.rs  AES-256-GCM + XChaCha20-Poly1305           │
│                                                              │
│  models/          Serializable state (VaultState, KeyEntry)  │
│  error.rs         VaultError enum (one error type)           │
└──────────────────────────────────────────────────────────────┘
```

**Key architectural rule:** the frontend never sees a secret key. It references keys by
`id`; the backend resolves the secret server-side for signing. See
`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/models/key.rs:51-59`
(the `KeyEntryPublic` redacted view).

---

## 4. Concept primer (plain English)

If any of these are new, read this before the deep dives.

- **Symmetric encryption (AEAD).** One key both locks and unlocks data, and also detects
  tampering. We use **AES-256-GCM** for vault data. "AEAD" = Authenticated Encryption with
  Associated Data: decryption *fails loudly* if even one bit was changed.
- **Nonce.** A "number used once" fed to the cipher so encrypting the same plaintext twice
  produces different ciphertext. Reusing a nonce with the same key is catastrophic for
  GCM, so we generate a fresh random nonce every time.
- **Hash function.** A one-way fingerprint. We use **BLAKE3** (fast, modern) for deriving
  sub-keys and for integrity checksums.
- **KDF (Key Derivation Function).** Turns a human password into a uniformly-random key.
  A *password hashing* KDF like **Argon2id** is deliberately **slow and memory-hard** to
  frustrate brute-force.
- **Digital signature.** A private key signs; anyone with the public key can verify. Proves
  authenticity + integrity without revealing the secret.
- **Post-quantum cryptography (PQC).** Algorithms believed safe against quantum computers.
  **ML-DSA-87** (formerly Dilithium) is the NIST FIPS-204 signature standard we use.
- **HD wallet (Hierarchical Deterministic).** A whole *tree* of keys derived from one
  master secret, so you can back up one phrase and recover everything.
- **BIP39 mnemonic.** The 24-word human-readable encoding of that master secret.

---

## 5. HD key derivation — deep dive

> **The question this answers:** "How can a user back up *one* 24-word phrase and recover
> *every* key they ever generated — while the wallet is fully offline and quantum-safe?"

### 5.1 The chain of derivation

```
24-word mnemonic (BIP39)
        │  PBKDF2-HMAC-SHA512, 2048 rounds  (mnemonic.rs)
        ▼
64-byte master seed  ───────────────────────────────────┐
        │                                                │ encrypted under the
        │  per-path: BLAKE3("ZAP_HD_derive" ‖ seed ‖ path)│ vault key and stored
        ▼  (hd_derivation.rs)                            │ as master_seed_enc_hex
32-byte child seed (one per derivation path)             │ in vault.json
        │  ML-DSA-87 keygen seeded by the 32-byte xi     │
        ▼  (mldsa87::from_seed)                          │
ML-DSA-87 keypair  +  address (BLAKE3 of public key)  ◄──┘
```

Implemented in:
- `@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/mnemonic.rs:34-52` (seed)
- `@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/hd_derivation.rs:150-159` (per-path child seed)
- `@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/mldsa87.rs:118-128` (`from_seed`)
- Wired together in `@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/keys.rs:155-166`

### 5.2 The path scheme

We use a BIP44-style, **fully hardened** path inside a fixed ZAP namespace:

```
m / 44' / 9999' / purpose' / account' / index'
   │      │        │          │          └ user-chosen leaf
   │      │        │          └ user-chosen account
   │      │        └ user-chosen purpose
   │      └ ZAP_COIN_TYPE (placeholder SLIP-44, fixed at v1)
   └ BIP44 purpose
```

See `zap_path()` at
`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/hd_derivation.rs:138-148`.

**Why "fully hardened"?** A *hardened* child cannot be derived from a parent's *public*
key — only from the private seed. In classic BIP32 this matters because non-hardened
derivation lets someone with an xpub + one child private key recover the parent. Our
scheme derives every child directly from the master via a keyed hash, and hardens all
components so there is **no public-derivation path** and no parent-key-recovery risk.

### 5.3 Why BLAKE3 instead of BIP32's HMAC-SHA512?

Classic BIP32 produces a 256-bit scalar for an elliptic-curve key. **ML-DSA-87 is not an
elliptic-curve scheme** — its keygen wants a uniform 32-byte seed (`xi`), not a curve
scalar. So instead of BIP32's ckd, we use a **domain-separated BLAKE3** of
`("ZAP_HD_derive" ‖ master_seed ‖ path_bytes)` to produce each child's 32-byte seed
(`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/hd_derivation.rs:150-159`).
This is simpler, constant-depth, and a perfect fit for FIPS-204 seeded keygen.

### 5.4 The two invariants that make recovery work

1. **Determinism.** Same master seed + same path ⇒ same key, *every time, forever*.
   Tested in `mldsa87::from_seed` determinism and HD reproducibility tests.
2. **Domain separation.** Different paths ⇒ independent keys (no correlation), guaranteed
   by mixing the path bytes into the hash.

Because of (1), the wallet **does not need to store private keys to recover them** — it can
regenerate the entire tree from the mnemonic. The on-disk keystore is a *convenience
cache + metadata store*, not the source of truth for key material.

### 5.5 Duplicate-path protection

Because derivation is deterministic, re-using a path would silently create a duplicate
key. `generate_key` rejects a path that already exists so the user picks a fresh index —
see `@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/keys.rs:181-188`.

---

## 6. Mnemonic backup & recovery — deep dive

### 6.1 What a mnemonic actually is

A BIP39 mnemonic is **entropy made human-rememberable**. 24 words encode 256 bits of
entropy + an 8-bit checksum. We generate it with
`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/mnemonic.rs:15-19`
using the `bip39` crate (English wordlist).

The words → seed step is **standard BIP39**: `PBKDF2-HMAC-SHA512(mnemonic, "mnemonic" +
passphrase, 2048 rounds) → 64 bytes`. We use the **empty passphrase** by default so the
seed is interoperable with any other BIP39 wallet
(`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/mnemonic.rs:27-52`).
An optional user passphrase (the BIP39 "25th word") is supported for plausible-deniability
/ extra security.

> **Historical note (good interview material):** an earlier version used a *hardcoded*
> passphrase. That added **zero** security (the constant lived in the public source) and
> **broke** BIP39 interoperability. It was removed — a textbook example of "security by
> obscurity is not security." See the doc-comment at `mnemonic.rs:27-36`.

### 6.2 The backup flow (one-time, write-it-down)

```
create_vault()                          MnemonicBackup.tsx
  ├ generate 24 words                    ├ shows the 24 words in a grid
  ├ derive 64-byte seed                  ├ blur-until-reveal, copy button
  ├ encrypt seed under vault key         ├ "I have written this down" gate
  └ return mnemonic to UI  ───────────►  └ continue → main app
                                         (mnemonic cleared from memory after)
```

- Backend: `create_vault` returns the phrase exactly once
  (`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/vault.rs:317-340`).
  It is **never persisted in plaintext** and cannot be retrieved again.
- Frontend gate:
  `@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src/components/auth/MnemonicBackup.tsx:1-143`.

### 6.3 The recovery flow

```
restore_from_mnemonic(phrase, password)
  ├ validate the 24 words (BIP39 checksum)
  ├ re-derive the SAME 64-byte master seed
  ├ initialize a fresh vault around that seed (new salt, new password)
  └ user re-generates keys at the same paths → identical keys return
```

See `@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/vault.rs:346-370`
and the UI in `@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src/pages/AuthPage.tsx`.

**Crucial design point:** recovery restores the *master seed*. The user then regenerates
keys at known paths to bring back identical keys. The HD invariant (Section 5.4) is what
makes this safe and lossless. The official BIP39 Trezor test vector is checked in
`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/mnemonic.rs:119-131`
to prove standard compliance.

### 6.4 What is stored vs. what is secret

| Item | Where | Protected how |
|------|-------|---------------|
| 24-word mnemonic | **Only in the user's head/paper** | Not stored at all |
| 64-byte master seed | `vault.json` → `master_seed_enc_hex` | AES-256-GCM under the vault key |
| Per-key secret seeds | `keys-*.enc` | AES-256-GCM under the vault key |
| Public keys, addresses, paths | `keys-*.enc` (and shown in UI) | Not secret |

If the user changes their password or YubiKey, the master seed is **re-wrapped** (decrypted
with the old key, re-encrypted with the new) — never regenerated — so derived keys stay
stable. See `rekey_vault` at
`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/vault.rs:210-215`.

---

## 7. The KDF and at-rest encryption

### 7.1 Argon2id profile

`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/kdf.rs:15-22`

| Profile | Memory | Iterations | Parallelism | Use |
|---------|--------|-----------|-------------|-----|
| `high` (default for new vaults) | **1 GiB** | 1 | 4 | Offline vault, ~1–2 s unlock |
| `legacy` | 64 MiB | 3 | 4 | Backward-compat / tests |

The high profile follows the RFC 9106 "first recommended" class. It is appropriate here
because unlocking is **rare and interactive**, unlike a server doing thousands of hashes/s.

### 7.2 Versioned, per-vault parameters

Each vault stores the exact Argon2 params it was built with (`kdf_version`,
`argon2_memory_kib`, etc.) in `vault.json`
(`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/models/vault.rs:53-71`).
This means we can raise defaults in the future **without breaking existing vaults** — each
vault is always derived with its own recorded parameters. Old vaults missing the block
deserialize as the legacy profile via serde defaults.

### 7.3 The key hierarchy

```
password (+ optional YubiKey HMAC response)
   │  Argon2id (slow, memory-hard, per-vault salt + params)
   ▼
32-byte master key
   │  BLAKE3("vault_encryption" ‖ master_key)   (domain separation)
   ▼
32-byte vault encryption key (AES-256-GCM)
   ├─ encrypts the verifier  ("ZAP_VAULT_VERIFIER" → password check)
   ├─ encrypts the master seed (master_seed_enc_hex)
   └─ encrypts the keystore file (keys-*.enc)
```

`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/kdf.rs:145-153` (domain-separated sub-key)

### 7.4 The verifier trick

We don't store a password hash. Instead we encrypt a known constant
`"ZAP_VAULT_VERIFIER"` under the vault key. On unlock, we derive the key and try to
decrypt it: success ⇒ correct password (AES-GCM's auth tag does the checking). See
`verify_enc_key` at
`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/vault.rs:171-185`.

### 7.5 Brute-force throttle

Even though Argon2 is slow, `unlock_vault` adds an in-memory exponential-backoff lockout
after 5 consecutive failures (30 s, doubling, capped at 300 s) — checked *before* the
expensive derivation. See `UnlockThrottle` at
`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/vault.rs:26-68`.

---

## 8. Signing: ML-DSA-87 and hybrid signing

### 8.1 ML-DSA-87 (FIPS 204)

The primary signature scheme — NIST Category 5 (highest), CNSA 2.0 compliant.

| Param | Size |
|-------|------|
| Public key | 2592 bytes |
| Signature | 4627 bytes |
| Seed (secret) | 32 bytes |

`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/mldsa87.rs:10-12`.
We store the **32-byte seed** as the secret (not the expanded secret key) and re-expand on
demand — smaller on disk and the canonical HD representation.

### 8.2 Why a hybrid (PQC + classical) option?

PQC standards are young. A defense-in-depth practice is to **combine** a post-quantum
signature with a battle-tested classical one, so a break in *either* algorithm alone does
not forge the signature. Our hybrid is **ML-DSA-87 + Ed25519**.

`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/hybrid_signing.rs:106-143`

Key properties:
- The Ed25519 secondary key is **deterministically derived** from the same ML-DSA seed
  (`BLAKE3("ZAP_hybrid_ed25519_v1" ‖ primary_seed)`), so the whole hybrid identity is
  recoverable from one HD seed — recovery still works.
- **Both** signatures must independently verify (`verify` returns error if either fails).
- Only the Ed25519 **public** key is published in the envelope.

### 8.3 The bug we fixed (great interview story)

The *original* "hybrid" secondary was a **keyed-BLAKE3 hash whose key was published in the
signature**. That is trivially forgeable — anyone with the envelope had the key and could
recompute the "signature" for any message. It provided **zero** real second factor. We
replaced it with a genuine Ed25519 signature. Regression test:
`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/hybrid_signing.rs:233-250`.

### 8.4 Secrets never cross IPC

`sign_message_with_key` / `sign_message_hybrid_with_key` take a **key id**, resolve the
secret *inside Rust*, sign, and return only the signature. The webview never receives key
material. See `@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/signing.rs:30-43`
and `secret_hex_for` (crate-private) at
`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/keys.rs:225-232`.

---

## 9. Air-gapped transfer (QR envelopes)

How data crosses the air gap without a network:

```
Online machine                     Air-gapped vault
  unsigned tx  ──QR──►  parse_qr → verify_qr → sign → generate_qr ──QR──►  broadcast
```

The **envelope** (v2) binds version + transfer-type + timestamp + random nonce + payload
into a single canonical, length-prefixed byte string that is then ML-DSA-87 signed
(`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/airgap.rs:47-64`).
Defenses:

- **Tampering:** any field change invalidates the signature (it's all signed).
- **Replay:** a per-process `SeenNonces` cache rejects a re-submitted envelope, and a
  300 s freshness window (±60 s skew) rejects stale ones
  (`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/airgap.rs:126-187`).
- **Integrity:** a BLAKE3 checksum of the payload is included and checked.

The nonce is only consumed **after** full crypto+freshness validation so a forged envelope
can't burn a legitimate nonce (`airgap.rs:227-231`).

---

## 10. YubiKey second factor

A YubiKey can be enrolled so the vault key derivation **also** requires the device's
HMAC-SHA1 challenge-response. The flow:

1. Program a slot for HMAC-SHA1 over native USB (no external `ykman` needed) —
   `yk_program_hmac` (`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/vault.rs:584-616`).
2. Enroll: a fresh challenge is stored in `vault.json`; the YubiKey's response to it is
   folded into the KDF input via a domain-separated, length-prefixed BLAKE3
   (`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/crypto/kdf.rs:124-143`).

Because the **slow Argon2 step depends on the YubiKey response**, the vault cannot be
derived without *both* the password and the physical key. The challenge is non-secret (its
security comes from the device's on-board secret). Guard rails prevent erasing/reprogramming
the slot a vault depends on (`ensure_slot_not_enrolled`, `vault.rs:564-578`).

---

## 11. Data at rest: file layout

Location: the OS app-local data dir under `com.zapblockchain.quantumvault`, restricted to
owner-only (`0700` dir, `0600` files on Unix). Created by `data_dir`
(`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/keys.rs:27-54`).

```
<app_local_data>/
├── vault.json        ← metadata: salt, verifier, KDF params, YubiKey fields,
│                       master_seed_enc_hex (all non-secret EXCEPT the encrypted seed)
├── keys-<uuid>.enc   ← AES-256-GCM encrypted keystore (current generation)
└── salt.txt          ← stronghold plugin salt
```

**Atomic writes:** every persist writes a temp file, `fsync`s, then `rename`s over the
target — so a crash never yields a half-written vault
(`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/keys.rs:81-93`).
Password/YubiKey changes write a **new generation** keystore file and swap atomically.

---

## 12. End-to-end lifecycles

**Create:** `create_vault` → generate mnemonic → derive seed → Argon2(high) → encrypt
verifier+seed → persist → return mnemonic → UI backup gate.

**Unlock:** throttle check → derive key (+YubiKey) → decrypt verifier → on success load
keystore + master seed into memory (`Zeroizing`).

**Generate key:** `zap_path(purpose,account,index)` → child seed from master →
`mldsa87::from_seed` → address → reject duplicate path → persist keystore.

**Sign:** UI sends key id → backend resolves secret → ML-DSA-87 (or hybrid) → return sig.

**Lock:** drop session key, master seed, and decrypted keystore from memory
(`@/home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT/src-tauri/src/commands/vault.rs:634-650`).

**Recover:** `restore_from_mnemonic` → re-derive seed → fresh vault → regenerate keys.

---

## 13. Glossary

| Term | Meaning |
|------|---------|
| **AEAD** | Authenticated Encryption with Associated Data (AES-GCM here) |
| **Argon2id** | Memory-hard password-hashing KDF |
| **BIP39** | Standard for mnemonic phrase ↔ seed |
| **BIP44** | Standard for HD derivation path structure |
| **BLAKE3** | Fast modern cryptographic hash |
| **CNSA 2.0** | NSA's Commercial National Security Algorithm Suite (mandates ML-DSA/ML-KEM) |
| **Ed25519** | Classical elliptic-curve signature (the hybrid's secondary) |
| **Hardened derivation** | Child key derivable only from the private parent |
| **HD wallet** | Hierarchical Deterministic — tree of keys from one seed |
| **ML-DSA-87** | NIST FIPS-204 post-quantum signature (was Dilithium) |
| **ML-KEM-1024** | NIST FIPS-203 post-quantum key encapsulation (was Kyber) |
| **Nonce** | Number used once, per encryption/envelope |
| **PQC** | Post-Quantum Cryptography |
| **Verifier** | Encrypted constant used to check the password |
| **Zeroizing** | Rust wrapper that wipes secret bytes on drop |

---

## 14. Mock technical-interview questions

> Use these to rehearse defending the design. Each has a model answer.

### Cryptography & key management

**Q1. Walk me through how one 24-word phrase can recover every key in this wallet.**
The 24 words are a BIP39 encoding of 256 bits of entropy. PBKDF2-HMAC-SHA512 (2048 rounds,
empty passphrase) turns them into a 64-byte master seed. For each key we build a hardened
path `m/44'/9999'/purpose'/account'/index'` and compute a 32-byte child seed via
`BLAKE3("ZAP_HD_derive" ‖ master_seed ‖ path)`. That 32-byte seed is the `xi` that
deterministically seeds ML-DSA-87 keygen. Because every step is deterministic and
domain-separated, the same phrase + same path always yields the same key — so we recover
the whole tree from the phrase without ever storing private keys as the source of truth.

**Q2. Why BLAKE3-of-(seed‖path) instead of BIP32's HMAC-SHA512 CKD?**
BIP32 outputs a 256-bit *curve scalar* for ECC keys. ML-DSA-87 isn't ECC — its keygen
wants a uniform 32-byte seed, not a scalar, and there is no point-addition tweak to apply.
A domain-separated BLAKE3 hash gives us a uniform 32-byte seed per path, is constant-depth,
and avoids inventing a curve operation that doesn't exist for lattice keys. We also harden
every component, eliminating BIP32's xpub-based parent-key-recovery concern entirely.

**Q3. What exactly is stored on disk, and what would an attacker who steals it get?**
`vault.json` (salt, verifier, Argon2 params, YubiKey challenge, and the *encrypted* master
seed) and `keys-*.enc` (the AES-256-GCM encrypted keystore). Everything sensitive is
encrypted under a key derived from the password (+ optional YubiKey) via 1 GiB Argon2id. An
attacker with the files must brute-force the password against a memory-hard KDF; without it
they get nothing usable.

**Q4. Why Argon2id at 1 GiB with only 1 iteration? Isn't more iterations better?**
Argon2id's dominant cost knob for offline attacks is **memory**. RFC 9106's first
recommendation is high memory with t=1. 1 GiB makes massively-parallel GPU/ASIC cracking
expensive (each guess needs a GiB of fast RAM). We can afford a ~1–2 s unlock because
unlocking is rare and interactive — unlike a login server. Params are versioned per-vault
so we can raise them later without breaking old vaults.

**Q5. How does the YubiKey actually add security — couldn't you just store its response?**
The YubiKey's HMAC-SHA1 response to a stored challenge is folded into the **input** of the
slow Argon2id derivation (domain-separated, length-prefixed). We never store the response;
we store only the non-secret challenge. The vault key literally cannot be computed without
the device producing the response live, so an attacker needs the password *and* the
physical key. The challenge being public is fine — its security comes from the device's
on-board HMAC secret.

**Q6. Explain the hybrid signature and the vulnerability you fixed.**
Hybrid = ML-DSA-87 (PQC) + Ed25519 (classical); both must verify, so breaking one algorithm
alone doesn't forge a signature. The original implementation's "secondary" was a
keyed-BLAKE3 MAC whose key was *published inside the signature* — trivially forgeable, zero
real protection. We replaced it with a real Ed25519 signature whose key is deterministically
derived from the primary seed (so recovery still works) and only the public key is
published. There's a regression test asserting a fabricated secondary is rejected.

**Q7. Why is the BIP39 passphrase empty by default, and why did you remove the old hardcoded one?**
Empty passphrase = standard BIP39 seed = interoperable with other wallets, verified against
the official Trezor test vector. The old hardcoded passphrase added no security (the
constant was in public source — security by obscurity) and *broke* interoperability. We
keep an *optional user-supplied* passphrase for those who want the real "25th word" benefit.

### Systems / architecture

**Q8. How do you guarantee secret keys never leak to the frontend?**
The IPC boundary only exchanges a redacted `KeyEntryPublic` (no secret field) and key
**ids**. Signing commands take an id, resolve the secret via the crate-private
`secret_hex_for`, sign in Rust, and return only the signature. Plus a strict CSP and
least-privilege Tauri capabilities, and in-memory secrets wrapped in `Zeroizing`.

**Q9. What stops a half-written file from corrupting the vault during a power loss?**
All persistence uses write-temp → fsync → atomic rename, so a reader always sees either the
old or the new file, never a partial one. Password/YubiKey changes write a *new generation*
keystore and only then atomically swap `vault.json` to point at it, cleaning up the old file
afterward — the verifier and keystore are never out of sync.

**Q10. It's air-gapped — how do transactions get in and out, and how do you prevent replay?**
Via signed QR envelopes. The envelope binds version, transfer type, timestamp, a 24-byte
random nonce, and the payload into one canonical length-prefixed message that's ML-DSA-87
signed. The receiver checks the signature, a BLAKE3 payload checksum, a 300 s freshness
window (±60 s skew), and a per-process seen-nonce cache. The nonce is consumed only after
all checks pass, so a forged envelope can't burn a real nonce.

**Q11. Why store the 32-byte seed as the secret instead of the expanded ML-DSA secret key?**
The 32-byte `xi` deterministically regenerates the full keypair via FIPS-204 seeded keygen.
It's far smaller on disk, it's the natural HD representation (the child seed *is* the key),
and it keeps the secret minimal in memory. We re-expand on demand to sign.

**Q12. How would you rotate the Argon2 parameters across the whole user base safely?**
Each vault already records its own params. To upgrade, bump the default profile; on the
next successful unlock (where we have the password), transparently re-derive with new params
and re-key the vault atomically (the same machinery `change_password` uses). Old vaults keep
unlocking with their stored params until migrated.

### Threat-modeling / "what if"

**Q13. A quantum computer arrives tomorrow. What breaks?**
Signatures are ML-DSA-87, which is designed to resist quantum attacks, so forging keys/sigs
stays hard. The classical Ed25519 half of a hybrid signature would be breakable, but a
hybrid still requires forging the ML-DSA half too. The main classical dependency is BIP39's
PBKDF2/HMAC-SHA512 for seed derivation and AES-256-GCM at rest — symmetric/hash primitives,
which Grover only weakens quadratically (AES-256 → ~128-bit, still safe).

**Q14. The user loses their YubiKey. Are they locked out?**
Only if they enrolled one and have no backup key. The design supports programming a *second*
YubiKey with the **same HMAC secret** and a `verify_yubikey_backup` command to confirm it
matches before relying on it. They can also disable the YubiKey factor with the password.

**Q15. Malware is running as the same user. What can it get?**
While locked: only encrypted files — it must still brute-force Argon2id. While unlocked: in
principle it could read process memory (we mitigate with `Zeroizing` and minimal secret
lifetime, but can't fully defend a same-privilege attacker). Secrets never touch the
webview, reducing the attack surface to the Rust process. A kernel-level compromise is out
of scope.

**Q16. Where would you attack this design first?**
The password (user-chosen, the weakest link — hence 1 GiB Argon2 + throttling + optional
YubiKey); the RNG quality for salts/nonces/keys; nonce-reuse in AES-GCM (mitigated by fresh
random nonces); and supply-chain (mitigated by `cargo-deny` + CI). I'd also fuzz the
envelope/QR parser since it ingests untrusted input.

---

*Cross-references: `SECURITY_AUDIT.md`, `TEST_AUDIT.md`, `PENETRATION_TESTING.md`,
`YUBIKEY_INTEGRATION.md`, `UPGRADE_RESEARCH.md`.*

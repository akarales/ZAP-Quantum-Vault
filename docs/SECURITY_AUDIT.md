# ZAP Quantum Vault — Security Audit Report

**Date:** 2026-06-23  
**Auditor:** Cascade AI (automated review)  
**Scope:** All cryptographic modules, command handlers, models, and error handling  
**Classification:** Internal — Development Team  

---

## Executive Summary

The ZAP Quantum Vault implements post-quantum cryptographic primitives (ML-DSA-87, ML-KEM-1024) with BLAKE3 hashing, Argon2id key derivation, and authenticated encryption (AES-256-GCM, XChaCha20-Poly1305). The implementation is functional with 241 passing tests. This audit identifies strengths, potential vulnerabilities, and recommended hardening measures.

> **Addendum 2026-06-23 (vault persistence + password change):** See [Section 8](#8-addendum--vault-persistence--password-change-2026-06-23) for the security review of the on-disk vault/keystore persistence and the `change_password` command.
> **Addendum 2026-06-23 (IPC redaction + atomic re-key):** See [Section 9](#9-addendum--ipc-secret-redaction--crash-atomic-re-key-2026-06-23) — the **Critical** IPC key-exposure finding (§6.1) and the **Medium** non-atomic re-key finding (A3) are now **RESOLVED**.

**Overall Risk Rating:** Medium — functional implementation with several hardening recommendations

---

## 1. Cryptographic Implementation Review

### 1.1 ML-DSA-87 (FIPS 204)

**Status:** ✅ Compliant

| Check | Result | Notes |
|-------|--------|-------|
| Algorithm | ML-DSA-87 | NIST FIPS 204 Category 5 (highest security) |
| Public key size | 2592 bytes | Matches FIPS 204 spec |
| Signature size | 4627 bytes | Matches FIPS 204 spec |
| Seed size | 32 bytes | Matches FIPS 204 spec |
| Deterministic signing | ✅ | Same seed + message = same signature |
| CNSA 2.0 compliance | ✅ | ML-DSA-87 is the required algorithm for national security systems |

**Findings:**
- ✅ Key generation uses `ml_dsa::Generate` trait with OsRng
- ✅ Signature verification properly rejects tampered signatures and wrong keys
- ✅ Hex encoding/decoding validates sizes before conversion
- ⚠️ `SecretKey` derives `Zeroize` but `PublicKey` also derives `Zeroize` — unnecessary but harmless
- ⚠️ `sign()` uses `unwrap()` on `try_into()` after size check — safe but could use `map_err` for defense-in-depth

### 1.2 ML-KEM-1024 (FIPS 203)

**Status:** ✅ Compliant

| Check | Result | Notes |
|-------|--------|-------|
| Algorithm | ML-KEM-1024 | NIST FIPS 203 Category 5 |
| Encapsulation key size | 1568 bytes | Matches FIPS 203 spec |
| Decapsulation seed size | 64 bytes | Matches FIPS 203 spec |
| Ciphertext size | 1568 bytes | Matches FIPS 203 spec |
| Shared secret size | 32 bytes | Matches FIPS 203 spec |
| CNSA 2.0 compliance | ✅ | ML-KEM-1024 is the required KEM for national security systems |

**Findings:**
- ✅ Key generation uses `MlKem1024::generate_keypair()` with OsRng
- ✅ Encapsulation/decapsulation roundtrip verified
- ⚠️ `KemKeyPair` and `KemCiphertext` do NOT derive `Zeroize` — shared secrets should be zeroized after use
- ⚠️ `encapsulated_key` field in `KemCiphertext` is redundant (copies encapsulation key) — minor data leak risk

### 1.3 BLAKE3 Hashing

**Status:** ✅ Secure

| Check | Result |
|-------|--------|
| Domain separation | ✅ All hash functions use domain tags (`ZAP_tx_hash`, `ZAP_block_hash`, etc.) |
| Keyed hashing | ✅ VRF and hybrid signing use `Hasher::new_keyed()` |
| Output size | ✅ 32-byte outputs throughout |
| Collision resistance | ✅ BLAKE3 provides 128-bit collision resistance |

### 1.4 Argon2id KDF

**Status:** ⚠️ Needs Review

| Parameter | Current Value | OWASP 2026 Recommendation | RFC 9106 Recommendation | Status |
|-----------|--------------|--------------------------|------------------------|--------|
| Memory (m) | 65536 KiB (64 MiB) | 19 MiB minimum, 64 MiB recommended | 64 MiB (second option) | ✅ |
| Iterations (t) | 3 | 2-3 | 3 (second option) | ✅ |
| Parallelism (p) | 4 | 1 | 4 (second option) | ✅ |
| Salt size | 16 bytes | 128-bit (16 bytes) | 128-bit | ✅ |
| Output size | 32 bytes | 256-bit (32 bytes) | 256-bit | ✅ |

**Findings:**
- ✅ Parameters match RFC 9106 second recommended option
- ✅ Salt is randomly generated with `OsRng`
- ⚠️ No password length limit enforced — could allow DoS via extremely long passwords
- ⚠️ No rate limiting on `unlock_vault` command — vulnerable to online brute force
- ⚠️ Master key is NOT zeroized after use in `create_vault` and `unlock_vault`

### 1.5 Authenticated Encryption

**Status:** ✅ Secure with minor findings

| Check | AES-256-GCM | XChaCha20-Poly1305 |
|-------|-------------|-------------------|
| Key size | 256-bit ✅ | 256-bit ✅ |
| Nonce size | 12 bytes (standard) ✅ | 24 bytes (extended) ✅ |
| Nonce generation | OsRng ✅ | OsRng ✅ |
| Nonce uniqueness | Random ✅ | Random ✅ |
| AEAD tag | 16 bytes (built-in) ✅ | 16 bytes (built-in) ✅ |
| Tamper detection | ✅ Verified | ✅ Verified |

**Findings:**
- ✅ Nonces are cryptographically random, not deterministic counters
- ✅ Both ciphers properly detect tampered ciphertext, nonces, and wrong keys
- ⚠️ AES-256-GCM has a 2^32 encryption limit per key — not a concern for vault use case
- ⚠️ No AAD (Additional Authenticated Data) used in vault encryption — could bind ciphertext to vault metadata

### 1.6 BIP39 Mnemonic

**Status:** ✅ Secure

| Check | Result |
|-------|--------|
| Word count | 24 words (256-bit entropy) ✅ |
| Language | English ✅ |
| Seed derivation | BIP39 `to_seed()` with passphrase ✅ |
| Passphrase | "ZAP_Quantum_Vault_v1" (hardcoded) ⚠️ |
| Validation | Full BIP39 checksum validation ✅ |

**Findings:**
- ✅ 24-word mnemonic provides 256-bit entropy + 8-bit checksum
- ⚠️ Hardcoded passphrase "ZAP_Quantum_Vault_v1" — all users share same seed derivation domain. Consider user-configurable passphrase for additional security.
- ✅ Invalid mnemonics are properly rejected

### 1.7 HD Key Derivation

**Status:** ✅ Secure

| Check | Result |
|-------|--------|
| Hardened derivation | ✅ Purpose and account always hardened |
| Path depth limit | ✅ Max 5 indices beyond purpose/account |
| Domain separation | ✅ "ZAP_HD_derive" prefix |
| Deterministic | ✅ Same seed + path = same derived key |

### 1.8 VRF (Verifiable Random Function)

**Status:** ✅ Secure

| Check | Result |
|-------|--------|
| Key generation | OsRng ✅ |
| Public key derivation | BLAKE3 keyed hash ✅ |
| Output computation | BLAKE3 keyed hash ✅ |
| Proof verification | ✅ Output + proof verified independently |
| Tamper detection | ✅ Tampered output, proof, and public key all rejected |

### 1.9 Hybrid Signing

**Status:** ✅ Secure

| Check | Result |
|-------|--------|
| Primary signature | ML-DSA-87 ✅ |
| Secondary signature | BLAKE3 keyed HMAC ✅ |
| Verification | Both signatures verified independently ✅ |
| Algorithm label | "ML-DSA-87+BLAKE3-HMAC" ✅ |
| Tamper detection | ✅ Both primary and secondary tampering detected |

### 1.10 Threshold Signatures

**Status:** ✅ Secure

| Check | Result |
|-------|--------|
| Share creation | ML-DSA-87 per-signer ✅ |
| Share verification | Each share verified before aggregation ✅ |
| Duplicate signer detection | HashSet-based deduplication ✅ |
| Threshold enforcement | Minimum shares checked ✅ |
| Message hash binding | BLAKE3 domain-separated hash ✅ |
| Algorithm label | "ML-DSA-87-Threshold" ✅ |

### 1.11 Proof Batching

**Status:** ✅ Secure

| Check | Result |
|-------|--------|
| Merkle tree construction | Pairwise BLAKE3 hashing ✅ |
| Odd node handling | Padded with zero hash ✅ |
| Root verification | Recompute tree, compare root ✅ |
| Tamper detection | Root, proof hash tampering detected ✅ |

---

## 2. Key Management & Memory Safety

### 2.1 Key Zeroization

| Component | Zeroize | Status |
|-----------|---------|--------|
| `mldsa87::SecretKey` | ✅ Derives `Zeroize` | Good |
| `mldsa87::PublicKey` | ✅ Derives `Zeroize` | Unnecessary but harmless |
| `mldsa87::Signature` | ❌ No `Zeroize` | Low risk — signatures are public |
| `mlkem1024::KemKeyPair` | ❌ No `Zeroize` | **HIGH RISK** — contains decapsulation seed |
| `encryption::Ciphertext` | ❌ No `Zeroize` | Low risk — ciphertext is encrypted |
| `kdf` master key `[u8; 32]` | ❌ Not zeroized | **MEDIUM RISK** — stack variable |
| `vrf::PqVrf` secret_key | ❌ No `Zeroize` | **MEDIUM RISK** — 32-byte secret on stack |
| `hybrid_signing::HybridSigner` | ❌ No `Zeroize` | **HIGH RISK** — contains primary_secret + secondary_secret |
| `threshold::ThresholdSigner` | ❌ No `Zeroize` | **HIGH RISK** — contains secret_key |

**Recommendations:**
1. Add `Zeroize` derive to `KemKeyPair`, `HybridSigner`, `ThresholdSigner`, `PqVrf`
2. Use `Zeroizing<[u8; 32]>` wrapper for master keys in `kdf` functions
3. Manually zeroize master_key and enc_key in `vault.rs` commands after use

### 2.2 RNG Usage

| Component | RNG | Status |
|-----------|-----|--------|
| ML-DSA-87 keygen | `ml_dsa::Generate` (OsRng) | ✅ |
| ML-KEM-1024 keygen | `MlKem1024::generate_keypair()` (OsRng) | ✅ |
| AES-256-GCM nonce | `rand::thread_rng().fill_bytes()` | ✅ |
| XChaCha20-Poly1305 nonce | `rand::thread_rng().fill_bytes()` | ✅ |
| Argon2id salt | `rand::thread_rng().fill_bytes()` | ✅ |
| VRF secret key | `OsRng.fill_bytes()` | ✅ |
| Hybrid secondary secret | `OsRng.fill_bytes()` | ✅ |

**All RNG uses `OsRng` or `thread_rng()` (backed by OsRng).** ✅ No custom or weak RNG.

### 2.3 Memory Safety

- ✅ No `unsafe` blocks in any source file
- ✅ All array conversions use `try_into()` with error handling
- ✅ No raw pointer arithmetic
- ✅ No FFI calls
- ⚠️ `unwrap()` used in 3 places after size validation — safe but not defense-in-depth

---

## 3. Error Handling & Information Leakage

### 3.1 Error Messages

| Check | Result |
|-------|--------|
| No secret data in errors | ✅ |
| Generic error messages | ✅ "Invalid password" vs specific crypto error |
| Error serialization | ✅ `VaultError` serializes to string via `to_string()` |
| No stack traces exposed | ✅ |

### 3.2 Timing Side Channels

| Component | Risk | Notes |
|-----------|------|-------|
| `verify()` ML-DSA-87 | Low | `ml_dsa` crate uses constant-time comparison internally |
| `decrypt_vault()` | Low | AES-GCM decryption fails fast on tag mismatch |
| `unlock_vault()` | **Medium** | Password verification decrypts + compares — timing varies with password correctness |
| `verify_share()` | Low | Signature verification is constant-time in `ml_dsa` |

**Recommendation:** Add constant-time comparison for vault verifier check in `unlock_vault`.

---

## 4. Attack Surface Analysis

### 4.1 Tauri IPC Commands

| Command | Input Validation | Output | Risk |
|---------|-----------------|--------|------|
| `create_vault` | Password string | Success/error string | Low |
| `unlock_vault` | Password string | bool | **Medium** — no rate limiting |
| `lock_vault` | None | Unit | Low |
| `generate_key` | key_type string, u32 values | KeyEntry | Low |
| `list_keys` | None | Vec<KeyEntry> | ⚠️ Returns encrypted_secret_hex |
| `get_key_detail` | key_id string | KeyEntry | ⚠️ Returns encrypted_secret_hex |
| `sign_message` | Hex strings | Hex signature | Low |
| `verify_message` | Hex strings | bool | Low |
| `generate_qr` | Hex strings + type | JSON string | Low |
| `parse_qr` | JSON string | AirGapEnvelope | Low |

**Findings:**
- ⚠️ `list_keys` and `get_key_detail` return `encrypted_secret_hex` — this is the raw secret key in hex. The field name says "encrypted" but the value is the plaintext secret key hex. This is a **CRITICAL** finding.
- ⚠️ No authentication/authorization on any command — any frontend code can call any command
- ⚠️ No rate limiting on `unlock_vault` — online brute force possible

### 4.2 Air-Gap QR Transfer

| Attack Vector | Risk | Mitigation |
|---------------|------|------------|
| QR code injection | Medium | Validate payload before signing |
| Checksum manipulation | Low | BLAKE3 checksum verified |
| Signature substitution | Low | Signature verified against public key |
| Replay attack | Medium | Timestamp included but not validated |
| Malformed JSON | Low | `serde_json::from_str` rejects malformed input |

**Recommendations:**
1. Validate timestamp freshness (reject envelopes older than N minutes)
2. Add nonce uniqueness tracking to prevent replay attacks
3. Validate payload structure before signing (not just hex decode)

---

## 5. Dependency Audit

| Dependency | Version | Known Vulnerabilities | Status |
|------------|---------|----------------------|--------|
| `ml-dsa` | 0.1 | None known | ✅ |
| `ml-kem` | 0.3 | None known | ✅ |
| `chacha20poly1305` | 0.10 | None known | ✅ |
| `aes-gcm` | 0.10 | None known | ✅ |
| `blake3` | 1 | None known | ✅ |
| `argon2` | 0.5 | None known | ✅ |
| `bip39` | 2 | None known | ✅ |
| `zeroize` | 1 | None known | ✅ |
| `serde` | 1 | None known | ✅ |
| `serde_json` | 1 | None known | ✅ |
| `rand` | 0.8 | None known | ✅ |
| `tauri` | 2 | None known | ✅ |

**Recommendation:** Run `cargo audit` regularly in CI pipeline.

---

## 6. Priority Remediation Items

### Critical (Fix Immediately)

1. **Key exposure via IPC** — `list_keys` and `get_key_detail` return plaintext secret keys. Encrypt or omit `encrypted_secret_hex` from IPC responses.

### High (Fix Before Production)

2. **Missing Zeroize on sensitive structs** — Add `Zeroize` derive to `KemKeyPair`, `HybridSigner`, `ThresholdSigner`, `PqVrf`
3. **No rate limiting on unlock** — Add exponential backoff or lockout after N failed attempts
4. **Master key not zeroized** — Zeroize `master_key` and `enc_key` after use in vault commands

### Medium (Hardening)

5. **Hardcoded mnemonic passphrase** — Allow user-configurable BIP39 passphrase
6. **No AAD in vault encryption** — Bind ciphertext to vault metadata (vault ID, version)
7. **Timestamp not validated in QR** — Add freshness check for air-gap envelopes
8. **No constant-time comparison** — Use `subtle::ConstantTimeEq` for vault verifier check

### Low (Future Improvements)

9. **No `cargo audit` in CI** — Add automated vulnerability scanning
10. **No fuzzing harness** — Add `cargo-fuzz` targets for crypto modules
11. **No anti-exfil protocol** — Consider DLEQ-proof-based anti-klepto signing
12. **No multisig across devices** — Consider cross-manufacturer threshold signing

---

## 7. Compliance Checklist

| Standard | Requirement | Status |
|----------|-------------|--------|
| FIPS 204 | ML-DSA-87 for digital signatures | ✅ |
| FIPS 203 | ML-KEM-1024 for key encapsulation | ✅ |
| CNSA 2.0 | ML-DSA-87 + ML-KEM-1024 exclusively | ✅ |
| RFC 9106 | Argon2id with recommended parameters | ✅ |
| RFC 8439 | XChaCha20-Poly1305 AEAD | ✅ |
| OWASP | Password storage with Argon2id | ✅ |
| BIP-39 | 24-word mnemonic with checksum | ✅ |
| BIP-32 | HD derivation with hardened paths | ✅ (BLAKE3-based, not secp256k1) |

---

*This audit was conducted via automated code review. A formal third-party audit is recommended before production deployment.*

---

## 8. Addendum — Vault Persistence & Password Change (2026-06-23)

This section reviews the changes introduced this session: on-disk persistence of the
vault and keystore, a `vault_status` probe, session-key lifecycle management, and the
`change_password` command.

### 8.1 New / changed components

| Component | File | Description |
|-----------|------|-------------|
| `vault_status` | `commands/vault.rs` | Reports whether a vault exists (reads `vault.json` if needed). |
| `create_vault` | `commands/vault.rs` | Now persists salt + verifier to `vault.json`; opens session. |
| `unlock_vault` | `commands/vault.rs` | Loads `vault.json`, decrypts keystore, populates session + `KeyStore`. |
| `change_password` | `commands/vault.rs` | Verifies old password, re-wraps verifier + re-encrypts keystore under a fresh salt/key. |
| `lock_vault` | `commands/vault.rs` | Clears `SessionKey` and the in-memory `KeyStore`. |
| `SessionKey` | `commands/keys.rs` | `Mutex<Option<[u8;32]>>` holding the AES key while unlocked. |
| `encrypt_keys` / `decrypt_keys` | `commands/keys.rs` | Pure (no-I/O) AES-256-GCM (de)serialization of the keystore. |
| `save_keys` / `load_keys` | `commands/keys.rs` | Disk I/O wrappers persisting to `keys.enc`. |

### 8.2 On-disk artifacts

| File (in `app_local_data_dir`) | Contents | Sensitivity | Protection |
|--------------------------------|----------|-------------|------------|
| `vault.json` | `initialized`, `salt_hex`, `verifier_hash_hex` | Low — no secrets; salt is not secret | Plaintext JSON (acceptable) |
| `keys.enc` | AES-256-GCM ciphertext of the serialized keystore | **High** — contains secret keys | Encrypted with Argon2id-derived key ✅ |

### 8.3 Findings

**Strengths (✅)**
- ✅ **Secrets encrypted at rest.** `keys.enc` is AES-256-GCM sealed with a key derived from the password via Argon2id (64 MiB / t=3 / p=4). Verified by `e2e_keystore_blob_is_not_plaintext` and `e2e_keystore_wrong_key_fails`.
- ✅ **Tamper-evident.** Corrupting the blob fails decryption (`e2e_keystore_tampered_blob_fails`).
- ✅ **Fresh nonce per save** (`e2e_keystore_nonce_unique_per_save`).
- ✅ **`change_password` uses a fresh salt** each time and re-wraps both the verifier and the keystore atomically in code order; old key no longer decrypts the new blob (`e2e_change_password_rekeys_keystore`).
- ✅ **`generate_key` requires an open session** (`SessionKey == Some`), preventing key creation while locked.
- ✅ **`lock_vault` drops the session key and clears decrypted keys** from process memory.
- ✅ The frontend `lock()` now invokes the backend `lock_vault` and resets the JS keystore.

**New / carried-over findings (⚠️)**

| # | Severity | Finding | Detail |
|---|----------|---------|--------|
| A1 | **High** (carried over) | Plaintext secret over IPC | `list_keys`/`get_key_detail` still return `encrypted_secret_hex`, which is the *plaintext* secret hex. Persistence now encrypts it at rest, but the IPC exposure from §4.1 / §6 remains. |
| A2 | Medium | Session key not zeroized | On `lock_vault` the `SessionKey` is set to `None` (drops the array) but the 32 bytes are not explicitly zeroized. Wrap in `Zeroizing<[u8;32]>`. |
| A3 | Medium | `change_password` not atomic across files | `vault.json` is written before `keys.enc`. A crash between the two writes could leave the verifier on the new key while `keys.enc` is on the old key, making keys unreadable. Mitigation: write to temp files + atomic rename, or write keystore first then verifier. |
| A4 | Low | No backup of prior `keys.enc` on re-key | A failed re-encryption mid-write could corrupt the only copy. Consider a `.bak` copy during `change_password`. |
| A5 | Low | No password strength enforced server-side | The 8-char minimum + strength meter are frontend-only; the backend accepts any password (empty included, per `e2e_vault_create_empty_password`). |
| A6 | Low | Files inherit default OS permissions | `vault.json` / `keys.enc` are created with default umask. Consider `0600` on Unix. |

### 8.4 Recommendations (priority order)

1. **(High)** Resolve A1 from the main report — stop returning raw secret keys over IPC; sign/derive server-side instead.
2. **(Medium)** A3 — make `change_password` crash-safe via temp-file + atomic rename, writing `keys.enc` before updating `vault.json`.
3. **(Medium)** A2 — use `Zeroizing<[u8;32]>` for `SessionKey` and zeroize derived keys in `create_vault` / `unlock_vault` / `change_password`.
4. **(Low)** A4/A6 — keep a `.bak` during re-key and set restrictive file permissions.

### 8.5 Test coverage added

11 new integration tests in `tests/e2e_integration.rs`:
`e2e_keystore_encrypt_decrypt_roundtrip`, `e2e_keystore_empty_roundtrip`,
`e2e_keystore_wrong_key_fails`, `e2e_keystore_blob_is_not_plaintext`,
`e2e_keystore_tampered_blob_fails`, `e2e_keystore_nonce_unique_per_save`,
`e2e_change_password_unlock_with_new_password`, `e2e_change_password_wrong_old_rejected`,
`e2e_change_password_before_create_rejected`, `e2e_change_password_rekeys_keystore`,
`e2e_change_password_fresh_salt_changes_verifier`.

**Result:** 236/236 tests passing (`cargo test`), frontend `tsc -b` clean.

---

## 9. Addendum — IPC Secret Redaction & Crash-Atomic Re-Key (2026-06-23)

This section documents the remediation of the **Critical** IPC key-exposure finding
(§4.1, §6.1) and the **Medium** non-atomic re-key finding (§8.3 A3). Both are now
**RESOLVED**.

### 9.1 Critical — Plaintext secret keys over IPC → RESOLVED

**Before:** `list_keys` and `get_key_detail` returned the full `KeyEntry`, including
`encrypted_secret_hex` (which held the *plaintext* secret key hex). Any code in the
webview could read every secret key.

**Fix:**
- Added `KeyEntryPublic` (`models/key.rs`) — a redacted projection containing only
  `id`, `metadata`, and `public_key_hex`. `KeyEntry::to_public()` performs the projection.
- `list_keys` → `Vec<KeyEntryPublic>`; `get_key_detail` → `KeyEntryPublic`;
  `generate_key` → `KeyEntryPublic`. The secret never crosses the IPC boundary.
- Added crate-private `secret_hex_for(keystore, key_id)` so secrets are resolved
  **server-side only**.
- New server-side commands that operate by key id:
  - `sign_message_with_key(key_id, message_hex)` (`commands/signing.rs`)
  - `generate_qr_with_key(key_id, payload_hex, transfer_type)` (`commands/airgap.rs`)
- Frontend updated: `KeyEntry` TS type drops the secret field; `SignPage`/`AirGapPage`
  call the `*_with_key` commands; `KeysPage` no longer displays/copies secret keys
  (replaced with an "secret never leaves the vault" notice).
- The legacy `sign_message` / `generate_qr` (which still accept a secret hex) are
  retained only for the air-gap import path and are no longer fed by `list_keys`.

**Residual note:** an explicit, deliberate export/backup flow for secret keys is
intentionally **not** provided. If a seed-export feature is added later it must be a
distinct, clearly-gated command — not the default key-listing path.

### 9.2 Medium — Non-atomic password change → RESOLVED

**Before:** `change_password` wrote `vault.json` then `keys.enc` with two separate
non-atomic writes; a crash between them could leave the verifier keyed to the new
password while the keystore was still keyed to the old (or vice-versa), bricking the vault.

**Fix — generation-based single-commit re-key:**
- `VaultState` gained a `keys_file` field (`#[serde(default = "default_keys_file")]`
  → `"keys.enc"` for backward compatibility) that names the keystore generation bound
  to the current salt/verifier.
- `atomic_write()` (`commands/keys.rs`) writes to a unique temp file, `fsync`s, then
  `rename`s over the destination — a partial write is never observed.
- `change_password` now:
  1. Verifies the old password and loads the keystore with the old key.
  2. Writes the re-encrypted keystore to a **new** generation file
     (`keys-<uuid>.enc`) — the live keystore is untouched.
  3. **Commits** by atomically writing `vault.json` (new salt + verifier + `keys_file`).
     This single atomic rename is the only point at which the change takes effect.
  4. Best-effort deletes the orphaned old generation file.
- Crash semantics: a crash before step 3 leaves the **old** vault fully intact; a crash
  after leaves a **fully consistent new** vault (worst case: one orphaned `keys-*.enc`).
- `persist_vault` and `save_keys` both use `atomic_write`, so all on-disk mutations are
  crash-safe.

### 9.3 Remaining open items (unchanged)

| Item | Severity | Status |
|------|----------|--------|
| §1.2 / §2.1 — `Zeroize` on `KemKeyPair`/`HybridSigner`/`ThresholdSigner`/`PqVrf` | High | **RESOLVED (§9.5)** |
| A2 — `SessionKey` / derived keys not zeroized | Medium | Open |
| A5 — no server-side password strength policy | Low | Open |
| A6 — default file permissions (consider `0600`) | Low | Open |
| §1.6 — hardcoded BIP39 passphrase | Medium | Open |
| §4.2 — air-gap timestamp/replay validation | Medium | Open |

### 9.4 Test coverage added

5 new integration tests in `tests/e2e_integration.rs`:
`e2e_key_public_view_omits_secret`, `e2e_key_public_view_list_has_no_secrets`,
`e2e_vault_state_keys_file_defaults_for_legacy_json`,
`e2e_vault_state_keys_file_roundtrip`,
`e2e_change_password_assigns_new_generation_file`.

**Result:** 241/241 tests passing (`cargo test` → 74 lib + 121 edge + 46 e2e),
frontend `tsc -b` clean, `cargo build` clean.

---

## 10. Addendum — Secret Zeroization on Drop (2026-06-24)

This section documents the remediation of the **High** finding (§1.2 / §2.1) that
secret-bearing crypto structs left key material in memory after use. **RESOLVED.**

### 10.1 High — Secrets not zeroized → RESOLVED

**Before:** `KemKeyPair` (ML-KEM-1024 decapsulation seed), `PqVrf` (VRF secret key),
`HybridSigner` (ML-DSA-87 secret + secondary seed), and `ThresholdSigner` (ML-DSA-87
secret) held secret material in plain `Vec<u8>` / `[u8; 32]` fields with no `Drop`
handling. After the value went out of scope the bytes lingered in freed heap/stack
memory until overwritten, widening the window for cold-boot / memory-scrape attacks.

**Fix:**
- `zeroize` (already a dependency, `features = ["derive"]`) now derives
  `Zeroize + ZeroizeOnDrop` on each secret-bearing struct:
  - `mldsa87::SecretKey` — now `ZeroizeOnDrop` (was `Zeroize` only).
  - `mlkem1024::KemKeyPair`
  - `vrf::PqVrf`
  - `hybrid_signing::HybridSigner`
  - `threshold::ThresholdSigner` (`threshold: usize` marked `#[zeroize(skip)]`).
- Dropping any of these now wipes the secret bytes (and, transitively, the contained
  `SecretKey`) to zero. Public-key fields are wiped too — harmless and keeps the derive
  uniform.
- `Signature` and public-only DTOs (`KemCiphertext`, `HybridSignature`,
  `ThresholdSignature`, `PublicKey`) are intentionally **not** `ZeroizeOnDrop` — they
  carry no secret.

### 10.2 Test coverage added

5 new unit tests (lib suite 73 → 78):
`mldsa87::test_secret_key_zeroize_clears_bytes`,
`mlkem1024::test_keypair_zeroize_clears_secret`,
`vrf::test_vrf_zeroize_clears_secret`,
`hybrid_signing::test_hybrid_signer_zeroize_clears_secrets`,
`threshold::test_threshold_signer_zeroize_clears_secret`.

Each constructs a signer/keypair, asserts the secret is populated, calls `.zeroize()`,
and asserts the secret bytes are cleared.

### 10.3 Remaining open items

| Item | Severity | Status |
|------|----------|--------|
| A2 — `SessionKey` / derived KDF keys not zeroized | Medium | **RESOLVED (§11)** |
| §1.6 — hardcoded BIP39 passphrase | Medium | Open |
| §4.2 — air-gap timestamp/replay validation | Medium | Open |
| A5 — no server-side password strength policy | Low | Open |
| A6 — default file permissions (consider `0600`) | Low | Open |

**Result:** 245/245 tests passing (`cargo test` → 78 lib + 121 edge + 46 e2e),
frontend `tsc -b` clean, `cargo build` clean.

---

## 11. Addendum — Session & Derived Key Zeroization (2026-06-24)

This section documents the remediation of the **Medium** finding A2 (§8.3): the
session key and per-operation derived KDF/encryption keys were not zeroized.
**RESOLVED.**

### 11.1 Medium — `SessionKey` / derived keys not zeroized → RESOLVED

**Before:**
- `SessionKey(Mutex<Option<[u8; 32]>>)` held the live AES key as a raw array.
  Replacing it (re-key) or clearing it (`lock_vault` set it to `None`) left the
  previous 32 bytes lingering in memory until overwritten.
- In `create_vault` / `unlock_vault` / `change_password`, the Argon2id master key
  and the BLAKE3-derived encryption key were local `[u8; 32]` values with no `Drop`
  handling, so they survived on the stack/heap after the command returned.

**Fix (`commands/keys.rs`, `commands/vault.rs`):**
- `SessionKey` now holds `Mutex<Option<Zeroizing<[u8; 32]>>>`. `Zeroizing` wipes the
  bytes on drop, so the old key is erased the moment the session is replaced or set
  to `None` on lock.
- Every derived key (`master_key`, `enc_key`, `old_master`, `old_enc`, `new_master`,
  `new_enc`) is now wrapped in `Zeroizing::new(...)`, erasing it when the command
  returns (including early-return error paths). Call sites are unchanged thanks to
  `Deref<Target = [u8; 32]>` coercion.
- `unlock_vault` was reordered to load the keystore *before* moving `enc_key` into the
  session (the wrapper is not `Copy`), preserving identical behavior.
- `generate_key` clones the session key into a local `Zeroizing` for the save call,
  which is likewise wiped on return.

**Residual:** the in-memory `KeyStore` still holds decrypted secret-key hex as plain
`String`s in `KeyEntry`. `lock_vault` drops them via `.clear()` but does not zeroize
the string buffers. Zeroizing `KeyEntry` secret material is tracked as a follow-up
(see §11.3).

### 11.2 Test coverage added

2 new integration tests in `tests/e2e_integration.rs`:
`e2e_session_key_zeroizing_roundtrip` (confirms the `Zeroizing<[u8; 32]>` session key
drives the keystore encrypt/decrypt path via deref coercion) and
`e2e_session_key_zeroizing_clears_on_drop` (asserts the `zeroize()` contract clears the
bytes).

### 11.3 Remaining open items

| Item | Severity | Status |
|------|----------|--------|
| Zeroize `KeyEntry` secret hex held in `KeyStore` | Medium | **RESOLVED (§12)** |
| §1.6 — hardcoded BIP39 passphrase | Medium | Open |
| §4.2 — air-gap timestamp/replay validation | Medium | Open |
| A5 — no server-side password strength policy | Low | Open |
| A6 — default file permissions (consider `0600`) | Low | Open |

**Result:** 247/247 tests passing (`cargo test` → 78 lib + 121 edge + 48 e2e),
frontend `tsc -b` clean, `cargo build` clean.

---

## 12. Addendum — In-Memory KeyEntry Secret Zeroization (2026-06-24)

This section documents the remediation of the residual item noted in §11.1: the
decrypted secret-key hex held in the in-memory `KeyStore` was not zeroized.
**RESOLVED.**

### 12.1 Medium — `KeyEntry` secret hex not zeroized → RESOLVED

**Before:** `KeyEntry.encrypted_secret_hex` (which holds the *plaintext* secret-key hex
once the keystore is unlocked) was a plain `String`. `lock_vault` dropped the
`Vec<KeyEntry>` via `.clear()`, but `String`'s default `Drop` only frees the heap
buffer — it does not wipe the bytes, leaving secret material recoverable from freed
memory. Transient copies returned by `secret_hex_for` for signing/air-gap had the same
problem.

**Fix:**
- **`models/key.rs`** — added a manual `impl Drop for KeyEntry` that calls
  `self.encrypted_secret_hex.zeroize()`. A manual `Drop` (rather than deriving
  `ZeroizeOnDrop`) is required because `KeyMetadata`/`DateTime<Utc>` do not implement
  `Zeroize`; only the secret field carries sensitive data. Every `KeyEntry` drop — on
  lock (`KeyStore::clear`), on re-key, or when a temporary clone falls out of scope —
  now wipes the secret.
- **`commands/keys.rs`** — `secret_hex_for` now returns `Zeroizing<String>` instead of
  `String`, so the transient secret copy handed to the signing / air-gap commands is
  wiped as soon as it leaves scope. Call sites are unchanged (deref coercion
  `&Zeroizing<String>` → `&str`), and the resulting `mldsa87::SecretKey` is already
  `ZeroizeOnDrop` (§10).

**Net effect:** combined with §10 (crypto structs) and §11 (session/derived keys),
plaintext secret-key material is now zeroized along every path: at rest in the
keystore, in transient signing copies, and inside the signer/keypair types.

### 12.2 Test coverage added

2 new lib unit tests in `models/key.rs`:
`tests::key_entry_secret_field_zeroizes` (asserts the secret field clears to empty via
`zeroize()`) and `tests::key_entry_public_view_omits_secret` (asserts the serialized
public projection never contains the secret hex).

### 12.3 Remaining open items

| Item | Severity | Status |
|------|----------|--------|
| §1.6 — hardcoded BIP39 passphrase | Medium | Open |
| §4.2 — air-gap timestamp/replay validation | Medium | **RESOLVED (§13)** |
| §4.1 — `unlock_vault` rate limiting / lockout | Medium | **RESOLVED (§14)** |
| A5 — no server-side password strength policy | Low | Open |
| A6 — default file permissions (consider `0600`) | Low | Open |

**Result:** 249/249 tests passing (`cargo test` → 80 lib + 121 edge + 48 e2e),
frontend `tsc -b` clean, `cargo build` clean.

---

## 13. Addendum — Air-Gap Replay Protection (2026-06-24)

This section documents the remediation of **PT-008 (QR replay attack)** and §4.2
(air-gap timestamp/replay validation). **RESOLVED.**

### 13.1 Medium — Air-gap envelope replay / tampering → RESOLVED

**Before (envelope v1):**
- The signature covered **only the payload**. The `nonce_hex` field was hardcoded to
  24 zero bytes, and `timestamp` was set but never validated on import.
- An attacker who captured a signed envelope could **replay** it indefinitely, and
  could freely alter the unsigned `nonce`, `timestamp`, or `transfer_type` fields
  without invalidating the signature.

**Fix (envelope v2 — `commands/airgap.rs`, `models/airgap.rs`):**
- **Signature binding.** Signing/verification now run over a canonical,
  length-prefixed message (`signing_message`) that binds `version`, `transfer_type`
  (via a stable `TransferType::tag()`), `timestamp`, `nonce`, and `payload`. Tampering
  with any of these invalidates the ML-DSA-87 signature.
- **Random nonce.** `build_envelope` fills a 24-byte nonce from `OsRng` per envelope,
  so every envelope is unique.
- **Freshness window.** `verify_envelope` rejects envelopes older than
  `MAX_AGE_SECS` (300s) or more than `MAX_SKEW_SECS` (60s) in the future.
- **Replay cache.** A new `verify_qr` command (managed `SeenNonces` state) records each
  accepted nonce and rejects any envelope whose nonce was already consumed in this
  process — closing the replay window even within the freshness period. The nonce is
  only consumed **after** full cryptographic + freshness validation, so a forged
  envelope can't burn a legitimate nonce.
- **Version gate.** `verify_envelope` rejects any envelope whose `version != 2`, so the
  weaker v1 format can no longer be accepted.
- **Frontend.** `AirGapPage` now exposes a distinct **"Verify & Accept"** action
  (`api.verifyQr`) alongside the inspect-only **"Parse"**, with a clear
  verified-vs-unverified status badge.

### 13.2 Test coverage added

10 new integration tests in `tests/e2e_integration.rs`: valid-envelope verifies;
tampered payload / timestamp / nonce / transfer-type rejected; expired and
future-dated envelopes rejected (with edge-of-window acceptance); wrong-version
rejected; replayed nonce rejected; distinct nonces accepted.

**Result:** all green; PT-008 reclassified **Mitigated**.

---

## 14. Addendum — Unlock Brute-Force Rate Limiting (2026-06-24)

This section documents the remediation of §4.1 (`unlock_vault` rate limiting).
**RESOLVED.**

### 14.1 Medium — No unlock attempt throttling → RESOLVED

**Before:** `unlock_vault` ran the Argon2id derivation and verifier check on every
call with no attempt limit, allowing unbounded online password guessing for the
lifetime of the process.

**Fix (`commands/vault.rs`):**
- New `UnlockThrottle` (managed `UnlockState`) tracks consecutive failures and a
  lockout deadline. Logic is pure (takes `now` explicitly) and unit-tested.
- After `MAX_UNLOCK_ATTEMPTS` (5) consecutive failures, unlocking is locked out with
  **exponential backoff**: `BASE_LOCKOUT_SECS` (30s) doubling per additional failure,
  capped at `MAX_LOCKOUT_SECS` (300s).
- The lockout is checked **before** the expensive Argon2 derivation, so a locked-out
  attacker also can't burn CPU. A successful unlock resets the throttle.
- Lockout reports remaining seconds via the new `VaultError::TooManyAttempts(u64)`.

**Scope note:** the throttle is **in-memory (per process)** — it mitigates online
guessing during a running session but resets on app restart. Persistent, disk-backed
lockout (surviving restarts) is a possible future hardening; offline attackers with the
vault file are already bounded by Argon2id + the password entropy.

### 14.2 Test coverage added

4 new integration tests in `tests/e2e_integration.rs`: allows attempts under the
threshold; locks after the threshold (with edge-of-window expiry); backoff grows and
caps at the maximum; a successful unlock resets the throttle.

### 14.3 Flaky test fixed

`crypto_edge_cases::test_mnemonic_wrong_word_count_rejected` truncated a 24-word
mnemonic to **12 words** — a *valid* BIP39 length — so it only failed on the checksum
(~15/16), making it flaky (~6% spurious failures). Changed to truncate to **13 words**
(an invalid length), which is deterministically rejected.

### 14.4 Remaining open items

| Item | Severity | Status |
|------|----------|--------|
| §1.6 — hardcoded BIP39 passphrase | Medium | **RESOLVED (§15)** |
| Persistent (disk-backed) unlock lockout across restarts | Low | Open |
| A5 — no server-side password strength policy | Low | Open |
| A6 — default file permissions (consider `0600`) | Low | Open |

**Result:** 263/263 tests passing (`cargo test` → 80 lib + 121 edge + 62 e2e),
frontend `tsc -b` clean, `cargo build` clean.

---

## 15. Addendum — Hardcoded BIP39 Passphrase Removed (2026-06-24)

This section documents the remediation of §1.6 (hardcoded BIP39 passphrase).
**RESOLVED.**

### 15.1 Medium — Hardcoded BIP39 passphrase → RESOLVED

**Before:** `mnemonic_to_seed` derived the BIP39 seed with a hardcoded passphrase,
`mnemonic.to_seed("ZAP_Quantum_Vault_v1")`. A passphrase baked into public source
provides **zero** additional security (it isn't secret) and, worse, makes the derived
seed **non-standard** — the same mnemonic restored in any standard BIP39 wallet (empty
passphrase) yields a different seed, silently breaking recoverability/interoperability.

**Fix (`crypto/mnemonic.rs`):**
- `mnemonic_to_seed` now uses the **standard empty BIP39 passphrase**, making the seed
  interoperable with any BIP39-compliant wallet.
- Added `mnemonic_to_seed_with_passphrase(words, passphrase)` for an *optional*,
  user-supplied passphrase (the genuine BIP39 "25th word"). The passphrase is a real
  secret that is never stored — by BIP39 design, losing it makes the wallet
  unrecoverable, and a different passphrase derives a different valid wallet.

**Blast radius:** `mnemonic_to_seed` had no production callers (production keys are
generated randomly via `mldsa87::generate`, not HD-derived from a mnemonic), so no
persisted material depended on the old non-standard seed; the change is safe.

### 15.2 Test coverage added

3 new lib unit tests in `crypto/mnemonic.rs`:
`test_default_seed_equals_empty_passphrase` (convenience wrapper == empty passphrase),
`test_passphrase_changes_seed` (distinct passphrases derive distinct seeds), and
`test_bip39_official_vector_interop` (matches the official Trezor BIP39 test vector for
the all-zero-entropy 24-word mnemonic with passphrase `"TREZOR"`, proving standard
PBKDF2-HMAC-SHA512 compliance).

### 15.3 Remaining open items

| Item | Severity | Status |
|------|----------|--------|
| Persistent (disk-backed) unlock lockout across restarts | Low | Open |
| A5 — no server-side password strength policy | Low | Open |
| A6 — default file permissions (consider `0600`) | Low | **RESOLVED (§16)** |

**Result:** 266/266 tests passing (`cargo test` → 83 lib + 121 edge + 62 e2e),
frontend `tsc -b` clean, `cargo build` clean.

> All **Medium**-and-above audit findings are now resolved; only **Low**-severity
> hardening items remain.

---

## 16. Addendum — Restrictive On-Disk File Permissions (2026-06-24)

This section documents the remediation of A6 (default file permissions).
**RESOLVED.**

### 16.1 Low — Vault/keystore files written with default permissions → RESOLVED

**Before:** `atomic_write` created files via `std::fs::File::create`, which honours the
process umask — typically `0644`, leaving `vault.json` and `keys*.enc` **world-readable**
by other local users. The data directory was created without an explicit mode.

**Fix (`commands/keys.rs`):**
- **Owner-only files (`0600`).** A new `create_private_file` helper opens the temp file
  with `OpenOptions::mode(0o600)` on Unix, so the file is private **from creation** with
  no world-readable window. `atomic_write` uses it for the temp file, and the atomic
  `rename` preserves `0600` on the destination. All sensitive writes funnel through
  `atomic_write` (both `persist_vault` → `vault.json` and `save_keys` → `keys*.enc`),
  so every persisted file is covered.
- **Owner-only directory (`0700`).** `data_dir` now calls `restrict_dir_permissions`
  to chmod the app data directory to `0700` on Unix, preventing other local users from
  listing or traversing it. `vault.rs::vault_file_path` was refactored to reuse this
  shared hardened directory (removing a duplicate, unhardened `create_dir_all`).
- **Cross-platform.** On non-Unix targets both helpers are no-ops; Windows relies on the
  per-user profile ACLs of the app-local data directory. The contents are AES-256-GCM
  encrypted regardless, so permissions are defence-in-depth.

### 16.2 Test coverage added

2 new Unix-only integration tests in `tests/e2e_integration.rs`:
`e2e_atomic_write_creates_owner_only_file` (a freshly written file is exactly `0600`)
and `e2e_atomic_write_overwrite_keeps_owner_only` (overwriting via the atomic rename
keeps `0600` and writes the new contents).

### 16.3 Remaining open items

| Item | Severity | Status |
|------|----------|--------|
| Persistent (disk-backed) unlock lockout across restarts | Low | Open |
| A5 — no server-side password strength policy | Low | Open |

**Result:** 268/268 tests passing (`cargo test` → 83 lib + 121 edge + 64 e2e),
frontend `tsc -b` clean, `cargo build` clean (0 warnings).

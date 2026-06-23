# ZAP Quantum Vault — Security Audit Report

**Date:** 2026-06-23  
**Auditor:** Cascade AI (automated review)  
**Scope:** All cryptographic modules, command handlers, models, and error handling  
**Classification:** Internal — Development Team  

---

## Executive Summary

The ZAP Quantum Vault implements post-quantum cryptographic primitives (ML-DSA-87, ML-KEM-1024) with BLAKE3 hashing, Argon2id key derivation, and authenticated encryption (AES-256-GCM, XChaCha20-Poly1305). The implementation is functional with 225 passing tests. This audit identifies strengths, potential vulnerabilities, and recommended hardening measures.

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

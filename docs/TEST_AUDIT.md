# ZAP Quantum Vault — Test & Audit Documentation

**Date:** 2026-06-23  
**Status:** Active  
**Classification:** Internal — Development Team  

---

## Overview

This document provides a comprehensive reference for the testing strategy, test inventory, security audit findings, and penetration testing results for the ZAP Quantum Vault project.

---

## 1. Test Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   TEST SUITE OVERVIEW                     │
├───────────────────┬─────────────────────────────────────┤
│  Test Type        │  Description                        │
├───────────────────┼─────────────────────────────────────┤
│  Unit Tests       │ Inline #[cfg(test)] modules in      │
│                   │ each crypto source file             │
├───────────────────┼─────────────────────────────────────┤
│  Edge Case Tests  │ Integration test file covering      │
│                   │ error paths, boundary conditions    │
├───────────────────┼─────────────────────────────────────┤
│  E2E Tests        │ Full workflow tests simulating      │
│                   │ Tauri command flows with mock state │
├───────────────────┼─────────────────────────────────────┤
│  Security Audit   │ Code review of crypto impl, RNG,    │
│                   │ key management, side channels       │
├───────────────────┼─────────────────────────────────────┤
│  Pen Testing      │ Attack surface analysis, brute      │
│                   │ force, QR injection, tampering      │
└───────────────────┴─────────────────────────────────────┘
```

---

## 2. Test Inventory

### 2.1 Unit Tests (Inline in Source Files)

| Module | File | Test Count | Coverage |
|--------|------|------------|----------|
| ML-DSA-87 | `src/crypto/mldsa87.rs` | 8 | Keygen, sign/verify, wrong key, deterministic, secret zeroize |
| ML-KEM-1024 | `src/crypto/mlkem1024.rs` | 8 | Keygen, roundtrip, unique keys, sizes, errors, secret zeroize |
| Encryption | `src/crypto/encryption.rs` | 8 | Encrypt/decrypt, nonce uniqueness, wrong key |
| KDF | `src/crypto/kdf.rs` | 7 | Determinism, different passwords/salts, domains |
| Mnemonic | `src/crypto/mnemonic.rs` | 6 | Generation, validation, seed, invalid words |
| HD Derivation | `src/crypto/hd_derivation.rs` | 5 | Parse, hardened, deterministic, different paths |
| Address | `src/crypto/address.rs` | 3 | Starts with zap1, deterministic, unique |
| Hash | `src/crypto/hash.rs` | 5 | Deterministic, different data, hex length |
| VRF | `src/crypto/vrf.rs` | 9 | Deterministic, different inputs/keys, verify, tamper, secret zeroize |
| Hybrid Signing | `src/crypto/hybrid_signing.rs` | 8 | Sign/verify, wrong message, tamper, algorithm label, secret zeroize |
| Threshold | `src/crypto/threshold.rs` | 8 | Create/verify share, aggregate, insufficient, duplicate, secret zeroize |
| Proof Batch | `src/crypto/proof_batch.rs` | 6 | Single, multiple, empty, tampered root/proof, power of 2 |
| **Total Unit** | | **81** | |

### 2.2 Edge Case Tests (`tests/crypto_edge_cases.rs`)

| Category | Test Count | Key Scenarios |
|----------|------------|---------------|
| ML-DSA-87 | 18 | Empty/large messages, deterministic, invalid sizes, tampered sig/pk, hex length, unicode |
| ML-KEM-1024 | 8 | Wrong key decap, invalid sizes, multiple encapsulations, size constants |
| Encryption | 14 | Empty/large plaintext, nonce/ciphertext tampering, invalid sizes, cross-cipher, nonce uniqueness |
| KDF | 13 | Empty/large password, salt boundaries, different master, param constants |
| Mnemonic | 9 | Empty string, partial, wrong word count, known valid, seed determinism |
| HD Derivation | 10 | Empty path, single component, too deep, non-hardened, roundtrip, invalid number |
| Address | 6 | Empty key, length, all zeros/ones, charset, large key |
| Hash | 8 | Empty/large data, hex conversion, tx vs block |
| VRF | 7 | Empty/large input, output size, deterministic, tampered pk, multiple inputs |
| Hybrid Signing | 7 | Empty/large message, deterministic, tampered pk, signature sizes |
| Threshold | 10 | Empty shares, single signer, exact/above threshold, empty/large message, tampered hash/threshold |
| Proof Batch | 8 | Two/three elements, large batch, tampered count, empty, single root, duplicates |
| **Total Edge** | | **118** |

### 2.3 E2E Integration Tests (`tests/e2e_integration.rs`)

| Category | Test Count | Key Scenarios |
|----------|------------|---------------|
| Vault Lifecycle | 7 | Create+unlock, wrong password, double create, unlock before create, empty/unicode password, verifier integrity |
| Key Management | 4 | Generate+derive, multiple unique, KeyEntry creation, all key types |
| Signing Workflow | 5 | Sign+verify, command workflow, invalid hex, tampered sig, large tx |
| Air-Gap QR | 9 | Generate+parse, secret-to-public, invalid hex/size, checksum, signature verifies, transfer types, malformed JSON |
| Mnemonic + HD | 3 | Mnemonic to seed to derivation, multiple paths, recovery |
| Full Workflow | 2 | Complete create→unlock→generate→sign, multiple accounts |
| Vault + Key + Encrypt | 1 | Encrypt/decrypt key material with vault key |
| Encrypted Keystore Persistence | 6 | Roundtrip, empty, wrong key, not-plaintext, tampered blob, unique nonce |
| Password Change | 5 | Unlock with new pw, wrong-old rejected, before-create rejected, keystore re-key, fresh-salt verifier |
| IPC Secret Redaction | 2 | Public view omits secret, list has no secrets |
| Generation-based Persistence | 3 | Legacy keys_file default, keys_file roundtrip, new-generation re-key file |
| Session Key Zeroization | 2 | `Zeroizing` session-key roundtrip, clears-on-drop contract |
| Air-Gap Replay Protection | 10 | Valid verify, tampered payload/timestamp/nonce/type, expired, future, wrong version, replay nonce, distinct nonces |
| Unlock Rate Limiting | 4 | Under-threshold allowed, locks after threshold, backoff grows/caps, success resets |
| File Permissions (Unix) | 2 | New file is `0600`, overwrite keeps `0600` |
| **Total E2E** | | **64** (cargo-reported) |

### 2.4 Grand Total

| Suite | Count (cargo-reported) |
|-------|-------|
| Unit Tests (lib) | 83 |
| Edge Case Tests | 121 |
| E2E Integration Tests | 64 |
| **Grand Total** | **268** |

**All 268 tests passing. 0 warnings. 0 failures.**

> **2026-06-23 update:** +11 E2E tests added for encrypted keystore persistence (`keys.enc`) and the `change_password` re-key flow, then +5 more for IPC secret redaction (`KeyEntryPublic`) and generation-based crash-atomic re-key. Counts reflect actual `cargo test` binary totals.
>
> **2026-06-24 update:** +5 unit tests for secret zeroization-on-drop (`Zeroize`/`ZeroizeOnDrop` on `SecretKey`, `KemKeyPair`, `PqVrf`, `HybridSigner`, `ThresholdSigner`), then +2 E2E tests for session/derived-key zeroization (`SessionKey` now holds `Zeroizing<[u8; 32]>`; derived KDF/encryption keys wrapped in `Zeroizing`), then +2 lib tests for in-memory `KeyEntry` secret zeroization (manual `Drop` + `secret_hex_for` returns `Zeroizing<String>`).
>
> **2026-06-24 update (replay + rate limit):** +10 E2E tests for air-gap envelope v2 replay protection (signature binds nonce/timestamp/type; freshness window; nonce replay cache) closing PT-008, and +4 E2E tests for `unlock_vault` exponential-backoff rate limiting. Also fixed a flaky `test_mnemonic_wrong_word_count_rejected` (truncated to a valid 12-word length; now uses an invalid 13-word length).
>
> **2026-06-24 update (BIP39 passphrase):** removed the hardcoded BIP39 passphrase from `mnemonic_to_seed` (now standard empty passphrase, interoperable) and added `mnemonic_to_seed_with_passphrase` for an optional user passphrase. +3 lib unit tests including an official Trezor BIP39 test-vector interop check.
>
> **2026-06-24 update (file permissions):** `atomic_write` now creates files `0600` and `data_dir` is `0700` on Unix (owner-only), closing A6. +2 Unix-only integration tests. Also removed 2 stale unused imports (`zeroize::Zeroize` in `mldsa87`/`key` test modules); build is now warning-free.

---

## 3. Running Tests

### All Tests
```bash
cd src-tauri
cargo test
```

### Specific Test Suite
```bash
# Unit tests only
cargo test --lib

# Edge case tests only
cargo test --test crypto_edge_cases

# E2E integration tests only
cargo test --test e2e_integration

# Specific test
cargo test --test crypto_edge_cases test_mldsa_sign_empty_message
```

### With Output
```bash
cargo test -- --nocapture
```

### Release Mode (for performance benchmarks)
```bash
cargo test --release
```

### Code Coverage
```bash
cargo tarpaulin --out html --output-dir coverage/
```

---

## 4. Security Audit Summary

**Full report:** [`docs/SECURITY_AUDIT.md`](SECURITY_AUDIT.md)

### Key Findings

| Severity | Count | Top Items |
|----------|-------|-----------|
| Critical | 1 | Secret keys exposed via IPC (`list_keys`, `get_key_detail`) |
| High | 3 | Missing Zeroize on sensitive structs, no rate limiting, master key not zeroized |
| Medium | 4 | Hardcoded mnemonic passphrase, no AAD, timestamp not validated, no constant-time comparison |
| Low | 4 | No cargo-audit CI, no fuzzing, no anti-exfil, no multisig |

### Compliance Status

| Standard | Status |
|----------|--------|
| FIPS 204 (ML-DSA-87) | ✅ Compliant |
| FIPS 203 (ML-KEM-1024) | ✅ Compliant |
| CNSA 2.0 | ✅ Compliant |
| RFC 9106 (Argon2id) | ✅ Compliant |
| OWASP Password Storage | ✅ Exceeds minimum |

---

## 5. Penetration Testing Summary

**Full report:** [`docs/PENETRATION_TESTING.md`](PENETRATION_TESTING.md)

### Test Results

| ID | Attack Vector | Risk | Status |
|----|---------------|------|--------|
| PT-001 | Vault password brute force | HIGH | ✅ Mitigated (in-memory exponential-backoff lockout; offline bound by Argon2id) |
| PT-002 | Secret key exfiltration via IPC | CRITICAL | ✅ Mitigated (redacted `KeyEntryPublic`; secrets resolved server-side only) |
| PT-003 | QR code payload injection | MEDIUM | ⚠️ Partially mitigated |
| PT-009 | Local file disclosure (other OS users) | LOW | ✅ Mitigated (vault files `0600`, data dir `0700` on Unix) |
| PT-004 | Vault ciphertext tampering | LOW | ✅ Mitigated |
| PT-005 | Signature forgery / tamper | LOW | ✅ Mitigated |
| PT-006 | Threshold signature manipulation | MEDIUM | ✅ Mitigated |
| PT-007 | Mnemonic brute force | LOW | ✅ Infeasible |
| PT-008 | QR replay attack | MEDIUM | ✅ Mitigated (envelope v2: signed nonce/timestamp + freshness + replay cache) |

---

## 6. Remediation Roadmap

### Phase 1: Critical Fixes (Immediate)

- [x] Remove `encrypted_secret_hex` from IPC response structs (redacted `KeyEntryPublic` DTO)
- [x] Add rate limiting to `unlock_vault` (exponential backoff lockout after 5 attempts)
- [x] Add `Zeroize`/`ZeroizeOnDrop` derive to `KemKeyPair`, `HybridSigner`, `ThresholdSigner`, `PqVrf`, `SecretKey`
- [x] Zeroize master key and encryption key in vault commands after use (`Zeroizing` wrapper)

### Phase 2: High Priority (Before Production)

- [ ] Validate QR payload structure before signing
- [x] Add timestamp freshness check to QR envelopes (envelope v2: signed nonce/timestamp + freshness window + replay cache)
- [ ] Add AAD to vault encryption (bind to vault metadata)
- [ ] Use `subtle::ConstantTimeEq` for vault verifier comparison
- [ ] Add password length limit (max 1024 bytes) to prevent DoS

### Phase 3: Hardening (Future)

- [x] Set restrictive permissions on vault files (`0600` files / `0700` data dir, Unix)
- [ ] Add `cargo-audit` to CI pipeline
- [ ] Add `cargo-fuzz` targets for crypto modules
- [ ] Benchmark Argon2id on minimum supported hardware
- [ ] Implement anti-exfil (DLEQ proof) signing protocol
- [x] Add user-configurable BIP39 passphrase (`mnemonic_to_seed_with_passphrase`; removed hardcoded passphrase)
- [ ] Implement multisig across devices

---

## 7. Test File Locations

```
src-tauri/
├── src/
│   └── crypto/
│       ├── mldsa87.rs          # 8 unit tests
│       ├── mlkem1024.rs        # 8 unit tests
│       ├── encryption.rs       # 8 unit tests
│       ├── kdf.rs              # 7 unit tests
│       ├── mnemonic.rs         # 6 unit tests
│       ├── hd_derivation.rs    # 5 unit tests
│       ├── address.rs          # 3 unit tests
│       ├── hash.rs             # 5 unit tests
│       ├── vrf.rs              # 9 unit tests
│       ├── hybrid_signing.rs   # 8 unit tests
│       ├── threshold.rs        # 8 unit tests
│       └── proof_batch.rs      # 6 unit tests
├── tests/
│   ├── crypto_edge_cases.rs    # 118 edge case tests
│   └── e2e_integration.rs      # 64 E2E integration tests
└── docs/
    ├── SECURITY_AUDIT.md       # Full security audit report
    ├── PENETRATION_TESTING.md  # Full penetration test report
    └── TEST_AUDIT.md           # This document
```

---

*This document is maintained alongside the codebase and updated with each testing phase.*

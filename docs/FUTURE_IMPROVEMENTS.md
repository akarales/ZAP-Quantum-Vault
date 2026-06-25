# ZAP Quantum Vault — Future Improvements Roadmap

**Status:** Living document
**Last updated:** 2026-06-25
**Companion docs:** `CONCEPTS_AND_ONBOARDING.md`, `audits/AUDIT_20260625_095105.md`,
`SECURITY_AUDIT.md`, `UPGRADE_RESEARCH.md`

This document captures prioritized, actionable improvements. Each item lists **why**, a
**sketch of how**, and **effort/impact**. Items are grouped by theme and tagged with a
priority (P0 = do next, P3 = nice-to-have).

---

## 1. Security hardening

### 1.1 (P1) Tighten secret-handling API surface
- **Why:** Findings F-1/F-2/F-3 in the latest audit — misleading `encrypted_secret_hex`
  name, public `secondary_secret` field, and non-`Zeroizing` local seed buffers.
- **How:**
  - Rename `KeyEntry::encrypted_secret_hex` → `secret_seed_hex` with a doc-comment on the
    in-memory vs at-rest distinction.
  - Make `HybridSigner.secondary_secret` private.
  - Wrap freshly derived seeds in `Zeroizing` immediately in `create_vault` /
    `restore_from_mnemonic`.
- **Effort:** S · **Impact:** Medium (defense-in-depth, maintainability).

### 1.2 (P2) Bind AAD into vault AEAD
- **Why:** Finding F-5 — AES-GCM records carry no context binding.
- **How:** Add a domain label as associated data per record type (`"verifier"`,
  `"master_seed"`, `"keystore"`, plus the KDF version). Update encrypt/decrypt signatures.
- **Effort:** S · **Impact:** Medium.

### 1.3 (P2) Persistent replay protection for air-gap envelopes
- **Why:** Finding F-4 — `SeenNonces` resets on restart.
- **How:** Persist consumed nonces (bounded, with TTL) to an owner-only file, or track a
  monotonic last-seen timestamp per signer public key. Consider shorter freshness windows
  for `signed_tx`.
- **Effort:** M · **Impact:** Medium.

### 1.4 (P2) Adaptive Argon2 profile by available RAM
- **Why:** Finding F-6 — 1 GiB may fail on constrained machines.
- **How:** Probe available memory at vault creation; choose the strongest profile that fits
  and persist it (versioned-params machinery already supports per-vault params).
- **Effort:** S–M · **Impact:** Usability + security.

### 1.5 (P2) Fuzz the untrusted parsers
- **Why:** The QR/envelope and mnemonic parsers ingest attacker-controlled input.
- **How:** Add `cargo-fuzz` targets for `parse_qr` / `verify_envelope` /
  `KeyPath::parse` / mnemonic validation. Wire a nightly fuzz job into CI.
- **Effort:** M · **Impact:** High (robustness).

### 1.6 (P3) Optional Shamir/SLIP-39 social recovery
- **Why:** Single 24-word phrase is a single point of failure for some users.
- **How:** Offer SLIP-39 (Shamir secret sharing) as an alternative backup, splitting the
  master seed into N-of-M shares.
- **Effort:** L · **Impact:** High for target users.

### 1.7 (P3) Memory-protection for live secrets
- **Why:** Reduce exposure to same-privilege memory scraping while unlocked.
- **How:** Investigate `mlock`/`VirtualLock` for secret pages, guard pages, and an
  idle-auto-lock timer that clears session state.
- **Effort:** M · **Impact:** Medium (best-effort against a hard threat).

---

## 2. Cryptography & standards

### 2.1 (P2) Register / finalize the SLIP-44 coin type
- **Why:** `ZAP_COIN_TYPE = 9999` is a placeholder; changing it later changes every
  address (`hd_derivation.rs:8-10`).
- **How:** Apply for an official SLIP-44 index; if adopted, gate behind a path-version so
  v1 vaults keep their addresses.
- **Effort:** S (code) + external process · **Impact:** Ecosystem correctness.

### 2.2 (P3) Hybrid KEM for encrypted-key transfer
- **Why:** ML-KEM-1024 exists in the crypto module; pairing it with X25519 (hybrid KEM)
  would mirror the hybrid-signing defense for the `encrypted_key` transfer type.
- **How:** Implement an X25519 + ML-KEM-1024 hybrid encapsulation; wire into the air-gap
  `EncryptedKey` path.
- **Effort:** M · **Impact:** Medium.

### 2.3 (P3) Signature context/domain separation per use
- **Why:** Distinguish a "transaction" signature from a "message" signature to prevent
  cross-protocol misuse.
- **How:** Prefix a domain tag into the signed message for each command (the air-gap path
  already does this; extend to `sign_message_*`).
- **Effort:** S · **Impact:** Medium.

---

## 3. Recovery & UX

### 3.1 (P1) Auto-restore the full keystore on mnemonic recovery
- **Why:** Today `restore_from_mnemonic` restores the master seed; the user must
  re-generate keys at the same paths manually.
- **How:** Persist a small, non-secret **derivation manifest** (key types + paths +
  labels) so recovery can deterministically regenerate the exact key set automatically.
  The manifest contains no secrets (paths/labels only) and can be exported.
- **Effort:** M · **Impact:** High (recovery correctness/UX).

### 3.2 (P2) Mnemonic verification step in backup gate
- **Why:** Confirm the user actually wrote down the phrase.
- **How:** After reveal, ask the user to re-enter 3–4 random word positions before
  enabling "continue".
- **Effort:** S · **Impact:** High (prevents lost funds).

### 3.3 (P2) Watch-only / public export
- **Why:** Let users verify addresses/keys on an online machine without exposing secrets.
- **How:** Export the public keys + addresses + paths (already redacted via
  `KeyEntryPublic`) as a signed file/QR.
- **Effort:** S · **Impact:** Medium.

### 3.4 (P3) Encrypted vault export/import (migration/backup of the whole vault)
- **Why:** Move a vault between machines without re-deriving.
- **How:** Export `vault.json` + `keys-*.enc` as a single integrity-protected bundle;
  import validates and installs atomically.
- **Effort:** M · **Impact:** Medium.

---

## 4. Testing & quality

### 4.1 (P1) Expand HD/hybrid/recovery integration coverage
- **Why:** Lock in the recovery and hybrid invariants end-to-end.
- **How:** (Started in this change-set) — add e2e tests for: mnemonic→restore→same keys,
  hybrid sign/verify round-trip via the hex DTO, duplicate-path rejection, KDF-param
  round-trip, and cross-message hybrid rejection.
- **Effort:** S–M · **Impact:** High.

### 4.2 (P2) Property-based tests
- **Why:** Catch edge cases the example-based tests miss.
- **How:** Add `proptest` for HD determinism/uniqueness, envelope round-trips, and
  encrypt/decrypt round-trips over random inputs.
- **Effort:** M · **Impact:** Medium.

### 4.3 (P2) Frontend tests
- **Why:** The React layer has no automated tests.
- **How:** Vitest + Testing Library for stores (`authStore`, `keyStore`) and the
  backup/restore flows; Playwright for the unlock→generate→sign happy path against a mock
  IPC.
- **Effort:** M · **Impact:** Medium.

### 4.4 (P3) Known-answer test vectors file
- **Why:** Pin exact byte outputs for HD derivation and hybrid signing to detect any
  accidental algorithm drift across dependency upgrades.
- **How:** Commit a `vectors/` JSON of (mnemonic, path) → (pubkey, address) and freeze it
  in CI.
- **Effort:** S · **Impact:** High (regression safety).

---

## 5. Build, supply chain & ops

### 5.1 (P2) Reproducible builds + release signing
- **Why:** Let users verify the binary matches the audited source.
- **How:** Pin the toolchain, document a reproducible build recipe, sign releases (and
  publish the hybrid signature of the artifact, dogfooding the vault).
- **Effort:** M · **Impact:** High (trust).

### 5.2 (P2) Frontend bundle code-splitting
- **Why:** Build warns the main JS chunk is > 500 kB.
- **How:** Route-level dynamic `import()` and `manualChunks` for heavy deps (framer-motion,
  icon set).
- **Effort:** S · **Impact:** Low–Medium (startup perf).

### 5.3 (P3) SBOM generation
- **Why:** Supply-chain transparency beyond `cargo-deny`.
- **How:** Generate a CycloneDX SBOM for both Rust and JS deps in CI; attach to releases.
- **Effort:** S · **Impact:** Medium.

---

## 6. "What else can we improve" — quick wins backlog

| Item | Priority | Effort |
|------|----------|--------|
| Idle auto-lock timer (clears session) | P1 | S |
| Per-key custom labels editable in UI | P2 | S |
| Export/print a clean recovery sheet (PDF) | P2 | S |
| Show Argon2 unlock time + profile in Settings | P3 | S |
| Dark/all-theme audit (contrast/a11y) | P3 | S |
| Localized error messages | P3 | M |
| Tamper-evident audit log of vault operations | P3 | M |

---

## 7. Suggested execution order (next two sprints)

**Sprint A (security + recovery correctness):**
1. 1.1 Secret-handling API hygiene (F-1/F-2/F-3)
2. 3.1 Derivation manifest → auto-restore keystore
3. 3.2 Mnemonic verification step
4. 4.1 HD/hybrid/recovery e2e tests (this change-set starts it)
5. 6 Idle auto-lock timer

**Sprint B (defense-in-depth + trust):**
1. 1.2 AEAD AAD binding
2. 1.4 Adaptive Argon2 profile
3. 1.5 Fuzz targets in CI
4. 5.1 Reproducible builds + release signing
5. 4.4 Known-answer vectors

---

*Keep this file updated as items land; move completed items to a "Done" section with the
commit/PR reference.*

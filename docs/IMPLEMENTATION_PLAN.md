# ZAP Quantum Vault — Implementation Plan

> **Version**: 1.0.0 | **Date**: 2026-06-23 | **Status**: Planning  
> **Repo**: [akarales/ZAP-Quantum-Vault](https://github.com/akarales/ZAP-Quantum-Vault)  
> **Blockchain**: [akarales/ZAP_BLOCKCHAIN](https://github.com/akarales/ZAP_BLOCKCHAIN)

## 1. Summary

Offline, air-gapped, quantum-safe key management for ZAP Blockchain. Tauri 2 + React 19 + Rust backend using ML-DSA-65 (FIPS 204) — same crypto as the blockchain.

### Fixes from old ZQV implementations
- XOR encryption → AES-256-GCM + Argon2id
- `pqcrypto-*` C wrappers → pure Rust `ml-dsa` crate
- Plaintext passwords → Tauri Stronghold
- Cosmos Ed25519 keys → native ML-DSA-65
- Broken decryption → deterministic KDF chain
- Mismatched addresses → BLAKE3 + `zap1` bech32 (matches blockchain)

## 2. Tech Stack

**Frontend**: React 19, TypeScript, Vite 6, TailwindCSS 4, shadcn/ui, Zustand, React Router 7, qrcode/qr-scanner

**Backend**: Tauri 2.x, `ml-dsa`, `ml-kem`, `blake3`, `aes-gcm`, `argon2`, `bip39`, `zeroize`, `rusqlite` (SQLCipher), `tauri-plugin-stronghold`, `serde`, `thiserror`, `tracing`

**Dev**: pnpm, Rust stable 1.85+, Vitest, cargo test, Playwright

## 3. Architecture

```
React Frontend (pages, components, hooks, store, api)
        ↕ Tauri IPC
Rust Backend
  commands/ — Tauri handlers
  crypto/ — ML-DSA-65, ML-KEM-1024, BLAKE3, AES-GCM, Argon2id, BIP-39
  vault/ — Stronghold + encrypted storage
  keys/ — Hierarchy + HD derivation
  airgap/ — QR, USB, offline signing
  storage/ — SQLite
  auth/ — Password + session
  blockchain/ — Genesis export + tx builder
  models/ — Data types
```

## 4. Project Structure

```
ZAP_QUANTUM_VAULT/
├── src/                    # React frontend
│   ├── pages/              # Dashboard, Keys, Sign, AirGap, Backup, Settings, Auth
│   ├── components/         # ui/, keys/, crypto/, airgap/, layout/, shared/
│   ├── hooks/              # useVault, useKeys, useAirGap, useAuth
│   ├── store/              # Zustand stores
│   ├── api/                # Tauri invoke wrappers
│   ├── lib/                # utils, constants
│   ├── types/              # TypeScript definitions
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   ├── commands/       # 7 command modules
│   │   ├── crypto/         # 8 crypto modules
│   │   ├── vault/          # 3 vault modules
│   │   ├── keys/           # 5 key modules
│   │   ├── airgap/         # 5 airgap modules
│   │   ├── storage/        # 3 storage modules
│   │   ├── auth/           # 2 auth modules
│   │   ├── blockchain/     # 3 blockchain modules
│   │   ├── models/         # 4 model modules
│   │   ├── lib.rs
│   │   └── error.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── docs/
├── package.json
└── vite.config.ts
```

## 5. Crypto Specs

### Blockchain-compatible operations (must match `ZAP_BLOCKCHAIN/src/crypto/`)
- **Address**: `BLAKE3("ZAP_address" || pk)[0..20]` → bech32 `zap1`
- **Tx hash**: `BLAKE3("ZAP_tx_hash" || tx_bytes)[0..32]`
- **Block hash**: `BLAKE3("ZAP_block_hash" || block_bytes)[0..32]`
- **Sign/Verify**: ML-DSA-65 (PK=1952B, SK seed=32B, Sig=3309B)

### Key encryption at rest
```
Password → Argon2id(64MB, 3 iter, 4 parallel) → Master Key
Master Key → HKDF-SHA256("vault_encryption") → AES-256-GCM key
```

### Mnemonic: BIP-39, 24 words, path `m/44'/9999'/<purpose>'/<account>/<index>`

## 6. Key Hierarchy

### Genesis (purpose 0)
- Master `0'/0/0` (L5), Validators `0'/0/<n>` (L4), Chain ID `0'/1/0` (L4)

### Validator (purpose 1)
- Consensus `1'/0/<n>` (L4), Operator `1'/1/<n>` (L3), Node ID `1'/2/<n>` (L3), Signing `1'/3/<n>` (L4)

### Governance (purpose 2)
- Proposal `2'/0/<n>` (L3), Voting `2'/1/<n>` (L3), Emergency `2'/2/<n>` SLH-DSA (L5), Upgrade `2'/3/<n>` (L4)

### Treasury (purpose 3)
- Master `3'/0/0` (L5), Fees `3'/1/0` (L3), Inflation `3'/2/0` (L3), Rewards `3'/3/0` (L3), Multi-Sig `3'/4/<n>` (L5), Backup `3'/5/0` SLH-DSA (L5)

### Security/Admin (purpose 4)
- Security Master `4'/0/0` (L5), Admin `4'/1/0` (L4), Rotation Auth `4'/2/0` (L4), Pause/Halt `4'/3/0` SLH-DSA (L5)

### User-Level (purpose 5)
- Account `5'/0/<n>` (L2), Staking `5'/1/<n>` (L3), Multi-Sig `5'/2/<n>` (L3), IBC `5'/3/<n>` (L3)

### ZAP Quantum-Safe (purpose 6)
- ZK Spending `6'/0/<n>` (L5), ZK Viewing `6'/1/<n>` (L3), Shielded Note `6'/2/<n>` ML-KEM (L5), Nullifier `6'/3/<n>` (L5)

### ZAP Custom (purpose 7)
- Quantum Migration `7'/0/0` (L5), Bridge `7'/1/<n>` (L4), Channel `7'/2/<n>` ML-KEM (L5), Threshold `7'/3/<n>` (L4), VRF `7'/4/<n>` (L3)

## 7. Air-Gap Protocol

**QR flow**: Online node creates unsigned tx → QR → Vault scans + signs → QR → Node broadcasts

**USB flow**: Detect drive → encrypted envelope + manifest → write → verify → wipe

**Envelope format**: JSON with version, type, encrypted payload, nonce, ML-DSA-65 signature, timestamp, BLAKE3 checksum

## 8. Implementation Phases

### Phase 1: Scaffolding (Days 1-2)
- Tauri 2 + React 19 + Vite 6 + Tailwind + shadcn/ui
- Rust module structure, Cargo.toml deps
- Base layout, routing, pnpm scripts

### Phase 2: Crypto Core (Days 3-5)
- `mldsa65.rs`, `mlkem1024.rs`, `address.rs`, `hash.rs` (match blockchain)
- `encryption.rs` (AES-GCM), `kdf.rs` (Argon2id+HKDF), `mnemonic.rs`, `hd_derivation.rs`
- Unit tests for all

### Phase 3: Vault & Storage (Days 6-8)
- SQLite schema + migrations, Stronghold integration
- Vault creation, password setup, encrypted key storage
- Auth (Argon2id + session), frontend login + setup wizard

### Phase 4: Key Management (Days 9-12)
- All key types + metadata, generation per hierarchy
- Key listing, detail views, export/import
- Frontend: key dashboard, generation wizards, key tree viewer

### Phase 5: Air-Gap Operations (Days 13-16)
- QR generation/chunking, QR scanning/reassembly
- USB detection, encrypted file transfer, integrity verification
- Offline transaction signing workflow
- Frontend: QR components, transfer wizard, signing UI

### Phase 6: Blockchain Integration (Days 17-19)
- Genesis config generation + export
- Network configs (mainnet/testnet/devnet)
- Transaction builder for offline signing
- Address derivation verification against blockchain

### Phase 7: Backup & Recovery (Days 20-22)
- Mnemonic backup/restore
- Encrypted vault export/import
- Key migration + rotation
- Frontend: backup wizard, recovery flow

### Phase 8: Polish & Security (Days 23-25)
- Security audit of crypto implementation
- UI/UX polish, dark mode
- Error handling + logging
- E2E tests with Playwright
- Documentation finalization

## 9. Success Criteria

- [ ] All crypto operations produce identical output to ZAP_BLOCKCHAIN
- [ ] Private keys never stored in plaintext
- [ ] Air-gapped signing works via QR and USB
- [ ] All 40+ key types from hierarchy implemented
- [ ] Mnemonic recovery restores all keys
- [ ] Genesis config export compatible with blockchain
- [ ] No network calls in vault application
- [ ] Unit test coverage >80% on crypto modules
- [ ] E2E tests for critical workflows

## 10. Key Dependencies (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["..."] }
tauri-plugin-stronghold = "2"
ml-dsa = "0.1"           # ML-DSA-65 (matches blockchain)
ml-kem = "0.3"            # ML-KEM-1024
blake3 = "1"
aes-gcm = "0.10"
argon2 = "0.5"
bip39 = "2"
zeroize = { version = "1", features = ["derive"] }
rusqlite = { version = "0.31", features = ["bundled-sqlcipher"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
anyhow = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
hex = "0.4"
base64 = "0.22"
chrono = "0.4"
uuid = { version = "1", features = ["v4"] }
```

## 11. References

- Blockchain crypto: `ZAP_BLOCKCHAIN/src/crypto/mldsa65.rs`, `address.rs`, `hash.rs`
- Blockchain wallet: `ZAP_BLOCKCHAIN/src/wallet/key_manager.rs`, `tx_signing.rs`
- Blockchain quantum: `ZAP_BLOCKCHAIN/src/quantum/kem.rs`, `hybrid_signing.rs`
- Old ZQV reference: `ARCHIVE/ZQV_old/ZAP_QUANTUM_VAULT_CLEAN_IMPLEMENTATION_PLAN.md`
- Key requirements: `ARCHIVE/ZQV_old/docs/ZAP_BLOCKCHAIN_FORK_KEY_REQUIREMENTS.md`
- Old ZQV quantum crypto: `ARCHIVE/ZQV_V1/src-tauri/src/quantum_crypto.rs`
- Old ZQV key types: `ARCHIVE/ZQV_V1/src-tauri/src/zap_blockchain_keys.rs`

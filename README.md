<div align="center">

```
███████╗ █████╗ ██████╗      ██████╗ ██╗   ██╗ █████╗ ███╗   ██╗████████╗██╗   ██╗███╗   ███╗
╚══███╔╝██╔══██╗██╔══██╗    ██╔═══██╗██║   ██║██╔══██╗████╗  ██║╚══██╔══╝██║   ██║████╗ ████║
  ███╔╝ ███████║██████╔╝    ██║   ██║██║   ██║███████║██╔██╗ ██║   ██║   ██║   ██║██╔████╔██║
 ███╔╝  ██╔══██║██╔═══╝     ██║▄▄ ██║██║   ██║██╔══██║██║╚██╗██║   ██║   ██║   ██║██║╚██╔╝██║
███████╗██║  ██║██║         ╚██████╔╝╚██████╔╝██║  ██║██║ ╚████║   ██║   ╚██████╔╝██║ ╚═╝ ██║
╚══════╝╚═╝  ╚═╝╚═╝          ╚══▀▀═╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝

                      ░▒▓▓  QUANTUM VAULT CORE ▓▓▒░
                                                        
```

<h3>Offline, Air-Gapped, Quantum-Safe Key Management for ZAP Blockchain</h3>

<p>
  <a href="https://github.com/akarales/ZAP-Quantum-Vault/actions/workflows/test.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/akarales/ZAP-Quantum-Vault/test.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=TESTS" alt="Test Status" />
  </a>
  <img src="https://img.shields.io/badge/Rust-1.85+-DEA584?style=for-the-badge&logo=rust&logoColor=white" alt="Rust Version" />
  <img src="https://img.shields.io/badge/Tauri-2.x-FFC131?style=for-the-badge&logo=tauri&logoColor=black" alt="Tauri Version" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Version" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite Version" />
</p>

<p>
  <img src="https://img.shields.io/badge/ML--DSA--87-✓-0052CC?style=for-the-badge&logo=nist&logoColor=white" alt="ML-DSA-87" />
  <img src="https://img.shields.io/badge/ML--KEM--1024-✓-0052CC?style=for-the-badge&logo=nist&logoColor=white" alt="ML-KEM-1024" />
  <img src="https://img.shields.io/badge/AES--256--GCM-✓-DD0031?style=for-the-badge&logo=aes&logoColor=white" alt="AES-256-GCM" />
  <img src="https://img.shields.io/badge/XChaCha20--Poly1305-✓-DD0031?style=for-the-badge&logoColor=white" alt="XChaCha20-Poly1305" />
  <img src="https://img.shields.io/badge/Argon2id-✓-FF6B6B?style=for-the-badge&logoColor=white" alt="Argon2id" />
  <img src="https://img.shields.io/badge/BLAKE3-✓-FFA500?style=for-the-badge&logoColor=white" alt="BLAKE3" />
</p>

<p>
  <img src="https://img.shields.io/badge/tests-74%20passing-22C55E?style=for-the-badge&logo=testinglibrary&logoColor=white" alt="Tests" />
  <img src="https://img.shields.io/badge/warnings-0-22C55E?style=for-the-badge" alt="Warnings" />
  <img src="https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-blue?style=for-the-badge&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/github/license/akarales/ZAP-Quantum-Vault?style=for-the-badge" alt="License" />
</p>

<p>
  <img src="https://img.shields.io/github/last-commit/akarales/ZAP-Quantum-Vault?style=flat-square&logo=git&logoColor=white" alt="Last Commit" />
  <img src="https://img.shields.io/github/repo-size/akarales/ZAP-Quantum-Vault?style=flat-square&logo=github&logoColor=white" alt="Repo Size" />
  <img src="https://img.shields.io/github/languages/code-size/akarales/ZAP-Quantum-Vault?style=flat-square&logoColor=white" alt="Code Size" />
  <img src="https://img.shields.io/github/languages/top/akarales/ZAP-Quantum-Vault?style=flat-square&logoColor=white" alt="Top Language" />
</p>

---

</div>

## 📖 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Cryptographic Stack](#-cryptographic-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Development](#-development)
- [Testing](#-testing)
- [Building](#-building)
- [Security Model](#-security-model)
- [Air-Gapped Workflow](#-air-gapped-workflow)
- [API Reference](#-api-reference)
- [Tech Stack](#-tech-stack)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**ZAP Quantum Vault** is a desktop application built with Tauri 2 that provides offline, air-gapped, quantum-safe key management for the [ZAP Blockchain](https://github.com/akarales/ZAP-Blockchain). It leverages NIST post-quantum cryptography standards (ML-DSA-87, ML-KEM-1024) to ensure key material remains secure against both classical and quantum attacks.

### Key Features

- 🔒 **Post-Quantum Signatures** — ML-DSA-87 (Dilithium) for digital signatures
- 🔐 **Post-Quantum Key Encapsulation** — ML-KEM-1024 (Kyber) for key exchange
- 🏛️ **Hybrid Signing** — ML-DSA-87 + BLAKE3-HMAC dual-signature scheme
- 🗳️ **Threshold Signatures** — Multi-party signature aggregation with configurable thresholds
- 🎲 **Verifiable Random Function** — BLAKE3-based VRF for deterministic randomness
- 📦 **Proof Batching** — Merkle tree aggregation for compact proof verification
- 🧠 **BIP39 Mnemonic** — 24-word seed phrase generation and recovery
- 🔑 **HD Key Derivation** — Hierarchical deterministic key paths (BIP32-style)
- 💎 **AES-256-GCM + XChaCha20-Poly1305** — Authenticated encryption for vault storage
- 🧂 **Argon2id KDF** — Memory-hard key derivation for master key
- 📱 **Air-Gapped QR Transfer** — Sign transactions via QR codes without network exposure
- 🏠 **Stronghold Integration** — IOTA Stronghold encrypted storage backend

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ZAP Quantum Vault                         │
├──────────────────────┬──────────────────────────────────────────┤
│   Frontend (React)   │            Backend (Rust)                │
│                      │                                          │
│  ┌────────────────┐  │  ┌────────────────────────────────────┐  │
│  │   Dashboard    │  │  │          Tauri IPC Layer           │  │
│  ├────────────────┤  │  ├────────────────────────────────────┤  │
│  │     Keys       │  │  │     Commands (tauri::command)      │  │
│  ├────────────────┤  │  │  ┌──────────┐ ┌──────────┐        │  │
│  │     Sign       │  │  │  │  vault   │ │  keys    │        │  │
│  ├────────────────┤  │  │  ├──────────┤ ├──────────┤        │  │
│  │   AirGap QR    │  │  │  │ signing  │ │ airgap   │        │  │
│  ├────────────────┤  │  │  └──────────┘ └──────────┘        │  │
│  │    Backup      │  │  └────────────────────────────────────┘  │
│  ├────────────────┤  │  ┌────────────────────────────────────┐  │
│  │    Settings    │  │  │          Crypto Modules             │  │
│  └────────────────┘  │  │  mldsa87 │ mlkem1024 │ encryption  │  │
│                      │  │  kdf     │ mnemonic  │ hd_derive   │  │
│  State: Zustand      │  │  vrf     │ hybrid    │ threshold   │  │
│  Styling: Tailwind   │  │  hash    │ address   │ proof_batch │  │
│  Icons: Lucide       │  └────────────────────────────────────┘  │
│                      │  ┌────────────────────────────────────┐  │
│                      │  │     Stronghold Plugin (Argon2id)    │  │
│                      │  └────────────────────────────────────┘  │
└──────────────────────┴──────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Air-Gapped QR   │
                    │    Transfer Flow  │
                    └───────────────────┘
```

---

## 🔐 Cryptographic Stack

| Algorithm | Type | Standard | Purpose |
|-----------|------|----------|---------|
| **ML-DSA-87** | Digital Signature | NIST FIPS 204 | Post-quantum signatures |
| **ML-KEM-1024** | Key Encapsulation | NIST FIPS 203 | Post-quantum key exchange |
| **BLAKE3** | Hash Function | NIST competition | Keyed hashing, VRF, Merkle trees |
| **AES-256-GCM** | AEAD Cipher | NIST SP 800-38D | Vault file encryption |
| **XChaCha20-Poly1305** | AEAD Cipher | RFC 8439 | Extended-nonce AEAD encryption |
| **Argon2id** | KDF | RFC 9106 | Master key derivation |
| **BIP39** | Mnemonic | BIP-39 spec | 24-word seed phrase recovery |
| **HD Derivation** | Key Derivation | BIP-32 style | Hierarchical key paths |

### Hybrid Signing Scheme

```
Message ──┬──► ML-DSA-87 Sign ──► Primary Signature
          │
          └──► BLAKE3 Keyed Hash ──► Secondary Signature (HMAC)

Verify: Both signatures must validate independently
```

### Threshold Signature Flow

```
Signer 1 ──► create_share(msg) ──┐
Signer 2 ──► create_share(msg) ──┤──► aggregate(shares, threshold) ──► ThresholdSignature
Signer N ──► create_share(msg) ──┘
```

---

## 📁 Project Structure

```
zap-quantum-vault/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/
│   │   └── layout/
│   │       └── Sidebar.tsx
│   ├── pages/
│   │   ├── AuthPage.tsx          # Vault unlock / create
│   │   ├── DashboardPage.tsx     # Overview & stats
│   │   ├── KeysPage.tsx          # Key management
│   │   ├── SignPage.tsx          # Transaction signing
│   │   ├── AirGapPage.tsx        # QR-based air-gap transfer
│   │   ├── BackupPage.tsx        # Mnemonic backup & recovery
│   │   └── SettingsPage.tsx      # App configuration
│   ├── store/
│   │   └── authStore.ts          # Zustand state management
│   ├── lib/
│   │   └── utils.ts              # Shared utilities
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/                    # Backend (Rust + Tauri 2)
│   ├── src/
│   │   ├── commands/             # Tauri IPC command handlers
│   │   │   ├── vault.rs          # create / unlock / lock
│   │   │   ├── keys.rs           # generate / list / detail
│   │   │   ├── signing.rs        # sign / verify message
│   │   │   └── airgap.rs         # QR generate / parse
│   │   ├── crypto/               # Cryptographic modules
│   │   │   ├── mldsa87.rs        # ML-DSA-87 signatures
│   │   │   ├── mlkem1024.rs      # ML-KEM-1024 key encapsulation
│   │   │   ├── encryption.rs     # AES-256-GCM + XChaCha20-Poly1305
│   │   │   ├── kdf.rs            # Argon2id key derivation
│   │   │   ├── mnemonic.rs       # BIP39 mnemonic generation
│   │   │   ├── hd_derivation.rs  # HD key path derivation
│   │   │   ├── hash.rs           # BLAKE3 transaction/block hashing
│   │   │   ├── address.rs        # ZAP address derivation
│   │   │   ├── vrf.rs            # Verifiable random function
│   │   │   ├── hybrid_signing.rs # ML-DSA-87 + BLAKE3 hybrid
│   │   │   ├── threshold.rs      # Threshold multi-sig
│   │   │   └── proof_batch.rs    # Merkle proof batching
│   │   ├── models/               # Data models
│   │   │   ├── vault.rs
│   │   │   ├── key.rs
│   │   │   ├── transaction.rs
│   │   │   └── airgap.rs
│   │   ├── error.rs              # VaultError enum + serde::Serialize
│   │   ├── lib.rs                # Tauri app builder + plugin setup
│   │   └── main.rs               # Entry point
│   ├── icons/                    # App icons (all platforms)
│   ├── Cargo.toml                # Rust dependencies
│   ├── build.rs                  # Tauri build script
│   └── tauri.conf.json           # Tauri configuration
├── docs/
│   ├── DEV_COMMANDS_REFERENCE.md # Developer command reference
│   └── IMPLEMENTATION_PLAN.md    # Project roadmap
├── package.json                  # Node.js dependencies (pnpm)
├── vite.config.ts                # Vite 6 configuration
├── tsconfig.json                 # TypeScript config
└── README.md                     # You are here
```

---

## ✅ Prerequisites

| Requirement | Version | Install |
|-------------|---------|---------|
| **Rust** | 1.85+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Node.js** | 22+ | [nodejs.org](https://nodejs.org) or `fnm install 22` |
| **pnpm** | 10+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| **Tauri CLI** | 2.x | `pnpm add -D @tauri-apps/cli` (included in devDeps) |
| **System libs** | — | See [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) |

<details>
<summary>📦 Linux system dependencies (Ubuntu/Debian)</summary>

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

</details>

<details>
<summary>🍎 macOS dependencies</summary>

```bash
xcode-select --install
# Tauri requires Xcode Command Line Tools
```

</details>

---

## 🚀 Installation

```bash
# Clone the repository
git clone git@github.com:akarales/ZAP-Quantum-Vault.git
cd ZAP-Quantum-Vault

# Install frontend dependencies
pnpm install

# Build Rust dependencies (first run takes ~2-3 minutes)
cd src-tauri && cargo build && cd ..
```

---

## 💻 Development

```bash
# Start Tauri dev server (launches both Vite + Rust backend)
pnpm tauri dev

# Frontend only (hot reload, no Tauri backend)
pnpm dev

# Type checking
pnpm exec tsc -b

# Lint
pnpm lint
```

The dev server starts at `http://localhost:1420` with the Tauri window opening automatically.

---

## 🧪 Testing

```bash
# Run all Rust unit tests (74 tests)
cd src-tauri && cargo test

# Run tests with output
cargo test -- --nocapture

# Run a specific module's tests
cargo test crypto::mldsa87
cargo test crypto::hybrid_signing
cargo test crypto::threshold

# Frontend tests (when available)
pnpm test
```

<details>
<summary>📊 Test coverage by module</summary>

| Module | Tests | Status |
|--------|-------|--------|
| `crypto::mldsa87` | 8 | ✅ |
| `crypto::mlkem1024` | 5 | ✅ |
| `crypto::encryption` | 7 | ✅ |
| `crypto::kdf` | 7 | ✅ |
| `crypto::mnemonic` | 6 | ✅ |
| `crypto::hd_derivation` | 5 | ✅ |
| `crypto::hash` | 5 | ✅ |
| `crypto::address` | 3 | ✅ |
| `crypto::vrf` | 8 | ✅ |
| `crypto::hybrid_signing` | 7 | ✅ |
| `crypto::threshold` | 7 | ✅ |
| `crypto::proof_batch` | 6 | ✅ |
| **Total** | **74** | **✅ All passing** |

</details>

---

## 📦 Building

```bash
# Build production binary (frontend + Rust)
pnpm tauri build

# Build for specific target
pnpm tauri build --target x86_64-unknown-linux-gnu

# Output location: src-tauri/target/release/bundle/
```

Build artifacts are generated in `src-tauri/target/release/bundle/` with platform-specific installers:

| Platform | Output |
|----------|--------|
| Linux | `.deb`, `.AppImage`, `.rpm` |
| macOS | `.dmg`, `.app` |
| Windows | `.msi`, `.exe` (NSIS) |

---

## 🛡️ Security Model

### Vault Lifecycle

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐
│  Create  │────►│  Unlock  │────►│  Use    │────►│   Lock   │
│ (Argon2id│     │ (derive  │     │ (sign,  │     │ (zeroize │
│  + BIP39)│     │  master  │     │  encrypt,│    │  keys)   │
└─────────┘     │  key)    │     │  decrypt)│    └──────────┘
                └──────────┘     └─────────┘          │
                       ▲                              │
                       └──────────────────────────────┘
                            Re-unlock when needed
```

### Threat Model

| Threat | Mitigation |
|--------|------------|
| **Quantum computer attack** | ML-DSA-87 + ML-KEM-1024 (NIST PQC) |
| **Key extraction from memory** | Keys zeroized on lock; Argon2id memory-hard KDF |
| **Offline brute force** | Argon2id with 64MB memory cost, 3 iterations |
| **Network exfiltration** | Air-gapped QR transfer — no network interface used |
| **Tampered transactions** | Hybrid ML-DSA-87 + BLAKE3-HMAC verification |
| **Single signer compromise** | Threshold signatures require N-of-M shares |
| **Proof forgery** | Merkle tree batch verification with BLAKE3 root |

### Air-Gapped Workflow

```
┌─────────────────┐          QR Code           ┌─────────────────┐
│   Online Machine │ ──────► (unsigned tx) ────► │  Vault Machine  │
│   (ZAP Node)     │                             │  (Air-Gapped)   │
│                  │ ◄────── (signed tx) ───────  │                 │
└─────────────────┘          QR Code           └─────────────────┘
                                                      │
                                         No network connection
                                         No USB drives
                                         QR codes only
```

---

## 🔌 API Reference

### Tauri IPC Commands

<details>
<summary>🔐 Vault Commands</summary>

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `create_vault` | `password: String`, `mnemonic: Option<String>` | `String` (vault ID) | Initialize new vault with Argon2id + BIP39 |
| `unlock_vault` | `password: String` | `bool` (success) | Derive master key, decrypt vault contents |
| `lock_vault` | — | `bool` (success) | Zeroize all keys and secrets from memory |

</details>

<details>
<summary>🔑 Key Commands</summary>

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `generate_key` | `key_type: String`, `derivation_path: Option<String>` | `KeyInfo` | Generate ML-DSA-87 keypair with optional HD path |
| `list_keys` | — | `Vec<KeyInfo>` | List all stored keys with metadata |
| `get_key_detail` | `key_id: String` | `KeyInfo` | Get detailed info for a specific key |

</details>

<details>
<summary>✍️ Signing Commands</summary>

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `sign_message` | `key_id: String`, `message: String` | `String` (hex signature) | Sign a message with ML-DSA-87 |
| `verify_message` | `public_key_hex: String`, `message: String`, `signature_hex: String` | `bool` | Verify a ML-DSA-87 signature |

</details>

<details>
<summary>📱 Air-Gap Commands</summary>

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `generate_qr` | `QrRequest` | `String` (base64 PNG) | Generate QR code for unsigned transaction |
| `parse_qr` | `qr_data: String` | `QrResponse` | Parse QR response with signed transaction |

</details>

---

## 🛠️ Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| [React](https://react.dev) | 19 | UI framework |
| [Vite](https://vitejs.dev) | 6 | Build tool & dev server |
| [TypeScript](https://typescriptlang.org) | 5.7+ | Type safety |
| [TailwindCSS](https://tailwindcss.com) | 4 | Utility-first styling |
| [Zustand](https://github.com/pmndrs/zustand) | 5 | State management |
| [React Router](https://reactrouter.com) | 7 | Client-side routing |
| [Lucide](https://lucide.dev) | 0.460+ | Icon library |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| [Rust](https://rust-lang.org) | 1.85+ | Systems programming |
| [Tauri](https://tauri.app) | 2 | Desktop app framework |
| [ml-dsa](https://crates.io/crates/ml-dsa) | 0.1 | ML-DSA-87 signatures |
| [ml-kem](https://crates.io/crates/ml-kem) | 0.3 | ML-KEM-1024 key encapsulation |
| [chacha20poly1305](https://crates.io/crates/chacha20poly1305) | 0.10 | XChaCha20-Poly1305 AEAD |
| [aes-gcm](https://crates.io/crates/aes-gcm) | 0.10 | AES-256-GCM AEAD |
| [blake3](https://crates.io/crates/blake3) | 1 | Hash function |
| [argon2](https://crates.io/crates/argon2) | 0.5 | Memory-hard KDF |
| [bip39](https://crates.io/crates/bip39) | 2 | Mnemonic seed phrases |
| [zeroize](https://crates.io/crates/zeroize) | 1 | Secure memory erasure |
| [thiserror](https://crates.io/crates/thiserror) | 2 | Ergonomic error types |
| [Stronghold](https://crates.io/crates/tauri-plugin-stronghold) | 2 | Encrypted storage engine |

---

## 🤝 Contributing

```bash
# 1. Fork & clone
git clone git@github.com:<your-username>/ZAP-Quantum-Vault.git

# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make changes & run tests
cd src-tauri && cargo test
cd .. && pnpm exec tsc -b

# 4. Commit with conventional messages
git add -A
git commit -m "feat: add new crypto module for XYZ"

# 5. Push & open PR
git push -u origin feature/your-feature-name
```

### Commit Message Convention

| Type | Description |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `crypto:` | Cryptographic module changes |
| `refactor:` | Code restructuring |
| `test:` | Test additions or changes |
| `docs:` | Documentation updates |
| `chore:` | Build/tooling changes |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

```
███████╗ █████╗ ██████╗      ██████╗ ██╗   ██╗ █████╗ ███╗   ██╗████████╗██╗   ██╗███╗   ███╗
╚══███╔╝██╔══██╗██╔══██╗    ██╔═══██╗██║   ██║██╔══██╗████╗  ██║╚══██╔══╝██║   ██║████╗ ████║
  ███╔╝ ███████║██████╔╝    ██║   ██║██║   ██║███████║██╔██╗ ██║   ██║   ██║   ██║██╔████╔██║
 ███╔╝  ██╔══██║██╔═══╝     ██║▄▄ ██║██║   ██║██╔══██║██║╚██╗██║   ██║   ██║   ██║██║╚██╔╝██║
███████╗██║  ██║██║         ╚██████╔╝╚██████╔╝██║  ██║██║ ╚████║   ██║   ╚██████╔╝██║ ╚═╝ ██║
╚══════╝╚═╝  ╚═╝╚═╝          ╚══▀▀═╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝

                      ░▒▓▓  QUANTUM VAULT CORE  ▓▓▒░
```

**Built with Rust, secured by post-quantum cryptography.**

[Report Bug](https://github.com/akarales/ZAP-Quantum-Vault/issues) · [Request Feature](https://github.com/akarales/ZAP-Quantum-Vault/issues) · [ZAP Blockchain](https://github.com/akarales/ZAP-Blockchain)

</div>

<div align="center">

# 🔐 ZAP Quantum Vault

### Enterprise-Grade Quantum-Safe Cryptographic Key Management

**Developed by [Zap AGI Inc.](https://zapagi.com/)**

[![Quantum-Safe](https://img.shields.io/badge/Quantum-Safe-blue.svg)](https://zapagi.com/)
[![NIST PQC](https://img.shields.io/badge/NIST-PQC%20Compliant-green.svg)](https://csrc.nist.gov/projects/post-quantum-cryptography)
[![Rust](https://img.shields.io/badge/Built%20with-Rust-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Powered%20by-Tauri-blue.svg)](https://tauri.app/)

*Secure your digital assets with military-grade post-quantum cryptography*

</div>

---

## 🌟 Overview

ZAP Quantum Vault is a next-generation cryptographic key management system that combines cutting-edge post-quantum cryptography with intuitive user experience. Built for the quantum computing era, it provides unparalleled security for Bitcoin keys, sensitive data, and cryptographic assets.

### 🎯 Key Differentiators

- **🔮 Quantum-Enhanced Entropy**: Triple-source entropy generation using Kyber-1024, Dilithium5, and system RNG
- **🛡️ Post-Quantum Security**: NIST-compliant algorithms future-proof against quantum computers
- **₿ Bitcoin Integration**: Native support for all Bitcoin address types with quantum-safe key generation
- **💾 Air-Gapped Storage**: Secure USB cold storage with quantum-safe encryption
- **🎨 Modern Interface**: Professional shadcn/ui components with dark theme support

---

## ✨ Features

### 🔐 **Quantum-Safe Cryptography**
- **Kyber-1024**: NIST-standardized key encapsulation mechanism
- **Dilithium5**: Post-quantum digital signatures
- **SPHINCS+**: Backup signature scheme for enhanced security
- **Blake3 + Argon2id**: Advanced key derivation and hashing

### ₿ **Bitcoin Key Management**
- **Multi-Format Support**: Legacy (P2PKH), SegWit (P2SH-P2WPKH), Native SegWit (P2WPKH), Taproot (P2TR)
- **HD Wallet Support**: BIP32/BIP44 hierarchical deterministic wallets
- **Receiving Addresses**: Generate unlimited receiving addresses for enhanced privacy
- **Quantum Enhancement**: All Bitcoin keys use quantum-enhanced entropy by default

### 🔷 **Ethereum Key Management**
- **Native Ethereum Support**: Full secp256k1 key generation and management
- **Account-Based Model**: Single address per key for all Ethereum transactions
- **Network Support**: Mainnet, Testnets (Goerli, Sepolia), and custom networks
- **Quantum-Enhanced Entropy**: Post-quantum entropy sources for maximum security
- **Private Key Export**: Secure backup with proper hex formatting
- **Public Key Derivation**: Cryptographically derived from private keys

### 🏦 **Vault Management**
- **Multi-Vault Architecture**: Organize keys by purpose, network, or security level
- **Role-Based Access**: Granular permissions and access control
- **Audit Logging**: Comprehensive security event tracking
- **Backup & Recovery**: Encrypted backup with quantum-safe verification

### 💾 **Cold Storage Integration**
- **USB Drive Support**: Secure air-gapped storage on removable media
- **Multi-Asset Backup**: Bitcoin and Ethereum keys with full metadata
- **Decrypted Key Export**: Private keys exported in proper hex format for recovery
- **Quantum-Safe Headers**: Post-quantum encrypted backup manifests
- **Integrity Verification**: Cryptographic backup validation
- **Cross-Platform Recovery**: Restore keys across different systems
- **Structured Backup Format**: Organized JSON files for easy key management

### 🎨 **User Experience**
- **Modern UI**: Built with React, TypeScript, and shadcn/ui components
- **Dark Theme**: Professional dark mode with quantum-inspired design
- **Responsive Design**: Optimized for desktop and mobile interfaces
- **Real-Time Updates**: Live status indicators and progress tracking

---

## 🏗️ Architecture

### **Frontend Stack**
- **React 18**: Modern component-based UI framework
- **TypeScript**: Type-safe development with enhanced IDE support
- **Tailwind CSS**: Utility-first styling with custom quantum theme
- **shadcn/ui**: Professional component library with accessibility
- **Vite**: Lightning-fast development and build tooling

### **Backend Stack**
- **Rust**: Memory-safe systems programming with zero-cost abstractions
- **Tauri**: Secure desktop application framework with minimal footprint
- **SQLx**: Compile-time checked SQL queries with SQLite
- **Post-Quantum Cryptography**: pqcrypto crate ecosystem

### **Security Architecture**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │───▶│   Tauri Bridge   │───▶│  Rust Backend   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                       ┌──────────────────┐             │
                       │ Quantum Crypto   │◀────────────┘
                       │ • Kyber-1024     │
                       │ • Dilithium5     │
                       │ • SPHINCS+       │
                       └──────────────────┘
                                │
                       ┌──────────────────┐
                       │ SQLite Database  │
                       │ • Encrypted Keys │
                       │ • Audit Logs     │
                       │ • Vault Metadata │
                       └──────────────────┘
```

---

## 🚀 Setup & Installation

### 📋 Prerequisites

Before starting, ensure you have the following installed:

| Requirement | Version | Installation |
|-------------|---------|--------------|
| **Node.js** | v18.0.0+ | [Download](https://nodejs.org/) or `nvm install 18` |
| **Rust** | Latest Stable | [Install](https://rustup.rs/) or `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **pnpm** | Latest | [Install](https://pnpm.io/installation) or `npm install -g pnpm` |
| **Git** | Latest | [Download](https://git-scm.com/) |

### 🔧 System Requirements

- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space for development
- **Architecture**: x64 or ARM64

### ⚡ Quick Installation

```bash
# 1. Clone the repository
git clone https://github.com/akarales/ZAP-Quantum-Vault.git
cd ZAP-Quantum-Vault

# 2. Install Rust dependencies and tools
rustup update
rustup target add wasm32-unknown-unknown

# 3. Install Node.js dependencies
pnpm install

# 4. Verify installation
pnpm tauri info
```

### 🏃‍♂️ Running the Application

#### **Development Mode** (Hot Reload)
```bash
# Start development server with hot reload
pnpm tauri dev

# Alternative: Run frontend and backend separately
pnpm dev          # Frontend only (React dev server)
cargo tauri dev   # Full application with Rust backend
```

#### **Production Build**
```bash
# Build optimized application
pnpm tauri build

# Platform-specific builds
pnpm tauri build --target x86_64-pc-windows-msvc    # Windows
pnpm tauri build --target x86_64-apple-darwin       # macOS Intel
pnpm tauri build --target aarch64-apple-darwin      # macOS Apple Silicon
pnpm tauri build --target x86_64-unknown-linux-gnu  # Linux

# Built applications will be in:
# - Windows: src-tauri/target/release/zap-vault.exe
# - macOS: src-tauri/target/release/bundle/macos/ZAP Quantum Vault.app
# - Linux: src-tauri/target/release/zap-vault
```

### 🛠️ Development Commands

#### **Frontend Development**
```bash
# Start React development server (port 1420)
pnpm dev

# Build frontend for production
pnpm build

# Preview production build
pnpm preview

# Type checking
pnpm type-check

# Linting and formatting
pnpm lint
pnpm format
```

#### **Backend Development**
```bash
# Run Rust tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Check code quality
cargo clippy

# Format Rust code
cargo fmt

# Check for security vulnerabilities
cargo audit
```

#### **Database Operations**
```bash
# Initialize database (automatic on first run)
cargo run --bin seed

# Reset database (development only)
rm -f src-tauri/vault.db
cargo run --bin seed
```

### 🚀 First Run Setup

1. **Launch Application**
   ```bash
   pnpm tauri dev
   ```

2. **Create Master Account**
   - Set a strong master password (12+ characters)
   - Password is hashed with Argon2id for security
   - This password encrypts all your vault data

3. **Create Your First Vault**
   - Click "Create New Vault"
   - Choose a descriptive name (e.g., "Personal Bitcoin Keys")
   - Vaults help organize keys by purpose

4. **Generate Bitcoin Keys**
   - Navigate to "Key Management"
   - Click "Generate New Bitcoin Key"
   - Select network (mainnet/testnet) and key type
   - All keys use quantum-enhanced entropy automatically

### 📱 Application Structure

```bash
# After first run, your directory structure:
zap_vault/
├── src-tauri/
│   ├── vault.db              # SQLite database (encrypted)
│   ├── target/release/       # Built application
│   └── logs/                 # Application logs
├── node_modules/             # Node.js dependencies
└── dist/                     # Built frontend assets
```

### 🔍 Verification Commands

```bash
# Check if everything is working
pnpm tauri info               # System information
cargo --version               # Rust version
node --version                # Node.js version
pnpm --version                # pnpm version

# Test quantum cryptography
cargo test quantum_crypto     # Run quantum crypto tests
cargo test bitcoin_keys      # Run Bitcoin key tests

# Check database
sqlite3 src-tauri/vault.db ".tables"  # List database tables
```

### 🐛 Troubleshooting

#### **Common Issues & Solutions**

**Issue: `pnpm tauri dev` fails with "Rust not found"**
```bash
# Solution: Install Rust and add to PATH
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

**Issue: "Permission denied" on Linux/macOS**
```bash
# Solution: Fix permissions
chmod +x ~/.cargo/bin/*
sudo chown -R $USER ~/.cargo
```

**Issue: Build fails with "missing dependencies"**
```bash
# Solution: Install system dependencies
# Ubuntu/Debian:
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# macOS:
xcode-select --install

# Windows: Install Visual Studio Build Tools
```

**Issue: Database locked error**
```bash
# Solution: Close all instances and reset
pkill -f zap-vault
rm -f src-tauri/vault.db-wal src-tauri/vault.db-shm
```

**Issue: Port 1420 already in use**
```bash
# Solution: Kill process or use different port
lsof -ti:1420 | xargs kill -9
# Or set custom port:
TAURI_DEV_PORT=1421 pnpm tauri dev
```

#### **Performance Optimization**

```bash
# Enable release mode for faster crypto operations
cargo tauri dev --release

# Increase Node.js memory limit for large builds
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm tauri build

# Use faster linker (Linux/macOS)
export RUSTFLAGS="-C link-arg=-fuse-ld=lld"
```

#### **Development Tips**

```bash
# Watch mode for Rust changes
cargo watch -x "test quantum_crypto"

# Debug mode with verbose logging
RUST_LOG=debug pnpm tauri dev

# Profile build performance
cargo tauri build --verbose

# Clean build artifacts
cargo clean && pnpm clean
rm -rf node_modules && pnpm install
```

---

## 📁 Project Structure

```
zap_vault/
├── 📁 src/                          # React Frontend
│   ├── 📁 components/               # Reusable UI components
│   │   ├── 📁 ui/                   # shadcn/ui components
│   │   ├── 📁 layout/               # Layout components
│   │   └── 📁 password/             # Password utilities
│   ├── 📁 pages/                    # Application pages
│   │   ├── AuthPage.tsx             # Authentication
│   │   ├── BitcoinKeysPage.tsx      # Bitcoin key management
│   │   ├── BitcoinKeyDetailsPage.tsx # Key details & addresses
│   │   ├── EthereumKeysPage.tsx     # Ethereum key management
│   │   ├── EthereumKeyDetailsPage.tsx # Ethereum key details
│   │   └── VaultDetailsPage.tsx     # Vault management
│   ├── 📁 router/                   # React Router configuration
│   ├── 📁 themes/                   # Theme configurations
│   └── 📁 lib/                      # Utility functions
├── 📁 src-tauri/                    # Rust Backend
│   ├── 📁 src/
│   │   ├── quantum_crypto.rs        # Post-quantum cryptography
│   │   ├── bitcoin_keys.rs          # Bitcoin key generation
│   │   ├── bitcoin_commands.rs      # Bitcoin operations
│   │   ├── ethereum_keys.rs         # Ethereum key generation
│   │   ├── ethereum_commands.rs     # Ethereum operations
│   │   ├── cold_storage.rs          # USB backup system
│   │   ├── database.rs              # SQLite operations
│   │   └── lib.rs                   # Tauri commands
│   └── Cargo.toml                   # Rust dependencies
└── 📄 README.md                     # This documentation
```

---

## 🔒 Security Features

### **Post-Quantum Cryptography**
- **NIST-Compliant Algorithms**: Kyber-1024, Dilithium5, SPHINCS+
- **Quantum-Safe Key Derivation**: Enhanced entropy generation with multiple sources
- **Future-Proof Design**: Resistant to both classical and quantum computer attacks
- **Cryptographic Agility**: Easy algorithm upgrades as standards evolve

### **Bitcoin Security**
- **Quantum-Enhanced Entropy**: All Bitcoin keys use post-quantum entropy sources
- **Multi-Format Support**: Legacy, SegWit, Native SegWit, and Taproot addresses
- **HD Wallet Integration**: BIP32/BIP44 compliant hierarchical deterministic wallets
- **Secure Key Storage**: AES-256-GCM encryption with Argon2id key derivation

### **Ethereum Security**
- **secp256k1 Implementation**: Native elliptic curve cryptography with quantum-enhanced entropy
- **Account-Based Model**: Single address per key with comprehensive metadata tracking
- **Network Flexibility**: Support for mainnet, testnets, and custom Ethereum networks
- **Private Key Protection**: ChaCha20Poly1305 encryption with secure key derivation
- **Public Key Derivation**: Cryptographically derived from private keys using secp256k1
- **Backup Integration**: Full key export with proper hex formatting for recovery

### **Data Protection**
- **Encryption at Rest**: All sensitive data encrypted in SQLite database
- **Memory Safety**: Rust's ownership model prevents buffer overflows and memory leaks
- **Secure Communication**: Tauri's secure IPC between frontend and backend
- **Audit Logging**: Comprehensive security event tracking and monitoring

---

## 🚀 Getting Started

### **First Launch**
1. **Create Account**: Set up your master password with Argon2 hashing
2. **Create Vault**: Organize your keys by purpose or security level
3. **Generate Keys**: Create quantum-enhanced Bitcoin keys with one click
4. **Backup Setup**: Configure USB cold storage for air-gapped backups

### **Key Management Workflow**
```bash
# 1. Generate cryptocurrency keys
Bitcoin: Click "Generate New Bitcoin Key" → Select network → Enter password
Ethereum: Click "Generate New Ethereum Key" → Select network → Enter password

# 2. View key details
Bitcoin: Click on key → View addresses → Generate receiving addresses
Ethereum: Click on key → View address → Export private key

# 3. Cold storage backup
Insert USB drive → Select keys → Create encrypted backup
Backup includes: Bitcoin keys, Ethereum keys, metadata, recovery info

# 4. Recovery
Insert backup USB → Verify integrity → Restore selected keys
Supports: Cross-platform recovery, individual key restoration
```

---

## 📊 Technical Specifications

### **Cryptographic Parameters**
| Component | Algorithm | Key Size | Security Level |
|-----------|-----------|----------|----------------|
| Key Encapsulation | Kyber-1024 | 1,568 bytes (PK) | NIST Level 5 |
| Digital Signatures | Dilithium5 | 2,592 bytes (PK) | NIST Level 5 |
| Backup Signatures | SPHINCS+ | Variable | NIST Level 5 |
| Symmetric Encryption | AES-256-GCM | 256 bits | 128-bit security |
| Key Derivation | Argon2id | 256 bits | Memory-hard |
| Hash Function | Blake3 | 256 bits | Cryptographic |

### **Performance Metrics**
- **Key Generation**: ~5-10ms per Bitcoin key (including quantum enhancement)
- **Encryption**: ~1-2ms per operation (AES-256-GCM)
- **Database Operations**: <1ms for most queries (SQLite with indexing)
- **Memory Usage**: ~50-100MB typical operation
- **Storage**: ~1KB per Bitcoin key (encrypted)

---

## 🛠️ Development

### **Development Commands**
```bash
# Start development server with hot reload
pnpm tauri dev

# Run frontend only (for UI development)
pnpm dev

# Run Rust tests
cargo test

# Check Rust code quality
cargo clippy

# Format code
cargo fmt && pnpm format
```

### **Build Configurations**
```bash
# Debug build (development)
cargo tauri build --debug

# Release build (production)
cargo tauri build

# Platform-specific builds
cargo tauri build --target x86_64-pc-windows-msvc  # Windows
cargo tauri build --target x86_64-apple-darwin     # macOS Intel
cargo tauri build --target aarch64-apple-darwin    # macOS Apple Silicon
cargo tauri build --target x86_64-unknown-linux-gnu # Linux
```

---

## 📚 Documentation

All technical documentation is integrated into this README. For additional support:

- **GitHub Issues**: Report bugs and request features
- **Code Comments**: Inline documentation in source files
- **Type Definitions**: TypeScript interfaces for API reference

---

## 🤝 Contributing

We welcome contributions to ZAP Quantum Vault! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### **Development Setup**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure all tests pass: `cargo test && pnpm test`
5. Submit a pull request

---

## 📄 License

**MIT License**

Copyright (c) 2025 **Alexandros Karales**

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

See the [LICENSE](LICENSE) file for complete details.

---

## 🏢 About Zap AGI Inc.

**Zap AGI Inc.** is a leading technology company specializing in quantum-safe cryptography and artificial intelligence solutions. We build enterprise-grade security tools for the post-quantum era.

- **Website**: [zapagi.com](https://zapagi.com/)
- **Contact**: [security@zapagi.com](mailto:security@zapagi.com)
- **Support**: [support@zapagi.com](mailto:support@zapagi.com)

---

## 🔗 Links

- **GitHub Repository**: [ZAP-Quantum-Vault](https://github.com/akarales/ZAP-Quantum-Vault)
- **Issue Tracker**: [Report Issues](https://github.com/akarales/ZAP-Quantum-Vault/issues)
- **Security Policy**: [Security.md](SECURITY.md)
- **Changelog**: [Releases](https://github.com/akarales/ZAP-Quantum-Vault/releases)

---

<div align="center">

**Built with ❤️ by the Zap AGI Inc. team**

*Securing the future, today.*

</div>

## License

Private Repository - All Rights Reserved

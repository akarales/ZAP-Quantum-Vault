# ZAP Quantum Vault

A secure cryptographic key management system built with Tauri, React, and Rust. ZAP Quantum Vault provides quantum-safe encryption and secure storage for sensitive cryptographic keys and data.

## Features

- **Secure User Authentication**: Argon2 password hashing with salt
- **File-based SQLite Database**: Persistent data storage
- **Modern UI**: React + TypeScript frontend with Tailwind CSS
- **Rust Backend**: High-performance Tauri commands for security operations
- **Quantum-Safe Ready**: Architecture prepared for quantum-safe cryptography integration

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Rust, Tauri, SQLx
- **Database**: SQLite
- **Cryptography**: Argon2, Blake3, UUID

## Development Setup

### Prerequisites

- Node.js (v18+)
- Rust (latest stable)
- pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/akarales/ZAP-Quantum-Vault.git
cd ZAP-Quantum-Vault

# Install dependencies
pnpm install

# Run in development mode
cargo tauri dev
```

### Build for Production

```bash
# Build the application
cargo tauri build
```

## Project Structure

```text
zap_vault/
├── src/                    # React frontend
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands.rs    # Tauri commands
│   │   ├── database.rs    # Database initialization
│   │   ├── crypto.rs      # Cryptographic functions
│   │   └── models.rs      # Data models
│   └── vault.db          # SQLite database
├── .taurignore           # Files ignored by Tauri watcher
└── .env                  # Environment variables
```

## Security Features

- **Password Hashing**: Argon2 with unique salts
- **Database Encryption**: SQLite with secure file storage
- **Input Validation**: Frontend and backend validation
- **Session Management**: Secure token-based authentication

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

Private Repository - All Rights Reserved

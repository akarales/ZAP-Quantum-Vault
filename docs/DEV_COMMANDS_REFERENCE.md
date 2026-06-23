# ZAP Quantum Vault — Dev Commands Reference

> **Date**: 2026-06-23 | **Author**: Alexandros Karales
> **Project**: Tauri 2 + React 19 + Vite 6 + TypeScript + pnpm

## 1. pnpm Command Syntax (CRITICAL)

### Package Manager: pnpm v10.30+

| Command | Correct Syntax | Wrong (DO NOT USE) |
|---------|---------------|---------------------|
| Install deps | `pnpm install` | ~~`npm install`~~ |
| Add dep | `pnpm add <pkg>` | ~~`npm install <pkg>`~~ |
| Add dev dep | `pnpm add -D <pkg>` | ~~`npm install -D <pkg>`~~ |
| Run script | `pnpm run <script>` | ~~`npm run <script>`~~ |
| Run script (shorthand) | `pnpm <script>` | ~~`npx <script>`~~ |
| Execute local bin | `pnpm exec <cmd>` | ~~`npx <cmd>`~~ |
| Run one-off package | `pnpm dlx <pkg>` | ~~`npx <pkg>`~~ |
| Create project | `pnpm create <pkg>` | ~~`npm create <pkg>`~~ |

### Key Differences from npm

- **`pnpm run <script>`** — runs a script defined in `package.json` `"scripts"` section
- **`pnpm exec <cmd>`** — executes a binary from local `node_modules/.bin/` (replaces `npx` for local deps)
- **`pnpm dlx <pkg>`** — downloads and runs a package without installing (replaces `npx <pkg>` for one-off)
- **`npx tsc`** is WRONG — it resolves to a deprecated `tsc` npm package, NOT TypeScript's compiler. Use `pnpm exec tsc` or `pnpm run build` instead.

### Short Aliases (pnpm v11+)

```bash
pn install        # pnpm install
pn add express    # pnpm add express
pn build          # pnpm run build
pnx create-vue    # pnpm dlx create-vue
```

### --dir flag (when CWD is wrong)

```bash
pnpm install --dir /home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT
pnpm run build --dir /home/anubix/Documents/CODE/ZAP_QUANTUM_VAULT
```

## 2. TypeScript Compilation

### Correct Commands

```bash
# Type-check only (no output files)
pnpm exec tsc --noEmit

# Build with project references
pnpm exec tsc -b

# Watch mode
pnpm exec tsc -b --watch

# Via package.json script (preferred)
pnpm run build    # runs: tsc -b && vite build
```

### package.json scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "lint": "eslint .",
    "test": "vitest"
  }
}
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `This is not the tsc command you are looking for` | `npx tsc` resolved to deprecated `tsc@2.0.4` package | Use `pnpm exec tsc` instead |
| `ERR_PNPM_NO_PKG_MANIFEST` | pnpm CWD is wrong (e.g., in reference folder) | Use `--dir /path/to/project` or `cd` first |
| `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND` | No `package.json` in CWD | Check `pwd`, ensure you're in project root |
| `ERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE` | `pnpm exec` in a workspace with no packages | Use `--dir` or ensure `package.json` exists |

## 3. Vite 6 Commands

```bash
# Dev server (hot reload, port 1420 for Tauri)
pnpm run dev

# Production build (outputs to dist/)
pnpm run build

# Preview production build
pnpm run preview

# Direct vite commands
pnpm exec vite build
pnpm exec vite preview
```

### Vite Config (vite.config.ts)

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 1420,        // Tauri default
    strictPort: true,  // Fail if port taken
  },
});
```

## 4. Tauri 2 Commands

### Prerequisites

```bash
# Install Tauri CLI as dev dependency
pnpm add -D @tauri-apps/cli

# Install Tauri API for frontend
pnpm add @tauri-apps/api

# Install plugins
pnpm add @tauri-apps/plugin-stronghold
```

### Development

```bash
# Dev mode (hot reload — starts Vite + Rust backend)
pnpm tauri dev

# Dev with debug logging
RUST_LOG=debug pnpm tauri dev

# Dev with specific features
pnpm tauri dev -- --features "custom-feature"
```

### Building

```bash
# Standard production build
pnpm tauri build

# Debug build (faster, no optimization)
pnpm tauri build -- --debug

# Build for specific target
pnpm tauri build -- --target x86_64-unknown-linux-gnu
```

### Project Initialization

```bash
# New project (interactive)
pnpm create tauri-app

# Add Tauri to existing frontend project
pnpm add -D @tauri-apps/cli
pnpm exec tauri init
```

### Adding Plugins

```bash
# Using Tauri CLI (updates Cargo.toml + registers plugin)
pnpm tauri add stronghold
pnpm tauri add fs
pnpm tauri add shell
pnpm tauri add notification
```

### tauri.conf.json Structure

```json
{
  "build": {
    "beforeDevCommand": "pnpm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{
      "title": "ZAP Quantum Vault",
      "width": 1200,
      "height": 800
    }],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all"
  }
}
```

## 5. Rust / Cargo Commands

```bash
# Build Rust backend only
cd src-tauri && cargo build

# Build release
cd src-tauri && cargo build --release

# Run tests
cd src-tauri && cargo test

# Run tests with output
cd src-tauri && cargo test -- --nocapture

# Check without building
cd src-tauri && cargo check

# Format code
cd src-tauri && cargo fmt

# Lint
cd src-tauri && cargo clippy
```

## 6. Full Build Pipeline (ZAP Quantum Vault)

```bash
# 1. Install frontend deps
pnpm install

# 2. Type-check frontend
pnpm exec tsc -b

# 3. Build frontend only
pnpm run build

# 4. Full Tauri dev (frontend + backend)
pnpm tauri dev

# 5. Full production build
pnpm tauri build

# 6. Run Rust tests
cd src-tauri && cargo test
```

## 7. Git Workflow

```bash
# Feature branch
git checkout -b "feature/branch-name"

# Stage and commit
git add -A
git commit -m "feat: description"

# Push with upstream
git push -u origin feature/branch-name

# Force push (when starting fresh repo)
git push --force origin main
```

## 8. Project Structure

```
ZAP_QUANTUM_VAULT/
├── src/                    # React frontend
│   ├── pages/              # Route pages
│   ├── components/         # UI components
│   ├── store/              # Zustand stores
│   ├── lib/                # Utils
│   └── main.tsx            # Entry point
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri IPC handlers
│   │   ├── crypto/         # Crypto modules
│   │   ├── models/         # Data types
│   │   ├── lib.rs          # Library entry
│   │   └── main.rs         Binary entry
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
├── docs/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

## 9. Common Gotchas

1. **Never use `npx`** — use `pnpm exec` (local bins) or `pnpm dlx` (one-off packages)
2. **`npx tsc` resolves to wrong package** — always use `pnpm exec tsc`
3. **Tauri dev port must be 1420** — `strictPort: true` in vite.config.ts
4. **`frontendDist` in tauri.conf.json** must point to `../dist` (relative to src-tauri/)
5. **Rust edition 2021** minimum, rust-version 1.85+ for ML-DSA-87
6. **pnpm CWD issues** — if pnpm can't find package.json, use `--dir /absolute/path`
7. **esbuild build scripts** — run `pnpm approve-builds` to allow esbuild to run its postinstall

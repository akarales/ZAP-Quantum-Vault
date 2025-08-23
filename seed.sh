#!/bin/bash

# ZAP Quantum Vault Database Seeder Script
echo "🌱 ZAP Quantum Vault Database Seeder"
echo "===================================="

# Change to the src-tauri directory
cd "$(dirname "$0")/src-tauri" || exit 1

echo "📍 Working directory: $(pwd)"

# Build and run the seed binary
echo "🔨 Building seed binary..."
cargo build --bin seed --release

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "🌱 Running database seeder..."
    ./target/release/seed
else
    echo "❌ Build failed!"
    exit 1
fi

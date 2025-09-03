#!/bin/bash
DB_PATH="/home/anubix/.local/share/com.zap-vault/vault.db"

echo "=== Database File Info ==="
ls -la "$DB_PATH"
echo ""

echo "=== File Type ==="
file "$DB_PATH"
echo ""

echo "=== Database Tables ==="
sqlite3 "$DB_PATH" ".tables"
echo ""

echo "=== Bitcoin Keys Table Schema ==="
sqlite3 "$DB_PATH" "PRAGMA table_info(bitcoin_keys);"
echo ""

echo "=== Bitcoin Keys Count ==="
sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM bitcoin_keys;"
echo ""

echo "=== All Bitcoin Keys ==="
sqlite3 "$DB_PATH" "SELECT * FROM bitcoin_keys;"
echo ""

echo "=== Vaults Table ==="
sqlite3 "$DB_PATH" "SELECT * FROM vaults;"
echo ""

# Database Verification Guide

This guide provides essential SQLite commands for verifying and inspecting the Zap Quantum Vault database.

## Database Location

The SQLite database is located at:
```
/home/anubix/.local/share/com.zap-vault/vault.db
```

## Basic Database Information

### Check if database exists and get file info
```bash
ls -la /home/anubix/.local/share/com.zap-vault/
file /home/anubix/.local/share/com.zap-vault/vault.db
```

### List all tables
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "SELECT name FROM sqlite_master WHERE type='table';"
```

### Show database schema
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db ".schema"
```

### Show all tables (alternative)
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db ".tables"
```

## Bitcoin Key Management Verification

### Count all Bitcoin keys (active and inactive)
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "SELECT COUNT(*) as total_bitcoin_keys FROM bitcoin_keys;"
```

### Count active Bitcoin keys only
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "SELECT COUNT(*) as active_bitcoin_keys FROM bitcoin_keys WHERE is_active = 1;"
```

### Count trashed Bitcoin keys
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "SELECT COUNT(*) as trashed_bitcoin_keys FROM bitcoin_keys WHERE is_active = 0;"
```

### List all Bitcoin keys with status
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "SELECT id, vault_id, key_type, network, is_active, created_at FROM bitcoin_keys ORDER BY created_at DESC;"
```

### Check specific key by ID
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "SELECT COUNT(*) FROM bitcoin_keys WHERE id = 'KEY_ID_HERE';"
```

### Show Bitcoin key details with addresses
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "
SELECT 
    bk.id,
    bk.key_type,
    bk.network,
    bk.is_active,
    bk.created_at,
    ra.address,
    ra.is_primary
FROM bitcoin_keys bk 
LEFT JOIN receiving_addresses ra ON bk.id = ra.key_id 
ORDER BY bk.created_at DESC;
"
```

## Receiving Addresses Verification

### Count all receiving addresses
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "SELECT COUNT(*) as total_addresses FROM receiving_addresses;"
```

### Count primary addresses
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "SELECT COUNT(*) as primary_addresses FROM receiving_addresses WHERE is_primary = 1;"
```

### List all receiving addresses
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "SELECT key_id, address, is_primary, created_at FROM receiving_addresses ORDER BY created_at DESC;"
```

### Check for orphaned addresses (addresses without corresponding keys)
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "
SELECT ra.key_id, ra.address 
FROM receiving_addresses ra 
LEFT JOIN bitcoin_keys bk ON ra.key_id = bk.id 
WHERE bk.id IS NULL;
"
```

## Vault Management Verification

### List all vaults
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "SELECT id, name, description, is_default, created_at FROM vaults ORDER BY created_at DESC;"
```

### Count vaults
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "SELECT COUNT(*) as total_vaults FROM vaults;"
```

### Find default vault
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "SELECT id, name FROM vaults WHERE is_default = 1;"
```

## Data Integrity Checks

### Check for Bitcoin keys without addresses
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "
SELECT bk.id, bk.key_type, bk.network 
FROM bitcoin_keys bk 
LEFT JOIN receiving_addresses ra ON bk.id = ra.key_id 
WHERE ra.key_id IS NULL;
"
```

### Check for multiple primary addresses per key (should be 0)
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "
SELECT key_id, COUNT(*) as primary_count 
FROM receiving_addresses 
WHERE is_primary = 1 
GROUP BY key_id 
HAVING COUNT(*) > 1;
"
```

### Verify vault references in Bitcoin keys
```sql
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "
SELECT bk.vault_id, COUNT(*) as key_count 
FROM bitcoin_keys bk 
GROUP BY bk.vault_id 
ORDER BY key_count DESC;
"
```

## Database Cleanup Verification

### After permanent deletion, verify complete removal
```sql
# Replace KEY_ID_HERE with the actual key ID
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db "
SELECT 
    (SELECT COUNT(*) FROM bitcoin_keys WHERE id = 'KEY_ID_HERE') as keys_found,
    (SELECT COUNT(*) FROM receiving_addresses WHERE key_id = 'KEY_ID_HERE') as addresses_found;
"
```

### Check database size
```bash
du -h /home/anubix/.local/share/com.zap-vault/vault.db
```

## Interactive Database Session

To open an interactive SQLite session:
```bash
sqlite3 /home/anubix/.local/share/com.zap-vault/vault.db
```

Useful SQLite commands in interactive mode:
- `.tables` - List all tables
- `.schema table_name` - Show schema for specific table
- `.headers on` - Show column headers in query results
- `.mode column` - Format output in columns
- `.quit` - Exit SQLite

## Common Verification Scenarios

### After generating a new Bitcoin key
```sql
-- Check if key was created
SELECT COUNT(*) FROM bitcoin_keys WHERE created_at > datetime('now', '-1 minute');

-- Check if address was created
SELECT COUNT(*) FROM receiving_addresses WHERE created_at > datetime('now', '-1 minute');
```

### After soft delete (move to trash)
```sql
-- Verify key is marked as inactive
SELECT is_active FROM bitcoin_keys WHERE id = 'KEY_ID_HERE';

-- Should return 0 for trashed key
```

### After permanent delete
```sql
-- Verify complete removal
SELECT 
    (SELECT COUNT(*) FROM bitcoin_keys WHERE id = 'KEY_ID_HERE') as key_exists,
    (SELECT COUNT(*) FROM receiving_addresses WHERE key_id = 'KEY_ID_HERE') as addresses_exist;

-- Both should return 0
```

### After restore from trash
```sql
-- Verify key is marked as active
SELECT is_active FROM bitcoin_keys WHERE id = 'KEY_ID_HERE';

-- Should return 1 for restored key
```

## Troubleshooting

### Database locked error
```bash
# Check for processes using the database
lsof /home/anubix/.local/share/com.zap-vault/vault.db

# Stop the Tauri application if running
pkill -f "tauri dev"
```

### Backup database before major operations
```bash
cp /home/anubix/.local/share/com.zap-vault/vault.db /home/anubix/.local/share/com.zap-vault/vault.db.backup
```

### Restore from backup
```bash
cp /home/anubix/.local/share/com.zap-vault/vault.db.backup /home/anubix/.local/share/com.zap-vault/vault.db
```

## Security Notes

- The database contains encrypted private keys and sensitive data
- Always ensure the application is stopped before direct database access
- Never modify the database directly in production
- Regular backups are recommended
- The database file permissions should be restricted to the user only

## Example Verification Workflow

1. **Check database health:**
   ```sql
   SELECT name FROM sqlite_master WHERE type='table';
   ```

2. **Verify key counts:**
   ```sql
   SELECT 
       COUNT(*) as total_keys,
       SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_keys,
       SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as trashed_keys
   FROM bitcoin_keys;
   ```

3. **Check data integrity:**
   ```sql
   SELECT 
       (SELECT COUNT(*) FROM bitcoin_keys) as total_keys,
       (SELECT COUNT(*) FROM receiving_addresses) as total_addresses,
       (SELECT COUNT(DISTINCT key_id) FROM receiving_addresses) as keys_with_addresses;
   ```

This guide should be updated as new tables and features are added to the database schema.

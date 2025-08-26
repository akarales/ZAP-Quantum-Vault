-- Migration to fix existing datetime formats from SQLite CURRENT_TIMESTAMP to RFC3339
-- This addresses the DateTime parsing issue causing "premature end of input" errors

-- Update vaults table datetime fields to RFC3339 format
UPDATE vaults 
SET created_at = datetime(created_at, 'utc') || 'Z'
WHERE created_at NOT LIKE '%T%Z' AND created_at NOT LIKE '%+%';

UPDATE vaults 
SET updated_at = datetime(updated_at, 'utc') || 'Z'
WHERE updated_at NOT LIKE '%T%Z' AND updated_at NOT LIKE '%+%';

-- Update vault_items table datetime fields to RFC3339 format
UPDATE vault_items 
SET created_at = datetime(created_at, 'utc') || 'Z'
WHERE created_at NOT LIKE '%T%Z' AND created_at NOT LIKE '%+%';

UPDATE vault_items 
SET updated_at = datetime(updated_at, 'utc') || 'Z'
WHERE updated_at NOT LIKE '%T%Z' AND updated_at NOT LIKE '%+%';

-- Update users table datetime fields to RFC3339 format
UPDATE users 
SET created_at = datetime(created_at, 'utc') || 'Z'
WHERE created_at NOT LIKE '%T%Z' AND created_at NOT LIKE '%+%';

UPDATE users 
SET updated_at = datetime(updated_at, 'utc') || 'Z'
WHERE updated_at NOT LIKE '%T%Z' AND updated_at NOT LIKE '%+%';

-- Create triggers to ensure future datetime inserts use RFC3339 format
-- Trigger for vaults table
CREATE TRIGGER IF NOT EXISTS vaults_datetime_format_insert
AFTER INSERT ON vaults
FOR EACH ROW
WHEN NEW.created_at NOT LIKE '%T%Z' AND NEW.created_at NOT LIKE '%+%'
BEGIN
    UPDATE vaults 
    SET created_at = datetime(NEW.created_at, 'utc') || 'Z',
        updated_at = datetime(NEW.updated_at, 'utc') || 'Z'
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS vaults_datetime_format_update
AFTER UPDATE ON vaults
FOR EACH ROW
WHEN NEW.updated_at NOT LIKE '%T%Z' AND NEW.updated_at NOT LIKE '%+%'
BEGIN
    UPDATE vaults 
    SET updated_at = datetime(NEW.updated_at, 'utc') || 'Z'
    WHERE id = NEW.id;
END;

-- Trigger for vault_items table
CREATE TRIGGER IF NOT EXISTS vault_items_datetime_format_insert
AFTER INSERT ON vault_items
FOR EACH ROW
WHEN NEW.created_at NOT LIKE '%T%Z' AND NEW.created_at NOT LIKE '%+%'
BEGIN
    UPDATE vault_items 
    SET created_at = datetime(NEW.created_at, 'utc') || 'Z',
        updated_at = datetime(NEW.updated_at, 'utc') || 'Z'
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS vault_items_datetime_format_update
AFTER UPDATE ON vault_items
FOR EACH ROW
WHEN NEW.updated_at NOT LIKE '%T%Z' AND NEW.updated_at NOT LIKE '%+%'
BEGIN
    UPDATE vault_items 
    SET updated_at = datetime(NEW.updated_at, 'utc') || 'Z'
    WHERE id = NEW.id;
END;

-- Trigger for users table
CREATE TRIGGER IF NOT EXISTS users_datetime_format_insert
AFTER INSERT ON users
FOR EACH ROW
WHEN NEW.created_at NOT LIKE '%T%Z' AND NEW.created_at NOT LIKE '%+%'
BEGIN
    UPDATE users 
    SET created_at = datetime(NEW.created_at, 'utc') || 'Z',
        updated_at = datetime(NEW.updated_at, 'utc') || 'Z'
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS users_datetime_format_update
AFTER UPDATE ON users
FOR EACH ROW
WHEN NEW.updated_at NOT LIKE '%T%Z' AND NEW.updated_at NOT LIKE '%+%'
BEGIN
    UPDATE users 
    SET updated_at = datetime(NEW.updated_at, 'utc') || 'Z'
    WHERE id = NEW.id;
END;

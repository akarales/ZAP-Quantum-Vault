#!/usr/bin/env python3
"""
Test script to verify trust level database operations
"""

import sqlite3
from pathlib import Path

def test_trust_levels():
    db_path = Path.home() / '.local/share/com.zap-vault/vault.db'
    
    if not db_path.exists():
        print("❌ Database not found")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Test inserting a trust level entry
    test_drive_id = "usb_sde1"
    test_trust_level = "trusted"
    now = "2025-09-01T15:54:00Z"
    
    try:
        # Insert test trust level
        cursor.execute("""
            INSERT OR REPLACE INTO usb_drive_trust 
            (id, user_id, drive_id, device_path, drive_label, trust_level, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            f"trust_{test_drive_id}",
            "admin",
            test_drive_id,
            f"/dev/{test_drive_id.replace('usb_', '')}",
            "TEST_DRIVE",
            test_trust_level,
            now,
            now
        ))
        
        conn.commit()
        print("✅ Successfully inserted test trust level")
        
        # Verify insertion
        cursor.execute("SELECT * FROM usb_drive_trust WHERE drive_id = ?", (test_drive_id,))
        result = cursor.fetchone()
        
        if result:
            print(f"✅ Trust level entry found: {result}")
        else:
            print("❌ Trust level entry not found after insertion")
        
        # Test password insertion too
        cursor.execute("""
            INSERT OR REPLACE INTO usb_drive_passwords 
            (id, user_id, drive_id, device_path, drive_label, encrypted_password, password_hint, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            f"pwd_{test_drive_id}",
            "admin", 
            test_drive_id,
            f"/dev/{test_drive_id.replace('usb_', '')}",
            "TEST_DRIVE",
            "encrypted_test_password",
            "test hint",
            now,
            now
        ))
        
        conn.commit()
        print("✅ Successfully inserted test password")
        
        # Check both tables
        cursor.execute("SELECT COUNT(*) FROM usb_drive_trust")
        trust_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM usb_drive_passwords") 
        pwd_count = cursor.fetchone()[0]
        
        print(f"📊 Database status:")
        print(f"  - Trust entries: {trust_count}")
        print(f"  - Password entries: {pwd_count}")
        
    except Exception as e:
        print(f"❌ Database operation failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    test_trust_levels()

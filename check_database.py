#!/usr/bin/env python3
"""
Database checker for ZAP Quantum Vault
Checks if USB drive passwords are being stored correctly
"""

import sqlite3
import os
from pathlib import Path
import glob

def find_database():
    """Find the actual database location"""
    possible_paths = [
        Path.home() / ".local/share/com.zap-vault/vault.db",
        Path.home() / ".local/share/zap-vault/vault.db", 
        Path.home() / ".config/zap-vault/vault.db",
        Path("/tmp") / "vault.db",
        Path.cwd() / "vault.db",
        Path.cwd() / "src-tauri" / "vault.db"
    ]
    
    # Also search for any .db files in common locations
    search_patterns = [
        str(Path.home() / ".local/share/**/vault.db"),
        str(Path.home() / ".config/**/vault.db"),
        str(Path("/tmp/**/vault.db")),
        str(Path.cwd() / "**/vault.db")
    ]
    
    # Check exact paths first
    for path in possible_paths:
        if path.exists():
            return path
    
    # Search with patterns
    for pattern in search_patterns:
        matches = glob.glob(pattern, recursive=True)
        if matches:
            return Path(matches[0])
    
    return None

def check_database():
    # Find the database
    db_path = find_database()
    
    if not db_path:
        print("❌ Database not found in common locations")
        print("Searched locations:")
        print("  - ~/.local/share/com.zap-vault/vault.db")
        print("  - ~/.local/share/zap-vault/vault.db")
        print("  - ~/.config/zap-vault/vault.db")
        print("  - /tmp/vault.db")
        print("  - ./vault.db")
        print("  - ./src-tauri/vault.db")
        return
    
    print(f"✅ Database found at: {db_path}")
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check if usb_drive_passwords table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='usb_drive_passwords'
        """)
        
        if not cursor.fetchone():
            print("❌ usb_drive_passwords table not found")
            
            # List all tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            print("Available tables:")
            for table in tables:
                print(f"  - {table[0]}")
        else:
            print("✅ usb_drive_passwords table exists")
            
            # Check table schema
            cursor.execute("PRAGMA table_info(usb_drive_passwords)")
            columns = cursor.fetchall()
            print("\nTable schema:")
            for col in columns:
                print(f"  - {col[1]} ({col[2]})")
            
            # Check for stored passwords
            cursor.execute("SELECT COUNT(*) FROM usb_drive_passwords")
            count = cursor.fetchone()[0]
            print(f"\nStored passwords: {count}")
            
            if count > 0:
                cursor.execute("""
                    SELECT id, user_id, drive_id, device_path, drive_label, 
                           password_hint, created_at, updated_at 
                    FROM usb_drive_passwords 
                    ORDER BY created_at DESC 
                    LIMIT 5
                """)
                
                passwords = cursor.fetchall()
                print("\nRecent entries:")
                for pwd in passwords:
                    print(f"  ID: {pwd[0]}")
                    print(f"  User: {pwd[1]}")
                    print(f"  Drive ID: {pwd[2]}")
                    print(f"  Device: {pwd[3]}")
                    print(f"  Label: {pwd[4]}")
                    print(f"  Hint: {pwd[5]}")
                    print(f"  Created: {pwd[6]}")
                    print(f"  Updated: {pwd[7]}")
                    print("  ---")
        
        # Check users table
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        print(f"\nUsers in database: {user_count}")
        
        cursor.execute("SELECT id, username, email FROM users LIMIT 3")
        users = cursor.fetchall()
        print("Sample users:")
        for user in users:
            print(f"  - {user[1]} ({user[2]})")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Database error: {e}")

if __name__ == "__main__":
    check_database()

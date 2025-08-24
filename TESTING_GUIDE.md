# ZAP Quantum Vault - Comprehensive Testing Guide

## 🚀 **Quick Start Testing**

### **1. Start the Application**
```bash
cd /home/anubix/CODE/zapchat_project/zap_vault
pnpm tauri dev
```

### **2. Application Launch**
- Application should open in a new window
- Initial screen shows authentication page
- Database initializes automatically (SQLite)

---

## 🔐 **Phase 1: Authentication System Testing**

### **Test 1.1: First User Registration (Auto-Admin)**
1. Click **"Register"** tab
2. Fill in details:
   - **Username**: `admin_user`
   - **Email**: `admin@zapchat.org`
   - **Password**: `SecurePass123!`
   - **Confirm Password**: `SecurePass123!`
3. Click **"Register"**
4. **Expected**: Success message, automatic login, user becomes admin

### **Test 1.2: User Login**
1. If logged in, logout first
2. Click **"Login"** tab
3. Enter credentials:
   - **Username**: `admin_user`
   - **Password**: `SecurePass123!`
4. Click **"Login"**
5. **Expected**: Successful login, redirect to dashboard

### **Test 1.3: Dashboard Navigation**
1. Verify sidebar navigation works:
   - **Dashboard** - Overview with stats
   - **Key Management** - Cryptographic keys
   - **Secure Storage** - Vault system (NEW)
   - **Security Center** - Security settings
   - **User Management** - Admin only
   - **Settings** - User preferences

---

## 👥 **Phase 2: User Management Testing (Admin Features)**

### **Test 2.1: Access User Management**
1. Navigate to **"User Management"** in sidebar
2. **Expected**: Admin-only page loads successfully
3. **Expected**: Shows current user list with admin user

### **Test 2.2: Create Additional Users**
1. Click **"Create User"** button
2. Fill in details:
   - **Username**: `test_user`
   - **Email**: `test@zapchat.org`
   - **Password**: `TestPass123!`
   - **Role**: `User` (not Admin)
3. Click **"Create User"**
4. **Expected**: User created successfully, appears in list

### **Test 2.3: Role Management**
1. Find `test_user` in the user list
2. Change role from **"User"** to **"Admin"**
3. **Expected**: Role updated successfully
4. Change back to **"User"**
5. **Expected**: Role reverted successfully

### **Test 2.4: User Status Toggle**
1. Toggle `test_user` status to **"Inactive"**
2. **Expected**: User status changes, UI reflects change
3. Toggle back to **"Active"**
4. **Expected**: User reactivated

---

## 🔒 **Phase 3: Vault System Testing (NEW FEATURES)**

### **Test 3.1: Access Vault System**
1. Navigate to **"Secure Storage"** in sidebar
2. **Expected**: VaultPage loads with empty state
3. **Expected**: Shows "No vaults yet" message with create button

### **Test 3.2: Create First Vault**
1. Click **"Create Vault"** button
2. Fill in vault details:
   - **Vault Name**: `Personal Vault`
   - **Description**: `My personal secure data storage`
   - **Vault Type**: `Personal`
   - **Allow sharing**: `Unchecked`
3. Click **"Create Vault"**
4. **Expected**: Vault created successfully, appears in vault list

### **Test 3.3: Create Multiple Vaults**
1. Create second vault:
   - **Name**: `Business Vault`
   - **Type**: `Business`
   - **Sharing**: `Checked`
2. Create third vault:
   - **Name**: `Family Vault`
   - **Type**: `Family`
3. **Expected**: All vaults visible in grid layout

### **Test 3.4: Vault Information Display**
1. Verify each vault card shows:
   - ✅ Vault name and description
   - ✅ Vault type badge
   - ✅ Sharing status (if enabled)
   - ✅ Creation timestamp
   - ✅ "View Items" button
   - ✅ Delete button (trash icon)

---

## 📁 **Phase 4: Encrypted Item Storage Testing**

### **Test 4.1: Add Items to Vault**
1. Click **"View Items"** on `Personal Vault`
2. **Expected**: Switches to items tab, shows empty state
3. Click **"Add Item"** button
4. Fill in item details:
   - **Item Name**: `Gmail Password`
   - **Data Type**: `Password`
   - **Data**: `MySecureGmailPassword123!`
   - **Metadata**: `Primary email account`
   - **Tags**: `email, google, primary`
5. Click **"Add Item"**
6. **Expected**: Item added successfully, appears in list

### **Test 4.2: Add Different Data Types**
Add multiple items with different types:

**API Key Item:**
- **Name**: `OpenAI API Key`
- **Type**: `Key`
- **Data**: `sk-1234567890abcdef...`
- **Tags**: `api, openai, development`

**Note Item:**
- **Name**: `Server Access Notes`
- **Type**: `Note`
- **Data**: `SSH into server: ssh user@192.168.1.100\nRoot password stored separately`
- **Tags**: `server, ssh, notes`

**Document Item:**
- **Name**: `License Key`
- **Type**: `Document`
- **Data**: `XXXX-YYYY-ZZZZ-AAAA-BBBB`
- **Tags**: `license, software`

### **Test 4.3: Item Display and Organization**
1. Verify items show:
   - ✅ Item name and type badge
   - ✅ Metadata (if provided)
   - ✅ Tags as colored badges
   - ✅ Creation/update timestamps
   - ✅ Eye icon (view/hide data)
   - ✅ Delete button

---

## 🔐 **Phase 5: Encryption/Decryption Testing**

### **Test 5.1: Data Encryption Verification**
1. **Database Check**: Items should be stored encrypted
2. **Expected**: Raw database contains encrypted base64 strings, not plaintext

### **Test 5.2: View/Hide Encrypted Data**
1. Click **eye icon** on any vault item
2. **Expected**: 
   - First click: Decrypts and shows plaintext data
   - Icon changes to "eye-off"
   - Data appears in gray box
3. Click **eye-off icon**
4. **Expected**: Hides data again, icon returns to "eye"

### **Test 5.3: Encryption Integrity**
1. Add item with special characters: `Password: P@$$w0rd!@#$%^&*()`
2. View the decrypted data
3. **Expected**: Special characters preserved exactly
4. Add item with unicode: `密码: 测试密码123`
5. **Expected**: Unicode characters handled correctly

---

## 🗑️ **Phase 6: Data Management Testing**

### **Test 6.1: Delete Vault Items**
1. Click delete button (trash icon) on any item
2. **Expected**: Confirmation dialog appears
3. Click **"Cancel"**
4. **Expected**: Item not deleted
5. Click delete again, confirm deletion
6. **Expected**: Item removed from list

### **Test 6.2: Delete Vaults**
1. Go back to vaults list
2. Click delete button on a vault
3. **Expected**: Confirmation dialog with warning
4. Confirm deletion
5. **Expected**: Vault and all its items deleted

### **Test 6.3: Data Persistence**
1. Add several vaults and items
2. Close application completely
3. Restart application
4. Login again
5. **Expected**: All data persists correctly

---

## 🔍 **Phase 7: UI/UX Testing**

### **Test 7.1: Responsive Design**
1. Resize application window
2. **Expected**: UI adapts properly to different sizes
3. Test on different screen resolutions

### **Test 7.2: Dark/Light Theme**
1. Check theme consistency across all pages
2. **Expected**: All components use proper theme colors

### **Test 7.3: Loading States**
1. **Expected**: Loading indicators during operations
2. **Expected**: Proper error messages for failures
3. **Expected**: Success messages for completed actions

### **Test 7.4: Navigation Flow**
1. Test all sidebar navigation links
2. **Expected**: Smooth transitions between pages
3. **Expected**: Proper authentication protection

---

## 🛡️ **Phase 8: Security Testing**

### **Test 8.1: Authentication Protection**
1. Try accessing protected routes without login
2. **Expected**: Redirected to authentication page

### **Test 8.2: Role-Based Access**
1. Login as non-admin user
2. Try accessing User Management
3. **Expected**: Access denied or hidden

### **Test 8.3: Data Isolation**
1. Create vaults with different users
2. **Expected**: Users only see their own vaults

---

## ✅ **Expected Test Results Summary**

### **Authentication System:**
- ✅ User registration with auto-admin assignment
- ✅ Secure login/logout functionality
- ✅ Password hashing with Argon2

### **User Management:**
- ✅ Admin-only access control
- ✅ User creation, role management, status toggle
- ✅ Proper permission enforcement

### **Vault System:**
- ✅ Vault creation with metadata
- ✅ Multiple vault types (Personal/Business/Family)
- ✅ Sharing configuration

### **Encrypted Storage:**
- ✅ AES-256-GCM encryption for all vault items
- ✅ Multiple data types (text, password, note, key, document)
- ✅ Tag-based organization
- ✅ Secure view/hide functionality

### **Data Management:**
- ✅ CRUD operations for vaults and items
- ✅ Data persistence across sessions
- ✅ Proper deletion with confirmations

### **Security:**
- ✅ Production-grade encryption
- ✅ Role-based access control
- ✅ Data isolation between users
- ✅ Secure authentication flow

---

## 🐛 **Common Issues & Troubleshooting**

### **Build Issues:**
```bash
# Clean build
rm -rf target/ node_modules/
pnpm install
pnpm tauri dev
```

### **Database Issues:**
```bash
# Reset database (WARNING: Deletes all data)
rm src-tauri/vault.db
pnpm tauri dev
```

### **Port Conflicts:**
- Default port: `http://localhost:1420/`
- If port busy, Vite will suggest alternative

---

## 📊 **Performance Benchmarks**

### **Expected Performance:**
- **App Startup**: < 3 seconds
- **Vault Creation**: < 500ms
- **Item Encryption**: < 100ms per item
- **Item Decryption**: < 50ms per item
- **Database Operations**: < 200ms

### **Memory Usage:**
- **Idle**: ~50-100MB
- **With 100 items**: ~100-150MB
- **Heavy usage**: ~200MB max

This comprehensive testing guide covers all current functionality. Start with Phase 1 and work through each phase systematically to verify the complete system works as expected.

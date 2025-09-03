# Modern Tauri Testing Setup (2024-2025)

Based on the latest Tauri v2 documentation and best practices, here are the most up-to-date testing methods:

## **1. Vitest + Mock Runtime (Recommended)**

### **Setup**
```bash
# Install testing dependencies
pnpm add -D vitest @vitest/ui jsdom @tauri-apps/api
```

### **Vitest Config** (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts']
  }
})
```

### **Test Setup** (`src/test-setup.ts`)
```typescript
import { beforeAll } from 'vitest'
import { randomFillSync } from 'crypto'

// Mock WebCrypto for jsdom
beforeAll(() => {
  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: (buffer: any) => {
        return randomFillSync(buffer)
      },
    },
  })
})
```

## **2. Password Command Tests**

### **Test File** (`src/tests/password-commands.test.ts`)
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mockIPC } from '@tauri-apps/api/mocks'
import { invoke } from '@tauri-apps/api/core'

describe('Password Commands', () => {
  beforeEach(() => {
    // Clear any previous mocks
    mockIPC(() => {})
  })

  it('should save USB drive password', async () => {
    const mockResponse = 'Password saved successfully'
    
    mockIPC((cmd, args) => {
      if (cmd === 'save_usb_drive_password') {
        expect(args.user_id).toBe('admin')
        expect(args.request.drive_id).toBe('USB-001')
        expect(args.request.password).toBe('test123')
        return mockResponse
      }
    })

    const result = await invoke('save_usb_drive_password', {
      user_id: 'admin',
      request: {
        drive_id: 'USB-001',
        device_path: '/media/usb1',
        drive_label: 'Test Drive',
        password: 'test123',
        password_hint: 'Test password'
      }
    })

    expect(result).toBe(mockResponse)
  })

  it('should retrieve USB drive password', async () => {
    const mockPassword = 'test123'
    
    mockIPC((cmd, args) => {
      if (cmd === 'get_usb_drive_password') {
        expect(args.user_id).toBe('admin')
        expect(args.drive_id).toBe('USB-001')
        return mockPassword
      }
    })

    const result = await invoke('get_usb_drive_password', {
      user_id: 'admin',
      drive_id: 'USB-001'
    })

    expect(result).toBe(mockPassword)
  })

  it('should handle no password found', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'get_usb_drive_password') {
        return null // No password found
      }
    })

    const result = await invoke('get_usb_drive_password', {
      user_id: 'admin',
      drive_id: 'USB-001'
    })

    expect(result).toBeNull()
  })

  it('should get all user passwords', async () => {
    const mockPasswords = [
      {
        id: 'test-001',
        user_id: 'admin',
        drive_id: 'USB-001',
        device_path: '/media/usb1',
        drive_label: 'Test Drive',
        created_at: '2025-08-31T22:00:00Z',
        updated_at: '2025-08-31T22:00:00Z',
        last_used: null
      }
    ]
    
    mockIPC((cmd, args) => {
      if (cmd === 'get_user_usb_drive_passwords') {
        expect(args.user_id).toBe('admin')
        return mockPasswords
      }
    })

    const result = await invoke('get_user_usb_drive_passwords', {
      user_id: 'admin'
    })

    expect(result).toEqual(mockPasswords)
    expect(result).toHaveLength(1)
  })
})
```

## **3. Component Testing**

### **FormatSection Component Test**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mockIPC } from '@tauri-apps/api/mocks'
import { FormatSection } from '@/components/drive/FormatSection'

// Mock the auth context
const mockUser = { id: 'admin', username: 'admin' }
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser })
}))

describe('FormatSection Component', () => {
  const mockDrive = {
    id: 'USB-001',
    filesystem: 'LUKS Encrypted',
    device_path: '/media/usb1'
  }

  const mockProps = {
    drive: mockDrive,
    formatOptions: {},
    setFormatOptions: vi.fn(),
    onFormatDrive: vi.fn(),
    onResetEncryptedDrive: vi.fn(),
    operationInProgress: false
  }

  beforeEach(() => {
    mockIPC(() => {})
  })

  it('should load stored password for encrypted drive', async () => {
    const mockPassword = 'stored-password-123'
    
    mockIPC((cmd, args) => {
      if (cmd === 'get_usb_drive_password') {
        return mockPassword
      }
    })

    render(<FormatSection {...mockProps} />)

    await waitFor(() => {
      const passwordInput = screen.getByPlaceholderText(/enter current password/i)
      expect(passwordInput).toHaveValue(mockPassword)
    })

    expect(screen.getByText(/password automatically loaded/i)).toBeInTheDocument()
  })

  it('should show manual entry message when no password stored', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'get_usb_drive_password') {
        return null // No password found
      }
    })

    render(<FormatSection {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/no stored password found/i)).toBeInTheDocument()
    })

    const passwordInput = screen.getByPlaceholderText(/enter current password/i)
    expect(passwordInput).toHaveValue('')
  })

  it('should verify password when clicked', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'verify_drive_password') {
        return true // Password is correct
      }
    })

    render(<FormatSection {...mockProps} />)

    const passwordInput = screen.getByPlaceholderText(/enter current password/i)
    const verifyButton = screen.getByText(/verify/i)

    fireEvent.change(passwordInput, { target: { value: 'test123' } })
    fireEvent.click(verifyButton)

    await waitFor(() => {
      expect(screen.getByText(/password verified/i)).toBeInTheDocument()
    })
  })
})
```

## **4. Integration Testing with Real Backend**

### **Backend Integration Test**
```typescript
import { describe, it, expect } from 'vitest'
import { invoke } from '@tauri-apps/api/core'

// These tests run against the real Tauri backend
describe('Password Integration Tests', () => {
  const testConfig = {
    userId: 'test-user',
    driveId: 'TEST-001',
    password: 'integration-test-password'
  }

  it('should save and retrieve password end-to-end', async () => {
    // Save password
    const saveResult = await invoke('save_usb_drive_password', {
      user_id: testConfig.userId,
      request: {
        drive_id: testConfig.driveId,
        device_path: '/test/path',
        drive_label: 'Integration Test Drive',
        password: testConfig.password,
        password_hint: 'Integration test'
      }
    })

    expect(saveResult).toBe('Password saved successfully')

    // Retrieve password
    const retrievedPassword = await invoke('get_usb_drive_password', {
      user_id: testConfig.userId,
      drive_id: testConfig.driveId
    })

    expect(retrievedPassword).toBe(testConfig.password)

    // Cleanup
    await invoke('delete_usb_drive_password', {
      user_id: testConfig.userId,
      drive_id: testConfig.driveId
    })
  })
})
```

## **5. Package.json Scripts**

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run --config vitest.integration.config.ts"
  }
}
```

## **6. Running Tests**

### **Unit Tests (Mocked)**
```bash
# Run all tests
pnpm test

# Run with UI
pnpm test:ui

# Run once
pnpm test:run

# Run specific test file
pnpm test password-commands.test.ts
```

### **Integration Tests (Real Backend)**
```bash
# Make sure Tauri dev server is running
pnpm tauri dev

# In another terminal, run integration tests
pnpm test:integration
```

## **7. Advantages of This Approach**

1. **Fast Unit Tests**: Mock runtime is much faster than real backend
2. **Reliable**: Tests don't depend on external state or database
3. **Isolated**: Each test runs independently
4. **Modern**: Uses latest Vitest and Tauri v2 features
5. **Comprehensive**: Covers both unit and integration scenarios
6. **Type Safe**: Full TypeScript support

## **8. Your Specific Use Case**

For testing your password retrieval issue, you can now:

1. **Write unit tests** to verify the logic works with mocked data
2. **Write integration tests** to test against real database
3. **Test component behavior** with different password states
4. **Run tests in CI/CD** for continuous validation

This approach is much more robust than running manual scripts in the browser console.

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

  it('should handle password retrieval errors', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'get_usb_drive_password') {
        throw new Error('Database connection failed')
      }
    })

    await expect(
      invoke('get_usb_drive_password', {
        user_id: 'admin',
        drive_id: 'USB-001'
      })
    ).rejects.toThrow('Database connection failed')
  })

  it('should verify drive password', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'verify_drive_password') {
        expect(args.drive_id).toBe('USB-001')
        expect(args.password).toBe('correct-password')
        return true
      }
    })

    const result = await invoke('verify_drive_password', {
      drive_id: 'USB-001',
      password: 'correct-password'
    })

    expect(result).toBe(true)
  })

  it('should handle incorrect password verification', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'verify_drive_password') {
        return false // Incorrect password
      }
    })

    const result = await invoke('verify_drive_password', {
      drive_id: 'USB-001',
      password: 'wrong-password'
    })

    expect(result).toBe(false)
  })
})

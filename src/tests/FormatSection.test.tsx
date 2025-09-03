import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mockIPC } from '@tauri-apps/api/mocks'
import { FormatSection } from '@/components/drive/FormatSection'

// Mock the auth context
const mockUser = { id: 'admin', username: 'admin' }
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser })
}))

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, disabled, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      {...props}
    />
  )
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h2 data-testid="card-title">{children}</h2>
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <div data-testid="select" onClick={() => onValueChange?.('test')}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <div>Select Value</div>
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: any) => <div data-testid="progress" data-value={value} />
}))

vi.mock('lucide-react', () => ({
  EyeIcon: () => <div data-testid="eye-icon" />,
  EyeOffIcon: () => <div data-testid="eye-off-icon" />,
  CheckIcon: () => <div data-testid="check-icon" />
}))

describe('FormatSection Component', () => {
  const mockDrive = {
    id: 'USB-001',
    filesystem: 'LUKS Encrypted',
    device_path: '/media/usb1'
  }

  const mockProps = {
    drive: mockDrive,
    formatOptions: {
      drive_name: '',
      filesystem: 'ext4',
      encryption_type: 'basic_luks2',
      password: '',
      confirm_password: ''
    },
    setFormatOptions: vi.fn(),
    onFormatDrive: vi.fn(),
    onResetEncryptedDrive: vi.fn(),
    operationInProgress: false
  }

  beforeEach(() => {
    mockIPC(() => {})
    vi.clearAllMocks()
  })

  it('should render FormatSection component', () => {
    render(<FormatSection {...mockProps} />)
    
    expect(screen.getByTestId('card-title')).toHaveTextContent('Format & Encryption')
  })

  it('should load stored password for encrypted drive', async () => {
    const mockPassword = 'stored-password-123'
    
    mockIPC((cmd, args) => {
      if (cmd === 'get_usb_drive_password') {
        expect(args.user_id).toBe('admin')
        expect(args.drive_id).toBe('USB-001')
        return mockPassword
      }
    })

    render(<FormatSection {...mockProps} />)

    await waitFor(() => {
      const passwordInput = screen.getByPlaceholderText(/password loaded from vault/i)
      expect(passwordInput).toHaveValue(mockPassword)
    })

    expect(screen.getByText(/password automatically loaded from secure vault/i)).toBeInTheDocument()
  })

  it('should show manual entry message when no password stored', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'get_usb_drive_password') {
        return null // No password found
      }
    })

    render(<FormatSection {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/no stored password found - please enter the current password manually/i)).toBeInTheDocument()
    })

    const passwordInput = screen.getByPlaceholderText(/enter current password/i)
    expect(passwordInput).toHaveValue('')
  })

  it('should show loading state while fetching password', () => {
    mockIPC((cmd, args) => {
      if (cmd === 'get_usb_drive_password') {
        // Simulate slow response
        return new Promise(resolve => setTimeout(() => resolve('password'), 100))
      }
    })

    render(<FormatSection {...mockProps} />)

    expect(screen.getByText(/loading stored password from vault/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/loading\.\.\./i)).toBeInTheDocument()
  })

  it('should verify password when clicked', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'verify_drive_password') {
        expect(args.drive_id).toBe('USB-001')
        expect(args.password).toBe('test123')
        return true // Password is correct
      }
    })

    render(<FormatSection {...mockProps} />)

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter current password/i)).toBeInTheDocument()
    })

    const passwordInput = screen.getByPlaceholderText(/enter current password/i)
    const verifyButton = screen.getByText(/verify/i)

    fireEvent.change(passwordInput, { target: { value: 'test123' } })
    fireEvent.click(verifyButton)

    await waitFor(() => {
      expect(screen.getByText(/password verified/i)).toBeInTheDocument()
    })
  })

  it('should handle password verification failure', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'verify_drive_password') {
        return false // Password is incorrect
      }
    })

    render(<FormatSection {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter current password/i)).toBeInTheDocument()
    })

    const passwordInput = screen.getByPlaceholderText(/enter current password/i)
    const verifyButton = screen.getByText(/verify/i)

    fireEvent.change(passwordInput, { target: { value: 'wrong-password' } })
    fireEvent.click(verifyButton)

    await waitFor(() => {
      // Password verification failed, so no "verified" message should appear
      expect(screen.queryByText(/password verified/i)).not.toBeInTheDocument()
    })
  })

  it('should disable verify button when password is empty', async () => {
    render(<FormatSection {...mockProps} />)

    await waitFor(() => {
      const verifyButton = screen.getByText(/verify/i)
      expect(verifyButton).toBeDisabled()
    })
  })

  it('should enable verify button when password is entered', async () => {
    render(<FormatSection {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter current password/i)).toBeInTheDocument()
    })

    const passwordInput = screen.getByPlaceholderText(/enter current password/i)
    fireEvent.change(passwordInput, { target: { value: 'test123' } })

    await waitFor(() => {
      const verifyButton = screen.getByText(/verify/i)
      expect(verifyButton).not.toBeDisabled()
    })
  })

  it('should handle API errors gracefully', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'get_usb_drive_password') {
        throw new Error('Database connection failed')
      }
    })

    render(<FormatSection {...mockProps} />)

    // Component should still render and show manual entry
    await waitFor(() => {
      expect(screen.getByText(/no stored password found - please enter the current password manually/i)).toBeInTheDocument()
    })
  })

  it('should not show current password section for non-encrypted drives', () => {
    const nonEncryptedDrive = {
      ...mockDrive,
      filesystem: 'ext4'
    }

    render(<FormatSection {...{ ...mockProps, drive: nonEncryptedDrive }} />)

    expect(screen.queryByText(/current password/i)).not.toBeInTheDocument()
  })

  it('should show current password section for encrypted drives', async () => {
    render(<FormatSection {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/current password/i)).toBeInTheDocument()
    })
  })
})

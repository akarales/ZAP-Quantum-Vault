// Mock Tauri service for browser testing
import { UsbDrive } from '../types/usb';

const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;

// Mock USB drives for browser testing
const mockUsbDrives: UsbDrive[] = [
  {
    id: 'usb_sdf',
    device_path: '/dev/sdf',
    label: 'USB Drive (/dev/sdf)',
    capacity: 15996313600, // 14.9 GB in bytes
    available_space: 15244083200, // 14.2 GB in bytes
    filesystem: 'crypto_LUKS',
    mount_point: null,
    is_encrypted: true,
    trust_level: 'untrusted',
    backup_count: 0,
  },
  {
    id: 'usb_sdg',
    device_path: '/dev/sdg',
    label: 'Test Drive',
    capacity: 34359738368, // 32 GB in bytes
    available_space: 30601641984, // 28.5 GB in bytes
    filesystem: 'ext4',
    mount_point: '/media/test',
    is_encrypted: false,
    trust_level: 'trusted',
    backup_count: 2,
  }
];

export const mockInvoke = async (command: string, args?: any): Promise<any> => {
  console.log(`Mock Tauri command: ${command}`, args);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  switch (command) {
    case 'detect_usb_drives':
      return mockUsbDrives;
      
    case 'get_drive_details':
      console.log('Mock get_drive_details called with:', args);
      const drive = mockUsbDrives.find(d => d.id === args.drive_id);
      if (!drive) {
        throw new Error(`Drive with ID ${args.drive_id} not found`);
      }
      return Promise.resolve(drive);
      
    case 'get_user_info':
      return Promise.resolve({
        id: 'default_user',
        username: 'admin',
        role: 'admin'
      });
      
    case 'mount_drive':
      console.log('Mock mount_drive called with:', args);
      return Promise.resolve(`Drive ${args.drive_id} mounted successfully at /mnt/usb`);
      
    case 'unmount_drive':
      return 'Drive unmounted successfully';
      
    case 'eject_drive':
      return 'Drive ejected safely';
      
    case 'set_drive_trust':
      return 'Trust level updated successfully';
      
    case 'format_and_encrypt_drive':
      // Simulate format progress
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('format_progress', {
          detail: { stage: 'formatting', progress: 25, message: 'Formatting drive...' }
        }));
      }, 500);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('format_progress', {
          detail: { stage: 'encrypting', progress: 75, message: 'Encrypting with LUKS2...' }
        }));
      }, 1500);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('format_progress', {
          detail: { stage: 'complete', progress: 100, message: 'Format and encryption complete' }
        }));
      }, 3000);
      
      return 'Drive formatted and encrypted successfully';
      
    case 'get_current_user':
      return 'browser-user-1';
      
    case 'create_vault_backup':
      return 'backup-' + Date.now();
      
    case 'list_backups':
      return [];
      
    case 'mount_encrypted_drive_auto':
      throw new Error('NO_STORED_PASSWORD');
      
    case 'mount_encrypted_drive':
      if (args?.password === 'test123') {
        return 'Encrypted drive mounted successfully at /media/encrypted';
      } else {
        throw new Error('Invalid password');
      }
      
    default:
      console.warn(`Unhandled mock command: ${command}`);
      return null;
  }
};

// Export the appropriate invoke function
export const getInvokeFunction = () => {
  if (isTauri) {
    return import('@tauri-apps/api/core').then(module => module.invoke);
  } else {
    return Promise.resolve(mockInvoke);
  }
};

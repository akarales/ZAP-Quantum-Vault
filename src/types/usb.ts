export interface UsbDrive {
  id: string;
  device_path: string;
  mount_point?: string | null;
  capacity: number;
  available_space: number;
  filesystem: string;
  is_encrypted: boolean;
  label?: string;
  trust_level: 'trusted' | 'untrusted' | 'blocked';
  last_backup?: string | null;
  backup_count: number;
}

export interface UsbDrivePassword {
  id: string;
  user_id: string;
  drive_id: string;
  device_path: string;
  drive_label?: string;
  password_hint?: string;
  created_at: string;
  updated_at: string;
  last_used?: string;
}

export interface SavePasswordRequest {
  drive_id: string;
  device_path: string;
  drive_label?: string;
  password: string;
  password_hint?: string;
}

export type TrustLevel = 'trusted' | 'untrusted' | 'blocked';

export interface MountResult {
  success: boolean;
  message: string;
  mount_point?: string;
}

export interface FormatProgress {
  stage: string;
  progress: number;
  message: string;
  isActive: boolean;
}

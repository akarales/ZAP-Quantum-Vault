export enum BackupType {
  Full = 'Full',
  Incremental = 'Incremental',
  Selective = 'Selective'
}

export interface BackupRequest {
  drive_id: string;
  backup_type: BackupType;
  vault_ids: string[] | null;
  compression_level: number;
  verification: boolean;
  password?: string;
}

export interface BackupMetadata {
  id: string;
  drive_id: string;
  backup_type: BackupType;
  backup_path: string;
  vault_ids: string[];
  created_at: string;
  size_bytes: number;
  checksum: string;
  encryption_method: string;
  item_count: number;
  vault_count: number;
}

export interface RestoreRequest {
  backup_id: string;
  restore_type: RestoreType;
  vault_ids?: string[];
  merge_mode: boolean;
}

export enum RestoreType {
  Full = 'Full',
  Selective = 'Selective',
  KeysOnly = 'KeysOnly'
}

import { invoke } from "@tauri-apps/api/core";

export interface KeyEntry {
  id: string;
  metadata: {
    key_type: string;
    purpose: number;
    account: number;
    index: number;
    address: string;
    created_at: string;
    label: string | null;
    derivation_path: string;
  };
  public_key_hex: string;
}

export interface CreateVaultResult {
  /** The 24-word BIP39 recovery phrase. Shown once; never retrievable again. */
  mnemonic: string;
}

export interface AirGapEnvelope {
  version: number;
  transfer_type: string;
  payload_hex: string;
  nonce_hex: string;
  signature_hex: string;
  public_key_hex: string;
  timestamp: number;
  checksum_hex: string;
}

export interface SignRequest {
  secret_key_hex: string;
  message_hex: string;
}

export interface VerifyRequest {
  public_key_hex: string;
  message_hex: string;
  signature_hex: string;
}

export interface QrRequest {
  payload_hex: string;
  transfer_type: string;
  secret_key_hex: string;
}

export interface SlotInfo {
  slot: number;
  configured: boolean;
  requires_touch: boolean;
}

export interface YubiKeyInfo {
  detected: boolean;
  vendor_id: number;
  product_id: number;
  name: string;
  version: string;
  slots: SlotInfo[];
}

export interface YubiKeyStatus {
  enabled: boolean;
  slot: number;
}

export const api = {
  vaultStatus: () => invoke<boolean>("vault_status"),

  // Create a new vault. Returns the 24-word BIP39 recovery phrase, which the UI
  // must show once for the user to back up (it is never persisted in plaintext).
  createVault: (password: string) =>
    invoke<CreateVaultResult>("create_vault", { password }),

  // Restore a vault from an existing 24-word recovery phrase. Fails if a vault
  // already exists on disk (wipe it first).
  restoreFromMnemonic: (mnemonicPhrase: string, password: string) =>
    invoke<string>("restore_from_mnemonic", { mnemonicPhrase, password }),

  unlockVault: (password: string) =>
    invoke<boolean>("unlock_vault", { password }),

  changePassword: (oldPassword: string, newPassword: string) =>
    invoke<string>("change_password", { oldPassword, newPassword }),

  lockVault: () => invoke<void>("lock_vault"),

  // Current YubiKey enrollment state for the vault.
  yubikeyStatus: () => invoke<YubiKeyStatus>("yubikey_status"),

  // Detect a connected YubiKey (throws if none is present).
  detectYubikey: () => invoke<YubiKeyInfo>("detect_yubikey"),

  // Enroll a YubiKey as a second factor. Requires the YubiKey to be inserted;
  // the user may need to touch it. `slot` is 1 or 2 (2 is conventional).
  enrollYubikey: (password: string, slot: number) =>
    invoke<string>("enroll_yubikey", { password, slot }),

  // Disable the YubiKey second factor (requires password + inserted YubiKey).
  disableYubikey: (password: string) =>
    invoke<string>("disable_yubikey", { password }),

  // Test (non-destructively) whether the inserted YubiKey is a valid backup,
  // i.e. programmed with the same HMAC secret as the enrolled key.
  verifyYubikeyBackup: (password: string) =>
    invoke<boolean>("verify_yubikey_backup", { password }),

  // Program a slot for HMAC-SHA1 challenge-response (native USB; no ykman).
  // Pass secretHex to reuse a known secret (for backup keys), or null to
  // generate a fresh random one. Returns the secret hex used (save it!).
  ykProgramHmac: (slot: number, secretHex: string | null, requireTouch: boolean) =>
    invoke<string>("yk_program_hmac", { slot, secretHex, requireTouch }),

  // Erase (format) a YubiKey slot. Refuses to erase the enrolled slot.
  ykEraseSlot: (slot: number) =>
    invoke<string>("yk_erase_slot", { slot }),

  generateKey: (keyType: string, purpose: number, account: number, index: number) =>
    invoke<KeyEntry>("generate_key", {
      keyType,
      purpose,
      account,
      index,
    }),

  listKeys: () => invoke<KeyEntry[]>("list_keys"),

  getKeyDetail: (keyId: string) =>
    invoke<KeyEntry>("get_key_detail", { keyId }),

  signMessage: (request: SignRequest) =>
    invoke<string>("sign_message", { request }),

  // Preferred: sign with a stored key; the secret never leaves the backend.
  signMessageWithKey: (keyId: string, messageHex: string) =>
    invoke<string>("sign_message_with_key", { keyId, messageHex }),

  verifyMessage: (request: VerifyRequest) =>
    invoke<boolean>("verify_message", { request }),

  generateQr: (request: QrRequest) =>
    invoke<string>("generate_qr", { request }),

  // Preferred: build a QR envelope for a stored key; secret stays backend-side.
  generateQrWithKey: (keyId: string, payloadHex: string, transferType: string) =>
    invoke<string>("generate_qr_with_key", { keyId, payloadHex, transferType }),

  // Inspect an envelope without validating it (untrusted view).
  parseQr: (qrJson: string) =>
    invoke<AirGapEnvelope>("parse_qr", { qrJson }),

  // Cryptographically verify, freshness-check, and replay-protect an envelope.
  // Throws if the signature, checksum, version, freshness, or replay check fails.
  verifyQr: (qrJson: string) =>
    invoke<AirGapEnvelope>("verify_qr", { qrJson }),
};

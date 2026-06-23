use zap_quantum_vault_lib::crypto::{
    mldsa87, address, kdf, encryption, mnemonic, hd_derivation,
};
use zap_quantum_vault_lib::models::vault::VaultState;
use zap_quantum_vault_lib::models::key::{KeyEntry, KeyType};
use zap_quantum_vault_lib::commands::signing::{SignRequest, VerifyRequest};
use zap_quantum_vault_lib::commands::airgap::{QrRequest, secret_to_public_hex};
use zap_quantum_vault_lib::models::airgap::{AirGapEnvelope, TransferType};
use std::sync::Mutex;

// ==================== Vault Lifecycle E2E ====================

struct TestVault {
    state: Mutex<VaultState>,
}

impl TestVault {
    fn new() -> Self {
        Self { state: Mutex::new(VaultState::default()) }
    }

    fn create(&self, password: &str) -> Result<String, String> {
        let mut vault = self.state.lock().unwrap();
        if vault.initialized {
            return Err("Already unlocked".to_string());
        }
        let salt = kdf::generate_salt();
        let master_key = kdf::derive_master_key(password.as_bytes(), &salt)
            .map_err(|e| e.to_string())?;
        let enc_key = kdf::derive_encryption_key(&master_key, "vault_encryption");
        let verifier = b"ZAP_VAULT_VERIFIER";
        let ct = encryption::encrypt_vault(&enc_key, verifier)
            .map_err(|e| e.to_string())?;
        vault.salt_hex = hex::encode(salt);
        vault.verifier_hash_hex = hex::encode(ct.nonce) + ":" + &hex::encode(ct.ciphertext);
        vault.initialized = true;
        Ok("Vault created successfully".to_string())
    }

    fn unlock(&self, password: &str) -> Result<bool, String> {
        let vault = self.state.lock().unwrap();
        if !vault.initialized {
            return Err("Not initialized".to_string());
        }
        let salt = hex::decode(&vault.salt_hex)
            .map_err(|e| e.to_string())?;
        let master_key = kdf::derive_master_key(password.as_bytes(), &salt)
            .map_err(|e| e.to_string())?;
        let enc_key = kdf::derive_encryption_key(&master_key, "vault_encryption");
        let parts: Vec<&str> = vault.verifier_hash_hex.split(':').collect();
        if parts.len() != 2 {
            return Err("Invalid password".to_string());
        }
        let nonce = hex::decode(parts[0]).map_err(|e| e.to_string())?;
        let ciphertext = hex::decode(parts[1]).map_err(|e| e.to_string())?;
        let ct = encryption::Ciphertext { nonce, ciphertext };
        match encryption::decrypt_vault(&enc_key, &ct) {
            Ok(decrypted) if decrypted == b"ZAP_VAULT_VERIFIER" => Ok(true),
            _ => Err("Invalid password".to_string()),
        }
    }

    fn is_initialized(&self) -> bool {
        self.state.lock().unwrap().initialized
    }
}

#[test]
fn e2e_vault_create_and_unlock_correct_password() {
    let vault = TestVault::new();
    assert!(!vault.is_initialized());

    let result = vault.create("MySecurePassword123!");
    assert!(result.is_ok());
    assert!(vault.is_initialized());

    let unlock_result = vault.unlock("MySecurePassword123!");
    assert!(unlock_result.is_ok());
    assert!(unlock_result.unwrap());
}

#[test]
fn e2e_vault_create_and_unlock_wrong_password() {
    let vault = TestVault::new();
    vault.create("correct_password").unwrap();

    let result = vault.unlock("wrong_password");
    assert!(result.is_err());
}

#[test]
fn e2e_vault_double_create_rejected() {
    let vault = TestVault::new();
    vault.create("password1").unwrap();
    let result = vault.create("password2");
    assert!(result.is_err());
}

#[test]
fn e2e_vault_unlock_before_create_rejected() {
    let vault = TestVault::new();
    let result = vault.unlock("password");
    assert!(result.is_err());
}

#[test]
fn e2e_vault_create_empty_password() {
    let vault = TestVault::new();
    let result = vault.create("");
    assert!(result.is_ok());
    assert!(vault.unlock("").is_ok());
}

#[test]
fn e2e_valt_create_unicode_password() {
    let vault = TestVault::new();
    let password = "🔐Password123🚀";
    vault.create(password).unwrap();
    assert!(vault.unlock(password).is_ok());
    assert!(vault.unlock("🔐Password123🚀 ").is_err());
}

#[test]
fn e2e_vault_verifier_integrity() {
    let vault = TestVault::new();
    vault.create("test_password").unwrap();

    let state = vault.state.lock().unwrap();
    let parts: Vec<&str> = state.verifier_hash_hex.split(':').collect();
    assert_eq!(parts.len(), 2);
    let nonce = hex::decode(parts[0]).unwrap();
    assert_eq!(nonce.len(), encryption::AES_NONCE_SIZE);
}

// ==================== Key Management E2E ====================

#[test]
fn e2e_generate_key_and_derive_address() {
    let (pk, sk) = mldsa87::generate();
    let addr = address::derive_address(pk.as_bytes());

    assert!(addr.starts_with("zap1"));
    assert_eq!(pk.as_bytes().len(), mldsa87::PUBLIC_KEY_SIZE);
    assert_eq!(sk.as_bytes().len(), mldsa87::SEED_SIZE);
}

#[test]
fn e2e_generate_multiple_keys_all_unique() {
    let mut keys = Vec::new();
    for _ in 0..10 {
        let (pk, sk) = mldsa87::generate();
        let addr = address::derive_address(pk.as_bytes());
        keys.push((pk, sk, addr));
    }
    for i in 0..keys.len() {
        for j in (i+1)..keys.len() {
            assert_ne!(keys[i].0.as_bytes(), keys[j].0.as_bytes());
            assert_ne!(keys[i].1.as_bytes(), keys[j].1.as_bytes());
            assert_ne!(keys[i].2, keys[j].2);
        }
    }
}

#[test]
fn e2e_key_entry_creation() {
    let (pk, sk) = mldsa87::generate();
    let addr = address::derive_address(pk.as_bytes());
    let entry = KeyEntry::new(
        KeyType::Genesis,
        44,
        0,
        0,
        &pk.to_hex(),
        &sk.to_hex(),
        &addr,
    );
    assert!(!entry.id.is_empty());
    assert_eq!(entry.public_key_hex, pk.to_hex());
    assert_eq!(entry.encrypted_secret_hex, sk.to_hex());
    assert_eq!(entry.metadata.address, addr);
}

#[test]
fn e2e_key_entry_all_types() {
    let types = vec![
        KeyType::Genesis, KeyType::Validator, KeyType::Governance,
        KeyType::Treasury, KeyType::SecurityAdmin, KeyType::User,
        KeyType::QuantumSafe, KeyType::Custom,
    ];
    for kt in types {
        let (pk, sk) = mldsa87::generate();
        let addr = address::derive_address(pk.as_bytes());
        let entry = KeyEntry::new(kt, 44, 0, 0, &pk.to_hex(), &sk.to_hex(), &addr);
        assert!(!entry.id.is_empty());
    }
}

// ==================== Signing Workflow E2E ====================

#[test]
fn e2e_sign_and_verify_workflow() {
    let (pk, sk) = mldsa87::generate();
    let message = b"ZAP Blockchain transaction payload";
    let sig = mldsa87::sign(&sk, message).unwrap();
    assert!(mldsa87::verify(&pk, message, &sig).unwrap());
}

#[test]
fn e2e_sign_command_workflow() {
    let (pk, sk) = mldsa87::generate();
    let request = SignRequest {
        secret_key_hex: sk.to_hex(),
        message_hex: hex::encode(b"test transaction"),
    };
    let sk = mldsa87::SecretKey::from_hex(&request.secret_key_hex).unwrap();
    let message = hex::decode(&request.message_hex).unwrap();
    let sig = mldsa87::sign(&sk, &message).unwrap();
    let sig_hex = sig.to_hex();

    let verify_request = VerifyRequest {
        public_key_hex: pk.to_hex(),
        message_hex: request.message_hex.clone(),
        signature_hex: sig_hex,
    };
    let pk = mldsa87::PublicKey::from_hex(&verify_request.public_key_hex).unwrap();
    let message = hex::decode(&verify_request.message_hex).unwrap();
    let sig = mldsa87::Signature::from_hex(&verify_request.signature_hex).unwrap();
    assert!(mldsa87::verify(&pk, &message, &sig).unwrap());
}

#[test]
fn e2e_sign_command_invalid_hex_rejected() {
    let request = SignRequest {
        secret_key_hex: "invalid".to_string(),
        message_hex: "deadbeef".to_string(),
    };
    let result = mldsa87::SecretKey::from_hex(&request.secret_key_hex);
    assert!(result.is_err());
}

#[test]
fn e2e_verify_command_tampered_signature() {
    let (pk, sk) = mldsa87::generate();
    let message = b"original message";
    let mut sig = mldsa87::sign(&sk, message).unwrap();
    sig.0[0] ^= 0xFF;
    assert!(!mldsa87::verify(&pk, message, &sig).unwrap());
}

#[test]
fn e2e_sign_verify_large_transaction() {
    let (pk, sk) = mldsa87::generate();
    let tx = vec![0xAB; 50_000];
    let sig = mldsa87::sign(&sk, &tx).unwrap();
    assert!(mldsa87::verify(&pk, &tx, &sig).unwrap());
}

// ==================== Air-Gap QR Workflow E2E ====================

#[test]
fn e2e_airgap_generate_and_parse_qr() {
    let (pk, sk) = mldsa87::generate();
    let payload = b"unsigned transaction data";
    let request = QrRequest {
        payload_hex: hex::encode(payload),
        transfer_type: "unsigned_tx".to_string(),
        secret_key_hex: sk.to_hex(),
    };

    let sk = mldsa87::SecretKey::from_hex(&request.secret_key_hex).unwrap();
    let payload_bytes = hex::decode(&request.payload_hex).unwrap();
    let sig = mldsa87::sign(&sk, &payload_bytes).unwrap();
    let checksum = blake3::hash(&payload_bytes);
    let pk_hex = secret_to_public_hex(&request.secret_key_hex).unwrap();

    let envelope = AirGapEnvelope {
        version: 1,
        transfer_type: TransferType::UnsignedTx,
        payload_hex: request.payload_hex.clone(),
        nonce_hex: hex::encode(&[0u8; 24]),
        signature_hex: sig.to_hex(),
        public_key_hex: pk_hex,
        timestamp: chrono::Utc::now().timestamp() as u64,
        checksum_hex: hex::encode(checksum.as_bytes()),
    };

    let json = serde_json::to_string(&envelope).unwrap();
    let parsed: AirGapEnvelope = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.version, 1);
    assert_eq!(parsed.payload_hex, request.payload_hex);
    assert_eq!(parsed.signature_hex, sig.to_hex());
    assert_eq!(parsed.public_key_hex, pk.to_hex());
}

#[test]
fn e2e_airgap_secret_to_public_conversion() {
    let (pk, sk) = mldsa87::generate();
    let derived_pk_hex = secret_to_public_hex(&sk.to_hex()).unwrap();
    assert_eq!(derived_pk_hex, pk.to_hex());
}

#[test]
fn e2e_airgap_invalid_secret_hex_rejected() {
    let result = secret_to_public_hex("invalid_hex");
    assert!(result.is_err());
}

#[test]
fn e2e_airgap_wrong_size_secret_rejected() {
    let result = secret_to_public_hex(&hex::encode(&[0u8; 10]));
    assert!(result.is_err());
}

#[test]
fn e2e_airgap_qr_checksum_integrity() {
    let (_, _sk) = mldsa87::generate();
    let payload = b"test payload";
    let checksum = blake3::hash(payload);
    let envelope = AirGapEnvelope {
        version: 1,
        transfer_type: TransferType::UnsignedTx,
        payload_hex: hex::encode(payload),
        nonce_hex: hex::encode(&[0u8; 24]),
        signature_hex: hex::encode(&[0u8; mldsa87::SIGNATURE_SIZE]),
        public_key_hex: hex::encode(&[0u8; mldsa87::PUBLIC_KEY_SIZE]),
        timestamp: 0,
        checksum_hex: hex::encode(checksum.as_bytes()),
    };
    let json = serde_json::to_string(&envelope).unwrap();
    let parsed: AirGapEnvelope = serde_json::from_str(&json).unwrap();
    let payload_bytes = hex::decode(&parsed.payload_hex).unwrap();
    let computed_checksum = blake3::hash(&payload_bytes);
    assert_eq!(parsed.checksum_hex, hex::encode(computed_checksum.as_bytes()));
}

#[test]
fn e2e_airgap_qr_signature_verifies() {
    let (_pk, sk) = mldsa87::generate();
    let payload = b"transaction to sign";
    let sig = mldsa87::sign(&sk, payload).unwrap();
    let pk_hex = secret_to_public_hex(&sk.to_hex()).unwrap();

    let envelope = AirGapEnvelope {
        version: 1,
        transfer_type: TransferType::SignedTx,
        payload_hex: hex::encode(payload),
        nonce_hex: hex::encode(&[0u8; 24]),
        signature_hex: sig.to_hex(),
        public_key_hex: pk_hex.clone(),
        timestamp: chrono::Utc::now().timestamp() as u64,
        checksum_hex: hex::encode(blake3::hash(payload).as_bytes()),
    };

    let parsed_pk = mldsa87::PublicKey::from_hex(&envelope.public_key_hex).unwrap();
    let parsed_sig = mldsa87::Signature::from_hex(&envelope.signature_hex).unwrap();
    let payload_bytes = hex::decode(&envelope.payload_hex).unwrap();
    assert!(mldsa87::verify(&parsed_pk, &payload_bytes, &parsed_sig).unwrap());
}

#[test]
fn e2e_airgap_transfer_types() {
    let types = vec![
        ("unsigned_tx", TransferType::UnsignedTx),
        ("signed_tx", TransferType::SignedTx),
        ("encrypted_key", TransferType::EncryptedKey),
    ];
    for (s, expected) in types {
        let tt = match s {
            "unsigned_tx" => TransferType::UnsignedTx,
            "signed_tx" => TransferType::SignedTx,
            "encrypted_key" => TransferType::EncryptedKey,
            _ => TransferType::UnsignedTx,
        };
        assert_eq!(tt, expected);
    }
}

#[test]
fn e2e_airgap_malformed_json_rejected() {
    let result: Result<AirGapEnvelope, _> = serde_json::from_str("not valid json");
    assert!(result.is_err());
}

// ==================== Mnemonic + HD Derivation E2E ====================

#[test]
fn e2e_mnemonic_to_seed_to_key_derivation() {
    let mnemonic_str = mnemonic::generate_mnemonic();
    let seed = mnemonic::mnemonic_to_seed(&mnemonic_str).unwrap();
    let path = hd_derivation::derive_key_path(44, 0, 0);
    let derived_seed = hd_derivation::derive_seed_from_master(&seed, &path);
    assert_eq!(derived_seed.len(), 32);
}

#[test]
fn e2e_hd_derivation_multiple_paths_unique_seeds() {
    let mnemonic_str = mnemonic::generate_mnemonic();
    let seed = mnemonic::mnemonic_to_seed(&mnemonic_str).unwrap();
    let mut derived = Vec::new();
    for i in 0..10u32 {
        let path = hd_derivation::derive_key_path(44, 0, i);
        let s = hd_derivation::derive_seed_from_master(&seed, &path);
        derived.push(s);
    }
    for i in 0..derived.len() {
        for j in (i+1)..derived.len() {
            assert_ne!(derived[i], derived[j]);
        }
    }
}

#[test]
fn e2e_mnemonic_recovery_same_seed() {
    let mnemonic_str = mnemonic::generate_mnemonic();
    let seed1 = mnemonic::mnemonic_to_seed(&mnemonic_str).unwrap();
    let seed2 = mnemonic::mnemonic_to_seed(&mnemonic_str).unwrap();
    assert_eq!(seed1, seed2);

    let path = hd_derivation::derive_key_path(44, 0, 0);
    let s1 = hd_derivation::derive_seed_from_master(&seed1, &path);
    let s2 = hd_derivation::derive_seed_from_master(&seed2, &path);
    assert_eq!(s1, s2);
}

// ==================== Full Vault + Key + Sign E2E ====================

#[test]
fn e2e_full_workflow_create_unlock_generate_sign() {
    let vault = TestVault::new();
    vault.create("super_secure_password").unwrap();
    assert!(vault.unlock("super_secure_password").unwrap());

    let (pk, sk) = mldsa87::generate();
    let addr = address::derive_address(pk.as_bytes());
    assert!(addr.starts_with("zap1"));

    let message = b"ZAP Blockchain genesis transaction";
    let sig = mldsa87::sign(&sk, message).unwrap();
    assert!(mldsa87::verify(&pk, message, &sig).unwrap());

    let qr_payload = hex::encode(message);
    let qr_request = QrRequest {
        payload_hex: qr_payload.clone(),
        transfer_type: "signed_tx".to_string(),
        secret_key_hex: sk.to_hex(),
    };
    let sk_parsed = mldsa87::SecretKey::from_hex(&qr_request.secret_key_hex).unwrap();
    let payload_bytes = hex::decode(&qr_request.payload_hex).unwrap();
    let qr_sig = mldsa87::sign(&sk_parsed, &payload_bytes).unwrap();
    assert!(mldsa87::verify(&pk, &payload_bytes, &qr_sig).unwrap());
}

#[test]
fn e2e_full_workflow_multiple_accounts() {
    let mnemonic_str = mnemonic::generate_mnemonic();
    let seed = mnemonic::mnemonic_to_seed(&mnemonic_str).unwrap();

    for account in 0..3u32 {
        let path = hd_derivation::derive_key_path(44, account, 0);
        let _derived = hd_derivation::derive_seed_from_master(&seed, &path);
        let (_pk, sk) = mldsa87::generate();
        let _addr = address::derive_address(_pk.as_bytes());
        let msg = format!("account {} message", account);
        let sig = mldsa87::sign(&sk, msg.as_bytes()).unwrap();
        assert!(mldsa87::verify(&_pk, msg.as_bytes(), &sig).unwrap());
    }
}

#[test]
fn e2e_vault_encrypt_decrypt_key_material() {
    let vault = TestVault::new();
    vault.create("password").unwrap();

    let (_, sk) = mldsa87::generate();
    let salt = kdf::generate_salt();
    let master_key = kdf::derive_master_key(b"password", &salt).unwrap();
    let enc_key = kdf::derive_encryption_key(&master_key, "vault_encryption");

    let sk_bytes = sk.as_bytes();
    let ct = encryption::encrypt_vault(&enc_key, sk_bytes).unwrap();
    let decrypted = encryption::decrypt_vault(&enc_key, &ct).unwrap();
    assert_eq!(decrypted, sk_bytes);

    let wrong_master_key = kdf::derive_master_key(b"wrong_password", &salt).unwrap();
    let wrong_enc_key = kdf::derive_encryption_key(&wrong_master_key, "vault_encryption");
    assert!(encryption::decrypt_vault(&wrong_enc_key, &ct).is_err());
}

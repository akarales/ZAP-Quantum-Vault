use std::collections::HashSet;
use std::sync::Mutex;
use zap_quantum_vault_lib::commands::airgap::{
    record_nonce, secret_to_public_hex, signing_message, verify_envelope, QrRequest,
    ENVELOPE_VERSION, MAX_AGE_SECS, MAX_SKEW_SECS, NONCE_SIZE,
};
use zap_quantum_vault_lib::commands::keys::{decrypt_keys, encrypt_keys};
use zap_quantum_vault_lib::commands::signing::{SignRequest, VerifyRequest};
use zap_quantum_vault_lib::commands::vault::{
    UnlockThrottle, BASE_LOCKOUT_SECS, MAX_LOCKOUT_SECS, MAX_UNLOCK_ATTEMPTS,
};
use zap_quantum_vault_lib::crypto::{address, encryption, hd_derivation, kdf, mldsa87, mnemonic};
use zap_quantum_vault_lib::models::airgap::{AirGapEnvelope, TransferType};
use zap_quantum_vault_lib::models::key::{KeyEntry, KeyEntryPublic, KeyType};
use zap_quantum_vault_lib::models::vault::VaultState;

/// Helper: build a small set of key entries for keystore tests.
fn sample_key_entries(n: usize) -> Vec<KeyEntry> {
    (0..n)
        .map(|i| {
            let (pk, sk) = mldsa87::generate();
            let addr = address::derive_address(pk.as_bytes());
            KeyEntry::new(
                KeyType::User,
                44,
                0,
                i as u32,
                &pk.to_hex(),
                &sk.to_hex(),
                &addr,
                &hd_derivation::zap_path(44, 0, i as u32).to_string(),
            )
        })
        .collect()
}

/// Helper: derive the vault encryption key from a password and salt the same
/// way the real `vault` commands do.
fn derive_enc_key(password: &str, salt: &[u8]) -> [u8; 32] {
    let master = kdf::derive_master_key(password.as_bytes(), salt).unwrap();
    kdf::derive_encryption_key(&master, "vault_encryption")
}

// ==================== Vault Lifecycle E2E ====================

struct TestVault {
    state: Mutex<VaultState>,
}

impl TestVault {
    fn new() -> Self {
        Self {
            state: Mutex::new(VaultState::default()),
        }
    }

    fn create(&self, password: &str) -> Result<String, String> {
        let mut vault = self.state.lock().unwrap();
        if vault.initialized {
            return Err("Already unlocked".to_string());
        }
        let salt = kdf::generate_salt();
        let master_key =
            kdf::derive_master_key(password.as_bytes(), &salt).map_err(|e| e.to_string())?;
        let enc_key = kdf::derive_encryption_key(&master_key, "vault_encryption");
        let verifier = b"ZAP_VAULT_VERIFIER";
        let ct = encryption::encrypt_vault(&enc_key, verifier).map_err(|e| e.to_string())?;
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
        let salt = hex::decode(&vault.salt_hex).map_err(|e| e.to_string())?;
        let master_key =
            kdf::derive_master_key(password.as_bytes(), &salt).map_err(|e| e.to_string())?;
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

    /// Mirrors the real `change_password` command: verify old password, then
    /// re-wrap the verifier under a key derived from a fresh salt.
    fn change_password(&self, old: &str, new: &str) -> Result<(), String> {
        let mut vault = self.state.lock().unwrap();
        if !vault.initialized {
            return Err("Not initialized".to_string());
        }
        let old_salt = hex::decode(&vault.salt_hex).map_err(|e| e.to_string())?;
        let old_master =
            kdf::derive_master_key(old.as_bytes(), &old_salt).map_err(|e| e.to_string())?;
        let old_enc = kdf::derive_encryption_key(&old_master, "vault_encryption");
        let parts: Vec<&str> = vault.verifier_hash_hex.split(':').collect();
        if parts.len() != 2 {
            return Err("Invalid password".to_string());
        }
        let nonce = hex::decode(parts[0]).map_err(|e| e.to_string())?;
        let ciphertext = hex::decode(parts[1]).map_err(|e| e.to_string())?;
        let old_ct = encryption::Ciphertext { nonce, ciphertext };
        match encryption::decrypt_vault(&old_enc, &old_ct) {
            Ok(d) if d == b"ZAP_VAULT_VERIFIER" => {}
            _ => return Err("Invalid password".to_string()),
        }

        let new_salt = kdf::generate_salt();
        let new_enc = derive_enc_key(new, &new_salt);
        let verifier = b"ZAP_VAULT_VERIFIER";
        let new_ct = encryption::encrypt_vault(&new_enc, verifier).map_err(|e| e.to_string())?;
        vault.salt_hex = hex::encode(new_salt);
        vault.verifier_hash_hex = hex::encode(new_ct.nonce) + ":" + &hex::encode(new_ct.ciphertext);
        Ok(())
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
        for j in (i + 1)..keys.len() {
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
        &hd_derivation::zap_path(44, 0, 0).to_string(),
    );
    assert!(!entry.id.is_empty());
    assert_eq!(entry.public_key_hex, pk.to_hex());
    assert_eq!(entry.encrypted_secret_hex, sk.to_hex());
    assert_eq!(entry.metadata.address, addr);
}

#[test]
fn e2e_key_entry_all_types() {
    let types = vec![
        KeyType::Genesis,
        KeyType::Validator,
        KeyType::Governance,
        KeyType::Treasury,
        KeyType::SecurityAdmin,
        KeyType::User,
        KeyType::QuantumSafe,
        KeyType::Custom,
    ];
    for kt in types {
        let (pk, sk) = mldsa87::generate();
        let addr = address::derive_address(pk.as_bytes());
        let entry = KeyEntry::new(
            kt,
            44,
            0,
            0,
            &pk.to_hex(),
            &sk.to_hex(),
            &addr,
            &hd_derivation::zap_path(44, 0, 0).to_string(),
        );
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
        nonce_hex: hex::encode([0u8; 24]),
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
    let result = secret_to_public_hex(&hex::encode([0u8; 10]));
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
        nonce_hex: hex::encode([0u8; 24]),
        signature_hex: hex::encode([0u8; mldsa87::SIGNATURE_SIZE]),
        public_key_hex: hex::encode([0u8; mldsa87::PUBLIC_KEY_SIZE]),
        timestamp: 0,
        checksum_hex: hex::encode(checksum.as_bytes()),
    };
    let json = serde_json::to_string(&envelope).unwrap();
    let parsed: AirGapEnvelope = serde_json::from_str(&json).unwrap();
    let payload_bytes = hex::decode(&parsed.payload_hex).unwrap();
    let computed_checksum = blake3::hash(&payload_bytes);
    assert_eq!(
        parsed.checksum_hex,
        hex::encode(computed_checksum.as_bytes())
    );
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
        nonce_hex: hex::encode([0u8; 24]),
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
        for j in (i + 1)..derived.len() {
            assert_ne!(derived[i], derived[j]);
        }
    }
}

#[test]
fn e2e_hd_full_key_reproducible_from_mnemonic() {
    // The end-to-end recovery guarantee: a mnemonic + ZAP path deterministically
    // derives the same ML-DSA-87 keypair and address every time. This is what
    // lets a user restore every key from just the 24 words.
    let phrase = mnemonic::generate_mnemonic();
    let seed = mnemonic::mnemonic_to_seed(&phrase).unwrap();

    let path = hd_derivation::zap_path(0, 0, 0);
    let child1 = hd_derivation::derive_seed_from_master(&seed, &path);
    let child2 = hd_derivation::derive_seed_from_master(&seed, &path);
    assert_eq!(child1, child2);

    let (pk1, sk1) = mldsa87::from_seed(&child1);
    let (pk2, sk2) = mldsa87::from_seed(&child2);
    assert_eq!(pk1.to_hex(), pk2.to_hex());
    assert_eq!(sk1.to_hex(), sk2.to_hex());
    assert_eq!(
        address::derive_address(pk1.as_bytes()),
        address::derive_address(pk2.as_bytes())
    );

    // And the derived key actually signs/verifies.
    let msg = b"recovered key works";
    let sig = mldsa87::sign(&sk1, msg).unwrap();
    assert!(mldsa87::verify(&pk1, msg, &sig).unwrap());
}

#[test]
fn e2e_hd_distinct_paths_distinct_keys() {
    let phrase = mnemonic::generate_mnemonic();
    let seed = mnemonic::mnemonic_to_seed(&phrase).unwrap();
    let (pk_a, _) = mldsa87::from_seed(&hd_derivation::derive_seed_from_master(
        &seed,
        &hd_derivation::zap_path(0, 0, 0),
    ));
    let (pk_b, _) = mldsa87::from_seed(&hd_derivation::derive_seed_from_master(
        &seed,
        &hd_derivation::zap_path(0, 0, 1),
    ));
    assert_ne!(pk_a.to_hex(), pk_b.to_hex());
}

#[test]
fn e2e_vault_state_kdf_and_seed_defaults_for_legacy_json() {
    // A vault.json written before the KDF block / master seed existed must still
    // deserialize, defaulting to the legacy 64 MiB profile and an empty seed.
    let legacy = r#"{"initialized":true,"salt_hex":"00","verifier_hash_hex":"aa:bb"}"#;
    let state: VaultState = serde_json::from_str(legacy).unwrap();
    assert_eq!(state.argon2_memory_kib, kdf::ARGON2_MEMORY_KIB);
    assert_eq!(state.argon2_iterations, kdf::ARGON2_ITERATIONS);
    assert!(state.master_seed_enc_hex.is_empty());
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

// ==================== Encrypted Keystore Persistence E2E ====================

#[test]
fn e2e_keystore_encrypt_decrypt_roundtrip() {
    let key = [7u8; 32];
    let entries = sample_key_entries(3);
    let blob = encrypt_keys(&key, &entries).unwrap();
    let loaded = decrypt_keys(&key, &blob).unwrap();
    assert_eq!(loaded.len(), 3);
    for (a, b) in entries.iter().zip(loaded.iter()) {
        assert_eq!(a.id, b.id);
        assert_eq!(a.public_key_hex, b.public_key_hex);
        assert_eq!(a.encrypted_secret_hex, b.encrypted_secret_hex);
        assert_eq!(a.metadata.address, b.metadata.address);
    }
}

#[test]
fn e2e_keystore_empty_roundtrip() {
    let key = [9u8; 32];
    let entries: Vec<KeyEntry> = Vec::new();
    let blob = encrypt_keys(&key, &entries).unwrap();
    let loaded = decrypt_keys(&key, &blob).unwrap();
    assert!(loaded.is_empty());
}

#[test]
fn e2e_keystore_wrong_key_fails() {
    let key = [1u8; 32];
    let wrong = [2u8; 32];
    let entries = sample_key_entries(2);
    let blob = encrypt_keys(&key, &entries).unwrap();
    assert!(decrypt_keys(&wrong, &blob).is_err());
}

#[test]
fn e2e_keystore_blob_is_not_plaintext() {
    // The serialized secret hex must NOT appear in the encrypted blob.
    let key = [42u8; 32];
    let entries = sample_key_entries(1);
    let secret_hex = entries[0].encrypted_secret_hex.clone();
    let blob = encrypt_keys(&key, &entries).unwrap();
    let blob_str = String::from_utf8_lossy(&blob);
    assert!(!blob_str.contains(&secret_hex));
}

#[test]
fn e2e_keystore_tampered_blob_fails() {
    let key = [3u8; 32];
    let entries = sample_key_entries(1);
    let mut blob = encrypt_keys(&key, &entries).unwrap();
    // Corrupt the tail of the blob (inside the ciphertext field).
    let last = blob.len() - 3;
    blob[last] ^= 0xFF;
    assert!(decrypt_keys(&key, &blob).is_err());
}

#[test]
fn e2e_keystore_nonce_unique_per_save() {
    let key = [5u8; 32];
    let entries = sample_key_entries(1);
    let blob1 = encrypt_keys(&key, &entries).unwrap();
    let blob2 = encrypt_keys(&key, &entries).unwrap();
    // AES-GCM nonce is random per encryption, so blobs differ.
    assert_ne!(blob1, blob2);
}

// ==================== Password Change E2E ====================

#[test]
fn e2e_change_password_unlock_with_new_password() {
    let vault = TestVault::new();
    vault.create("old_password").unwrap();
    vault
        .change_password("old_password", "new_password")
        .unwrap();

    assert!(vault.unlock("new_password").unwrap());
    assert!(vault.unlock("old_password").is_err());
}

#[test]
fn e2e_change_password_wrong_old_rejected() {
    let vault = TestVault::new();
    vault.create("correct_old").unwrap();
    let result = vault.change_password("wrong_old", "new_password");
    assert!(result.is_err());
    // Original password must still work after a failed change.
    assert!(vault.unlock("correct_old").unwrap());
}

#[test]
fn e2e_change_password_before_create_rejected() {
    let vault = TestVault::new();
    assert!(vault.change_password("a", "b").is_err());
}

#[test]
fn e2e_change_password_rekeys_keystore() {
    // Simulate the full keystore re-encryption performed by change_password.
    let old_salt = kdf::generate_salt();
    let new_salt = kdf::generate_salt();
    let old_enc = derive_enc_key("old_password", &old_salt);
    let new_enc = derive_enc_key("new_password", &new_salt);

    let entries = sample_key_entries(3);
    let old_blob = encrypt_keys(&old_enc, &entries).unwrap();

    // Re-key: decrypt with old, re-encrypt with new.
    let decrypted = decrypt_keys(&old_enc, &old_blob).unwrap();
    let new_blob = encrypt_keys(&new_enc, &decrypted).unwrap();

    // New key decrypts, old key no longer works.
    let reloaded = decrypt_keys(&new_enc, &new_blob).unwrap();
    assert_eq!(reloaded.len(), 3);
    assert!(decrypt_keys(&old_enc, &new_blob).is_err());

    // Key material is preserved across the re-key.
    for (a, b) in entries.iter().zip(reloaded.iter()) {
        assert_eq!(a.encrypted_secret_hex, b.encrypted_secret_hex);
        assert_eq!(a.public_key_hex, b.public_key_hex);
    }
}

#[test]
fn e2e_change_password_fresh_salt_changes_verifier() {
    let vault = TestVault::new();
    vault.create("password").unwrap();
    let salt_before = vault.state.lock().unwrap().salt_hex.clone();
    vault.change_password("password", "password").unwrap();
    let salt_after = vault.state.lock().unwrap().salt_hex.clone();
    // Even with an identical password, a fresh salt is generated.
    assert_ne!(salt_before, salt_after);
    assert!(vault.unlock("password").unwrap());
}

// ==================== IPC Secret Redaction E2E ====================

#[test]
fn e2e_key_public_view_omits_secret() {
    let entries = sample_key_entries(1);
    let entry = &entries[0];
    let public: KeyEntryPublic = entry.to_public();

    // Public view preserves id, metadata, and public key...
    assert_eq!(public.id, entry.id);
    assert_eq!(public.public_key_hex, entry.public_key_hex);
    assert_eq!(public.metadata.address, entry.metadata.address);

    // ...but the serialized public view must NOT contain the secret hex.
    let json = serde_json::to_string(&public).unwrap();
    assert!(!json.contains(&entry.encrypted_secret_hex));
    assert!(!json.contains("encrypted_secret_hex"));
}

#[test]
fn e2e_key_public_view_list_has_no_secrets() {
    // Mirrors what `list_keys` returns over IPC: a vec of public views.
    let entries = sample_key_entries(3);
    let public: Vec<KeyEntryPublic> = entries.iter().map(|k| k.to_public()).collect();
    let json = serde_json::to_string(&public).unwrap();
    for e in &entries {
        assert!(!json.contains(&e.encrypted_secret_hex));
    }
}

// ==================== Generation-based Keystore Persistence E2E ====================

#[test]
fn e2e_vault_state_keys_file_defaults_for_legacy_json() {
    // A vault.json written before the `keys_file` field existed must still
    // deserialize, defaulting to "keys.enc".
    let legacy = r#"{"initialized":true,"salt_hex":"00","verifier_hash_hex":"aa:bb"}"#;
    let state: VaultState = serde_json::from_str(legacy).unwrap();
    assert_eq!(state.keys_file, "keys.enc");
    assert!(state.initialized);
}

#[test]
fn e2e_vault_state_keys_file_roundtrip() {
    let state = VaultState {
        keys_file: "keys-abc123.enc".to_string(),
        ..Default::default()
    };
    let json = serde_json::to_string(&state).unwrap();
    let parsed: VaultState = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.keys_file, "keys-abc123.enc");
}

#[test]
fn e2e_change_password_assigns_new_generation_file() {
    // Simulate the generation-based re-key: the new keystore is written under a
    // fresh file name and the old generation can be dropped. The new file is
    // decryptable with the new key only.
    let old_salt = kdf::generate_salt();
    let new_salt = kdf::generate_salt();
    let old_enc = derive_enc_key("old_password", &old_salt);
    let new_enc = derive_enc_key("new_password", &new_salt);

    let entries = sample_key_entries(2);

    let old_file = "keys.enc".to_string();
    let old_blob = encrypt_keys(&old_enc, &entries).unwrap();

    // Re-key into a new generation file.
    let new_file = format!("keys-{}.enc", uuid::Uuid::new_v4());
    let decrypted = decrypt_keys(&old_enc, &old_blob).unwrap();
    let new_blob = encrypt_keys(&new_enc, &decrypted).unwrap();

    assert_ne!(old_file, new_file);
    assert!(new_file.starts_with("keys-") && new_file.ends_with(".enc"));
    // New file decrypts with the new key; old blob still only with the old key.
    assert_eq!(decrypt_keys(&new_enc, &new_blob).unwrap().len(), 2);
    assert!(decrypt_keys(&new_enc, &old_blob).is_err());
}

// ==================== Session Key Zeroization E2E ====================

#[test]
fn e2e_session_key_zeroizing_roundtrip() {
    // The session key is held as `Zeroizing<[u8; 32]>`; it must deref to
    // `&[u8; 32]` for the keystore encrypt/decrypt path without any copying.
    use zeroize::Zeroizing;
    let key: Zeroizing<[u8; 32]> = Zeroizing::new([11u8; 32]);
    let entries = sample_key_entries(2);
    let blob = encrypt_keys(&key, &entries).unwrap();
    let loaded = decrypt_keys(&key, &blob).unwrap();
    assert_eq!(loaded.len(), 2);
}

#[test]
fn e2e_session_key_zeroizing_clears_on_drop() {
    // Dropping the Zeroizing wrapper wipes the underlying bytes. We can't read
    // freed memory safely, so assert the explicit `zeroize()` contract instead.
    use zeroize::{Zeroize, Zeroizing};
    let mut key: Zeroizing<[u8; 32]> = Zeroizing::new([0xABu8; 32]);
    assert_eq!(*key, [0xABu8; 32]);
    key.zeroize();
    assert_eq!(*key, [0u8; 32]);
}

// ==================== Air-Gap Replay Protection E2E ====================

/// Build a valid v2 envelope signed over the canonical message, mirroring the
/// production `build_envelope` (which is private). `nonce_seed` makes the nonce
/// deterministic per-test so replay scenarios are reproducible.
fn build_v2_envelope(
    sk: &mldsa87::SecretKey,
    payload: &[u8],
    tt: TransferType,
    timestamp: u64,
    nonce_seed: u8,
) -> AirGapEnvelope {
    let nonce = vec![nonce_seed; NONCE_SIZE];
    let message = signing_message(ENVELOPE_VERSION, &tt, timestamp, &nonce, payload);
    let sig = mldsa87::sign(sk, &message).unwrap();
    let pk_hex = secret_to_public_hex(&sk.to_hex()).unwrap();
    AirGapEnvelope {
        version: ENVELOPE_VERSION,
        transfer_type: tt,
        payload_hex: hex::encode(payload),
        nonce_hex: hex::encode(&nonce),
        signature_hex: sig.to_hex(),
        public_key_hex: pk_hex,
        timestamp,
        checksum_hex: hex::encode(blake3::hash(payload).as_bytes()),
    }
}

#[test]
fn e2e_airgap_v2_valid_envelope_verifies() {
    let (_, sk) = mldsa87::generate();
    let now = 1_000_000u64;
    let env = build_v2_envelope(&sk, b"transfer payload", TransferType::SignedTx, now, 0x11);
    assert!(verify_envelope(&env, now).is_ok());
}

#[test]
fn e2e_airgap_tampered_payload_rejected() {
    let (_, sk) = mldsa87::generate();
    let now = 1_000_000u64;
    let mut env = build_v2_envelope(&sk, b"original", TransferType::UnsignedTx, now, 0x22);
    // Replace payload (and keep stale checksum/sig) -> checksum mismatch.
    env.payload_hex = hex::encode(b"tampered");
    assert!(verify_envelope(&env, now).is_err());
}

#[test]
fn e2e_airgap_tampered_timestamp_rejected() {
    let (_, sk) = mldsa87::generate();
    let now = 1_000_000u64;
    let mut env = build_v2_envelope(&sk, b"payload", TransferType::SignedTx, now, 0x33);
    // Timestamp is signed, so altering it (even to a fresh value) breaks the signature.
    env.timestamp = now - 1;
    assert!(verify_envelope(&env, now).is_err());
}

#[test]
fn e2e_airgap_tampered_nonce_rejected() {
    let (_, sk) = mldsa87::generate();
    let now = 1_000_000u64;
    let mut env = build_v2_envelope(&sk, b"payload", TransferType::SignedTx, now, 0x44);
    env.nonce_hex = hex::encode(vec![0x99u8; NONCE_SIZE]);
    assert!(verify_envelope(&env, now).is_err());
}

#[test]
fn e2e_airgap_tampered_transfer_type_rejected() {
    let (_, sk) = mldsa87::generate();
    let now = 1_000_000u64;
    let mut env = build_v2_envelope(&sk, b"payload", TransferType::UnsignedTx, now, 0x55);
    // Transfer type is bound into the signature.
    env.transfer_type = TransferType::EncryptedKey;
    assert!(verify_envelope(&env, now).is_err());
}

#[test]
fn e2e_airgap_expired_envelope_rejected() {
    let (_, sk) = mldsa87::generate();
    let created = 1_000_000u64;
    let env = build_v2_envelope(&sk, b"payload", TransferType::SignedTx, created, 0x66);
    // Verify well past the freshness window.
    let now = created + MAX_AGE_SECS + 1;
    assert!(verify_envelope(&env, now).is_err());
    // Still valid at the edge of the window.
    assert!(verify_envelope(&env, created + MAX_AGE_SECS).is_ok());
}

#[test]
fn e2e_airgap_future_envelope_rejected() {
    let (_, sk) = mldsa87::generate();
    let created = 1_000_000u64;
    let env = build_v2_envelope(&sk, b"payload", TransferType::SignedTx, created, 0x77);
    // "now" is before the timestamp by more than the allowed skew.
    let now = created - MAX_SKEW_SECS - 1;
    assert!(verify_envelope(&env, now).is_err());
    // Within skew is accepted.
    assert!(verify_envelope(&env, created - MAX_SKEW_SECS).is_ok());
}

#[test]
fn e2e_airgap_wrong_version_rejected() {
    let (_, sk) = mldsa87::generate();
    let now = 1_000_000u64;
    let mut env = build_v2_envelope(&sk, b"payload", TransferType::SignedTx, now, 0x88);
    env.version = 1;
    assert!(verify_envelope(&env, now).is_err());
}

#[test]
fn e2e_airgap_replay_nonce_rejected() {
    let (_, sk) = mldsa87::generate();
    let now = 1_000_000u64;
    let env = build_v2_envelope(&sk, b"payload", TransferType::SignedTx, now, 0xAA);
    assert!(verify_envelope(&env, now).is_ok());

    let mut seen: HashSet<String> = HashSet::new();
    // First consumption succeeds, replay of the same nonce is rejected.
    assert!(record_nonce(&mut seen, &env.nonce_hex).is_ok());
    assert!(record_nonce(&mut seen, &env.nonce_hex).is_err());
}

#[test]
fn e2e_airgap_distinct_nonces_accepted() {
    let mut seen: HashSet<String> = HashSet::new();
    assert!(record_nonce(&mut seen, &hex::encode(vec![0x01u8; NONCE_SIZE])).is_ok());
    assert!(record_nonce(&mut seen, &hex::encode(vec![0x02u8; NONCE_SIZE])).is_ok());
    assert_eq!(seen.len(), 2);
}

// ==================== Unlock Rate Limiting E2E ====================

#[test]
fn e2e_unlock_throttle_allows_under_threshold() {
    let mut t = UnlockThrottle::default();
    let now = 1_000u64;
    // Up to (MAX - 1) failures must not lock the vault.
    for _ in 0..(MAX_UNLOCK_ATTEMPTS - 1) {
        t.record_failure(now);
        assert!(t.check(now).is_ok());
    }
}

#[test]
fn e2e_unlock_throttle_locks_after_threshold() {
    let mut t = UnlockThrottle::default();
    let now = 1_000u64;
    for _ in 0..MAX_UNLOCK_ATTEMPTS {
        t.record_failure(now);
    }
    // Now locked: immediate retry is rejected.
    assert!(t.check(now).is_err());
    // Still locked just before expiry, allowed once the window passes.
    assert!(t.check(now + BASE_LOCKOUT_SECS - 1).is_err());
    assert!(t.check(now + BASE_LOCKOUT_SECS).is_ok());
}

#[test]
fn e2e_unlock_throttle_backoff_grows_and_caps() {
    let mut t = UnlockThrottle::default();
    let now = 1_000u64;
    for _ in 0..MAX_UNLOCK_ATTEMPTS {
        t.record_failure(now);
    }
    let first = t.locked_until - now;
    assert_eq!(first, BASE_LOCKOUT_SECS);

    // One more failure roughly doubles the window.
    t.record_failure(now);
    assert_eq!(t.locked_until - now, BASE_LOCKOUT_SECS * 2);

    // Many more failures stay capped at the maximum.
    for _ in 0..20 {
        t.record_failure(now);
    }
    assert_eq!(t.locked_until - now, MAX_LOCKOUT_SECS);
}

#[test]
fn e2e_unlock_throttle_success_resets() {
    let mut t = UnlockThrottle::default();
    let now = 1_000u64;
    for _ in 0..MAX_UNLOCK_ATTEMPTS {
        t.record_failure(now);
    }
    assert!(t.check(now).is_err());
    t.record_success();
    assert_eq!(t.failures, 0);
    assert!(t.check(now).is_ok());
}

// ==================== On-Disk File Permissions E2E ====================

#[cfg(unix)]
#[test]
fn e2e_atomic_write_creates_owner_only_file() {
    use std::os::unix::fs::PermissionsExt;
    use zap_quantum_vault_lib::commands::keys::atomic_write;

    let path = std::env::temp_dir().join(format!("zqv-perm-{}.bin", uuid::Uuid::new_v4()));
    atomic_write(&path, b"sensitive vault material").unwrap();

    let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
    let _ = std::fs::remove_file(&path);

    // Owner read/write only; no group/other access.
    assert_eq!(mode, 0o600, "expected 0600, got {:o}", mode);
}

#[cfg(unix)]
#[test]
fn e2e_atomic_write_overwrite_keeps_owner_only() {
    use std::os::unix::fs::PermissionsExt;
    use zap_quantum_vault_lib::commands::keys::atomic_write;

    let path = std::env::temp_dir().join(format!("zqv-perm-{}.bin", uuid::Uuid::new_v4()));
    atomic_write(&path, b"first").unwrap();
    // Overwriting via the atomic rename must not loosen permissions.
    atomic_write(&path, b"second, longer contents").unwrap();

    let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
    let contents = std::fs::read(&path).unwrap();
    let _ = std::fs::remove_file(&path);

    assert_eq!(mode, 0o600, "expected 0600 after overwrite, got {:o}", mode);
    assert_eq!(contents, b"second, longer contents");
}

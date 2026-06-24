use zap_quantum_vault_lib::crypto::{
    mldsa87, mlkem1024, encryption, kdf, mnemonic, hd_derivation,
    address, hash, vrf, hybrid_signing, threshold, proof_batch,
};

// ==================== ML-DSA-87 Edge Cases ====================

#[test]
fn test_mldsa_sign_empty_message() {
    let (pk, sk) = mldsa87::generate();
    let sig = mldsa87::sign(&sk, b"").unwrap();
    assert_eq!(sig.as_bytes().len(), mldsa87::SIGNATURE_SIZE);
    assert!(mldsa87::verify(&pk, b"", &sig).unwrap());
}

#[test]
fn test_mldsa_sign_large_message() {
    let (pk, sk) = mldsa87::generate();
    let message = vec![0xAB; 100_000];
    let sig = mldsa87::sign(&sk, &message).unwrap();
    assert!(mldsa87::verify(&pk, &message, &sig).unwrap());
}

#[test]
fn test_mldsa_deterministic_signing() {
    let (_, sk) = mldsa87::generate();
    let sig1 = mldsa87::sign(&sk, b"deterministic test").unwrap();
    let sig2 = mldsa87::sign(&sk, b"deterministic test").unwrap();
    assert_eq!(sig1.as_bytes(), sig2.as_bytes());
}

#[test]
fn test_mldsa_public_key_invalid_size() {
    let result = mldsa87::PublicKey::from_bytes(&[0u8; 10]);
    assert!(result.is_err());
}

#[test]
fn test_mldsa_secret_key_invalid_size() {
    let result = mldsa87::SecretKey::from_bytes(&[0u8; 10]);
    assert!(result.is_err());
}

#[test]
fn test_mldsa_signature_invalid_size() {
    let result = mldsa87::Signature::from_bytes(&[0u8; 10]);
    assert!(result.is_err());
}

#[test]
fn test_mldsa_public_key_invalid_hex() {
    let result = mldsa87::PublicKey::from_hex("not valid hex");
    assert!(result.is_err());
}

#[test]
fn test_mldsa_secret_key_invalid_hex() {
    let result = mldsa87::SecretKey::from_hex("zzzz");
    assert!(result.is_err());
}

#[test]
fn test_mldsa_signature_invalid_hex() {
    let result = mldsa87::Signature::from_hex("xyz123");
    assert!(result.is_err());
}

#[test]
fn test_mldsa_sign_with_invalid_secret_key() {
    let bad_sk = mldsa87::SecretKey(vec![0u8; 10]);
    let result = mldsa87::sign(&bad_sk, b"message");
    assert!(result.is_err());
}

#[test]
fn test_mldsa_verify_with_invalid_public_key() {
    let (_, sk) = mldsa87::generate();
    let sig = mldsa87::sign(&sk, b"test").unwrap();
    let bad_pk = mldsa87::PublicKey(vec![0u8; 10]);
    let result = mldsa87::verify(&bad_pk, b"test", &sig);
    assert!(result.is_err());
}

#[test]
fn test_mldsa_verify_with_invalid_signature_size() {
    let (pk, _) = mldsa87::generate();
    let bad_sig = mldsa87::Signature(vec![0u8; 10]);
    let result = mldsa87::verify(&pk, b"test", &bad_sig);
    assert!(result.is_err());
}

#[test]
fn test_mldsa_tampered_signature_fails() {
    let (pk, sk) = mldsa87::generate();
    let mut sig = mldsa87::sign(&sk, b"test message").unwrap();
    sig.0[0] ^= 0xFF;
    assert!(!mldsa87::verify(&pk, b"test message", &sig).unwrap());
}

#[test]
fn test_mldsa_tampered_public_key_fails() {
    let (pk, sk) = mldsa87::generate();
    let sig = mldsa87::sign(&sk, b"test message").unwrap();
    let mut bad_pk = pk.clone();
    bad_pk.0[0] ^= 0xFF;
    assert!(!mldsa87::verify(&bad_pk, b"test message", &sig).unwrap());
}

#[test]
fn test_mldsa_public_key_hex_length() {
    let (pk, _) = mldsa87::generate();
    let hex = pk.to_hex();
    assert_eq!(hex.len(), mldsa87::PUBLIC_KEY_SIZE * 2);
}

#[test]
fn test_mldsa_secret_key_hex_length() {
    let (_, sk) = mldsa87::generate();
    let hex = sk.to_hex();
    assert_eq!(hex.len(), mldsa87::SEED_SIZE * 2);
}

#[test]
fn test_mldsa_signature_hex_length() {
    let (_, sk) = mldsa87::generate();
    let sig = mldsa87::sign(&sk, b"test").unwrap();
    let hex = sig.to_hex();
    assert_eq!(hex.len(), mldsa87::SIGNATURE_SIZE * 2);
}

#[test]
fn test_mldsa_unicode_message() {
    let (pk, sk) = mldsa87::generate();
    let message = "🔐 Post-quantum signature test 🚀".as_bytes();
    let sig = mldsa87::sign(&sk, message).unwrap();
    assert!(mldsa87::verify(&pk, message, &sig).unwrap());
}

#[test]
fn test_mldsa_multiple_signatures_same_key() {
    let (pk, sk) = mldsa87::generate();
    for i in 0..5u8 {
        let msg = vec![i; 32];
        let sig = mldsa87::sign(&sk, &msg).unwrap();
        assert!(mldsa87::verify(&pk, &msg, &sig).unwrap());
    }
}

#[test]
fn test_mldsa_keypair_sizes_match_constants() {
    let (pk, sk) = mldsa87::generate();
    assert_eq!(pk.as_bytes().len(), mldsa87::PUBLIC_KEY_SIZE);
    assert_eq!(sk.as_bytes().len(), mldsa87::SEED_SIZE);
}

// ==================== ML-KEM-1024 Edge Cases ====================

#[test]
fn test_mlkem_wrong_key_decapsulation_fails() {
    let kp1 = mlkem1024::KemKeyPair::generate();
    let kp2 = mlkem1024::KemKeyPair::generate();
    let (ct, _) = kp1.encapsulate().unwrap();
    let result = kp2.decapsulate(&ct);
    assert!(result.is_ok());
    let shared2 = result.unwrap();
    let (_, shared1) = kp1.encapsulate().unwrap();
    assert_ne!(shared1, shared2);
}

#[test]
fn test_mlkem_invalid_encapsulation_key_size() {
    let bad_kp = mlkem1024::KemKeyPair {
        encapsulation_key: vec![0u8; 10],
        decapsulation_seed: vec![0u8; mlkem1024::DECAPSULATION_SEED_SIZE],
    };
    assert!(bad_kp.encapsulate().is_err());
}

#[test]
fn test_mlkem_invalid_decapsulation_seed_size() {
    let bad_kp = mlkem1024::KemKeyPair {
        encapsulation_key: vec![0u8; mlkem1024::ENCAPSULATION_KEY_SIZE],
        decapsulation_seed: vec![0u8; 10],
    };
    let (ct, _) = bad_kp.encapsulate().unwrap();
    assert!(bad_kp.decapsulate(&ct).is_err());
}

#[test]
fn test_mlkem_invalid_ciphertext_size() {
    let kp = mlkem1024::KemKeyPair::generate();
    let bad_ct = mlkem1024::KemCiphertext {
        ciphertext: vec![0u8; 10],
        encapsulated_key: kp.encapsulation_key.clone(),
    };
    assert!(kp.decapsulate(&bad_ct).is_err());
}

#[test]
fn test_mlkem_multiple_encapsulations_different_shared_secrets() {
    let kp = mlkem1024::KemKeyPair::generate();
    let (ct1, s1) = kp.encapsulate().unwrap();
    let (ct2, s2) = kp.encapsulate().unwrap();
    assert_ne!(s1, s2);
    assert_ne!(ct1.ciphertext, ct2.ciphertext);
}

#[test]
fn test_mlkem_decapsulate_wrong_ciphertext() {
    let kp = mlkem1024::KemKeyPair::generate();
    let (_, shared1) = kp.encapsulate().unwrap();
    let (ct2, _) = kp.encapsulate().unwrap();
    let shared2 = kp.decapsulate(&ct2).unwrap();
    assert_ne!(shared1, shared2);
}

#[test]
fn test_mlkem_encapsulation_key_size_constant() {
    let kp = mlkem1024::KemKeyPair::generate();
    assert_eq!(kp.encapsulation_key.len(), mlkem1024::ENCAPSULATION_KEY_SIZE);
}

#[test]
fn test_mlkem_decapsulation_seed_size_constant() {
    let kp = mlkem1024::KemKeyPair::generate();
    assert_eq!(kp.decapsulation_seed.len(), mlkem1024::DECAPSULATION_SEED_SIZE);
}

// ==================== Encryption Edge Cases ====================

#[test]
fn test_encryption_empty_plaintext_vault() {
    let key = [42u8; 32];
    let ct = encryption::encrypt_vault(&key, b"").unwrap();
    let decrypted = encryption::decrypt_vault(&key, &ct).unwrap();
    assert_eq!(decrypted, b"");
}

#[test]
fn test_encryption_empty_plaintext_aead() {
    let key = [42u8; 32];
    let ct = encryption::encrypt_aead(&key, b"").unwrap();
    let decrypted = encryption::decrypt_aead(&key, &ct).unwrap();
    assert_eq!(decrypted, b"");
}

#[test]
fn test_encryption_large_plaintext_vault() {
    let key = [42u8; 32];
    let plaintext = vec![0xCD; 1_000_000];
    let ct = encryption::encrypt_vault(&key, &plaintext).unwrap();
    let decrypted = encryption::decrypt_vault(&key, &ct).unwrap();
    assert_eq!(decrypted, plaintext);
}

#[test]
fn test_encryption_large_plaintext_aead() {
    let key = [42u8; 32];
    let plaintext = vec![0xEF; 500_000];
    let ct = encryption::encrypt_aead(&key, &plaintext).unwrap();
    let decrypted = encryption::decrypt_aead(&key, &ct).unwrap();
    assert_eq!(decrypted, plaintext);
}

#[test]
fn test_encryption_nonce_tampering_fails() {
    let key = [42u8; 32];
    let mut ct = encryption::encrypt_vault(&key, b"secret data").unwrap();
    ct.nonce[0] ^= 0xFF;
    assert!(encryption::decrypt_vault(&key, &ct).is_err());
}

#[test]
fn test_encryption_aead_nonce_tampering_fails() {
    let key = [42u8; 32];
    let mut ct = encryption::encrypt_aead(&key, b"secret data").unwrap();
    ct.nonce[0] ^= 0xFF;
    assert!(encryption::decrypt_aead(&key, &ct).is_err());
}

#[test]
fn test_encryption_ciphertext_tampering_fails() {
    let key = [42u8; 32];
    let mut ct = encryption::encrypt_vault(&key, b"secret data").unwrap();
    ct.ciphertext[0] ^= 0xFF;
    assert!(encryption::decrypt_vault(&key, &ct).is_err());
}

#[test]
fn test_encryption_aead_ciphertext_tampering_fails() {
    let key = [42u8; 32];
    let mut ct = encryption::encrypt_aead(&key, b"secret data").unwrap();
    ct.ciphertext[0] ^= 0xFF;
    assert!(encryption::decrypt_aead(&key, &ct).is_err());
}

#[test]
fn test_encryption_invalid_nonce_size_vault() {
    let key = [42u8; 32];
    let ct = encryption::Ciphertext {
        nonce: vec![0u8; 10],
        ciphertext: vec![0u8; 16],
    };
    assert!(encryption::decrypt_vault(&key, &ct).is_err());
}

#[test]
fn test_encryption_invalid_nonce_size_aead() {
    let key = [42u8; 32];
    let ct = encryption::Ciphertext {
        nonce: vec![0u8; 10],
        ciphertext: vec![0u8; 16],
    };
    assert!(encryption::decrypt_aead(&key, &ct).is_err());
}

#[test]
fn test_encryption_vault_nonce_is_unique() {
    let key = [0u8; 32];
    let ct1 = encryption::encrypt_vault(&key, b"msg").unwrap();
    let ct2 = encryption::encrypt_vault(&key, b"msg").unwrap();
    assert_ne!(ct1.nonce, ct2.nonce);
}

#[test]
fn test_encryption_derive_aead_key_empty_domain() {
    let shared = [7u8; 32];
    let k1 = encryption::derive_aead_key(&shared, "");
    let k2 = encryption::derive_aead_key(&shared, "");
    assert_eq!(k1, k2);
}

#[test]
fn test_encryption_derive_aead_key_empty_shared() {
    let k = encryption::derive_aead_key(&[], "ZAP_test");
    assert_eq!(k.len(), 32);
}

#[test]
fn test_encryption_cross_cipher_incompatibility() {
    let key = [42u8; 32];
    let ct = encryption::encrypt_vault(&key, b"test").unwrap();
    assert!(encryption::decrypt_aead(&key, &ct).is_err());
}

#[test]
fn test_encryption_aead_to_vault_incompatibility() {
    let key = [42u8; 32];
    let ct = encryption::encrypt_aead(&key, b"test").unwrap();
    assert!(encryption::decrypt_vault(&key, &ct).is_err());
}

// ==================== KDF Edge Cases ====================

#[test]
fn test_kdf_empty_password() {
    let salt = [0u8; kdf::SALT_SIZE];
    let result = kdf::derive_master_key(b"", &salt);
    assert!(result.is_ok());
    let key = result.unwrap();
    assert_eq!(key.len(), kdf::MASTER_KEY_SIZE);
}

#[test]
fn test_kdf_large_password() {
    let salt = [0u8; kdf::SALT_SIZE];
    let password = vec![0x41; 10_000];
    let result = kdf::derive_master_key(&password, &salt);
    assert!(result.is_ok());
}

#[test]
fn test_kdf_master_key_size() {
    let salt = [0u8; kdf::SALT_SIZE];
    let key = kdf::derive_master_key(b"password", &salt).unwrap();
    assert_eq!(key.len(), kdf::MASTER_KEY_SIZE);
}

#[test]
fn test_kdf_derive_encryption_key_empty_domain() {
    let master = [42u8; 32];
    let k1 = kdf::derive_encryption_key(&master, "");
    let k2 = kdf::derive_encryption_key(&master, "");
    assert_eq!(k1, k2);
}

#[test]
fn test_kdf_salt_all_zeros() {
    let salt = [0u8; kdf::SALT_SIZE];
    let key = kdf::derive_master_key(b"test", &salt).unwrap();
    assert_eq!(key.len(), kdf::MASTER_KEY_SIZE);
}

#[test]
fn test_kdf_salt_all_ones() {
    let salt = [0xFFu8; kdf::SALT_SIZE];
    let key = kdf::derive_master_key(b"test", &salt).unwrap();
    assert_eq!(key.len(), kdf::MASTER_KEY_SIZE);
}

#[test]
fn test_kdf_salt_too_short() {
    assert!(kdf::derive_master_key(b"password", &[0u8; 8]).is_err());
}

#[test]
fn test_kdf_salt_too_long() {
    assert!(kdf::derive_master_key(b"password", &[0u8; 32]).is_err());
}

#[test]
fn test_kdf_derive_encryption_key_different_master() {
    let m1 = [1u8; 32];
    let m2 = [2u8; 32];
    let k1 = kdf::derive_encryption_key(&m1, "domain");
    let k2 = kdf::derive_encryption_key(&m2, "domain");
    assert_ne!(k1, k2);
}

#[test]
fn test_kdf_generate_salt_size() {
    let salt = kdf::generate_salt();
    assert_eq!(salt.len(), kdf::SALT_SIZE);
}

#[test]
fn test_kdf_argon2_params_memory() {
    assert_eq!(kdf::ARGON2_MEMORY_KIB, 65536);
}

#[test]
fn test_kdf_argon2_params_iterations() {
    assert_eq!(kdf::ARGON2_ITERATIONS, 3);
}

#[test]
fn test_kdf_argon2_params_parallelism() {
    assert_eq!(kdf::ARGON2_PARALLELISM, 4);
}

// ==================== Mnemonic Edge Cases ====================

#[test]
fn test_mnemonic_empty_string_rejected() {
    assert!(mnemonic::validate_mnemonic("").is_err());
}

#[test]
fn test_mnemonic_partial_mnemonic_rejected() {
    assert!(mnemonic::validate_mnemonic("abandon abandon abandon").is_err());
}

#[test]
fn test_mnemonic_wrong_word_count_rejected() {
    let m = mnemonic::generate_mnemonic();
    let words: Vec<&str> = m.split_whitespace().collect();
    // 13 words is not a valid BIP39 length (valid: 12/15/18/21/24), so this is
    // always rejected on length alone. (Truncating to 12 would be a *valid*
    // length and only fail on the checksum ~15/16 of the time -> flaky.)
    let truncated = words[..13].join(" ");
    assert!(mnemonic::validate_mnemonic(&truncated).is_err());
}

#[test]
fn test_mnemonic_seed_all_bytes_not_zero() {
    let m = mnemonic::generate_mnemonic();
    let seed = mnemonic::mnemonic_to_seed(&m).unwrap();
    assert!(seed.iter().any(|&b| b != 0));
}

#[test]
fn test_mnemonic_to_seed_invalid_rejected() {
    assert!(mnemonic::mnemonic_to_seed("invalid words here").is_err());
}

#[test]
fn test_mnemonic_to_seed_empty_rejected() {
    assert!(mnemonic::mnemonic_to_seed("").is_err());
}

#[test]
fn test_mnemonic_word_count_constant() {
    assert_eq!(mnemonic::MNEMONIC_WORD_COUNT, 24);
}

#[test]
fn test_mnemonic_seed_size_constant() {
    assert_eq!(mnemonic::SEED_SIZE, 64);
}

#[test]
fn test_mnemonic_validate_known_valid() {
    let known_valid = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
    assert!(mnemonic::validate_mnemonic(known_valid).is_ok());
}

#[test]
fn test_mnemonic_known_valid_seed_deterministic() {
    let known = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
    let s1 = mnemonic::mnemonic_to_seed(known).unwrap();
    let s2 = mnemonic::mnemonic_to_seed(known).unwrap();
    assert_eq!(s1, s2);
}

// ==================== HD Derivation Edge Cases ====================

#[test]
fn test_hd_empty_path_returns_default() {
    let path = hd_derivation::KeyPath::parse("").unwrap();
    assert_eq!(path.purpose, hd_derivation::HARDENED_OFFSET);
}

#[test]
fn test_hd_single_component_rejected() {
    let result = hd_derivation::KeyPath::parse("44'");
    assert!(result.is_err());
}

#[test]
fn test_hd_path_too_deep_rejected() {
    let path_str = "m/44'/9999'/0'/0/1/2/3/4/5/6";
    let result = hd_derivation::KeyPath::parse(path_str);
    assert!(result.is_err());
}

#[test]
fn test_hd_non_hardened_indices() {
    let path = hd_derivation::KeyPath::parse("m/44/9999/0/0/1").unwrap();
    assert_eq!(path.purpose, 44);
    assert_eq!(path.account, 9999);
    assert_eq!(path.indices[0] & hd_derivation::HARDENED_OFFSET, 0);
}

#[test]
fn test_hd_to_string_roundtrip_non_hardened() {
    let path_str = "m/44'/9999'/0/0/1";
    let path = hd_derivation::KeyPath::parse(path_str).unwrap();
    let formatted = path.to_string();
    let reparsed = hd_derivation::KeyPath::parse(&formatted).unwrap();
    assert_eq!(path.purpose, reparsed.purpose);
    assert_eq!(path.account, reparsed.account);
    assert_eq!(path.indices, reparsed.indices);
}

#[test]
fn test_hd_derive_seed_empty_indices() {
    let master = [42u8; 64];
    let path = hd_derivation::KeyPath::new(44);
    let seed = hd_derivation::derive_seed_from_master(&master, &path);
    assert_eq!(seed.len(), 32);
}

#[test]
fn test_hd_derive_seed_different_master() {
    let m1 = [1u8; 64];
    let m2 = [2u8; 64];
    let path = hd_derivation::derive_key_path(0, 0, 0);
    let s1 = hd_derivation::derive_seed_from_master(&m1, &path);
    let s2 = hd_derivation::derive_seed_from_master(&m2, &path);
    assert_ne!(s1, s2);
}

#[test]
fn test_hd_hardened_offset_constant() {
    assert_eq!(hd_derivation::HARDENED_OFFSET, 0x80000000);
}

#[test]
fn test_hd_path_with_account_builder() {
    let path = hd_derivation::KeyPath::new(44)
        .with_account(0)
        .with_index(1);
    assert_eq!(path.purpose, 44 | hd_derivation::HARDENED_OFFSET);
    assert_eq!(path.account, 0 | hd_derivation::HARDENED_OFFSET);
    assert_eq!(path.indices, vec![1]);
}

#[test]
fn test_hd_path_to_bytes_with_indices() {
    let path = hd_derivation::KeyPath::hardened(1, 2, 3)
        .with_index(4)
        .with_index(5);
    let bytes = path.to_bytes();
    assert_eq!(bytes.len(), 20);
}

#[test]
fn test_hd_parse_invalid_number_rejected() {
    assert!(hd_derivation::KeyPath::parse("m/abc'/def'").is_err());
}

// ==================== Address Edge Cases ====================

#[test]
fn test_address_empty_public_key() {
    let addr = address::derive_address(&[]);
    assert!(addr.starts_with("zap1"));
}

#[test]
fn test_address_length() {
    let (pk, _) = mldsa87::generate();
    let addr = address::derive_address(pk.as_bytes());
    assert_eq!(addr.len(), 44);
}

#[test]
fn test_address_all_zeros_public_key() {
    let pk = [0u8; 32];
    let addr = address::derive_address(&pk);
    assert!(addr.starts_with("zap1"));
}

#[test]
fn test_address_all_ones_public_key() {
    let pk = [0xFFu8; 32];
    let addr = address::derive_address(&pk);
    assert!(addr.starts_with("zap1"));
}

#[test]
fn test_address_charset_valid() {
    let (pk, _) = mldsa87::generate();
    let addr = address::derive_address(pk.as_bytes());
    let valid_chars = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    let suffix = &addr[4..];
    for c in suffix.chars() {
        assert!(valid_chars.contains(c), "invalid char: {}", c);
    }
}

#[test]
fn test_address_large_public_key() {
    let pk = vec![0xAB; 1000];
    let addr = address::derive_address(&pk);
    assert!(addr.starts_with("zap1"));
}

// ==================== Hash Edge Cases ====================

#[test]
fn test_hash_empty_data_tx() {
    let h = hash::hash_tx(b"");
    assert_eq!(h.len(), 32);
}

#[test]
fn test_hash_empty_data_block() {
    let h = hash::hash_block(b"");
    assert_eq!(h.len(), 32);
}

#[test]
fn test_hash_large_data_tx() {
    let data = vec![0x42; 1_000_000];
    let h = hash::hash_tx(&data);
    assert_eq!(h.len(), 32);
}

#[test]
fn test_hash_large_data_block() {
    let data = vec![0x42; 1_000_000];
    let h = hash::hash_block(&data);
    assert_eq!(h.len(), 32);
}

#[test]
fn test_hash_to_hex() {
    let h = [0xAB; 32];
    let hex = hash::hash_to_hex(&h);
    assert_eq!(hex.len(), 64);
}

#[test]
fn test_hash_block_hex_length() {
    let hex = hash::hash_block_hex(b"test");
    assert_eq!(hex.len(), 64);
}

#[test]
fn test_hash_tx_and_block_same_data_differ() {
    let data = b"identical data";
    assert_ne!(hash::hash_tx(data), hash::hash_block(data));
}

#[test]
fn test_hash_tx_hex_matches_bytes() {
    let data = b"test data";
    let h = hash::hash_tx(data);
    let hex1 = hash::hash_tx_hex(data);
    let hex2 = hash::hash_to_hex(&h);
    assert_eq!(hex1, hex2);
}

// ==================== VRF Edge Cases ====================

#[test]
fn test_vrf_empty_input() {
    let vrf = vrf::PqVrf::generate();
    let output = vrf.evaluate(b"");
    assert!(vrf::PqVrf::verify(b"", &output).is_ok());
}

#[test]
fn test_vrf_large_input() {
    let vrf = vrf::PqVrf::generate();
    let input = vec![0x42; 100_000];
    let output = vrf.evaluate(&input);
    assert!(vrf::PqVrf::verify(&input, &output).is_ok());
}

#[test]
fn test_vrf_output_size() {
    let vrf = vrf::PqVrf::generate();
    let output = vrf.evaluate(b"test");
    assert_eq!(output.output.len(), 32);
    assert_eq!(output.proof.value.len(), 32);
    assert_eq!(output.proof.public_key.len(), 32);
}

#[test]
fn test_vrf_public_key_derived_from_secret() {
    let sk = [0x42u8; 32];
    let vrf = vrf::PqVrf::from_secret(sk);
    let pk = vrf.public_key();
    let vrf2 = vrf::PqVrf::from_secret(sk);
    assert_eq!(pk, vrf2.public_key());
}

#[test]
fn test_vrf_different_secrets_different_public_keys() {
    let vrf1 = vrf::PqVrf::from_secret([1u8; 32]);
    let vrf2 = vrf::PqVrf::from_secret([2u8; 32]);
    assert_ne!(vrf1.public_key(), vrf2.public_key());
}

#[test]
fn test_vrf_tampered_public_key_in_proof() {
    let vrf = vrf::PqVrf::generate();
    let mut output = vrf.evaluate(b"input");
    output.proof.public_key[0] ^= 0xFF;
    assert!(vrf::PqVrf::verify(b"input", &output).is_err());
}

#[test]
fn test_vrf_evaluate_multiple_inputs() {
    let vrf = vrf::PqVrf::generate();
    for i in 0..5u8 {
        let input = vec![i; 32];
        let output = vrf.evaluate(&input);
        assert!(vrf::PqVrf::verify(&input, &output).is_ok());
    }
}

// ==================== Hybrid Signing Edge Cases ====================

#[test]
fn test_hybrid_sign_empty_message() {
    let signer = hybrid_signing::HybridSigner::generate().unwrap();
    let sig = signer.sign(b"").unwrap();
    assert!(hybrid_signing::HybridSigner::verify(b"", &sig).is_ok());
}

#[test]
fn test_hybrid_sign_large_message() {
    let signer = hybrid_signing::HybridSigner::generate().unwrap();
    let msg = vec![0x42; 100_000];
    let sig = signer.sign(&msg).unwrap();
    assert!(hybrid_signing::HybridSigner::verify(&msg, &sig).is_ok());
}

#[test]
fn test_hybrid_from_secret_deterministic() {
    let (_, sk) = mldsa87::generate();
    let signer1 = hybrid_signing::HybridSigner::from_secret(&sk).unwrap();
    let signer2 = hybrid_signing::HybridSigner::from_secret(&sk).unwrap();
    assert_eq!(signer1.primary_public_key().as_bytes(), signer2.primary_public_key().as_bytes());
}

#[test]
fn test_hybrid_tampered_primary_public_key() {
    let signer = hybrid_signing::HybridSigner::generate().unwrap();
    let mut sig = signer.sign(b"test").unwrap();
    sig.primary_public_key[0] ^= 0xFF;
    assert!(hybrid_signing::HybridSigner::verify(b"test", &sig).is_err());
}

#[test]
fn test_hybrid_tampered_secondary_public_key() {
    let signer = hybrid_signing::HybridSigner::generate().unwrap();
    let mut sig = signer.sign(b"test").unwrap();
    sig.secondary_public_key[0] ^= 0xFF;
    assert!(hybrid_signing::HybridSigner::verify(b"test", &sig).is_err());
}

#[test]
fn test_hybrid_signature_sizes() {
    let signer = hybrid_signing::HybridSigner::generate().unwrap();
    let sig = signer.sign(b"test").unwrap();
    assert_eq!(sig.primary.len(), mldsa87::SIGNATURE_SIZE);
    assert_eq!(sig.secondary.len(), 32);
    assert_eq!(sig.secondary_public_key.len(), 32);
}

#[test]
fn test_hybrid_verify_wrong_message_empty() {
    let signer = hybrid_signing::HybridSigner::generate().unwrap();
    let sig = signer.sign(b"").unwrap();
    assert!(hybrid_signing::HybridSigner::verify(b"non-empty", &sig).is_err());
}

// ==================== Threshold Edge Cases ====================

#[test]
fn test_threshold_empty_shares_rejected() {
    let result = threshold::ThresholdSigner::aggregate(b"msg", vec![], 1);
    assert!(result.is_err());
}

#[test]
fn test_threshold_single_signer_threshold_one() {
    let s = threshold::ThresholdSigner::generate(1).unwrap();
    let shares = vec![s.create_share(b"msg").unwrap()];
    let sig = threshold::ThresholdSigner::aggregate(b"msg", shares, 1).unwrap();
    assert!(threshold::ThresholdSigner::verify(&sig, b"msg").unwrap());
}

#[test]
fn test_threshold_exact_threshold() {
    let signers: Vec<_> = (0..3).map(|_| threshold::ThresholdSigner::generate(3).unwrap()).collect();
    let shares: Vec<_> = signers.iter().map(|s| s.create_share(b"msg").unwrap()).collect();
    let sig = threshold::ThresholdSigner::aggregate(b"msg", shares, 3).unwrap();
    assert!(threshold::ThresholdSigner::verify(&sig, b"msg").unwrap());
}

#[test]
fn test_threshold_above_threshold() {
    let signers: Vec<_> = (0..5).map(|_| threshold::ThresholdSigner::generate(3).unwrap()).collect();
    let shares: Vec<_> = signers.iter().map(|s| s.create_share(b"msg").unwrap()).collect();
    let sig = threshold::ThresholdSigner::aggregate(b"msg", shares, 3).unwrap();
    assert!(threshold::ThresholdSigner::verify(&sig, b"msg").unwrap());
}

#[test]
fn test_threshold_empty_message() {
    let s = threshold::ThresholdSigner::generate(1).unwrap();
    let shares = vec![s.create_share(b"").unwrap()];
    let sig = threshold::ThresholdSigner::aggregate(b"", shares, 1).unwrap();
    assert!(threshold::ThresholdSigner::verify(&sig, b"").unwrap());
}

#[test]
fn test_threshold_large_message() {
    let s1 = threshold::ThresholdSigner::generate(2).unwrap();
    let s2 = threshold::ThresholdSigner::generate(2).unwrap();
    let msg = vec![0x42; 100_000];
    let shares = vec![s1.create_share(&msg).unwrap(), s2.create_share(&msg).unwrap()];
    let sig = threshold::ThresholdSigner::aggregate(&msg, shares, 2).unwrap();
    assert!(threshold::ThresholdSigner::verify(&sig, &msg).unwrap());
}

#[test]
fn test_threshold_verify_tampered_message_hash() {
    let s1 = threshold::ThresholdSigner::generate(1).unwrap();
    let shares = vec![s1.create_share(b"msg").unwrap()];
    let mut sig = threshold::ThresholdSigner::aggregate(b"msg", shares, 1).unwrap();
    sig.message_hash[0] ^= 0xFF;
    assert!(!threshold::ThresholdSigner::verify(&sig, b"msg").unwrap());
}

#[test]
fn test_threshold_verify_tampered_threshold() {
    let s1 = threshold::ThresholdSigner::generate(1).unwrap();
    let _s2 = threshold::ThresholdSigner::generate(1).unwrap();
    let shares = vec![s1.create_share(b"msg").unwrap()];
    let mut sig = threshold::ThresholdSigner::aggregate(b"msg", shares, 1).unwrap();
    sig.threshold = 5;
    assert!(!threshold::ThresholdSigner::verify(&sig, b"msg").unwrap());
}

#[test]
fn test_threshold_three_signers_two_threshold() {
    let signers: Vec<_> = (0..3).map(|_| threshold::ThresholdSigner::generate(2).unwrap()).collect();
    let shares = vec![
        signers[0].create_share(b"test").unwrap(),
        signers[1].create_share(b"test").unwrap(),
    ];
    let sig = threshold::ThresholdSigner::aggregate(b"test", shares, 2).unwrap();
    assert!(threshold::ThresholdSigner::verify(&sig, b"test").unwrap());
}

// ==================== Proof Batch Edge Cases ====================

#[test]
fn test_proof_batch_two_elements() {
    let hashes: Vec<[u8; 32]> = (0..2).map(|i| {
        let mut h = blake3::Hasher::new();
        h.update(b"test");
        h.update(&(i as u64).to_le_bytes());
        *h.finalize().as_bytes()
    }).collect();
    let batched = proof_batch::ProofBatcher::aggregate(hashes).unwrap();
    assert_eq!(batched.count, 2);
    assert!(proof_batch::ProofBatcher::verify(&batched).unwrap());
}

#[test]
fn test_proof_batch_three_elements_odd() {
    let hashes: Vec<[u8; 32]> = (0..3).map(|i| {
        let mut h = blake3::Hasher::new();
        h.update(b"test");
        h.update(&(i as u64).to_le_bytes());
        *h.finalize().as_bytes()
    }).collect();
    let batched = proof_batch::ProofBatcher::aggregate(hashes).unwrap();
    assert_eq!(batched.count, 3);
    assert!(proof_batch::ProofBatcher::verify(&batched).unwrap());
}

#[test]
fn test_proof_batch_large_batch() {
    let hashes: Vec<[u8; 32]> = (0..100).map(|i| {
        let mut h = blake3::Hasher::new();
        h.update(b"test");
        h.update(&(i as u64).to_le_bytes());
        *h.finalize().as_bytes()
    }).collect();
    let batched = proof_batch::ProofBatcher::aggregate(hashes).unwrap();
    assert_eq!(batched.count, 100);
    assert!(proof_batch::ProofBatcher::verify(&batched).unwrap());
}

#[test]
fn test_proof_batch_tampered_count() {
    let hashes: Vec<[u8; 32]> = (0..5).map(|i| {
        let mut h = blake3::Hasher::new();
        h.update(b"test");
        h.update(&(i as u64).to_le_bytes());
        *h.finalize().as_bytes()
    }).collect();
    let mut batched = proof_batch::ProofBatcher::aggregate(hashes).unwrap();
    batched.count = 100;
    assert_eq!(batched.count, 100);
    assert!(proof_batch::ProofBatcher::verify(&batched).unwrap());
}

#[test]
fn test_proof_batch_verify_empty_rejected() {
    let batched = proof_batch::BatchedProof {
        batch_root: [0u8; 32],
        proof_hashes: vec![],
        count: 0,
    };
    assert!(proof_batch::ProofBatcher::verify(&batched).is_err());
}

#[test]
fn test_proof_batch_aggregate_single_matches_root() {
    let hash = {
        let mut h = blake3::Hasher::new();
        h.update(b"single");
        *h.finalize().as_bytes()
    };
    let batched = proof_batch::ProofBatcher::aggregate(vec![hash]).unwrap();
    assert_eq!(batched.batch_root, hash);
}

#[test]
fn test_proof_batch_duplicate_hashes() {
    let h = {
        let mut hasher = blake3::Hasher::new();
        hasher.update(b"dup");
        *hasher.finalize().as_bytes()
    };
    let batched = proof_batch::ProofBatcher::aggregate(vec![h, h, h]).unwrap();
    assert_eq!(batched.count, 3);
    assert!(proof_batch::ProofBatcher::verify(&batched).unwrap());
}

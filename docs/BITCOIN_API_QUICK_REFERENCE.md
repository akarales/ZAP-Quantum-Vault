# Bitcoin Rust API Quick Reference

## Essential Imports

```rust
// Core Bitcoin types
use bitcoin::{Address, Network};
use bitcoin::key::{CompressedPublicKey, Keypair};
use secp256k1::{Secp256k1, SecretKey, PublicKey};

// HD Wallets
use bitcoin::bip32::{ExtendedPrivKey, ExtendedPubKey, DerivationPath};

// Transactions
use bitcoin::{Transaction, TxIn, TxOut, OutPoint, Txid};
use bitcoin::script::Builder;
use bitcoin::opcodes::all::*;

// Encoding/Decoding
use bitcoin::consensus::{encode, decode};
use bitcoin::hashes::hex::{ToHex, FromHex};
```

## Key Generation Patterns

### Private Key
```rust
// Random generation
let secp = Secp256k1::new();
let secret_key = SecretKey::new(&mut rand::thread_rng());

// From bytes
let secret_key = SecretKey::from_slice(&[/* 32 bytes */])?;

// From hex
let bytes = hex::decode("your_hex_key")?;
let secret_key = SecretKey::from_slice(&bytes)?;
```

### Public Key
```rust
// Compressed (recommended)
let compressed_pubkey = CompressedPublicKey::from_private_key(&secp, &secret_key);

// Secp256k1 public key
let secp_pubkey = secret_key.public_key(&secp);
```

## Address Generation (v0.32.7)

### Legacy P2PKH
```rust
let address = Address::p2pkh(&compressed_pubkey, Network::Bitcoin);
```

### Native SegWit P2WPKH
```rust
// Returns Result<Address, _>
let address = Address::p2wpkh(&compressed_pubkey, Network::Bitcoin)?;
```

### Wrapped SegWit P2SH-P2WPKH
```rust
// Returns Result<Address, _>
let address = Address::p2shwpkh(&compressed_pubkey, Network::Bitcoin)?;
```

### Taproot P2TR
```rust
let keypair = Keypair::from_secret_key(&secp, &secret_key);
let (xonly_pubkey, _parity) = keypair.x_only_public_key();
let address = Address::p2tr(&secp, xonly_pubkey, None, Network::Bitcoin);
```

## HD Wallet Patterns

### Master Key Generation
```rust
let seed: [u8; 64] = [/* your seed */];
let master_key = ExtendedPrivKey::new_master(Network::Bitcoin, &seed)?;
```

### Key Derivation
```rust
// BIP44 path: m/44'/0'/0'/0/0
let path = DerivationPath::from_str("m/44'/0'/0'/0/0")?;
let child_key = master_key.derive_priv(&secp, &path)?;
let child_pubkey = ExtendedPubKey::from_priv(&secp, &child_key);
```

## Network Conversion
```rust
match network_str {
    "bitcoin" | "mainnet" => Network::Bitcoin,
    "testnet" => Network::Testnet,
    "signet" => Network::Signet,
    "regtest" => Network::Regtest,
    _ => return Err("Invalid network"),
}
```

## Error Handling Patterns

```rust
use bitcoin::address::Error as AddressError;
use secp256k1::Error as Secp256k1Error;

#[derive(Debug)]
enum BitcoinError {
    Secp256k1(Secp256k1Error),
    Address(AddressError),
    InvalidInput(String),
}

impl From<Secp256k1Error> for BitcoinError {
    fn from(err: Secp256k1Error) -> Self {
        BitcoinError::Secp256k1(err)
    }
}

impl From<AddressError> for BitcoinError {
    fn from(err: AddressError) -> Self {
        BitcoinError::Address(err)
    }
}
```

## Common Validation

### Private Key Validation
```rust
fn validate_private_key(hex: &str) -> Result<SecretKey, BitcoinError> {
    let bytes = hex::decode(hex)
        .map_err(|_| BitcoinError::InvalidInput("Invalid hex".to_string()))?;
    
    if bytes.len() != 32 {
        return Err(BitcoinError::InvalidInput("Key must be 32 bytes".to_string()));
    }
    
    SecretKey::from_slice(&bytes).map_err(BitcoinError::from)
}
```

### Address Validation
```rust
fn validate_address(addr_str: &str, expected_network: Network) -> Result<Address, BitcoinError> {
    let address = Address::from_str(addr_str)
        .map_err(BitcoinError::from)?;
    
    if address.network != expected_network {
        return Err(BitcoinError::InvalidInput("Network mismatch".to_string()));
    }
    
    Ok(address)
}
```

## Serialization Formats

### Private Key Formats
```rust
// WIF (Wallet Import Format)
let wif = secret_key.display_secret();

// Raw bytes
let bytes = secret_key.secret_bytes();

// Hex string
let hex = hex::encode(bytes);
```

### Address Formats
```rust
// String representation
let addr_string = address.to_string();

// Script pubkey
let script_pubkey = address.script_pubkey();

// Address type checking
match address.address_type() {
    Some(bitcoin::AddressType::P2pkh) => println!("Legacy"),
    Some(bitcoin::AddressType::P2sh) => println!("Script Hash"),
    Some(bitcoin::AddressType::P2wpkh) => println!("Native SegWit"),
    Some(bitcoin::AddressType::P2wsh) => println!("Native SegWit Script"),
    Some(bitcoin::AddressType::P2tr) => println!("Taproot"),
    None => println!("Unknown"),
}
```

## Performance Tips

### Context Reuse
```rust
// Reuse secp256k1 context for better performance
lazy_static! {
    static ref SECP: Secp256k1<secp256k1::All> = Secp256k1::new();
}

// Use signing-only context when only signing
let secp = Secp256k1::signing_only();

// Use verification-only context when only verifying
let secp = Secp256k1::verification_only();
```

### Batch Operations
```rust
fn generate_multiple_keys(count: usize) -> Vec<(SecretKey, Address)> {
    let secp = &*SECP;
    let mut keys = Vec::with_capacity(count);
    
    for _ in 0..count {
        let secret_key = SecretKey::new(&mut rand::thread_rng());
        let compressed_pubkey = CompressedPublicKey::from_private_key(secp, &secret_key);
        let address = Address::p2wpkh(&compressed_pubkey, Network::Bitcoin).unwrap();
        keys.push((secret_key, address));
    }
    
    keys
}
```

## Security Best Practices

### Memory Safety
```rust
use zeroize::Zeroize;

// Always zeroize sensitive data
let mut private_key_bytes = secret_key.secret_bytes();
// ... use the key ...
private_key_bytes.zeroize();
```

### Secure Random Generation
```rust
use rand::rngs::OsRng;

// Use OS random number generator for cryptographic keys
let mut rng = OsRng;
let secret_key = SecretKey::new(&mut rng);
```

### Input Validation
```rust
// Always validate inputs
fn safe_key_from_hex(hex: &str) -> Result<SecretKey, BitcoinError> {
    if hex.len() != 64 {
        return Err(BitcoinError::InvalidInput("Hex must be 64 characters".to_string()));
    }
    
    let bytes = hex::decode(hex)
        .map_err(|_| BitcoinError::InvalidInput("Invalid hex encoding".to_string()))?;
    
    SecretKey::from_slice(&bytes).map_err(BitcoinError::from)
}
```

## Testing Patterns

### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_key_generation() {
        let secp = Secp256k1::new();
        let secret_key = SecretKey::new(&mut rand::thread_rng());
        let compressed_pubkey = CompressedPublicKey::from_private_key(&secp, &secret_key);
        
        // Test all address types
        let legacy = Address::p2pkh(&compressed_pubkey, Network::Testnet);
        let segwit = Address::p2wpkh(&compressed_pubkey, Network::Testnet).unwrap();
        let wrapped = Address::p2shwpkh(&compressed_pubkey, Network::Testnet).unwrap();
        
        assert_eq!(legacy.network, Network::Testnet);
        assert_eq!(segwit.network, Network::Testnet);
        assert_eq!(wrapped.network, Network::Testnet);
    }
    
    #[test]
    fn test_address_validation() {
        let valid_address = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
        let address = Address::from_str(valid_address).unwrap();
        assert_eq!(address.network, Network::Bitcoin);
    }
}
```

## Common Gotchas

1. **Address methods return Result in v0.32.7**
   ```rust
   // Wrong (v0.31 and earlier)
   let address = Address::p2wpkh(&pubkey, network);
   
   // Correct (v0.32.7)
   let address = Address::p2wpkh(&pubkey, network)?;
   ```

2. **Network validation is important**
   ```rust
   // Always check network matches expectations
   if address.network != expected_network {
       return Err("Network mismatch");
   }
   ```

3. **Use compressed public keys**
   ```rust
   // Preferred
   let compressed = CompressedPublicKey::from_private_key(&secp, &secret_key);
   
   // Avoid uncompressed keys (legacy only)
   let uncompressed = bitcoin::key::PublicKey::new_uncompressed(secp_pubkey);
   ```

4. **Handle derivation errors**
   ```rust
   // HD wallet derivation can fail
   let child_key = master_key.derive_priv(&secp, &path)
       .map_err(|e| format!("Derivation failed: {}", e))?;
   ```

This quick reference covers the most common patterns and gotchas when working with the bitcoin crate v0.32.7.

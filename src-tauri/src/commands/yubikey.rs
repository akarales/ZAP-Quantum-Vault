//! YubiKey HMAC-SHA1 challenge-response support.
//!
//! Thin, testable wrapper around the `challenge_response` crate. The HMAC-SHA1
//! response is mixed into the vault key derivation (see
//! [`crate::crypto::kdf::derive_master_key_with_factor`]) so the vault can only
//! be decrypted with **both** the password and the physical YubiKey.
//!
//! ## Recovery caveat
//! Because the response is folded into the slow Argon2id step, losing the
//! YubiKey (or reprogramming its slot) makes an enrolled vault **permanently
//! unrecoverable** unless a backup key programmed with the *same* HMAC secret is
//! available, or the YubiKey factor is disabled first.

use crate::error::{Result, VaultError};
use serde::Serialize;

/// Size (bytes) of the random challenge stored per vault (<= 64 byte HMAC limit).
pub const CHALLENGE_SIZE: usize = 32;

// Bits in the YubiKey OTP status `touchLevel` low byte (firmware >= 2.1 for the
// VALID bits, >= 3.0 for the TOUCH bits). Source: Yubico ykdef.h / yubikey-manager.
const SLOT1_VALID: u8 = 0x01;
const SLOT2_VALID: u8 = 0x02;
const SLOT1_TOUCH: u8 = 0x04;
const SLOT2_TOUCH: u8 = 0x08;

/// Per-slot configuration state, as reported by the device's status structure.
#[derive(Debug, Clone, Serialize)]
pub struct SlotInfo {
    pub slot: u8,
    pub configured: bool,
    pub requires_touch: bool,
}

/// Information about a detected YubiKey, returned to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct YubiKeyInfo {
    pub detected: bool,
    pub vendor_id: u16,
    pub product_id: u16,
    pub name: String,
    /// Firmware version "major.minor.build" (empty if it could not be read).
    pub version: String,
    /// Per-slot programmed/touch state. Empty if the status could not be read
    /// (e.g. firmware < 2.1, which predates the slot-validity bits).
    pub slots: Vec<SlotInfo>,
}

/// Abstraction over a hardware HMAC-SHA1 token, for unit-testing with a mock.
pub trait ChallengeResponder {
    fn challenge_response(&mut self, slot: u8, challenge: &[u8]) -> Result<Vec<u8>>;
}

/// Generate a fresh random (non-secret) challenge to persist with the metadata.
pub fn generate_challenge() -> [u8; CHALLENGE_SIZE] {
    use rand::RngCore;
    let mut challenge = [0u8; CHALLENGE_SIZE];
    rand::thread_rng().fill_bytes(&mut challenge);
    challenge
}

#[cfg(not(test))]
fn slot_from_u8(slot: u8) -> challenge_response::config::Slot {
    use challenge_response::config::Slot;
    match slot {
        1 => Slot::Slot1,
        _ => Slot::Slot2,
    }
}

/// USB vendor IDs for YubiKey-compatible HMAC-SHA1 tokens (Yubico, OnlyKey, Nitrokey).
#[cfg(not(test))]
const YUBICO_VENDOR_IDS: [u16; 3] = [0x1050, 0x1D50, 0x20A0];

/// Parse the 8-byte YubiKey OTP status feature report into a firmware version
/// string and per-slot configuration. Layout (HID feature report):
/// `[pad, vMajor, vMinor, vBuild, pgmSeq, touchLevelLo, touchLevelHi, flags]`.
/// The slot VALID/TOUCH bits live in the `touchLevel` low byte. Kept pure so it
/// can be unit-tested without hardware.
fn parse_status(buf: &[u8]) -> (String, Vec<SlotInfo>) {
    if buf.len() < 8 {
        return (String::new(), Vec::new());
    }
    let version = format!("{}.{}.{}", buf[1], buf[2], buf[3]);
    let touch = buf[5];
    let slots = vec![
        SlotInfo {
            slot: 1,
            configured: touch & SLOT1_VALID != 0,
            requires_touch: touch & SLOT1_TOUCH != 0,
        },
        SlotInfo {
            slot: 2,
            configured: touch & SLOT2_VALID != 0,
            requires_touch: touch & SLOT2_TOUCH != 0,
        },
    ];
    (version, slots)
}

/// Detect a connected YubiKey and report which slots are programmed. Returns
/// [`VaultError::YubiKeyNotFound`] if no compatible device is present.
///
/// Reads the OTP status feature report directly over USB (a non-intrusive read
/// that never triggers a touch), since the `challenge_response` crate does not
/// expose slot configuration.
#[cfg(not(test))]
pub fn detect() -> Result<YubiKeyInfo> {
    use nusb::MaybeFuture;
    use std::time::Duration;

    let devices = nusb::list_devices()
        .wait()
        .map_err(|e| VaultError::YubiKey(e.to_string()))?;

    for info in devices {
        let vendor_id = info.vendor_id();
        let product_id = info.product_id();
        if !YUBICO_VENDOR_IDS.contains(&vendor_id) {
            continue;
        }

        let device = match info.open().wait() {
            Ok(d) => d,
            Err(_) => continue,
        };

        // Detach the kernel HID driver and claim the interfaces so the feature
        // report control transfer is permitted. Hold them for the read.
        let mut interfaces = Vec::new();
        for intf in info.interfaces() {
            if let Ok(i) = device
                .detach_and_claim_interface(intf.interface_number())
                .wait()
            {
                interfaces.push(i);
            }
        }

        let control_in = nusb::transfer::ControlIn {
            control_type: nusb::transfer::ControlType::Class,
            recipient: nusb::transfer::Recipient::Interface,
            request: 0x01,    // HID_GET_REPORT
            value: 0x03 << 8, // REPORT_TYPE_FEATURE
            index: 0,
            length: 8,
        };
        let (version, slots) = match device.control_in(control_in, Duration::new(2, 0)).wait() {
            Ok(buf) => parse_status(&buf),
            Err(_) => (String::new(), Vec::new()),
        };

        let name = info
            .product_string()
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("HMAC token {:04x}:{:04x}", vendor_id, product_id));

        return Ok(YubiKeyInfo {
            detected: true,
            vendor_id,
            product_id,
            name,
            version,
            slots,
        });
    }

    Err(VaultError::YubiKeyNotFound)
}

/// Perform an HMAC-SHA1 challenge-response against the connected YubiKey.
#[cfg(not(test))]
pub fn respond(slot: u8, challenge: &[u8]) -> Result<Vec<u8>> {
    use challenge_response::config::{Config, Mode};
    use challenge_response::ChallengeResponse;
    use std::ops::Deref;

    let mut cr = ChallengeResponse::new().map_err(|e| VaultError::YubiKey(e.to_string()))?;
    let device = cr.find_device().map_err(|_| VaultError::YubiKeyNotFound)?;
    let config = Config::new_from(device)
        .set_variable_size(true)
        .set_mode(Mode::Sha1)
        .set_slot(slot_from_u8(slot));
    let hmac = cr
        .challenge_response_hmac(challenge, config)
        .map_err(|e| VaultError::YubiKey(e.to_string()))?;
    Ok(hmac.deref().to_vec())
}

/// Size of the HMAC-SHA1 secret a slot is programmed with, in bytes.
pub const HMAC_SECRET_SIZE: usize = 20;

/// Abstraction over programming a hardware token's HMAC-SHA1 slot. Implemented
/// for USB on desktop ([`UsbProgrammer`]); a future mobile NFC backend can
/// provide its own implementation behind this same trait.
pub trait YubiKeyProgrammer {
    /// Program `slot` for HMAC-SHA1 challenge-response with `secret`.
    /// `require_touch` makes each response require a physical button press.
    fn program_hmac(
        &mut self,
        slot: u8,
        secret: &[u8; HMAC_SECRET_SIZE],
        require_touch: bool,
    ) -> Result<()>;
    /// Erase (format) `slot`, removing any credential programmed in it.
    fn erase_slot(&mut self, slot: u8) -> Result<()>;
}

/// Map a 1/2 slot number to the crate's slot-config write command.
#[cfg(not(test))]
fn slot_command(slot: u8) -> challenge_response::config::Command {
    use challenge_response::config::Command;
    match slot {
        1 => Command::Configuration1,
        _ => Command::Configuration2,
    }
}

/// Program a slot for HMAC-SHA1 challenge-response. Native USB HID write via the
/// `challenge_response` crate's `write_config` — no external tools required.
/// Desktop-only: the underlying USB backend is not available on mobile targets.
#[cfg(not(test))]
pub fn program_hmac_slot(
    slot: u8,
    secret: &[u8; HMAC_SECRET_SIZE],
    require_touch: bool,
) -> Result<()> {
    use challenge_response::config::Config;
    use challenge_response::configure::DeviceModeConfig;
    use challenge_response::hmacmode::HmacKey;
    use challenge_response::ChallengeResponse;

    let mut cr = ChallengeResponse::new().map_err(|e| VaultError::YubiKey(e.to_string()))?;
    let device = cr.find_device().map_err(|_| VaultError::YubiKeyNotFound)?;
    let conf = Config::new_from(device).set_command(slot_command(slot));

    let mut device_config = DeviceModeConfig::default();
    let key = HmacKey::from_slice(secret);
    // variable=true allows challenges up to 63 bytes (matches how we issue them).
    device_config.challenge_response_hmac(&key, true, require_touch);

    cr.write_config(conf, &mut device_config)
        .map_err(|e| VaultError::YubiKey(e.to_string()))
}

/// Erase a slot by writing an empty (all-zero) configuration, which the device
/// interprets as a delete. Desktop-only.
#[cfg(not(test))]
pub fn erase_slot(slot: u8) -> Result<()> {
    use challenge_response::config::Config;
    use challenge_response::configure::DeviceModeConfig;
    use challenge_response::ChallengeResponse;

    let mut cr = ChallengeResponse::new().map_err(|e| VaultError::YubiKey(e.to_string()))?;
    let device = cr.find_device().map_err(|_| VaultError::YubiKeyNotFound)?;
    let conf = Config::new_from(device).set_command(slot_command(slot));

    let mut device_config = DeviceModeConfig::default();
    cr.write_config(conf, &mut device_config)
        .map_err(|e| VaultError::YubiKey(e.to_string()))
}

/// Generate a fresh random 20-byte HMAC-SHA1 secret to program into a slot.
pub fn generate_hmac_secret() -> [u8; HMAC_SECRET_SIZE] {
    use rand::RngCore;
    let mut secret = [0u8; HMAC_SECRET_SIZE];
    rand::rngs::OsRng.fill_bytes(&mut secret);
    secret
}

/// Test build stub: no USB hardware is touched in unit tests.
#[cfg(test)]
pub fn detect() -> Result<YubiKeyInfo> {
    Err(VaultError::YubiKeyNotFound)
}

/// Test build stub: no USB hardware is touched in unit tests.
#[cfg(test)]
pub fn respond(_slot: u8, _challenge: &[u8]) -> Result<Vec<u8>> {
    Err(VaultError::YubiKeyNotFound)
}

/// Test build stub: no USB hardware is touched in unit tests.
#[cfg(test)]
pub fn program_hmac_slot(
    _slot: u8,
    _secret: &[u8; HMAC_SECRET_SIZE],
    _require_touch: bool,
) -> Result<()> {
    Err(VaultError::YubiKeyNotFound)
}

/// Test build stub: no USB hardware is touched in unit tests.
#[cfg(test)]
pub fn erase_slot(_slot: u8) -> Result<()> {
    Err(VaultError::YubiKeyNotFound)
}

/// Production [`ChallengeResponder`] backed by a real USB YubiKey.
pub struct UsbResponder;

impl ChallengeResponder for UsbResponder {
    fn challenge_response(&mut self, slot: u8, challenge: &[u8]) -> Result<Vec<u8>> {
        respond(slot, challenge)
    }
}

/// Production [`YubiKeyProgrammer`] backed by a real USB YubiKey (desktop).
pub struct UsbProgrammer;

impl YubiKeyProgrammer for UsbProgrammer {
    fn program_hmac(
        &mut self,
        slot: u8,
        secret: &[u8; HMAC_SECRET_SIZE],
        require_touch: bool,
    ) -> Result<()> {
        program_hmac_slot(slot, secret, require_touch)
    }
    fn erase_slot(&mut self, slot: u8) -> Result<()> {
        erase_slot(slot)
    }
}

/// Tauri command: detect a connected YubiKey.
#[tauri::command]
pub fn detect_yubikey() -> Result<YubiKeyInfo> {
    detect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::kdf::{self, SALT_SIZE};

    struct MockResponder {
        secret: [u8; 20],
    }

    impl ChallengeResponder for MockResponder {
        fn challenge_response(&mut self, slot: u8, challenge: &[u8]) -> Result<Vec<u8>> {
            let mut hasher = blake3::Hasher::new();
            hasher.update(&self.secret);
            hasher.update(&[slot]);
            hasher.update(challenge);
            Ok(hasher.finalize().as_bytes()[..20].to_vec())
        }
    }

    #[test]
    fn test_generate_challenge_unique_and_sized() {
        let c1 = generate_challenge();
        let c2 = generate_challenge();
        assert_eq!(c1.len(), CHALLENGE_SIZE);
        assert_ne!(c1, c2);
    }

    #[test]
    fn test_parse_status_short_buffer() {
        let (version, slots) = parse_status(&[0u8; 4]);
        assert!(version.is_empty());
        assert!(slots.is_empty());
    }

    #[test]
    fn test_parse_status_both_slots_configured() {
        // version 5.4.3, touchLevel low = SLOT1_VALID|SLOT2_VALID|SLOT2_TOUCH.
        let buf = [
            0u8,
            5,
            4,
            3,
            2,
            SLOT1_VALID | SLOT2_VALID | SLOT2_TOUCH,
            0,
            0,
        ];
        let (version, slots) = parse_status(&buf);
        assert_eq!(version, "5.4.3");
        assert_eq!(slots.len(), 2);
        assert!(slots[0].configured && !slots[0].requires_touch);
        assert!(slots[1].configured && slots[1].requires_touch);
    }

    #[test]
    fn test_parse_status_no_slots_configured() {
        let buf = [0u8, 5, 4, 3, 0, 0, 0, 0];
        let (_v, slots) = parse_status(&buf);
        assert!(!slots[0].configured && !slots[1].configured);
    }

    #[test]
    fn test_mock_responder_deterministic() {
        let mut token = MockResponder { secret: [0x42; 20] };
        let challenge = generate_challenge();
        assert_eq!(
            token.challenge_response(2, &challenge).unwrap(),
            token.challenge_response(2, &challenge).unwrap()
        );
    }

    #[test]
    fn test_full_factor_flow_with_mock_token() {
        let salt = [9u8; SALT_SIZE];
        let challenge = generate_challenge();
        let mut good = MockResponder { secret: [0x01; 20] };
        let mut wrong = MockResponder { secret: [0x02; 20] };

        let enrolled = kdf::derive_master_key_with_factor(
            b"pw",
            Some(&good.challenge_response(2, &challenge).unwrap()),
            &salt,
        )
        .unwrap();

        let unlock = kdf::derive_master_key_with_factor(
            b"pw",
            Some(&good.challenge_response(2, &challenge).unwrap()),
            &salt,
        )
        .unwrap();
        assert_eq!(enrolled, unlock);

        let wrong_key = kdf::derive_master_key_with_factor(
            b"pw",
            Some(&wrong.challenge_response(2, &challenge).unwrap()),
            &salt,
        )
        .unwrap();
        assert_ne!(enrolled, wrong_key);
    }

    #[test]
    fn test_detect_stub_errors_in_tests() {
        assert!(matches!(detect(), Err(VaultError::YubiKeyNotFound)));
        assert!(matches!(respond(2, b"x"), Err(VaultError::YubiKeyNotFound)));
    }
}

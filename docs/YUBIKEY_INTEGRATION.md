# YubiKey Two-Factor Integration

ZAP Quantum Vault supports a **YubiKey HMAC-SHA1 challenge-response** as an
optional second factor. When enabled, the YubiKey's response is folded into the
vault's key derivation, so the vault can only be unlocked (or decrypted) with
**both** the password **and** the physical YubiKey.

## Threat model

| Attacker capability        | Password-only vault | Password + YubiKey vault |
| -------------------------- | ------------------- | ------------------------ |
| Steals `vault.json`/`keys.enc` from disk | Must brute-force Argon2id | Must brute-force Argon2id **and** possess the YubiKey |
| Knows/guesses the password | Full access         | No access without the key |
| Steals the YubiKey         | n/a                 | No access without the password |

The YubiKey's HMAC secret never leaves the device. The challenge stored in
`vault.json` is **not secret** — security comes from the on-device secret, not
from hiding the challenge.

## How it works

1. The YubiKey slot (1 or 2) is programmed with an HMAC-SHA1 secret in
   challenge-response mode (`ykman otp chalresp --touch --generate 2`).
2. On enrollment, the vault generates a random 32-byte challenge and stores it
   (plus the slot) in `vault.json`.
3. During key derivation, the password and the YubiKey's HMAC-SHA1 response are
   combined with a domain-separated, length-prefixed BLAKE3 hash, and the result
   is fed into the slow Argon2id step:

   ```text
   combined = BLAKE3("ZAP_VAULT_2FA_v1" || len(pw) || pw || len(resp) || resp)
   master_key = Argon2id(combined, salt)
   ```

   See `derive_master_key_with_factor` in `src-tauri/src/crypto/kdf.rs`.
4. Because the slow Argon2id input depends on the response, the vault cannot be
   derived without the physical key — even offline against a stolen disk image.

## Programming a YubiKey

Using the YubiKey Manager CLI (`ykman`):

```bash
# Program slot 2 for HMAC-SHA1 challenge-response, require touch, random secret.
ykman otp chalresp --touch --generate 2
```

To use a **backup key**, program a second YubiKey with the **same** secret
(`ykman otp chalresp --touch <hex-secret> 2`) and store it safely.

## Slot detection

The app detects which slots (1 and 2) are programmed by reading the YubiKey's
**OTP status feature report** directly over USB (a non-intrusive read that never
triggers a touch). The `touchLevel` low byte carries the slot-state bits:

| Bit  | Meaning |
| ---- | ------- |
| 0x01 | Slot 1 configured (firmware ≥ 2.1) |
| 0x02 | Slot 2 configured (firmware ≥ 2.1) |
| 0x04 | Slot 1 requires touch (firmware ≥ 3.0) |
| 0x08 | Slot 2 requires touch (firmware ≥ 3.0) |

Source: Yubico `ykdef.h` / yubikey-manager `CFGSTATE`. Parsing lives in
`parse_status` in `src-tauri/src/commands/yubikey.rs` (unit-tested). The Settings
card auto-probes on open, labels each slot *configured / configured (touch) /
empty*, auto-selects a configured slot, and blocks enrolling on an empty slot.
The "configured" bit only means the slot is programmed (not necessarily for
HMAC-SHA1) — enrollment additionally performs a live challenge-response, so a
wrong-mode slot fails cleanly before any re-key is committed.

> Detection requires direct USB access (`nusb`), which detaches the kernel HID
> driver momentarily to read the status report.

## Using it in the app

- **Enroll:** Settings → *YubiKey Two-Factor* → choose a configured slot → enter
  current password → *Enroll YubiKey* (insert + touch the key). The vault is re-keyed.
- **Unlock:** The unlock screen prompts you to insert and touch the key; enter
  your password as usual.
- **Change password:** Works transparently — the same challenge/slot is reused
  against the new salt.
- **Disable:** Settings → *YubiKey Two-Factor* → enter password (key inserted) →
  *Disable YubiKey*. The vault is re-keyed back to password-only.

## Recovery caveats (read before enrolling)

> **Losing the YubiKey, or reprogramming its slot, makes an enrolled vault
> permanently unrecoverable.**

Mitigations, in order of preference:

1. **Keep a backup YubiKey** programmed with the *same* HMAC secret.
2. **Disable the factor first** if you plan to retire or reprogram the key.
3. **Keep your recovery mnemonic** for each key safe and offline — it is the
   ultimate fallback for the key material itself (independent of vault unlock).

The Settings card surfaces this warning prominently before enrollment.

## Implementation map

| Concern                     | Location |
| --------------------------- | -------- |
| KDF factor folding          | `src-tauri/src/crypto/kdf.rs` (`derive_master_key_with_factor`) |
| Hardware detect / response  | `src-tauri/src/commands/yubikey.rs` (`detect`, `respond`, `generate_challenge`) |
| Testable trait + mock       | `src-tauri/src/commands/yubikey.rs` (`ChallengeResponder`) |
| Metadata fields             | `src-tauri/src/models/vault.rs` (`yubikey_enabled`, `yubikey_slot`, `yubikey_challenge_hex`) |
| Factor-aware unlock / rekey | `src-tauri/src/commands/vault.rs` (`derive_vault_enc_key`, `rekey_vault`) |
| Enroll / disable / status   | `src-tauri/src/commands/vault.rs` (`enroll_yubikey`, `disable_yubikey`, `yubikey_status`) |
| Error variants              | `src-tauri/src/error.rs` (`YubiKey*`) |
| Frontend bindings           | `src/lib/api.ts` (`detectYubikey`, `enrollYubikey`, `disableYubikey`, `yubikeyStatus`) |
| Settings UI                 | `src/components/settings/YubiKeyCard.tsx` |
| Unlock prompt               | `src/pages/AuthPage.tsx` |

## Crate

- [`challenge_response`](https://crates.io/crates/challenge_response) with the
  pure-Rust `nusb` backend (no system `libusb` dependency on Linux/macOS).

## Tests

- `crypto::kdf::tests` — factor determinism, none-equals-plain, response
  sensitivity, length-prefix unambiguity.
- `commands::yubikey::tests` — challenge generation, deterministic mock token,
  full enroll→unlock→wrong-key flow via the `ChallengeResponder` mock.

Unit tests never touch USB hardware: in `cfg(test)` builds `detect`/`respond`
are stubbed and the `ChallengeResponder` mock is used instead.

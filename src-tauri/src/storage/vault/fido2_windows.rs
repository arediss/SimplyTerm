//! Windows WebAuthn API backend for FIDO2 security keys
//!
//! Uses the native Windows WebAuthn API which doesn't require admin privileges.
//! Available on Windows 10 version 1903 and later.

use sha2::{Digest, Sha256};
use std::ptr;
use windows::{
    core::{HSTRING, PCWSTR},
    Win32::{
        Networking::WindowsWebServices::{
            WebAuthNAuthenticatorGetAssertion, WebAuthNAuthenticatorMakeCredential,
            WebAuthNFreeAssertion, WebAuthNFreeCredentialAttestation,
            WebAuthNGetApiVersionNumber, WebAuthNIsUserVerifyingPlatformAuthenticatorAvailable,
            WEBAUTHN_API_VERSION_1, WEBAUTHN_ASSERTION, WEBAUTHN_AUTHENTICATOR_ATTACHMENT_ANY,
            WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS,
            WEBAUTHN_AUTHENTICATOR_MAKE_CREDENTIAL_OPTIONS, WEBAUTHN_CLIENT_DATA,
            WEBAUTHN_COSE_CREDENTIAL_PARAMETER, WEBAUTHN_COSE_CREDENTIAL_PARAMETERS,
            WEBAUTHN_CREDENTIAL, WEBAUTHN_CREDENTIAL_ATTESTATION, WEBAUTHN_CREDENTIALS,
            WEBAUTHN_CREDENTIAL_TYPE_PUBLIC_KEY,
            WEBAUTHN_RP_ENTITY_INFORMATION, WEBAUTHN_USER_ENTITY_INFORMATION,
            WEBAUTHN_USER_VERIFICATION_REQUIREMENT_PREFERRED,
        },
        UI::WindowsAndMessaging::GetForegroundWindow,
    },
};

use super::fido2::SecurityKeyInfo;

/// Relying Party ID for SimplyTerm vault
const RP_ID: &str = "simplyterm.local";
const RP_NAME: &str = "SimplyTerm";

/// Check if Windows WebAuthn API is available
pub fn is_available() -> bool {
    unsafe {
        let version = WebAuthNGetApiVersionNumber();
        version >= WEBAUTHN_API_VERSION_1
    }
}

/// Check if a platform authenticator (Windows Hello) is available
#[allow(dead_code)]
pub fn is_platform_authenticator_available() -> bool {
    unsafe {
        match WebAuthNIsUserVerifyingPlatformAuthenticatorAvailable() {
            Ok(result) => result.as_bool(),
            Err(_) => false,
        }
    }
}

/// Detect connected security keys via Windows WebAuthn API
///
/// Note: Windows WebAuthn doesn't provide a way to enumerate physical USB devices.
/// Windows Hello is handled separately in its own UI section, so we don't include it here.
/// USB keys will be detected by Windows' native WebAuthn dialog when user clicks Configure.
pub fn detect_security_keys() -> Result<Vec<SecurityKeyInfo>, String> {
    if !is_available() {
        return Err("Windows WebAuthn API not available".to_string());
    }

    // On Windows, we can't enumerate USB security keys before use.
    // Windows Hello is already handled in its own dedicated section of the UI.
    // When the user clicks "Configure", Windows will show its native WebAuthn dialog
    // which handles USB key detection and interaction automatically.
    //
    // Return empty list - the UI allows configuration anyway on Windows.
    Ok(vec![])
}

/// Create a FIDO2 credential using Windows WebAuthn API
pub fn register_security_key(_pin: Option<&str>) -> Result<(Vec<u8>, Vec<u8>), String> {
    if !is_available() {
        return Err("Windows WebAuthn API not available".to_string());
    }

    unsafe {
        // Prepare RP information
        let rp_id = HSTRING::from(RP_ID);
        let rp_name = HSTRING::from(RP_NAME);
        let rp_info = WEBAUTHN_RP_ENTITY_INFORMATION {
            dwVersion: 1,
            pwszId: PCWSTR(rp_id.as_ptr()),
            pwszName: PCWSTR(rp_name.as_ptr()),
            pwszIcon: PCWSTR::null(),
        };

        // Prepare user information
        let user_id: Vec<u8> = vec![1, 2, 3, 4, 5, 6, 7, 8]; // Simple user ID for vault
        let user_name = HSTRING::from("vault-user");
        let user_display_name = HSTRING::from("SimplyTerm Vault");
        let user_info = WEBAUTHN_USER_ENTITY_INFORMATION {
            dwVersion: 1,
            cbId: user_id.len() as u32,
            pbId: user_id.as_ptr() as *mut u8,
            pwszName: PCWSTR(user_name.as_ptr()),
            pwszIcon: PCWSTR::null(),
            pwszDisplayName: PCWSTR(user_display_name.as_ptr()),
        };

        // Prepare credential parameters (ES256 - ECDSA with P-256)
        let cose_params = [WEBAUTHN_COSE_CREDENTIAL_PARAMETER {
            dwVersion: 1,
            pwszCredentialType: WEBAUTHN_CREDENTIAL_TYPE_PUBLIC_KEY,
            lAlg: -7, // ES256
        }];
        let cred_params = WEBAUTHN_COSE_CREDENTIAL_PARAMETERS {
            cCredentialParameters: 1,
            pCredentialParameters: cose_params.as_ptr() as *mut _,
        };

        // Prepare client data
        let challenge = generate_challenge();
        let client_data_json = format!(
            r#"{{"type":"webauthn.create","challenge":"{}","origin":"simplyterm://vault"}}"#,
            base64_url_encode(&challenge)
        );
        let client_data_bytes = client_data_json.as_bytes();
        let client_data = WEBAUTHN_CLIENT_DATA {
            dwVersion: 1,
            cbClientDataJSON: client_data_bytes.len() as u32,
            pbClientDataJSON: client_data_bytes.as_ptr() as *mut u8,
            pwszHashAlgId: PCWSTR::null(), // Use default SHA-256
        };

        // Get foreground window handle for the WebAuthn dialog
        let hwnd = GetForegroundWindow();

        // Prepare options (version 1 for maximum compatibility)
        let options = WEBAUTHN_AUTHENTICATOR_MAKE_CREDENTIAL_OPTIONS {
            dwVersion: 1,
            dwTimeoutMilliseconds: 60000,
            CredentialList: WEBAUTHN_CREDENTIALS {
                cCredentials: 0,
                pCredentials: ptr::null_mut(),
            },
            Extensions: windows::Win32::Networking::WindowsWebServices::WEBAUTHN_EXTENSIONS {
                cExtensions: 0,
                pExtensions: ptr::null_mut(),
            },
            dwAuthenticatorAttachment: WEBAUTHN_AUTHENTICATOR_ATTACHMENT_ANY,
            bRequireResidentKey: windows::Win32::Foundation::BOOL(0),
            dwUserVerificationRequirement: WEBAUTHN_USER_VERIFICATION_REQUIREMENT_PREFERRED,
            dwAttestationConveyancePreference: 0, // None
            dwFlags: 0,
            pCancellationId: ptr::null_mut(),
            pExcludeCredentialList: ptr::null_mut(),
            dwEnterpriseAttestation: 0,
            dwLargeBlobSupport: 0,
            bPreferResidentKey: windows::Win32::Foundation::BOOL(0),
            bBrowserInPrivateMode: windows::Win32::Foundation::BOOL(0),
            bEnablePrf: windows::Win32::Foundation::BOOL(0),
            pLinkedDevice: ptr::null_mut(),
            cbJsonExt: 0,
            pbJsonExt: ptr::null_mut(),
        };

        // Make credential
        let attestation: *mut WEBAUTHN_CREDENTIAL_ATTESTATION;
        let result = WebAuthNAuthenticatorMakeCredential(
            hwnd,
            &rp_info,
            &user_info,
            &cred_params,
            &client_data,
            Some(&options),
        );

        match result {
            Ok(att) => {
                attestation = att;
            }
            Err(e) => {
                return Err(format!("Failed to create credential: {:?}", e));
            }
        }

        if attestation.is_null() {
            return Err("No attestation returned".to_string());
        }

        // Extract credential ID
        let att_ref = &*attestation;
        let credential_id =
            std::slice::from_raw_parts(att_ref.pbCredentialId, att_ref.cbCredentialId as usize)
                .to_vec();

        // For key derivation, we'll do an assertion immediately
        let assertion_data = get_assertion_internal(&credential_id, &challenge)?;

        // Free attestation
        WebAuthNFreeCredentialAttestation(Some(attestation as *const _));

        Ok((credential_id, assertion_data))
    }
}

/// Authenticate with a security key using Windows WebAuthn API
pub fn authenticate_with_security_key(
    credential_id: &[u8],
    _pin: Option<&str>,
) -> Result<Vec<u8>, String> {
    // Derive deterministic challenge from credential ID
    let challenge = derive_challenge_from_credential(credential_id);
    get_assertion_internal(credential_id, &challenge)
}

/// Internal function to get assertion
fn get_assertion_internal(credential_id: &[u8], challenge: &[u8]) -> Result<Vec<u8>, String> {
    if !is_available() {
        return Err("Windows WebAuthn API not available".to_string());
    }

    unsafe {
        let rp_id = HSTRING::from(RP_ID);

        // Prepare client data
        let client_data_json = format!(
            r#"{{"type":"webauthn.get","challenge":"{}","origin":"simplyterm://vault"}}"#,
            base64_url_encode(challenge)
        );
        let client_data_bytes = client_data_json.as_bytes();
        let client_data = WEBAUTHN_CLIENT_DATA {
            dwVersion: 1,
            cbClientDataJSON: client_data_bytes.len() as u32,
            pbClientDataJSON: client_data_bytes.as_ptr() as *mut u8,
            pwszHashAlgId: PCWSTR::null(),
        };

        // Prepare allowed credentials
        let allowed_cred = WEBAUTHN_CREDENTIAL {
            dwVersion: 1,
            cbId: credential_id.len() as u32,
            pbId: credential_id.as_ptr() as *mut u8,
            pwszCredentialType: WEBAUTHN_CREDENTIAL_TYPE_PUBLIC_KEY,
        };
        let allowed_creds = WEBAUTHN_CREDENTIALS {
            cCredentials: 1,
            pCredentials: &allowed_cred as *const _ as *mut _,
        };

        // Get foreground window handle for the WebAuthn dialog
        let hwnd = GetForegroundWindow();

        // Prepare options (version 1 for maximum compatibility)
        let options = WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS {
            dwVersion: 1,
            dwTimeoutMilliseconds: 60000,
            CredentialList: allowed_creds,
            Extensions: windows::Win32::Networking::WindowsWebServices::WEBAUTHN_EXTENSIONS {
                cExtensions: 0,
                pExtensions: ptr::null_mut(),
            },
            dwAuthenticatorAttachment: WEBAUTHN_AUTHENTICATOR_ATTACHMENT_ANY,
            dwUserVerificationRequirement: WEBAUTHN_USER_VERIFICATION_REQUIREMENT_PREFERRED,
            dwFlags: 0,
            pwszU2fAppId: PCWSTR::null(),
            pbU2fAppId: ptr::null_mut(),
            pCancellationId: ptr::null_mut(),
            pAllowCredentialList: ptr::null_mut(),
            dwCredLargeBlobOperation: 0,
            cbCredLargeBlob: 0,
            pbCredLargeBlob: ptr::null_mut(),
            pHmacSecretSaltValues: ptr::null_mut(),
            bBrowserInPrivateMode: windows::Win32::Foundation::BOOL(0),
            pLinkedDevice: ptr::null_mut(),
            bAutoFill: windows::Win32::Foundation::BOOL(0),
            cbJsonExt: 0,
            pbJsonExt: ptr::null_mut(),
        };

        // Get assertion
        let result = WebAuthNAuthenticatorGetAssertion(
            hwnd,
            PCWSTR(rp_id.as_ptr()),
            &client_data,
            Some(&options),
        );

        let assertion: *mut WEBAUTHN_ASSERTION = match result {
            Ok(a) => a,
            Err(e) => {
                return Err(format!("Failed to get assertion: {:?}", e));
            }
        };

        if assertion.is_null() {
            return Err("No assertion returned".to_string());
        }

        // Extract signature for key derivation
        let assertion_ref = &*assertion;
        let signature =
            std::slice::from_raw_parts(assertion_ref.pbSignature, assertion_ref.cbSignature as usize)
                .to_vec();

        // Free assertion
        WebAuthNFreeAssertion(assertion as *const _);

        Ok(signature)
    }
}

/// Generate a random challenge
fn generate_challenge() -> Vec<u8> {
    use rand::RngCore;
    let mut challenge = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut challenge);
    challenge
}

/// Derive a deterministic challenge from credential ID (same as in fido2.rs)
fn derive_challenge_from_credential(credential_id: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(b"simplyterm-vault-challenge-v1");
    hasher.update(credential_id);
    hasher.finalize().to_vec()
}

/// Base64 URL encode (no padding)
fn base64_url_encode(data: &[u8]) -> String {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    URL_SAFE_NO_PAD.encode(data)
}

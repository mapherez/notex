//! Native secret storage shared by Google and the preserved remote MCP bridge.
//! Tests inject a store; they never access the machine's credential manager.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum CredentialError {
    // Constructed by the fallback backend on unsupported platforms and by tests.
    #[cfg_attr(any(target_os = "windows", target_os = "macos"), allow(dead_code))]
    Unavailable,
    Storage,
}

pub(crate) trait SecretStore: Send + Sync {
    fn load(&self, service: &str, account: &str) -> Result<Option<String>, CredentialError>;
    fn save(&self, service: &str, account: &str, secret: &str) -> Result<(), CredentialError>;
    fn delete(&self, service: &str, account: &str) -> Result<(), CredentialError>;
}

pub(crate) struct NativeSecretStore;

#[cfg(any(target_os = "windows", target_os = "macos"))]
fn entry(service: &str, account: &str) -> Result<keyring::Entry, CredentialError> {
    keyring::Entry::new(service, account).map_err(|_| CredentialError::Storage)
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
impl SecretStore for NativeSecretStore {
    fn load(&self, service: &str, account: &str) -> Result<Option<String>, CredentialError> {
        match entry(service, account)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(CredentialError::Storage),
        }
    }

    fn save(&self, service: &str, account: &str, secret: &str) -> Result<(), CredentialError> {
        entry(service, account)?
            .set_password(secret)
            .map_err(|_| CredentialError::Storage)
    }

    fn delete(&self, service: &str, account: &str) -> Result<(), CredentialError> {
        match entry(service, account)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(CredentialError::Storage),
        }
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
impl SecretStore for NativeSecretStore {
    fn load(&self, _: &str, _: &str) -> Result<Option<String>, CredentialError> {
        Err(CredentialError::Unavailable)
    }

    fn save(&self, _: &str, _: &str, _: &str) -> Result<(), CredentialError> {
        Err(CredentialError::Unavailable)
    }

    fn delete(&self, _: &str, _: &str) -> Result<(), CredentialError> {
        Ok(())
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::{collections::HashMap, sync::Mutex};

    #[derive(Default)]
    pub(crate) struct FakeSecretStore {
        values: Mutex<HashMap<(String, String), String>>,
        pub(crate) failure: Option<CredentialError>,
    }

    impl FakeSecretStore {
        pub(crate) fn failing(error: CredentialError) -> Self {
            Self {
                failure: Some(error),
                ..Self::default()
            }
        }
    }

    impl SecretStore for FakeSecretStore {
        fn load(&self, service: &str, account: &str) -> Result<Option<String>, CredentialError> {
            if let Some(error) = self.failure {
                return Err(error);
            }
            Ok(self
                .values
                .lock()
                .unwrap()
                .get(&(service.into(), account.into()))
                .cloned())
        }

        fn save(&self, service: &str, account: &str, secret: &str) -> Result<(), CredentialError> {
            if let Some(error) = self.failure {
                return Err(error);
            }
            self.values
                .lock()
                .unwrap()
                .insert((service.into(), account.into()), secret.into());
            Ok(())
        }

        fn delete(&self, service: &str, account: &str) -> Result<(), CredentialError> {
            if let Some(error) = self.failure {
                return Err(error);
            }
            self.values
                .lock()
                .unwrap()
                .remove(&(service.into(), account.into()));
            Ok(())
        }
    }

    #[test]
    fn compiled_keyring_backend_is_native_without_opening_any_entries() {
        // Type checks only: no keyring builder, entry, password or OS prompt.
        #[cfg(target_os = "windows")]
        assert_eq!(
            std::any::TypeId::of::<keyring::default::WinCredentialBuilder>(),
            std::any::TypeId::of::<keyring::windows::WinCredentialBuilder>(),
        );
        #[cfg(target_os = "macos")]
        assert_eq!(
            std::any::TypeId::of::<keyring::default::MacCredentialBuilder>(),
            std::any::TypeId::of::<keyring::macos::MacCredentialBuilder>(),
        );
    }
}

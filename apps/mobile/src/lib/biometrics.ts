import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_LOCK_KEY = "biometric_lock_enabled_v1";

/** Préférence utilisateur (activée depuis Profil) — distincte de la dispo matérielle. */
export async function isBiometricLockEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRIC_LOCK_KEY)) === "true";
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_LOCK_KEY, String(enabled));
}

export async function isBiometricsAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

export async function authenticateWithBiometrics(
  promptMessage = "Confirmer votre identité"
): Promise<boolean> {
  const available = await isBiometricsAvailable();
  if (!available) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: "Utiliser le code",
    cancelLabel: "Annuler",
    disableDeviceFallback: false,
  });

  return result.success;
}

export async function getBiometricType(): Promise<"face" | "fingerprint" | "none"> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return "face";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "fingerprint";
  }
  return "none";
}

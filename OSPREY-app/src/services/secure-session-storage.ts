import 'react-native-get-random-values';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';

// DEV-ONLY: expo-secure-store has zero web support (its web shim is
// `export default {}`) since SecureStore wraps the iOS Keychain / Android
// Keystore, which browsers don't have. This branch only ever runs when
// Platform.OS === 'web', which happens exclusively via `npm run start --
// --web` for local design-preview work (see docs/superpowers/specs/
// 2026-07-17-mobile-design-foundation-home-pilot-design.md §5) — real
// iOS/Android builds never take this path, so it's safe to keep committed.
const WEB_KEY_SUFFIX = '_web_preview_only';

/**
 * Storage adapter for the Supabase auth session (Supabase's documented
 * "LargeSecureStore" pattern). SecureStore (iOS Keychain / Android Keystore)
 * caps values at ~2048 bytes on some platforms, and a full session payload
 * can exceed that — so the session itself is AES-256-CTR encrypted into
 * AsyncStorage, and only the 32-byte encryption key lives in SecureStore.
 *
 * A fresh random key is generated on every setItem, so each persisted
 * session blob is encrypted under its own key.
 */
class SecureSessionStorage {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(32));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    const encryptionKeyHex = aesjs.utils.hex.fromBytes(encryptionKey);
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(`${key}${WEB_KEY_SUFFIX}`, encryptionKeyHex);
    } else {
      await SecureStore.setItemAsync(key, encryptionKeyHex);
    }
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex =
      Platform.OS === 'web'
        ? await AsyncStorage.getItem(`${key}${WEB_KEY_SUFFIX}`)
        : await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    // Sessions persisted before this adapter existed are plaintext JSON in
    // AsyncStorage. Re-encrypt in place instead of logging the user out.
    if (stored.startsWith('{')) {
      await this.setItem(key, stored);
      return stored;
    }

    try {
      return await this.decrypt(key, stored);
    } catch {
      // Unreadable blob (e.g. keychain entry lost on restore-from-backup):
      // treat as signed out rather than crashing the auth bootstrap.
      await this.removeItem(key);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(`${key}${WEB_KEY_SUFFIX}`);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }
}

export const secureSessionStorage = new SecureSessionStorage();

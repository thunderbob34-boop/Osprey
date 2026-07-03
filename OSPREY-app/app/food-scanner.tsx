import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { lookupBarcode } from '@/services/food-lookup';

export default function FoodScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const handledRef = useRef(false);

  function goToManualLog() {
    router.replace({ pathname: '/(tabs)/log', params: { openFood: '1' } });
  }

  async function handleScan(data: string) {
    if (handledRef.current) return;
    handledRef.current = true;
    setScanning(false);
    setError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

    try {
      const result = await lookupBarcode(data);
      if (!result) {
        setError("Couldn't find that product.");
        handledRef.current = false;
        setScanning(true);
        return;
      }
      router.replace({
        pathname: '/(tabs)/log',
        params: {
          scannedFoodId: result.id,
          scannedName: result.name,
          scannedCalories: String(result.caloriesPer100g),
          scannedProtein: result.proteinG != null ? String(result.proteinG) : '',
          scannedCarbs: result.carbsG != null ? String(result.carbsG) : '',
          scannedFat: result.fatG != null ? String(result.fatG) : '',
        },
      });
    } catch {
      setError('Lookup failed. Check your connection and try again.');
      handledRef.current = false;
      setScanning(true);
    }
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Colors.teal} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    // Once iOS has recorded a denial it won't re-prompt — send them to Settings.
    const mustOpenSettings = !permission.canAskAgain;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Text style={styles.title}>Camera access needed</Text>
          <Text style={styles.subtitle}>
            {mustOpenSettings
              ? 'Camera access is turned off for OSPREY. Enable it in Settings to scan barcodes.'
              : 'OSPREY uses your camera to scan food barcodes for quick logging.'}
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={mustOpenSettings ? () => Linking.openSettings() : requestPermission}
          >
            <Text style={styles.primaryBtnText}>
              {mustOpenSettings ? 'Open Settings' : 'Allow Camera'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={goToManualLog}>
            <Text style={styles.linkText}>Log food manually instead</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
            <Text style={styles.linkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
        }}
        onBarcodeScanned={scanning ? (result) => handleScan(result.data) : undefined}
      />
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
          onPress={() => setTorchOn((v) => !v)}
        >
          <Ionicons
            name={torchOn ? 'flashlight' : 'flashlight-outline'}
            size={20}
            color={torchOn ? '#000' : Colors.textPrimary}
          />
        </TouchableOpacity>
        <View style={styles.frame} />
        {!scanning ? (
          <View style={styles.statusBox}>
            <ActivityIndicator color={Colors.teal} />
            <Text style={styles.statusText}>Looking up product...</Text>
          </View>
        ) : error ? (
          <View style={styles.statusBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.manualBtn} onPress={goToManualLog}>
              <Text style={styles.manualBtnText}>Log manually</Text>
            </TouchableOpacity>
            <Text style={styles.hintSmall}>…or point the camera at another barcode</Text>
          </View>
        ) : (
          <Text style={styles.hint}>Align the barcode within the frame</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeBtnText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  torchBtn: {
    position: 'absolute',
    top: 60,
    left: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchBtnOn: { backgroundColor: Colors.teal },
  frame: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: Colors.teal,
    borderRadius: 16,
  },
  hint: { color: Colors.textPrimary, fontSize: 14, marginTop: 20, fontWeight: '600' },
  hintSmall: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  statusBox: { marginTop: 20, alignItems: 'center', gap: 10 },
  statusText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  errorText: {
    color: Colors.red,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  manualBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  manualBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: Colors.teal,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
  linkBtn: { paddingVertical: 10 },
  linkText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
});

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
import { Theme, Radius } from '@/constants/theme';
import { Button } from '@/components/ui';
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
        <ActivityIndicator color={Theme.accent} />
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
          <Button
            variant="primary"
            style={styles.primaryBtn}
            onPress={mustOpenSettings ? () => Linking.openSettings() : requestPermission}
            accessibilityLabel={mustOpenSettings ? 'Open Settings' : 'Allow camera access'}
          >
            {mustOpenSettings ? 'Open Settings' : 'Allow Camera'}
          </Button>
          <Button
            variant="secondary"
            style={styles.linkBtn}
            onPress={goToManualLog}
            accessibilityLabel="Log food manually instead"
          >
            Log food manually instead
          </Button>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
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
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.closeBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
          onPress={() => setTorchOn((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
          accessibilityState={{ selected: torchOn }}
        >
          <Ionicons
            name={torchOn ? 'flashlight' : 'flashlight-outline'}
            size={20}
            color={torchOn ? Theme.ink : Theme.text}
          />
        </TouchableOpacity>
        <View style={styles.frame} />
        {!scanning ? (
          <View style={styles.statusBox}>
            <ActivityIndicator color={Theme.accent} />
            <Text style={styles.statusText}>Looking up product...</Text>
          </View>
        ) : error ? (
          <View style={styles.statusBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              variant="primary"
              style={styles.manualBtn}
              onPress={goToManualLog}
              accessibilityLabel="Log manually"
            >
              Log manually
            </Button>
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
  container: { flex: 1, backgroundColor: Theme.ink },
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
  closeBtnText: { color: Theme.text, fontSize: 14, fontWeight: '700' },
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
  torchBtnOn: { backgroundColor: Theme.accent },
  frame: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: Theme.accent,
    borderRadius: Radius.card,
  },
  hint: { color: Theme.text, fontSize: 14, marginTop: 20, fontWeight: '600' },
  hintSmall: { color: Theme.textSoft, fontSize: 12, fontWeight: '600' },
  statusBox: { marginTop: 20, alignItems: 'center', gap: 10 },
  statusText: { color: Theme.text, fontSize: 14, fontWeight: '600' },
  errorText: {
    color: Colors.red,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  manualBtn: {
    // borderRadius comes from the Button primitive; only sizing is overridden here.
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: Theme.text },
  subtitle: { fontSize: 14, color: Theme.textMut, textAlign: 'center', lineHeight: 20 },
  primaryBtn: {
    marginTop: 12,
    // borderRadius comes from the Button primitive; only sizing is overridden here.
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  linkBtn: { paddingVertical: 10 },
  linkText: { fontSize: 13, color: Theme.textMut, fontWeight: '600' },
});

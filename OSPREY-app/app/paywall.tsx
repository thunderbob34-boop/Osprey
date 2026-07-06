import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import OzzieMascot from '@/components/OzzieMascot';
import {
  getOfferings,
  purchaseOspreyPlus,
  restorePurchases,
} from '@/services/subscriptions';
import { useSubscription } from '@/hooks/useSubscription';

const FEATURES = [
  { icon: '🤖', title: 'AI Race Briefings', desc: 'Ozzie preps you the morning of every race with personalized strategy.' },
  { icon: '📋', title: 'Race Retrospectives', desc: 'Post-race coaching debrief from Ozzie — what worked, what to fix.' },
  { icon: '🏆', title: 'Group Challenges', desc: 'Create unlimited mileage, workout, and duration challenges with friends.' },
  { icon: '🔔', title: 'Live Run Coaching', desc: 'Automatic mile-split callouts, pace alerts, and HR zone cues mid-run.' },
  { icon: '📈', title: 'Performance Intelligence', desc: 'Fitness/fatigue/form trends (CTL/ATL/TSB), injury risk score, race time predictor.' },
  { icon: '📆', title: 'AI Plan Generation', desc: 'Adaptive weekly training plans powered by GPT-4o-mini.' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { refresh } = useSubscription();

  const [priceString, setPriceString] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    getOfferings().then((o) => {
      const pkg = o?.current?.availablePackages[0];
      if (pkg) setPriceString(pkg.product.priceString);
    }).catch(() => undefined);
  }, []);

  async function handleSubscribe() {
    setPurchasing(true);
    try {
      const success = await purchaseOspreyPlus();
      if (success) {
        refresh();
        router.back();
      } else {
        Alert.alert('Purchase failed', 'Your payment was not completed. Please try again.');
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'userCancelled' in err) return;
      Alert.alert('Purchase failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        refresh();
        Alert.alert('Restored', 'Your OSPREY+ subscription has been restored.', [
          { text: 'Continue', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('No subscription found', 'We couldn\'t find an active OSPREY+ purchase on this Apple ID.');
      }
    } catch {
      Alert.alert('Restore failed', 'Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <View />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.logoWrap}>
          <OzzieMascot size={72} />
          <Text style={styles.logoTitle}>OSPREY+</Text>
          <Text style={styles.logoTagline}>Your AI coach, fully unleashed.</Text>
        </View>

        <View style={styles.featuresCard}>
          {FEATURES.map((f, i) => (
            <View
              key={f.title}
              style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureRowBorder]}
            >
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
              <Text style={styles.featureCheck}>✓</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.subscribeBtn, purchasing && styles.subscribeBtnLoading]}
          onPress={handleSubscribe}
          disabled={purchasing || restoring}
          accessibilityRole="button"
          accessibilityLabel={priceString ? `Start for ${priceString} per month` : 'Subscribe to OSPREY+'}
          accessibilityState={{ disabled: purchasing || restoring, busy: purchasing }}
        >
          {purchasing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Text style={styles.subscribeBtnText}>
                {priceString ? `Start for ${priceString}/mo` : 'Subscribe to OSPREY+'}
              </Text>
              <Text style={styles.subscribeBtnSub}>Cancel anytime</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={purchasing || restoring}
          accessibilityRole="button"
          accessibilityLabel="Restore purchase"
          accessibilityState={{ disabled: purchasing || restoring, busy: restoring }}
        >
          {restoring ? (
            <ActivityIndicator color={Colors.textMuted} size="small" />
          ) : (
            <Text style={styles.restoreBtnText}>Restore purchase</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.legal}>
          Subscription renews automatically. Cancel in App Store settings at any time.
          Price may vary by region.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  close: { color: Colors.textMuted, fontSize: 18, fontWeight: '700' },
  scroll: { padding: 24, paddingBottom: 56, gap: 20 },
  logoWrap: { alignItems: 'center', gap: 6, marginBottom: 8 },
  logoIcon: { fontSize: 52 },
  logoTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.teal,
    letterSpacing: 2,
  },
  logoTagline: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  featuresCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  featureRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  featureIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  featureDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, marginTop: 2 },
  featureCheck: { color: Colors.teal, fontSize: 15, fontWeight: '800', marginTop: 2 },
  subscribeBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    gap: 3,
  },
  subscribeBtnLoading: { opacity: 0.7 },
  subscribeBtnText: { color: '#000', fontSize: 17, fontWeight: '800' },
  subscribeBtnSub: { color: 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: '600' },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  restoreBtnText: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  legal: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: -4,
  },
});

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import { Colors } from '@/constants/colors';
import OzzieMascot from '@/components/OzzieMascot';
import {
  getOfferings,
  purchaseOspreyPlus,
  restorePurchases,
} from '@/services/subscriptions';
import { useSubscription } from '@/hooks/useSubscription';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/constants/links';

function packageLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case 'ANNUAL':
      return 'Annual';
    case 'MONTHLY':
      return 'Monthly';
    case 'WEEKLY':
      return 'Weekly';
    case 'SIX_MONTH':
      return '6 Months';
    case 'THREE_MONTH':
      return '3 Months';
    case 'TWO_MONTH':
      return '2 Months';
    case 'LIFETIME':
      return 'Lifetime';
    default:
      return pkg.identifier;
  }
}

/** Short price suffix (e.g. "/mo") derived from the package's ACTUAL billing period. */
function periodSuffix(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case 'ANNUAL':
      return '/yr';
    case 'MONTHLY':
      return '/mo';
    case 'WEEKLY':
      return '/wk';
    case 'SIX_MONTH':
      return '/6mo';
    case 'THREE_MONTH':
      return '/3mo';
    case 'TWO_MONTH':
      return '/2mo';
    case 'LIFETIME':
    default:
      return '';
  }
}

/** Long-form billing period (e.g. "per year") for accessibility labels. */
function periodLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case 'ANNUAL':
      return 'per year';
    case 'MONTHLY':
      return 'per month';
    case 'WEEKLY':
      return 'per week';
    case 'SIX_MONTH':
      return 'every 6 months';
    case 'THREE_MONTH':
      return 'every 3 months';
    case 'TWO_MONTH':
      return 'every 2 months';
    case 'LIFETIME':
    default:
      return '';
  }
}

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

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    getOfferings().then((o) => {
      const pkgs = o?.current?.availablePackages ?? [];
      setPackages(pkgs);
      setSelectedId(pkgs[0]?.identifier ?? null);
    }).catch(() => undefined);
  }, []);

  const selectedPackage = packages.find((p) => p.identifier === selectedId) ?? packages[0];
  const priceString = selectedPackage?.product.priceString ?? null;
  const priceSuffix = selectedPackage ? periodSuffix(selectedPackage) : '';
  const pricePeriodLabel = selectedPackage ? periodLabel(selectedPackage) : '';

  async function handleSubscribe() {
    setPurchasing(true);
    try {
      const success = await purchaseOspreyPlus(selectedId ?? undefined);
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
          <Ionicons name="close" size={22} color={Colors.textMuted} />
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

        {packages.length > 1 ? (
          <View style={styles.packageRow}>
            {packages.map((pkg) => (
              <TouchableOpacity
                key={pkg.identifier}
                style={[styles.packageChip, pkg.identifier === selectedId && styles.packageChipActive]}
                onPress={() => setSelectedId(pkg.identifier)}
                accessibilityRole="button"
                accessibilityLabel={`${packageLabel(pkg)}, ${pkg.product.priceString}`}
                accessibilityState={{ selected: pkg.identifier === selectedId }}
              >
                <Text
                  style={[
                    styles.packageChipLabel,
                    pkg.identifier === selectedId && styles.packageChipLabelActive,
                  ]}
                >
                  {packageLabel(pkg)}
                </Text>
                <Text
                  style={[
                    styles.packageChipPrice,
                    pkg.identifier === selectedId && styles.packageChipPriceActive,
                  ]}
                >
                  {pkg.product.priceString}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.subscribeBtn, purchasing && styles.subscribeBtnLoading]}
          onPress={handleSubscribe}
          disabled={purchasing || restoring}
          accessibilityRole="button"
          accessibilityLabel={priceString ? `Start for ${priceString} ${pricePeriodLabel}`.trim() : 'Subscribe to OSPREY+'}
          accessibilityState={{ disabled: purchasing || restoring, busy: purchasing }}
        >
          {purchasing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Text style={styles.subscribeBtnText}>
                {priceString ? `Start for ${priceString}${priceSuffix}` : 'Subscribe to OSPREY+'}
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
        <View style={styles.legalLinksRow}>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_OF_USE_URL).catch(() => undefined)}>
            <Text style={styles.legalLink}>Terms of Use</Text>
          </TouchableOpacity>
          <Text style={styles.legalLinkDivider}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => undefined)}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
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
  packageRow: { flexDirection: 'row', gap: 10 },
  packageChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  packageChipActive: { borderColor: Colors.teal, backgroundColor: Colors.surfaceTeal },
  packageChipLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  packageChipLabelActive: { color: Colors.teal },
  packageChipPrice: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  packageChipPriceActive: { color: Colors.teal },
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
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: -8,
  },
  legalLink: { color: Colors.textMuted, fontSize: 11, fontWeight: '600', textDecorationLine: 'underline' },
  legalLinkDivider: { color: Colors.textMuted, fontSize: 11 },
});

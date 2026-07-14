import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ENTITLEMENT_ID = 'osprey_plus';

let configured = false;
// Tracks the in-flight/completed init call so hasOspreyPlus() (and friends)
// can wait for it instead of racing it — without this, a check that runs
// before RevenueCat finishes configuring reads `configured === false` and
// the wrong entitlement answer gets cached by useSubscription for the rest
// of the session.
let initPromise: Promise<void> | null = null;

// An unconfigured store (no RevenueCat key, or Android — never wired up) used
// to fail OPEN (`return true`) unconditionally, which meant a real build
// shipped with no key silently gave every user OSPREY+ for free. Fail closed
// in any real build; keep failing open only in __DEV__ so local development
// (Expo Go) doesn't require a RevenueCat sandbox account to exercise
// Plus-gated UI.
const UNCONFIGURED_ENTITLEMENT = typeof __DEV__ !== 'undefined' && __DEV__;

export function initRevenueCat(userId: string): Promise<void> {
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY) {
    return Promise.resolve();
  }
  if (!initPromise) {
    initPromise = (async () => {
      Purchases.setLogLevel(LOG_LEVEL.INFO);
      Purchases.configure({ apiKey: REVENUECAT_IOS_KEY, appUserID: userId });
      configured = true;
    })();
  }
  return initPromise;
}

async function waitForInit(): Promise<void> {
  if (initPromise) {
    await initPromise.catch(() => undefined);
  }
}

export async function hasOspreyPlus(): Promise<boolean> {
  await waitForInit();
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY || !configured) {
    return UNCONFIGURED_ENTITLEMENT;
  }

  const info = await Purchases.getCustomerInfo();
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}

export async function getOfferings() {
  await waitForInit();
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY || !configured) return null;
  return Purchases.getOfferings();
}

/**
 * Buys the given package identifier, or the offering's first package if
 * none is specified (e.g. only one product is configured in RevenueCat).
 */
export async function purchaseOspreyPlus(packageIdentifier?: string): Promise<boolean> {
  await waitForInit();
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY || !configured) {
    return UNCONFIGURED_ENTITLEMENT;
  }

  const offerings = await getOfferings();
  const packages = offerings?.current?.availablePackages ?? [];
  const packageToBuy = packageIdentifier
    ? packages.find((p) => p.identifier === packageIdentifier) ?? packages[0]
    : packages[0];
  if (!packageToBuy) return false;

  const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
  return Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);
}

export async function restorePurchases(): Promise<boolean> {
  await waitForInit();
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY || !configured) {
    return UNCONFIGURED_ENTITLEMENT;
  }
  const info = await Purchases.restorePurchases();
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}

/**
 * Call on sign-out. Without this, `configured` stays true and the next
 * `initRevenueCat(userId)` for a different account no-ops — the new user
 * silently inherits the previous account's RevenueCat identity/entitlements.
 */
export async function resetRevenueCat(): Promise<void> {
  if (configured) {
    try {
      await Purchases.logOut();
    } catch {
      // best-effort — still reset local state so the next sign-in reconfigures
    }
  }
  configured = false;
  initPromise = null;
}

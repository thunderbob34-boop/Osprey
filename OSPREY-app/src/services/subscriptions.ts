import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ENTITLEMENT_ID = 'osprey_plus';

let configured = false;
// Tracks the in-flight/completed init call so hasOspreyPlus() (and friends)
// can wait for it instead of racing it — without this, a check that runs
// before RevenueCat finishes configuring reads `configured === false` and
// permanently fail-opens the paywall for the rest of the session (the
// result gets cached by useSubscription and never re-checked).
let initPromise: Promise<void> | null = null;

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
    return true;
  }

  const info = await Purchases.getCustomerInfo();
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}

export async function getOfferings() {
  await waitForInit();
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY || !configured) return null;
  return Purchases.getOfferings();
}

export async function purchaseOspreyPlus(): Promise<boolean> {
  await waitForInit();
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY || !configured) return true;

  const offerings = await getOfferings();
  const packageToBuy = offerings?.current?.availablePackages[0];
  if (!packageToBuy) return false;

  const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
  return Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);
}

export async function restorePurchases(): Promise<boolean> {
  await waitForInit();
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY || !configured) return true;
  const info = await Purchases.restorePurchases();
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}

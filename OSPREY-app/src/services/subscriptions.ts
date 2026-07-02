import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ENTITLEMENT_ID = 'osprey_plus';

let configured = false;

export async function initRevenueCat(userId: string): Promise<void> {
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY) return;

  if (!configured) {
    Purchases.setLogLevel(LOG_LEVEL.INFO);
    Purchases.configure({ apiKey: REVENUECAT_IOS_KEY, appUserID: userId });
    configured = true;
    return;
  }

  // SDK is already configured, possibly still bound to a previous user's
  // appUserID (e.g. after sign-out/sign-in in the same app session). Switch
  // identity explicitly so the new user doesn't inherit the previous user's
  // entitlement, and any purchase they make isn't attributed to that account.
  const current = await Purchases.getAppUserID();
  if (current !== userId) {
    await Purchases.logIn(userId);
  }
}

/** Detach RevenueCat from the signed-out user's identity so the next sign-in starts clean. */
export async function resetRevenueCatOnSignOut(): Promise<void> {
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY || !configured) return;
  await Purchases.logOut();
}

export async function hasOspreyPlus(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY || !configured) {
    return true;
  }

  const info = await Purchases.getCustomerInfo();
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}

export async function getOfferings() {
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY || !configured) return null;
  return Purchases.getOfferings();
}

export async function purchaseOspreyPlus(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY || !configured) return true;

  const offerings = await getOfferings();
  const packageToBuy = offerings?.current?.availablePackages[0];
  if (!packageToBuy) return false;

  const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
  return Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);
}

export async function restorePurchases(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_KEY || !configured) return true;
  const info = await Purchases.restorePurchases();
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}

# RevenueCat Setup Instructions for OSPREY

## Objective
Complete RevenueCat configuration to enable in-app subscriptions for OSPREY iOS app.

## Current Status
✅ App Store Connect credentials configured in RevenueCat
✅ API Key (82388DDY25) validated

## Remaining Tasks

### 1. Import Products from App Store Connect
**Location:** RevenueCat Dashboard → Products

1. Click **Products** in the left sidebar
2. Find the **OSPREY** section
3. Click **+ New** or **Import** button
4. Select/import these two subscriptions from App Store Connect:
   - `osprey_plus_monthly` (1 month)
   - `osprey_plus_annual` (1 year)
5. Confirm products are imported and showing in the OSPREY product catalog

### 2. Create the `osprey_plus` Entitlement
**Location:** RevenueCat Dashboard → Entitlements

1. Click **Entitlements** in the left sidebar
2. Click **+ New Entitlement**
3. Create entitlement with:
   - **Name:** `osprey_plus`
   - **Description:** "OSPREY Premium subscription access"
4. Click **Create**

### 3. Link Both Products to the Entitlement
1. Go to **Entitlements** and select `osprey_plus`
2. Click **Add Products** or **Link Products**
3. Select both:
   - `osprey_plus_monthly`
   - `osprey_plus_annual`
4. Save/confirm the links

### 4. Verify Offerings (Optional but Recommended)
**Location:** RevenueCat Dashboard → Offerings

1. Check if an offering exists that contains the `osprey_plus` entitlement
2. If not, create one:
   - **Name:** `osprey_plus_offering` or similar
   - **Add both packages** (monthly and annual)
   - Link to `osprey_plus` entitlement

### 5. Testing
**Note: Testing requires a real iOS device or simulator**

Once products are imported and entitlement is linked:
1. Build OSPREY app with latest RevenueCat SDK configuration
2. Test on iOS device using Sandbox Apple ID:
   - Attempt to purchase monthly subscription
   - Verify subscription is recognized as `osprey_plus` entitlement
   - Test subscription restoration (uninstall/reinstall app)
   - Attempt to purchase annual subscription and verify upgrade/downgrade options

### 6. Final Verification in RevenueCat
After testing:
1. Go to **Customers** in RevenueCat
2. Find test user account
3. Verify:
   - ✅ Subscription is active
   - ✅ `osprey_plus` entitlement is granted
   - ✅ Correct product (monthly/annual) is linked

## Reference Information

**Subscription Product IDs:**
- Monthly: `osprey_plus_month`
- Annual: `osprey_plus_annual`

**Entitlement Name:**
- `osprey_plus`

**App Store Connect Bundle ID:**
- `com.SillyGoose.OSPREY`

**RevenueCat API Key:**
- Key ID: `82388DDY25`
- Issuer ID: `699baa45-158f-4f9f-ba2c-569b363c762c`

## Blockers Resolved
✅ Database migrations applied (011-015)
✅ Privacy policy URL configured
✅ Support URL identified (support@osprey.app)
✅ RevenueCat API credentials configured
✅ App Store subscription products created

## Completion Checklist
- [ ] Products imported into RevenueCat
- [ ] `osprey_plus` entitlement created
- [ ] Both products linked to entitlement
- [ ] Offering created (if needed)
- [ ] Purchase/restore tested on real device
- [ ] Test subscription verified in RevenueCat dashboard

// Mock AsyncStorage for Jest tests
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    removeItem: jest.fn(() => Promise.resolve()),
    multiSet: jest.fn(() => Promise.resolve()),
    multiGet: jest.fn(() => Promise.resolve([])),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    clear: jest.fn(() => Promise.resolve()),
  },
}));

// Mock expo-secure-store for Jest tests
jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock the entire supabase service
jest.mock('@/services/supabase', () => ({
  __esModule: true,
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    })),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: null } })),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
  extractFunctionErrorMessage: jest.fn(),
}));

// Mock react-native-purchases (RevenueCat) for Jest tests.
// It ships untranspiled ESM that Jest cannot parse, and it is reached
// transitively from any screen touching useSubscription — which is most of
// them. Without this, screen tests fail on an import chain rather than on
// anything they are actually asserting.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getCustomerInfo: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
    getOfferings: jest.fn(() => Promise.resolve({ current: null })),
    purchasePackage: jest.fn(() => Promise.resolve({ customerInfo: { entitlements: { active: {} } } })),
    restorePurchases: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
    logIn: jest.fn(() => Promise.resolve({ customerInfo: { entitlements: { active: {} } } })),
    logOut: jest.fn(() => Promise.resolve()),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
  LOG_LEVEL: { VERBOSE: 'VERBOSE', DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' },
}));

// Mock react-native-svg. Its native font loading throws under jest-expo
// ("loadedNativeFonts.forEach is not a function").
//
// The mock renders each SVG element as a host view of the same name and
// PRESERVES ALL PROPS — that matters: chart tests assert on `stroke` and
// `fill`, so a mock that dropped props would let those assertions pass against
// an empty tree, which is worse than no test at all.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const makeMock = (name) => {
    const Component = ({ children, ...props }) =>
      React.createElement(name, props, children);
    Component.displayName = name;
    return Component;
  };
  const Svg = makeMock('Svg');
  return {
    __esModule: true,
    default: Svg,
    Svg,
    Circle: makeMock('Circle'),
    Ellipse: makeMock('Ellipse'),
    G: makeMock('G'),
    Line: makeMock('Line'),
    Path: makeMock('Path'),
    Polygon: makeMock('Polygon'),
    Polyline: makeMock('Polyline'),
    Rect: makeMock('Rect'),
    Text: makeMock('SvgText'),
    Defs: makeMock('Defs'),
    LinearGradient: makeMock('LinearGradient'),
    Stop: makeMock('Stop'),
  };
});

// Mock expo-font. Its native-font registry ("loadedNativeFonts.forEach is not
// a function") throws under jest-expo when a screen renders icon fonts.
jest.mock('expo-font', () => ({
  __esModule: true,
  useFonts: () => [true, null],
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
  isLoading: jest.fn(() => false),
  unloadAsync: jest.fn(() => Promise.resolve()),
  loadedNativeFonts: [],
}));

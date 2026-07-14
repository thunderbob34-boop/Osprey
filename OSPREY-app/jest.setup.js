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

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // jest-expo's default transformIgnorePatterns whitelists @sentry/react-native
  // for transformation but not its ESM-only @sentry/core dependency (pulled in
  // via src/services/crash-reporting.ts), which otherwise fails to parse under
  // Jest's CommonJS transform. Extend the whitelist to cover the whole @sentry
  // scope rather than replacing the rest of jest-expo's carefully tuned list.
  transformIgnorePatterns: [
    '/node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|native-base|react-native-svg)',
    '/node_modules/react-native-reanimated/plugin/',
  ],
};

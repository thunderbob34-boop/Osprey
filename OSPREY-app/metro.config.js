// Sentry's wrapper around Expo's default metro config — annotates bundles so
// stack traces symbolicate. Behaves identically to getDefaultConfig otherwise.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);

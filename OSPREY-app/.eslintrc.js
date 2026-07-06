module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['/dist/*', '/node_modules/*', '/.expo/*'],
  rules: {
    // Metro resolves the "@/*" -> "src/*" alias (via tsconfig `paths`) at build time,
    // but eslint-plugin-import's resolvers don't know about it: the default `node`
    // resolver has no alias support, and `eslint-import-resolver-typescript` (auto-
    // detected because it's present in node_modules) depends on a native binding
    // (unrs-resolver) that fails to load in this environment (npm/cli#4828). Rather
    // than pull in and pin another resolver package, turn off the two rules that
    // depend on filesystem resolution; tsc (`npm run typecheck`) already catches
    // genuinely broken imports.
    'import/no-unresolved': 'off',
    'import/namespace': 'off',
  },
};

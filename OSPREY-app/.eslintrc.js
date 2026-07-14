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
    // Ban `x.toISOString().slice(0, 10)` — the UTC date slice shifts the
    // calendar day for users whose local day differs from UTC. Use
    // localDateString()/parseLocalDate() from @/utils/date instead. Suppress
    // with an eslint-disable + justification only for internally-consistent
    // UTC keying (see src/services/performance.ts).
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "CallExpression[callee.property.name='slice'][callee.object.type='CallExpression'][callee.object.callee.property.name='toISOString']",
        message:
          'Avoid toISOString().slice() for calendar days (UTC day-shift bug). Use localDateString()/parseLocalDate() from @/utils/date.',
      },
    ],
  },
};

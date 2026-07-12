import { defineConfig } from 'astro/config';

// site is the production URL; base is '/' because Pages via Actions serves at the domain root.
export default defineConfig({
  site: 'https://osprey.app',
  build: { format: 'directory' },
});

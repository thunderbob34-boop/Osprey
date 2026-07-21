import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

export default defineConfig({
  plugins: [TanStackRouterVite({ routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }), react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // Test-only: lets fitness-load-parity.test.ts import OSPREY-app/src/services/performance.ts
    // (which uses mobile's own `@/` alias) without affecting the production build's resolver.
    alias: { '@': path.resolve(__dirname, '../OSPREY-app/src') },
  },
});

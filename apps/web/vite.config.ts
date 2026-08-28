import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API_DEV_TARGET = 'http://localhost:4000';

/**
 * `defineConfig` comes from vitest/config so the `test` block is typed. The API
 * workspace keeps a separate vitest.config.ts; here one file is used instead,
 * because a standalone test config would not inherit the plugins above.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Vite otherwise walks to the next free port, which silently hides a dev
    // server left running from an earlier session; failing to bind reports it.
    strictPort: true,
    // Production serves the SPA and the API from one origin (a Vercel rewrite
    // onto Render), which is what lets the refresh cookie stay first-party and
    // use SameSite=Lax. Proxying in development reproduces that topology, so
    // cookie and CORS behaviour cannot differ between here and the deployment.
    proxy: { '/api': API_DEV_TARGET },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    // Mock call history persists between tests otherwise, so an assertion on a
    // first recorded call can silently read one made by the test before it.
    clearMocks: true,
  },
});

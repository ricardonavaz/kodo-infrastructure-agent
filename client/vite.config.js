import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// Build-time version info injected as global constants
function getBuildInfo() {
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { /* not a git repo */ }

  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
  return {
    __APP_VERSION__: JSON.stringify(pkg.version || '0.0.0'),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  };
}

export default defineConfig({
  plugins: [react()],
  define: getBuildInfo(),
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
